import fs from "node:fs";
import path from "node:path";
import { CONFIG_FILE_NAME } from "../../version.js";
import { parseJson } from "../../utils/json.js";
import { DEFAULT_CONFIG, normalizeConfig, type PromptGaugeConfig } from "./model.js";

export function loadConfig(dataDir: string): {
  config: PromptGaugeConfig;
  warnings: string[];
  path: string;
  existed: boolean;
} {
  const filePath = path.join(dataDir, CONFIG_FILE_NAME);
  if (!fs.existsSync(filePath)) {
    return { config: DEFAULT_CONFIG, warnings: [], path: filePath, existed: false };
  }
  const text = fs.readFileSync(filePath, "utf8");
  const parsed = parseJson(text);
  if (!parsed.ok) {
    return {
      config: DEFAULT_CONFIG,
      warnings: ["config.json is malformed; using defaults."],
      path: filePath,
      existed: true,
    };
  }
  const normalized = normalizeConfig(parsed.value);
  return { ...normalized, path: filePath, existed: true };
}

export function writeDefaultConfig(dataDir: string): string {
  fs.mkdirSync(dataDir, { recursive: true });
  const filePath = path.join(dataDir, CONFIG_FILE_NAME);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, "utf8");
  }
  return filePath;
}
