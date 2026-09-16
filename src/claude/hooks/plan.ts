import { HOOK_MARKER } from "../../version.js";

export const HOOK_EVENTS = ["UserPromptSubmit", "Stop"] as const;
export type PromptGaugeHookEvent = (typeof HOOK_EVENTS)[number];

export interface ClaudeHookHandler {
  type?: string;
  command?: string;
  timeout?: number;
  [key: string]: unknown;
}

export interface ClaudeHookMatcherGroup {
  matcher?: string;
  hooks?: ClaudeHookHandler[];
  [key: string]: unknown;
}

export type ClaudeHooksConfig = Record<string, ClaudeHookMatcherGroup[]>;

export interface HooksInstallState {
  version: 1;
  installedAt: string;
  hookCommand: string;
  events: PromptGaugeHookEvent[];
  previousExisted: boolean;
}

export function isPromptGaugeHookCommand(command: string | undefined): boolean {
  if (!command) {
    return false;
  }
  return command.includes(HOOK_MARKER);
}

export function promptGaugeMatcherGroup(hookCommand: string): ClaudeHookMatcherGroup {
  return {
    hooks: [
      {
        type: "command",
        command: hookCommand,
        timeout: 10,
      },
    ],
  };
}

export function planHooksInstall(
  settings: Record<string, unknown> | undefined,
  hookCommand: string,
): {
  alreadyInstalled: boolean;
  previousExisted: boolean;
  nextSettings: Record<string, unknown>;
} {
  const current = { ...(settings ?? {}) };
  const hooks = cloneHooks(current.hooks);
  const previousExisted = Object.keys(hooks).length > 0;
  if (hasPromptGaugeHooks(hooks, hookCommand)) {
    return { alreadyInstalled: true, previousExisted, nextSettings: current };
  }
  for (const event of HOOK_EVENTS) {
    const groups = hooks[event] ? [...hooks[event]] : [];
    groups.push(promptGaugeMatcherGroup(hookCommand));
    hooks[event] = groups;
  }
  current.hooks = hooks;
  return { alreadyInstalled: false, previousExisted, nextSettings: current };
}

export function planHooksUninstall(settings: Record<string, unknown> | undefined): {
  nextSettings: Record<string, unknown>;
  restored: boolean;
} {
  const current = { ...(settings ?? {}) };
  const hooks = cloneHooks(current.hooks);
  if (!hasPromptGaugeHooks(hooks)) {
    return { nextSettings: current, restored: false };
  }
  const next: ClaudeHooksConfig = {};
  for (const [event, groups] of Object.entries(hooks)) {
    const kept = groups
      .map((group) => stripPromptGaugeHandlers(group))
      .filter((group): group is ClaudeHookMatcherGroup => group !== undefined);
    if (kept.length > 0) {
      next[event] = kept;
    }
  }
  if (Object.keys(next).length > 0) {
    current.hooks = next;
  } else {
    delete current.hooks;
  }
  return { nextSettings: current, restored: true };
}

export function hasPromptGaugeHooks(hooks: ClaudeHooksConfig, hookCommand?: string): boolean {
  for (const event of HOOK_EVENTS) {
    for (const group of hooks[event] ?? []) {
      for (const handler of group.hooks ?? []) {
        if (!isPromptGaugeHookCommand(handler.command)) {
          continue;
        }
        if (!hookCommand || handler.command === hookCommand) {
          return true;
        }
        if (hookCommand && isPromptGaugeHookCommand(handler.command)) {
          return true;
        }
      }
    }
  }
  return false;
}

function stripPromptGaugeHandlers(
  group: ClaudeHookMatcherGroup,
): ClaudeHookMatcherGroup | undefined {
  const handlers = (group.hooks ?? []).filter(
    (handler) => !isPromptGaugeHookCommand(handler.command),
  );
  if (
    handlers.length === 0 &&
    (group.hooks ?? []).some((handler) => isPromptGaugeHookCommand(handler.command))
  ) {
    const leftoverKeys = Object.keys(group).filter((key) => key !== "hooks");
    if (leftoverKeys.length === 0) {
      return undefined;
    }
  }
  if (handlers.length === (group.hooks ?? []).length) {
    return group;
  }
  if (handlers.length === 0) {
    return undefined;
  }
  return { ...group, hooks: handlers };
}

function cloneHooks(value: unknown): ClaudeHooksConfig {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const next: ClaudeHooksConfig = {};
  for (const [event, groups] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(groups)) {
      continue;
    }
    next[event] = groups.filter(
      (group): group is ClaudeHookMatcherGroup => typeof group === "object" && group !== null,
    );
  }
  return next;
}
