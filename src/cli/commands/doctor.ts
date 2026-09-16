import fs from "node:fs";
import path from "node:path";
import type { StoredEvent } from "../../core/types.js";
import { eventLooksPrivate, findForbiddenKeys } from "../../core/privacy/allowlist.js";
import { isStale } from "../../utils/time.js";
import {
  claudeConfigDir,
  locateClaudeBinary,
  type ClaudeBinaryProbe,
} from "../../utils/platform.js";
import { looksLikeSecretFilename } from "../../utils/redact.js";
import { isPromptGaugeWrapperCommand } from "../../claude/statusline/plan.js";
import { readInstallState, readSettingsFile } from "../../claude/statusline/install.js";
import { summarizeSession } from "../../core/accounting/session-summary.js";

export type CheckStatus = "PASS" | "FAIL" | "WARN" | "UNAVAILABLE" | "STALE" | "N/A";

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
  events: StoredEvent[];
  now: Date;
  freshnessMs: number;
  claudeVersionCommand?: () =>
    ClaudeBinaryProbe | { ok?: boolean; found?: boolean; version?: string; path?: string };
}

export function runDoctor(ctx: DoctorContext): DoctorCheck[] {
  return [
    nodeCheck(ctx.nodeVersion),
    claudeBinaryCheck(ctx),
    claudeSettingsCheck(ctx),
    statusLineIntegrationCheck(ctx),
    existingStatusLinePreservedCheck(ctx),
    quotaTelemetryCheck(ctx),
    costTelemetryCheck(ctx),
    contextTelemetryCheck(ctx),
    privacyCheck(ctx),
    statusDataCheck(ctx),
    storageCheck(ctx),
    permissionsCheck(ctx),
  ];
}

