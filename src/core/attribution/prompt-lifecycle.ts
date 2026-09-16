import type { PromptAttribution, StoredEvent } from "../types.js";
import { estimatedApiCostDeltaForPrompt, quotaDelta, snapshotsForPrompt } from "../quota/delta.js";

const LIMITATION =
  "Quota delta is not token consumption. Estimated API cost delta is derived from cost.total_cost_usd and is not subscription billing. Exact prompt token consumption is unavailable.";

export function attributePrompt(events: StoredEvent[], promptId: string): PromptAttribution {
  const related = events.filter((event) => "promptId" in event && event.promptId === promptId);
  const starts = related.filter(
    (event) => event.type === "prompt_lifecycle" && event.phase === "start",
  );
  const ends = related.filter(
    (event) =>
      event.type === "prompt_lifecycle" &&
      (event.phase === "stop" || event.phase === "stop_failure"),
  );
  const start = starts[0];
  const end = ends[ends.length - 1];
  const snapshots = snapshotsForPrompt(events, promptId);
  const firstSnap = snapshots[0];
  const lastSnap = snapshots[snapshots.length - 1];

  return {
    promptId,
    sessionId: start && "sessionId" in start ? start.sessionId : lastSnap?.sessionId,
    startedAt: start?.capturedAt ?? firstSnap?.capturedAt,
    endedAt: end?.capturedAt,
    open: !end,
    toolCallCount: related.filter(
      (event) => event.type === "tool_activity" && event.phase === "pre",
    ).length,
    subagentStartCount: related.filter(
      (event) => event.type === "subagent_activity" && event.phase === "start",
    ).length,
    taskCreatedCount: related.filter(
      (event) => event.type === "task_lifecycle" && event.phase === "created",
    ).length,
    quotaDeltaFiveHour:
      firstSnap && lastSnap && distinctSameSessionPair(firstSnap, lastSnap)
        ? quotaDelta(firstSnap.fiveHour?.value, lastSnap.fiveHour?.value, lastSnap.capturedAt)
        : undefined,
    quotaDeltaSevenDay:
      firstSnap && lastSnap && distinctSameSessionPair(firstSnap, lastSnap)
        ? quotaDelta(firstSnap.sevenDay?.value, lastSnap.sevenDay?.value, lastSnap.capturedAt)
        : undefined,
    estimatedApiCostDelta: estimatedApiCostDeltaForPrompt(events, promptId),
    latestContextWindow: lastSnap?.contextWindow,
    exactPromptTokenConsumption: "unavailable",
    limitation: LIMITATION,
  };
}

function distinctSameSessionPair(
  first: { capturedAt: string; sessionId?: string },
  last: { capturedAt: string; sessionId?: string },
): boolean {
  if (first.capturedAt === last.capturedAt) {
    return false;
  }
  if (first.sessionId && last.sessionId && first.sessionId !== last.sessionId) {
    return false;
  }
  return true;
}

export function promptsInSession(events: StoredEvent[], sessionId: string): string[] {
  const ids = new Set<string>();
  for (const event of events) {
    if (
      "sessionId" in event &&
      event.sessionId === sessionId &&
      "promptId" in event &&
      event.promptId
    ) {
      ids.add(event.promptId);
    }
  }
  return [...ids];
}
