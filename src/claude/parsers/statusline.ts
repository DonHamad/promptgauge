import type {
  ContextCurrentUsage,
  ContextWindowTelemetry,
  PromptCacheTelemetry,
  QuotaSnapshotEvent,
  QuotaWindow,
} from "../../core/types.js";
import { projectIdentityFromPath } from "../../core/privacy/project-id.js";
import { asBoolean, asFiniteNumber, asString, isRecord } from "../../utils/json.js";

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
  return (
    Boolean(payload.model) ||
    Boolean(payload.rate_limits) ||
    Boolean(payload.context_window) ||
    Boolean(payload.prompt_cache)
  );
}

export function parseStatusLine(payload: unknown, capturedAt: string): StatusLineParseResult {
  if (!isRecord(payload)) {
    return { ok: false, error: "status payload is not an object" };
  }

  const rateLimits = isRecord(payload.rate_limits) ? payload.rate_limits : undefined;
  const modelRaw = isRecord(payload.model) ? payload.model : undefined;
  const costRaw = isRecord(payload.cost) ? payload.cost : undefined;
  const workspace = isRecord(payload.workspace) ? payload.workspace : undefined;
  const projectPath = asString(workspace?.project_dir);
  const project = projectPath ? projectIdentityFromPath(projectPath) : undefined;

  const event: QuotaSnapshotEvent = {
    type: "quota_snapshot",
    capturedAt,
    ingestSource: "statusline",
    sessionId: asString(payload.session_id),
    promptId: asString(payload.prompt_id),
    claudeVersion: asString(payload.version),
    model: modelRaw
      ? {
          id: asString(modelRaw.id),
          displayName: asString(modelRaw.display_name),
        }
      : undefined,
    fiveHour: parseWindow(rateLimits?.five_hour, { maxPercent: 100 }),
    sevenDay: parseWindow(rateLimits?.seven_day, { maxPercent: 100 }),
    spendLimit: parseWindow(rateLimits?.spend_limit, { maxPercent: Number.POSITIVE_INFINITY }),
    estimatedApiCostUsd: asFiniteNumber(costRaw?.total_cost_usd),
    contextWindow: parseContextWindow(payload.context_window),
    promptCache: parsePromptCache(payload.prompt_cache),
    projectKey: project?.projectKey,
    projectBasename: project?.projectBasename,
    provenance: "claude_reported",
    source: "claude_statusline",
  };

  return {
    ok: true,
    sessionId: event.sessionId,
    promptId: event.promptId,
    event,
  };
}

function parseWindow(value: unknown, options: { maxPercent: number }): QuotaWindow | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const usedPercentage = asFiniteNumber(value.used_percentage);
  const resetsAtEpochSeconds = asFiniteNumber(value.resets_at);
  if (usedPercentage === undefined || resetsAtEpochSeconds === undefined) {
    return undefined;
  }
  if (usedPercentage < 0 || usedPercentage > options.maxPercent) {
    return undefined;
  }
  return { usedPercentage, resetsAtEpochSeconds };
}

function parsePromptCache(value: unknown): PromptCacheTelemetry | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const ttlRaw = asString(value.ttl);
  const ttl = ttlRaw === "5m" || ttlRaw === "1h" ? ttlRaw : undefined;
  const hitRatio = asFiniteNumber(value.hit_ratio);
  const telemetry: PromptCacheTelemetry = {
    warm: asBoolean(value.warm),
    cachingObserved: asBoolean(value.caching_observed),
    ttl,
    expiresAtEpochSeconds: asFiniteNumber(value.expires_at),
    requests: asFiniteNumber(value.requests),
    misses: asFiniteNumber(value.misses),
    expectedRebuilds: asFiniteNumber(value.expected_rebuilds),
    hitRatio: hitRatio !== undefined && hitRatio >= 0 && hitRatio <= 1 ? hitRatio : undefined,
    cacheWriteTokens: asFiniteNumber(value.cache_write_tokens),
    missRecacheTokens: asFiniteNumber(value.miss_recache_tokens),
    recacheTokensIfCold: asFiniteNumber(value.recache_tokens_if_cold),
  };
  if (Object.values(telemetry).every((item) => item === undefined)) {
    return undefined;
  }
  return telemetry;
}

function parseContextWindow(value: unknown): ContextWindowTelemetry | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const currentUsage = parseCurrentUsage(value.current_usage);
  const telemetry: ContextWindowTelemetry = {
    totalInputTokens: asFiniteNumber(value.total_input_tokens),
    totalOutputTokens: asFiniteNumber(value.total_output_tokens),
    contextWindowSize: asFiniteNumber(value.context_window_size),
    usedPercentage: asFiniteNumber(value.used_percentage),
    remainingPercentage: asFiniteNumber(value.remaining_percentage),
    currentUsage,
    derivedCacheHitRatio: cacheHitRatio(currentUsage),
  };
  if (Object.values(telemetry).every((item) => item === undefined)) {
    return undefined;
  }
  return telemetry;
}

function parseCurrentUsage(value: unknown): ContextCurrentUsage | undefined {
  if (value === null || !isRecord(value)) {
    return undefined;
  }
  const usage: ContextCurrentUsage = {
    inputTokens: asFiniteNumber(value.input_tokens),
    outputTokens: asFiniteNumber(value.output_tokens),
    cacheCreationInputTokens: asFiniteNumber(value.cache_creation_input_tokens),
    cacheReadInputTokens: asFiniteNumber(value.cache_read_input_tokens),
  };
  if (Object.values(usage).every((item) => item === undefined)) {
    return undefined;
  }
  return usage;
}

function cacheHitRatio(usage: ContextCurrentUsage | undefined): number | undefined {
  if (!usage) {
    return undefined;
  }
  const reads = usage.cacheReadInputTokens ?? 0;
  const writes = usage.cacheCreationInputTokens ?? 0;
  const total = reads + writes;
  if (total <= 0) {
    return undefined;
  }
  return reads / total;
}
