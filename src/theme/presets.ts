export const PRESET_NAMES = ["light", "dark", "minimal"] as const;
export type PresetName = (typeof PRESET_NAMES)[number];

/** A fully-resolved preset: every token the stylesheet needs. */
export interface TokenMap {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  accent: string;
  font: string;
  radius: string;
  avatarRadius: string;
  spacing: string;
  /** Scrim opacity over backgroundImage (0–1); emitted only when an image is set. */
  overlay: string;
}

const SYSTEM_FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export const PRESETS: Record<PresetName, TokenMap> = {
  light: {
    background: "#fafafa",
    surface: "#ffffff",
    text: "#171717",
    textMuted: "#525252",
    accent: "#2563eb",
    font: SYSTEM_FONT,
    radius: "0.75rem",
    avatarRadius: "9999px",
    spacing: "0.75rem",
    overlay: "0.55",
  },
  dark: {
    background: "#0a0a0a",
    surface: "#171717",
    text: "#fafafa",
    textMuted: "#a3a3a3",
    accent: "#60a5fa",
    font: SYSTEM_FONT,
    radius: "0.75rem",
    avatarRadius: "9999px",
    spacing: "0.75rem",
    overlay: "0.7",
  },
  minimal: {
    background: "#ffffff",
    surface: "transparent",
    text: "#000000",
    textMuted: "#404040",
    accent: "#000000",
    font: SYSTEM_FONT,
    radius: "0",
    avatarRadius: "0",
    spacing: "0.5rem",
    overlay: "0.5",
  },
};

/** Extra preset-only CSS appended after the :root block (not user-overridable). */
export const PRESET_CSS: Record<PresetName, string> = {
  light: "",
  dark: "",
  minimal: ".lf-link{background:transparent;text-decoration:underline;box-shadow:none}",
};
