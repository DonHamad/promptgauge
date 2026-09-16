# Changelog

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
