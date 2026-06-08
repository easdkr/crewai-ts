=== README.md Packages + Monorepo + Development sections ===

--- Section headers ---
21:## Packages
32:## Installation
44:## Monorepo
828:## Development

--- Packages section (lines 21-) ---
## Packages

This repository is a pnpm workspace. The root `README.md` documents the public
package; per-package READMEs live next to each package's `package.json`.

| Package | Description | Path |
| --- | --- | --- |
| [`@crewai-ts/core`](https://www.npmjs.com/package/@crewai-ts/core) | Unofficial TypeScript port of CrewAI — agents, tasks, crews, flows, memory, knowledge, and checkpoints. | [`packages/core/`](./packages/core/) |
| `@crewai-ts/nestjs` | NestJS DI integration for `@crewai-ts/core` (DI tokens, modules, dynamic modules). | [`packages/nestjs/`](./packages/nestjs/) |
| `@crewai-ts/cli` | Command-line tool for scaffolding and inspecting CrewAI-style projects. | [`packages/cli/`](./packages/cli/) |

## Installation

--- Monorepo section start (line 44) ---
## Monorepo

This repo is a pnpm workspace (Node >= 22, pnpm 9.15.0). All work happens from
the repository root; per-package scripts are fanned out with `pnpm -r`.

```bash
# Install every workspace package (root + packages/*)
pnpm install


--- Development section (uses pnpm -r) ---
828:## Development
Section spans lines 828 to 850
## Development

This monorepo is built with [tsup](https://tsup.egoist.dev/) (ESM + CJS + type
declarations) and tested with [Vitest](https://vitest.dev/). Every script runs
across the workspace with `pnpm -r`; see the [Monorepo](#monorepo) section for
per-package variants and the [`pnpm-workspace.yaml`](./pnpm-workspace.yaml) for
the workspace layout.

```bash
pnpm -r build   # build ESM + CJS output and declarations for every package
pnpm -r check   # type-check in no-emit mode for every package
pnpm -r test    # run the Vitest suite for every package
pnpm -r lint    # run ESLint across the whole monorepo
```

### Build & test a single package

```bash
pnpm -F @crewai-ts/core build
pnpm -F @crewai-ts/core test
pnpm -F @crewai-ts/nestjs lint
```


--- Verdict: PASS (Packages + Monorepo sections present, Development uses pnpm -r) ---
