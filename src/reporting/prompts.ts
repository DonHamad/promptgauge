import type { PromptUsageRecord, StoredEvent } from "../core/types.js";
import { buildPromptUsageRecord } from "../core/attribution/correlate.js";
import { formatPct } from "./format.js";

export function completedPromptIds(events: StoredEvent[]): string[] {
  const started = new Set<string>();
  const completed: string[] = [];
  const seen = new Set<string>();
  for (const event of events) {
    if (event.type !== "prompt_lifecycle" || !event.promptId) {
      continue;
    }
    if (event.phase === "start") {
      started.add(event.promptId);
    }
    if (
      (event.phase === "stop" || event.phase === "stop_failure") &&
      started.has(event.promptId) &&
      !seen.has(event.promptId)
    ) {
      seen.add(event.promptId);
      completed.push(event.promptId);
    }
  }
  return completed;
}

export function formatPrompts(events: StoredEvent[], limit: number): string {
  const cap = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10;
  const ids = completedPromptIds(events).slice(-cap);
  if (ids.length === 0) {
    return "No completed prompt records yet.\n";
  }
  const records = ids.map((id) => buildPromptUsageRecord(events, id));
  const lines = [
    "PromptGauge — Recent Prompts",
    "",
    pad("Prompt", 12) + pad("Duration", 12) + pad("5H Δ", 10) + pad("7D Δ", 10) + "Cost Δ",
    "--------------------------------------------------",
    ...records.map(formatRow),
    "",
    "* estimated API-equivalent session cost delta",
    "N/A means UNAVAILABLE (not zero). Snapshots are correlated, not simultaneous with hooks.",
    "Exact prompt token consumption is UNAVAILABLE.",
  ];
  return `${lines.join("\n")}\n`;
}

function formatRow(record: PromptUsageRecord): string {
  const id = shorten(record.promptId);
  const duration = record.durationMs === undefined ? "N/A" : formatShortDuration(record.durationMs);
  return (
    pad(id, 12) +
    pad(duration, 12) +
    pad(formatDeltaPct(record.fiveHour?.delta?.value), 10) +
    pad(formatDeltaPct(record.sevenDay?.delta?.value), 10) +
    formatCost(record)
  );
}

function formatDeltaPct(value: number | undefined): string {
  if (value === undefined) {
    return "N/A";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatPct(value)}%`;
}

function formatShortDuration(ms: number): string {
  if (ms < 60_000) {
    return `${Math.max(0, Math.round(ms / 1000))}s`;
  }
  if (ms < 3_600_000) {
    return `${Math.round(ms / 60_000)}m`;
  }
  return `${Math.round(ms / 3_600_000)}h`;
}

function formatCost(record: PromptUsageRecord): string {
  if (!record.estimatedSessionCostDelta) {
    return "N/A";
  }
  return `$${record.estimatedSessionCostDelta.value.toFixed(3)}*`;
}

function shorten(promptId: string): string {
  if (promptId.length <= 8) {
    return promptId;
  }
  return `...${promptId.slice(-4)}`;
}

function pad(value: string, width: number): string {
  return value.length >= width ? `${value} ` : value.padEnd(width);
}
