# Claude Code integration

Official sources retrieved 2026-09-16:

- Status line: https://code.claude.com/docs/en/statusline
- Hooks: https://code.claude.com/docs/en/hooks
- Plugins: https://code.claude.com/docs/en/plugins
- Plugin reference: https://code.claude.com/docs/en/plugins-reference

PromptGauge is not affiliated with or endorsed by Anthropic. Field meanings below are restated from those pages.

Live quota is taken only from documented Claude Code surfaces. PromptGauge never uses Claude OAuth tokens, Keychain, Credential Manager, cookies, or private Anthropic HTTP APIs.

If `rate_limits` is absent: display unavailable. Never invent a percentage.

## Status line

| Field                                   | Official source                       | Meaning                                                            | Availability                                                                   | Fallback behavior                                                | Confidence              |
| --------------------------------------- | ------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ----------------------- |
| `session_id`                            | statusline docs                       | Unique session identifier                                          | Documented, expected                                                           | Session grouping skipped                                         | high                    |
| `prompt_id`                             | statusline docs                       | UUID for the user prompt being processed; matches OTEL `prompt.id` | v2.1.196+; absent until first user input                                       | Prompt grouping uses session only; attribution confidence drops  | high                    |
| `rate_limits.five_hour.used_percentage` | statusline docs                       | 5-hour window consumption 0–100                                    | Claude.ai Pro/Max after first API response; window may be independently absent | `5-hour quota: unavailable`                                      | high                    |
| `rate_limits.five_hour.resets_at`       | statusline docs                       | Unix epoch seconds when the 5-hour window resets                   | Same as used_percentage                                                        | Reset shown as unavailable; past reset → circuit breaker UNKNOWN | high                    |
| `rate_limits.seven_day.used_percentage` | statusline docs                       | 7-day window consumption 0–100                                     | Same caveats as 5-hour                                                         | `7-day quota: unavailable`                                       | high                    |
| `rate_limits.seven_day.resets_at`       | statusline docs                       | Unix epoch seconds when the 7-day window resets                    | Same caveats                                                                   | Same as 5-hour reset fallback                                    | high                    |
| `version`                               | statusline docs                       | Claude Code version string                                         | Documented                                                                     | Omitted from snapshot                                            | high                    |
| `model.display_name`                    | statusline docs                       | Model label                                                        | Documented                                                                     | Ignored in Phase 1 storage                                       | high                    |
| `transcript_path`                       | statusline docs                       | Path to conversation JSONL                                         | Documented                                                                     | Not stored (path can identify projects); not read                | high                    |
| `cost.total_cost_usd`                   | statusline docs                       | Client-side estimated session cost; may differ from bill           | Documented as estimated                                                        | Not used for quota or circuit breaker                            | high (as estimate only) |
| `hook_event_name`                       | older examples / some community notes | `"Status"` in some payloads                                        | Not in the current full schema example on 2026-09-16                           | Detection also uses `model` / `rate_limits` / `context_window`   | medium                  |

## Hooks (common fields)

| Field                               | Official source             | Meaning                                            | Availability                                            | Fallback behavior                                     | Confidence     |
| ----------------------------------- | --------------------------- | -------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------- | -------------- |
| `hook_event_name`                   | hooks docs                  | Event that fired                                   | Documented                                              | Payload rejected                                      | high           |
| `session_id`                        | hooks docs                  | Current session identifier                         | Documented                                              | Event stored without session                          | high           |
| `prompt_id`                         | hooks docs                  | UUID for the user prompt; matches OTEL `prompt.id` | v2.1.196+; absent until first user input                | Lifecycle still stored; per-prompt join is incomplete | high           |
| `transcript_path`                   | hooks docs                  | Path to conversation JSON; may lag                 | Documented lag warning                                  | Not stored, not read                                  | high           |
| `prompt`                            | UserPromptSubmit input      | Submitted prompt text                              | Documented                                              | **Discarded. Never stored in V1.**                    | high           |
| `tool_name`                         | PreToolUse / PostToolUse    | Tool identifier                                    | Documented                                              | Tool activity omitted                                 | high           |
| `tool_input` / `tool_response`      | Pre/PostToolUse             | Arguments and results, often source code           | Documented                                              | **Discarded**                                         | high           |
| `tool_use_id`                       | Pre/PostToolUse             | Tool call id                                       | Documented                                              | Optional                                              | high           |
| `duration_ms`                       | PostToolUse                 | Tool execution time excluding permission wait      | Optional                                                | Omitted                                               | high           |
| `agent_id` / `agent_type`           | SubagentStart/Stop          | Subagent identity                                  | Documented                                              | Subagent counts skipped                               | high           |
| `last_assistant_message`            | Stop / SubagentStop         | Final assistant text                               | Documented                                              | **Discarded**                                         | high           |
| `task_id`                           | TaskCreated / TaskCompleted | Task identifier                                    | Documented; events do not fire if Task tools are unused | Task accounting skipped                               | high           |
| `task_subject` / `task_description` | TaskCreated / TaskCompleted | User-visible task text                             | Documented; description may be absent                   | **Discarded**                                         | high           |
| `rate_limits` on hooks              | not documented              | n/a                                                | **Not part of hook common input**                       | Quota snapshots come from status line only            | high (absence) |

## Lifecycle mapping used in Phase 1

| Claude event                     | PromptGauge record                    | Notes                                                                   |
| -------------------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| `UserPromptSubmit`               | `prompt_lifecycle` phase=start        | Conservative prompt start                                               |
| `Stop`                           | `prompt_lifecycle` phase=stop         | Documented "finished responding"; not an exact token boundary           |
| `StopFailure`                    | `prompt_lifecycle` phase=stop_failure | Turn ended due to API error                                             |
| `PreToolUse` / `PostToolUse`     | `tool_activity`                       | Names and ids only                                                      |
| `SubagentStart` / `SubagentStop` | `subagent_activity`                   | Counts only                                                             |
| `TaskCreated` / `TaskCompleted`  | `task_lifecycle`                      | Ids only; no per-task quota unless status line also carries `prompt_id` |

## Limitations that change attribution

1. Hooks do not document `rate_limits`. Per-prompt quota delta requires overlapping status-line snapshots that include the same `prompt_id`.
2. `Stop` is the documented end of a response, not a guaranteed exact API-generation close. PromptGauge records it as observed end, not as exact token consumption.
3. Plugin settings cannot currently ship a default `statusLine`. Users must add the status-line command themselves for live quota.
4. `UserPromptSubmit` stdout is injected into Claude's context. The collector prints nothing on hook events.

## Undocumented / unused on purpose

- Private Anthropic quota HTTP APIs
- OAuth token reuse
- Browser account-page scraping
- Transcript JSONL body parsing
