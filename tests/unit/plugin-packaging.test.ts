import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

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

describe("plugin packaging", () => {
  it("builds a runnable runtime and agrees on versions", () => {
    buildPlugin();
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
      version: string;
    };
    const pluginJson = JSON.parse(
      fs.readFileSync(path.join(pluginRoot, ".claude-plugin", "plugin.json"), "utf8"),
    ) as { version: string; name: string };
    expect(pluginJson.version).toBe(packageJson.version);
    expect(pluginJson.version).toBe("0.4.0");
    expect(fs.existsSync(runtime)).toBe(true);
    const version = spawnSync(process.execPath, [runtime, "--version"], { encoding: "utf8" });
    expect(version.status).toBe(0);
    expect(version.stdout.trim()).toBe("0.4.0");
  });

  it("marketplace metadata resolves the plugin source", () => {
    const marketplace = JSON.parse(
      fs.readFileSync(path.join(root, ".claude-plugin", "marketplace.json"), "utf8"),
    ) as { name: string; plugins: { name: string; source: string; version?: string }[] };
    expect(marketplace.name).toBe("promptgauge");
    expect(marketplace.plugins[0]?.name).toBe("promptgauge");
    expect(marketplace.plugins[0]?.source).toBe("./plugin");
    expect(marketplace.plugins[0]?.version).toBe("0.4.0");
    expect(fs.existsSync(path.join(pluginRoot, ".claude-plugin", "plugin.json"))).toBe(true);
  });

  it("quotes plugin hook commands and uses CLAUDE_PLUGIN_ROOT", () => {
    const hooks = JSON.parse(
      fs.readFileSync(path.join(pluginRoot, "hooks", "hooks.json"), "utf8"),
    ) as {
      hooks: Record<string, { hooks: { command: string }[] }[]>;
    };
    for (const event of ["UserPromptSubmit", "Stop", "StopFailure"]) {
      const command = hooks.hooks[event]?.[0]?.hooks[0]?.command ?? "";
      expect(command).toContain('"${CLAUDE_PLUGIN_ROOT}/runtime/promptgauge.cjs"');
      expect(command).not.toContain("\\");
      expect(command).toContain("collect --pg-hook");
    }
  });

  it("ships slash-command skills that call the plugin CLI", () => {
    const expected: Record<string, string> = {
      setup: "promptgauge setup",
      status: "promptgauge status --simple",
      doctor: "promptgauge doctor --simple",
      uninstall: "promptgauge uninstall",
    };
    for (const [skill, command] of Object.entries(expected)) {
      const text = fs.readFileSync(path.join(pluginRoot, "skills", skill, "SKILL.md"), "utf8");
      expect(text).toContain("disable-model-invocation: true");
      expect(text).toContain(command);
    }
  });
});

describe("plugin runtime from paths with spaces", () => {
  it("collects hook events when the plugin path contains spaces", () => {
    buildPlugin();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "prompt gauge "));
    const spaced = path.join(dir, "Prompt Gauge Plugin");
    fs.cpSync(pluginRoot, spaced, { recursive: true });
    const spacedRuntime = path.join(spaced, "runtime", "promptgauge.cjs");
    const dataDir = path.join(dir, "data");
    const result = spawnSync(
      process.execPath,
      [spacedRuntime, "collect", "--pg-hook", "--data-dir", dataDir],
      {
        encoding: "utf8",
        input: JSON.stringify({
          hook_event_name: "UserPromptSubmit",
          session_id: "s",
          prompt_id: "p-space",
          prompt: "SECRET_PROMPT_TEXT",
        }),
      },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    const events = fs.readFileSync(path.join(dataDir, "events.jsonl"), "utf8");
    expect(events).toContain("prompt_lifecycle");
    expect(events).not.toContain("SECRET_PROMPT_TEXT");

    const hooks = JSON.parse(
      fs.readFileSync(path.join(pluginRoot, "hooks", "hooks.json"), "utf8"),
    ) as {
      hooks: Record<string, { hooks: { command: string }[] }[]>;
    };
    const template = hooks.hooks.UserPromptSubmit?.[0]?.hooks[0]?.command ?? "";
    const posixRoot = spaced.replaceAll("\\", "/");
    const expanded = template.replaceAll("${CLAUDE_PLUGIN_ROOT}", posixRoot);
    expect(expanded).toContain(`"${posixRoot}/runtime/promptgauge.cjs"`);
    const viaHookCommand = spawnSync(expanded, {
      encoding: "utf8",
      shell: true,
      input: JSON.stringify({
        hook_event_name: "Stop",
        session_id: "s",
        prompt_id: "p-space",
      }),
      env: {
        ...process.env,
        PROMPTGAUGE_HOME: dataDir,
        CLAUDE_PLUGIN_ROOT: posixRoot,
        HOME: dataDir,
        USERPROFILE: dataDir,
      },
    });
    expect(viaHookCommand.status).toBe(0);
    expect(viaHookCommand.stdout).toBe("");
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
