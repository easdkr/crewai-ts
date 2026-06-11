# @crewai-ts/cli

[![npm version](https://img.shields.io/npm/v/@crewai-ts/cli.svg)](https://www.npmjs.com/package/@crewai-ts/cli)
[![license](https://img.shields.io/npm/l/@crewai-ts/cli.svg)](./LICENSE)
[![types](https://img.shields.io/npm/types/@crewai-ts/cli.svg)](https://www.npmjs.com/package/@crewai-ts/cli)

The `crewai-ts` command-line tool for running a user's CrewAI-style
TypeScript or JavaScript project.

`crewai-ts` validates a project directory, resolves the entry file, and
executes it through [tsx](https://tsx.is/). It is the default driver for
the `@crewai-ts/cli` template and any project scaffolded with the
TypeScript CrewAI patterns.

> **Unofficial project.** This is a community port of
> [CrewAI](https://github.com/crewAIInc/crewAI) and is **not affiliated with,
> endorsed by, or maintained by crewAI, Inc.** See
> [License](#license) for the upstream MIT notice.

## Install

```sh
# Global install — exposes the `crewai-ts` binary
npm install -g @crewai-ts/cli
# or
pnpm add -g @crewai-ts/cli

# Local install — invoke via `pnpm exec` / `npx`
npm install --save-dev @crewai-ts/cli
pnpm add -D @crewai-ts/cli
```

Requirements:

- Node.js 22 or later
- `@crewai-ts/core` installed in the target project
- `tsx` is bundled — no extra setup required for `.ts` entry files

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

The returned path is always relative to the project directory.

## Programmatic API

The package exposes a small programmatic surface for embedding the CLI
runner inside another Node.js tool or a test harness.

```ts
import { CLI_VERSION, findProjectEntry, main } from "@crewai-ts/cli";

// Run the CLI programmatically with an argv-style string array.
// `main` returns the process exit code (0 on success).
const exitCode = await main(["./my-project", "--inputs", '{"topic":"AI"}']);

// Resolve the entry file for a project without executing it.
const entry = findProjectEntry("./my-project");
```

`main` is the only async entry point that performs I/O; the rest of the
helpers are pure functions and are safe to call in tests.

## Exports

- `main(args)` — CLI entry point, returns the process exit code
- `findProjectEntry(projectPath)` — resolve the entry file for a project
- `CLI_VERSION` — current CLI version constant

The argument-parsing and project-validation helpers are intentionally
internal — the public surface above is the supported contract.

## Related Packages

- `@crewai-ts/core` — agents, tasks, crews, tools, hooks, security, checkpoints
- `@crewai-ts/rag` — memory, knowledge, vector stores, PDF parsing
- `@crewai-ts/flow` — stateful Flow orchestration
- `@crewai-ts/nestjs` — NestJS DI integration

## License

MIT

This project is an unofficial TypeScript port of
[CrewAI](https://github.com/crewAIInc/crewAI) (Copyright © crewAI, Inc.),
which is distributed under the MIT License. It is not affiliated with or
endorsed by crewAI, Inc. As required by the MIT License, the original
copyright and permission notice are retained in [LICENSE](./LICENSE).
