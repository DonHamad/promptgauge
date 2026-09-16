# Claude Code integration

PromptGauge uses the public Claude Code status-line and hooks interfaces.

- Status line: https://code.claude.com/docs/en/statusline
- Hooks: https://code.claude.com/docs/en/hooks
- Plugins: https://code.claude.com/docs/en/plugins

It does not use Claude OAuth tokens, OS credential stores, cookies, or private Anthropic HTTP APIs.

If a documented field is absent, PromptGauge reports it as unavailable.

## Status line

| Field                             | Use                                                                    |
| --------------------------------- | ---------------------------------------------------------------------- |
| `session_id`                      | Group events by session                                                |
| `prompt_id`                       | Correlate with hook lifecycle (v2.1.196+)                              |
| `rate_limits.five_hour`           | 5-hour window `used_percentage` and `resets_at`                        |
| `rate_limits.seven_day`           | 7-day window `used_percentage` and `resets_at`                         |
| `rate_limits.spend_limit`         | Optional Claude apps gateway spend window (v2.1.251+; may exceed 100%) |
| `cost.total_cost_usd`             | Estimated API-equivalent session cost, not subscription billing        |
| `context_window.*`                | Latest API-response window, not exact per-prompt tokens                |
| `prompt_cache`                    | Allowlisted scalars only (v2.1.251+)                                   |
| `model.id` / `model.display_name` | Model label                                                            |
| `version`                         | Claude Code version                                                    |
| `workspace.project_dir`           | Hashed to `projectKey`; path is not stored                             |

Not stored: `transcript_path`, `cwd`, full project paths, `prompt_cache.last_miss_cause`, `prompt_cache.miss_causes`.

Quota availability depends on the Claude account, plan, Claude Code version, and whether the current session has produced an API response.

## Hooks

Installed by default: `UserPromptSubmit` (prompt start) and `Stop` / `StopFailure` (response end).

Also parsed if they arrive: `PreToolUse` / `PostToolUse`, `SubagentStart` / `SubagentStop`, `TaskCreated` / `TaskCompleted`.

Discarded from every hook payload: `prompt`, `tool_input`, `tool_response`, `last_assistant_message`, `task_subject`, `task_description`, `transcript_path`.

Hook common input does not document `rate_limits`. Quota snapshots come from the status line only.

`UserPromptSubmit` stdout is injected into Claude's context. Collectors print nothing on hook events.

## Per-prompt pairing

1. Require start and stop (or stop-failure) for the same `prompt_id` and `session_id`.
2. Baseline snapshot: same session, at or before start (+5s), not tagged with the current `prompt_id`, within 15 minutes.
3. After snapshot: same session, between start and stop (+30s), matching `prompt_id` when the snapshot has one.
4. Quota delta also requires the same `resets_at` and a non-decreasing percentage.
5. Cost delta requires a non-decreasing `cost.total_cost_usd`.

`Stop` is the documented end of a response, not a guaranteed exact token boundary.
