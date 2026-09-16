/**
 * Provenance is mandatory. A number without a source is not a metric.
 *
 * Never mix estimated token values with Claude-reported quota percentages
 * without labeling them separately.
 */
export type MetricProvenance =
  | "claude_reported"
  | "claude_reported_estimate"
  | "transcript_observed"
  | "derived"
  | "derived_from_claude_reported_session_cost"
  | "estimated";

export type DisplayProvenance =
  | "CLAUDE_REPORTED"
  | "CLAUDE_REPORTED_ESTIMATE"
  | "DERIVED"
  | "DERIVED_FROM_CLAUDE_REPORTED_SESSION_COST"
  | "ESTIMATED"
  | "UNAVAILABLE"
  | "UNKNOWN";

export type MetricConfidence = "high" | "medium" | "low" | "none";

export interface ProvenancedMetric<T> {
  value: T;
  source: string;
  capturedAt: string;
  provenance: MetricProvenance;
  confidence: MetricConfidence;
}

export type CircuitBreakerState = "NORMAL" | "WARNING" | "CRITICAL" | "EMERGENCY" | "UNKNOWN";

export type CircuitBreakerMode = "observe" | "enforce";

export type BurnLevel = "NORMAL" | "ELEVATED" | "HIGH" | "RUNAWAY" | "UNKNOWN";

export type IntegrationStatus = "ACTIVE" | "INACTIVE" | "UNKNOWN";

export interface QuotaWindow {
  usedPercentage: number;
  resetsAtEpochSeconds: number;
}

export interface ModelInfo {
  id?: string;
  displayName?: string;
}

export interface ContextCurrentUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
}

export interface ContextWindowTelemetry {
  totalInputTokens?: number;
  totalOutputTokens?: number;
  contextWindowSize?: number;
  usedPercentage?: number;
  remainingPercentage?: number;
  currentUsage?: ContextCurrentUsage;
  derivedCacheHitRatio?: number;
}

export interface QuotaSnapshot {
  capturedAt: string;
  source: "claude_statusline";
  provenance: "claude_reported";
  sessionId?: string;
  promptId?: string;
  claudeVersion?: string;
  model?: ModelInfo;
  fiveHour?: ProvenancedMetric<QuotaWindow>;
  sevenDay?: ProvenancedMetric<QuotaWindow>;
  estimatedApiCostUsd?: ProvenancedMetric<number>;
  contextWindow?: ContextWindowTelemetry;
  projectKey?: string;
  projectBasename?: string;
}

export type StoredEventType =
  | "quota_snapshot"
  | "prompt_lifecycle"
  | "tool_activity"
  | "subagent_activity"
  | "task_lifecycle"
  | "ingest_error";

export interface StoredEventBase {
  type: StoredEventType;
  capturedAt: string;
  ingestSource: "statusline" | "hook" | "cli";
}

export interface QuotaSnapshotEvent extends StoredEventBase {
  type: "quota_snapshot";
  sessionId?: string;
  promptId?: string;
  claudeVersion?: string;
  model?: ModelInfo;
  fiveHour?: QuotaWindow;
  sevenDay?: QuotaWindow;
  estimatedApiCostUsd?: number;
  contextWindow?: ContextWindowTelemetry;
  projectKey?: string;
  projectBasename?: string;
  provenance: "claude_reported";
  source: "claude_statusline";
}

export type PromptPhase = "start" | "stop" | "stop_failure";

export interface PromptLifecycleEvent extends StoredEventBase {
  type: "prompt_lifecycle";
  phase: PromptPhase;
  sessionId?: string;
  promptId?: string;
  hookEventName: string;
}

export interface ToolActivityEvent extends StoredEventBase {
  type: "tool_activity";
  phase: "pre" | "post" | "post_failure";
  sessionId?: string;
  promptId?: string;
  toolName?: string;
  toolUseId?: string;
  durationMs?: number;
}

export interface SubagentActivityEvent extends StoredEventBase {
  type: "subagent_activity";
  phase: "start" | "stop";
  sessionId?: string;
  promptId?: string;
  agentId?: string;
  agentType?: string;
}

export interface TaskLifecycleEvent extends StoredEventBase {
  type: "task_lifecycle";
  phase: "created" | "completed";
  sessionId?: string;
  promptId?: string;
  taskId?: string;
}

export interface IngestErrorEvent extends StoredEventBase {
  type: "ingest_error";
  reason: string;
}

export type StoredEvent =
  | QuotaSnapshotEvent
  | PromptLifecycleEvent
  | ToolActivityEvent
  | SubagentActivityEvent
  | TaskLifecycleEvent
  | IngestErrorEvent;

export interface PromptAttribution {
  promptId?: string;
  sessionId?: string;
  startedAt?: string;
  endedAt?: string;
  open: boolean;
  toolCallCount: number;
  subagentStartCount: number;
  taskCreatedCount: number;
  quotaDeltaFiveHour?: ProvenancedMetric<number>;
  quotaDeltaSevenDay?: ProvenancedMetric<number>;
  estimatedApiCostDelta?: ProvenancedMetric<number>;
  latestContextWindow?: ContextWindowTelemetry;
  exactPromptTokenConsumption: "unavailable";
  limitation: string;
}

export interface SessionSummary {
  sessionId?: string;
  promptsObserved: number;
  latestPrompt?: PromptAttribution;
  latestQuota?: QuotaSnapshot;
}
