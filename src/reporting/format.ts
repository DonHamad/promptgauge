import type { IntegrationStatus, QuotaSnapshot, QuotaWindow } from "../core/types.js";
import type { CircuitBreakerResult } from "../core/circuit-breaker/engine.js";
import type { BurnDetectorResult } from "../core/burn-detection/engine.js";
import type { SessionSummary } from "../core/types.js";
import { displayProvenance } from "../core/provenance.js";
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
  const quota = view.session.latestQuota;
  const lines = [
    "PromptGauge",
    "",
    `Claude Code integration: ${view.integration}`,
    "",
    ...formatQuotaBlock("5-hour quota", quota?.fiveHour?.value, now, view.fiveHourLabel),
    "",
    ...formatQuotaBlock("7-day quota", quota?.sevenDay?.value, now, view.sevenDayLabel),
    "",
    ...formatCostBlock(quota),
    "",
    ...formatContextBlock(quota),
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
    return [`${title}: ${unavailableLabel}`, "Provenance: UNAVAILABLE"];
  }
  return [
    title,
    `Used:       ${formatPct(window.usedPercentage)}%`,
    `Reset:      ${formatDurationUntil(epochSecondsToDate(window.resetsAtEpochSeconds), now)}`,
    "Source:     Claude Code",
    "Provenance: CLAUDE_REPORTED",
  ];
}

function formatCostBlock(snapshot: QuotaSnapshot | undefined): string[] {
  const cost = snapshot?.estimatedApiCostUsd;
  if (!cost) {
    return [
      "Estimated API-equivalent cost (not subscription billing): unavailable",
      "Provenance: UNAVAILABLE",
    ];
  }
  return [
    "Estimated API-equivalent cost (not subscription billing)",
    `Session:    $${cost.value.toFixed(5)}`,
    `Provenance: ${displayProvenance(cost.provenance)}`,
  ];
}

function formatContextBlock(snapshot: QuotaSnapshot | undefined): string[] {
  const context = snapshot?.contextWindow;
  if (!context) {
    return [
      "Context window (latest API response, not per-prompt tokens): unavailable",
      "Provenance: UNAVAILABLE",
    ];
  }
  const used =
    context.usedPercentage === undefined ? "unavailable" : `${formatPct(context.usedPercentage)}%`;
  return [
    "Context window (latest API response, not per-prompt tokens)",
    `Used:       ${used}`,
    `Input:      ${context.totalInputTokens ?? "unavailable"}`,
    `Output:     ${context.totalOutputTokens ?? "unavailable"}`,
    "Provenance: CLAUDE_REPORTED",
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
    return [
      "ID:        none",
      "Started:   n/a",
      "Quota Δ:   unavailable",
      "Est. API cost Δ: unavailable",
      "Exact prompt tokens: UNAVAILABLE",
    ];
  }
  const delta = prompt.quotaDeltaFiveHour
    ? `${signed(prompt.quotaDeltaFiveHour.value)} pts (5h, ${displayProvenance(prompt.quotaDeltaFiveHour.provenance)}; not tokens)`
    : "unavailable";
  const cost = prompt.estimatedApiCostDelta
    ? `$${prompt.estimatedApiCostDelta.value.toFixed(5)} (${displayProvenance(prompt.estimatedApiCostDelta.provenance)})`
    : "unavailable";
  return [
    `ID:        ${prompt.promptId ?? "unknown"}`,
    `Started:   ${prompt.startedAt ?? "unknown"}`,
    `Quota Δ:   ${delta}`,
    `Est. API cost Δ: ${cost}`,
    "Exact prompt tokens: UNAVAILABLE",
  ];
}

function signed(value: number): string {
  if (value > 0) {
    return `+${value.toFixed(1)}`;
  }
  return value.toFixed(1);
}