export function formatDoctor(checks: DoctorCheck[]): string {
  const lines = ["PromptGauge Doctor", ""];
  const width = Math.max(...checks.map((check) => check.name.length));
  for (const check of checks) {
    lines.push(`${check.name.padEnd(width)}  ${check.status.padEnd(12)}  ${check.detail}`);
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

function claudeBinaryCheck(ctx: DoctorContext): DoctorCheck {
  const probe = ctx.claudeVersionCommand ?? (() => locateClaudeBinary(ctx.env, ctx.home));
  const result = probe();
  const found = result.ok === true || result.found === true;
  if (found) {
    return {
      name: "Claude Code binary",
      status: "PASS",
      detail: result.version ?? result.path ?? "claude command found",
    };
  }
  const configDir = resolveClaudeConfigDir(ctx);
  if (fs.existsSync(configDir) && fs.statSync(configDir).isDirectory()) {
    return {
      name: "Claude Code binary",
      status: "WARN",
      detail: "config directory present; claude binary not on PATH",
    };
  }
  return { name: "Claude Code binary", status: "FAIL", detail: "claude command not found" };
}

function claudeSettingsCheck(ctx: DoctorContext): DoctorCheck {
  const settingsPath = path.join(resolveClaudeConfigDir(ctx), "settings.json");
  if (!fs.existsSync(settingsPath)) {
    return { name: "Claude settings", status: "WARN", detail: "no settings.json found" };
  }
  if (looksLikeSecretFilename(path.basename(settingsPath))) {
    return { name: "Claude settings", status: "FAIL", detail: "refused to inspect a secret file" };
  }
  const loaded = readSettingsFile(settingsPath);
  if (!loaded.ok) {
    return { name: "Claude settings", status: "FAIL", detail: loaded.error };
  }
  return { name: "Claude settings", status: "PASS", detail: settingsPath };
}

function statusLineIntegrationCheck(ctx: DoctorContext): DoctorCheck {
  const settingsPath = path.join(resolveClaudeConfigDir(ctx), "settings.json");
  const loaded = readSettingsFile(settingsPath);
  if (!loaded.ok) {
    return { name: "PromptGauge statusLine integration", status: "FAIL", detail: loaded.error };
  }
  if (!loaded.existed) {
    return {
      name: "PromptGauge statusLine integration",
      status: "WARN",
      detail: "not installed",
    };
  }
  const command = statusLineCommand(loaded.value);
  if (isPromptGaugeWrapperCommand(command)) {
    return {
      name: "PromptGauge statusLine integration",
      status: "PASS",
      detail: "wrapper installed",
    };
  }
  return {
    name: "PromptGauge statusLine integration",
    status: "WARN",
    detail: command ? "statusLine present but not wrapped" : "no statusLine configured",
  };
}

function existingStatusLinePreservedCheck(ctx: DoctorContext): DoctorCheck {
  const state = readInstallState(ctx.dataDir);
  const settingsPath = path.join(resolveClaudeConfigDir(ctx), "settings.json");
  const loaded = readSettingsFile(settingsPath);
  const command = loaded.ok ? statusLineCommand(loaded.value) : "";
  if (!isPromptGaugeWrapperCommand(command)) {
    return {
      name: "Existing statusLine preserved",
      status: "N/A",
      detail: "PromptGauge wrapper is not installed",
    };
  }
  if (state?.previousExisted) {
    return {
      name: "Existing statusLine preserved",
      status: "PASS",
      detail: state.previousStatusLine?.command ?? "previous statusLine stored",
    };
  }
  return {
    name: "Existing statusLine preserved",
    status: "N/A",
    detail: "no previous statusLine",
  };
}

function quotaTelemetryCheck(ctx: DoctorContext): DoctorCheck {
  const summary = summarizeSession(ctx.events);
  const snap = summary.latestQuota;
  if (!snap) {
    return { name: "Real Claude quota telemetry", status: "UNAVAILABLE", detail: "no snapshots" };
  }
  if (isStale(snap.capturedAt, ctx.now, ctx.freshnessMs)) {
    return { name: "Real Claude quota telemetry", status: "STALE", detail: snap.capturedAt };
  }
  if (!snap.fiveHour && !snap.sevenDay) {
    return {
      name: "Real Claude quota telemetry",
      status: "UNAVAILABLE",
      detail: "rate_limits absent on latest snapshot",
    };
  }
  return {
    name: "Real Claude quota telemetry",
    status: "PASS",
    detail: "Claude-reported windows present",
  };
}

function costTelemetryCheck(ctx: DoctorContext): DoctorCheck {
  const summary = summarizeSession(ctx.events);
  if (summary.latestQuota?.estimatedApiCostUsd) {
    return {
      name: "Cost telemetry",
      status: "PASS",
      detail: `estimated API-equivalent $${summary.latestQuota.estimatedApiCostUsd.value.toFixed(5)}`,
    };
  }
  return {
    name: "Cost telemetry",
    status: "UNAVAILABLE",
    detail: "cost.total_cost_usd not observed",
  };
}

function contextTelemetryCheck(ctx: DoctorContext): DoctorCheck {
  const summary = summarizeSession(ctx.events);
  if (summary.latestQuota?.contextWindow) {
    return {
      name: "Context token telemetry",
      status: "PASS",
      detail: "latest API response context stored",
    };
  }
  return {
    name: "Context token telemetry",
    status: "UNAVAILABLE",
    detail: "context_window not observed",
  };
}

function privacyCheck(ctx: DoctorContext): DoctorCheck {
  for (const event of ctx.events) {
    const forbidden = findForbiddenKeys(event);
    if (forbidden.length > 0 || eventLooksPrivate(event)) {
      return {
        name: "Privacy",
        status: "FAIL",
        detail: `prohibited field in local log: ${forbidden[0] ?? "pattern match"}`,
      };
    }
  }
  return { name: "Privacy", status: "PASS", detail: "no prohibited fields stored" };
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

function statusLineCommand(settings: Record<string, unknown>): string {
  const statusLine = settings.statusLine;
  if (typeof statusLine !== "object" || statusLine === null) {
    return "";
  }
  const command = (statusLine as { command?: unknown }).command;
  return typeof command === "string" ? command : "";
}
