import type { PromptAttribution, StoredEvent } from "../types.js";
import { snapshotsForPrompt } from "../quota/delta.js";
import { buildPromptUsageRecord, estimatedApiCostDeltaForPrompt } from "./correlate.js";

const LIMITATION =
  "Quota delta is not token consumption. Estimated API cost delta is derived from cost.total_cost_usd and is not subscription billing. Exact prompt token consumption is unavailable. Snapshots are correlated, not assumed simultaneous with hooks.";

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
  const lastSnap = snapshots[snapshots.length - 1];
  const usage = buildPromptUsageRecord(events, promptId);

  return {
    promptId,
    sessionId: start && "sessionId" in start ? start.sessionId : lastSnap?.sessionId,
    startedAt: start?.capturedAt ?? usage.startedAt,
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
    quotaDeltaFiveHour: usage.fiveHour?.delta,
    quotaDeltaSevenDay: usage.sevenDay?.delta,
    estimatedApiCostDelta: estimatedApiCostDeltaForPrompt(events, promptId),
    latestContextWindow: lastSnap?.contextWindow,
    exactPromptTokenConsumption: "unavailable",
    limitation: LIMITATION,
    usage,
  };
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
