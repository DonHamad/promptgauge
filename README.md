# PromptGauge

See where your Claude Code usage goes.

Prompt-level and task-level usage observability, live quota visibility, and local guardrails for runaway Claude Code sessions.

**🚧 Early development / pre-release**

PromptGauge is an independent open-source project and is not affiliated with or endorsed by Anthropic.

## What works in this pre-release

- Ingest Claude Code **status line** JSON and persist a sanitized quota snapshot when `rate_limits` is present.
- Ingest documented Claude Code **hooks** (`UserPromptSubmit`, `Stop`, tool/subagent/task events) without storing prompt text or tool payloads.
- `promptgauge status` prints observed 5-hour / 7-day quota when Claude Code reported it, otherwise `unavailable`.
- `promptgauge doctor` checks local health and does not inspect credentials.
- Circuit-breaker and burn detectors run in **observe-only** mode. They warn. They do not block Claude Code.

## What this is not

- Not a proxy, not a Claude API wrapper, not a SaaS, and not a token vendor.
- Not a claim of exact subscription consumption or guaranteed limit avoidance.
- Quota percentages are **reported by Claude Code**. Quota deltas are **derived** and are not token counts.

## Requirements

- Node.js 22 or later
- pnpm 9+ (CI uses pnpm)

## Setup

```bash
pnpm install
pnpm test
pnpm build
pnpm link --global
```

```bash
promptgauge --help
promptgauge doctor
promptgauge status
```

To observe live quota, Claude Code must send `rate_limits` to a status-line command. See `examples/claude-statusline.json` and [docs/CLAUDE_CODE_INTEGRATION.md](docs/CLAUDE_CODE_INTEGRATION.md).

Hook events are collected by the plugin under `plugin/` after you enable it locally. Hook stdout is kept empty so `UserPromptSubmit` does not inject collector output into Claude's context.

## Privacy

PromptGauge runs locally. It does not need Claude OAuth credentials, does not upload prompts or project files, and does not send telemetry to PromptGauge maintainers. See [docs/PRIVACY.md](docs/PRIVACY.md).

## Documentation

- [Master spec](docs/MASTER_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Claude Code integration](docs/CLAUDE_CODE_INTEGRATION.md)
- [Validation / differentiation](docs/VALIDATION.md)
- [Decisions](docs/DECISIONS.md)

## License

MIT
