# PromptGauge V1 master spec

Status: approved for Phase 1 implementation (pre-release).

PromptGauge is a free, local-first open-source observability and guardrail tool for Claude Code. It shows where usage goes per prompt and per task, displays live subscription usage when Claude Code officially exposes it, and protects users against runaway usage.

PromptGauge is an independent open-source project and is not affiliated with or endorsed by Anthropic.

## Non-goals

- Not a generic token optimizer
- Not a proxy
- Not a Claude API wrapper
- Not a SaaS
- Does not provide AI tokens
- No web dashboard, Electron app, accounts, cloud database, or npm publish in this phase
- No hard-stop enforcement in this phase
- No reading of Claude OAuth credentials or undocumented private APIs

## Primary value

1. Per-prompt usage attribution
2. Per-task usage accounting
3. Live Claude subscription usage visibility
4. Runaway usage detection
5. Circuit-breaker guardrails (observe-only in Phase 1)

## Claims policy

Do not claim:

- savings percentages
- exact subscription consumption
- hard-stopping an API generation at an exact token
- knowledge of Anthropic's private quota formula
- that users will never hit a limit
- 100% accuracy unless proven

Use: observed, measured, reported by Claude Code, estimated, derived — matching the source.

No evidence = no claim.

## Phase 1 vertical slice

```
Claude Code
  → prompt event (UserPromptSubmit hook)
  → PromptGauge collector
  → quota snapshot if status line reports rate_limits
  → local JSONL record
  → promptgauge status
```

Required commands: `status`, `doctor`, `--help`, `--version`.

## Privacy

- Local storage only
- No prompt text by default; `storePromptText` is false and unsupported in V1
- No source-code contents
- No secrets
- No telemetry

## Circuit breaker

States: NORMAL, WARNING, CRITICAL, EMERGENCY, UNKNOWN.

Defaults: WARNING >= 70%, CRITICAL >= 85%, EMERGENCY >= 95%.

Missing or stale telemetry → UNKNOWN. Unknown is not safe.

Mode: observe-only.

## Burn detector

Deterministic only. No LLM. RUNAWAY requires more than one weak heuristic.
