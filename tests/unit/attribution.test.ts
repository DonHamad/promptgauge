import { describe, expect, it } from "vitest";
import { attributePrompt, promptsInSession } from "../../src/core/attribution/prompt-lifecycle.js";
import type { StoredEvent } from "../../src/core/types.js";

const events: StoredEvent[] = [
  {
    type: "prompt_lifecycle",
    capturedAt: "2026-09-16T04:00:00.000Z",
    ingestSource: "hook",
    phase: "start",
    sessionId: "sess-1",
    promptId: "p-1",
    hookEventName: "UserPromptSubmit",
  },
  {
    type: "quota_snapshot",
    capturedAt: "2026-09-16T04:00:05.000Z",
    ingestSource: "statusline",
    sessionId: "sess-1",
    promptId: "p-1",
    provenance: "claude_reported",
    source: "claude_statusline",
    fiveHour: { usedPercentage: 10, resetsAtEpochSeconds: 1893456000 },
  },
  {
    type: "tool_activity",
    capturedAt: "2026-09-16T04:00:10.000Z",
    ingestSource: "hook",
    phase: "pre",
    sessionId: "sess-1",
    promptId: "p-1",
    toolName: "Read",
  },
  {
    type: "prompt_lifecycle",
    capturedAt: "2026-09-16T04:01:00.000Z",
    ingestSource: "hook",
    phase: "stop",
    sessionId: "sess-1",
    promptId: "p-1",
    hookEventName: "Stop",
  },
  {
    type: "quota_snapshot",
    capturedAt: "2026-09-16T04:01:02.000Z",
    ingestSource: "statusline",
    sessionId: "sess-1",
    promptId: "p-1",
    provenance: "claude_reported",
    source: "claude_statusline",
    fiveHour: { usedPercentage: 12, resetsAtEpochSeconds: 1893456000 },
  },
  {
    type: "prompt_lifecycle",
    capturedAt: "2026-09-16T04:02:00.000Z",
    ingestSource: "hook",
    phase: "start",
    sessionId: "sess-1",
    promptId: "p-2",
    hookEventName: "UserPromptSubmit",
  },
];

describe("per-prompt attribution", () => {
  it("counts multiple prompts in one session", () => {
    expect(promptsInSession(events, "sess-1")).toEqual(["p-1", "p-2"]);
  });

  it("separates quota delta from token consumption", () => {
    const attr = attributePrompt(events, "p-1");
    expect(attr.quotaDeltaFiveHour?.value).toBe(2);
    expect(attr.quotaDeltaFiveHour?.provenance).toBe("derived");
    expect(attr.toolCallCount).toBe(1);
    expect(attr.open).toBe(false);
    expect(attr.limitation).toMatch(/not token consumption/i);
  });

  it("keeps an open prompt when Stop has not been observed", () => {
    const attr = attributePrompt(events, "p-2");
    expect(attr.open).toBe(true);
    expect(attr.endedAt).toBeUndefined();
  });
});
