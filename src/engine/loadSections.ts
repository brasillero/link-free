import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  sectionFileSchema,
  siteFileSchema,
  themeConfigSchema,
  type SiteFile,
  type ThemeConfig,
} from "../schema/files.js";
import { COMPONENT_NAMES, registry, type ValidatedBlock } from "../components/registry.js";

export class LoadError extends Error {}

const SECTION_NAMES = ["header", "body", "footer"] as const;
type SectionName = (typeof SECTION_NAMES)[number];

/** Which components each section file accepts (spec §4.7). */
const SECTION_COMPONENTS: Record<SectionName, string[]> = {
  header: ["profile", "socials"],
  body: ["link"],
  footer: ["text"],
};

export interface Sections {
  site: SiteFile;
  theme: ThemeConfig;
  header: ValidatedBlock[] | null;
  body: ValidatedBlock[] | null;
  footer: ValidatedBlock[] | null;
}

async function readJsonFile(path: string): Promise<unknown | null> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null; // missing file → section omitted
    throw err; // unexpected I/O error — let it surface as-is
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new LoadError(`${path}: invalid JSON — ${(err as Error).message}`);
  }
}

function validateBlocks(raw: unknown, section: SectionName): ValidatedBlock[] {
  const fileName = `link.${section}.json`;
  const wrapper = sectionFileSchema.safeParse(raw);
  if (!wrapper.success) {
    throw new LoadError(`${fileName}: expected an object with a "blocks" array`);
  }
  return wrapper.data.blocks.map((block, i) => {
    const component = block.component;
    if (typeof component !== "string" || !Object.hasOwn(registry, component)) {
      throw new LoadError(
        `${fileName} → blocks[${i}]: unknown component "${String(component)}" (valid: ${COMPONENT_NAMES.join(", ")})`,
      );
    }
    if (!SECTION_COMPONENTS[section].includes(component)) {
      throw new LoadError(
        `${fileName} → blocks[${i}]: component "${component}" not allowed here (valid: ${SECTION_COMPONENTS[section].join(", ")})`,
      );
    }
    const result = registry[component].schema.safeParse(block);
    if (!result.success) {
      const issues = result.error.issues
        .map((issue) => `${fileName} → blocks[${i}].${issue.path.join(".")}: ${issue.message}`)
        .join("\n");
      throw new LoadError(issues);
    }
    return result.data as ValidatedBlock;
  });
}

export async function loadSections(dir: string): Promise<Sections> {
  const siteRaw = await readJsonFile(join(dir, "link.site.json"));
  const themeRaw = await readJsonFile(join(dir, "link.free.config.json"));

  const sections: Record<SectionName, ValidatedBlock[] | null> = {
    header: null,
    body: null,
    footer: null,
  };
  for (const name of SECTION_NAMES) {
    const raw = await readJsonFile(join(dir, `link.${name}.json`));
    if (raw != null) {
      sections[name] = validateBlocks(raw, name);
    }
  }

  if (siteRaw == null && themeRaw == null && SECTION_NAMES.every((n) => sections[n] == null)) {
    throw new LoadError(`no link.*.json files found in ${dir}`);
  }

  let site: SiteFile = {};
  if (siteRaw != null) {
    const parsed = siteFileSchema.safeParse(siteRaw);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((issue) => `link.site.json → ${issue.path.join(".")}: ${issue.message}`)
        .join("\n");
      throw new LoadError(issues);
    }
    site = parsed.data;
  }

  let theme: ThemeConfig = themeConfigSchema.parse({});
  if (themeRaw != null) {
    const parsed = themeConfigSchema.safeParse(themeRaw);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((issue) => `link.free.config.json → ${issue.path.join(".")}: ${issue.message}`)
        .join("\n");
      throw new LoadError(issues);
    }
    theme = parsed.data;
  }

  return { site, theme, ...sections };
}
