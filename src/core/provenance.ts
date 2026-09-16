import type { DisplayProvenance, MetricProvenance } from "./types.js";

export function displayProvenance(provenance: MetricProvenance): DisplayProvenance {
  switch (provenance) {
    case "claude_reported":
      return "CLAUDE_REPORTED";
    case "claude_reported_estimate":
      return "CLAUDE_REPORTED_ESTIMATE";
    case "derived":
      return "DERIVED";
    case "derived_from_claude_reported_session_cost":
      return "DERIVED_FROM_CLAUDE_REPORTED_SESSION_COST";
    case "estimated":
      return "ESTIMATED";
    case "transcript_observed":
      return "DERIVED";
  }
}
