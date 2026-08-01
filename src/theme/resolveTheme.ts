import type { ThemeConfig } from "../schema/files.js";
import { PRESETS, PRESET_CSS, type TokenMap } from "./presets.js";

const FONTS = {
  system: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace",
} as const;

const RADII = { sm: "0.375rem", md: "0.75rem", lg: "1rem", full: "9999px" } as const;
const DENSITIES = { compact: "0.5rem", comfortable: "1rem" } as const;

export interface ResolvedTheme {
  name: string;
  rootCss: string;
  extraCss: string;
}

/** Escape a string for safe inclusion inside a CSS url("…") — NOT html-escaping. */
function cssUrl(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function resolveTheme(config: ThemeConfig): ResolvedTheme {
  const name = config.theme;
  const preset = PRESETS[name];
  const t = config.tokens ?? {};

  const tokens: TokenMap = {
    ...preset,
    background: t.background ?? preset.background,
    surface: t.surface ?? preset.surface,
    text: t.text ?? preset.text,
    accent: t.accent ?? preset.accent,
    font: t.font ? FONTS[t.font] : preset.font,
    radius: t.radius ? RADII[t.radius] : preset.radius,
    avatarRadius: t.avatarRadius ? RADII[t.avatarRadius] : preset.avatarRadius,
    spacing: t.density ? DENSITIES[t.density] : preset.spacing,
  };

  const lines = [
    `--lf-bg: ${tokens.background};`,
    `--lf-surface: ${tokens.surface};`,
    `--lf-text: ${tokens.text};`,
    `--lf-text-muted: ${tokens.textMuted};`,
    `--lf-accent: ${tokens.accent};`,
    `--lf-font: ${tokens.font};`,
    `--lf-radius: ${tokens.radius};`,
    `--lf-avatar-radius: ${tokens.avatarRadius};`,
    `--lf-spacing: ${tokens.spacing};`,
  ];
  if (t.backgroundImage) {
    lines.push(`--lf-bg-image: url("${cssUrl(t.backgroundImage)}");`);
    lines.push(`--lf-overlay: ${tokens.overlay};`);
  }

  return {
    name,
    rootCss: `:root {\n  ${lines.join("\n  ")}\n}`,
    extraCss: PRESET_CSS[name],
  };
}
