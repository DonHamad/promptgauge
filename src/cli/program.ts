import { DISPLAY_NAME, VERSION } from "../version.js";
import { loadConfig, writeDefaultConfig } from "../core/config/load.js";
import { renderStatus } from "../reporting/status-report.js";
import { readEvents } from "../storage/jsonl.js";
import { ensureDataDir, resolveDataDir, resolvePaths } from "../storage/paths.js";
import { collectFromStdin } from "./commands/collect.js";
import { formatDoctor, runDoctor } from "./commands/doctor.js";
import { formatSimpleDoctor, runCleanup, runSetup } from "./commands/setup.js";
import { detectPluginRoot } from "../claude/plugin/root.js";
import {
  describeStatusLine,
  installStatusLine,
  uninstallStatusLine,
} from "../claude/statusline/install.js";
import { runStatusLineWrapper } from "../claude/statusline/wrapper.js";
import { describeHooks, installHooks, uninstallHooks } from "../claude/hooks/install.js";
import { formatPrompts } from "../reporting/prompts.js";

export interface CliIo {
  stdin: NodeJS.ReadableStream;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
  env: NodeJS.ProcessEnv;
  now: () => Date;
  readStdin?: () => Promise<string>;
  nodeVersion?: string;
  home?: string;
  cliEntry?: string;
}

export async function runCli(argv: string[], io: CliIo): Promise<number> {
  const parsed = parseArgs(argv);
  if (parsed.help) {
    io.stdout.write(helpText());
    return 0;
  }
  if (parsed.version) {
    io.stdout.write(`${VERSION}\n`);
    return 0;
  }

  const dataDir = parsed.dataDir ?? resolveDataDir(io.env, io.home);
  const paths = resolvePaths(dataDir);
  ensureDataDir(dataDir);
  writeDefaultConfig(dataDir);
  const loaded = loadConfig(dataDir);
  const now = parsed.now ? new Date(parsed.now) : io.now();
  const home = io.home ?? defaultHome(io.env);

  switch (parsed.command) {
    case "status": {
      const { events } = readEvents(paths.eventsFile);
      io.stdout.write(renderStatus(events, loaded.config, now, parsed.simple));
      return 0;
    }
    case "doctor": {
      const { events, skippedCorruptLines } = readEvents(paths.eventsFile);
      const pluginRoot = detectPluginRoot(io.env, io.cliEntry);
      const checks = runDoctor({
        nodeVersion: io.nodeVersion ?? process.version,
        dataDir,
        eventsExist: events.length > 0,
        skippedCorruptLines,
        home,
        env: io.env,
        events,
        now,
        freshnessMs: loaded.config.freshnessMs,
        pluginRoot,
        claudeVersionCommand: parsed.claudeMissing
          ? () => ({ ok: false })
          : io.env.PROMPTGAUGE_FAKE_CLAUDE === "1"
            ? () => ({ ok: true, version: "claude fake 0.0.0" })
            : undefined,
      });
      io.stdout.write(parsed.simple ? formatSimpleDoctor(checks) : formatDoctor(checks));
      return checks.some((check) => check.status === "FAIL") ? 1 : 0;
    }
    case "setup": {
      const pluginRoot = detectPluginRoot(io.env, io.cliEntry);
      const result = runSetup({
        pluginRoot,
        settingsIo: {
          home,
          dataDir,
          env: io.env,
          now: () => now,
          cliEntry: io.cliEntry,
          nodeExecutable: process.execPath,
        },
      });
      io.stdout.write(result.message);
      return result.ok ? 0 : 1;
    }
    case "uninstall": {
      const pluginRoot = detectPluginRoot(io.env, io.cliEntry);
      const result = runCleanup({
        pluginRoot,
        settingsIo: {
          home,
          dataDir,
          env: io.env,
          now: () => now,
          cliEntry: io.cliEntry,
          nodeExecutable: process.execPath,
        },
      });
      io.stdout.write(result.message);
      return result.ok ? 0 : 1;
    }
    case "collect": {
      const raw = io.readStdin ? await io.readStdin() : await readAll(io.stdin);
      const { stdout } = collectFromStdin(raw, paths.eventsFile, now);
      if (stdout) {
        io.stdout.write(stdout);
      }
      return 0;
    }
    case "install":
    case "statusline": {
      return runStatuslineCommand(parsed, io, dataDir, home, paths.eventsFile, now);
    }
    case "hooks": {
      return runHooksCommand(parsed, io, dataDir, home);
    }
    case "prompts": {
      const { events } = readEvents(paths.eventsFile);
      io.stdout.write(formatPrompts(events, parsed.limit ?? 10));
      return 0;
    }
    case "config": {
      io.stdout.write(`${JSON.stringify(loaded.config, null, 2)}\n`);
      if (loaded.warnings.length > 0) {
        io.stderr.write(`${loaded.warnings.join("\n")}\n`);
      }
      return 0;
    }
    case "report": {
      const { events } = readEvents(paths.eventsFile);
      io.stdout.write(renderStatus(events, loaded.config, now));
      io.stdout.write("\nNote: this is a local observation dump, not a billing statement.\n");
      return 0;
    }
    case undefined:
      io.stderr.write(`Unknown command. Try ${DISPLAY_NAME.toLowerCase()} --help\n`);
      return 1;
    default:
      io.stderr.write(`Unknown command: ${parsed.command}\n`);
      return 1;
  }
}

