import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadSections } from "./loadSections.js";
import { renderPage } from "./renderPage.js";

export async function build(dir: string, outDir: string): Promise<string> {
  const sections = await loadSections(dir);
  const html = renderPage(sections);
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, "index.html");
  await writeFile(outPath, html, "utf8");
  return outPath;
}
