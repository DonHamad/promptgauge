import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runStatusLineWrapper } from "../../src/claude/statusline/wrapper.js";
import { writeJsonAtomic } from "../../src/utils/atomic-write.js";
import type { StatusLineInstallState } from "../../src/claude/statusline/plan.js";

const dirs: string[] = [];

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pg-wrap-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const payload = JSON.stringify({
  session_id: "s1",
  model: { display_name: "Opus" },
  rate_limits: { five_hour: { used_percentage: 10, resets_at: 1893456000 } },
});

describe("statusline wrapper", () => {
  it("forwards original stdin to the previous statusLine and hides PromptGauge output", () => {
    const dataDir = tempDir();
    const state: StatusLineInstallState = {
      version: 1,
      installedAt: "t",
      wrapperCommand: "pg",
      previousExisted: true,
      previousStatusLine: { type: "command", command: "echo original" },
    };
    writeJsonAtomic(path.join(dataDir, "statusline-state.json"), state);
    const received: string[] = [];
    const out = runStatusLineWrapper(payload, {
      dataDir,
      eventsFile: path.join(dataDir, "events.jsonl"),
      now: new Date("2026-09-16T04:00:00.000Z"),
      collect: (raw) => {
        received.push(raw);
        return {
          result: { kind: "statusline", events: [], printStatusLine: true },
          stdout: "PromptGauge hidden\n",
        };
      },
      forward: (command, input) => {
        expect(command).toBe("echo original");
        expect(input).toBe(payload);
        return { ok: true, stdout: "USER LINE", stderr: "" };
      },
    });
    expect(received).toEqual([payload]);
    expect(out).toBe("USER LINE\n");
    expect(out).not.toContain("PromptGauge hidden");
  });

  it("still forwards when the collector throws", () => {
    const dataDir = tempDir();
    writeJsonAtomic(path.join(dataDir, "statusline-state.json"), {
      version: 1,
      installedAt: "t",
      wrapperCommand: "pg",
      previousExisted: true,
      previousStatusLine: { command: "mine" },
    } satisfies StatusLineInstallState);
    const out = runStatusLineWrapper(payload, {
      dataDir,
      eventsFile: path.join(dataDir, "events.jsonl"),
      now: new Date(),
      collect: () => {
        throw new Error("collector failed");
      },
      forward: () => ({ ok: true, stdout: "still works", stderr: "" }),
    });
    expect(out).toBe("still works\n");
  });

  it("fails open when the existing statusLine throws", () => {
    const dataDir = tempDir();
    writeJsonAtomic(path.join(dataDir, "statusline-state.json"), {
      version: 1,
      installedAt: "t",
      wrapperCommand: "pg",
      previousExisted: true,
      previousStatusLine: { command: "mine" },
    } satisfies StatusLineInstallState);
    const out = runStatusLineWrapper(payload, {
      dataDir,
      eventsFile: path.join(dataDir, "events.jsonl"),
      now: new Date(),
      collect: () => ({
        result: { kind: "statusline", events: [], printStatusLine: true },
        stdout: "fallback\n",
      }),
      forward: () => {
        throw new Error("user statusline crashed");
      },
    });
    expect(out).toBe("");
  });

  it("prints PromptGauge output when there is no previous statusLine", () => {
    const dataDir = tempDir();
    const out = runStatusLineWrapper(payload, {
      dataDir,
      eventsFile: path.join(dataDir, "events.jsonl"),
      now: new Date("2026-09-16T04:00:00.000Z"),
      collect: () => ({
        result: { kind: "statusline", events: [], printStatusLine: true },
        stdout: "PromptGauge  5h 10%\n",
      }),
    });
    expect(out).toBe("PromptGauge  5h 10%\n");
  });
});
