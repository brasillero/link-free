import { access, copyFile, mkdir } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import { LoadError, type Sections } from "./loadSections.js";

function isRemote(ref: string): boolean {
  try {
    return Boolean(new URL(ref).protocol);
  } catch {
    return false;
  }
}

/**
 * Copies locally-referenced assets into `<outDir>/assets/` and rewrites the
 * references in the loaded sections. Absolute URLs pass through untouched.
 */
export async function processAssets(
  sections: Sections,
  dir: string,
  outDir: string,
): Promise<Sections> {
  const root = resolve(dir);
  const targetBySource = new Map<string, string>();
  const sourceByName = new Map<string, string>();

  async function relocate(ref: string, field: string): Promise<string> {
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

    const name = basename(abs);
    const prior = sourceByName.get(name);
    if (prior && prior !== abs) {
      throw new LoadError(`asset name collision: ${prior} and ${abs} both map to assets/${name}`);
    }
    sourceByName.set(name, abs);

    await mkdir(join(outDir, "assets"), { recursive: true });
    await copyFile(abs, join(outDir, "assets", name));

    const target = `assets/${name}`;
    targetBySource.set(abs, target);
    return target;
  }

  const site = { ...sections.site };
  if (site.ogImage) {
    const rewritten = await relocate(site.ogImage, "link.site.json → ogImage");
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
    theme.tokens.backgroundImage = await relocate(
      theme.tokens.backgroundImage,
      "link.free.config.json → tokens.backgroundImage",
    );
  }

  const header = sections.header
    ? await Promise.all(
        sections.header.map(async (block, i) =>
          block.component === "profile" && typeof block.image === "string"
            ? { ...block, image: await relocate(block.image, `link.header.json → blocks[${i}].image`) }
            : block,
        ),
      )
    : null;

  return { ...sections, site, theme, header };
}
