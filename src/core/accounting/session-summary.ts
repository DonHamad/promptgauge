import type { QuotaSnapshot, SessionSummary, StoredEvent } from "../types.js";
import { attributePrompt, promptsInSession } from "../attribution/prompt-lifecycle.js";

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

function toSnapshot(event: StoredEvent): QuotaSnapshot | undefined {
  if (event.type !== "quota_snapshot") {
    return undefined;
  }
  return {
    capturedAt: event.capturedAt,
    source: "claude_statusline",
    provenance: "claude_reported",
    sessionId: event.sessionId,
    promptId: event.promptId,
    claudeVersion: event.claudeVersion,
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
