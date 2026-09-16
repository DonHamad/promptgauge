import { WRAPPER_MARKER } from "../../version.js";

export interface ClaudeStatusLineConfig {
  type?: string;
  command?: string;
  padding?: number;
  refreshInterval?: number;
  hideVimModeIndicator?: boolean;
  [key: string]: unknown;
}

export interface StatusLineInstallState {
  version: 1;
  installedAt: string;
  wrapperCommand: string;
  previousExisted: boolean;
  previousStatusLine: ClaudeStatusLineConfig | null;
}

export function isPromptGaugeWrapperCommand(command: string | undefined): boolean {
  if (!command) {
    return false;
  }
  return command.includes(WRAPPER_MARKER) || /\bstatusline\s+run\b/.test(command);
}

export function preserveDisplayProps(
  previous: ClaudeStatusLineConfig | null,
): Pick<ClaudeStatusLineConfig, "padding" | "refreshInterval" | "hideVimModeIndicator"> {
  if (!previous) {
    return {};
  }
  const extra: Pick<
    ClaudeStatusLineConfig,
    "padding" | "refreshInterval" | "hideVimModeIndicator"
  > = {};
  if (typeof previous.padding === "number") {
    extra.padding = previous.padding;
  }
  if (typeof previous.refreshInterval === "number") {
    extra.refreshInterval = previous.refreshInterval;
  }
  if (typeof previous.hideVimModeIndicator === "boolean") {
    extra.hideVimModeIndicator = previous.hideVimModeIndicator;
  }
  return extra;
}

export function planInstall(
  settings: Record<string, unknown> | undefined,
  wrapperCommand: string,
): {
  alreadyInstalled: boolean;
  previous: ClaudeStatusLineConfig | null;
  nextSettings: Record<string, unknown>;
} {
  const current = { ...(settings ?? {}) };
  const existing = asStatusLine(current.statusLine);
  if (existing && isPromptGaugeWrapperCommand(existing.command)) {
    return { alreadyInstalled: true, previous: existing, nextSettings: current };
  }
  const previous = existing;
  current.statusLine = {
    type: "command",
    command: wrapperCommand,
    ...preserveDisplayProps(previous),
  };
  return { alreadyInstalled: false, previous, nextSettings: current };
}

export function planUninstall(
  settings: Record<string, unknown> | undefined,
  state: StatusLineInstallState | undefined,
): { nextSettings: Record<string, unknown>; restored: boolean } {
  const current = { ...(settings ?? {}) };
  const existing = asStatusLine(current.statusLine);
  if (!existing || !isPromptGaugeWrapperCommand(existing.command)) {
    return { nextSettings: current, restored: false };
  }
  if (state?.previousExisted && state.previousStatusLine) {
    current.statusLine = state.previousStatusLine;
  } else {
    delete current.statusLine;
  }
  return { nextSettings: current, restored: true };
}

function asStatusLine(value: unknown): ClaudeStatusLineConfig | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as ClaudeStatusLineConfig;
}
