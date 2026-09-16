import fs from "node:fs";
import type { StoredEvent } from "../core/types.js";
import { parseJson } from "../utils/json.js";
import { assertNoForbiddenFields } from "../claude/sanitizer.js";
import { ensureDataDir } from "./paths.js";

export interface ReadEventsResult {
  events: StoredEvent[];
  skippedCorruptLines: number;
}

export function appendEvents(eventsFile: string, events: StoredEvent[]): void {
  if (events.length === 0) {
    return;
  }
  ensureDataDir(pathDirname(eventsFile));
  const lines = events
    .map((event) => {
      assertNoForbiddenFields(event as unknown as Record<string, unknown>);
      return JSON.stringify(event);
    })
    .join("\n");
  fs.appendFileSync(eventsFile, `${lines}\n`, { encoding: "utf8" });
}

export function readEvents(eventsFile: string): ReadEventsResult {
  if (!fs.existsSync(eventsFile)) {
    return { events: [], skippedCorruptLines: 0 };
  }
  const text = fs.readFileSync(eventsFile, "utf8");
  if (text.trim().length === 0) {
    return { events: [], skippedCorruptLines: 0 };
  }
  const events: StoredEvent[] = [];
  let skippedCorruptLines = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim().length === 0) {
      continue;
    }
    const parsed = parseJson(line);
    if (!parsed.ok || !isStoredEvent(parsed.value)) {
      skippedCorruptLines += 1;
      continue;
    }
    events.push(parsed.value);
  }
  return { events, skippedCorruptLines };
}

function pathDirname(filePath: string): string {
  const idx = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  return idx === -1 ? "." : filePath.slice(0, idx);
}

function isStoredEvent(value: unknown): value is StoredEvent {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as { type?: unknown; capturedAt?: unknown };
  return typeof record.type === "string" && typeof record.capturedAt === "string";
}
