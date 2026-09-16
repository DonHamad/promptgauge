import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CONFIG_FILE_NAME, DEFAULT_DATA_DIR_NAME, EVENTS_FILE_NAME } from "../version.js";

export interface DataPaths {
  dataDir: string;
  eventsFile: string;
  configFile: string;
}

export function resolveDataDir(env: NodeJS.ProcessEnv = process.env, home = os.homedir()): string {
  if (env.PROMPTGAUGE_HOME && env.PROMPTGAUGE_HOME.length > 0) {
    return env.PROMPTGAUGE_HOME;
  }
  return path.join(home, DEFAULT_DATA_DIR_NAME);
}

export function resolvePaths(dataDir: string): DataPaths {
  return {
    dataDir,
    eventsFile: path.join(dataDir, EVENTS_FILE_NAME),
    configFile: path.join(dataDir, CONFIG_FILE_NAME),
  };
}

export function ensureDataDir(dataDir: string): void {
  fs.mkdirSync(dataDir, { recursive: true });
}
