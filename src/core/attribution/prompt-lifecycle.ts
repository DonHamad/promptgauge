import type { PromptAttribution, StoredEvent } from "../types.js";
import { quotaDelta, snapshotsForPrompt } from "../quota/delta.js";

const LIMITATION =
  "Quota delta is not token consumption. Prompt end is observed from the documented Stop hook when present; exact API-generation boundaries are not claimed.";

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
    quotaDeltaFiveHour: quotaDelta(
      firstSnap?.fiveHour?.value,
      lastSnap?.fiveHour?.value,
      lastSnap?.capturedAt ?? start?.capturedAt ?? new Date(0).toISOString(),
    ),
    quotaDeltaSevenDay: quotaDelta(
      firstSnap?.sevenDay?.value,
      lastSnap?.sevenDay?.value,
      lastSnap?.capturedAt ?? start?.capturedAt ?? new Date(0).toISOString(),
    ),
    limitation: LIMITATION,
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
