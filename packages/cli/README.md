# @crewai-ts/cli

[![npm version](https://img.shields.io/npm/v/@crewai-ts/cli.svg)](https://www.npmjs.com/package/@crewai-ts/cli)

CLI to run a user's crewai-ts project (TypeScript/JavaScript) via tsx.

This package provides the `crewai-ts` command-line tool that validates a project directory and executes it using tsx.

## Install

```sh
npm install -g @crewai-ts/cli
# or locally
npm install --save-dev @crewai-ts/cli
```

Requirements:

- Node.js 22 or later
- `@crewai-ts/core` installed in the target project

## Usage

```sh
# Run a project directory
crewai-ts ./my-crew-project

# Pass inputs as JSON
crewai-ts ./my-crew-project --inputs '{"topic":"CrewAI"}'

# Show help
crewai-ts --help

# Show version
crewai-ts --version
```

## Project Entry Resolution

The CLI resolves the project entry file in this order:

1. `index.ts` at the project root
2. `src/index.ts`
3. `main.ts` at the project root
4. `package.json` `"main"` field (with `.ts` appended if needed)
5. Default: `index.ts`

## Programmatic API

```ts
import { main, findProjectEntry, CLI_VERSION } from "@crewai-ts/cli";

// Run the CLI programmatically
const exitCode = await main(["./my-project", "--inputs", '{"topic":"AI"}']);

// Find the entry file for a project
const entry = findProjectEntry("./my-project");
```

## Exports

- `main(args)` — CLI entry point, returns exit code
- `findProjectEntry(projectPath)` — resolve the entry file for a project
- `CLI_VERSION` — current CLI version
- `parseArgs`, `HELP_TEXT` — argument parsing utilities
- `runProject` — project execution helper
- `validateProject` — project validation helper

## License

MIT
