# Release plan

PromptGauge is pre-release software. There is no 1.0.0 and no npm publish yet.

## GitHub

Public repository: https://github.com/DonHamad/promptgauge

Version on `main`: **0.3.0**

A GitHub **pre-release** tag `v0.3.0` is appropriate once CI is green. It is not a stability promise.

## npm

Checked 2026-09-16:

| Name           | Registry          |
| -------------- | ----------------- |
| `promptgauge`  | unpublished (404) |
| `prompt-gauge` | unpublished (404) |

Do **not** publish an empty package merely to reserve the name.

When a real npm release happens:

- keep `private: true` until that decision is explicit
- publish `promptgauge` from this repository
- remain MIT
- still label the package as pre-release until live Pro/Max validation exists

## Not in this release

- Dashboard / Electron / SaaS
- Circuit-breaker enforcement
- Guaranteed usage reduction
- Exact per-prompt token billing
