# Changelog

## 0.3.0 — 2026-09-16

Phase 3 local alpha: official schema correction, reversible hooks, per-prompt correlation.

- Corrected `prompt_cache` and `rate_limits.spend_limit` as documented on status-line stdin (Claude Code v2.1.251+)
- `promptgauge hooks install|uninstall|status` (additive, reversible)
- `promptgauge prompts --limit N`
- Bounded snapshot correlation for per-prompt quota/cost deltas
- Privacy regression coverage for prompt and assistant sentinels

## 0.2.0 — 2026-09-16

Phase 2 local alpha: non-destructive status-line installer.

- `promptgauge statusline install|uninstall|status|run`
- Allowlisted status-line telemetry including model, estimated API cost, and context-window fields
- Fail-open wrapper around an existing `statusLine`
- Stricter quota/cost delta rules
- Doctor checks for wrapper, quota/cost/context, and privacy

## 0.1.0 — 2026-09-16

Pre-release vertical slice.

- Local JSONL event log for sanitized Claude Code hook and status-line observations
- `promptgauge status`, `doctor`, `collect`, `config`, `report`
- Observe-only circuit breaker and burn detector
- No npm publish, no GitHub Release, no enforcement
