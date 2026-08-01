import { describe, expect, it } from "vitest";
import { COMPONENT_NAMES, registry, renderBlock } from "../../src/components/registry.js";

describe("registry", () => {
  it("registers the 4 MVP components", () => {
    expect([...COMPONENT_NAMES].sort()).toEqual(["link", "profile", "socials", "text"]);
    for (const name of COMPONENT_NAMES) {
      expect(registry[name].schema).toBeDefined();
      expect(typeof registry[name].render).toBe("function");
    }
  });

  it("renderBlock dispatches by component name", () => {
    const html = renderBlock({ component: "text", text: "hi" });
    expect(html).toBe('<p class="text-sm text-muted">hi</p>');
  });
});
