import { describe, expect, it } from "vitest";
import { costDeltaUsd, quotaDelta } from "../../src/core/quota/delta.js";
import { estimatedApiCostDeltaForPrompt } from "../../src/core/attribution/correlate.js";
import type { StoredEvent } from "../../src/core/types.js";

describe("quota delta guards", () => {
  const window = (used: number, reset: number) => ({
    usedPercentage: used,
    resetsAtEpochSeconds: reset,
  });

  it("returns derived delta when the window is stable and usage rose", () => {
    const delta = quotaDelta(window(10, 100), window(12, 100), "t");
    expect(delta?.value).toBe(2);
    expect(delta?.provenance).toBe("derived");
  });

  it("is unavailable across a resets_at change", () => {
    expect(quotaDelta(window(10, 100), window(12, 200), "t")).toBeUndefined();
  });

  it("is unavailable when usage decreases", () => {
    expect(quotaDelta(window(40, 100), window(10, 100), "t")).toBeUndefined();
  });

  it("is unavailable when a window is missing", () => {
    expect(quotaDelta(undefined, window(10, 100), "t")).toBeUndefined();
  });

  it("is unavailable after the reset timestamp has elapsed", () => {
    expect(
      quotaDelta(window(10, 1_700_000_000), window(12, 1_700_000_000), "2026-09-16T04:00:00.000Z"),
    ).toBeUndefined();
  });
});

describe("cost delta guards", () => {
  it("derives a non-negative increase", () => {
    const delta = costDeltaUsd(0.01, 0.04, "t");
    expect(delta?.value).toBeCloseTo(0.03);
    expect(delta?.provenance).toBe("derived_from_claude_reported_session_cost");
  });

  it("is unavailable on decrease or missing values", () => {
    expect(costDeltaUsd(0.04, 0.01, "t")).toBeUndefined();
    expect(costDeltaUsd(undefined, 0.01, "t")).toBeUndefined();
  });
});

describe("per-prompt estimated API cost bracketing", () => {
  const events: StoredEvent[] = [
    {
      type: "quota_snapshot",
      capturedAt: "2026-09-16T04:00:00.000Z",
      ingestSource: "statusline",
      sessionId: "sess-1",
      promptId: "p-0",
      provenance: "claude_reported",
      source: "claude_statusline",
      estimatedApiCostUsd: 0.01,
    },
    {
      type: "prompt_lifecycle",
      capturedAt: "2026-09-16T04:00:01.000Z",
      ingestSource: "hook",
      phase: "start",
      sessionId: "sess-1",
      promptId: "p-1",
      hookEventName: "UserPromptSubmit",
    },
    {
      type: "prompt_lifecycle",
      capturedAt: "2026-09-16T04:00:10.000Z",
      ingestSource: "hook",
      phase: "stop",
      sessionId: "sess-1",
      promptId: "p-1",
      hookEventName: "Stop",
    },
    {
      type: "quota_snapshot",
      capturedAt: "2026-09-16T04:00:11.000Z",
      ingestSource: "statusline",
      sessionId: "sess-1",
      promptId: "p-1",
      provenance: "claude_reported",
      source: "claude_statusline",
      estimatedApiCostUsd: 0.04,
    },
  ];

  it("brackets cost when a same-session baseline exists", () => {
    const delta = estimatedApiCostDeltaForPrompt(events, "p-1");
    expect(delta?.value).toBeCloseTo(0.03);
  });

  it("is unavailable without a baseline", () => {
    expect(estimatedApiCostDeltaForPrompt(events.slice(1), "p-1")).toBeUndefined();
  });

  it("is unavailable across a session change", () => {
    const changed = events.map((event, index) =>
      index === 3 ? { ...event, sessionId: "sess-2" } : event,
    );
    expect(estimatedApiCostDeltaForPrompt(changed, "p-1")).toBeUndefined();
  });

  it("is unavailable when session cost resets downward", () => {
    const reset = events.map((event, index) =>
      index === 3 ? { ...event, estimatedApiCostUsd: 0.001 } : event,
    );
    expect(estimatedApiCostDeltaForPrompt(reset, "p-1")).toBeUndefined();
  });
});
