# Security Policy

## Product constraints

PromptGauge must not require Claude OAuth credentials.

It must not upload prompts or project files.

It must not send telemetry to PromptGauge maintainers.

Reports are local.

Sensitive values must be redacted.

PromptGauge must not read the macOS Keychain, Windows Credential Manager, browser cookies, Claude `.credentials` files, or private Anthropic endpoints.

If live quota is not exposed by Claude Code through a documented status-line or equivalent interface, PromptGauge displays `Live subscription quota unavailable`. It will not fabricate a percentage.

## Reporting a vulnerability

Do not post security issues publicly if disclosure would expose users.

Email the maintainer privately through GitHub Security Advisories on this repository once the public repo exists, or open a private advisory.

Include:

- PromptGauge version
- Claude Code version if relevant
- Reproduction without secrets
- Impact

We will redact credentials from any materials you send if they are included accidentally.

## Secret scanning

CI runs a local pattern scan (`pnpm scan:secrets`) in addition to GitHub's default secret scanning on public repositories.
