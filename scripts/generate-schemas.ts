import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  bodyFileSchema,
  footerFileSchema,
  headerFileSchema,
  siteFileSchema,
  themeConfigSchema,
} from "../src/schema/files.js";

const BASE = "https://raw.githubusercontent.com/brasillero/link-free/master/schemas";

const targets = {
  "link.site.schema.json": siteFileSchema,
  "link.header.schema.json": headerFileSchema,
  "link.body.schema.json": bodyFileSchema,
  "link.footer.schema.json": footerFileSchema,
  "link.free.config.schema.json": themeConfigSchema,
};

const outDir =
  process.env.SCHEMAS_OUT ?? join(dirname(fileURLToPath(import.meta.url)), "..", "schemas");
mkdirSync(outDir, { recursive: true });

for (const [name, schema] of Object.entries(targets)) {
  const jsonSchema = zodToJsonSchema(schema, { $refStrategy: "none" }) as Record<string, unknown>;
  jsonSchema.$id = `${BASE}/${name}`;
  jsonSchema.$schema = "http://json-schema.org/draft-07/schema#";
  writeFileSync(join(outDir, name), JSON.stringify(jsonSchema, null, 2) + "\n");
  console.log(`wrote ${name}`);
}
