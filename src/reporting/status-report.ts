import type { IntegrationStatus } from "../core/types.js";
import { evaluateBurn } from "../core/burn-detection/engine.js";
import { evaluateCircuitBreaker } from "../core/circuit-breaker/engine.js";
import type { PromptGaugeConfig } from "../core/config/model.js";
import { summarizeSession } from "../core/accounting/session-summary.js";
import { isStale } from "../utils/time.js";
import type { StoredEvent } from "../core/types.js";
import {
  formatLatestPrompt,
  formatStatus,
  quotaUnavailableLabel,
  type StatusView,
} from "./format.js";

export function buildStatusView(
  events: StoredEvent[],
  config: PromptGaugeConfig,
  now: Date,
): StatusView {
  const session = summarizeSession(events);
  const circuitBreaker = evaluateCircuitBreaker({
    snapshot: session.latestQuota,
    now,
    freshnessMs: config.freshnessMs,
    thresholds: config.thresholds,
    mode: config.mode,
  });
  const burn = evaluateBurn({ events, now });
  const integration = integrationStatus(events, now, config.freshnessMs);

  return {
    integration,
    fiveHourLabel: quotaUnavailableLabel(session.latestQuota, "five"),
    sevenDayLabel: quotaUnavailableLabel(session.latestQuota, "seven"),
    session,
    circuitBreaker,
    burn,
    latestPromptLines: formatLatestPrompt(session),
  };
}

export function renderStatus(events: StoredEvent[], config: PromptGaugeConfig, now: Date): string {
  return formatStatus(buildStatusView(events, config, now), now);
}

function integrationStatus(
  events: StoredEvent[],
  now: Date,
  freshnessMs: number,
): IntegrationStatus {
  const last = events[events.length - 1];
  if (!last) {
    return "INACTIVE";
  }
  if (isStale(last.capturedAt, now, Math.max(freshnessMs, 24 * 60 * 60 * 1000))) {
    return "INACTIVE";
  }
  return "ACTIVE";
}
