# link-free — `init` Command Design Spec

**Date:** 2026-08-05
**Status:** Approved (design decisions made in chat)

## 1. Goal

`link-free init` scaffolds the five config files in a user's project, so nobody has to remember file names or block shapes. Generated files include the `"$schema"` URLs, so editor autocomplete works from the first second.

## 2. CLI

```
link-free init [--dir <path>] [--force]
```

- `--dir`: target directory. Default: current working directory.
- `--force`: overwrite existing config files (see §3).

Success prints the created file names and a next-steps hint: edit the files, then run `link-free build`. Exit code 0 on success, 1 on any error, matching the existing CLI discipline (parse errors, usage, clean one-line `error:` messages).

## 3. Behavior

- **Static starter files** (no interactive prompts).
- Creates: `link.site.json`, `link.header.json`, `link.body.json`, `link.footer.json`, `link.free.config.json`.
- **Collision rule:** if ANY of the five files already exists in `--dir`, abort before writing anything: `error: config files already exist: link.site.json, link.header.json (use --force to overwrite)`, exit 1. With `--force`, all five are (re)written.
- Writes are all-or-nothing: no partial scaffold.

## 4. Starter content

Generic placeholders (not the Jane Doe example data):

- `link.site.json`: `{ "$schema": "<site schema URL>", "title": "Your Name — Links", "description": "All my links in one place." }`
- `link.header.json`: `$schema` + one `profile` block (name "Your Name", image `https://example.com/avatar.png`, bio "Something about you.") + one `socials` block with a single `website` entry pointing at `https://example.com`.
- `link.body.json`: `$schema` + one `link` block (title "My website", url `https://example.com`).
- `link.footer.json`: `$schema` + one `text` block ("Made with link-free").
- `link.free.config.json`: `$schema` + `{ "theme": "light" }`.

Schema URLs are the stable `$id`s from the JSON-schemas spec (`https://raw.githubusercontent.com/brasillero/link-free/master/schemas/<name>`).

## 5. Architecture

- New `src/engine/init.ts`: `initProject(dir, options: { force?: boolean }): Promise<string[]>` — pure-ish, returns the list of created file names; throws `LoadError` on collision. File contents are constants in the module.
- `src/cli.ts`: new `init` positional branch alongside `build`; `--force` boolean flag added to parseArgs options; USAGE updated to show both commands.
- Starter content is written with `JSON.stringify(obj, null, 2) + "\n"` from literal objects (key order preserved: `$schema` first).

## 6. Testing

- **Unit** (`tests/engine/init.test.ts`, tmp dirs): creates all five files with `$schema` first key and valid JSON that passes the real zod schemas; collision aborts with the exact error and writes nothing; `--force` overwrites; returns created file list.
- **CLI smoke** (manual/scripted): `node dist/cli.js init --dir <tmp>` creates files; second run aborts; `link-free build --dir <tmp>` then builds successfully from the scaffold (the starter content must validate and build end-to-end).
- **README**: add `init` to the Usage section.

## 7. Out of scope

- Interactive prompts (static was chosen; can be a later enhancement).
- `git init`, package.json scaffolding, or deployment setup.
