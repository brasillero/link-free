import { access, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { LoadError } from "./loadSections.js";

const CONFIG_FILES: Record<string, string> = {
  "site.link.ts": `import type { SiteFile } from "link-free";

export default {
  title: "Your Name — Links",
  description: "All my links in one place.",
} satisfies SiteFile;
`,
  "header.link.ts": `import type { HeaderFile } from "link-free";

export default {
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
} satisfies HeaderFile;
`,
  "body.link.ts": `import type { BodyFile } from "link-free";

export default {
  blocks: [{ component: "link", title: "My website", url: "https://example.com" }],
} satisfies BodyFile;
`,
  "footer.link.ts": `import type { FooterFile } from "link-free";

export default {
  blocks: [{ component: "text", text: "Made with link-free" }],
} satisfies FooterFile;
`,
  "config.link.ts": `import type { ThemeConfig } from "link-free";

export default {
  theme: "light",
} satisfies ThemeConfig;
`,
};

const TSCONFIG = {
  compilerOptions: {
    target: "ES2022",
    module: "ESNext",
    moduleResolution: "Bundler",
    strict: true,
    noEmit: true,
    skipLibCheck: true,
  },
};

function sanitizeName(dir: string): string {
  const base = basename(dir).toLowerCase();
  const cleaned = base.replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "my-links";
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export interface InitResult {
  created: string[];
  skipped: string[];
}

/**
 * Framework-style scaffolding: package.json + tsconfig + five typed
 * [section].link.ts config files. Config collisions abort all-or-nothing
 * unless force is set; package.json/tsconfig.json are never overwritten.
 */
export async function initProject(dir: string, options: { force?: boolean }): Promise<InitResult> {
  const configNames = Object.keys(CONFIG_FILES);

  const colliding: string[] = [];
  for (const name of configNames) {
    if (await exists(join(dir, name))) colliding.push(name);
  }
  if (colliding.length > 0 && !options.force) {
    throw new LoadError(
      `config files already exist: ${colliding.join(", ")} (use --force to overwrite)`,
    );
  }

  const created: string[] = [];
  const skipped: string[] = [];

  const pkgPath = join(dir, "package.json");
  if (await exists(pkgPath)) {
    skipped.push("package.json");
  } else {
    const pkg = {
      name: sanitizeName(dir),
      private: true,
      type: "module",
      scripts: { build: "link-free build" },
      devDependencies: { "link-free": "^0.2.0" },
    };
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
    created.push("package.json");
  }

  const tsconfigPath = join(dir, "tsconfig.json");
  if (await exists(tsconfigPath)) {
    skipped.push("tsconfig.json");
  } else {
    await writeFile(tsconfigPath, JSON.stringify(TSCONFIG, null, 2) + "\n", "utf8");
    created.push("tsconfig.json");
  }

  for (const name of configNames) {
    await writeFile(join(dir, name), CONFIG_FILES[name], "utf8");
    created.push(name);
  }

  return { created, skipped };
}
