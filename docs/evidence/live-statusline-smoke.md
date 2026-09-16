# Live status-line smoke evidence

Date: 2026-09-16

Claude Code version detected: **2.1.273** via `npx @anthropic-ai/claude-code --version`

`claude` is not on PATH. Credentials were not inspected.

## Session

Print-mode ping:

```text
npx @anthropic-ai/claude-code -p "..." --output-format text
```

Result: `Not logged in · Please run /login`

No interactive session was started. PromptGauge `events.jsonl` was not created.

## Field observation

| Field | Classification |
| --- | --- |
| `session_id` | BLOCKED BY LOGIN |
| `prompt_id` | BLOCKED BY LOGIN |
| `rate_limits.five_hour` | BLOCKED BY LOGIN |
| `rate_limits.seven_day` | BLOCKED BY LOGIN |
| `rate_limits.spend_limit` | BLOCKED BY LOGIN |
| `cost.total_cost_usd` | BLOCKED BY LOGIN |
| `context_window.*` | BLOCKED BY LOGIN |
| `prompt_cache.*` | BLOCKED BY LOGIN |

`spend_limit` and `prompt_cache` remain optional even after login. Absence after a valid authenticated interactive response would be NOT OBSERVED / NOT APPLICABLE, not a product failure.

## Installer state on this machine

- Status-line wrapper: installed
- UserPromptSubmit / Stop hooks: installed
- No previous user statusLine or third-party hooks were present

## Manual action required

In a terminal:

1. `npx @anthropic-ai/claude-code`
2. `/login`
3. Complete the Anthropic browser/account approval
4. Submit a tiny interactive prompt (print mode `-p` may not invoke `statusLine`)
5. Run `promptgauge doctor` and `promptgauge prompts`
