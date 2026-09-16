import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseHook } from "../../src/claude/parsers/hooks.js";
import { ingestPayload } from "../../src/claude/parsers/ingest.js";

const capturedAt = "2026-09-16T04:00:00.000Z";

describe("hook parser", () => {
  it("records UserPromptSubmit without prompt text (windows path)", () => {
    const raw = fs.readFileSync(
      path.join(import.meta.dirname, "../fixtures/hook-windows-prompt.json"),
      "utf8",
    );
    const result = ingestPayload(raw, capturedAt);
    expect(result.kind).toBe("hook");
    expect(JSON.stringify(result.events)).not.toContain("never be stored");
    expect(result.events[0]).toMatchObject({
      type: "prompt_lifecycle",
      phase: "start",
      promptId: "prompt-win",
    });
  });

  it("records UserPromptSubmit without prompt text (unix path)", () => {
    const raw = fs.readFileSync(
      path.join(import.meta.dirname, "../fixtures/hook-unix-prompt.json"),
      "utf8",
    );
    const result = ingestPayload(raw, capturedAt);
    expect(JSON.stringify(result.events)).not.toContain("unix prompt text");
    expect(result.events[0]).toMatchObject({
      type: "prompt_lifecycle",
      sessionId: "session-unix",
    });
  });

  it("records tool name but not tool_input", () => {
    const result = parseHook(
      {
        hook_event_name: "PreToolUse",
        session_id: "s",
        prompt_id: "p",
        tool_name: "Write",
        tool_input: { file_path: "/secret/code.ts", content: "source code" },
        tool_use_id: "toolu_1",
      },
      capturedAt,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(JSON.stringify(result.events)).not.toContain("source code");
    expect(result.events[0]).toMatchObject({ type: "tool_activity", toolName: "Write" });
  });

  it("records task ids without task subject or description", () => {
    const result = parseHook(
      {
        hook_event_name: "TaskCreated",
        session_id: "s",
        prompt_id: "p",
        task_id: "task-001",
        task_subject: "secret subject",
        task_description: "secret description",
      },
      capturedAt,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(JSON.stringify(result.events)).not.toContain("secret");
    expect(result.events[0]).toMatchObject({ type: "task_lifecycle", taskId: "task-001" });
  });

  it("maps Stop to prompt end without assistant text or commands", () => {
    const result = parseHook(
      {
        hook_event_name: "Stop",
        session_id: "s",
        prompt_id: "p",
        last_assistant_message: "SUPER_SECRET_ASSISTANT_CONTENT_19284",
        transcript_path: "/tmp/t.jsonl",
        background_tasks: [{ command: "rm -rf /", description: "bad" }],
      },
      capturedAt,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.events[0]).toMatchObject({
        type: "prompt_lifecycle",
        phase: "stop",
        backgroundTaskCount: 1,
      });
      const json = JSON.stringify(result.events);
      expect(json).not.toContain("SUPER_SECRET_ASSISTANT_CONTENT_19284");
      expect(json).not.toContain("rm -rf");
      expect(json).not.toContain("transcript_path");
    }
  });
});
