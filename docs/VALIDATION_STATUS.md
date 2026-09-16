# Validation status

Last updated: 2026-09-16

Evidence levels used in this document:

- **PROVEN** — covered by the current automated test suite and/or a local CLI run in this repository
- **DOCUMENTED** — present in official Claude Code documentation; implemented against that schema
- **PENDING EXTERNAL VALIDATION** — implemented, but this project has not observed the field from a live Claude Pro/Max session
- **NOT CLAIMED** — out of scope or unsupported by evidence

The maintainer does not currently use a Claude Pro/Max subscription. Live subscription telemetry validation is pending. That does **not** block development, testing, or publication.

| Capability                                 | Status                      |
| ------------------------------------------ | --------------------------- |
| CLI                                        | PROVEN                      |
| Local JSONL storage                        | PROVEN                      |
| Privacy allowlist                          | PROVEN                      |
| statusLine installation                    | PROVEN                      |
| Hook installation                          | PROVEN                      |
| Prompt lifecycle model                     | PROVEN                      |
| Per-prompt correlation logic               | PROVEN                      |
| Observe-only circuit-breaker policy engine | PROVEN                      |
| Synthetic 5h quota parsing                 | PROVEN                      |
| Synthetic 7d quota parsing                 | PROVEN                      |
| Synthetic `spend_limit` parsing            | PROVEN                      |
| Synthetic `prompt_cache` allowlist parsing | PROVEN                      |
| Official `five_hour` schema                | DOCUMENTED                  |
| Official `seven_day` schema                | DOCUMENTED                  |
| Official `spend_limit` schema              | DOCUMENTED                  |
| Official `prompt_cache` schema             | DOCUMENTED                  |
| Official `prompt_id` schema                | DOCUMENTED                  |
| Official `cost.total_cost_usd` schema      | DOCUMENTED                  |
| Official `context_window` schema           | DOCUMENTED                  |
| Live Pro/Max `five_hour` telemetry         | PENDING EXTERNAL VALIDATION |
| Live Pro/Max `seven_day` telemetry         | PENDING EXTERNAL VALIDATION |
| Live gateway `spend_limit` telemetry       | PENDING EXTERNAL VALIDATION |
| Real subscription quota delta              | PENDING EXTERNAL VALIDATION |
| Hard exact-token circuit breaker           | NOT CLAIMED                 |
| Exact per-prompt token consumption         | NOT CLAIMED                 |
| Automatic usage reduction                  | NOT CLAIMED                 |
| Real-time blocking                         | NOT CLAIMED                 |

See [PRO_MAX_VALIDATION.md](PRO_MAX_VALIDATION.md) if you can run a sanitized live check.
