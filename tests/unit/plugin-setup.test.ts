import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/program.js";

const dirs: string[] = [];
const pluginRoot = path.resolve(import.meta.dirname, "../../plugin");

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "promptgauge-setup-"));
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
  options: { dataDir: string; home?: string; env?: NodeJS.ProcessEnv; cliEntry?: string },
) {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let out = "";
  stdout.on("data", (chunk) => {
    out += String(chunk);
  });
  stderr.on("data", () => undefined);
  const code = await runCli(argv, {
    stdin: new PassThrough(),
    stdout,
    stderr,
    env: {
      ...(options.env ?? {}),
      PROMPTGAUGE_HOME: options.dataDir,
      CLAUDE_PLUGIN_ROOT: pluginRoot,
    },
    now: () => new Date("2026-09-16T04:00:00.000Z"),
    nodeVersion: "v22.14.0",
    home: options.home ?? options.dataDir,
    cliEntry: options.cliEntry ?? path.join(pluginRoot, "runtime", "promptgauge.cjs"),
  });
  await new Promise((resolve) => setImmediate(resolve));
  return { code, out };
}

describe("plugin setup", () => {
  it("installs a status line on a clean Claude config", async () => {
    const dataDir = tempDir();
    const claudeDir = path.join(dataDir, "claude-config");
    const result = await run(["setup"], {
      dataDir,
      env: { CLAUDE_CONFIG_DIR: claudeDir },
    });
    expect(result.code).toBe(0);
    expect(result.out).toMatch(/PromptGauge is ready/);
    expect(result.out).toMatch(/Status line {2}Active/);
    expect(result.out).not.toContain(claudeDir);
    expect(result.out).not.toContain("settings.json");
    const settings = JSON.parse(fs.readFileSync(path.join(claudeDir, "settings.json"), "utf8")) as {
      statusLine: { command: string };
    };
    expect(settings.statusLine.command).toMatch(/statusline run/);
  });

  it("preserves an existing statusLine and is idempotent", async () => {
    const dataDir = tempDir();
    const claudeDir = path.join(dataDir, "claude-existing");
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, "settings.json"),
      `${JSON.stringify({ statusLine: { type: "command", command: "echo previous" } }, null, 2)}\n`,
    );
    const first = await run(["setup"], { dataDir, env: { CLAUDE_CONFIG_DIR: claudeDir } });
    expect(first.out).toMatch(/PromptGauge is ready/);
    const second = await run(["setup"], { dataDir, env: { CLAUDE_CONFIG_DIR: claudeDir } });
    expect(second.code).toBe(0);
    expect(second.out).toMatch(/PromptGauge is ready/);
    const cleanup = await run(["uninstall"], { dataDir, env: { CLAUDE_CONFIG_DIR: claudeDir } });
    expect(cleanup.code).toBe(0);
    const restored = JSON.parse(fs.readFileSync(path.join(claudeDir, "settings.json"), "utf8")) as {
      statusLine: { command: string };
    };
    expect(restored.statusLine.command).toBe("echo previous");
  });

  it("refuses corrupted settings", async () => {
    const dataDir = tempDir();
    const claudeDir = path.join(dataDir, "claude-bad");
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, "settings.json"), "{ not json", "utf8");
    const result = await run(["setup"], { dataDir, env: { CLAUDE_CONFIG_DIR: claudeDir } });
    expect(result.code).toBe(1);
    expect(result.out).toMatch(/not valid JSON/i);
    expect(fs.readFileSync(path.join(claudeDir, "settings.json"), "utf8")).toBe("{ not json");
  });

  it("handles a Claude config path with spaces", async () => {
    const dataDir = tempDir();
    const claudeDir = path.join(dataDir, "Claude Settings");
    const result = await run(["setup"], { dataDir, env: { CLAUDE_CONFIG_DIR: claudeDir } });
    expect(result.code).toBe(0);
    expect(fs.existsSync(path.join(claudeDir, "settings.json"))).toBe(true);
  });

  it("prints beginner status and doctor after setup", async () => {
    const dataDir = tempDir();
    const claudeDir = path.join(dataDir, "claude-config");
    await run(["setup"], { dataDir, env: { CLAUDE_CONFIG_DIR: claudeDir } });
    const status = await run(["status", "--simple"], {
      dataDir,
      env: { CLAUDE_CONFIG_DIR: claudeDir },
    });
    expect(status.out).toMatch(/5h usage\s+Unavailable/);
    expect(status.out).toMatch(/7d usage\s+Unavailable/);
    expect(status.out).not.toMatch(/CLAUDE_REPORTED/);
    const doctor = await run(["doctor", "--simple"], {
      dataDir,
      env: { CLAUDE_CONFIG_DIR: claudeDir, PROMPTGAUGE_FAKE_CLAUDE: "1" },
    });
    expect(doctor.out).toMatch(/Status line\s+PASS/);
    expect(doctor.out).toMatch(/Hooks\s+PASS/);
    expect(doctor.out).not.toMatch(/NEEDS SETUP/);
  });
});
