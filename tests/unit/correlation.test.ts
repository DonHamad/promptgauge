import { describe, expect, it } from "vitest";
import {
  buildPromptUsageRecord,
  estimatedApiCostDeltaForPrompt,
} from "../../src/core/attribution/correlate.js";
import type { StoredEvent } from "../../src/core/types.js";

function lifecycle(
  phase: "start" | "stop",
  promptId: string,
  at: string,
  sessionId = "sess-1",
): StoredEvent {
  return {
    type: "prompt_lifecycle",
    capturedAt: at,
    ingestSource: "hook",
    phase,
    sessionId,
    promptId,
    hookEventName: phase === "start" ? "UserPromptSubmit" : "Stop",
  };
}

function snap(partial: Partial<Extract<StoredEvent, { type: "quota_snapshot" }>>): StoredEvent {
  return {
    type: "quota_snapshot",
    capturedAt: "2026-09-16T04:00:00.000Z",
    ingestSource: "statusline",
    sessionId: "sess-1",
    provenance: "claude_reported",
    source: "claude_statusline",
    ...partial,
  };
}

describe("snapshot correlation", () => {
  const base: StoredEvent[] = [
    snap({
      capturedAt: "2026-09-16T04:00:00.000Z",
      promptId: "p-0",
      fiveHour: { usedPercentage: 10, resetsAtEpochSeconds: 1893456000 },
      sevenDay: { usedPercentage: 20, resetsAtEpochSeconds: 1893888000 },
      estimatedApiCostUsd: 0.01,
    }),
    lifecycle("start", "p-1", "2026-09-16T04:00:01.000Z"),
    lifecycle("stop", "p-1", "2026-09-16T04:00:10.000Z"),
    snap({
      capturedAt: "2026-09-16T04:00:11.000Z",
      promptId: "p-1",
      fiveHour: { usedPercentage: 12, resetsAtEpochSeconds: 1893456000 },
      sevenDay: { usedPercentage: 21, resetsAtEpochSeconds: 1893888000 },
      estimatedApiCostUsd: 0.04,
    }),
  ];

  it("derives quota and cost increases with a same-session pair", () => {
    const usage = buildPromptUsageRecord(base, "p-1");
    expect(usage.durationMs).toBe(9000);
    expect(usage.fiveHour?.delta?.value).toBe(2);
    expect(usage.sevenDay?.delta?.value).toBe(1);
    expect(usage.estimatedSessionCostDelta?.value).toBeCloseTo(0.03);
    expect(usage.exactPromptTokenConsumption).toBe("unavailable");
  });

  it("treats unchanged cost as a derived zero, not missing data", () => {
    const events = base.map((event, index) =>
      index === 3 ? { ...event, estimatedApiCostUsd: 0.01 } : event,
    );
    expect(estimatedApiCostDeltaForPrompt(events, "p-1")?.value).toBe(0);
  });

  it("is unavailable across a session mismatch", () => {
    const events = base.map((event, index) =>
      index === 3 ? { ...event, sessionId: "sess-2" } : event,
    );
    expect(buildPromptUsageRecord(events, "p-1").estimatedSessionCostDelta).toBeUndefined();
  });

  it("is unavailable across a reset-window mismatch", () => {
    const events = base.map((event, index) =>
      index === 3
        ? {
            ...event,
            fiveHour: { usedPercentage: 12, resetsAtEpochSeconds: 1993456000 },
          }
        : event,
    );
    expect(buildPromptUsageRecord(events, "p-1").fiveHour?.delta).toBeUndefined();
  });

  it("is unavailable when the after snapshot is missing", () => {
    expect(buildPromptUsageRecord(base.slice(0, 3), "p-1").fiveHour?.delta).toBeUndefined();
  });

  it("is unavailable for a stale snapshot outside the correlation window", () => {
    const events: StoredEvent[] = [
      snap({
        capturedAt: "2026-09-16T03:00:00.000Z",
        promptId: "p-0",
        estimatedApiCostUsd: 0.01,
        fiveHour: { usedPercentage: 10, resetsAtEpochSeconds: 1893456000 },
      }),
      lifecycle("start", "p-1", "2026-09-16T04:00:01.000Z"),
      lifecycle("stop", "p-1", "2026-09-16T04:00:10.000Z"),
      snap({
        capturedAt: "2026-09-16T04:00:11.000Z",
        promptId: "p-1",
        estimatedApiCostUsd: 0.04,
        fiveHour: { usedPercentage: 12, resetsAtEpochSeconds: 1893456000 },
      }),
    ];
    expect(buildPromptUsageRecord(events, "p-1").estimatedSessionCostDelta).toBeUndefined();
  });

  it("is unavailable when quota decreases or the window resets downward", () => {
    const events = base.map((event, index) =>
      index === 3
        ? { ...event, fiveHour: { usedPercentage: 4, resetsAtEpochSeconds: 1893456000 } }
        : event,
    );
    expect(buildPromptUsageRecord(events, "p-1").fiveHour?.delta).toBeUndefined();
  });

  it("is unavailable when session cost decreases", () => {
    const events = base.map((event, index) =>
      index === 3 ? { ...event, estimatedApiCostUsd: 0.001 } : event,
    );
    expect(estimatedApiCostDeltaForPrompt(events, "p-1")).toBeUndefined();
  });

  it("does not complete attribution for start without Stop", () => {
    const usage = buildPromptUsageRecord(base.slice(0, 2), "p-1");
    expect(usage.open).toBe(true);
    expect(usage.durationMs).toBeUndefined();
    expect(usage.estimatedSessionCostDelta).toBeUndefined();
  });

  it("does not invent a start for Stop without UserPromptSubmit", () => {
    const events: StoredEvent[] = [
      lifecycle("stop", "orphan", "2026-09-16T04:00:10.000Z"),
      snap({
        capturedAt: "2026-09-16T04:00:11.000Z",
        promptId: "orphan",
        estimatedApiCostUsd: 0.2,
      }),
    ];
    const usage = buildPromptUsageRecord(events, "orphan");
    expect(usage.startedAt).toBeUndefined();
    expect(usage.estimatedSessionCostDelta).toBeUndefined();
  });
});
