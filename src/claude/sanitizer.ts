const FORBIDDEN_KEYS = new Set([
  "prompt",
  "tool_input",
  "tool_response",
  "last_assistant_message",
  "task_subject",
  "task_description",
  "transcript_path",
  "cwd",
  "command",
  "content",
  "current_dir",
  "project_dir",
]);

export function assertNoForbiddenFields(event: Record<string, unknown>): void {
  for (const key of FORBIDDEN_KEYS) {
    if (key in event) {
      throw new Error(`refusing to persist forbidden field: ${key}`);
    }
  }
}

export function containsPromptText(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  return Object.keys(value as Record<string, unknown>).some((key) => FORBIDDEN_KEYS.has(key));
}
