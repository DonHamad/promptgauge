import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STATUSLINE_STATE_FILE_NAME, WRAPPER_MARKER } from "../../version.js";
import { parseJson } from "../../utils/json.js";
import { copyFileAtomic, writeJsonAtomic } from "../../utils/atomic-write.js";
import { claudeConfigDir, quoteShellArg } from "../../utils/platform.js";
import {
  isPromptGaugeWrapperCommand,
  planInstall,
  planUninstall,
  type StatusLineInstallState,
} from "./plan.js";

export interface SettingsIo {
  home: string;
  dataDir: string;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  cliEntry?: string;
  nodeExecutable?: string;
}

export interface InstallResult {
  ok: boolean;
  alreadyInstalled: boolean;
  settingsPath: string;
  backupPath?: string;
  wrapperCommand: string;
  preservedExisting: boolean;
  message: string;
}

function settingsPathFor(io: SettingsIo): string {
  const override = io.env?.CLAUDE_CONFIG_DIR;
  const dir = override && override.length > 0 ? override : claudeConfigDir(io.home);
  return path.join(dir, "settings.json");
}

function statePathFor(dataDir: string): string {
  return path.join(dataDir, STATUSLINE_STATE_FILE_NAME);
}

export function resolveWrapperCommand(io: SettingsIo): string {
  const node = io.nodeExecutable ?? process.execPath;
  const cli = io.cliEntry ?? defaultCliEntry();
  return `${quoteShellArg(node)} ${quoteShellArg(cli)} statusline run ${WRAPPER_MARKER}`;
}

function defaultCliEntry(): string {
  const fromImport = fileURLToPath(new URL("../../index.js", import.meta.url));
  if (fs.existsSync(fromImport)) {
    return fromImport;
  }
  return fromImport;
}

export function readSettingsFile(filePath: string):
  | {
      ok: true;
      value: Record<string, unknown>;
      existed: boolean;
    }
  | { ok: false; error: string; existed: boolean } {
  if (!fs.existsSync(filePath)) {
    return { ok: true, value: {}, existed: false };
  }
  const text = fs.readFileSync(filePath, "utf8");
  const parsed = parseJson(text);
  if (!parsed.ok || typeof parsed.value !== "object" || parsed.value === null) {
    return { ok: false, error: "settings.json is malformed; refusing to overwrite", existed: true };
  }
  return { ok: true, value: parsed.value as Record<string, unknown>, existed: true };
}

export function readInstallState(dataDir: string): StatusLineInstallState | undefined {
  const file = statePathFor(dataDir);
  if (!fs.existsSync(file)) {
    return undefined;
  }
  const parsed = parseJson(fs.readFileSync(file, "utf8"));
  if (!parsed.ok || typeof parsed.value !== "object" || parsed.value === null) {
    return undefined;
  }
  return parsed.value as StatusLineInstallState;
}

export function installStatusLine(io: SettingsIo): InstallResult {
  const settingsPath = settingsPathFor(io);
  const wrapperCommand = resolveWrapperCommand(io);
  const loaded = readSettingsFile(settingsPath);
  if (!loaded.ok) {
    return {
      ok: false,
      alreadyInstalled: false,
      settingsPath,
      wrapperCommand,
      preservedExisting: false,
      message: loaded.error,
    };
  }
  const planned = planInstall(loaded.value, wrapperCommand);
  if (planned.alreadyInstalled) {
    const state = readInstallState(io.dataDir);
    return {
      ok: true,
      alreadyInstalled: true,
      settingsPath,
      wrapperCommand: planned.previous?.command ?? wrapperCommand,
      preservedExisting: Boolean(state?.previousExisted),
      message: "PromptGauge status line wrapper already installed.",
    };
  }
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  let backupPath: string | undefined;
  if (loaded.existed) {
    backupPath = `${settingsPath}.promptgauge-backup`;
    copyFileAtomic(settingsPath, backupPath);
    copyFileAtomic(settingsPath, `${settingsPath}.promptgauge-backup-${Date.now()}`);
  }
  writeJsonAtomic(settingsPath, planned.nextSettings);
  const state: StatusLineInstallState = {
    version: 1,
    installedAt: (io.now ?? (() => new Date()))().toISOString(),
    wrapperCommand,
    previousExisted: Boolean(planned.previous),
    previousStatusLine: planned.previous,
  };
  writeJsonAtomic(statePathFor(io.dataDir), state);
  return {
    ok: true,
    alreadyInstalled: false,
    settingsPath,
    backupPath,
    wrapperCommand,
    preservedExisting: Boolean(planned.previous),
    message: planned.previous
      ? "Installed PromptGauge wrapper around the existing statusLine."
      : "Installed PromptGauge statusLine; no previous statusLine was present.",
  };
}

export function uninstallStatusLine(io: SettingsIo): InstallResult {
  const settingsPath = settingsPathFor(io);
  const wrapperCommand = resolveWrapperCommand(io);
  const loaded = readSettingsFile(settingsPath);
  if (!loaded.ok) {
    return {
      ok: false,
      alreadyInstalled: false,
      settingsPath,
      wrapperCommand,
      preservedExisting: false,
      message: loaded.error,
    };
  }
  const state = readInstallState(io.dataDir);
  const planned = planUninstall(loaded.value, state);
  if (!planned.restored) {
    return {
      ok: true,
      alreadyInstalled: false,
      settingsPath,
      wrapperCommand,
      preservedExisting: false,
      message: "PromptGauge statusLine wrapper was not installed.",
    };
  }
  writeJsonAtomic(settingsPath, planned.nextSettings);
  const stateFile = statePathFor(io.dataDir);
  if (fs.existsSync(stateFile)) {
    fs.unlinkSync(stateFile);
  }
  return {
    ok: true,
    alreadyInstalled: false,
    settingsPath,
    wrapperCommand,
    preservedExisting: Boolean(state?.previousExisted),
    message: state?.previousExisted
      ? "Restored the previous statusLine configuration."
      : "Removed the PromptGauge statusLine entry.",
  };
}

export function describeStatusLine(io: SettingsIo): string {
  const settingsPath = settingsPathFor(io);
  const loaded = readSettingsFile(settingsPath);
  const state = readInstallState(io.dataDir);
  const lines = ["PromptGauge statusline status", "", `Settings:  ${settingsPath}`];
  if (!loaded.ok) {
    lines.push(`JSON:      FAIL (${loaded.error})`);
    return `${lines.join("\n")}\n`;
  }
  if (!loaded.existed) {
    lines.push("JSON:      no settings.json yet");
    lines.push("Wrapper:   not installed");
    return `${lines.join("\n")}\n`;
  }
  const command =
    loaded.value.statusLine &&
    typeof loaded.value.statusLine === "object" &&
    loaded.value.statusLine !== null &&
    "command" in loaded.value.statusLine
      ? String((loaded.value.statusLine as { command?: unknown }).command ?? "")
      : "";
  const wrapped = isPromptGaugeWrapperCommand(command);
  lines.push(`Wrapper:   ${wrapped ? "installed" : "not installed"}`);
  if (command) {
    lines.push(`Command:   ${command}`);
  }
  if (wrapped && state?.previousExisted) {
    lines.push(`Preserved: ${state.previousStatusLine?.command ?? "(previous statusLine object)"}`);
  } else if (wrapped) {
    lines.push("Preserved: N/A (no previous statusLine)");
  } else if (command) {
    lines.push("Preserved: existing statusLine is untouched");
  } else {
    lines.push("Preserved: N/A");
  }
  return `${lines.join("\n")}\n`;
}
