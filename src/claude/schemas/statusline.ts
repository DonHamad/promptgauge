/**
 * Official Claude Code status-line fields we depend on.
 * Source: https://code.claude.com/docs/en/statusline (retrieved 2026-09-16)
 *
 * Not stored even when present: transcript_path, cwd, workspace paths,
 * prompt_cache.last_miss_cause, prompt_cache.miss_causes.
 *
 * spend_limit and prompt_cache are documented as of Claude Code v2.1.251.
 */
export interface StatusLineModel {
  id?: string;
  display_name?: string;
}

export interface StatusLineRateWindow {
  used_percentage?: number;
  resets_at?: number;
}

export interface StatusLineRateLimits {
  five_hour?: StatusLineRateWindow;
  seven_day?: StatusLineRateWindow;
  spend_limit?: StatusLineRateWindow;
}

export interface StatusLineCost {
  total_cost_usd?: number;
}

export interface StatusLineContextUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface StatusLineContextWindow {
  total_input_tokens?: number;
  total_output_tokens?: number;
  context_window_size?: number;
  used_percentage?: number | null;
  remaining_percentage?: number | null;
  current_usage?: StatusLineContextUsage | null;
}

export interface StatusLinePromptCache {
  warm?: boolean;
  caching_observed?: boolean;
  ttl?: string;
  expires_at?: number | null;
  requests?: number;
  misses?: number;
  expected_rebuilds?: number;
  hit_ratio?: number | null;
  cache_write_tokens?: number;
  miss_recache_tokens?: number;
  recache_tokens_if_cold?: number | null;
}

export interface StatusLineWorkspace {
  current_dir?: string;
  project_dir?: string;
}

export interface StatusLinePayload {
  hook_event_name?: string;
  cwd?: string;
  session_id?: string;
  session_name?: string;
  prompt_id?: string;
  transcript_path?: string;
  version?: string;
  model?: StatusLineModel;
  rate_limits?: StatusLineRateLimits;
  cost?: StatusLineCost;
  context_window?: StatusLineContextWindow;
  prompt_cache?: StatusLinePromptCache;
  workspace?: StatusLineWorkspace;
}
