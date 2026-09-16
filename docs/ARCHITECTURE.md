# Architecture

PromptGauge is a local CLI. Core logic does not depend on a UI framework or a network service.

```
src/
  cli/           commands
  core/          accounting, attribution, quota, guardrails
  claude/        schemas, parsers, status-line wrapper, hooks, plugin paths
  storage/       JSONL persistence
  reporting/     status and prompt output
  utils/
plugin/          Claude Code plugin (hooks, skills, bundled runtime)
.claude-plugin/  marketplace catalog
```

## Data flow

1. Claude Code invokes the status-line command and/or hooks.
2. `promptgauge collect` reads JSON on stdin.
3. Parsers classify the payload as status line or hook.
4. The sanitizer drops prompt text, tool payloads, assistant text, and task titles.
5. Events append to `PROMPTGAUGE_HOME` or `~/.promptgauge/events.jsonl`.
6. `promptgauge status` folds those events into session summaries and observe-only policies.

## Storage

V1 uses JSONL: append-only, inspectable, easy to fixture. SQLite is a later option if concurrent writers become real.

## Status-line wrapper

Claude Code currently supports one `statusLine` command. Plugin settings can ship `agent` / `subagentStatusLine`, but not a default user `statusLine`.

`/promptgauge:setup` (or `promptgauge setup`) writes a wrapper that:

1. Reads Claude Code stdin once
2. Stores allowlisted fields
3. Forwards the original bytes to the previous `statusLine.command`, if any
4. Returns that command's first stdout line

Collection errors are swallowed so Claude's status line still displays.

## Hooks

The Claude Code plugin registers `UserPromptSubmit` and `Stop` handlers from `plugin/hooks/hooks.json`. `promptgauge hooks install` remains as a standalone fallback and appends the same collectors to user settings without replacing other hooks.

The collector prints nothing on hook events. `UserPromptSubmit` stdout is injected into Claude's context, so extra output would leak into the prompt.

## Quota and correlation

Live quota comes from documented status-line `rate_limits` fields. Hook payloads do not document `rate_limits`.

Per-prompt deltas pair `UserPromptSubmit` / `Stop` with nearby same-session snapshots (15-minute window, 5s start grace, 30s end grace). Mismatched reset windows or decreasing percentages are omitted, not stored as zero.

Transcript JSONL is not ingested: files can lag, they contain prompt and tool content, and quota is not documented there. See `src/claude/transcripts/policy.ts`.

## Guardrails

The circuit breaker and burn detector are observe-only. They classify risk from stored events; they do not block prompts or tools.
