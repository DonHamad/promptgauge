# Architecture

PromptGauge is a local CLI plus a Claude Code plugin/hooks collector. Business logic does not depend on React, Electron, or a network service.

```
src/
  cli/           command parsing and I/O
  core/          accounting, attribution, quota, circuit-breaker, burn-detection
  claude/        official schema types, parsers, sanitizer, plugin glue
  storage/       JSONL persistence
  reporting/     status text (HTML report can consume the same records later)
  utils/
```

## Data flow

1. Claude Code invokes a status-line command and/or hooks.
2. `promptgauge collect` reads JSON on stdin.
3. Parsers classify the payload as status line or hook.
4. The sanitizer drops prompt text, tool payloads, assistant text, and task titles.
5. JSONL append under `PROMPTGAUGE_HOME` or `~/.promptgauge/events.jsonl`.
6. `promptgauge status` folds events into session/prompt summaries and observe-only policies.

## Provenance

Every stored quota window is `claude_reported`.
Quota deltas are `derived`.
PromptGauge does not currently emit `estimated` token counts.

## Why JSONL

V1 needs append-only, inspectable, portable records. SQLite would help concurrent writers and queries, but Phase 1 has a single local writer and small volume. JSONL keeps the core UI-agnostic and easy to test.

## Why transcripts are not ingested

Official hook docs state transcript files can lag the in-memory conversation. Transcripts also contain prompt text. Live `rate_limits` are documented on the status line, not on transcript records. See `src/claude/transcripts/policy.ts`.

## Plugin vs status line

Official plugin `settings.json` currently supports `agent` and `subagentStatusLine` only. User/project `statusLine` remains the documented path for `rate_limits`. The plugin ships hooks; status-line wiring is documented in `examples/`.

## Later HTML report

`src/reporting` reads stored events. A future local HTML renderer can consume the same JSONL without coupling the core to a UI framework.

## Status-line wrapper

`promptgauge statusline install` writes a command that runs `statusline run --pg-wrapper`. That process:

1. Reads Claude Code stdin once
2. Extracts allowlisted fields into JSONL
3. Forwards the original bytes to the previous `statusLine.command` if one existed
4. Returns that command's first stdout line

Collection errors are swallowed. Display fail-open.
