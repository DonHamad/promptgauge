# Validation and adjacent tools

The Claude Code usage-reporting space is crowded. PromptGauge does not need to attack those projects. Several of them are useful local dashboards or cost estimators.

Adjacent examples (non-exhaustive, not endorsements):

- ccgauge — local dashboard over Claude Code / Codex JSONL session files
- ccusage-family tools — session JSONL cost rollups
- hyphenated `prompt-gauge` token estimators that are not Claude Code observability products

PromptGauge is an independent open-source project and is not affiliated with or endorsed by Anthropic.

## Differentiation

PromptGauge focuses on:

```
per-prompt attribution
+
per-task attribution
+
official live quota visibility
+
runaway detection
+
guardrail/circuit-breaker architecture
```

Phase 1 proves the collector pipeline and observe-only policies. It does not claim better cost estimates than transcript-based tools, because PromptGauge is not trying to reconstruct bills from JSONL pricing tables.

## Name check (2026-09-16, rechecked before publication)

| Name                                | Result                                                                |
| ----------------------------------- | --------------------------------------------------------------------- |
| npm `promptgauge`                   | unpublished (registry 404)                                            |
| npm `prompt-gauge`                  | unpublished (registry 404)                                            |
| GitHub `promptgauge`                | no Claude Code observability project using this exact name            |
| GitHub `prompt-gauge`               | small token estimator (`dpathak1935/prompt-gauge`), different product |
| GitHub `PromptGauge_Research_Paper` | unrelated research paper                                              |

No direct current Claude Code observability conflict on unhyphenated `promptgauge`. Publication uses repository `promptgauge` and display name PromptGauge.
