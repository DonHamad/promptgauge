#!/usr/bin/env node
import { resolveCliEntry } from "./utils/cli-entry.js";
import { runCli } from "./cli/program.js";

void main();

async function main(): Promise<void> {
  const code = await runCli(process.argv.slice(2), {
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
    env: process.env,
    now: () => new Date(),
    cliEntry: resolveCliEntry(),
  });
  process.exit(code);
}
