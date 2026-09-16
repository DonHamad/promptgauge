import fs from "node:fs";
import path from "node:path";

export function writeTextAtomic(filePath: string, text: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmp, text, { encoding: "utf8" });
  try {
    fs.renameSync(tmp, filePath);
  } catch {
    fs.copyFileSync(tmp, filePath);
    fs.unlinkSync(tmp);
  }
}

export function writeJsonAtomic(filePath: string, value: unknown): void {
  writeTextAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function copyFileAtomic(from: string, to: string): void {
  const dir = path.dirname(to);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${to}.${process.pid}.copytmp`;
  fs.copyFileSync(from, tmp);
  try {
    fs.renameSync(tmp, to);
  } catch {
    fs.copyFileSync(tmp, to);
    fs.unlinkSync(tmp);
  }
}
