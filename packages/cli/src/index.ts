// CLI entry point for `crewai-ts`. Help/version/argv-error handling is wired here;
// full project-run wiring lands in task 14 (validate + spawn + runProject).
import { HELP_TEXT, parseArgs } from "./argv.js";

const VERSION = "0.1.0";
export const CLI_VERSION = VERSION;

export async function main(args: readonly string[]): Promise<number> {
  const parsed = parseArgs(args);

  if (parsed.version) {
    process.stdout.write(`crewai-ts v${VERSION}\n`);
    return 0;
  }

  if (parsed.help) {
    process.stdout.write(`${HELP_TEXT}\n`);
    return 0;
  }

  if (parsed.error !== null) {
    process.stderr.write(`crewai-ts: ${parsed.error}\n`);
    process.stderr.write(`Run "crewai-ts --help" for usage.\n`);
    return 2;
  }

  // Project execution path is wired in task 14. Until then, any non-help/version
  // invocation with a parsed <path> is a no-op success so the help/error path stays testable.
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main(process.argv.slice(2)).then(
    (code) => {
      process.exit(code);
    },
    (err: unknown) => {
      process.stderr.write(`crewai-ts: unexpected error: ${(err as Error).message ?? String(err)}\n`);
      process.exit(1);
    },
  );
}
