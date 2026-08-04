import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FILES = [
  "link.site.schema.json",
  "link.header.schema.json",
  "link.body.schema.json",
  "link.footer.schema.json",
  "link.free.config.schema.json",
];

describe("generated JSON schemas", () => {
  it("are in sync with the zod schemas (run pnpm schemas to fix)", () => {
    const scratch = mkdtempSync(join(tmpdir(), "lf-schemas-"));
    try {
      execSync("pnpm schemas", {
        env: { ...process.env, SCHEMAS_OUT: scratch },
        stdio: "pipe",
      });
      for (const name of FILES) {
        const generated = readFileSync(join(scratch, name), "utf8");
        const tracked = readFileSync(join("schemas", name), "utf8");
        expect(generated, `${name} is stale — run \`pnpm schemas\``).toBe(tracked);
      }
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  it("all five tracked files exist and carry a stable $id", () => {
    for (const name of FILES) {
      const schema = JSON.parse(readFileSync(join("schemas", name), "utf8"));
      expect(schema.$id).toBe(
        `https://raw.githubusercontent.com/brasillero/link-free/master/schemas/${name}`,
      );
    }
  });
});
