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
  };
}

export function estimatedApiCostDeltaForPrompt(
  events: StoredEvent[],
  promptId: string,
): ProvenancedMetric<number> | undefined {
  const start = events.find(
    (event): event is Extract<StoredEvent, { type: "prompt_lifecycle" }> =>
      event.type === "prompt_lifecycle" && event.phase === "start" && event.promptId === promptId,
  );
  const ends = events.filter(
    (event): event is Extract<StoredEvent, { type: "prompt_lifecycle" }> =>
      event.type === "prompt_lifecycle" &&
      (event.phase === "stop" || event.phase === "stop_failure") &&
      event.promptId === promptId,
  );
  const end = ends[ends.length - 1];
  if (!start || !end || !start.sessionId || start.sessionId !== end.sessionId) {
    return undefined;
  }

  const snapshots = events.filter(
    (event): event is Extract<StoredEvent, { type: "quota_snapshot" }> =>
      event.type === "quota_snapshot" && event.sessionId === start.sessionId,
  );
  const baseline = [...snapshots]
    .reverse()
    .find((event) => event.capturedAt <= start.capturedAt && event.promptId !== promptId);
  const after = [...snapshots]
    .reverse()
    .find((event) => event.capturedAt >= end.capturedAt && event.promptId === promptId);

  if (!baseline || !after) {
    return undefined;
  }
  if (baseline.sessionId !== after.sessionId) {
    return undefined;
  }
  return costDeltaUsd(baseline.estimatedApiCostUsd, after.estimatedApiCostUsd, after.capturedAt);
}
