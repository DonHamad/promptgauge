import type { SessionSummary, StoredEvent } from "../types.js";
import { attributePrompt, promptsInSession } from "../attribution/prompt-lifecycle.js";
import { toSnapshot } from "../quota/delta.js";

export function summarizeSession(events: StoredEvent[]): SessionSummary {
  const latestQuotaEvent = [...events].reverse().find((event) => event.type === "quota_snapshot");
  const latestAny = events[events.length - 1];
  const sessionId =
    (latestQuotaEvent && "sessionId" in latestQuotaEvent
      ? latestQuotaEvent.sessionId
      : undefined) ?? (latestAny && "sessionId" in latestAny ? latestAny.sessionId : undefined);

  const promptIds = sessionId ? promptsInSession(events, sessionId) : uniquePromptIds(events);
  const latestPromptId = latestPrompt(events, promptIds);

  return {
    sessionId,
    promptsObserved: promptIds.length,
    latestPrompt: latestPromptId ? attributePrompt(events, latestPromptId) : undefined,
    latestQuota: latestQuotaEvent ? toSnapshot(latestQuotaEvent) : undefined,
  };
}

function uniquePromptIds(events: StoredEvent[]): string[] {
  const ids = new Set<string>();
  for (const event of events) {
    if ("promptId" in event && event.promptId) {
      ids.add(event.promptId);
    }
  }
  return [...ids];
}

function latestPrompt(events: StoredEvent[], promptIds: string[]): string | undefined {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event && "promptId" in event && event.promptId && promptIds.includes(event.promptId)) {
      return event.promptId;
    }
  }
  return promptIds[promptIds.length - 1];
}
