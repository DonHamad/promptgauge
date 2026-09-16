# Changelog

## 0.3.0 — 2026-09-16

- Status-line support for `prompt_cache` and `rate_limits.spend_limit` (Claude Code v2.1.251+)
- `promptgauge hooks install|uninstall|status`
- `promptgauge prompts --limit N`
- Bounded snapshot correlation for per-prompt quota and cost deltas
- Privacy checks for prompt and assistant fields

## 0.2.0 — 2026-09-16

- `promptgauge statusline install|uninstall|status|run`
- Allowlisted status-line telemetry including model, estimated API cost, and context-window fields
- Fail-open wrapper around an existing `statusLine`
- Stricter quota and cost delta rules
- Doctor checks for wrapper, quota, cost, context, and privacy

## 0.1.0 — 2026-09-16

- Local JSONL event log for sanitized Claude Code hook and status-line observations
- `promptgauge status`, `doctor`, `collect`, `config`, `report`
- Observe-only circuit breaker and burn detector
