import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initProject } from "../../src/engine/init.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "lf-init-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const CONFIG_FILES = [
  "site.link.ts",
  "header.link.ts",
  "body.link.ts",
  "footer.link.ts",
  "config.link.ts",
];

describe("initProject", () => {
  it("scaffolds package.json, tsconfig, and five typed config files", async () => {
    const result = await initProject(dir, {});
    expect(result.created.sort()).toEqual(
      [...CONFIG_FILES, "package.json", "tsconfig.json"].sort(),
    );

    const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
    expect(pkg.private).toBe(true);
    expect(pkg.devDependencies["link-free"]).toBe("^0.2.0");
    expect(pkg.scripts.build).toBe("link-free build");

    const header = await readFile(join(dir, "header.link.ts"), "utf8");
    expect(header).toContain('import type { HeaderFile } from "link-free";');
    expect(header).toContain("satisfies HeaderFile");

    const config = await readFile(join(dir, "config.link.ts"), "utf8");
    expect(config).toContain("satisfies ThemeConfig");
  });

  it("uses a sanitized directory name for package.json", async () => {
    const nested = join(dir, "My Cool Site");
    await mkdir(nested);
    const result = await initProject(nested, {});
    const pkg = JSON.parse(await readFile(join(nested, "package.json"), "utf8"));
    expect(pkg.name).toBe("my-cool-site");
    expect(result.created).toContain("package.json");
  });

  it("never overwrites an existing package.json or tsconfig.json", async () => {
    await writeFile(join(dir, "package.json"), `{ "name": "keep-me" }`);
    await writeFile(join(dir, "tsconfig.json"), `{ "compilerOptions": {} }`);
    const result = await initProject(dir, {});
    expect(result.skipped.sort()).toEqual(["package.json", "tsconfig.json"]);
    const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
    expect(pkg.name).toBe("keep-me");
    expect(result.created.sort()).toEqual([...CONFIG_FILES].sort());
  });

  it("aborts on existing config files, writing nothing, unless forced", async () => {
    await writeFile(join(dir, "header.link.ts"), `export default {}`);
    await expect(initProject(dir, {})).rejects.toThrow(
      /config files already exist: header\.link\.ts \(use --force to overwrite\)/,
    );
    await expect(readFile(join(dir, "body.link.ts"), "utf8")).rejects.toThrow();

    const result = await initProject(dir, { force: true });
    expect(result.created).toContain("header.link.ts");
  });

  it("lists multiple existing config files in the error", async () => {
    await writeFile(join(dir, "site.link.ts"), `export default {}`);
    await writeFile(join(dir, "body.link.ts"), `export default {}`);
    await expect(initProject(dir, {})).rejects.toThrow(
      /config files already exist: site\.link\.ts, body\.link\.ts/,
    );
  });
});
