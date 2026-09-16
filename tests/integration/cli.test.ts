import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/program.js";
import { readEvents } from "../../src/storage/jsonl.js";

const dirs: string[] = [];

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "promptgauge-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

async function run(
  argv: string[],
  options?: {
    stdin?: string;
    dataDir: string;
    now?: string;
    home?: string;
    env?: NodeJS.ProcessEnv;
  },
) {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let out = "";
  let err = "";
  stdout.on("data", (chunk) => {
    out += String(chunk);
  });
  stderr.on("data", (chunk) => {
    err += String(chunk);
  });
  const code = await runCli(argv, {
    stdin: new PassThrough(),
    stdout,
    stderr,
    env: { ...(options?.env ?? {}), PROMPTGAUGE_HOME: options?.dataDir },
    now: () => new Date(options?.now ?? "2026-09-16T04:00:00.000Z"),
    readStdin: async () => options?.stdin ?? "",
    nodeVersion: "v22.14.0",
    home: options?.home ?? options?.dataDir,
  });
  await new Promise((resolve) => setImmediate(resolve));
  return { code, out, err };
}

describe("collect + status integration", () => {
  it("persists a quota snapshot and prints it via status", async () => {
    const dataDir = tempDir();
    const fixture = fs.readFileSync(
      path.join(import.meta.dirname, "../fixtures/statusline-valid.json"),
      "utf8",
    );
    const collect = await run(
      ["collect", "--data-dir", dataDir, "--now", "2026-09-16T04:00:00.000Z"],
      {
        dataDir,
        stdin: fixture,
      },
    );
    expect(collect.code).toBe(0);
    expect(collect.out).toMatch(/5h 37%/);
    expect(collect.out).toMatch(/7d 21%/);

    const status = await run(
      ["status", "--data-dir", dataDir, "--now", "2026-09-16T04:00:00.000Z"],
      {
        dataDir,
      },
    );
    expect(status.out).toMatch(/PromptGauge/);
    expect(status.out).toMatch(/Claude Code integration: ACTIVE/);
    expect(status.out).toMatch(/Used:\s+37%/);
    expect(status.out).toMatch(/Used:\s+21%/);
    expect(status.out).toMatch(/Source:\s+Claude Code/);
    expect(status.out).toMatch(/ID:\s+prompt-valid-1/);
  });

  it("prints unavailable when Claude Code omits rate_limits", async () => {
    const dataDir = tempDir();
    const fixture = fs.readFileSync(
      path.join(import.meta.dirname, "../fixtures/statusline-missing-quota.json"),
      "utf8",
    );
    await run(["collect", "--data-dir", dataDir], { dataDir, stdin: fixture });
    const status = await run(["status", "--data-dir", dataDir], { dataDir });
    expect(status.out).toMatch(/5-hour quota: unavailable/);
    expect(status.out).toMatch(/7-day quota: unavailable/);
    expect(status.out).not.toMatch(/Used:\s+\d+%/);
  });

  it("does not persist prompt text from hooks", async () => {
    const dataDir = tempDir();
    const fixture = fs.readFileSync(
      path.join(import.meta.dirname, "../fixtures/hook-windows-prompt.json"),
      "utf8",
    );
    const collect = await run(["collect", "--data-dir", dataDir], { dataDir, stdin: fixture });
    expect(collect.out).toBe("");
    const eventsFile = path.join(dataDir, "events.jsonl");
    const disk = fs.readFileSync(eventsFile, "utf8");
    expect(disk).not.toContain("never be stored");
    const { events } = readEvents(eventsFile);
    expect(events[0]).toMatchObject({ type: "prompt_lifecycle", promptId: "prompt-win" });
  });

  it("never persists transcript_path, cwd, or raw status-line stdin", async () => {
    const dataDir = tempDir();
    const fixture = fs.readFileSync(
      path.join(import.meta.dirname, "../fixtures/statusline-full.json"),
      "utf8",
    );
    await run(["collect", "--data-dir", dataDir], { dataDir, stdin: fixture });
    const disk = fs.readFileSync(path.join(dataDir, "events.jsonl"), "utf8");
    expect(disk).not.toContain("transcript_path");
    expect(disk).not.toContain("/home/user/src/secret-app");
    expect(disk).not.toContain(fixture);
    expect(disk).toContain("session-full-1");
    const doctor = await run(["doctor", "--data-dir", dataDir], {
      dataDir,
      home: dataDir,
      env: { PROMPTGAUGE_FAKE_CLAUDE: "1" },
    });
    expect(doctor.out).toMatch(/Privacy\s+PASS/);
    expect(doctor.out).toMatch(/5-hour quota telemetry\s+PASS/);
    expect(doctor.out).toMatch(/Cost telemetry\s+PASS/);
    expect(doctor.out).toMatch(/Context token telemetry\s+PASS/);
  });

  it("skips corrupt local state and still reports remaining events", async () => {
    const dataDir = tempDir();
    fs.mkdirSync(dataDir, { recursive: true });
    fs.copyFileSync(
      path.join(import.meta.dirname, "../fixtures/corrupted-events.jsonl"),
      path.join(dataDir, "events.jsonl"),
    );
    const status = await run(["status", "--data-dir", dataDir], { dataDir });
    expect(status.code).toBe(0);
    expect(status.out).toMatch(/Prompts observed: 1/);
    const doctor = await run(["doctor", "--data-dir", dataDir], { dataDir, home: dataDir });
    expect(doctor.out).toMatch(/corrupt line/);
    expect(doctor.out).toMatch(/No credentials inspected/);
  });

  it("counts multiple prompts in one session", async () => {
    const dataDir = tempDir();
    for (const promptId of ["p-a", "p-b", "p-c", "p-d"]) {
      await run(["collect", "--data-dir", dataDir], {
        dataDir,
        stdin: JSON.stringify({
          hook_event_name: "UserPromptSubmit",
          session_id: "multi",
          prompt_id: promptId,
          prompt: "ignored",
        }),
      });
    }
    const status = await run(["status", "--data-dir", dataDir], { dataDir });
    expect(status.out).toMatch(/Prompts observed: 4/);
    expect(status.out).toMatch(/ID:\s+p-d/);
  });
});

