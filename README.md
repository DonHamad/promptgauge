# PromptGauge

See where your Claude Code usage goes.

Local-first observability and guardrails for Claude Code: track prompts, tasks, quota signals, and runaway usage without sending your project to a PromptGauge server.

**🚧 Early development / pre-release**

PromptGauge is an independent open-source project. It is not affiliated with, endorsed by, or sponsored by Anthropic.

Claude Code and Claude are trademarks and products of Anthropic. PromptGauge uses only publicly documented Claude Code interfaces (status line and hooks).

## What is PromptGauge?

PromptGauge is a local CLI that observes Claude Code usage on your machine.

It records allowlisted telemetry from Claude Code’s status line and a small set of lifecycle hooks, stores it in local JSONL, and reports prompt activity with honest provenance labels:

- `CLAUDE_REPORTED`
- `CLAUDE_REPORTED_ESTIMATE`
- `DERIVED`
- `UNAVAILABLE`

It does not proxy Claude, does not require a PromptGauge account, and does not upload your work.

## Why?

Claude Code sessions can burn subscription quota through long agent loops. Existing tools often reconstruct cost from transcript JSONL after the fact, or they require cloud accounts.

PromptGauge’s job is narrower:

1. Observe official Claude Code surfaces.
2. Correlate prompt start/stop with nearby quota snapshots when the evidence allows it.
3. Keep an observe-only guardrail model ready for later enforcement tests.
4. Refuse to invent missing numbers.

## Current status

Implementation of the local collector, installers, privacy allowlist, and synthetic tests is complete for **v0.3.0**.

Live Claude Pro/Max 5-hour and 7-day subscription quota telemetry is **not yet validated** by this project. The maintainer does not currently use a Claude Pro/Max subscription. That is a validation gap, not a development or publication blocker.

See [docs/VALIDATION_STATUS.md](docs/VALIDATION_STATUS.md).

## What works today

Proven by the automated test suite and local CLI:

- TypeScript CLI (`promptgauge`)
- Local JSONL storage
- Privacy allowlist (prompt text, assistant text, and transcript paths are not persisted)
- Non-destructive `statusLine` installer (idempotent, reversible, fail-open)
- Additive `UserPromptSubmit` / `Stop` hook installer
- Prompt lifecycle model and `promptgauge prompts`
- Parsers for documented status-line fields, including synthetic 5h/7d fixtures
- Provenance and snapshot-correlation rules (invalid pairs stay `UNAVAILABLE`, not zero)
- Observe-only circuit-breaker policy engine
- `promptgauge doctor`

## What is still being validated

Supported by the official Claude Code status-line schema, implemented against fixtures, **not live-validated on a Pro/Max account**:

- `rate_limits.five_hour`
- `rate_limits.seven_day`
- `rate_limits.spend_limit` (optional; Claude apps gateway)
- real prompt-to-quota deltas on a subscription plan

If you have Claude Pro/Max and want to help, see [docs/PRO_MAX_VALIDATION.md](docs/PRO_MAX_VALIDATION.md). Do not send credentials, prompts, or transcripts.

## Privacy

Privacy is a product constraint, not a slogan. Current tests cover these claims:

- No PromptGauge account
- No PromptGauge cloud backend
- No telemetry sent to PromptGauge maintainers
- No Claude OAuth credential access
- Prompt text is not persisted
- Assistant response text is not persisted
- Transcript paths are not persisted
- Project paths are hashed (`projectKey`) with an optional basename only

Raw status-line stdin is parsed in memory. Only an allowlisted subset is written to `~/.promptgauge`. Details: [docs/PRIVACY.md](docs/PRIVACY.md).

## Installation — development / pre-release

Node.js 22+ and pnpm 9+ (CI uses pnpm 12).

```bash
git clone https://github.com/DonHamad/promptgauge.git
cd promptgauge
pnpm install
pnpm test
pnpm build
node dist/index.js --help
```

There is no npm publish yet. The package name `promptgauge` is currently unpublished on the npm registry.

```bash
node dist/index.js statusline install
node dist/index.js hooks install
node dist/index.js doctor
```

`statusline install` wraps `~/.claude/settings.json` without discarding an existing status line. `hooks install` appends `UserPromptSubmit` and `Stop` collectors without removing other hooks. Uninstall reverses PromptGauge’s own entries.

## CLI examples

```bash
node dist/index.js status
node dist/index.js prompts --limit 10
node dist/index.js statusline status
node dist/index.js hooks status
node dist/index.js report
```

If Claude has not reported quota yet, PromptGauge prints `unavailable`. It will not print `0%` for a missing window.

## Architecture

Local process only:

```
Claude Code statusLine / hooks
        ↓
promptgauge collect (allowlisted parse)
        ↓
~/.promptgauge/events.jsonl
        ↓
promptgauge status | prompts | doctor
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/CLAUDE_CODE_INTEGRATION.md](docs/CLAUDE_CODE_INTEGRATION.md).

## Roadmap

- Contributor Pro/Max validation of live `rate_limits`
- Task-level accounting after live quota evidence exists
- Circuit-breaker **enforcement** only after dedicated tests (still observe-only today)
- No dashboard, SaaS, accounts, or cloud backend in the near term

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Please keep changes small, fixture-backed, and free of secrets.

## Security

See [SECURITY.md](SECURITY.md). Do not file public issues that include credentials, prompts, or private source.

## License

[MIT](LICENSE)

## Disclaimer

PromptGauge is an independent open-source project. It is not affiliated with, endorsed by, or sponsored by Anthropic.

Claude Code and Claude are trademarks and products of Anthropic. Field meanings are restated from Anthropic’s public Claude Code documentation. `cost.total_cost_usd` is an estimated API-equivalent session cost, not Pro/Max subscription billing. Exact per-prompt token consumption is unavailable. PromptGauge does not guarantee reduced Claude usage.
