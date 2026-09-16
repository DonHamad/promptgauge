import type { IntegrationStatus, QuotaSnapshot, QuotaWindow } from "../core/types.js";
import type { CircuitBreakerResult } from "../core/circuit-breaker/engine.js";
import type { BurnDetectorResult } from "../core/burn-detection/engine.js";
import type { SessionSummary } from "../core/types.js";
import { epochSecondsToDate, formatDurationUntil } from "../utils/time.js";

export interface StatusView {
  integration: IntegrationStatus;
  fiveHourLabel: string;
  sevenDayLabel: string;
  session: SessionSummary;
  circuitBreaker: CircuitBreakerResult;
  burn: BurnDetectorResult;
  latestPromptLines: string[];
}

export function formatStatus(view: StatusView, now: Date): string {
  const lines = [
    "PromptGauge",
    "",
    `Claude Code integration: ${view.integration}`,
    "",
    ...formatQuotaBlock(
      "5-hour quota",
      view.session.latestQuota?.fiveHour?.value,
      now,
      view.fiveHourLabel,
    ),
    "",
    ...formatQuotaBlock(
      "7-day quota",
      view.session.latestQuota?.sevenDay?.value,
      now,
      view.sevenDayLabel,
    ),
    "",
    "Current session",
    `Prompts observed: ${view.session.promptsObserved}`,
    "",
    "Latest prompt",
    ...view.latestPromptLines,
    "",
    "Circuit breaker (observe-only)",
    `State:      ${view.circuitBreaker.state}`,
    `Reason:     ${view.circuitBreaker.reason}`,
    `Action:     ${view.circuitBreaker.recommendedAction}`,
    "",
    "Burn detector",
    `Level:      ${view.burn.level}`,
    `Reason:     ${view.burn.reason}`,
  ];
  return `${lines.join("\n")}\n`;
}

function formatQuotaBlock(
  title: string,
  window: QuotaWindow | undefined,
  now: Date,
  unavailableLabel: string,
): string[] {
  if (!window) {
    return [`${title}: ${unavailableLabel}`];
  }
  return [
    title,
    `Used:      ${formatPct(window.usedPercentage)}%`,
    `Reset:     ${formatDurationUntil(epochSecondsToDate(window.resetsAtEpochSeconds), now)}`,
    "Source:    Claude Code",
  ];
}

export function formatPct(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function quotaUnavailableLabel(
  snapshot: QuotaSnapshot | undefined,
  window: "five" | "seven",
): string {
  if (!snapshot) {
    return "unavailable";
  }
  if (window === "five" && !snapshot.fiveHour) {
    return "unavailable";
  }
  if (window === "seven" && !snapshot.sevenDay) {
    return "unavailable";
  }
  return "unavailable";
}

export function formatLatestPrompt(summary: SessionSummary): string[] {
  const prompt = summary.latestPrompt;
  if (!prompt) {
    return ["ID:        none", "Started:   n/a", "Quota Δ:   unavailable"];
  }
  const delta = prompt.quotaDeltaFiveHour
    ? `${signed(prompt.quotaDeltaFiveHour.value)} pts (5h, derived; not tokens)`
    : "unavailable";
  return [
    `ID:        ${prompt.promptId ?? "unknown"}`,
    `Started:   ${prompt.startedAt ?? "unknown"}`,
    `Quota Δ:   ${delta}`,
  ];
}

function signed(value: number): string {
  if (value > 0) {
    return `+${value.toFixed(1)}`;
  }
  return value.toFixed(1);
}