describe("doctor", () => {
  it("fails when Claude Code is missing", async () => {
    const dataDir = tempDir();
    const doctor = await run(["doctor", "--data-dir", dataDir, "--simulate-missing-claude"], {
      dataDir,
      home: dataDir,
    });
    expect(doctor.out).toMatch(/Claude Code binary\s+FAIL/);
    expect(doctor.out).toMatch(/No credentials inspected/);
    expect(doctor.code).toBe(1);
  });

  it("passes node and local storage", async () => {
    const dataDir = tempDir();
    const doctor = await run(["doctor", "--data-dir", dataDir], {
      dataDir,
      home: dataDir,
      env: { PROMPTGAUGE_FAKE_CLAUDE: "1" },
    });
    expect(doctor.out).toMatch(/Node\s+PASS/);
    expect(doctor.out).toMatch(/Local storage\s+PASS/);
    expect(doctor.out).toMatch(/Permissions\s+PASS/);
    expect(doctor.out).toMatch(/5-hour quota telemetry\s+UNAVAILABLE/);
    expect(doctor.out).toMatch(/PromptGauge statusLine integration\s+WARN/);
  });
});

describe("cli flags", () => {
  it("prints help and version", async () => {
    const dataDir = tempDir();
    const help = await run(["--help"], { dataDir });
    expect(help.out).toMatch(/promptgauge status/);
    expect(help.out).toMatch(/hooks install/);
    expect(help.out).toMatch(/promptgauge prompts/);
    expect(help.out).toMatch(/pre-release/i);
    const version = await run(["--version"], { dataDir });
    expect(version.out).toMatch(/0\.3\.0/);
  });
});

describe("statusline installer CLI", () => {
  it("installs into an empty Claude config dir and is reversible", async () => {
    const dataDir = tempDir();
    const claudeDir = path.join(dataDir, "claude-config");
    const install = await run(["statusline", "install", "--data-dir", dataDir], {
      dataDir,
      home: dataDir,
      env: { CLAUDE_CONFIG_DIR: claudeDir, PROMPTGAUGE_FAKE_CLAUDE: "1" },
    });
    expect(install.code).toBe(0);
    const settings = JSON.parse(fs.readFileSync(path.join(claudeDir, "settings.json"), "utf8")) as {
      statusLine: { command: string };
    };
    expect(settings.statusLine.command).toMatch(/statusline run/);
    const again = await run(["statusline", "install", "--data-dir", dataDir], {
      dataDir,
      home: dataDir,
      env: { CLAUDE_CONFIG_DIR: claudeDir },
    });
    expect(again.out).toMatch(/already installed/i);
    const status = await run(["statusline", "status", "--data-dir", dataDir], {
      dataDir,
      home: dataDir,
      env: { CLAUDE_CONFIG_DIR: claudeDir },
    });
    expect(status.out).toMatch(/Wrapper:\s+installed/);
    const uninstall = await run(["statusline", "uninstall", "--data-dir", dataDir], {
      dataDir,
      home: dataDir,
      env: { CLAUDE_CONFIG_DIR: claudeDir },
    });
    expect(uninstall.code).toBe(0);
    const after = JSON.parse(fs.readFileSync(path.join(claudeDir, "settings.json"), "utf8")) as {
      statusLine?: unknown;
    };
    expect(after.statusLine).toBeUndefined();
  });

  it("refuses to overwrite corrupted settings JSON", async () => {
    const dataDir = tempDir();
    const claudeDir = path.join(dataDir, "claude-bad");
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, "settings.json"), "{ not json", "utf8");
    const install = await run(["statusline", "install", "--data-dir", dataDir], {
      dataDir,
      home: dataDir,
      env: { CLAUDE_CONFIG_DIR: claudeDir },
    });
    expect(install.code).toBe(1);
    expect(install.out).toMatch(/malformed/);
    expect(fs.readFileSync(path.join(claudeDir, "settings.json"), "utf8")).toBe("{ not json");
  });

  it("restores a previous statusLine exactly", async () => {
    const dataDir = tempDir();
    const claudeDir = path.join(dataDir, "claude-existing");
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, "settings.json"),
      `${JSON.stringify({ statusLine: { type: "command", command: "echo hi", padding: 2 } }, null, 2)}\n`,
      "utf8",
    );
    await run(["statusline", "install", "--data-dir", dataDir], {
      dataDir,
      home: dataDir,
      env: { CLAUDE_CONFIG_DIR: claudeDir },
    });
    await run(["statusline", "uninstall", "--data-dir", dataDir], {
      dataDir,
      home: dataDir,
      env: { CLAUDE_CONFIG_DIR: claudeDir },
    });
    const restored = JSON.parse(fs.readFileSync(path.join(claudeDir, "settings.json"), "utf8")) as {
      statusLine: { command: string; padding: number };
    };
    expect(restored.statusLine).toEqual({ type: "command", command: "echo hi", padding: 2 });
  });
});

