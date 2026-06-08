export interface ParsedArgs {
  path: string | null;
  inputs: Record<string, unknown> | null;
  help: boolean;
  version: boolean;
  error: string | null;
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const result: ParsedArgs = {
    path: null,
    inputs: null,
    help: false,
    version: false,
    error: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--version" || arg === "-v") {
      result.version = true;
    } else if (arg === "--inputs") {
      const value = argv[++i];
      if (value === undefined) {
        result.error = "--inputs requires a JSON string value";
        return result;
      }
      try {
        const parsed: unknown = JSON.parse(value);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          result.error = "--inputs must be a JSON object";
          return result;
        }
        result.inputs = parsed as Record<string, unknown>;
      } catch (e) {
        result.error = `--inputs must be valid JSON: ${(e as Error).message}`;
        return result;
      }
    } else if (arg?.startsWith("--")) {
      result.error = `unknown flag: ${arg}`;
      return result;
    } else if (arg !== undefined && result.path === null) {
      result.path = arg;
    } else if (arg !== undefined) {
      result.error = `unexpected extra argument: ${arg}`;
      return result;
    }
  }

  if (!result.help && !result.version && result.path === null) {
    result.error = "missing required <path> argument";
  }

  return result;
}

export const HELP_TEXT = `Usage: crewai-ts <project-path> [options]

Run a crewai-ts project.

Arguments:
  <project-path>              Path to a directory with a package.json that depends on @crewai-ts/core.

Options:
  --inputs <json>             JSON object passed as kickoff inputs.
  -h, --help                  Show this help.
  -v, --version               Show version.
`;
