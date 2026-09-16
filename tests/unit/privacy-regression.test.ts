import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ingestPayload } from "../../src/claude/parsers/ingest.js";
import { appendEvents, readEvents } from "../../src/storage/jsonl.js";

const dirs: string[] = [];

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pg-priv-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const SENTINELS = [
  "SUPER_SECRET_PROMPT_CONTENT_92841",
  "SUPER_SECRET_ASSISTANT_CONTENT_19284",
  String.raw`C:\Users\Private\SecretProject`,
];

describe("privacy regression", () => {
  it("never writes sentinel prompt, assistant, or path strings to persistent storage", () => {
    const dataDir = tempDir();
    const eventsFile = path.join(dataDir, "events.jsonl");
    const capturedAt = "2026-09-16T04:00:00.000Z";
    const payloads = [
      {
        hook_event_name: "UserPromptSubmit",
        session_id: "s",
        prompt_id: "p",
        prompt: "SUPER_SECRET_PROMPT_CONTENT_92841",
        transcript_path: String.raw`C:\Users\Private\SecretProject\session.jsonl`,
        cwd: String.raw`C:\Users\Private\SecretProject`,
      },
      {
        hook_event_name: "Stop",
        session_id: "s",
        prompt_id: "p",
        last_assistant_message: "SUPER_SECRET_ASSISTANT_CONTENT_19284",
        transcript_path: String.raw`C:\Users\Private\SecretProject\session.jsonl`,
        background_tasks: [
          {
            command: "cat C:\\Users\\Private\\SecretProject\\secrets.env",
            description: "SUPER_SECRET_PROMPT_CONTENT_92841",
          },
        ],
      },
      {
        session_id: "s",
        prompt_id: "p",
        transcript_path: String.raw`C:\Users\Private\SecretProject\session.jsonl`,
        cwd: String.raw`C:\Users\Private\SecretProject`,
        workspace: { project_dir: String.raw`C:\Users\Private\SecretProject` },
        rate_limits: { five_hour: { used_percentage: 1, resets_at: 1893456000 } },
      },
    ];
    for (const payload of payloads) {
      const ingested = ingestPayload(JSON.stringify(payload), capturedAt);
      appendEvents(eventsFile, ingested.events);
    }
    const disk = walkText(dataDir);
    for (const sentinel of SENTINELS) {
      expect(disk).not.toContain(sentinel);
    }
    const { events } = readEvents(eventsFile);
    expect(events.some((event) => event.type === "prompt_lifecycle")).toBe(true);
    expect(JSON.stringify(events)).not.toContain("transcript_path");
  });
});

function walkText(root: string): string {
  const parts: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      parts.push(walkText(full));
    } else {
      parts.push(fs.readFileSync(full, "utf8"));
    }
  }
  return parts.join("\n");
}
