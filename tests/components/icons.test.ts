import { describe, expect, it } from "vitest";
import { ICON_NAMES } from "../../src/schema/blocks.js";
import { ICONS } from "../../src/components/icons.js";

describe("ICONS", () => {
  it("has an inline SVG for every IconName", () => {
    for (const name of ICON_NAMES) {
      expect(ICONS[name], `missing icon: ${name}`).toMatch(/^<svg[\s\S]*<\/svg>$/);
      expect(ICONS[name]).toContain('aria-hidden="true"');
    }
  });
});
