import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { processAssets } from "../../src/engine/assets.js";
import type { Sections } from "../../src/engine/loadSections.js";

let dir: string;
let out: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "lf-assets-src-"));
  out = await mkdtemp(join(tmpdir(), "lf-assets-out-"));
  await writeFile(join(dir, "avatar.png"), "png-bytes");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  await rm(out, { recursive: true, force: true });
});

const base: Sections = {
  site: {},
  theme: { theme: "light" },
  header: null,
  body: null,
  footer: null,
};

describe("processAssets", () => {
  it("copies a local profile image and rewrites the reference", async () => {
    const sections: Sections = {
      ...base,
      header: [{ component: "profile", image: "./avatar.png", name: "Jane" }],
    };
    const result = await processAssets(sections, dir, out);
    expect(result.header?.[0].image).toBe("assets/avatar.png");
    await expect(readdir(join(out, "assets"))).resolves.toEqual(["avatar.png"]);
  });

  it("passes absolute URLs through untouched", async () => {
    const sections: Sections = {
      ...base,
      header: [{ component: "profile", image: "https://cdn.example.com/a.png", name: "Jane" }],
    };
    const result = await processAssets(sections, dir, out);
    expect(result.header?.[0].image).toBe("https://cdn.example.com/a.png");
  });

  it("throws on a missing local file, naming the config field", async () => {
    const sections: Sections = {
      ...base,
      header: [{ component: "profile", image: "./nope.png", name: "Jane" }],
    };
    await expect(processAssets(sections, dir, out)).rejects.toThrow(
      /link\.header\.json → blocks\[0\]\.image: file not found: \.\/nope\.png/,
    );
  });

  it("rejects paths escaping the config directory", async () => {
    const sections: Sections = {
      ...base,
      header: [{ component: "profile", image: "../outside.png", name: "Jane" }],
    };
    await expect(processAssets(sections, dir, out)).rejects.toThrow(/outside the config directory/);
  });

  it("throws on basename collisions between different source files", async () => {
    await mkdir(join(dir, "images"));
    await writeFile(join(dir, "a.png"), "one");
    await writeFile(join(dir, "images", "a.png"), "two");
    const sections: Sections = {
      ...base,
      site: { ogImage: "./a.png" },
      theme: { theme: "light", tokens: { backgroundImage: "images/a.png" } },
    };
    await expect(processAssets(sections, dir, out)).rejects.toThrow(/asset name collision/);
  });

  it("copies a file referenced twice only once", async () => {
    const sections: Sections = {
      ...base,
      site: { ogImage: "./avatar.png" },
      header: [{ component: "profile", image: "./avatar.png", name: "Jane" }],
    };
    const result = await processAssets(sections, dir, out);
    expect(result.header?.[0].image).toBe("assets/avatar.png");
    await expect(readdir(join(out, "assets"))).resolves.toEqual(["avatar.png"]);
  });

  it("absolutizes a local ogImage against canonicalUrl", async () => {
    const sections: Sections = {
      ...base,
      site: { ogImage: "./avatar.png", canonicalUrl: "https://links.jane.dev" },
    };
    const result = await processAssets(sections, dir, out);
    expect(result.site.ogImage).toBe("https://links.jane.dev/assets/avatar.png");
  });

  it("rewrites a local backgroundImage in theme tokens", async () => {
    const sections: Sections = {
      ...base,
      theme: { theme: "dark", tokens: { backgroundImage: "./avatar.png" } },
    };
    const result = await processAssets(sections, dir, out);
    expect(result.theme.tokens?.backgroundImage).toBe("assets/avatar.png");
  });

  it("rejects a directory referenced as an asset", async () => {
    await mkdir(join(dir, "adir"));
    const sections: Sections = {
      ...base,
      header: [{ component: "profile", image: "./adir", name: "Jane" }],
    };
    await expect(processAssets(sections, dir, out)).rejects.toThrow(/file not found/);
  });

  it("leaves no assets behind when a later reference fails", async () => {
    const sections: Sections = {
      ...base,
      site: { ogImage: "./avatar.png" },
      header: [{ component: "profile", image: "./missing.png", name: "Jane" }],
    };
    await expect(processAssets(sections, dir, out)).rejects.toThrow(/file not found/);
    await expect(readdir(join(out, "assets"))).rejects.toThrow();
  });

  it("treats a Windows drive-letter path as local (clear error, not passthrough)", async () => {
    const sections: Sections = {
      ...base,
      header: [{ component: "profile", image: "C:\\img\\a.png", name: "Jane" }],
    };
    await expect(processAssets(sections, dir, out)).rejects.toThrow(/outside the config directory|file not found/);
  });
});
