import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadModule } from "../../src/engine/loadModule.js";
import { LoadError } from "../../src/engine/loadSections.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "lf-mod-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("loadModule", () => {
  it("returns null for a missing file", async () => {
    await expect(loadModule(join(dir, "nope.link.ts"))).resolves.toBeNull();
  });

  it("loads a typed TS module's default export", async () => {
    await writeFile(
      join(dir, "header.link.ts"),
      `import type { HeaderFile } from "link-free";
export default {
  blocks: [{ component: "profile", image: "./a.png", name: "Jane" }],
} satisfies HeaderFile;
`,
    );
    const data = await loadModule(join(dir, "header.link.ts"));
    expect(data).toEqual({
      blocks: [{ component: "profile", image: "./a.png", name: "Jane" }],
    });
  });

  it("throws LoadError on a syntax error, naming the file", async () => {
    await writeFile(join(dir, "bad.link.ts"), `export default { blocks: [`);
    await expect(loadModule(join(dir, "bad.link.ts"))).rejects.toThrow(LoadError);
    await expect(loadModule(join(dir, "bad.link.ts"))).rejects.toThrow(/failed to load/);
  });

  it("throws when there is no default export", async () => {
    await writeFile(join(dir, "nodefault.link.ts"), `export const x = 1;`);
    await expect(loadModule(join(dir, "nodefault.link.ts"))).rejects.toThrow(
      /expected a default export/,
    );
  });
});
