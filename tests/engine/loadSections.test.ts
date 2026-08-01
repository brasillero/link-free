import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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

const write = (name: string, data: unknown) =>
  writeFile(join(dir, name), typeof data === "string" ? data : JSON.stringify(data), "utf8");

describe("loadSections", () => {
  it("returns null sections when files are absent", async () => {
    await write("link.body.json", {
      blocks: [{ component: "link", title: "Blog", url: "https://b.dev" }],
    });
    const sections = await loadSections(dir);
    expect(sections.header).toBeNull();
    expect(sections.footer).toBeNull();
    expect(sections.site).toEqual({});
    expect(sections.body).toHaveLength(1);
  });

  it("throws when all four files are missing", async () => {
    await expect(loadSections(dir)).rejects.toThrow(/no link\.\*\.json files found/);
  });

  it("throws on malformed JSON, naming the file", async () => {
    await write("link.body.json", "{ not json");
    await expect(loadSections(dir)).rejects.toThrow(/link\.body\.json.*invalid JSON/);
  });

  it("throws on unknown component, listing valid names", async () => {
    await write("link.body.json", { blocks: [{ component: "carousel" }] });
    await expect(loadSections(dir)).rejects.toThrow(
      /blocks\[0\]: unknown component "carousel".*profile/,
    );
  });

  it("throws with zod issue path on schema failure", async () => {
    await write("link.body.json", {
      blocks: [{ component: "link", title: "Blog", url: "nope" }],
    });
    await expect(loadSections(dir)).rejects.toThrow(/blocks\[0\]\.url/);
  });

  it("validates blocks through the registry and strips unknown keys", async () => {
    await write("link.footer.json", {
      blocks: [{ component: "text", text: "hi", future: 1 }],
    });
    const sections = await loadSections(dir);
    expect(sections.footer).toEqual([{ component: "text", text: "hi" }]);
  });

  it("validates link.site.json when present", async () => {
    await write("link.site.json", { title: "Jane", canonicalUrl: "bad" });
    await expect(loadSections(dir)).rejects.toThrow(LoadError);
  });

  it("rejects a component that is not allowed in that section", async () => {
    await write("link.header.json", {
      blocks: [{ component: "link", title: "Blog", url: "https://b.dev" }],
    });
    await expect(loadSections(dir)).rejects.toThrow(
      /link\.header\.json → blocks\[0\]: component "link" not allowed here \(valid: profile, socials\)/,
    );
  });

  it("propagates unexpected read errors instead of treating them as missing files", async () => {
    // A directory named link.body.json triggers EISDIR (or EPERM on Windows) — not ENOENT.
    await mkdir(join(dir, "link.body.json"));
    await expect(loadSections(dir)).rejects.not.toThrow(/no link\.\*\.json files found/);
  });

  it("returns the default theme when link.free.config.json is absent", async () => {
    await write("link.body.json", {
      blocks: [{ component: "link", title: "Blog", url: "https://b.dev" }],
    });
    const sections = await loadSections(dir);
    expect(sections.theme).toEqual({ theme: "light" });
  });

  it("loads and validates link.free.config.json", async () => {
    await write("link.free.config.json", { theme: "dark", tokens: { accent: "#fff" } });
    const sections = await loadSections(dir);
    expect(sections.theme.theme).toBe("dark");
    expect(sections.theme.tokens?.accent).toBe("#fff");
  });

  it("rejects an unknown preset, listing valid themes", async () => {
    await write("link.free.config.json", { theme: "dracula" });
    await expect(loadSections(dir)).rejects.toThrow(
      /link\.free\.config\.json → theme: unknown theme "dracula" \(valid: light, dark, minimal\)/,
    );
  });

  it("rejects a bad token with a zod issue path", async () => {
    await write("link.free.config.json", { tokens: { radius: "huge" } });
    await expect(loadSections(dir)).rejects.toThrow(/link\.free\.config\.json → tokens\.radius/);
  });

  it("accepts a directory containing only link.free.config.json", async () => {
    await write("link.free.config.json", { theme: "dark" });
    const sections = await loadSections(dir);
    expect(sections.theme.theme).toBe("dark");
    expect(sections.header).toBeNull();
  });
});
