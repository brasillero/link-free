import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { build } from "./engine/build.js";
import { LoadError } from "./engine/loadSections.js";

const USAGE = "Usage: link-free build [--dir <path>] [--out <path>]";

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      dir: { type: "string", default: "." },
      out: { type: "string", default: "dist" },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  const command = positionals[0];

  if (values.help) {
    console.log(USAGE);
    return;
  }
  if (command !== "build") {
    console.error(USAGE);
    process.exit(1);
  }

  try {
    const outPath = await build(resolve(values.dir), resolve(values.out));
    console.log(`built ${outPath}`);
  } catch (err) {
    if (err instanceof LoadError) {
      console.error(`error: ${err.message}`);
    } else {
      console.error(err);
    }
    process.exit(1);
  }
}

await main();
