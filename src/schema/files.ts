import { z } from "zod";

export const siteFileSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lang: z.string().optional(),
    canonicalUrl: z.string().url().optional(),
    ogImage: z.string().url().optional(),
  })
  .strip();

export type SiteFile = z.infer<typeof siteFileSchema>;

/** Loose wrapper: per-block validation happens in loadSections via the registry. */
export const sectionFileSchema = z.object({
  blocks: z.array(z.record(z.unknown())),
});

const colorToken = z.string().min(1);
const radiusToken = z.enum(["sm", "md", "lg", "full"]);

// `theme` stays a plain string so loadSections can emit a curated "unknown theme"
// message listing the valid PRESET_NAMES instead of a raw zod enum error.
export const themeConfigSchema = z
  .object({
    theme: z.string().default("light"),
    tokens: z
      .object({
        accent: colorToken.optional(),
        background: colorToken.optional(),
        backgroundImage: z.string().url().optional(),
        surface: colorToken.optional(),
        text: colorToken.optional(),
        font: z.enum(["system", "serif", "mono"]).optional(),
        radius: radiusToken.optional(),
        avatarRadius: radiusToken.optional(),
        density: z.enum(["compact", "comfortable"]).optional(),
      })
      .strip()
      .optional(),
  })
  .strip();

export type ThemeConfig = z.infer<typeof themeConfigSchema>;
