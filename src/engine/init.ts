import { access, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { LoadError } from "./loadSections.js";

const SCHEMA_BASE = "https://raw.githubusercontent.com/brasillero/link-free/master/schemas";

const STARTER_FILES: Record<string, unknown> = {
  "link.site.json": {
    $schema: `${SCHEMA_BASE}/link.site.schema.json`,
    title: "Your Name — Links",
    description: "All my links in one place.",
  },
  "link.header.json": {
    $schema: `${SCHEMA_BASE}/link.header.schema.json`,
    blocks: [
      {
        component: "profile",
        image: "https://example.com/avatar.png",
        name: "Your Name",
        bio: "Something about you.",
      },
      {
        component: "socials",
        links: [{ icon: "website", url: "https://example.com", label: "Website" }],
      },
    ],
  },
  "link.body.json": {
    $schema: `${SCHEMA_BASE}/link.body.schema.json`,
    blocks: [{ component: "link", title: "My website", url: "https://example.com" }],
  },
  "link.footer.json": {
    $schema: `${SCHEMA_BASE}/link.footer.schema.json`,
    blocks: [{ component: "text", text: "Made with link-free" }],
  },
  "link.free.config.json": {
    $schema: `${SCHEMA_BASE}/link.free.config.schema.json`,
    theme: "light",
  },
};

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Scaffolds the five config files in `dir`. All-or-nothing: if any target
 * exists and `force` is not set, throws before writing anything.
 * Returns the created file names.
 */
export async function initProject(dir: string, options: { force?: boolean }): Promise<string[]> {
  const names = Object.keys(STARTER_FILES);
  const existing: string[] = [];
  for (const name of names) {
    if (await exists(join(dir, name))) existing.push(name);
  }
  if (existing.length > 0 && !options.force) {
    throw new LoadError(
      `config files already exist: ${existing.join(", ")} (use --force to overwrite)`,
    );
  }
  for (const name of names) {
    await writeFile(join(dir, name), JSON.stringify(STARTER_FILES[name], null, 2) + "\n", "utf8");
  }
  return names;
}
