import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HOOK_MARKER, HOOKS_STATE_FILE_NAME } from "../../version.js";
import { copyFileAtomic, writeJsonAtomic } from "../../utils/atomic-write.js";
import { quoteShellArg } from "../../utils/platform.js";
import {
  readSettingsFile,
  settingsPathFor,
  type SettingsIo,
  type InstallResult,
} from "../statusline/install.js";
import {
  hasPromptGaugeHooks,
  isPromptGaugeHookCommand,
  planHooksInstall,
  planHooksUninstall,
  type ClaudeHooksConfig,
  type HooksInstallState,
} from "./plan.js";

export function resolveHookCommand(io: SettingsIo): string {
  const node = io.nodeExecutable ?? process.execPath;
  const cli = io.cliEntry ?? defaultCliEntry();
  return `${quoteShellArg(node)} ${quoteShellArg(cli)} collect ${HOOK_MARKER}`;
}

function defaultCliEntry(): string {
  return fileURLToPath(new URL("../../index.js", import.meta.url));
}

function statePathFor(dataDir: string): string {
  return path.join(dataDir, HOOKS_STATE_FILE_NAME);
}

export function readHooksState(dataDir: string): HooksInstallState | undefined {
  const file = statePathFor(dataDir);
  if (!fs.existsSync(file)) {
    return undefined;
  }
  const raw = fs.readFileSync(file, "utf8");
  try {
    return JSON.parse(raw) as HooksInstallState;
  } catch {
    return undefined;
  }
}

export function installHooks(io: SettingsIo): InstallResult {
  const settingsPath = settingsPathFor(io);
  const hookCommand = resolveHookCommand(io);
  const loaded = readSettingsFile(settingsPath);
  if (!loaded.ok) {
    return {
      ok: false,
      alreadyInstalled: false,
      settingsPath,
      wrapperCommand: hookCommand,
      preservedExisting: false,
      message: loaded.error,
    };
  }
  const planned = planHooksInstall(loaded.value, hookCommand);
  if (planned.alreadyInstalled) {
    return {
      ok: true,
      alreadyInstalled: true,
      settingsPath,
      wrapperCommand: hookCommand,
      preservedExisting: planned.previousExisted,
      message: "PromptGauge hooks already installed.",
    };
  }
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  let backupPath: string | undefined;
  if (loaded.existed) {
    backupPath = `${settingsPath}.promptgauge-hooks-backup`;
    copyFileAtomic(settingsPath, backupPath);
    copyFileAtomic(settingsPath, `${settingsPath}.promptgauge-hooks-backup-${Date.now()}`);
  }
  writeJsonAtomic(settingsPath, planned.nextSettings);
  const state: HooksInstallState = {
    version: 1,
    installedAt: (io.now ?? (() => new Date()))().toISOString(),
    hookCommand,
    events: ["UserPromptSubmit", "Stop"],
    previousExisted: planned.previousExisted,
  };
  writeJsonAtomic(statePathFor(io.dataDir), state);
  return {
    ok: true,
    alreadyInstalled: false,
    settingsPath,
    backupPath,
    wrapperCommand: hookCommand,
    preservedExisting: planned.previousExisted,
    message: planned.previousExisted
      ? "Installed PromptGauge UserPromptSubmit and Stop hooks alongside existing hooks."
      : "Installed PromptGauge UserPromptSubmit and Stop hooks.",
  };
}

export function uninstallHooks(io: SettingsIo): InstallResult {
  const settingsPath = settingsPathFor(io);
  const hookCommand = resolveHookCommand(io);
  const loaded = readSettingsFile(settingsPath);
  if (!loaded.ok) {
    return {
      ok: false,
      alreadyInstalled: false,
      settingsPath,
      wrapperCommand: hookCommand,
      preservedExisting: false,
      message: loaded.error,
    };
  }
  const planned = planHooksUninstall(loaded.value);
  if (!planned.restored) {
    return {
      ok: true,
      alreadyInstalled: false,
      settingsPath,
      wrapperCommand: hookCommand,
      preservedExisting: false,
      message: "PromptGauge hooks were not installed.",
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
    wrapperCommand: hookCommand,
    preservedExisting: true,
    message: "Removed PromptGauge hooks. Other hook entries were left in place.",
  };
}

export function describeHooks(io: SettingsIo): string {
  const settingsPath = settingsPathFor(io);
  const loaded = readSettingsFile(settingsPath);
  const lines = ["PromptGauge hooks status", "", `Settings:  ${settingsPath}`];
  if (!loaded.ok) {
    lines.push(`JSON:      FAIL (${loaded.error})`);
    return `${lines.join("\n")}\n`;
  }
  if (!loaded.existed) {
    lines.push("JSON:      no settings.json yet");
    lines.push("Hooks:     not installed");
    return `${lines.join("\n")}\n`;
  }
  const hooks = (loaded.value.hooks ?? {}) as ClaudeHooksConfig;
  const installed = hasPromptGaugeHooks(hooks);
  lines.push(`Hooks:     ${installed ? "installed (UserPromptSubmit, Stop)" : "not installed"}`);
  const foreign = countForeignHooks(hooks);
  lines.push(
    foreign > 0
      ? `Preserved: ${foreign} non-PromptGauge hook handler(s)`
      : "Preserved: N/A (no other hook handlers)",
  );
  return `${lines.join("\n")}\n`;
}

function countForeignHooks(hooks: ClaudeHooksConfig): number {
  let count = 0;
  for (const groups of Object.values(hooks)) {
    for (const group of groups ?? []) {
      for (const handler of group.hooks ?? []) {
        if (!isPromptGaugeHookCommand(handler.command)) {
          count += 1;
        }
      }
    }
  }
  return count;
}
