import type { BurnLevel, StoredEvent } from "../types.js";
import { parseIso } from "../../utils/time.js";

export interface BurnSignal {
  name: string;
  level: Exclude<BurnLevel, "UNKNOWN" | "RUNAWAY"> | "HIGH";
  reason: string;
}

export interface BurnDetectorResult {
  level: BurnLevel;
  reason: string;
  signals: BurnSignal[];
}

export interface BurnDetectorInput {
  events: StoredEvent[];
  now: Date;
  windowMs?: number;
}

const DEFAULT_WINDOW_MS = 10 * 60 * 1000;

export function evaluateBurn(input: BurnDetectorInput): BurnDetectorResult {
  const windowMs = input.windowMs ?? DEFAULT_WINDOW_MS;
  const recent = input.events.filter((event) => inWindow(event.capturedAt, input.now, windowMs));

  if (recent.length === 0) {
    return {
      level: "UNKNOWN",
      reason: "not enough recent activity to assess burn",
      signals: [],
    };
  }

  const signals: BurnSignal[] = [];
  const quotaSignal = quotaAcceleration(recent, windowMs);
  if (quotaSignal) {
    signals.push(quotaSignal);
  }
  const toolSignal = toolCallRate(recent, windowMs);
  if (toolSignal) {
    signals.push(toolSignal);
  }
  const subagentSignal = subagentRate(recent);
  if (subagentSignal) {
    signals.push(subagentSignal);
  }
  const repeatSignal = repeatedTools(recent);
  if (repeatSignal) {
    signals.push(repeatSignal);
  }

  if (signals.length === 0) {
    return {
      level: "NORMAL",
      reason: "no elevated burn signals in the recent window",
      signals,
    };
  }

  const highCount = signals.filter((signal) => signal.level === "HIGH").length;
  const elevatedCount = signals.filter((signal) => signal.level === "ELEVATED").length;
  const hasQuotaHigh = signals.some(
    (signal) => signal.name === "quota_delta" && signal.level === "HIGH",
  );
  const hasActivityHigh = signals.some(
    (signal) => signal.name !== "quota_delta" && signal.level === "HIGH",
  );

  if (highCount >= 2 || (hasQuotaHigh && hasActivityHigh)) {
    return {
      level: "RUNAWAY",
      reason: `multiple strong signals: ${signals.map((s) => s.name).join(", ")}`,
      signals,
    };
  }
  if (highCount === 1) {
    return {
      level: "HIGH",
      reason: signals.find((signal) => signal.level === "HIGH")?.reason ?? "high burn signal",
      signals,
    };
  }
  if (elevatedCount >= 1) {
    return {
      level: "ELEVATED",
      reason: signals[0]?.reason ?? "elevated burn signal",
      signals,
    };
  }
  return {
    level: "NORMAL",
    reason: "no elevated burn signals in the recent window",
    signals,
  };
}

function inWindow(capturedAt: string, now: Date, windowMs: number): boolean {
  const date = parseIso(capturedAt);
  if (!date) {
    return false;
  }
  const delta = now.getTime() - date.getTime();
  return delta >= 0 && delta <= windowMs;
}

function quotaAcceleration(events: StoredEvent[], windowMs: number): BurnSignal | undefined {
  const snapshots = events
    .filter((event) => event.type === "quota_snapshot")
    .map((event) => {
      if (event.type !== "quota_snapshot") {
        return undefined;
      }
      return {
        at: parseIso(event.capturedAt)?.getTime() ?? 0,
        used: event.fiveHour?.usedPercentage,
      };
    })
    .filter(
      (row): row is { at: number; used: number } => row !== undefined && row.used !== undefined,
    )
    .sort((a, b) => a.at - b.at);

  if (snapshots.length < 2) {
    return undefined;
  }
  const first = snapshots[0]!;
  const last = snapshots[snapshots.length - 1]!;
  const delta = last.used - first.used;
  if (delta < 10) {
    return undefined;
  }
  const spanMinutes = Math.max(1, (last.at - first.at) / 60000);
  const perTenMin = (delta / spanMinutes) * (windowMs / 60000);
  if (delta >= 30 || perTenMin >= 30) {
    return {
      name: "quota_delta",
      level: "HIGH",
      reason: `5-hour quota rose ${delta.toFixed(1)} points in ${spanMinutes.toFixed(1)}m`,
    };
  }
  if (delta >= 15 || perTenMin >= 15) {
    return {
      name: "quota_delta",
      level: "ELEVATED",
      reason: `5-hour quota rose ${delta.toFixed(1)} points in ${spanMinutes.toFixed(1)}m`,
    };
  }
  return undefined;
}

function toolCallRate(events: StoredEvent[], _windowMs: number): BurnSignal | undefined {
  const tools = events.filter((event) => event.type === "tool_activity" && event.phase === "pre");
  if (tools.length >= 60) {
    return {
      name: "tool_rate",
      level: "HIGH",
      reason: `${tools.length} tool calls observed in the recent window`,
    };
  }
  if (tools.length >= 30) {
    return {
      name: "tool_rate",
      level: "ELEVATED",
      reason: `${tools.length} tool calls observed in the recent window`,
    };
  }
  return undefined;
}

function subagentRate(events: StoredEvent[]): BurnSignal | undefined {
  const starts = events.filter(
    (event) => event.type === "subagent_activity" && event.phase === "start",
  );
  if (starts.length >= 10) {
    return {
      name: "subagent_rate",
      level: "HIGH",
      reason: `${starts.length} subagents started in the recent window`,
    };
  }
  if (starts.length >= 5) {
    return {
      name: "subagent_rate",
      level: "ELEVATED",
      reason: `${starts.length} subagents started in the recent window`,
    };
  }
  return undefined;
}

function repeatedTools(events: StoredEvent[]): BurnSignal | undefined {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (event.type !== "tool_activity" || event.phase !== "pre" || !event.toolName) {
      continue;
    }
    counts.set(event.toolName, (counts.get(event.toolName) ?? 0) + 1);
  }
  let topName = "";
  let topCount = 0;
  for (const [name, count] of counts) {
    if (count > topCount) {
      topName = name;
      topCount = count;
    }
  }
  if (topCount >= 25) {
    return {
      name: "repeated_tool",
      level: "HIGH",
      reason: `${topName} invoked ${topCount} times in the recent window`,
    };
  }
  if (topCount >= 15) {
    return {
      name: "repeated_tool",
      level: "ELEVATED",
      reason: `${topName} invoked ${topCount} times in the recent window`,
    };
  }
  return undefined;
}
