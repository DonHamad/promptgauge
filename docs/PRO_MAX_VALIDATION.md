# Claude Pro/Max validation (contributors)

PromptGauge implements official Claude Code status-line fields, including `rate_limits.five_hour` and `rate_limits.seven_day`. The maintainer does not currently use Claude Pro/Max, so this project has **not** live-validated those subscription windows.

You can help without sharing secrets.

## Do not submit

- OAuth tokens or API keys
- Claude credentials or session cookies
- Raw prompt text
- Assistant responses
- Full transcript files
- Private project files or absolute paths
- Account emails, user IDs, or billing details

## Tiny test procedure

1. Install PromptGauge from source (`pnpm install && pnpm build`).
2. Run `node dist/index.js statusline install` and `node dist/index.js hooks install`.
3. Start an authenticated Claude Code **Pro or Max** interactive session (print mode `-p` may not invoke the status line).
4. Send a harmless tiny prompt such as: `Reply with exactly: ok`
5. Run:

```bash
node dist/index.js doctor
node dist/index.js status
node dist/index.js prompts
```

6. Open a GitHub issue with the **Pro/Max telemetry validation** template.

Report only field availability, for example:

```text
Claude Code version: 2.1.x
PromptGauge version: 0.3.0
Plan category (optional): Max
five_hour: yes / no
seven_day: yes / no
spend_limit: yes / no / not applicable
cost.total_cost_usd: yes / no
context_window: yes / no
prompt_cache: yes / no
prompt_id present on hooks and status line: yes / no
```

Do not paste quota percentages if you consider them private. `yes`/`no` is enough.

If a field is absent, that may be expected (`spend_limit` is gateway-specific). Say **not observed**, not “PromptGauge is broken,” unless doctor shows a FAIL for installation.
