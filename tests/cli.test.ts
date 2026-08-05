import { execFileSync, execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const CLI = join("dist", "cli.js");

beforeAll(() => {
  execSync("pnpm build", { stdio: "inherit" });
}, 120_000);

describe("built CLI (dist smoke)", () => {
  it("prints usage with --help", () => {
    const out = execFileSync("node", [CLI, "--help"], { encoding: "utf8" });
    expect(out).toContain("link-free build");
  });

  it("builds from a .link.ts config", () => {
    const dir = mkdtempSync(join(tmpdir(), "lf-cli-"));
    try {
      writeFileSync(
        join(dir, "body.link.ts"),
        'export default { blocks: [{ component: "link", title: "Blog", url: "https://b.dev" }] }',
      );
      execFileSync("node", [CLI, "build", "--dir", dir], { encoding: "utf8" });
      const html = readFileSync(join(dir, "dist", "index.html"), "utf8");
      expect(html).toContain('href="https://b.dev"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects JSON-only dirs with the migration guard", () => {
    const dir = mkdtempSync(join(tmpdir(), "lf-cli-json-"));
    try {
      writeFileSync(join(dir, "link.body.json"), '{"blocks":[]}');
      let code = 0;
      try {
        execFileSync("node", [CLI, "build", "--dir", dir], { encoding: "utf8", stdio: "pipe" });
      } catch (err) {
        code = (err as { status: number }).status;
      }
      expect(code).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
