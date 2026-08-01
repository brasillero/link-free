import { describe, expect, it } from "vitest";
import { resolveTheme } from "../../src/theme/resolveTheme.js";

describe("resolveTheme", () => {
  it("resolves the light preset by default", () => {
    const theme = resolveTheme({ theme: "light" });
    expect(theme.name).toBe("light");
    expect(theme.rootCss).toContain("--lf-bg: #fafafa;");
    expect(theme.rootCss).toContain("--lf-accent: #2563eb;");
    expect(theme.rootCss).toContain("--lf-text-muted: #525252;");
    expect(theme.rootCss).not.toContain("--lf-bg-image");
    expect(theme.rootCss).not.toContain("--lf-overlay");
    expect(theme.extraCss).toBe("");
  });

  it("applies token overrides on top of the preset", () => {
    const theme = resolveTheme({ theme: "dark", tokens: { accent: "#ff6b6b" } });
    expect(theme.rootCss).toContain("--lf-accent: #ff6b6b;");
    expect(theme.rootCss).toContain("--lf-bg: #0a0a0a;"); // preset value kept
  });

  it("maps enum tokens to concrete values", () => {
    const theme = resolveTheme({
      theme: "light",
      tokens: { font: "serif", radius: "sm", avatarRadius: "full", density: "compact" },
    });
    expect(theme.rootCss).toContain("--lf-font: Georgia");
    expect(theme.rootCss).toContain("--lf-radius: 0.375rem;");
    expect(theme.rootCss).toContain("--lf-avatar-radius: 9999px;");
    expect(theme.rootCss).toContain("--lf-spacing: 0.5rem;");
  });

  it("emits bg-image and overlay only when backgroundImage is set", () => {
    const theme = resolveTheme({
      theme: "dark",
      tokens: { backgroundImage: "https://example.com/bg.jpg" },
    });
    expect(theme.rootCss).toContain('--lf-bg-image: url("https://example.com/bg.jpg");');
    expect(theme.rootCss).toContain("--lf-overlay: 0.7;");
  });

  it("includes preset extra css (minimal)", () => {
    const theme = resolveTheme({ theme: "minimal" });
    expect(theme.extraCss).toContain("text-decoration:underline");
  });

  it("css-escapes quotes and backslashes in backgroundImage defensively", () => {
    const theme = resolveTheme({
      theme: "light",
      tokens: { backgroundImage: 'https://example.com/a"b.jpg' },
    });
    expect(theme.rootCss).toContain('--lf-bg-image: url("https://example.com/a\\"b.jpg");');
  });
});
