# Draft: NestJS monorepo restructure for `@crewai-ts/core`

## Context
- Repo: `/Users/june/workspace/personal/crewai-ts`
- Current: single-package `@crewai-ts/core` v0.1.11, 851 passing tests, full upstream parity
- Build: tsup (ESM+CJS, 3 entries), tsc (declarations), vitest, eslint, typescript 6
- Source tree: `src/` is COMPLETELY FLAT (83 files, 0 subdirs)
- Test tree: `test/index.test.ts` single 1.9MB file, 3 `../src/*.js` imports
- Hard constraints: keep `experimentalDecorators: false` in core, no `reflect-metadata`, no core API changes

## Final decisions (locked in)
- **Packages (3)**: `packages/core/` (move in-place, keep name `@crewai-ts/core`), `packages/nestjs/` (new), `packages/cli/` (new)
- **NestJS surface**: `CrewModule.forRoot({ llm, memory, knowledge })` + `forRootAsync({ useFactory, inject, imports })`. DI providers only.
- **CLI scope**: `crewai-ts <project-path> --inputs '{"x":1}'` runs user's TS/JS file via tsx. Binary name: `crewai-ts`.
- **Migration**: move `src/`, `test/`, `scripts/`, `examples/`, configs into `packages/core/`. Move `scripts/` (Metis recommendation, ROOT auto-resolves). Keep npm package name `@crewai-ts/core`.
- **Tooling**: pnpm workspaces, root `tsconfig.base.json` + per-package extends
- **CLI runtime**: tsx (shipped as CLI's runtime dep). CLI peerDeps on `@crewai-ts/core`; user's project must install it (clear error if missing).
- **Token shape**: symbol tokens + injectable classes
- **Test strategy**: TDD with vitest (RED-GREEN-REFACTOR) + E2E (`@nestjs/testing` for nestjs; `child_process.spawn` for cli)
- **Versioning**: independent, all start at 0.1.0 (core stays 0.1.11). nestjs/cli peerDep `workspace:*` locally, `*` for publish.
- **Root package.json**: private workspace root, no name publishing
- **ESLint**: root `eslint.config.js` with per-package `tsconfig.eslint.json` references
- **CI**: pnpm/action-setup@v4, pnpm install --frozen-lockfile, `pnpm -r build && pnpm -r test && pnpm -r lint`
- **Publish workflow**: scope to `@crewai-ts/core` only, no auto-publish for nestjs/cli in this PR
- **`.npmrc`**: `auto-install-peers=true`, `node-linker=isolated`
- **`packageManager` field**: pin pnpm version
- **`.gitignore`**: add `**/dist/`, `**/node_modules/`, `**/coverage/`
- **`.codegraph/`**: re-init post-move with `codegraph init`
- **`crew` bin name**: REJECTED (taken, unpublished 2024-10-18). Use `crewai-ts`. `@crewai-ts/nestjs` and `@crewai-ts/cli` available on npm.

## Scope boundaries
- IN: monorepo restructure, 3 packages, NestJS forRoot/forRootAsync, CLI runner
- OUT: core API changes, controllers/HTTP in nestjs, subcommands/watch mode in CLI, turborepo/changesets/release-please, new examples directories, auto-publish of nestjs/cli

## Plan structure (waves)
- **Wave 0** (serial, foundational): pnpm workspace + root tsconfig.base.json + core migration
- **Wave 1** (parallel): scaffold nestjs + cli packages, root tooling (eslint, CI, README)
- **Wave 2** (parallel, TDD): NestJS tokens + CrewModule.forRoot + forRootAsync + CrewFactory + E2E
- **Wave 3** (parallel, TDD): CLI bin + project loader + --inputs parser + --help + E2E
- **Wave FINAL**: 4 parallel reviews (F1 oracle, F2 quality, F3 E2E, F4 scope)

## Plan name
- `.omo/plans/nestjs-monorepo.md`
