import type { StoredEvent } from "../../core/types.js";
import { isRecord, parseJson } from "../../utils/json.js";
import { parseHook, looksLikeHook } from "./hooks.js";
import { looksLikeStatusLine, parseStatusLine } from "./statusline.js";

export type IngestKind = "statusline" | "hook" | "unknown";

export interface IngestResult {
  kind: IngestKind;
  events: StoredEvent[];
  error?: string;
  printStatusLine: boolean;
}

export function ingestPayload(raw: string, capturedAt: string): IngestResult {
  const parsed = parseJson(raw);
  if (!parsed.ok) {
    return {
      kind: "unknown",
      printStatusLine: false,
      events: [
        {
          type: "ingest_error",
          capturedAt,
          ingestSource: "cli",
          reason: parsed.error,
        },
      ],
      error: parsed.error,
    };
  }
  if (!isRecord(parsed.value)) {
    return {
      kind: "unknown",
      printStatusLine: false,
      events: [
        {
          type: "ingest_error",
          capturedAt,
          ingestSource: "cli",
          reason: "payload is not a JSON object",
        },
      ],
      error: "payload is not a JSON object",
    };
  }

  if (looksLikeHook(parsed.value)) {
    const hook = parseHook(parsed.value, capturedAt);
    if (!hook.ok) {
      return {
        kind: "hook",
        printStatusLine: false,
        events: [
          {
            type: "ingest_error",
            capturedAt,
            ingestSource: "hook",
            reason: hook.error,
          },
        ],
        error: hook.error,
      };
    }
    return { kind: "hook", printStatusLine: false, events: hook.events };
  }

  if (looksLikeStatusLine(parsed.value)) {
    const status = parseStatusLine(parsed.value, capturedAt);
    if (!status.ok) {
      return {
        kind: "statusline",
        printStatusLine: true,
        events: [
          {
            type: "ingest_error",
            capturedAt,
            ingestSource: "statusline",
            reason: status.error,
          },
        ],
        error: status.error,
      };
    }
    return { kind: "statusline", printStatusLine: true, events: [status.event] };
  }

  return {
    kind: "unknown",
    printStatusLine: false,
    events: [
      {
        type: "ingest_error",
        capturedAt,
        ingestSource: "cli",
        reason: "unrecognized payload",
      },
    ],
    error: "unrecognized payload",
  };
}
