# PromptGauge

See where your Claude Code usage goes.

Prompt-level and task-level usage observability, live quota visibility, and local guardrails for runaway Claude Code sessions.

**🚧 Early development / pre-release**

PromptGauge is an independent open-source project and is not affiliated with or endorsed by Anthropic.

## What this pre-release does

- Local-first Claude Code usage observability
- Claude-reported 5-hour / 7-day quota visibility where Claude Code exposes `rate_limits`
- Prompt/task lifecycle correlation from documented hooks
- Estimated API-equivalent cost attribution where a same-session baseline exists
- Deterministic burn detection
- Observe-only guardrails
- Privacy-preserving status-line collection via a non-destructive wrapper

## What this pre-release does not claim

- Exact per-prompt token billing
- Exact per-task subscription consumption
- Guaranteed reduction in Claude usage
- Automatic prevention of all runaway usage
- Real-time blocking

Quota percentages are **CLAUDE_REPORTED**. Quota deltas are **DERIVED**. `cost.total_cost_usd` is a **CLAUDE_REPORTED_ESTIMATE** of API-equivalent session cost, not Pro/Max subscription billing. Exact prompt token consumption is **UNAVAILABLE**.

## Requirements

- Node.js 22 or later
- pnpm 9+ (CI uses pnpm)

## Setup

```bash
pnpm install
pnpm test
pnpm build
```

```bash
node dist/index.js --help
node dist/index.js doctor
node dist/index.js statusline install
node dist/index.js status
```

`promptgauge statusline install` wraps `~/.claude/settings.json` without discarding an existing `statusLine`. A second install does not double-wrap. `promptgauge statusline uninstall` restores the previous command where it was saved.

If PromptGauge collection fails, the original status line still runs.

## Privacy

PromptGauge runs locally. It does not need Claude OAuth credentials, does not upload prompts or project files, and does not send telemetry to PromptGauge maintainers. Status-line stdin is parsed in memory; only an allowlisted subset is stored. See [docs/PRIVACY.md](docs/PRIVACY.md).

## Documentation

- [Master spec](docs/MASTER_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Claude Code integration](docs/CLAUDE_CODE_INTEGRATION.md)
- [Validation / differentiation](docs/VALIDATION.md)
- [Decisions](docs/DECISIONS.md)

## License

MIT
