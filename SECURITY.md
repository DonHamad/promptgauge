# Security Policy

## Product constraints

PromptGauge:

- does not need Claude OAuth credentials
- must never inspect the macOS Keychain, Windows Credential Manager, browser cookies, Claude credential files, or private Anthropic HTTP APIs
- must never upload source code, prompts, transcripts, or project files
- has no central telemetry service and must not send usage data to PromptGauge maintainers
- must treat `~/.claude/settings.json` modifications as privileged: backup first, validate JSON, write atomically, preserve foreign hooks and an existing `statusLine`
- must fail open for Claude Code display if collection fails

If live quota is not exposed by Claude Code through a documented status-line field, PromptGauge displays unavailable. It will not fabricate a percentage.

## Reporting a vulnerability

Do not open a public issue if disclosure would expose users.

Use GitHub Security Advisories on this repository:

https://github.com/DonHamad/promptgauge/security/advisories/new

Include:

- PromptGauge version
- Claude Code version if relevant
- Reproduction **without** secrets
- Impact

If you send credentials by accident, assume they are compromised and rotate them. Maintainers will redact them from materials and will not reuse them.

There is no paid bug bounty.

## Secret scanning

CI runs a local pattern scan (`pnpm scan:secrets`) in addition to GitHub’s default secret scanning on public repositories.
