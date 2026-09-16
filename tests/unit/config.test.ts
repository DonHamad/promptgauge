import { describe, expect, it } from "vitest";
import { normalizeConfig } from "../../src/core/config/model.js";

describe("config", () => {
  it("keeps storePromptText false even when requested", () => {
    const { config, warnings } = normalizeConfig({
      privacy: { storePromptText: true },
    });
    expect(config.privacy.storePromptText).toBe(false);
    expect(warnings.join(" ")).toMatch(/unsupported/);
  });

  it("forces observe mode", () => {
    const { config, warnings } = normalizeConfig({ mode: "enforce" });
    expect(config.mode).toBe("observe");
    expect(warnings.join(" ")).toMatch(/observe-only/);
  });

  it("rejects unsorted thresholds", () => {
    const { config, warnings } = normalizeConfig({
      thresholds: { warning: 90, critical: 80, emergency: 70 },
    });
    expect(config.thresholds).toEqual({ warning: 70, critical: 85, emergency: 95 });
    expect(warnings.join(" ")).toMatch(/invalid thresholds/);
  });
});
