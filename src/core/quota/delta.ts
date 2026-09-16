import type { ProvenancedMetric, QuotaSnapshot, QuotaWindow, StoredEvent } from "../types.js";

export function quotaDelta(
  start: QuotaWindow | undefined,
  end: QuotaWindow | undefined,
  capturedAt: string,
): ProvenancedMetric<number> | undefined {
  if (!start || !end) {
    return undefined;
  }
  if (start.resetsAtEpochSeconds !== end.resetsAtEpochSeconds) {
    return undefined;
  }
  const capturedMs = Date.parse(capturedAt);
  if (Number.isFinite(capturedMs) && capturedMs >= end.resetsAtEpochSeconds * 1000) {
    return undefined;
  }
  if (end.usedPercentage < start.usedPercentage) {
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

export function costDeltaUsd(
  startUsd: number | undefined,
  endUsd: number | undefined,
  capturedAt: string,
): ProvenancedMetric<number> | undefined {
  if (startUsd === undefined || endUsd === undefined) {
    return undefined;
  }
  if (endUsd < startUsd) {
    return undefined;
  }
  return {
    value: endUsd - startUsd,
    source: "cost.total_cost_usd",
    capturedAt,
    provenance: "derived_from_claude_reported_session_cost",
    confidence: "medium",
  };
}

export function snapshotsForPrompt(events: StoredEvent[], promptId: string): QuotaSnapshot[] {
  return events
    .filter((event): event is Extract<StoredEvent, { type: "quota_snapshot" }> => {
      return event.type === "quota_snapshot" && event.promptId === promptId;
    })
    .map(toSnapshot);
}

export function toSnapshot(event: Extract<StoredEvent, { type: "quota_snapshot" }>): QuotaSnapshot {
  return {
    capturedAt: event.capturedAt,
    source: "claude_statusline",
    provenance: "claude_reported",
    sessionId: event.sessionId,
    promptId: event.promptId,
    claudeVersion: event.claudeVersion,
    model: event.model,
    projectKey: event.projectKey,
    projectBasename: event.projectBasename,
    estimatedApiCostUsd:
      event.estimatedApiCostUsd === undefined
        ? undefined
        : {
            value: event.estimatedApiCostUsd,
            source: "cost.total_cost_usd",
            capturedAt: event.capturedAt,
            provenance: "claude_reported_estimate",
            confidence: "high",
          },
    contextWindow: event.contextWindow,
    fiveHour: event.fiveHour
      ? {
          value: event.fiveHour,
          source: "claude_statusline",
          capturedAt: event.capturedAt,
          provenance: "claude_reported",
          confidence: "high",
        }
      : undefined,
    sevenDay: event.sevenDay
      ? {
          value: event.sevenDay,
          source: "claude_statusline",
          capturedAt: event.capturedAt,
          provenance: "claude_reported",
          confidence: "high",
        }
      : undefined,
    spendLimit: event.spendLimit
      ? {
          value: event.spendLimit,
          source: "claude_statusline",
          capturedAt: event.capturedAt,
          provenance: "claude_reported",
          confidence: "high",
        }
      : undefined,
    promptCache: event.promptCache,
  };
}
