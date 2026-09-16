#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { runCli } from "./cli/program.js";

const code = await runCli(process.argv.slice(2), {
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
  env: process.env,
  now: () => new Date(),
  cliEntry: fileURLToPath(import.meta.url),
});

process.exit(code);
