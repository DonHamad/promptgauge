import type { ProvenancedMetric, QuotaSnapshot, QuotaWindow, StoredEvent } from "../types.js";

export function quotaDelta(
  start: QuotaWindow | undefined,
  end: QuotaWindow | undefined,
  capturedAt: string,
): ProvenancedMetric<number> | undefined {
  if (!start || !end) {
    return undefined;
  }
  return {
    value: end.usedPercentage - start.usedPercentage,
    source: "quota_snapshot_pair",
    capturedAt,
    provenance: "derived",
    confidence: "medium",
  };
}

export function snapshotsForPrompt(events: StoredEvent[], promptId: string): QuotaSnapshot[] {
  return events
    .filter((event): event is Extract<StoredEvent, { type: "quota_snapshot" }> => {
      return event.type === "quota_snapshot" && event.promptId === promptId;
    })
    .map((event) => ({
      capturedAt: event.capturedAt,
      source: "claude_statusline" as const,
      provenance: "claude_reported" as const,
      sessionId: event.sessionId,
      promptId: event.promptId,
      claudeVersion: event.claudeVersion,
      fiveHour: event.fiveHour
        ? {
            value: event.fiveHour,
            source: "claude_statusline",
            capturedAt: event.capturedAt,
            provenance: "claude_reported" as const,
            confidence: "high" as const,
          }
        : undefined,
      sevenDay: event.sevenDay
        ? {
            value: event.sevenDay,
            source: "claude_statusline",
            capturedAt: event.capturedAt,
            provenance: "claude_reported" as const,
            confidence: "high" as const,
          }
        : undefined,
    }));
}
