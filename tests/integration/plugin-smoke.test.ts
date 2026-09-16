import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { locateClaudeBinary } from "../../src/utils/platform.js";

function findClaudeCli(): string | undefined {
  const probe = locateClaudeBinary();
  if (probe.found && probe.path) {
    return probe.path;
  }
  const cache = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "npm-cache", "_npx")
    : "";
  if (!cache || !fs.existsSync(cache)) {
    return undefined;
  }
  for (const rel of fs.globSync("**/claude.exe", { cwd: cache })) {
    if (rel.replaceAll("\\", "/").includes("@anthropic-ai/claude-code/bin/claude.exe")) {
      return path.join(cache, rel);
    }
  }
  return undefined;
}

const root = path.resolve(import.meta.dirname, "../..");
const pluginRoot = path.join(root, "plugin");
const runtime = path.join(pluginRoot, "runtime", "promptgauge.cjs");

function buildPlugin() {
  const result = spawnSync(process.execPath, [path.join(root, "scripts", "build-plugin.mjs")], {
    encoding: "utf8",
    cwd: root,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "plugin build failed");
  }
}

function runRuntime(
  args: string[],
  options: { dataDir: string; claudeDir: string; home: string; input?: string },
) {
  return spawnSync(process.execPath, [runtime, ...args], {
    encoding: "utf8",
    cwd: root,
    input: options.input,
    env: {
      ...process.env,
      PROMPTGAUGE_HOME: options.dataDir,
      CLAUDE_CONFIG_DIR: options.claudeDir,
      CLAUDE_PLUGIN_ROOT: pluginRoot,
      HOME: options.home,
      USERPROFILE: options.home,
      PROMPTGAUGE_FAKE_CLAUDE: "1",
    },
  });
}

describe("plugin package smoke test", () => {
  it("loads setup, status, and doctor from the bundled runtime", () => {
    buildPlugin();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "promptgauge-smoke-"));
    const dataDir = path.join(home, "data");
    const claudeDir = path.join(home, "claude-config");
    try {
      const setup = runRuntime(["setup"], { dataDir, claudeDir, home });
      expect(setup.status).toBe(0);
      expect(setup.stdout).toMatch(/PromptGauge is ready/);
      expect(setup.stdout).toMatch(/Hooks\s+Active/);
      expect(setup.stdout).toMatch(/Status line\s+Active/);
      expect(setup.stdout).not.toContain(claudeDir);

      const status = runRuntime(["status", "--simple"], { dataDir, claudeDir, home });
      expect(status.status).toBe(0);
      expect(status.stdout).toMatch(/Monitoring/);
      expect(status.stdout).toMatch(/5h usage\s+Unavailable/);

      const doctor = runRuntime(["doctor", "--simple"], { dataDir, claudeDir, home });
      expect(doctor.stdout).toMatch(/Plugin\s+PASS/);
      expect(doctor.stdout).toMatch(/Hooks\s+PASS/);
      expect(doctor.stdout).toMatch(/Status line\s+PASS/);
      expect(doctor.stdout).toMatch(/Storage\s+PASS/);

      const uninstall = runRuntime(["uninstall"], { dataDir, claudeDir, home });
      expect(uninstall.status).toBe(0);
      expect(uninstall.stdout).toMatch(/History\s+Kept/);
      const settings = JSON.parse(
        fs.readFileSync(path.join(claudeDir, "settings.json"), "utf8"),
      ) as { statusLine?: unknown };
      expect(settings.statusLine).toBeUndefined();
      expect(fs.existsSync(path.join(dataDir, "config.json"))).toBe(true);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it("accepts the plugin and marketplace with claude plugin validate when Claude Code is available", () => {
    buildPlugin();
    const claudePath = findClaudeCli();
    if (!claudePath) {
      return;
    }
    const plugin = spawnSync(claudePath, ["plugin", "validate", pluginRoot], {
      encoding: "utf8",
      cwd: root,
      timeout: 20_000,
      windowsHide: true,
      shell: process.platform === "win32",
    });
    const marketplace = spawnSync(claudePath, ["plugin", "validate", root], {
      encoding: "utf8",
      cwd: root,
      timeout: 20_000,
      windowsHide: true,
      shell: process.platform === "win32",
    });
    const pluginOut = `${plugin.stdout}\n${plugin.stderr}`;
    const marketOut = `${marketplace.stdout}\n${marketplace.stderr}`;
    if (/not logged|auth|login required|authentication/i.test(pluginOut + marketOut)) {
      return;
    }
    expect(plugin.status, pluginOut).toBe(0);
    expect(pluginOut).toMatch(/Validation passed/i);
    expect(marketplace.status, marketOut).toBe(0);
    expect(marketOut).toMatch(/Validation passed/i);
  });

  it("installs from a local marketplace into an isolated Claude config", () => {
    buildPlugin();
    const claudePath = findClaudeCli();
    if (!claudePath) {
      return;
    }
    const isolated = fs.mkdtempSync(path.join(os.tmpdir(), "promptgauge-claude-"));
    const env = { ...process.env, CLAUDE_CONFIG_DIR: isolated };
    const spawnOpts = {
      encoding: "utf8" as const,
      cwd: root,
      timeout: 20_000,
      windowsHide: true,
      shell: process.platform === "win32",
      env,
    };
    try {
      const add = spawnSync(
        claudePath,
        ["plugin", "marketplace", "add", root, "--scope", "user"],
        spawnOpts,
      );
      expect(add.status, `${add.stdout}\n${add.stderr}`).toBe(0);
      const install = spawnSync(
        claudePath,
        ["plugin", "install", "promptgauge@promptgauge", "-s", "user", "--json"],
        spawnOpts,
      );
      expect(install.status, `${install.stdout}\n${install.stderr}`).toBe(0);
      expect(`${install.stdout}${install.stderr}`).toMatch(
        /Successfully installed plugin: promptgauge@promptgauge/,
      );
      const cachedRuntime = path.join(
        isolated,
        "plugins",
        "cache",
        "promptgauge",
        "promptgauge",
        "0.4.0",
        "runtime",
        "promptgauge.cjs",
      );
      expect(fs.existsSync(cachedRuntime)).toBe(true);
      expect(
        fs.existsSync(
          path.join(
            isolated,
            "plugins",
            "cache",
            "promptgauge",
            "promptgauge",
            "0.4.0",
            "hooks",
            "hooks.json",
          ),
        ),
      ).toBe(true);
    } finally {
      fs.rmSync(isolated, { recursive: true, force: true });
    }
  });
});
