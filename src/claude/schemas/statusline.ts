/**
 * Official Claude Code status-line fields we depend on.
 * Source: https://code.claude.com/docs/en/statusline (retrieved 2026-09-16)
 *
 * Not stored even when present: transcript_path, cwd, workspace paths.
 * prompt_cache and spend_limit are not documented on status-line stdin.
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
  workspace?: StatusLineWorkspace;
}
