import { z } from "zod";

/**
 * Asset reference: an absolute URL (passed through) or a local path relative
 * to the config directory (copied into the output at build time).
 */
export const assetRefSchema = z.string().min(1).regex(/^[^<]+$/, "must not contain '<'");
