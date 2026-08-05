import { access, copyFile, mkdir, stat } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import { LoadError, type Sections } from "./loadSections.js";

function isRemote(ref: string): boolean {
  // Windows drive-letter paths (C:\..., C:/...) are local, not remote.
  if (/^[A-Za-z]:[\\/]/.test(ref)) return false;
  try {
    return Boolean(new URL(ref).protocol);
  } catch {
    return false;
  }
}

/**
 * Copies locally-referenced assets into `<outDir>/assets/` and rewrites the
 * references in the loaded sections. Absolute URLs pass through untouched.
 *
 * Two-phase: all references are resolved and validated first (no file
 * system writes), then everything is copied — a failure leaves no partial
 * output behind.
 */
export async function processAssets(
  sections: Sections,
  dir: string,
  outDir: string,
): Promise<Sections> {
  const root = resolve(dir);
  const targetBySource = new Map<string, string>();
  const sourceByName = new Map<string, string>();
  const planned = new Map<string, string>(); // abs source -> output name

  // Phase 1: resolve and validate a reference, recording what to copy.
  async function locate(ref: string, field: string): Promise<string> {
    if (isRemote(ref)) return ref;

    const abs = resolve(root, ref);
    if (abs !== root && !abs.startsWith(root + sep)) {
      throw new LoadError(`${field}: path "${ref}" resolves outside the config directory`);
    }

    const known = targetBySource.get(abs);
    if (known) return known;

    try {
      await access(abs);
    } catch {
      throw new LoadError(`${field}: file not found: ${ref} (resolved to ${abs})`);
    }
    if (!(await stat(abs)).isFile()) {
      throw new LoadError(`${field}: file not found: ${ref} (resolved to ${abs})`);
    }

    const name = basename(abs);
    const prior = sourceByName.get(name.toLowerCase());
    if (prior && prior !== abs) {
      throw new LoadError(`asset name collision: ${prior} and ${abs} both map to assets/${name}`);
    }
    sourceByName.set(name.toLowerCase(), abs);

    const target = `assets/${name}`;
    targetBySource.set(abs, target);
    planned.set(abs, name);
    return target;
  }

  const site = { ...sections.site };
  if (site.ogImage) {
    const rewritten = await locate(site.ogImage, "site.link.ts → ogImage");
    site.ogImage =
      !isRemote(site.ogImage) && site.canonicalUrl
        ? `${site.canonicalUrl.replace(/\/$/, "")}/${rewritten}`
        : rewritten;
  }

  const theme: Sections["theme"] = {
    ...sections.theme,
    tokens: sections.theme.tokens ? { ...sections.theme.tokens } : undefined,
  };
  if (theme.tokens?.backgroundImage) {
    theme.tokens.backgroundImage = await locate(
      theme.tokens.backgroundImage,
      "config.link.ts → tokens.backgroundImage",
    );
  }

  const header = sections.header
    ? await Promise.all(
        sections.header.map(async (block, i) =>
          block.component === "profile" && typeof block.image === "string"
            ? { ...block, image: await locate(block.image, `header.link.ts → blocks[${i}].image`) }
            : block,
        ),
      )
    : null;

  // Phase 2: copy everything — only reached when all references are valid.
  if (planned.size > 0) {
    await mkdir(join(outDir, "assets"), { recursive: true });
    await Promise.all(
      [...planned].map(([abs, name]) => copyFile(abs, join(outDir, "assets", name))),
    );
  }

  return { ...sections, site, theme, header };
}
