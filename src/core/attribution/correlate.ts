import type {
  BracketedQuota,
  PromptUsageRecord,
  QuotaSnapshotEvent,
  QuotaWindow,
  StoredEvent,
} from "../types.js";
import { costDeltaUsd, quotaDelta } from "../quota/delta.js";
import { parseIso } from "../../utils/time.js";

/** Status-line ticks are not synchronized with hooks. Bound pairing by time. */
export const SNAPSHOT_CORRELATION_WINDOW_MS = 15 * 60 * 1000;
export const START_SNAPSHOT_GRACE_MS = 5_000;
export const END_SNAPSHOT_GRACE_MS = 30_000;

const CORRELATION_RULES =
  "nearest eligible snapshot; same session; same prompt_id when the snapshot has one; within 15m; start grace 5s; end grace 30s; same reset window for quota delta; snapshots are not treated as simultaneous with hooks";

export function buildPromptUsageRecord(events: StoredEvent[], promptId: string): PromptUsageRecord {
  const starts = events.filter(
    (event): event is Extract<StoredEvent, { type: "prompt_lifecycle" }> =>
      event.type === "prompt_lifecycle" && event.phase === "start" && event.promptId === promptId,
  );
  const ends = events.filter(
    (event): event is Extract<StoredEvent, { type: "prompt_lifecycle" }> =>
      event.type === "prompt_lifecycle" &&
      (event.phase === "stop" || event.phase === "stop_failure") &&
      event.promptId === promptId,
  );
  const start = starts[0];
  const end = ends[ends.length - 1];
  const sessionId = start?.sessionId ?? end?.sessionId;
  const startedAt = start?.capturedAt;
  const endedAt = end?.capturedAt;
  const durationMs =
    startedAt && endedAt ? Math.max(0, Date.parse(endedAt) - Date.parse(startedAt)) : undefined;

  const pair =
    start && end && start.sessionId && start.sessionId === end.sessionId
      ? correlateSnapshots(events, promptId, start.sessionId, startedAt, endedAt)
      : { before: undefined, after: undefined };

  return {
    sessionId,
    promptId,
    startedAt,
    endedAt,
    durationMs: Number.isFinite(durationMs) ? durationMs : undefined,
    open: !end,
    fiveHour: bracketQuota(pair.before?.fiveHour, pair.after?.fiveHour, pair.after?.capturedAt),
    sevenDay: bracketQuota(pair.before?.sevenDay, pair.after?.sevenDay, pair.after?.capturedAt),
    spendLimit: bracketQuota(
      pair.before?.spendLimit,
      pair.after?.spendLimit,
      pair.after?.capturedAt,
    ),
    estimatedSessionCostBefore: pair.before?.estimatedApiCostUsd,
    estimatedSessionCostAfter: pair.after?.estimatedApiCostUsd,
    estimatedSessionCostDelta: costDeltaUsd(
      pair.before?.estimatedApiCostUsd,
      pair.after?.estimatedApiCostUsd,
      pair.after?.capturedAt ?? endedAt ?? startedAt ?? "",
    ),
    exactPromptTokenConsumption: "unavailable",
    correlation: CORRELATION_RULES,
  };
}

export function correlateSnapshots(
  events: StoredEvent[],
  promptId: string,
  sessionId: string,
  startedAt: string | undefined,
  endedAt: string | undefined,
): { before?: QuotaSnapshotEvent; after?: QuotaSnapshotEvent } {
  if (!startedAt) {
    return {};
  }
  const snapshots = events.filter(
    (event): event is QuotaSnapshotEvent =>
      event.type === "quota_snapshot" && event.sessionId === sessionId,
  );
  const startMs = Date.parse(startedAt);
  const endMs = endedAt ? Date.parse(endedAt) : Number.NaN;
  if (!Number.isFinite(startMs)) {
    return {};
  }

  const before = nearest(
    snapshots.filter((event) => isEligibleBefore(event, promptId, startMs)),
    startMs,
  );
  if (!Number.isFinite(endMs)) {
    return { before };
  }
  const after = nearest(
    snapshots.filter((event) => isEligibleAfter(event, promptId, startMs, endMs)),
    endMs,
  );
  return { before, after };
}

function isEligibleBefore(event: QuotaSnapshotEvent, promptId: string, startMs: number): boolean {
  const captured = Date.parse(event.capturedAt);
  if (!Number.isFinite(captured)) {
    return false;
  }
  if (captured > startMs + START_SNAPSHOT_GRACE_MS) {
    return false;
  }
  if (Math.abs(startMs - captured) > SNAPSHOT_CORRELATION_WINDOW_MS) {
    return false;
  }
  if (event.promptId && event.promptId === promptId && captured > startMs) {
    return false;
  }
  if (event.promptId === promptId && captured <= startMs) {
    return false;
  }
  return true;
}

function isEligibleAfter(
  event: QuotaSnapshotEvent,
  promptId: string,
  startMs: number,
  endMs: number,
): boolean {
  const captured = Date.parse(event.capturedAt);
  if (!Number.isFinite(captured)) {
    return false;
  }
  if (captured < startMs) {
    return false;
  }
  if (captured > endMs + END_SNAPSHOT_GRACE_MS) {
    return false;
  }
  if (Math.abs(endMs - captured) > SNAPSHOT_CORRELATION_WINDOW_MS) {
    return false;
  }
  if (event.promptId && event.promptId !== promptId) {
    return false;
  }
  return true;
}

function nearest(
  snapshots: QuotaSnapshotEvent[],
  targetMs: number,
): QuotaSnapshotEvent | undefined {
  let best: QuotaSnapshotEvent | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const snapshot of snapshots) {
    const captured = Date.parse(snapshot.capturedAt);
    const distance = Math.abs(captured - targetMs);
    if (distance < bestDistance) {
      best = snapshot;
      bestDistance = distance;
    }
  }
  return best;
}

function bracketQuota(
  before: QuotaWindow | undefined,
  after: QuotaWindow | undefined,
  capturedAt: string | undefined,
): BracketedQuota | undefined {
  if (!before && !after) {
    return undefined;
  }
  return {
    before,
    after,
    delta: capturedAt ? quotaDelta(before, after, capturedAt) : undefined,
  };
}

export function estimatedApiCostDeltaForPrompt(
  events: StoredEvent[],
  promptId: string,
): PromptUsageRecord["estimatedSessionCostDelta"] {
  return buildPromptUsageRecord(events, promptId).estimatedSessionCostDelta;
}

export function snapshotIsFresh(capturedAt: string, nowIso: string, freshnessMs: number): boolean {
  const captured = parseIso(capturedAt);
  const now = parseIso(nowIso);
  if (!captured || !now) {
    return false;
  }
  return now.getTime() - captured.getTime() <= freshnessMs;
}