describe("hooks installer CLI", () => {
  it("installs UserPromptSubmit and Stop without dropping other hooks", async () => {
    const dataDir = tempDir();
    const claudeDir = path.join(dataDir, "claude-hooks");
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, "settings.json"),
      `${JSON.stringify({
        hooks: {
          PreToolUse: [{ hooks: [{ type: "command", command: "echo other" }] }],
          Stop: [{ hooks: [{ type: "command", command: "echo mine" }] }],
        },
      })}\n`,
      "utf8",
    );
    const install = await run(["hooks", "install", "--data-dir", dataDir], {
      dataDir,
      home: dataDir,
      env: { CLAUDE_CONFIG_DIR: claudeDir },
    });
    expect(install.code).toBe(0);
    const again = await run(["hooks", "install", "--data-dir", dataDir], {
      dataDir,
      home: dataDir,
      env: { CLAUDE_CONFIG_DIR: claudeDir },
    });
    expect(again.out).toMatch(/already installed/i);
    await run(["hooks", "uninstall", "--data-dir", dataDir], {
      dataDir,
      home: dataDir,
      env: { CLAUDE_CONFIG_DIR: claudeDir },
    });
    const restored = JSON.parse(fs.readFileSync(path.join(claudeDir, "settings.json"), "utf8")) as {
      hooks: { PreToolUse: unknown[]; Stop: { hooks: { command: string }[] }[] };
    };
    expect(restored.hooks.PreToolUse).toHaveLength(1);
    expect(restored.hooks.Stop).toHaveLength(1);
    expect(restored.hooks.Stop[0]?.hooks[0]?.command).toBe("echo mine");
  });

  it("refuses corrupted settings", async () => {
    const dataDir = tempDir();
    const claudeDir = path.join(dataDir, "claude-hooks-bad");
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, "settings.json"), "{ no", "utf8");
    const install = await run(["hooks", "install", "--data-dir", dataDir], {
      dataDir,
      home: dataDir,
      env: { CLAUDE_CONFIG_DIR: claudeDir },
    });
    expect(install.code).toBe(1);
    expect(fs.readFileSync(path.join(claudeDir, "settings.json"), "utf8")).toBe("{ no");
  });
});

describe("prompts command", () => {
  it("prints completed prompts without prompt text", async () => {
    const dataDir = tempDir();
    await run(["collect", "--data-dir", dataDir], {
      dataDir,
      stdin: JSON.stringify({
        hook_event_name: "UserPromptSubmit",
        session_id: "s",
        prompt_id: "prompt-abc123",
        prompt: "SUPER_SECRET_PROMPT_CONTENT_92841",
      }),
    });
    await run(["collect", "--data-dir", dataDir], {
      dataDir,
      stdin: JSON.stringify({
        hook_event_name: "Stop",
        session_id: "s",
        prompt_id: "prompt-abc123",
        last_assistant_message: "SUPER_SECRET_ASSISTANT_CONTENT_19284",
      }),
    });
    const out = await run(["prompts", "--limit", "10", "--data-dir", dataDir], { dataDir });
    expect(out.out).toMatch(/PromptGauge — Recent Prompts/);
    expect(out.out).toMatch(/c123/);
    expect(out.out).not.toContain("SUPER_SECRET_PROMPT_CONTENT_92841");
    expect(out.out).not.toContain("SUPER_SECRET_ASSISTANT_CONTENT_19284");
  });

  it("prints an empty-state when no completed prompts exist", async () => {
    const dataDir = tempDir();
    const out = await run(["prompts", "--data-dir", dataDir], { dataDir });
    expect(out.out).toMatch(/No completed prompt records yet/);
  });
});
