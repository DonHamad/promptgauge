import type { QuotaSnapshotEvent, QuotaWindow } from "../../core/types.js";
import { asFiniteNumber, asString, isRecord } from "../../utils/json.js";
import { normalizePathForCompare } from "../../utils/platform.js";

export type StatusLineParseResult =
  | { ok: true; event: QuotaSnapshotEvent; sessionId?: string; promptId?: string }
  | { ok: false; error: string };

export function looksLikeStatusLine(payload: Record<string, unknown>): boolean {
  if (asString(payload.hook_event_name) === "Status") {
    return true;
  }
  if (asString(payload.hook_event_name)) {
    return false;
  }
  return Boolean(payload.model) || Boolean(payload.rate_limits) || Boolean(payload.context_window);
}

export function parseStatusLine(payload: unknown, capturedAt: string): StatusLineParseResult {
  if (!isRecord(payload)) {
    return { ok: false, error: "status payload is not an object" };
  }

  const rateLimits = isRecord(payload.rate_limits) ? payload.rate_limits : undefined;
  const fiveHour = parseWindow(rateLimits?.five_hour);
  const sevenDay = parseWindow(rateLimits?.seven_day);
  const sessionId = asString(payload.session_id);
  const promptId = asString(payload.prompt_id);
  const transcriptPath = asString(payload.transcript_path);

  if (transcriptPath) {
    normalizePathForCompare(transcriptPath);
  }

  return {
    ok: true,
    sessionId,
    promptId,
    event: {
      type: "quota_snapshot",
      capturedAt,
      ingestSource: "statusline",
      sessionId,
      promptId,
      claudeVersion: asString(payload.version),
      fiveHour,
      sevenDay,
      provenance: "claude_reported",
      source: "claude_statusline",
    },
  };
}

function parseWindow(value: unknown): QuotaWindow | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const usedPercentage = asFiniteNumber(value.used_percentage);
  const resetsAtEpochSeconds = asFiniteNumber(value.resets_at);
  if (usedPercentage === undefined || resetsAtEpochSeconds === undefined) {
    return undefined;
  }
  if (usedPercentage < 0 || usedPercentage > 100) {
    return undefined;
  }
  return { usedPercentage, resetsAtEpochSeconds };
}
