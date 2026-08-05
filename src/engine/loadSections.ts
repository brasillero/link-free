import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { sectionFileSchema, siteFileSchema, themeConfigSchema, type SiteFile, type ThemeConfig } from "../schema/files.js";
import { COMPONENT_NAMES, registry, type ValidatedBlock } from "../components/registry.js";
import { loadModule } from "./loadModule.js";

export class LoadError extends Error {}

const SECTION_NAMES = ["header", "body", "footer"] as const;
type SectionName = (typeof SECTION_NAMES)[number];

/** Which components each section file accepts (spec §4.7). */
export const SECTION_COMPONENTS: Record<SectionName, string[]> = {
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

function validateBlocks(raw: unknown, section: SectionName): ValidatedBlock[] {
  const fileName = `${section}.link.ts`;
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

function formatIssues(fileName: string, issues: { path: (string | number)[]; message: string }[]): LoadError {
  return new LoadError(
    issues.map((issue) => `${fileName} → ${issue.path.join(".")}: ${issue.message}`).join("\n"),
  );
}

export async function loadSections(dir: string): Promise<Sections> {
  const siteRaw = await loadModule(join(dir, "site.link.ts"));
  const themeRaw = await loadModule(join(dir, "config.link.ts"));

  const sections: Record<SectionName, ValidatedBlock[] | null> = {
    header: null,
    body: null,
    footer: null,
  };
  for (const name of SECTION_NAMES) {
    const raw = await loadModule(join(dir, `${name}.link.ts`));
    if (raw != null) {
      sections[name] = validateBlocks(raw, name);
    }
  }

  const nothingFound =
    siteRaw == null && themeRaw == null && SECTION_NAMES.every((n) => sections[n] == null);

  if (nothingFound) {
    // Migration guard: stale JSON configs get a clear message instead of silence.
    const entries = await readdir(dir).catch(() => [] as string[]);
    if (entries.some((e) => /^link\.(site|header|body|footer|free\.config)\.json$/.test(e))) {
      throw new LoadError(
        `JSON configs are no longer supported as of v0.2.0 — convert them to <section>.link.ts modules`,
      );
    }
    throw new LoadError(`no *.link.ts config files found in ${dir}`);
  }

  let site: SiteFile = {};
  if (siteRaw != null) {
    const parsed = siteFileSchema.safeParse(siteRaw);
    if (!parsed.success) throw formatIssues("site.link.ts", parsed.error.issues);
    site = parsed.data;
  }

  let theme: ThemeConfig = themeConfigSchema.parse({});
  if (themeRaw != null) {
    const parsed = themeConfigSchema.safeParse(themeRaw);
    if (!parsed.success) throw formatIssues("config.link.ts", parsed.error.issues);
    theme = parsed.data;
  }

  return { site, theme, ...sections };
}
