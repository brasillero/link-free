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
