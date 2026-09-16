# Privacy

PromptGauge is local-first.

- Data stays on the machine in `PROMPTGAUGE_HOME` or `~/.promptgauge`.
- No PromptGauge account and no PromptGauge cloud backend.
- Prompt text is not stored. `privacy.storePromptText` is forced false in V1.
- Tool arguments, tool results, assistant messages, and task titles are discarded.
- Transcript files are not read.
- Raw status-line stdin is not stored. The collector parses JSON in memory and writes only allowlisted fields.
- `transcript_path`, `cwd`, and workspace directory paths are not persisted.
- Project correlation uses SHA-256 of a normalized project path (`projectKey`) plus an optional basename (`projectBasename`).
- Claude OAuth credentials are not required and must not be collected.
- No telemetry is sent to PromptGauge maintainers.
- `promptgauge doctor` prints `No credentials inspected.`

## Status-line allowlist

Stored when present:

- timestamp, `session_id`, `prompt_id`, Claude Code `version`
- `model.id`, `model.display_name`
- `rate_limits.five_hour` / `seven_day` / `spend_limit` (`used_percentage`, `resets_at`)
- `cost.total_cost_usd` (estimated API-equivalent session cost)
- `context_window` totals, percentages, and `current_usage` token/cache counts
- derived cache hit ratio from official cache read/write token counts
- allowlisted `prompt_cache` scalars: warm, caching_observed, ttl, expires_at, requests, misses, expected_rebuilds, hit_ratio, cache_write_tokens, miss_recache_tokens, recache_tokens_if_cold

Not stored:

- `transcript_path`, `cwd`, full project paths
- prompt / assistant / tool / task text
- `prompt_cache.last_miss_cause`, `prompt_cache.miss_causes`
- background task commands/descriptions and session cron prompts

If you find PromptGauge writing prompt bodies or source code to disk, that is a security bug. See [SECURITY.md](../SECURITY.md).
