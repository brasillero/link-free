import { resolve } from "node:path";

/**
 * Where the built index.html goes.
 * No explicit --out → <dir>/dist. Explicit --out → resolved against the cwd.
 */
export function resolveOutDir(dir: string, out: string | undefined): string {
  return out === undefined ? resolve(dir, "dist") : resolve(out);
}
