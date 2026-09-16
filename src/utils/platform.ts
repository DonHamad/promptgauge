import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function isWindows(platform = process.platform): boolean {
  return platform === "win32";
}

export function normalizePathForCompare(filePath: string): string {
  return path.normalize(filePath).replaceAll("\\", "/");
}

export function defaultHomeDir(): string {
  return os.homedir();
}

export function claudeConfigDir(home = defaultHomeDir()): string {
  return path.join(home, ".claude");
}

export function quoteShellArg(arg: string): string {
  if (arg.length === 0) {
    return '""';
  }
  if (!/[ \t"']/.test(arg)) {
    return arg;
  }
  return `"${arg.replaceAll('"', '\\"')}"`;
}

export interface ClaudeBinaryProbe {
  found: boolean;
  ok?: boolean;
  version?: string;
  path?: string;
}

export function locateClaudeBinary(
  env: NodeJS.ProcessEnv = process.env,
  home = defaultHomeDir(),
): ClaudeBinaryProbe {
  const fromPath = spawnSync("claude", ["--version"], {
    encoding: "utf8",
    timeout: 4000,
    windowsHide: true,
    env,
  });
  if (fromPath.status === 0) {
    return {
      found: true,
      version: (fromPath.stdout || fromPath.stderr).trim().split(/\r?\n/)[0],
      path: "claude",
    };
  }

  const candidates = [
    path.join(home, "AppData", "Roaming", "npm", "claude.cmd"),
    path.join(home, "AppData", "Roaming", "npm", "claude"),
    path.join(home, "AppData", "Roaming", "npm", "claude.exe"),
    path.join(home, ".local", "bin", "claude.exe"),
    path.join(home, ".local", "bin", "claude.cmd"),
    path.join(home, ".local", "bin", "claude"),
    path.join(home, "AppData", "Local", "Programs", "claude", "claude.exe"),
    "/usr/local/bin/claude",
    "/opt/homebrew/bin/claude",
  ];
  if (env.APPDATA) {
    candidates.unshift(path.join(env.APPDATA, "npm", "claude.cmd"));
  }
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }
    const result = spawnSync(candidate, ["--version"], {
      encoding: "utf8",
      timeout: 4000,
      windowsHide: true,
      env,
      shell: isWindows(),
    });
    if (result.status === 0) {
      return {
        found: true,
        version: (result.stdout || result.stderr).trim().split(/\r?\n/)[0],
        path: candidate,
      };
    }
    return { found: true, path: candidate };
  }
  return { found: false };
}
