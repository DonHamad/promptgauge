# Contributing

Thanks for helping with PromptGauge.

## Development

```bash
pnpm install
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Do not store prompt text, source code, or tool payloads. Do not read Claude credentials or private APIs. Do not add telemetry to PromptGauge maintainers.

Circuit-breaker enforcement is out of scope until it has dedicated tests.

## Pull requests

- Keep changes small.
- Add fixtures when you touch parsers.
- Update [docs/CLAUDE_CODE_INTEGRATION.md](docs/CLAUDE_CODE_INTEGRATION.md) if you depend on a new Claude Code field.
- Do not include credentials, private prompts, or transcripts in issues or PRs.

## Code of conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
