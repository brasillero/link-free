import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { build } from "../src/engine/build.js";

let dir: string;
let out: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "link-free-src-"));
  out = await mkdtemp(join(tmpdir(), "link-free-out-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  await rm(out, { recursive: true, force: true });
});

const write = (name: string, data: unknown) =>
  writeFile(join(dir, name), JSON.stringify(data), "utf8");

describe("build", () => {
  it("writes a complete index.html from a full fixture", async () => {
    await write("link.site.json", { title: "Jane — Links", description: "all my links" });
    await write("link.header.json", {
      blocks: [
        { component: "profile", image: "https://example.com/a.png", name: "Jane" },
        {
          component: "socials",
          links: [{ icon: "github", url: "https://github.com/jane", label: "GitHub" }],
        },
      ],
    });
    await write("link.body.json", {
      blocks: [{ component: "link", title: "Blog", url: "https://b.dev" }],
    });
    await write("link.footer.json", { blocks: [{ component: "text", text: "© 2026 Jane" }] });

    const outPath = await build(dir, join(out, "dist"));
    const html = await readFile(outPath, "utf8");

    expect(outPath).toBe(join(out, "dist", "index.html"));
    expect(html).toContain("<title>Jane — Links</title>");
    expect(html).toContain('<h1 class="text-2xl font-semibold text-ink">Jane</h1>');
    expect(html).toContain('href="https://github.com/jane"');
    expect(html).toContain('href="https://b.dev"');
    expect(html).toContain("© 2026 Jane");
  });

  it("does not write any output file on validation error", async () => {
    await write("link.body.json", { blocks: [{ component: "link", title: "x", url: "bad" }] });
    await expect(build(dir, join(out, "dist"))).rejects.toThrow(/blocks\[0\]\.url/);
    await expect(readFile(join(out, "dist", "index.html"), "utf8")).rejects.toThrow();
  });
});
