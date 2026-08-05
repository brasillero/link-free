import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { build } from "./engine/build.js";
import { initProject } from "./engine/init.js";
import { resolveOutDir } from "./outPath.js";

const USAGE =
  "Usage: link-free <command>\n  link-free build [--dir <path>] [--out <path>]  (default output: <dir>/dist)\n  link-free init [--dir <path>] [--force]";

async function main(): Promise<void> {
  let values: { dir: string; out?: string | undefined; help: boolean; force: boolean };
  let positionals: string[];
  try {
    ({ values, positionals } = parseArgs({
      allowPositionals: true,
      options: {
        dir: { type: "string", default: "." },
        out: { type: "string" },
        help: { type: "boolean", short: "h", default: false },
        force: { type: "boolean", default: false },
      },
    }));
  } catch (err) {
    console.error(`error: ${(err as Error).message}`);
    console.error(USAGE);
    process.exit(1);
  }

  const command = positionals[0];

  if (values.help) {
    console.log(USAGE);
    return;
  }
  if ((command !== "build" && command !== "init") || positionals.length > 1) {
    console.error(USAGE);
    process.exit(1);
  }

  if (command === "init") {
    try {
      const result = await initProject(resolve(values.dir), { force: values.force });
      console.log(`created ${result.created.length} files:`);
      for (const name of result.created) console.log(`  ${name}`);
      for (const name of result.skipped) console.log(`  ${name} (kept existing)`);
      console.log("\nnext: pnpm install (or npm/yarn install), then pnpm build");
    } catch (err) {
      console.error(`error: ${(err as Error).message}`);
      process.exit(1);
    }
    return;
  }

  try {
    const dir = resolve(values.dir);
    const outPath = await build(dir, resolveOutDir(dir, values.out));
    console.log(`built ${outPath}`);
  } catch (err) {
    console.error(`error: ${(err as Error).message}`);
    process.exit(1);
  }
}

await main();
