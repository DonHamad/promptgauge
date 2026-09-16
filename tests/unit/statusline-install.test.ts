import { describe, expect, it } from "vitest";
import {
  isPromptGaugeWrapperCommand,
  planInstall,
  planUninstall,
  preserveDisplayProps,
} from "../../src/claude/statusline/plan.js";

const wrapper = `node /opt/promptgauge/dist/index.js statusline run --pg-wrapper`;

describe("statusline install planner", () => {
  it("creates settings when none exist", () => {
    const planned = planInstall(undefined, wrapper);
    expect(planned.alreadyInstalled).toBe(false);
    expect(planned.previous).toBeNull();
    expect(planned.nextSettings.statusLine).toMatchObject({
      type: "command",
      command: wrapper,
    });
  });

  it("adds a statusLine when settings exist without one", () => {
    const planned = planInstall({ theme: "dark" }, wrapper);
    expect(planned.previous).toBeNull();
    expect(planned.nextSettings.theme).toBe("dark");
    expect(planned.nextSettings.statusLine).toMatchObject({ command: wrapper });
  });

  it("preserves an existing script-based statusLine", () => {
    const previous = {
      type: "command",
      command: "~/.claude/statusline.sh",
      padding: 2,
      refreshInterval: 10,
      hideVimModeIndicator: true,
    };
    const planned = planInstall({ statusLine: previous }, wrapper);
    expect(planned.previous).toEqual(previous);
    expect(planned.nextSettings.statusLine).toMatchObject({
      command: wrapper,
      padding: 2,
      refreshInterval: 10,
      hideVimModeIndicator: true,
    });
  });

  it("preserves inline commands, windows paths, spaces, and quotes", () => {
    const command = `node "C:\\\\My Scripts\\\\line.js" --flag`;
    const planned = planInstall({ statusLine: { type: "command", command } }, wrapper);
    expect(planned.previous?.command).toBe(command);
    const restored = planUninstall(planned.nextSettings, {
      version: 1,
      installedAt: "2026-09-16T04:00:00.000Z",
      wrapperCommand: wrapper,
      previousExisted: true,
      previousStatusLine: planned.previous,
    });
    expect(restored.restored).toBe(true);
    expect((restored.nextSettings.statusLine as { command: string }).command).toBe(command);
  });

  it("is idempotent and does not double-wrap", () => {
    const first = planInstall({ statusLine: { type: "command", command: "echo hi" } }, wrapper);
    const second = planInstall(first.nextSettings, wrapper);
    expect(second.alreadyInstalled).toBe(true);
    expect((second.nextSettings.statusLine as { command: string }).command).toBe(wrapper);
    expect(isPromptGaugeWrapperCommand(wrapper)).toBe(true);
  });

  it("uninstall removes PromptGauge when there was no previous statusLine", () => {
    const installed = planInstall({}, wrapper);
    const undone = planUninstall(installed.nextSettings, {
      version: 1,
      installedAt: "t",
      wrapperCommand: wrapper,
      previousExisted: false,
      previousStatusLine: null,
    });
    expect(undone.nextSettings.statusLine).toBeUndefined();
  });
});

describe("preserveDisplayProps", () => {
  it("copies padding, refreshInterval, and hideVimModeIndicator", () => {
    expect(
      preserveDisplayProps({
        type: "command",
        command: "x",
        padding: 0,
        refreshInterval: 5,
        hideVimModeIndicator: false,
      }),
    ).toEqual({ padding: 0, refreshInterval: 5, hideVimModeIndicator: false });
  });
});
