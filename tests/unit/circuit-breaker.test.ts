import { describe, expect, it } from "vitest";
import { evaluateCircuitBreaker } from "../../src/core/circuit-breaker/engine.js";
import { DEFAULT_CONFIG } from "../../src/core/config/model.js";
import type { QuotaSnapshot } from "../../src/core/types.js";

const now = new Date("2026-09-16T04:00:00.000Z");
const future = Math.floor(now.getTime() / 1000) + 3600;
const past = Math.floor(now.getTime() / 1000) - 10;

function snapshot(
  five?: number,
  seven?: number,
  capturedAt = now.toISOString(),
  resets = future,
): QuotaSnapshot {
  return {
    capturedAt,
    source: "claude_statusline",
    provenance: "claude_reported",
    fiveHour:
      five === undefined
        ? undefined
        : {
            value: { usedPercentage: five, resetsAtEpochSeconds: resets },
            source: "claude_statusline",
            capturedAt,
            provenance: "claude_reported",
            confidence: "high",
          },
    sevenDay:
      seven === undefined
        ? undefined
        : {
            value: { usedPercentage: seven, resetsAtEpochSeconds: resets },
            source: "claude_statusline",
            capturedAt,
            provenance: "claude_reported",
            confidence: "high",
          },
  };
}

describe("circuit breaker", () => {
  it("is UNKNOWN when telemetry is missing", () => {
    const result = evaluateCircuitBreaker({
      now,
      freshnessMs: DEFAULT_CONFIG.freshnessMs,
      thresholds: DEFAULT_CONFIG.thresholds,
      mode: "observe",
    });
    expect(result.state).toBe("UNKNOWN");
  });

  it("is UNKNOWN when telemetry is stale", () => {
    const result = evaluateCircuitBreaker({
      snapshot: snapshot(10, 10, "2026-09-16T03:00:00.000Z"),
      now,
      freshnessMs: DEFAULT_CONFIG.freshnessMs,
      thresholds: DEFAULT_CONFIG.thresholds,
      mode: "observe",
    });
    expect(result.state).toBe("UNKNOWN");
    expect(result.reason).toMatch(/stale/);
  });

  it("is NORMAL at 69%", () => {
    const result = evaluateCircuitBreaker({
      snapshot: snapshot(69, 10),
      now,
      freshnessMs: DEFAULT_CONFIG.freshnessMs,
      thresholds: DEFAULT_CONFIG.thresholds,
      mode: "observe",
    });
    expect(result.state).toBe("NORMAL");
  });

  it("is WARNING at 70%", () => {
    const result = evaluateCircuitBreaker({
      snapshot: snapshot(70, 10),
      now,
      freshnessMs: DEFAULT_CONFIG.freshnessMs,
      thresholds: DEFAULT_CONFIG.thresholds,
      mode: "observe",
    });
    expect(result.state).toBe("WARNING");
  });

  it("is CRITICAL at 85%", () => {
    const result = evaluateCircuitBreaker({
      snapshot: snapshot(10, 85),
      now,
      freshnessMs: DEFAULT_CONFIG.freshnessMs,
      thresholds: DEFAULT_CONFIG.thresholds,
      mode: "observe",
    });
    expect(result.state).toBe("CRITICAL");
  });

  it("is EMERGENCY at 95%", () => {
    const result = evaluateCircuitBreaker({
      snapshot: snapshot(95, 10),
      now,
      freshnessMs: DEFAULT_CONFIG.freshnessMs,
      thresholds: DEFAULT_CONFIG.thresholds,
      mode: "observe",
    });
    expect(result.state).toBe("EMERGENCY");
  });

  it("is UNKNOWN past the reset boundary", () => {
    const result = evaluateCircuitBreaker({
      snapshot: snapshot(95, 95, now.toISOString(), past),
      now,
      freshnessMs: DEFAULT_CONFIG.freshnessMs,
      thresholds: DEFAULT_CONFIG.thresholds,
      mode: "observe",
    });
    expect(result.state).toBe("UNKNOWN");
    expect(result.reason).toMatch(/reset/);
  });

  it("never enables enforcement in this phase", () => {
    const result = evaluateCircuitBreaker({
      snapshot: snapshot(99, 99),
      now,
      freshnessMs: DEFAULT_CONFIG.freshnessMs,
      thresholds: DEFAULT_CONFIG.thresholds,
      mode: "enforce",
    });
    expect(result.mode).toBe("observe");
    expect(result.recommendedAction).toMatch(/not enabled/);
  });
});
