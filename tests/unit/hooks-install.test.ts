import { describe, expect, it } from "vitest";
import {
  hasPromptGaugeHooks,
  planHooksInstall,
  planHooksUninstall,
} from "../../src/claude/hooks/plan.js";

const command = `"C:\\Program Files\\nodejs\\node.exe" "C:\\My Tools\\promptgauge\\dist\\index.js" collect --pg-hook`;

describe("hooks install planner", () => {
  it("creates UserPromptSubmit and Stop when no hooks exist", () => {
    const planned = planHooksInstall({}, command);
    expect(planned.alreadyInstalled).toBe(false);
    expect(planned.previousExisted).toBe(false);
    const hooks = planned.nextSettings.hooks as Record<string, unknown[]>;
    expect(hooks.UserPromptSubmit).toHaveLength(1);
    expect(hooks.Stop).toHaveLength(1);
  });

  it("preserves multiple existing hook entries", () => {
    const existing = {
      hooks: {
        PreToolUse: [
          { matcher: "Bash", hooks: [{ type: "command", command: "lint.sh" }] },
          { matcher: "Edit", hooks: [{ type: "command", command: "fmt.sh" }] },
        ],
        Stop: [{ hooks: [{ type: "command", command: "notify.sh" }] }],
      },
    };
    const planned = planHooksInstall(existing, command);
    const hooks = planned.nextSettings.hooks as {
      PreToolUse: unknown[];
      Stop: unknown[];
    };
    expect(hooks.PreToolUse).toHaveLength(2);
    expect(hooks.Stop).toHaveLength(2);
    const undone = planHooksUninstall(planned.nextSettings);
    const restored = undone.nextSettings.hooks as {
      PreToolUse: unknown[];
      Stop: { hooks: { command: string }[] }[];
    };
    expect(restored.PreToolUse).toHaveLength(2);
    expect(restored.Stop).toHaveLength(1);
    expect(restored.Stop[0]?.hooks[0]?.command).toBe("notify.sh");
  });

  it("is idempotent", () => {
    const first = planHooksInstall({}, command);
    const second = planHooksInstall(first.nextSettings, command);
    expect(second.alreadyInstalled).toBe(true);
    expect(hasPromptGaugeHooks(first.nextSettings.hooks as never)).toBe(true);
  });

  it("quotes windows and unix command shapes without double wrapping", () => {
    const unix = `/usr/bin/node /opt/promptgauge/dist/index.js collect --pg-hook`;
    const planned = planHooksInstall({}, unix);
    const again = planHooksInstall(planned.nextSettings, unix);
    expect(again.alreadyInstalled).toBe(true);
  });
});
