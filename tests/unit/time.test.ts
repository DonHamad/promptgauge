import { describe, expect, it } from "vitest";
import { formatDuration, formatDurationUntil } from "../../src/utils/time.js";

describe("time formatting", () => {
  it("formats hours and minutes", () => {
    expect(formatDuration((1 * 3600 + 48 * 60) * 1000)).toBe("01h 48m");
  });

  it("formats days and hours", () => {
    expect(formatDuration((4 * 24 * 3600 + 7 * 3600) * 1000)).toBe("4d 07h");
  });

  it("marks elapsed resets", () => {
    const now = new Date("2026-09-16T04:00:00.000Z");
    const past = new Date("2026-09-16T03:00:00.000Z");
    expect(formatDurationUntil(past, now)).toBe("elapsed");
  });
});
