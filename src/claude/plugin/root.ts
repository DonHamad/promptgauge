import fs from "node:fs";
import path from "node:path";

export function detectPluginRoot(
  env: NodeJS.ProcessEnv = process.env,
  cliEntry?: string,
): string | undefined {
  const fromEnv = env.CLAUDE_PLUGIN_ROOT?.trim();
  if (fromEnv && isPluginRoot(fromEnv)) {
    return path.resolve(fromEnv);
  }
  let dir = cliEntry ? path.dirname(path.resolve(cliEntry)) : undefined;
  for (let i = 0; i < 5 && dir; i += 1) {
    if (isPluginRoot(dir)) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return undefined;
}

export function isPluginRoot(dir: string): boolean {
  return fs.existsSync(path.join(dir, ".claude-plugin", "plugin.json"));
}

export function pluginRuntimePath(pluginRoot: string): string {
  return path.join(pluginRoot, "runtime", "promptgauge.cjs");
}

export function pluginHasRuntime(pluginRoot: string): boolean {
  return fs.existsSync(pluginRuntimePath(pluginRoot));
}

export function pluginHasNativeHooks(pluginRoot: string): boolean {
  const file = path.join(pluginRoot, "hooks", "hooks.json");
  if (!fs.existsSync(file)) {
    return false;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as {
      hooks?: Record<string, unknown>;
    };
    return Boolean(parsed.hooks?.UserPromptSubmit && parsed.hooks?.Stop);
  } catch {
    return false;
  }
}
