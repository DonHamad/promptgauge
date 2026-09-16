/**
 * Official Claude Code status-line fields we depend on.
 * Source: https://code.claude.com/docs/en/statusline (retrieved 2026-09-16)
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
}
