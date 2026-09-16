# PromptGauge

See where your Claude Code usage goes.

PromptGauge is a local CLI for monitoring Claude Code activity, quota signals, and prompts.

It integrates with Claude Code's status line and hooks, keeps its data on your machine, and gives you a clearer view of long or expensive agent sessions.

🚧 Early development / pre-release

## Features

- Live Claude Code quota signals when available
- Per-prompt lifecycle tracking
- Local usage history
- Runaway-session detection
- Observe-only usage guardrails
- Local-only storage
- No PromptGauge account or cloud backend

## How it works

PromptGauge wraps Claude Code's status line and adds `UserPromptSubmit` / `Stop` hooks. Those surfaces feed an allowlisted collector, which appends records to `~/.promptgauge`.

```
Claude Code status line / hooks
        ↓
promptgauge collect
        ↓
~/.promptgauge/events.jsonl
        ↓
promptgauge status | prompts | doctor
```

PromptGauge reads quota information exposed by Claude Code's documented status-line interface, including five-hour and seven-day windows when those fields are present.

Available quota fields depend on the Claude account, plan, Claude Code version, and session. If Claude Code does not expose a metric, PromptGauge reports it as unavailable rather than treating it as zero.

`cost.total_cost_usd` is Claude Code's estimated API-equivalent session cost, not subscription billing. Context-window figures are latest-response telemetry, not exact per-prompt token counts.

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/CLAUDE_CODE_INTEGRATION.md](docs/CLAUDE_CODE_INTEGRATION.md).

## Install

Node.js 22+ and [pnpm](https://pnpm.io/). There is no npm package yet.

```bash
git clone https://github.com/DonHamad/promptgauge.git
cd promptgauge
pnpm install
pnpm build
node dist/index.js --help
```

```bash
node dist/index.js statusline install
node dist/index.js hooks install
node dist/index.js doctor
```

`statusline install` wraps `~/.claude/settings.json` without discarding an existing status line. `hooks install` appends collectors next to any hooks you already have. Uninstall removes only PromptGauge's entries.

## Usage

```bash
node dist/index.js status
node dist/index.js prompts --limit 10
node dist/index.js statusline status
node dist/index.js hooks status
node dist/index.js report
```

## Privacy

PromptGauge does not create an account, run a cloud backend, or send telemetry to the maintainers. It does not read Claude OAuth credentials.

By default it does not persist prompt text, assistant responses, or transcript paths. Project directories are stored as a hash plus an optional basename.

See [docs/PRIVACY.md](docs/PRIVACY.md).

## Development

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Roadmap

- Task and subagent activity tracking
- Better session summaries
- Optional circuit-breaker enforcement
- Richer local reports
- Easier installation

## License

[MIT](LICENSE)

PromptGauge is an independent open-source project and is not affiliated with Anthropic. Claude and Claude Code are products of Anthropic.
