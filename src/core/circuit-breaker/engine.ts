import type { CircuitBreakerState, QuotaSnapshot } from "../types.js";
import type { Thresholds } from "../config/model.js";
import { epochSecondsToDate, isStale } from "../../utils/time.js";

export interface CircuitBreakerInput {
  snapshot?: QuotaSnapshot;
  now: Date;
  freshnessMs: number;
  thresholds: Thresholds;
  mode: "observe" | "enforce";
}

export interface CircuitBreakerResult {
  state: CircuitBreakerState;
  reason: string;
  recommendedAction: string;
  mode: "observe";
  governingWindow?: "five_hour" | "seven_day";
}

const STATE_RANK: Record<CircuitBreakerState, number> = {
  UNKNOWN: 0,
  NORMAL: 1,
  WARNING: 2,
  CRITICAL: 3,
  EMERGENCY: 4,
};

export function evaluateCircuitBreaker(input: CircuitBreakerInput): CircuitBreakerResult {
  const observeActionPrefix =
    input.mode === "enforce" ? "Enforcement is not enabled in this pre-release. " : "";

  if (!input.snapshot) {
    return unknown("no quota snapshot is available", observeActionPrefix);
  }

  if (isStale(input.snapshot.capturedAt, input.now, input.freshnessMs)) {
    return unknown("quota telemetry is stale", observeActionPrefix);
  }

  const five = windowState(input.snapshot.fiveHour?.value, input.now, input.thresholds, "5-hour");
  const seven = windowState(input.snapshot.sevenDay?.value, input.now, input.thresholds, "7-day");

  if (five.kind === "missing" && seven.kind === "missing") {
    return unknown("live subscription quota unavailable", observeActionPrefix);
  }

  const candidates = [five, seven].filter((item) => item.kind === "ok");
  if (candidates.length === 0) {
    const reset = [five, seven].find((item) => item.kind === "reset");
    return unknown(reset?.reason ?? "quota windows are past reset", observeActionPrefix);
  }

  let best = candidates[0]!;
  for (const candidate of candidates.slice(1)) {
    if (STATE_RANK[candidate.state] > STATE_RANK[best.state]) {
      best = candidate;
    }
  }

  return {
    state: best.state,
    reason: best.reason,
    recommendedAction: recommendedAction(best.state, observeActionPrefix),
    mode: "observe",
    governingWindow: best.window,
  };
}

function unknown(reason: string, prefix: string): CircuitBreakerResult {
  return {
    state: "UNKNOWN",
    reason,
    recommendedAction: `${prefix}Do not treat missing quota data as safe. Check Claude Code status-line integration.`,
    mode: "observe",
  };
}

function recommendedAction(state: CircuitBreakerState, prefix: string): string {
  switch (state) {
    case "NORMAL":
      return `${prefix}No action required. Continue observing.`;
    case "WARNING":
      return `${prefix}Review current Claude Code activity. This pre-release does not block sessions.`;
    case "CRITICAL":
      return `${prefix}Slow down autonomous work. This pre-release does not block sessions.`;
    case "EMERGENCY":
      return `${prefix}Consider stopping the session manually. This pre-release does not block sessions.`;
    case "UNKNOWN":
      return `${prefix}Do not treat unknown quota as safe.`;
  }
}

type WindowEval =
  | { kind: "missing" }
  | { kind: "reset"; reason: string }
  | {
      kind: "ok";
      state: CircuitBreakerState;
      reason: string;
      window: "five_hour" | "seven_day";
    };

function windowState(
  window: { usedPercentage: number; resetsAtEpochSeconds: number } | undefined,
  now: Date,
  thresholds: Thresholds,
  label: "5-hour" | "7-day",
): WindowEval {
  if (!window) {
    return { kind: "missing" };
  }
  if (epochSecondsToDate(window.resetsAtEpochSeconds).getTime() <= now.getTime()) {
    return {
      kind: "reset",
      reason: `${label} snapshot is past its reset time`,
    };
  }
  const used = window.usedPercentage;
  const key = label === "5-hour" ? "five_hour" : "seven_day";
  if (used >= thresholds.emergency) {
    return {
      kind: "ok",
      state: "EMERGENCY",
      reason: `${label} quota reported ${formatPct(used)}% used`,
      window: key,
    };
  }
  if (used >= thresholds.critical) {
    return {
      kind: "ok",
      state: "CRITICAL",
      reason: `${label} quota reported ${formatPct(used)}% used`,
      window: key,
    };
  }
  if (used >= thresholds.warning) {
    return {
      kind: "ok",
      state: "WARNING",
      reason: `${label} quota reported ${formatPct(used)}% used`,
      window: key,
    };
  }
  return {
    kind: "ok",
    state: "NORMAL",
    reason: `${label} quota reported ${formatPct(used)}% used`,
    window: key,
  };
}

function formatPct(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
