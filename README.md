# PromptGauge

See where your Claude Code usage goes.

PromptGauge is a local CLI for monitoring Claude Code activity, quota signals, and prompts.

It integrates with Claude Code's status line and hooks, keeps its data on your machine, and gives you a clearer view of long or expensive agent sessions.

🚧 Early development / pre-release

## Install

In Claude Code, install at **user scope**:

```text
/plugin marketplace add DonHamad/promptgauge
/plugin install promptgauge@promptgauge
/promptgauge:setup
```

Then use Claude Code normally.

Quota numbers appear after Claude Code exposes them for the current session.

```text
/promptgauge:status
/promptgauge:doctor
```

Before removing the plugin:

```text
/promptgauge:uninstall
/plugin uninstall promptgauge@promptgauge
```

## Features

- Live Claude Code quota signals when available
- Per-prompt lifecycle tracking
- Local usage history
- Runaway-session detection
- Observe-only usage guardrails
- Local-only storage
- No PromptGauge account or cloud backend

## How it works

The plugin registers prompt start/stop hooks automatically. `/promptgauge:setup` connects the status line once, without discarding an existing status line.

```
Claude Code status line / hooks
        ↓
PromptGauge collector
        ↓
~/.promptgauge
        ↓
/promptgauge:status
```

Available quota fields depend on the Claude account, plan, Claude Code version, and session. If Claude Code does not expose a metric, PromptGauge reports it as unavailable rather than treating it as zero.

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/CLAUDE_CODE_INTEGRATION.md](docs/CLAUDE_CODE_INTEGRATION.md).

## Privacy

PromptGauge does not create an account, run a cloud backend, or send telemetry to the maintainers. It does not read Claude OAuth credentials.

By default it does not persist prompt text, assistant responses, or transcript paths. Project directories are stored as a hash plus an optional basename.

See [docs/PRIVACY.md](docs/PRIVACY.md).

## Development

```bash
git clone https://github.com/DonHamad/promptgauge.git
cd promptgauge
pnpm install
pnpm test
pnpm build
```

The CLI remains available for debugging:

```bash
node dist/index.js doctor
node dist/index.js statusline status
```

See [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md).

## Roadmap

- Task and subagent activity tracking
- Better session summaries
- Optional circuit-breaker enforcement
- Richer local reports

## License

[MIT](LICENSE)

PromptGauge is an independent open-source project and is not affiliated with Anthropic. Claude and Claude Code are products of Anthropic.
