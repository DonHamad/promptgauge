import { DISPLAY_NAME, VERSION } from "../version.js";
import { loadConfig, writeDefaultConfig } from "../core/config/load.js";
import { renderStatus } from "../reporting/status-report.js";
import { readEvents } from "../storage/jsonl.js";
import { ensureDataDir, resolveDataDir, resolvePaths } from "../storage/paths.js";
import { collectFromStdin } from "./commands/collect.js";
import { formatDoctor, runDoctor } from "./commands/doctor.js";

export interface CliIo {
  stdin: NodeJS.ReadableStream;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
  env: NodeJS.ProcessEnv;
  now: () => Date;
  readStdin?: () => Promise<string>;
  nodeVersion?: string;
  home?: string;
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

  switch (parsed.command) {
    case "status": {
      const { events } = readEvents(paths.eventsFile);
      io.stdout.write(renderStatus(events, loaded.config, now));
      return 0;
    }
    case "doctor": {
      const { events, skippedCorruptLines } = readEvents(paths.eventsFile);
      const checks = runDoctor({
        nodeVersion: io.nodeVersion ?? process.version,
        dataDir,
        eventsExist: events.length > 0,
        skippedCorruptLines,
        home: io.home ?? defaultHome(io.env),
        env: io.env,
        claudeVersionCommand: parsed.claudeMissing
          ? () => ({ ok: false })
          : io.env.PROMPTGAUGE_FAKE_CLAUDE === "1"
            ? () => ({ ok: true, version: "claude fake 0.0.0" })
            : undefined,
      });
      io.stdout.write(formatDoctor(checks));
      return checks.some((check) => check.status === "FAIL") ? 1 : 0;
    }
    case "collect": {
      const raw = io.readStdin ? await io.readStdin() : await readAll(io.stdin);
      const { stdout } = collectFromStdin(raw, paths.eventsFile, now);
      if (stdout) {
        io.stdout.write(stdout);
      }
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
      io.stdout.write(
        "\nNote: report is a local observation dump. It is not a billing statement.\n",
      );
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

interface ParsedArgs {
  command?: string;
  help: boolean;
  version: boolean;
  dataDir?: string;
  now?: string;
  claudeMissing: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = { help: false, version: false, claudeMissing: false };
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
    } else if (arg === "--simulate-missing-claude") {
      parsed.claudeMissing = true;
    } else if (arg?.startsWith("-")) {
      parsed.help = true;
    } else if (arg) {
      rest.push(arg);
    }
  }
  parsed.command = rest[0];
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
  promptgauge status
  promptgauge doctor
  promptgauge collect
  promptgauge config
  promptgauge report
  promptgauge --help
  promptgauge --version

Commands:
  status    Show observed quota snapshots and prompt counts
  doctor    Check local integration health (no credentials inspected)
  collect   Ingest Claude Code status-line or hook JSON from stdin
  config    Print the local configuration
  report    Print a local observation dump

Options:
  --data-dir <path>  Override local data directory
  --now <iso>        Evaluate time-dependent output at a fixed instant
  -h, --help         Show this help
  -v, --version      Show version

PromptGauge is not affiliated with or endorsed by Anthropic.
Live quota is shown only when Claude Code reports it.
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
