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

const write = (name: string, content: string) => writeFile(join(dir, name), content, "utf8");

describe("build", () => {
  it("writes a complete index.html from a full fixture", async () => {
    await write(
      "site.link.ts",
      `export default { title: "Jane — Links", description: "all my links" }`,
    );
    await write(
      "header.link.ts",
      `export default { blocks: [
  { component: "profile", image: "https://example.com/a.png", name: "Jane" },
  { component: "socials", links: [{ icon: "github", url: "https://github.com/jane", label: "GitHub" }] },
] }`,
    );
    await write(
      "body.link.ts",
      `export default { blocks: [{ component: "link", title: "Blog", url: "https://b.dev" }] }`,
    );
    await write(
      "footer.link.ts",
      `export default { blocks: [{ component: "text", text: "© 2026 Jane" }] }`,
    );

    const outPath = await build(dir, join(out, "dist"));
    const html = await readFile(outPath, "utf8");

    expect(outPath).toBe(join(out, "dist", "index.html"));
    expect(html).toContain("<title>Jane — Links</title>");
    expect(html).toContain('<h1 class="text-2xl font-semibold text-ink">Jane</h1>');
    expect(html).toContain('href="https://github.com/jane"');
    expect(html).toContain('href="https://b.dev"');
    expect(html).toContain("© 2026 Jane");
  });

  it("applies theme config end-to-end", async () => {
    await write(
      "config.link.ts",
      `export default { theme: "dark", tokens: { accent: "#f472b6" } }`,
    );
    await write(
      "body.link.ts",
      `export default { blocks: [{ component: "link", title: "Blog", url: "https://b.dev" }] }`,
    );

    const outPath = await build(dir, join(out, "dist"));
    const html = await readFile(outPath, "utf8");

    expect(html).toContain("--lf-accent: #f472b6;");
    expect(html).toContain("--lf-bg: #0a0a0a;");
    expect(html).toContain("<style>");
  });

  it("falls back to the light preset without a config file", async () => {
    await write(
      "body.link.ts",
      `export default { blocks: [{ component: "link", title: "Blog", url: "https://b.dev" }] }`,
    );

    const outPath = await build(dir, join(out, "dist"));
    const html = await readFile(outPath, "utf8");

    expect(html).toContain("--lf-bg: #fafafa;");
  });

  it("does not write any output file on validation error", async () => {
    await write(
      "body.link.ts",
      `export default { blocks: [{ component: "link", title: "x", url: "bad" }] }`,
    );
    await expect(build(dir, join(out, "dist"))).rejects.toThrow(/blocks\[0\]\.url/);
    await expect(readFile(join(out, "dist", "index.html"), "utf8")).rejects.toThrow();
  });

  it("copies local assets and rewrites references in the output", async () => {
    await write(
      "header.link.ts",
      `export default { blocks: [{ component: "profile", image: "./avatar.png", name: "Jane" }] }`,
    );
    await writeFile(join(dir, "avatar.png"), "fake-png-bytes");

    const outPath = await build(dir, join(out, "dist"));
    const html = await readFile(outPath, "utf8");

    expect(html).toContain('src="assets/avatar.png"');
    await expect(readFile(join(out, "dist", "assets", "avatar.png"), "utf8")).resolves.toBe(
      "fake-png-bytes",
    );
  });

  it("fails without writing index.html when a referenced asset is missing", async () => {
    await write(
      "header.link.ts",
      `export default { blocks: [{ component: "profile", image: "./missing.png", name: "Jane" }] }`,
    );
    await expect(build(dir, join(out, "dist"))).rejects.toThrow(/file not found/);
    await expect(readFile(join(out, "dist", "index.html"), "utf8")).rejects.toThrow();
  });
});
