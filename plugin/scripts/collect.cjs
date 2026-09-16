#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const repoCli = path.resolve(__dirname, "..", "..", "dist", "index.js");

if (fs.existsSync(repoCli)) {
  const result = spawnSync(process.execPath, [repoCli, "collect"], {
    stdio: "inherit",
    windowsHide: true,
  });
  process.exit(result.status === null ? 1 : result.status);
}

const result = spawnSync("promptgauge", ["collect"], {
  stdio: "inherit",
  windowsHide: true,
  shell: process.platform === "win32",
});
process.exit(result.status === null ? 1 : result.status);
