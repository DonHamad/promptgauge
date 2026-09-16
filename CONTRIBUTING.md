# Contributing

Thank you for helping with PromptGauge.

This is an early, local-first project. The bar is correctness and evidence, not feature count.

## Principles

- No evidence = no claim.
- Do not store prompt text, source code, or tool payloads.
- Do not read Claude OAuth credentials or private APIs.
- Do not add telemetry.
- Circuit-breaker enforcement is out of scope until it has dedicated tests.

## Development

```bash
pnpm install
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Tests use synthetic fixtures only. Do not commit, paste, or depend on anyone's Claude credentials or subscription data.

Live Pro/Max quota validation is optional volunteer work. See [docs/PRO_MAX_VALIDATION.md](docs/PRO_MAX_VALIDATION.md). Never include tokens, prompts, or transcripts.

## Pull requests

- Keep changes small.
- Add fixtures when you touch parsers.
- Update `docs/CLAUDE_CODE_INTEGRATION.md` if you depend on a new Claude Code field. Record official source, availability, fallback, and confidence.
- Do not introduce unsupported marketing claims.

## Code of conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
