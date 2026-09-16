#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SKIP_DIRS = new Set([".git", "node_modules", "dist", "coverage"]);
const PATTERNS = [
  { name: "anthropic-api-key", re: /sk-ant-[A-Za-z0-9_-]{8,}/g },
  { name: "github-pat", re: /github_pat_[A-Za-z0-9_]{20,}/g },
  { name: "github-token", re: /ghp_[A-Za-z0-9]{20,}/g },
  { name: "generic-bearer", re: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g },
];

const ALLOWLIST = new Set([
  path.normalize("docs/PRIVACY.md"),
  path.normalize("docs/CLAUDE_CODE_INTEGRATION.md"),
  path.normalize("SECURITY.md"),
  path.normalize("scripts/scan-secrets.mjs"),
]);

let failed = false;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".git")) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(ts|js|mjs|cjs|json|md|yml|yaml)$/i.test(entry.name)) {
      continue;
    }
    const rel = path.relative(ROOT, full);
    if (ALLOWLIST.has(rel)) {
      continue;
    }
    const text = fs.readFileSync(full, "utf8");
    for (const pattern of PATTERNS) {
      if (pattern.re.test(text)) {
        console.error(`possible secret (${pattern.name}) in ${rel}`);
        failed = true;
      }
      pattern.re.lastIndex = 0;
    }
  }
}

walk(ROOT);
if (failed) {
  process.exit(1);
}
console.log("secret scan: no matches");
