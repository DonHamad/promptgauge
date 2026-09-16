# Decisions

## 2026-09-16 — JSONL storage

Use JSONL for V1. Volume is small, records must be auditable, and tests can copy fixtures. Revisit SQLite if concurrent writers become real.

## 2026-09-16 — Status line is the only live quota source

Official `rate_limits` (5-hour and 7-day `used_percentage` + `resets_at`) are documented on status-line stdin, for Claude.ai subscribers after the first API response. Hook common input does not document `rate_limits`. Quota snapshots are therefore ingested from the status line only.

## 2026-09-16 — Observe-only circuit breaker

Enforcement can reject prompts (`UserPromptSubmit` decision=block) or deny tools, but that is deferred until dedicated tests exist. Unknown telemetry is never treated as safe.

## 2026-09-16 — No transcript ingest

Transcripts contain secrets-adjacent content and can lag. Quota is not documented there.

## 2026-09-16 — Keep the PromptGauge name

Hyphenated `prompt-gauge` is an unrelated 0-star token estimator. No npm package occupies `promptgauge`.

## 2026-09-16 — Plugin cannot ship statusLine defaults

Plugin `settings.json` currently supports `agent` and `subagentStatusLine` only. Document a user/project status-line snippet instead of pretending the plugin installs live quota automatically.