async function runStatuslineCommand(
  parsed: ParsedArgs,
  io: CliIo,
  dataDir: string,
  home: string,
  eventsFile: string,
  now: Date,
): Promise<number> {
  const sub = parsed.command === "install" ? "install" : parsed.subcommand;
  const settingsIo = {
    home,
    dataDir,
    env: io.env,
    now: () => now,
    cliEntry: io.cliEntry,
    nodeExecutable: process.execPath,
  };
  if (sub === "install") {
    const result = installStatusLine(settingsIo);
    io.stdout.write(`${result.message}\n`);
    return result.ok ? 0 : 1;
  }
  if (sub === "uninstall") {
    const result = uninstallStatusLine(settingsIo);
    io.stdout.write(`${result.message}\n`);
    return result.ok ? 0 : 1;
  }
  if (sub === "status" || sub === undefined) {
    io.stdout.write(describeStatusLine(settingsIo));
    return 0;
  }
  if (sub === "run") {
    const raw = io.readStdin ? await io.readStdin() : await readAll(io.stdin);
    io.stdout.write(runStatusLineWrapper(raw, { eventsFile, dataDir, now }));
    return 0;
  }
  io.stderr.write("Usage: promptgauge statusline <install|uninstall|status>\n");
  return 1;
}

async function runHooksCommand(
  parsed: ParsedArgs,
  io: CliIo,
  dataDir: string,
  home: string,
): Promise<number> {
  const settingsIo = {
    home,
    dataDir,
    env: io.env,
    now: io.now,
    cliEntry: io.cliEntry,
    nodeExecutable: process.execPath,
  };
  if (parsed.subcommand === "install") {
    const result = installHooks(settingsIo);
    io.stdout.write(`${result.message}\n`);
    return result.ok ? 0 : 1;
  }
  if (parsed.subcommand === "uninstall") {
    const result = uninstallHooks(settingsIo);
    io.stdout.write(`${result.message}\n`);
    return result.ok ? 0 : 1;
  }
  if (parsed.subcommand === "status" || parsed.subcommand === undefined) {
    io.stdout.write(describeHooks(settingsIo));
    return 0;
  }
  io.stderr.write("Usage: promptgauge hooks <install|uninstall|status>\n");
  return 1;
}

interface ParsedArgs {
  command?: string;
  subcommand?: string;
  help: boolean;
  version: boolean;
  dataDir?: string;
  now?: string;
  claudeMissing: boolean;
  limit?: number;
  simple: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = { help: false, version: false, claudeMissing: false, simple: false };
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--version" || arg === "-v") {
      parsed.version = true;
    } else if (arg === "--data-dir") {
      parsed.dataDir = argv[i + 1];
      i += 1;
    } else if (arg === "--now") {
      parsed.now = argv[i + 1];
      i += 1;
    } else if (arg === "--limit") {
      parsed.limit = Number.parseInt(argv[i + 1] ?? "", 10);
      i += 1;
    } else if (arg === "--simple") {
      parsed.simple = true;
    } else if (arg === "--simulate-missing-claude") {
      parsed.claudeMissing = true;
    } else if (arg === "--pg-wrapper" || arg === "--pg-hook") {
      continue;
    } else if (arg?.startsWith("-")) {
      parsed.help = true;
    } else if (arg) {
      rest.push(arg);
    }
  }
  parsed.command = rest[0];
  parsed.subcommand = rest[1];
  if (!parsed.command && !parsed.version) {
    parsed.help = true;
  }
  return parsed;
}

function helpText(): string {
  return `${DISPLAY_NAME} ${VERSION}

See where your Claude Code usage goes.

🚧 Early development / pre-release

Usage:
  promptgauge setup
  promptgauge status [--simple]
  promptgauge doctor [--simple]
  promptgauge uninstall
  promptgauge prompts [--limit 10]
  promptgauge statusline install
  promptgauge statusline uninstall
  promptgauge statusline status
  promptgauge hooks install
  promptgauge hooks uninstall
  promptgauge hooks status
  promptgauge collect
  promptgauge config
  promptgauge report
  promptgauge --help
  promptgauge --version

Commands:
  setup              One-time Claude Code status-line setup
  status             Show observed quota snapshots and prompt counts
  doctor             Check local integration health (no credentials inspected)
  uninstall          Restore previous statusLine; keep local history
  prompts            Recent completed prompts without prompt text
  statusline install Non-destructive Claude Code status-line wrapper
  statusline uninstall Restore the previous statusLine where possible
  statusline status  Explain what is installed
  hooks install      Add UserPromptSubmit and Stop collectors without replacing other hooks
  hooks uninstall    Remove only PromptGauge hook handlers
  hooks status       Explain which hooks are installed
  collect            Ingest Claude Code status-line or hook JSON from stdin
  config             Print the local configuration
  report             Print a local observation dump

Options:
  --data-dir <path>  Override local data directory
  --now <iso>        Evaluate time-dependent output at a fixed instant
  --limit <n>        Number of prompts to show (default 10)
  --simple           Compact status and doctor output
  -h, --help         Show this help
  -v, --version      Show version

PromptGauge is an independent open-source project and is not affiliated with Anthropic.
Quota fields are shown when Claude Code exposes them.
`;
}

function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    });
    stream.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    stream.on("error", reject);
  });
}

function defaultHome(env: NodeJS.ProcessEnv): string {
  return env.USERPROFILE ?? env.HOME ?? ".";
}
