import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { build } from "./engine/build.js";
import { LoadError } from "./engine/loadSections.js";

const USAGE = "Usage: link-free build [--dir <path>] [--out <path>]";

async function main(): Promise<void> {
  let values: { dir: string; out: string; help: boolean };
  let positionals: string[];
  try {
    ({ values, positionals } = parseArgs({
      allowPositionals: true,
      options: {
        dir: { type: "string", default: "." },
        out: { type: "string", default: "dist" },
        help: { type: "boolean", short: "h", default: false },
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
  if (command !== "build" || positionals.length > 1) {
    console.error(USAGE);
    process.exit(1);
  }

  try {
    const outPath = await build(resolve(values.dir), resolve(values.out));
    console.log(`built ${outPath}`);
  } catch (err) {
    console.error(`error: ${(err as Error).message}`);
    process.exit(1);
  }
}

await main();
