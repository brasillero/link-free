import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadSections, LoadError } from "../../src/engine/loadSections.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "link-free-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const write = (name: string, content: string) => writeFile(join(dir, name), content, "utf8");

describe("loadSections", () => {
  it("returns null sections when files are absent", async () => {
    await write("body.link.ts", `export default { blocks: [{ component: "link", title: "Blog", url: "https://b.dev" }] }`);
    const sections = await loadSections(dir);
    expect(sections.header).toBeNull();
    expect(sections.footer).toBeNull();
    expect(sections.site).toEqual({});
    expect(sections.theme).toEqual({ theme: "light" });
    expect(sections.body).toHaveLength(1);
  });

  it("throws when all five files are missing", async () => {
    await expect(loadSections(dir)).rejects.toThrow(/no \*\.link\.ts config files found/);
  });

  it("throws the migration guard when only JSON configs are present", async () => {
    await write("link.body.json", `{ "blocks": [] }`);
    await expect(loadSections(dir)).rejects.toThrow(
      /JSON configs are no longer supported as of v0\.2\.0/,
    );
  });

  it("throws on a module load error, naming the file", async () => {
    await write("body.link.ts", `export default { blocks: [`);
    await expect(loadSections(dir)).rejects.toThrow(/body\.link\.ts.*failed to load/);
  });

  it("throws on unknown component, listing valid names", async () => {
    await write("body.link.ts", `export default { blocks: [{ component: "carousel" }] }`);
    await expect(loadSections(dir)).rejects.toThrow(
      /blocks\[0\]: unknown component "carousel".*profile/,
    );
  });

  it("throws with zod issue path on schema failure", async () => {
    await write("body.link.ts", `export default { blocks: [{ component: "link", title: "Blog", url: "nope" }] }`);
    await expect(loadSections(dir)).rejects.toThrow(/blocks\[0\]\.url/);
  });

  it("validates blocks through the registry and strips unknown keys", async () => {
    await write("footer.link.ts", `export default { blocks: [{ component: "text", text: "hi", future: 1 }] }`);
    const sections = await loadSections(dir);
    expect(sections.footer).toEqual([{ component: "text", text: "hi" }]);
  });

  it("validates site.link.ts when present", async () => {
    await write("site.link.ts", `export default { title: "Jane", canonicalUrl: "bad" }`);
    await expect(loadSections(dir)).rejects.toThrow(LoadError);
  });

  it("rejects a component that is not allowed in that section", async () => {
    await write("header.link.ts", `export default { blocks: [{ component: "link", title: "Blog", url: "https://b.dev" }] }`);
    await expect(loadSections(dir)).rejects.toThrow(
      /header\.link\.ts → blocks\[0\]: component "link" not allowed here \(valid: profile, socials\)/,
    );
  });

  it("loads and validates config.link.ts", async () => {
    await write("config.link.ts", `export default { theme: "dark", tokens: { accent: "#fff" } }`);
    const sections = await loadSections(dir);
    expect(sections.theme.theme).toBe("dark");
    expect(sections.theme.tokens?.accent).toBe("#fff");
  });

  it("rejects an unknown preset, listing valid themes", async () => {
    await write("config.link.ts", `export default { theme: "dracula" }`);
    await expect(loadSections(dir)).rejects.toThrow(
      /config\.link\.ts → theme: unknown theme "dracula" \(valid: light, dark, minimal\)/,
    );
  });

  it("rejects a bad token with a zod issue path", async () => {
    await write("config.link.ts", `export default { tokens: { radius: "huge" } }`);
    await expect(loadSections(dir)).rejects.toThrow(/config\.link\.ts → tokens\.radius/);
  });

  it("accepts a directory containing only config.link.ts", async () => {
    await write("config.link.ts", `export default { theme: "dark" }`);
    const sections = await loadSections(dir);
    expect(sections.theme.theme).toBe("dark");
    expect(sections.header).toBeNull();
  });
});
