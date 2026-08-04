import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initProject } from "../../src/engine/init.js";
import { headerFileSchema, siteFileSchema, themeConfigSchema } from "../../src/schema/files.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "lf-init-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const FILES = [
  "link.site.json",
  "link.header.json",
  "link.body.json",
  "link.footer.json",
  "link.free.config.json",
];

describe("initProject", () => {
  it("creates all five config files and returns their names", async () => {
    const created = await initProject(dir, {});
    expect(created.sort()).toEqual([...FILES].sort());
    for (const name of FILES) {
      const raw = await readFile(join(dir, name), "utf8");
      const parsed = JSON.parse(raw);
      expect(Object.keys(parsed)[0], `${name} starts with $schema`).toBe("$schema");
    }
  });

  it("starter content passes the real schemas", async () => {
    await initProject(dir, {});
    siteFileSchema.parse(JSON.parse(await readFile(join(dir, "link.site.json"), "utf8")));
    headerFileSchema.parse(JSON.parse(await readFile(join(dir, "link.header.json"), "utf8")));
    themeConfigSchema.parse(JSON.parse(await readFile(join(dir, "link.free.config.json"), "utf8")));
  });

  it("aborts on existing files, writing nothing, unless forced", async () => {
    await writeFile(join(dir, "link.site.json"), "{}");
    await expect(initProject(dir, {})).rejects.toThrow(
      /config files already exist: link\.site\.json \(use --force to overwrite\)/,
    );
    // nothing new written
    await expect(readFile(join(dir, "link.header.json"), "utf8")).rejects.toThrow();

    const created = await initProject(dir, { force: true });
    expect(created).toHaveLength(5);
    const site = JSON.parse(await readFile(join(dir, "link.site.json"), "utf8"));
    expect(site.title).toBe("Your Name — Links");
  });

  it("lists multiple existing files in the error", async () => {
    await writeFile(join(dir, "link.site.json"), "{}");
    await writeFile(join(dir, "link.body.json"), "{}");
    await expect(initProject(dir, {})).rejects.toThrow(
      /config files already exist: link\.site\.json, link\.body\.json/,
    );
  });
});
