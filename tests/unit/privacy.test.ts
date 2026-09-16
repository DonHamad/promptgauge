import { describe, expect, it } from "vitest";
import { parseStatusLine } from "../../src/claude/parsers/statusline.js";
import { findForbiddenKeys } from "../../src/core/privacy/allowlist.js";
import { projectIdentityFromPath } from "../../src/core/privacy/project-id.js";
import fs from "node:fs";
import path from "node:path";

describe("privacy allowlist", () => {
  it("never persists transcript_path, cwd, or prompt text from a full status payload", () => {
    const raw = JSON.parse(
      fs.readFileSync(path.join(import.meta.dirname, "../fixtures/statusline-full.json"), "utf8"),
    ) as unknown;
    const parsed = parseStatusLine(raw, "2026-09-16T04:00:00.000Z");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const json = JSON.stringify(parsed.event);
    expect(json).not.toContain("transcript_path");
    expect(json).not.toContain("/home/user/.claude/projects/secret-app");
    expect(json).not.toContain("/home/user/src/secret-app");
    expect(json).not.toContain("secret-app/session");
    expect(findForbiddenKeys(parsed.event)).toEqual([]);
    expect(parsed.event.projectBasename).toBe("secret-app");
    expect(parsed.event.projectKey).toBe(
      projectIdentityFromPath("/home/user/src/secret-app").projectKey,
    );
  });

  it("hashes windows and unix project paths without storing them", () => {
    const win = projectIdentityFromPath("C:\\Users\\Hamad\\Desktop\\My App");
    const unix = projectIdentityFromPath("/Users/hamad/Desktop/My App");
    expect(win.projectBasename).toBe("My App");
    expect(unix.projectBasename).toBe("My App");
    expect(win.projectKey).not.toBe(unix.projectKey);
    expect(win.projectKey).toMatch(/^[a-f0-9]{16}$/);
  });
});
