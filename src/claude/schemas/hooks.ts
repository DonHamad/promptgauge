/**
 * Official Claude Code hook fields we depend on.
 * Source: https://code.claude.com/docs/en/hooks (retrieved 2026-09-16)
 *
 * Intentionally omitted from storage: prompt, tool_input, tool_response,
 * last_assistant_message, task_subject, task_description, transcript contents.
 */
export type HookEventName =
  | "UserPromptSubmit"
  | "Stop"
  | "StopFailure"
  | "PreToolUse"
  | "PostToolUse"
  | "PostToolUseFailure"
  | "SubagentStart"
  | "SubagentStop"
  | "TaskCreated"
  | "TaskCompleted"
  | "SessionStart"
  | "SessionEnd"
  | string;

export interface HookPayload {
  hook_event_name?: HookEventName;
  session_id?: string;
  prompt_id?: string;
  transcript_path?: string;
  cwd?: string;
  tool_name?: string;
  tool_use_id?: string;
  duration_ms?: number;
  agent_id?: string;
  agent_type?: string;
  task_id?: string;
  prompt?: unknown;
  tool_input?: unknown;
  tool_response?: unknown;
  last_assistant_message?: unknown;
  task_subject?: unknown;
  task_description?: unknown;
}
