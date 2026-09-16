import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { claudeConfigDir } from "../../utils/platform.js";
import { looksLikeSecretFilename } from "../../utils/redact.js";

export type CheckStatus = "PASS" | "FAIL" | "WARN";

export interface DoctorCheck {
  name: string;
  status: CheckStatus;
  detail: string;
}

export interface DoctorContext {
  nodeVersion: string;
  dataDir: string;
  eventsExist: boolean;
  skippedCorruptLines: number;
  home: string;
  env: NodeJS.ProcessEnv;
  claudeVersionCommand?: () => { ok: boolean; version?: string };
}

export function runDoctor(ctx: DoctorContext): DoctorCheck[] {
  return [
    nodeCheck(ctx.nodeVersion),
    claudeCodeCheck(ctx),
    pluginCheck(ctx),
    statusDataCheck(ctx),
    storageCheck(ctx),
    permissionsCheck(ctx),
  ];
}

export function formatDoctor(checks: DoctorCheck[]): string {
  const lines = ["PromptGauge Doctor", ""];
  const width = Math.max(...checks.map((check) => check.name.length));
  for (const check of checks) {
    lines.push(`${check.name.padEnd(width)}  ${check.status.padEnd(4)}  ${check.detail}`);
  }
  lines.push("");
  lines.push("No credentials inspected.");
  return `${lines.join("\n")}\n`;
}

function nodeCheck(version: string): DoctorCheck {
  const major = Number.parseInt(version.replace(/^v/, "").split(".")[0] ?? "0", 10);
  if (major >= 22) {
    return { name: "Node", status: "PASS", detail: version };
  }
  return { name: "Node", status: "FAIL", detail: `${version} (need >= 22)` };
}

function resolveClaudeConfigDir(ctx: DoctorContext): string {
  const override = ctx.env.CLAUDE_CONFIG_DIR;
  if (override && override.length > 0) {
    return override;
  }
  return claudeConfigDir(ctx.home);
}

function claudeCodeCheck(ctx: DoctorContext): DoctorCheck {
  const probe = ctx.claudeVersionCommand ?? defaultClaudeVersion;
  const result = probe();
  if (result.ok) {
    return {
      name: "Claude Code detected",
      status: "PASS",
      detail: result.version ?? "claude command found",
    };
  }
  const configDir = resolveClaudeConfigDir(ctx);
  if (fs.existsSync(configDir) && fs.statSync(configDir).isDirectory()) {
    return {
      name: "Claude Code detected",
      status: "WARN",
      detail: "config directory present; claude binary not on PATH",
    };
  }
  return { name: "Claude Code detected", status: "FAIL", detail: "claude command not found" };
}

function pluginCheck(ctx: DoctorContext): DoctorCheck {
  const settingsPath = path.join(resolveClaudeConfigDir(ctx), "settings.json");
  if (!fs.existsSync(settingsPath)) {
    return {
      name: "Plugin integration",
      status: "WARN",
      detail: "no Claude Code user settings.json found",
    };
  }
  if (looksLikeSecretFilename(path.basename(settingsPath))) {
    return {
      name: "Plugin integration",
      status: "FAIL",
      detail: "refused to inspect a secret file",
    };
  }
  let text: string;
  try {
    text = fs.readFileSync(settingsPath, "utf8");
  } catch {
    return { name: "Plugin integration", status: "WARN", detail: "could not read settings.json" };
  }
  const mentions = /promptgauge/i.test(text);
  if (mentions) {
    return {
      name: "Plugin integration",
      status: "PASS",
      detail: "promptgauge referenced in settings.json",
    };
  }
  return {
    name: "Plugin integration",
    status: "WARN",
    detail: "settings.json present but PromptGauge not referenced",
  };
}

function statusDataCheck(ctx: DoctorContext): DoctorCheck {
  if (ctx.skippedCorruptLines > 0) {
    return {
      name: "Status data",
      status: "WARN",
      detail: `local log has ${ctx.skippedCorruptLines} corrupt line(s)`,
    };
  }
  if (!ctx.eventsExist) {
    return { name: "Status data", status: "WARN", detail: "no local snapshots yet" };
  }
  return { name: "Status data", status: "PASS", detail: "local event log present" };
}

function storageCheck(ctx: DoctorContext): DoctorCheck {
  try {
    fs.mkdirSync(ctx.dataDir, { recursive: true });
    return { name: "Local storage", status: "PASS", detail: ctx.dataDir };
  } catch {
    return { name: "Local storage", status: "FAIL", detail: `cannot create ${ctx.dataDir}` };
  }
}

function permissionsCheck(ctx: DoctorContext): DoctorCheck {
  const probe = path.join(ctx.dataDir, ".write-probe");
  try {
    fs.mkdirSync(ctx.dataDir, { recursive: true });
    fs.writeFileSync(probe, "ok", "utf8");
    fs.unlinkSync(probe);
    return { name: "Permissions", status: "PASS", detail: "data directory is writable" };
  } catch {
    return { name: "Permissions", status: "FAIL", detail: "data directory is not writable" };
  }
}

function defaultClaudeVersion(): { ok: boolean; version?: string } {
  const result = spawnSync("claude", ["--version"], {
    encoding: "utf8",
    timeout: 4000,
    windowsHide: true,
  });
  if (result.status === 0) {
    const version = (result.stdout || result.stderr).trim().split(/\r?\n/)[0];
    return { ok: true, version };
  }
  return { ok: false };
}
