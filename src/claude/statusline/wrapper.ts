import { collectFromStdin } from "../../cli/commands/collect.js";
import { spawnSync } from "node:child_process";
import { isPromptGaugeWrapperCommand, type ClaudeStatusLineConfig } from "./plan.js";
import { readInstallState } from "./install.js";

export interface WrapperContext {
  eventsFile: string;
  dataDir: string;
  now: Date;
  collect?: typeof collectFromStdin;
  forward?: (command: string, input: string) => { ok: boolean; stdout: string; stderr: string };
}

export function runStatusLineWrapper(raw: string, ctx: WrapperContext): string {
  let fallback = "";
  try {
    const collect = ctx.collect ?? collectFromStdin;
    fallback = collect(raw, ctx.eventsFile, ctx.now).stdout;
  } catch {
    // Fail open: telemetry must never hide the user's status line.
  }

  const state = readInstallState(ctx.dataDir);
  const command = forwardCommand(state?.previousStatusLine);
  if (!command) {
    return normalizeLine(fallback);
  }

  const forward = ctx.forward ?? defaultForward;
  try {
    const result = forward(command, raw);
    if (result.stdout.length > 0) {
      return normalizeLine(result.stdout);
    }
    return "";
  } catch {
    return "";
  }
}

function forwardCommand(previous: ClaudeStatusLineConfig | null | undefined): string | undefined {
  const command = previous?.command;
  if (!command || isPromptGaugeWrapperCommand(command)) {
    return undefined;
  }
  return command;
}

export function defaultForward(
  command: string,
  input: string,
): { ok: boolean; stdout: string; stderr: string } {
  const result = spawnSync(command, {
    input,
    encoding: "utf8",
    timeout: 8000,
    shell: true,
    windowsHide: true,
  });
  return {
    ok: result.status === 0,
    stdout: firstLine(result.stdout ?? ""),
    stderr: result.stderr ?? "",
  };
}

function firstLine(text: string): string {
  return text.split(/\r?\n/)[0] ?? "";
}

function normalizeLine(text: string): string {
  if (text.length === 0) {
    return "";
  }
  return text.endsWith("\n") ? text : `${text}\n`;
}
