import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ingestPayload } from "../../src/claude/parsers/ingest.js";
import { parseStatusLine } from "../../src/claude/parsers/statusline.js";

const capturedAt = "2026-09-16T04:00:00.000Z";
const fixtures = path.join(import.meta.dirname, "../fixtures");

function readJson(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(fixtures, name), "utf8")) as unknown;
}

describe("status line parser", () => {
  it("parses a valid quota snapshot", () => {
    const result = parseStatusLine(readJson("statusline-valid.json"), capturedAt);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.event.fiveHour?.usedPercentage).toBe(37);
    expect(result.event.sevenDay?.usedPercentage).toBe(21);
    expect(result.event.provenance).toBe("claude_reported");
    expect(result.event.source).toBe("claude_statusline");
    expect(result.promptId).toBe("prompt-valid-1");
  });

  it("treats missing rate_limits as unavailable rather than fabricating values", () => {
    const result = parseStatusLine(readJson("statusline-missing-quota.json"), capturedAt);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.event.fiveHour).toBeUndefined();
    expect(result.event.sevenDay).toBeUndefined();
  });

  it("rejects malformed JSON at ingest", () => {
    const raw = fs.readFileSync(
      path.join(import.meta.dirname, "../fixtures/statusline-malformed.json"),
      "utf8",
    );
    const result = ingestPayload(raw, capturedAt);
    expect(result.error).toBe("malformed JSON");
    expect(result.events[0]?.type).toBe("ingest_error");
  });

  it("accepts windows and unix transcript paths without storing them", () => {
    const windows = parseStatusLine(
      {
        session_id: "s",
        transcript_path: "C:\\Users\\Hamad\\.claude\\projects\\app\\t.jsonl",
        rate_limits: { five_hour: { used_percentage: 10, resets_at: 1893456000 } },
      },
      capturedAt,
    );
    const unix = parseStatusLine(
      {
        session_id: "s",
        transcript_path: "/home/user/.claude/projects/app/t.jsonl",
        rate_limits: { five_hour: { used_percentage: 10, resets_at: 1893456000 } },
      },
      capturedAt,
    );
    expect(windows.ok).toBe(true);
    expect(unix.ok).toBe(true);
    if (windows.ok) {
      expect(JSON.stringify(windows.event)).not.toMatch(/Users\\\\Hamad/);
      expect("transcript_path" in windows.event).toBe(false);
    }
  });

  it("captures cost and context without storing raw paths", () => {
    const full = readJson("statusline-full.json");
    const result = parseStatusLine(full, capturedAt);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.event.estimatedApiCostUsd).toBe(0.01234);
    expect(result.event.contextWindow?.usedPercentage).toBe(8);
    expect(result.event.contextWindow?.currentUsage?.cacheReadInputTokens).toBe(2000);
    expect(result.event.model?.displayName).toBe("Opus");
    expect(JSON.stringify(result.event)).not.toContain("transcript_path");
  });

  it("allows five_hour or seven_day independently", () => {
    const fiveOnly = parseStatusLine(
      { rate_limits: { five_hour: { used_percentage: 11, resets_at: 1893456000 } } },
      capturedAt,
    );
    const sevenOnly = parseStatusLine(
      { rate_limits: { seven_day: { used_percentage: 22, resets_at: 1893456000 } } },
      capturedAt,
    );
    expect(fiveOnly.ok && fiveOnly.event.fiveHour?.usedPercentage).toBe(11);
    expect(fiveOnly.ok && fiveOnly.event.sevenDay).toBeUndefined();
    expect(sevenOnly.ok && sevenOnly.event.sevenDay?.usedPercentage).toBe(22);
    expect(sevenOnly.ok && sevenOnly.event.fiveHour).toBeUndefined();
  });

  it("treats null current_usage as omitted, not zero", () => {
    const result = parseStatusLine(
      { context_window: { used_percentage: 4, current_usage: null } },
      capturedAt,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.event.contextWindow?.usedPercentage).toBe(4);
      expect(result.event.contextWindow?.currentUsage).toBeUndefined();
    }
  });

  it("parses spend_limit above 100 and allowlisted prompt_cache fields", () => {
    const result = parseStatusLine(
      {
        session_id: "s",
        prompt_id: "p",
        rate_limits: {
          spend_limit: { used_percentage: 110.5, resets_at: 1893456000 },
        },
        prompt_cache: {
          warm: true,
          caching_observed: true,
          ttl: "1h",
          expires_at: 1738429200,
          requests: 14,
          misses: 2,
          expected_rebuilds: 1,
          hit_ratio: 0.91,
          cache_write_tokens: 352000,
          miss_recache_tokens: 310200,
          recache_tokens_if_cold: 45000,
          last_miss_cause: { causes: ["tools_changed"], tools_added: 2 },
          miss_causes: { tools_changed: 2 },
        },
      },
      capturedAt,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.event.spendLimit?.usedPercentage).toBe(110.5);
    expect(result.event.promptCache?.hitRatio).toBe(0.91);
    expect(result.event.promptCache?.ttl).toBe("1h");
    const json = JSON.stringify(result.event);
    expect(json).not.toContain("last_miss_cause");
    expect(json).not.toContain("miss_causes");
    expect(json).not.toContain("tools_changed");
  });

  it("treats five_hour over 100 as unavailable while still accepting spend_limit over 100", () => {
    const result = parseStatusLine(
      { rate_limits: { five_hour: { used_percentage: 140, resets_at: 1893456000 } } },
      capturedAt,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.event.fiveHour).toBeUndefined();
    }
  });
});
