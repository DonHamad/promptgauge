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
