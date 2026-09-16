import type { CircuitBreakerMode } from "../types.js";

export interface Thresholds {
  warning: number;
  critical: number;
  emergency: number;
}

export interface PrivacyConfig {
  storePromptText: false;
}

export interface PromptGaugeConfig {
  mode: CircuitBreakerMode;
  thresholds: Thresholds;
  privacy: PrivacyConfig;
  freshnessMs: number;
}

export const DEFAULT_CONFIG: PromptGaugeConfig = {
  mode: "observe",
  thresholds: {
    warning: 70,
    critical: 85,
    emergency: 95,
  },
  privacy: {
    storePromptText: false,
  },
  freshnessMs: 15 * 60 * 1000,
};

export function normalizeConfig(input: unknown): {
  config: PromptGaugeConfig;
  warnings: string[];
} {
  const warnings: string[] = [];
  const raw = isObject(input) ? input : {};

  const mode = raw.mode === "enforce" ? "observe" : raw.mode === "observe" ? "observe" : "observe";
  if (raw.mode === "enforce") {
    warnings.push("mode=enforce is not supported in this pre-release; observe-only is used.");
  }

  const thresholdsRaw = isObject(raw.thresholds) ? raw.thresholds : {};
  let warning = asPercent(thresholdsRaw.warning, DEFAULT_CONFIG.thresholds.warning);
  let critical = asPercent(thresholdsRaw.critical, DEFAULT_CONFIG.thresholds.critical);
  let emergency = asPercent(thresholdsRaw.emergency, DEFAULT_CONFIG.thresholds.emergency);

  if (!(warning < critical && critical < emergency)) {
    warnings.push("invalid thresholds; using defaults 70/85/95.");
    warning = DEFAULT_CONFIG.thresholds.warning;
    critical = DEFAULT_CONFIG.thresholds.critical;
    emergency = DEFAULT_CONFIG.thresholds.emergency;
  }

  const privacyRaw = isObject(raw.privacy) ? raw.privacy : {};
  if (privacyRaw.storePromptText === true) {
    warnings.push("privacy.storePromptText is unsupported in V1 and remains false.");
  }

  const freshnessMs =
    typeof raw.freshnessMs === "number" && Number.isFinite(raw.freshnessMs) && raw.freshnessMs > 0
      ? raw.freshnessMs
      : DEFAULT_CONFIG.freshnessMs;

  return {
    config: {
      mode,
      thresholds: { warning, critical, emergency },
      privacy: { storePromptText: false },
      freshnessMs,
    },
    warnings,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asPercent(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : fallback;
}
