# Live status-line smoke evidence

Date: 2026-09-16

Claude Code version detected: **2.1.273** via `npx @anthropic-ai/claude-code --version`

Credentials were not inspected.

This is **not** a project blocker. Development, tests, and GitHub publication continue without a Claude Pro/Max subscription.

## What was attempted

Print-mode ping:

```text
npx @anthropic-ai/claude-code -p "..." --output-format text
```

Result: not authenticated on this machine. No PromptGauge `events.jsonl` snapshot was created.

## Field observation

Live Pro/Max subscription windows were **not** observed. Classification:

| Field                     | Classification              |
| ------------------------- | --------------------------- |
| `session_id`              | PENDING EXTERNAL VALIDATION |
| `prompt_id`               | PENDING EXTERNAL VALIDATION |
| `rate_limits.five_hour`   | PENDING EXTERNAL VALIDATION |
| `rate_limits.seven_day`   | PENDING EXTERNAL VALIDATION |
| `rate_limits.spend_limit` | PENDING EXTERNAL VALIDATION |
| `cost.total_cost_usd`     | PENDING EXTERNAL VALIDATION |
| `context_window.*`        | PENDING EXTERNAL VALIDATION |
| `prompt_cache.*`          | PENDING EXTERNAL VALIDATION |

Parsers and synthetic fixtures for these fields are implemented. Official schema support is documented in [CLAUDE_CODE_INTEGRATION.md](../CLAUDE_CODE_INTEGRATION.md).

`spend_limit` and `prompt_cache` remain optional even on a live account.

## Installer state recorded on the maintainer machine

- Status-line wrapper: installed
- UserPromptSubmit / Stop hooks: installed
- No previous user statusLine or third-party hooks were present

## How to close the gap

A Claude Pro/Max user can follow [PRO_MAX_VALIDATION.md](../PRO_MAX_VALIDATION.md) and file a sanitized availability report. Do not send credentials, prompts, or transcripts.
