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
    expect(doctor.out).toMatch(/Claude Code detected\s+FAIL/);
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
  });
});

describe("cli flags", () => {
  it("prints help and version", async () => {
    const dataDir = tempDir();
    const help = await run(["--help"], { dataDir });
    expect(help.out).toMatch(/promptgauge status/);
    expect(help.out).toMatch(/pre-release/i);
    const version = await run(["--version"], { dataDir });
    expect(version.out).toMatch(/0\.1\.0/);
  });
});
