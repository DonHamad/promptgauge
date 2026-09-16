import type { StoredEvent } from "../../core/types.js";
import { asFiniteNumber, asString, isRecord } from "../../utils/json.js";
import { normalizePathForCompare } from "../../utils/platform.js";

export type HookParseResult = { ok: true; events: StoredEvent[] } | { ok: false; error: string };

export function looksLikeHook(payload: Record<string, unknown>): boolean {
  const name = asString(payload.hook_event_name);
  return Boolean(name) && name !== "Status";
}

export function parseHook(payload: unknown, capturedAt: string): HookParseResult {
  if (!isRecord(payload)) {
    return { ok: false, error: "hook payload is not an object" };
  }
  const hookEventName = asString(payload.hook_event_name);
  if (!hookEventName) {
    return { ok: false, error: "missing hook_event_name" };
  }

  const sessionId = asString(payload.session_id);
  const promptId = asString(payload.prompt_id);
  const transcriptPath = asString(payload.transcript_path);
  if (transcriptPath) {
    normalizePathForCompare(transcriptPath);
  }

  const base = {
    capturedAt,
    ingestSource: "hook" as const,
    sessionId,
    promptId,
  };

  switch (hookEventName) {
    case "UserPromptSubmit":
      return {
        ok: true,
        events: [{ ...base, type: "prompt_lifecycle", phase: "start", hookEventName }],
      };
    case "Stop":
      return {
        ok: true,
        events: [{ ...base, type: "prompt_lifecycle", phase: "stop", hookEventName }],
      };
    case "StopFailure":
      return {
        ok: true,
        events: [{ ...base, type: "prompt_lifecycle", phase: "stop_failure", hookEventName }],
      };
    case "PreToolUse":
      return {
        ok: true,
        events: [
          {
            ...base,
            type: "tool_activity",
            phase: "pre",
            toolName: asString(payload.tool_name),
            toolUseId: asString(payload.tool_use_id),
          },
        ],
      };
    case "PostToolUse":
      return {
        ok: true,
        events: [
          {
            ...base,
            type: "tool_activity",
            phase: "post",
            toolName: asString(payload.tool_name),
            toolUseId: asString(payload.tool_use_id),
            durationMs: asFiniteNumber(payload.duration_ms),
          },
        ],
      };
    case "PostToolUseFailure":
      return {
        ok: true,
        events: [
          {
            ...base,
            type: "tool_activity",
            phase: "post_failure",
            toolName: asString(payload.tool_name),
            toolUseId: asString(payload.tool_use_id),
          },
        ],
      };
    case "SubagentStart":
      return {
        ok: true,
        events: [
          {
            ...base,
            type: "subagent_activity",
            phase: "start",
            agentId: asString(payload.agent_id),
            agentType: asString(payload.agent_type),
          },
        ],
      };
    case "SubagentStop":
      return {
        ok: true,
        events: [
          {
            ...base,
            type: "subagent_activity",
            phase: "stop",
            agentId: asString(payload.agent_id),
            agentType: asString(payload.agent_type),
          },
        ],
      };
    case "TaskCreated":
      return {
        ok: true,
        events: [
          {
            ...base,
            type: "task_lifecycle",
            phase: "created",
            taskId: asString(payload.task_id),
          },
        ],
      };
    case "TaskCompleted":
      return {
        ok: true,
        events: [
          {
            ...base,
            type: "task_lifecycle",
            phase: "completed",
            taskId: asString(payload.task_id),
          },
        ],
      };
    default:
      return { ok: true, events: [] };
  }
}
