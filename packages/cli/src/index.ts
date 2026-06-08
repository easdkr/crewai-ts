// CLI entry point for `crewai-ts`.
// Wires argv parsing, project validation, and tsx-based project execution.
// The bin is just orchestration: each concern lives in its own module
// (argv, validate-project, spawn) so the bin stays small and testable.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HELP_TEXT, parseArgs } from "./argv.js";
import { runProject } from "./spawn.js";
import { validateProject } from "./validate-project.js";

const VERSION = "0.1.0";
export const CLI_VERSION = VERSION;

/**
 * Locate the entry file for a user project.
 *
 * Resolution order:
 *   1. `index.ts` at the project root
 *   2. `src/index.ts`
 *   3. `main.ts` at the project root
 *   4. `package.json` "main" (with `.ts` appended if not already a .ts path)
 *   5. Default: `index.ts`
 *
 * Always returns a relative path that should be joined to `projectPath`.
 */
export function findProjectEntry(projectPath: string): string {
  const candidates = ["index.ts", "src/index.ts", "main.ts"];
  for (const c of candidates) {
    if (existsSync(join(projectPath, c))) return c;
  }
  try {
    const pkgRaw = readFileSync(join(projectPath, "package.json"), "utf8");
    const pkg = JSON.parse(pkgRaw) as { main?: unknown };
    if (typeof pkg.main === "string" && pkg.main.length > 0) {
      return pkg.main.endsWith(".ts") ? pkg.main : `${pkg.main}.ts`;
    }
  } catch {
    // Fall through to the default.
  }
  return "index.ts";
}

export async function main(args: readonly string[]): Promise<number> {
  const parsed = parseArgs(args);

  // --help and --version short-circuit before any path validation so
  // `crewai-ts --help` works even from an empty cwd.
  if (parsed.help) {
    process.stdout.write(`${HELP_TEXT}\n`);
    return 0;
  }
  if (parsed.version) {
    process.stdout.write(`crewai-ts v${VERSION}\n`);
    return 0;
  }
  if (parsed.error !== null) {
    process.stderr.write(`crewai-ts: ${parsed.error}\n\n${HELP_TEXT}`);
    return 2;
  }
  if (parsed.path === null) {
    process.stderr.write(`crewai-ts: missing <project-path>\n\n${HELP_TEXT}`);
    return 2;
  }

  const validation = validateProject(parsed.path);
  if (!validation.valid) {
    process.stderr.write(`crewai-ts: ${validation.error}\n`);
    return 2;
  }

  const file = findProjectEntry(parsed.path);
  const result = await runProject({
    projectPath: parsed.path,
    file,
    inputs: parsed.inputs,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.exitCode;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main(process.argv.slice(2)).then(
    (code) => {
      process.exit(code);
    },
    (err: unknown) => {
      process.stderr.write(
        `crewai-ts: unexpected error: ${(err as Error).message ?? String(err)}\n`,
      );
      process.exit(1);
    },
  );
}
