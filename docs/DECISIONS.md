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

Plugin `settings.json` currently supports `agent` and `subagentStatusLine` only. PromptGauge therefore installs a user-level status-line wrapper via `promptgauge statusline install`.

## 2026-09-16 — Non-destructive status-line wrapper

Claude Code supports one `statusLine` command. PromptGauge wraps it: collect allowlisted telemetry, then pass the original stdin to the previous command and return that command's stdout. Collection failures fail open. A second install does not double-wrap. Uninstall restores the saved previous `statusLine` object.

## 2026-09-16 — No prompt_cache / spend_limit objects (superseded)

Phase 2 recorded these as undocumented. Revalidated the same day against https://code.claude.com/docs/en/statusline; both fields are documented as of Claude Code v2.1.251. See the later decision.

## 2026-09-16 — Cost is estimated API-equivalent

`cost.total_cost_usd` is documented as a client-side estimated session cost that may differ from the bill. Per-prompt cost deltas require a same-session baseline snapshot before `UserPromptSubmit` and an after snapshot at/after `Stop`. Missing baselines, session changes, and downward resets yield UNAVAILABLE, not zero.

## 2026-09-16 — prompt_cache and spend_limit are documented (v2.1.251+)

Revalidated against https://code.claude.com/docs/en/statusline. Phase 2 recorded these as undocumented; current official docs include:

- `prompt_cache` after the main conversation's first API response (v2.1.251+)
- `rate_limits.spend_limit` behind a Claude apps gateway (v2.1.251+); `used_percentage` may exceed 100

PromptGauge stores an allowlist of non-sensitive `prompt_cache` scalars. Nested `last_miss_cause` / `miss_causes` objects are discarded. `spend_limit` is stored separately from 5-hour and 7-day windows and is not assumed present for Pro/Max.

## 2026-09-16 — Hooks installer is additive

`promptgauge hooks install` appends UserPromptSubmit and Stop command handlers. It does not replace the `hooks` object or remove other tools' handlers. Uninstall strips only PromptGauge `--pg-hook` commands.

## 2026-09-16 — Snapshot correlation is bounded, not simultaneous

Status-line ticks are not synchronized with hooks. Per-prompt deltas use the nearest eligible same-session snapshot within 15 minutes (5s start grace, 30s end grace), matching `prompt_id` when the snapshot has one. Failed pairing is UNAVAILABLE.
