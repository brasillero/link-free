import { access } from "node:fs/promises";
import { createJiti } from "jiti";
import { LoadError } from "./loadSections.js";

const jiti = createJiti(import.meta.url);

/**
 * Loads a `[section].link.ts` config module's default export via jiti.
 * Returns null when the file does not exist. Load errors and missing
 * default exports are LoadErrors naming the file.
 */
export async function loadModule(path: string): Promise<unknown | null> {
  try {
    await access(path);
  } catch {
    return null;
  }
  let mod: unknown;
  try {
    mod = await jiti.import(path);
  } catch (err) {
    throw new LoadError(`${path}: failed to load — ${(err as Error).message}`);
  }
  // jiti's interop exposes a `.default` getter even for modules without a
  // default export, so check for a real own property instead of undefined.
  if (mod === null || typeof mod !== "object" || !Object.hasOwn(mod, "default")) {
    throw new LoadError(`${path}: expected a default export`);
  }
  return (mod as Record<string, unknown>).default;
}
