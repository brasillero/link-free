import { z } from "zod";
import { PRESET_NAMES } from "../theme/presets.js";
import {
  linkBlockSchema,
  profileBlockSchema,
  socialsBlockSchema,
  textBlockSchema,
} from "./blocks.js";
import { assetRefSchema } from "./common.js";

export const siteFileSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lang: z.string().optional(),
    canonicalUrl: z.string().url().optional(),
    ogImage: assetRefSchema.optional(),
  })
  .strip();

export type SiteFile = z.infer<typeof siteFileSchema>;

/** Loose wrapper: per-block validation happens in loadSections via the registry. */
export const sectionFileSchema = z.object({
  blocks: z.array(z.record(z.unknown())),
});

/**
 * Per-section file schemas: richer than sectionFileSchema (which stays loose
 * at runtime so loadSections can emit curated per-block errors). Used to
 * infer the config types shipped from the package root.
 */
export const headerFileSchema = z.object({
  blocks: z.array(z.discriminatedUnion("component", [profileBlockSchema, socialsBlockSchema])),
});

export const bodyFileSchema = z.object({
  blocks: z.array(z.discriminatedUnion("component", [linkBlockSchema])),
});

export const footerFileSchema = z.object({
  blocks: z.array(z.discriminatedUnion("component", [textBlockSchema])),
});

export type HeaderFile = z.infer<typeof headerFileSchema>;
export type BodyFile = z.infer<typeof bodyFileSchema>;
export type FooterFile = z.infer<typeof footerFileSchema>;

const colorToken = z.string().min(1).regex(/^[^<]+$/, "must not contain '<'");
const radiusToken = z.enum(["sm", "md", "lg", "full"]);

// The enum errorMap emits a curated "unknown theme" message listing the valid
// PRESET_NAMES instead of zod's raw "Invalid enum value" error.
export const themeConfigSchema = z
  .object({
    theme: z
      .enum(PRESET_NAMES, {
        errorMap: (issue, ctx) =>
          issue.code === "invalid_enum_value"
            ? { message: `unknown theme "${ctx.data}" (valid: ${PRESET_NAMES.join(", ")})` }
            : { message: ctx.defaultError },
      })
      .default("light"),
    tokens: z
      .object({
        accent: colorToken.optional(),
        background: colorToken.optional(),
        backgroundImage: assetRefSchema.optional(),
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
