import type { IngestResult } from "../../claude/parsers/ingest.js";
import { ingestPayload } from "../../claude/parsers/ingest.js";
import { appendEvents } from "../../storage/jsonl.js";
import { formatPct } from "../../reporting/format.js";
import { epochSecondsToDate, formatDurationUntil } from "../../utils/time.js";
import type { QuotaSnapshotEvent } from "../../core/types.js";

export function collectFromStdin(
  raw: string,
  eventsFile: string,
  now: Date,
): { result: IngestResult; stdout: string } {
  const result = ingestPayload(raw, now.toISOString());
  appendEvents(eventsFile, result.events);
  if (!result.printStatusLine) {
    return { result, stdout: "" };
  }
  const snapshot = result.events.find((event) => event.type === "quota_snapshot");
  return { result, stdout: `${formatStatusLine(snapshot, now)}\n` };
}

function formatStatusLine(event: QuotaSnapshotEvent | undefined, now: Date): string {
  if (!event) {
    return "PromptGauge  Live subscription quota unavailable";
  }
  const parts = ["PromptGauge"];
  if (event.fiveHour) {
    parts.push(
      `5h ${formatPct(event.fiveHour.usedPercentage)}% ${formatDurationUntil(epochSecondsToDate(event.fiveHour.resetsAtEpochSeconds), now)}`,
    );
  } else {
    parts.push("5h unavailable");
  }
  if (event.sevenDay) {
    parts.push(
      `7d ${formatPct(event.sevenDay.usedPercentage)}% ${formatDurationUntil(epochSecondsToDate(event.sevenDay.resetsAtEpochSeconds), now)}`,
    );
  } else {
    parts.push("7d unavailable");
  }
  return parts.join("  ");
}
