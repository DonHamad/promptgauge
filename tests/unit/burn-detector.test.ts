import { describe, expect, it } from "vitest";
import { evaluateBurn } from "../../src/core/burn-detection/engine.js";
import type { StoredEvent } from "../../src/core/types.js";

const now = new Date("2026-09-16T04:10:00.000Z");

function quota(at: string, used: number): StoredEvent {
  return {
    type: "quota_snapshot",
    capturedAt: at,
    ingestSource: "statusline",
    provenance: "claude_reported",
    source: "claude_statusline",
    fiveHour: { usedPercentage: used, resetsAtEpochSeconds: 1893456000 },
  };
}

function tool(at: string, name = "Bash"): StoredEvent {
  return {
    type: "tool_activity",
    capturedAt: at,
    ingestSource: "hook",
    phase: "pre",
    toolName: name,
  };
}

function subagent(at: string): StoredEvent {
  return {
    type: "subagent_activity",
    capturedAt: at,
    ingestSource: "hook",
    phase: "start",
    agentType: "Explore",
  };
}

describe("burn detector", () => {
  it("is UNKNOWN with no recent events", () => {
    const result = evaluateBurn({ events: [], now });
    expect(result.level).toBe("UNKNOWN");
  });

  it("is NORMAL without strong signals", () => {
    const result = evaluateBurn({
      events: [quota("2026-09-16T04:09:00.000Z", 12), tool("2026-09-16T04:09:30.000Z")],
      now,
    });
    expect(result.level).toBe("NORMAL");
  });

  it("does not call RUNAWAY from a single quota spike", () => {
    const result = evaluateBurn({
      events: [quota("2026-09-16T04:01:00.000Z", 10), quota("2026-09-16T04:09:00.000Z", 50)],
      now,
    });
    expect(result.level).toBe("HIGH");
    expect(result.level).not.toBe("RUNAWAY");
  });

  it("returns RUNAWAY only with multiple strong signals", () => {
    const tools: StoredEvent[] = Array.from({ length: 60 }, (_, i) =>
      tool(
        `2026-09-16T04:0${Math.min(9, Math.floor(i / 10))}:${(i % 10).toString().padStart(2, "0")}.000Z`,
      ),
    );
    const result = evaluateBurn({
      events: [
        quota("2026-09-16T04:01:00.000Z", 10),
        quota("2026-09-16T04:09:00.000Z", 50),
        ...tools,
      ],
      now,
    });
    expect(result.level).toBe("RUNAWAY");
  });

  it("flags elevated repeated identical tool names", () => {
    const tools: StoredEvent[] = Array.from({ length: 15 }, (_, i) =>
      tool(`2026-09-16T04:09:${i.toString().padStart(2, "0")}.000Z`, "Grep"),
    );
    const result = evaluateBurn({ events: tools, now });
    expect(result.level).toBe("ELEVATED");
    expect(result.signals.some((signal) => signal.name === "repeated_tool")).toBe(true);
  });

  it("flags elevated subagent creation", () => {
    const starts: StoredEvent[] = Array.from({ length: 5 }, (_, i) =>
      subagent(`2026-09-16T04:09:${i.toString().padStart(2, "0")}.000Z`),
    );
    const result = evaluateBurn({ events: starts, now });
    expect(result.level).toBe("ELEVATED");
  });
});
