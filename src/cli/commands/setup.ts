import type { DoctorCheck } from "./doctor.js";
import {
  describeStatusLine,
  installStatusLine,
  uninstallStatusLine,
  type SettingsIo,
} from "../../claude/statusline/install.js";
import { installHooks, uninstallHooks } from "../../claude/hooks/install.js";
import { pluginHasNativeHooks } from "../../claude/plugin/root.js";

export interface SetupContext {
  settingsIo: SettingsIo;
  pluginRoot?: string;
}

export function runSetup(ctx: SetupContext): { ok: boolean; message: string } {
  const status = installStatusLine(ctx.settingsIo);
  if (!status.ok) {
    return {
      ok: false,
      message: [
        "Could not finish PromptGauge setup.",
        "",
        "Status line  Could not update Claude Code settings.",
        "",
        status.message.includes("malformed")
          ? "The Claude settings file is not valid JSON. Fix it, then run /promptgauge:setup again."
          : status.message,
        "",
      ].join("\n"),
    };
  }

  let hooksActive = Boolean(ctx.pluginRoot && pluginHasNativeHooks(ctx.pluginRoot));
  if (!hooksActive) {
    const hooks = installHooks(ctx.settingsIo);
    hooksActive = hooks.ok;
    if (!hooks.ok) {
      return {
        ok: false,
        message: [
          "Could not finish PromptGauge setup.",
          "",
          "Hooks        Could not update Claude Code settings.",
          "",
          hooks.message,
          "",
        ].join("\n"),
      };
    }
  }

  const wrapper = describeStatusLine(ctx.settingsIo);
  const statusLineActive = /Wrapper:\s+installed/.test(wrapper);

  return {
    ok: true,
    message: [
      "PromptGauge is ready.",
      "",
      `Hooks        ${hooksActive ? "Active" : "Inactive"}`,
      `Status line  ${statusLineActive ? "Active" : "Inactive"}`,
      "Storage      Ready",
      "",
      "Use Claude Code normally.",
      "",
    ].join("\n"),
  };
}

export function runCleanup(ctx: SetupContext): { ok: boolean; message: string } {
  const status = uninstallStatusLine(ctx.settingsIo);
  if (!status.ok) {
    return { ok: false, message: `${status.message}\n` };
  }
  const nativeHooks = Boolean(ctx.pluginRoot && pluginHasNativeHooks(ctx.pluginRoot));
  if (!nativeHooks) {
    const hooks = uninstallHooks(ctx.settingsIo);
    if (!hooks.ok) {
      return { ok: false, message: `${hooks.message}\n` };
    }
  }
  return {
    ok: true,
    message: [
      "PromptGauge cleanup finished.",
      "",
      "Status line  Restored",
      nativeHooks
        ? "Hooks        Stay until you uninstall the plugin"
        : "Hooks        Removed from Claude settings",
      "History      Kept",
      "",
    ].join("\n"),
  };
}

export function formatSimpleDoctor(checks: DoctorCheck[]): string {
  const plugin = pick(checks, "Plugin");
  const hooks = pick(checks, "Hook integration");
  const statusLine = pick(checks, "PromptGauge statusLine integration");
  const storage = pick(checks, "Local storage");
  const quota = [pick(checks, "5-hour quota telemetry"), pick(checks, "7-day quota telemetry")];

  const statusLineLabel =
    statusLine?.status === "PASS" ? "PASS" : statusLine?.status === "FAIL" ? "FAIL" : "NEEDS SETUP";
  const pluginLabel = plugin?.status === "PASS" ? "PASS" : "MISSING";
  const hooksLabel = hooks?.status === "PASS" ? "PASS" : "NEEDS SETUP";
  const storageLabel = storage?.status === "PASS" ? "PASS" : "FAIL";
  const dataLabel = quota.some((check) => check?.status === "PASS") ? "AVAILABLE" : "UNAVAILABLE";

  const lines = [
    "PromptGauge Doctor",
    "",
    `Plugin        ${pluginLabel}`,
    `Hooks         ${hooksLabel}`,
    `Status line   ${statusLineLabel}`,
    `Storage       ${storageLabel}`,
    `Claude data   ${dataLabel}`,
    "",
  ];
  if (statusLineLabel === "NEEDS SETUP" || hooksLabel === "NEEDS SETUP") {
    lines.push("Run:");
    lines.push("/promptgauge:setup");
    lines.push("");
  }
  return lines.join("\n");
}

function pick(checks: DoctorCheck[], name: string): DoctorCheck | undefined {
  return checks.find((check) => check.name === name);
}
