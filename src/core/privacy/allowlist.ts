const FORBIDDEN_KEYS = new Set([
  "prompt",
  "tool_input",
  "tool_response",
  "last_assistant_message",
  "task_subject",
  "task_description",
  "transcript_path",
  "cwd",
  "current_dir",
  "project_dir",
  "added_dirs",
  "command",
  "content",
  "raw",
  "stdin",
  "payload",
]);

export function findForbiddenKeys(value: unknown, trail = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findForbiddenKeys(item, `${trail}[${index}]`));
  }
  if (typeof value !== "object" || value === null) {
    return [];
  }
  const hits: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    const next = trail ? `${trail}.${key}` : key;
    if (FORBIDDEN_KEYS.has(key)) {
      hits.push(next);
    }
    hits.push(...findForbiddenKeys(child, next));
  }
  return hits;
}

export function eventLooksPrivate(value: unknown): boolean {
  const text = JSON.stringify(value);
  if (!text) {
    return false;
  }
  if (findForbiddenKeys(value).length > 0) {
    return true;
  }
  return (
    text.includes("transcript_path") || text.includes("tool_input") || /"prompt"\s*:/.test(text)
  );
}
