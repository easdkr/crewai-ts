# NestJS Monorepo Restructure for `@crewai-ts/core`

## TL;DR

> **Quick Summary**: Restructure the single-package `@crewai-ts/core` v0.1.11 repo into a pnpm monorepo with 3 packages: `packages/core/` (existing, moved in-place, name + 851 tests preserved), `packages/nestjs/` (new DI-only wrapper: `CrewModule.forRoot` + `forRootAsync`), and `packages/cli/` (new `crewai-ts` binary that runs a user's TS/JS project via `tsx`).

> **Deliverables**:
> - `packages/core/` — moved `@crewai-ts/core` v0.1.11, 851 tests still green, byte-identical `exports` block
> - `packages/nestjs/` — `@crewai-ts/nestjs` v0.1.0, ships `CrewModule.forRoot({ llm, memory, knowledge })` + `forRootAsync({ useFactory, inject, imports })`, symbol tokens + injectable factories
> - `packages/cli/` — `@crewai-ts/cli` v0.1.0, ships `crewai-ts` bin, runs user project via tsx, validates `@crewai-ts/core` is installed in user project
> - pnpm workspace + root `tsconfig.base.json` + `.npmrc` + pnpm-native CI

> **Estimated Effort**: Large
> **Parallel Execution**: YES — 4 implementation waves + 1 final review wave
> **Critical Path**: Wave 0 (workspace + core migration) → Wave 1 (scaffold + root tooling) → Wave 2 (NestJS) → Wave 3 (CLI) → F1–F4 reviews

---

## Context

### Original Request
> "I want to create a nestjs module with a sibling package in that package. In monorepo form."

Resolved via interview: nestjs module + sibling CLI runner, both as new packages alongside the moved core, in a pnpm monorepo.

### Interview Summary
**Key Discussions**:
- 3 packages: `packages/core/` (move in-place, keep `@crewai-ts/core` name), `packages/nestjs/` (new), `packages/cli/` (new)
- NestJS surface: `CrewModule.forRoot({ llm, memory, knowledge })` + `forRootAsync({ useFactory, inject, imports })`, DI providers only — no controllers/HTTP
- CLI scope: `crewai-ts <project-path> --inputs '{"x":1}'` runs user TS/JS file via `tsx`; user project must install `@crewai-ts/core` itself (clear error if missing)
- Token shape: symbol tokens (`CREW_FACTORY`, `LLM`, `MEMORY`, `KNOWLEDGE`) + injectable classes
- Test strategy: TDD with vitest (RED-GREEN-REFACTOR) + E2E (`@nestjs/testing` for nestjs; `child_process.spawn` for cli)
- Tooling: pnpm workspaces, root `tsconfig.base.json` + per-package extends, per-package `tsup` + `vitest`
- Bin name: `crewai-ts` (rejected `crew` — taken on npm, unpublished 2024-10-18)
- `scripts/` moves to `packages/core/scripts/` (Metis recommendation; `Path(__file__).resolve().parents[1]` auto-resolves ROOT)
- Versioning: independent (core stays `0.1.11`, nestjs + cli start at `0.1.0`)
- Publish workflow: scope `.github/workflows/publish.yml` to `@crewai-ts/core` only; no auto-publish for nestjs/cli in this PR

**Research Findings** (from explore agent `bg_eceefcb0`):
- `src/` is **completely flat** (82 files, 0 subdirs) — internal imports stay valid after move
- `test/index.test.ts` (1.9MB) has 3 `../src/*.js` imports — stay valid if `test/` moves to `packages/core/test/`
- `scripts/check-class-method-parity.py` lines 20-28 hard-codes `ROOT / "src"` — auto-fixes when scripts/ moves to `packages/core/scripts/` (Path.parents[1] becomes `packages/core/`)
- `scripts/pack-smoke.mjs` uses `process.cwd()` — invoke from `packages/core/`
- `exports` block (50+ subpath entries) moves into `packages/core/package.json` unchanged
- vitest config has no globs/setup/aliases — picks up `**/*.test.ts` from cwd automatically
- CI uses `cache: "npm"` and `npm ci` — needs full pnpm swap

### Metis Review
**Identified Gaps (addressed)**:
- Workspace-level `tsconfig.base.json` → YES (root, shared TS settings; per-package extends + `experimentalDecorators` override)
- `crew` bin name conflict → use `crewai-ts` (verified available)
- CLI tsx resolution problem → user must install `@crewai-ts/core` in their project; CLI gives clear error if missing (option `c` over `NODE_PATH` hack or bundle-and-ship)
- `scripts/` location → move to `packages/core/scripts/` (cleaner)
- `.codegraph/` re-indexing → `codegraph init` post-move (final step)
- ESLint structure → single root `eslint.config.js` referencing per-package `tsconfig.eslint.json`
- Hard guardrails added: core's `experimentalDecorators: false` re-asserted explicitly; snapshot test for `exports` block; 851-test count CI assertion; nestjs tsconfig must have `experimentalDecorators: true` + `emitDecoratorMetadata: true` + `verbatimModuleSyntax: false`; cli tsup emits shebang

---

## Work Objectives

### Core Objective
Restructure the single-package `@crewai-ts/core` v0.1.11 repo into a pnpm monorepo with 3 packages — the moved core (with byte-identical public surface and 851 green tests), a new NestJS module package (`CrewModule.forRoot` + `forRootAsync`, DI-only), and a new CLI package (`crewai-ts` binary that runs a user's TS/JS project via tsx).

### Concrete Deliverables
- `pnpm-workspace.yaml` at root declaring `packages: ["packages/*"]`
- Root `package.json` set to `"private": true`, no publish, with dev tooling (typescript, eslint, vitest, tsup as devDeps at root for shared versions)
- Root `tsconfig.base.json` with shared strict TS settings (no `include`/`files`)
- Root `.npmrc` with `auto-install-peers=true`, `node-linker=isolated`
- Root `.gitignore` updated to glob `**/dist/`, `**/node_modules/`, `**/coverage/`
- `packages/core/` — `@crewai-ts/core` v0.1.11, byte-identical `exports`, `experimentalDecorators: false` re-asserted, 851 tests green
- `packages/nestjs/` — `@crewai-ts/nestjs` v0.1.0, `CrewModule.forRoot` + `forRootAsync`, symbol tokens + injectable factories
- `packages/cli/` — `@crewai-ts/cli` v0.1.0, `crewai-ts` binary, tsx invocation, project validator
- `.github/workflows/ci.yml` pnpm-native
- `.github/workflows/publish.yml` scoped to `@crewai-ts/core` only
- Root `README.md` with new "Packages" section + pnpm install/dev instructions

### Definition of Done
- [ ] `pnpm install` at root succeeds, links all 3 workspaces, pnpm-lock.yaml present
- [ ] `pnpm -F @crewai-ts/core test` → "Tests 851 passed (851)" (CI-asserted)
- [ ] `pnpm -F @crewai-ts/core build` → emits `dist/index.{js,cjs,d.ts}` + 2 other entries, postbuild smoke passes
- [ ] `pnpm -F @crewai-ts/core smoke:pack` → exits 0
- [ ] `python3 packages/core/scripts/check-class-method-parity.py` → `total_missing=0`
- [ ] `python3 packages/core/scripts/check-export-parity.py` → exits 0
- [ ] `python3 packages/core/scripts/check-subpath-export-parity.py` → exits 0
- [ ] `node packages/core/scripts/check-a2ui-schema-parity.mjs` → exits 0
- [ ] `pnpm -F @crewai-ts/nestjs build` → succeeds, emits dist with `.d.ts`
- [ ] `pnpm -F @crewai-ts/nestjs test` → all new tests pass (TDD)
- [ ] E2E nestjs: `Test.createTestingModule({ imports: [CrewModule.forRoot({...})] }).compile()` resolves all tokens; factory builds a `Crew` and `kickoff` returns expected output with mock LLM
- [ ] `pnpm -F @crewai-ts/cli build` → succeeds, bin output's first line is `#!/usr/bin/env node`
- [ ] `pnpm -F @crewai-ts/cli test` → all new tests pass (TDD)
- [ ] E2E cli: `pnpm dlx @crewai-ts/cli` (or local symlink) against a fixture project with `@crewai-ts/core` installed → user code runs, expected output captured
- [ ] E2E cli error path: fixture without `@crewai-ts/core` → exit code 2, clear stderr message
- [ ] `pnpm -F @crewai-ts/cli test -- --grep "crewai-ts"` covers all 4 subcommands/flags (`<path>`, `--inputs`, `--help`, `--version`)
- [ ] CI: `.github/workflows/ci.yml` uses pnpm, no `npm` commands remain
- [ ] Publish: `.github/workflows/publish.yml` scoped to `@crewai-ts/core` only (nestjs/cli publish is follow-up)
- [ ] `codegraph init` run post-move; `codegraph_status` shows 0 pending files
- [ ] Root `README.md` "Packages" section lists all 3 with install commands

### Must Have
- 3 packages: `core` (moved), `nestjs` (new), `cli` (new) — all working
- pnpm workspaces (`pnpm-workspace.yaml`)
- All 851 existing core tests still pass
- `experimentalDecorators: false` re-asserted in `packages/core/tsconfig.json` (explicit, not just inherited)
- `experimentalDecorators: true` + `emitDecoratorMetadata: true` + `verbatimModuleSyntax: false` in `packages/nestjs/tsconfig.json`
- `CrewModule.forRoot({ llm, memory, knowledge })` accepts static config and registers providers
- `CrewModule.forRootAsync({ useFactory, inject, imports })` accepts async config
- Symbol tokens: `CREW_FACTORY`, `LLM`, `MEMORY`, `KNOWLEDGE` exported from `@crewai-ts/nestjs`
- `crewai-ts` bin name, ships with `#!/usr/bin/env node` shebang
- CLI validates user project has `@crewai-ts/core` as dep; clear error if not
- CI uses pnpm (`pnpm/action-setup@v4`)

### Must NOT Have (Guardrails)
- NO new core features, NO core API changes, NO core test modifications
- NO `reflect-metadata` in core's dependencies/peerDependencies/devDependencies
- NO `turborepo`, `nx`, `changesets`, `release-please`, `lerna`
- NO controllers, HTTP, WebSockets, GraphQL in the nestjs package — DI providers only
- NO CLI subcommands (`crewai-ts init`, `crewai-ts deploy`, etc.) — single positional command
- NO CLI watch mode, REPL, or interactive prompts
- NO fancy argv parser (commander, yargs) — hand-rolled
- NO CLI progress bars, spinners, colored output
- NO `packageManager` field for npm/yarn (use pnpm only)
- NO auto-publish of `@crewai-ts/nestjs` or `@crewai-ts/cli` in this PR
- NO global CLI config (`.crewuirc`, etc.) — stateless v1
- NO `eslint-plugin-import`, `eslint-plugin-n`, or new lint rules
- NO removal of the existing `postbuild` script (`import('./dist/index.js')` smoke check)
- NO new examples directories beyond moving existing `examples/`
- NO changes to `engines.node: ">=22.0.0"`

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed. No exceptions.
> Acceptance criteria requiring "user manually tests/confirms" are FORBIDDEN.

### Test Decision
- **Infrastructure exists**: YES (vitest already configured in core)
- **Automated tests**: TDD (RED-GREEN-REFACTOR per task)
- **Framework**: vitest (root) + `@nestjs/testing` for nestjs E2E
- **E2E for nestjs**: `Test.createTestingModule(...).compile()` with mock providers
- **E2E for cli**: `child_process.spawn('node', [binPath, ...args], { cwd: fixturePath })` + assert stdout/exit code
- **If TDD**: Each task follows RED (failing test first) → GREEN (minimal impl) → REFACTOR

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.omo/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: N/A (no UI in this plan)
- **TUI/CLI**: Use interactive_bash (tmux) — Run `crewai-ts --help`, send keystrokes, validate output
- **API/Backend**: Use Bash (curl) — N/A (no HTTP in this plan)
- **Library/Module**: Use Bash (node REPL) — Import `@crewai-ts/nestjs`, resolve providers, kick off mock crew
- **E2E spawn**: Use Bash (child_process via inline node script) — Spawn the `crewai-ts` binary, capture stdout/stderr, assert exit code

---

## Execution Strategy

### Parallel Execution Waves

> Maximize throughput by grouping independent tasks into parallel waves.
> Each wave completes before the next begins.
> Target: 5-8 tasks per wave. Fewer than 3 per wave (except final) = under-splitting.

```
Wave 0 (Foundation - serial, BLOCKING):
├── 1. pnpm workspace bootstrap (pnpm-workspace.yaml, root package.json, root tsconfig.base.json, root .npmrc, .gitignore updates, corepack pin)
└── 2. Core migration (move src/test/scripts/examples/configs → packages/core/, create packages/core/package.json with byte-identical exports, verify 851 tests pass)

Wave 1 (Scaffold + root tooling - parallel, 3 tasks):
├── 3. packages/nestjs/ scaffold (package.json, tsconfig, tsup, vitest, src/index.ts placeholder, baseline test)
├── 4. packages/cli/ scaffold (package.json with bin "crewai-ts", tsconfig, tsup with shebang, vitest, src/bin.ts placeholder, baseline test)
└── 5. Root tooling update (eslint.config.js with per-package tsconfig.eslint.json refs, .github/workflows/ci.yml pnpm swap, .github/workflows/publish.yml scope to core, README.md Packages section)

Wave 2 (NestJS implementation - TDD, dependency-ordered):
├── 6. NestJS: symbol tokens + injection types (depends: 3)
├── 7. NestJS: CrewModule.forRoot({ llm, memory, knowledge }) (depends: 6)
├── 8. NestJS: CrewModule.forRootAsync({ useFactory, inject, imports }) (depends: 7)
├── 9. NestJS: CrewFactory + AgentFactory injectable classes (depends: 6, parallel with 7)
└── 10. NestJS: E2E integration test (depends: 7, 8, 9)

Wave 3 (CLI implementation - TDD, dependency-ordered):
├── 11. CLI: argv parser (hand-rolled, --help/--version/--inputs/positional)
├── 12. CLI: project validator (path exists, package.json, @crewai-ts/core in deps) (depends: 11)
├── 13. CLI: tsx invocation (spawn, capture stdout/stderr, propagate exit code) (depends: 12)
├── 14. CLI: bin entry src/bin.ts + shebang wiring (depends: 11, 12, 13)
└── 15. CLI: --help and --version sub-tests (depends: 11, parallel with 12)

Wave FINAL (4 parallel reviews):
├── F1. Plan compliance audit (oracle)
├── F2. Code quality review
├── F3. Real manual QA (E2E: real CLI run on real fixture, real NestJS test module)
└── F4. Scope fidelity check
```

### Dependency Matrix (abbreviated)

- **1** → 2, 3, 4, 5 (workspace must exist)
- **2** → 3, 4, 5 (packages reference core)
- **3** → 6, 7, 8, 9, 10 (nestjs package must exist)
- **4** → 11, 12, 13, 14, 15 (cli package must exist)
- **5** → (no code deps, must complete before final reviews)
- **6** → 7, 8, 9
- **7** → 8, 10
- **8** → 10
- **9** → 10
- **11** → 12, 13, 14, 15
- **12** → 13, 14
- **13** → 14
- **15** → (terminal in Wave 3)
- **F1-F4** depend on ALL prior tasks

### Agent Dispatch Summary

- **Wave 0**: 2 tasks, sequentially dispatched. `unspecified-high` for workspace bootstrap (multi-file config), `unspecified-high` for core migration (touch every config + scripts + verify 851 tests)
- **Wave 1**: 3 tasks, parallel. `quick` for nestjs scaffold (template), `quick` for cli scaffold (template), `unspecified-high` for root tooling (CI + README + eslint)
- **Wave 2**: 5 tasks, 4 parallel after task 6. Mix of `quick` (token exports), `unspecified-high` (forRoot, forRootAsync, factories), `unspecified-high` (E2E)
- **Wave 3**: 5 tasks, dependency-ordered. `quick` (parser), `unspecified-high` (validator), `unspecified-high` (spawn), `unspecified-high` (bin entry), `quick` (help/version)
- **Wave FINAL**: 4 tasks, parallel. `oracle`, `unspecified-high`, `unspecified-high`, `deep`

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> Every task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.
> A task WITHOUT QA Scenarios is INCOMPLETE. No exceptions.
> FORMAT: Task labels MUST use bare numbers: `1.`, `2.`, `3.` — NOT `T1.`, `Task 1.`, `Phase 1:`.
> Final Verification Wave labels MUST use `F1.`, `F2.`, etc. — NOT `T-F1.`, `F-1.`, `Final 1.`.

- [ ] 1. pnpm workspace bootstrap (root config files)

  **What to do**:
  - Create `pnpm-workspace.yaml` at repo root with `packages: ["packages/*"]`
  - Create root `package.json`: `"private": true`, `"name": "crewai-ts-workspace"`, `"packageManager": "pnpm@9.15.0"`, scripts `{"build": "pnpm -r build", "test": "pnpm -r test", "lint": "pnpm -r lint", "check": "pnpm -r check"}`. Move devDeps `typescript@^6.0.3`, `eslint@^10.4.0`, `vitest@^4.1.7`, `tsup@^8.5.1`, `@types/node@^25.9.1`, `@eslint/js@^10.0.1`, `typescript-eslint@^8.60.0` to root devDeps.
  - Create root `tsconfig.base.json` (no `include`/`files`) with shared keys: `target: "ES2024"`, `lib: ["ES2024"]`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`, `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `verbatimModuleSyntax: true`, `declaration: true`, `declarationMap: true`, `sourceMap: true`, `skipLibCheck: true`, `types: ["node"]`, `ignoreDeprecations: "6.0"`, `experimentalDecorators: false` (will be overridden in nestjs).
  - Create root `.npmrc` with `auto-install-peers=true` and `node-linker=isolated`.
  - Update root `.gitignore`: add `**/dist/`, `**/node_modules/`, `**/coverage/`, `pnpm-debug.log*`. Keep existing entries (`.tgz` line 6 etc.).
  - Remove the old `package-lock.json` (replaced by `pnpm-lock.yaml`). Do NOT delete the existing 6 `crewai-ts-core-0.1.*.tgz` files (already gitignored, leave in place).
  - Run `corepack enable && corepack prepare pnpm@9.15.0 --activate` and verify `pnpm --version` shows 9.15.0.
  - Smoke test: `pnpm install` at root with empty `packages/` dir — should succeed and create `pnpm-lock.yaml` and `node_modules/`.

  **Must NOT do**:
  - Do NOT add `reflect-metadata` anywhere at root.
  - Do NOT change `engines.node`.
  - Do NOT create per-package files in this task (deferred to task 2 for core, tasks 3-4 for new packages).
  - Do NOT install npm or yarn tooling.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` (multi-file root config with version pins, requires care to not break existing core that still depends on these devDeps)
  - **Skills**: `[]` (no specialized skills needed for config bootstrapping)
  - **Skills Evaluated but Omitted**:
    - `playwright`: N/A (no UI)
    - `git-master`: not needed; we are not committing in this task

  **Parallelization**:
  - **Can Run In Parallel**: NO (Wave 0 is serial; this is task 1 of 2)
  - **Parallel Group**: Wave 0 (sequential with task 2)
  - **Blocks**: Task 2 (core migration needs the workspace to exist), tasks 3, 4, 5
  - **Blocked By**: None (first task)

  **References**:
  - **Pattern References**:
    - `package.json:1-471` — current root package.json; copy `engines`, `keywords` semantics to root's `packageManager` field
    - `tsconfig.json:1-20` — current root tsconfig; content moves into `tsconfig.base.json`
    - `.gitignore:1-N` — current gitignore; merge new patterns
  - **External References**:
    - pnpm workspace docs: `https://pnpm.io/workspaces` — yaml format reference
    - corepack: `https://nodejs.org/api/corepack.html` — pin pnpm via `packageManager` field
  - **WHY Each Reference Matters**:
    - Current `package.json` has the exact devDep versions and engines we must preserve
    - Current `tsconfig.json` has the strict settings that core inherits; all 3 packages need a base that matches

  **Acceptance Criteria**:
  - [ ] `pnpm-workspace.yaml` exists at root with `packages: ["packages/*"]`
  - [ ] Root `package.json` has `"private": true`, `"packageManager": "pnpm@9.15.0"`
  - [ ] Root `tsconfig.base.json` exists with all 16 shared strict TS keys
  - [ ] Root `.npmrc` has `auto-install-peers=true` and `node-linker=isolated`
  - [ ] Root `.gitignore` includes `**/dist/`, `**/node_modules/`, `**/coverage/`
  - [ ] `package-lock.json` is removed; `pnpm-lock.yaml` is created after `pnpm install`
  - [ ] `pnpm --version` shows `9.15.0`
  - [ ] `pnpm install` at root with empty `packages/` dir succeeds (exit 0)

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: pnpm workspace file is valid YAML and discoverable
    Tool: Bash (cat + node yaml parse)
    Preconditions: repo root, task 1 not yet run
    Steps:
      1. cat pnpm-workspace.yaml
      2. Verify content matches `packages:\n  - "packages/*"` exactly
      3. node -e "const y=require('fs').readFileSync('pnpm-workspace.yaml','utf8'); console.log(y)"
    Expected Result: file content shown, pnpm recognizes workspace glob
    Failure Indicators: file missing, yaml parse error, pnpm warns about workspace
    Evidence: .omo/evidence/task-1-pnpm-workspace-yaml.txt

  Scenario: pnpm install with empty packages/ succeeds
    Tool: Bash (pnpm install)
    Preconditions: task 1 complete, packages/ exists but is empty
    Steps:
      1. pnpm install 2>&1 | tee /tmp/pnpm-install-task1.log
      2. echo "exit=$?"
      3. test -f pnpm-lock.yaml && echo "lockfile present" || echo "MISSING"
    Expected Result: exit 0, pnpm-lock.yaml present
    Failure Indicators: exit non-zero, no lockfile, pnpm warns about peer deps
    Evidence: .omo/evidence/task-1-pnpm-install.log

  Scenario: pnpm version is pinned to 9.15.0
    Tool: Bash (pnpm --version + cat package.json)
    Steps:
      1. pnpm --version
      2. node -e "const p=require('./package.json'); console.log(p.packageManager)"
    Expected Result: `9.15.0` from pnpm --version, `pnpm@9.15.0` from package.json
    Failure Indicators: version mismatch, packageManager field missing
    Evidence: .omo/evidence/task-1-pnpm-version.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-1-pnpm-workspace-yaml.txt` — full pnpm-workspace.yaml content
  - [ ] `.omo/evidence/task-1-pnpm-install.log` — full pnpm install output
  - [ ] `.omo/evidence/task-1-pnpm-version.txt` — pnpm version + packageManager field

  **Commit**: YES
  - Message: `chore(workspace): bootstrap pnpm workspace and root tsconfig.base`
  - Files: `pnpm-workspace.yaml`, root `package.json`, root `tsconfig.base.json`, root `.npmrc`, `.gitignore`, delete `package-lock.json`, add `pnpm-lock.yaml`
  - Pre-commit: `pnpm install` exits 0

- [ ] 2. Core migration: move `@crewai-ts/core` into `packages/core/`

  **What to do**:
  - Use `git mv` to relocate: `src/` → `packages/core/src/`, `test/` → `packages/core/test/`, `scripts/` → `packages/core/scripts/`, `examples/` → `packages/core/examples/`. The flat `src/` structure means internal `./foo.js` relative imports stay valid. The 3 `../src/*.js` imports in `test/index.test.ts` (lines 10, 11, 1087) stay valid since `test/` and `src/` are siblings under `packages/core/`.
  - Move config files: `tsup.config.ts` → `packages/core/tsup.config.ts`, `tsconfig.build.json` → `packages/core/tsconfig.build.json`, `tsconfig.eslint.json` → `packages/core/tsconfig.eslint.json`, `vitest.config.ts` → `packages/core/vitest.config.ts`, `eslint.config.js` → `packages/core/eslint.config.js` (the eslint config moves with the package for now; root-level eslint.config.js with per-package overrides added in task 5).
  - Create `packages/core/package.json`: copy ALL of the current `package.json` 1:1 except: (a) `"private": false` (it's publishable), (b) add `"repository"` and `"bugs"` if missing (already present), (c) remove the root-level `engines`/`scripts` overrides that are now at root. The 50+ `exports` subpath entries, `main`, `module`, `types`, `files`, `keywords`, `license`, `author`, `sideEffects` are byte-identical to current.
  - Create `packages/core/tsconfig.json` extending root `tsconfig.base.json` with: `"experimentalDecorators": false` (EXPLICIT, not just inherited — guardrail), `"include": ["src", "test", "tsup.config.ts", "vitest.config.ts"]`. This is the type-check config; `tsconfig.build.json` extends this for declarations only.
  - Update `packages/core/tsconfig.eslint.json` `include` to add `scripts/` if it doesn't already (it does per current file).
  - Update `packages/core/tsup.config.ts` `entry` paths: they are `src/index.ts`, `src/llms-hooks-transport.ts`, `src/state-provider-core.ts`. Since tsup resolves relative to cwd (now `packages/core/`), these paths are unchanged. No edits needed.
  - Update `packages/core/scripts/check-a2ui-schema-parity.mjs` line 7: `from "../dist/index.js"` → `from "../../dist/index.js"` (since scripts/ is now at `packages/core/scripts/`, dist/ is at `packages/core/dist/`).
  - The 3 .py scripts (`check-class-method-parity.py`, `check-export-parity.py`, `check-subpath-export-parity.py`): they use `Path(__file__).resolve().parents[1]` to compute ROOT. When scripts/ moves to `packages/core/scripts/`, ROOT = `packages/core/` (one level up from scripts/). The hard-coded `ROOT / "src" / "agent.ts"` etc. now correctly points to `packages/core/src/agent.ts`. ZERO edits needed to .py files.
  - `scripts/pack-smoke.mjs` line 8 uses `process.cwd()`. When invoked from `packages/core/`, `root = packages/core/`, which is correct. ZERO edits needed.
  - `scripts/run-gemini-demo.mjs` reads `examples/gemini-crew.ts` (now at `packages/core/examples/`) and string-replaces `'from "../dist/index.js";'`. Update line 17 if needed — the example file still has that literal at its line 14, so the string-replace still works as long as `pathToFileURL(join(root, "dist", "index.js"))` resolves. Since `root` is `packages/core/`, this resolves to `packages/core/dist/index.js`. ZERO edits needed.
  - Add a snapshot test `packages/core/test/build-integrity.test.ts` that:
    1. Reads `packages/core/package.json`, parses `exports`, snapshots to `packages/core/test/snapshots/exports.snapshot.json`. Test compares current exports to snapshot byte-by-byte.
    2. Asserts `experimentalDecorators: false` is in `packages/core/tsconfig.json` (string-grep).
    3. Asserts `reflect-metadata` is NOT in `packages/core/package.json` (string-grep on deps/peerDeps).
    4. Asserts the 3 .py script paths (one for each) are valid (e.g., `packages/core/scripts/check-class-method-parity.py` exists).
  - Verify the 851 existing tests pass: `cd packages/core && pnpm test` → "Tests 851 passed (851)". If count is 850 or 852, STOP and investigate.
  - Verify build: `cd packages/core && pnpm build` → `dist/index.{js,cjs,d.ts}` + 2 other entries emitted, postbuild smoke passes.

  **Must NOT do**:
  - Do NOT modify any file in `packages/core/src/`. (Migration is a pure move.)
  - Do NOT modify `test/index.test.ts` content (only its location changes; the 3 imports stay valid).
  - Do NOT add `reflect-metadata` to deps/peerDeps/devDeps.
  - Do NOT delete the 6 `crewai-ts-core-0.1.*.tgz` files at root.
  - Do NOT change `engines.node`.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` (multi-file move + cross-validation + critical "no behavior change" guardrail)
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: N/A
    - `git-master`: useful for `git mv` operations but the agent can run `git mv` directly

  **Parallelization**:
  - **Can Run In Parallel**: NO (sequential after task 1; touches every core-related file)
  - **Parallel Group**: Wave 0 (sequential with task 1)
  - **Blocks**: Tasks 3, 4, 5 (new packages depend on core's structure existing)
  - **Blocked By**: Task 1 (workspace must exist)

  **References**:
  - **Pattern References**:
    - `package.json:1-471` — full content to be copied into `packages/core/package.json` (byte-identical `exports` block lines 36-440)
    - `tsup.config.ts:1-17` — moves verbatim
    - `tsconfig.build.json:1-12` — moves verbatim
    - `tsconfig.json:1-20` — base content; `experimentalDecorators: false` re-asserted in new tsconfig.json
    - `test/index.test.ts:10, 11, 1087` — 3 `../src/*.js` imports that must stay valid
    - `scripts/check-class-method-parity.py:20-28` — hard-coded `ROOT / "src"` paths; auto-fix on move
    - `examples/gemini-crew.ts:14` — `from "../dist/index.js"` literal that `run-gemini-demo.mjs` string-replaces
  - **External References**:
    - `git mv` semantics: `https://git-scm.com/docs/git-mv` — preserves history
  - **WHY Each Reference Matters**:
    - The 50+ `exports` entries are the public contract; if any are dropped, downstream users break
    - The 3 `../src/*.js` imports in the test file are the linchpin of the test suite working post-move
    - The .py scripts auto-resolve ROOT via `parents[1]` — this is the only reason scripts/ can move cleanly

  **Acceptance Criteria**:
  - [ ] `packages/core/src/` contains all 82 source files (verified by `ls packages/core/src/*.ts | wc -l` = 82)
  - [ ] `packages/core/test/index.test.ts` exists (1.9MB, 53030 lines)
  - [ ] `packages/core/scripts/` contains all 7 files (3 .py + 3 .mjs + 1 .json manifest)
  - [ ] `packages/core/examples/gemini-crew.ts` exists
  - [ ] `packages/core/package.json` `name` is `@crewai-ts/core`
  - [ ] `packages/core/package.json` `version` is `0.1.11`
  - [ ] `packages/core/package.json` `exports` block is byte-identical to pre-move (snapshot test passes)
  - [ ] `packages/core/tsconfig.json` extends root `tsconfig.base.json`
  - [ ] `packages/core/tsconfig.json` has explicit `"experimentalDecorators": false`
  - [ ] `packages/core/tsup.config.ts` matches the original verbatim (entry paths unchanged)
  - [ ] `packages/core/tsconfig.build.json` includes `["src/**/*.ts"]`
  - [ ] `packages/core/scripts/check-a2ui-schema-parity.mjs` has been updated: line 7 now `import { ... } from "../../dist/index.js"`
  - [ ] `pnpm -F @crewai-ts/core test` exits 0 with "Tests 851 passed (851)"
  - [ ] `pnpm -F @crewai-ts/core build` exits 0; `dist/index.{js,cjs,d.ts}`, `dist/llms-hooks-transport.{js,cjs,d.ts}`, `dist/state-provider-core.{js,cjs,d.ts}` all present
  - [ ] `pnpm -F @crewai-ts/core postbuild` exits 0 (the `import('./dist/index.js')` smoke check passes)
  - [ ] `python3 packages/core/scripts/check-class-method-parity.py` exits 0 with `total_missing=0`
  - [ ] `python3 packages/core/scripts/check-export-parity.py` exits 0
  - [ ] `python3 packages/core/scripts/check-subpath-export-parity.py` exits 0
  - [ ] `node packages/core/scripts/check-a2ui-schema-parity.mjs` exits 0
  - [ ] `pnpm -F @crewai-ts/core smoke:pack` exits 0
  - [ ] New `packages/core/test/build-integrity.test.ts` exists and passes
  - [ ] `git log --follow packages/core/src/index.ts` shows full history (git mv preserved it)

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: All 851 core tests pass after move
    Tool: Bash (pnpm test)
    Preconditions: task 1 complete, task 2 not yet started
    Steps:
      1. pnpm -F @crewai-ts/core test 2>&1 | tee /tmp/core-test.log
      2. grep -oE "Tests +[0-9]+ passed \([0-9]+\)" /tmp/core-test.log | head -1
      3. test "$(grep -oE 'Tests +[0-9]+ passed' /tmp/core-test.log | grep -oE '[0-9]+')" = "851" && echo OK
    Expected Result: "Tests 851 passed (851)" present
    Failure Indicators: count is 850, 852, or any other number; test failure reported
    Evidence: .omo/evidence/task-2-core-tests-851.log

  Scenario: Core build emits all 3 entries with declarations
    Tool: Bash (pnpm build + ls + postbuild)
    Steps:
      1. pnpm -F @crewai-ts/core build 2>&1 | tee /tmp/core-build.log
      2. ls -la packages/core/dist/index.{js,cjs,d.ts}
      3. ls -la packages/core/dist/llms-hooks-transport.{js,cjs,d.ts}
      4. ls -la packages/core/dist/state-provider-core.{js,cjs,d.ts}
      5. pnpm -F @crewai-ts/core postbuild 2>&1 | tee /tmp/core-postbuild.log
    Expected Result: build exits 0, all 9 files exist, postbuild exits 0
    Failure Indicators: any file missing, postbuild fails
    Evidence: .omo/evidence/task-2-core-build.log

  Scenario: Exports block is byte-identical to pre-move
    Tool: Bash (snapshot test)
    Steps:
      1. pnpm -F @crewai-ts/core test -- build-integrity 2>&1 | tee /tmp/integrity-test.log
      2. grep -E "(exports|experimentalDecorators|reflect-metadata)" /tmp/integrity-test.log
    Expected Result: snapshot test passes; integrity test reports all 3 guards OK
    Failure Indicators: any guard fails
    Evidence: .omo/evidence/task-2-build-integrity.log

  Scenario: All 4 parity scripts pass
    Tool: Bash (python3 + node)
    Steps:
      1. python3 packages/core/scripts/check-class-method-parity.py 2>&1 | tail -5
      2. python3 packages/core/scripts/check-export-parity.py 2>&1 | tail -5
      3. python3 packages/core/scripts/check-subpath-export-parity.py 2>&1 | tail -5
      4. node packages/core/scripts/check-a2ui-schema-parity.mjs 2>&1 | tail -5
    Expected Result: all 4 exit 0, no "missing" or "mismatch" reports
    Failure Indicators: any script reports missing exports, mismatched methods, or schema drift
    Evidence: .omo/evidence/task-2-parity-scripts.log

  Scenario: smoke:pack validates the tarball
    Tool: Bash (pnpm smoke:pack)
    Steps:
      1. pnpm -F @crewai-ts/core smoke:pack 2>&1 | tee /tmp/smoke-pack.log
      2. grep -E "(exit|success|failed)" /tmp/smoke-pack.log | tail -3
    Expected Result: exit 0, all 100+ deep imports resolve
    Failure Indicators: any deep import fails
    Evidence: .omo/evidence/task-2-smoke-pack.log
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-2-core-tests-851.log` — full vitest output
  - [ ] `.omo/evidence/task-2-core-build.log` — full tsup + tsc output
  - [ ] `.omo/evidence/task-2-build-integrity.log` — snapshot + guard test output
  - [ ] `.omo/evidence/task-2-parity-scripts.log` — all 4 parity script outputs
  - [ ] `.omo/evidence/task-2-smoke-pack.log` — smoke:pack output
  - [ ] `.omo/evidence/task-2-file-count.txt` — `ls packages/core/src/*.ts | wc -l` output (= 82)

  **Commit**: YES
  - Message: `chore(core): move @crewai-ts/core into packages/core/`
  - Files: `packages/core/**` (src, test, scripts, examples, configs, package.json, tsconfig.json, tsup.config.ts, vitest.config.ts, eslint.config.js, tsconfig.eslint.json), new `packages/core/test/build-integrity.test.ts` + `packages/core/test/snapshots/exports.snapshot.json`. Updated `packages/core/scripts/check-a2ui-schema-parity.mjs` line 7.
  - Pre-commit: `pnpm -F @crewai-ts/core test && pnpm -F @crewai-ts/core build && pnpm -F @crewai-ts/core smoke:pack`

---

- [ ] 3. Scaffold `packages/nestjs/` (`@crewai-ts/nestjs` v0.1.0)

  **What to do**:
  - Create directory `packages/nestjs/` with subdirs `src/`, `test/`.
  - Create `packages/nestjs/package.json`:
    ```json
    {
      "name": "@crewai-ts/nestjs",
      "version": "0.1.0",
      "description": "NestJS DI integration for @crewai-ts/core.",
      "type": "module",
      "main": "./dist/index.js",
      "module": "./dist/index.js",
      "types": "./dist/index.d.ts",
      "exports": {
        ".": {
          "types": "./dist/index.d.ts",
          "import": "./dist/index.js",
          "require": "./dist/index.cjs",
          "default": "./dist/index.js"
        },
        "./package.json": "./package.json"
      },
      "files": ["dist"],
      "engines": { "node": ">=22.0.0" },
      "sideEffects": false,
      "scripts": {
        "build": "tsup && tsc -p tsconfig.build.json",
        "postbuild": "node --input-type=module -e \"import('./dist/index.js')\"",
        "check": "tsc --noEmit",
        "test": "vitest run",
        "prepack": "npm run build"
      },
      "peerDependencies": {
        "@crewai-ts/core": "workspace:*",
        "@nestjs/common": "^10.0.0 || ^11.0.0",
        "@nestjs/core": "^10.0.0 || ^11.0.0",
        "reflect-metadata": "^0.2.0"
      },
      "peerDependenciesMeta": {
        "reflect-metadata": { "optional": false }
      },
      "devDependencies": {
        "@nestjs/common": "^11.0.0",
        "@nestjs/core": "^11.0.0",
        "@nestjs/testing": "^11.0.0",
        "@types/node": "^25.9.1",
        "reflect-metadata": "^0.2.0",
        "tsup": "^8.5.1",
        "typescript": "^6.0.3",
        "vitest": "^4.1.7"
      }
    }
    ```
  - Create `packages/nestjs/tsconfig.json` extending `../../tsconfig.base.json` with overrides: `"experimentalDecorators": true`, `"emitDecoratorMetadata": true`, `"verbatimModuleSyntax": false` (NestJS DI requires both decorator flags; verbatim syntax is incompatible with `@Injectable()`'s decorator emission), `"include": ["src", "test", "tsup.config.ts", "vitest.config.ts"]`.
  - Create `packages/nestjs/tsconfig.build.json` extending `tsconfig.json` with `"rootDir": "src"`, `"outDir": "dist"`, `"emitDeclarationOnly": true`, `"include": ["src/**/*.ts"]`.
  - Create `packages/nestjs/tsup.config.ts`:
    ```ts
    import { defineConfig } from "tsup";
    export default defineConfig({
      entry: { index: "src/index.ts" },
      format: ["esm", "cjs"],
      dts: false,
      sourcemap: false,
      clean: true,
      shims: true,
      platform: "node",
      target: "node22",
    });
    ```
  - Create `packages/nestjs/vitest.config.ts`:
    ```ts
    import { defineConfig } from "vitest/config";
    export default defineConfig({
      test: { globals: false, environment: "node" },
    });
    ```
  - Create `packages/nestjs/src/index.ts` (placeholder, just a comment + a marker export):
    ```ts
    // Public API of @crewai-ts/nestjs. Implemented in tasks 6-10.
    export const NESTJS_PACKAGE_VERSION = "0.1.0";
    ```
  - Create `packages/nestjs/test/scaffold.test.ts`:
    ```ts
    import { describe, it, expect } from "vitest";
    import { NESTJS_PACKAGE_VERSION } from "../src/index.js";

    describe("@crewai-ts/nestjs scaffold", () => {
      it("exports the package version", () => {
        expect(NESTJS_PACKAGE_VERSION).toBe("0.1.0");
      });
    });
    ```
  - Run `pnpm install` at root to link the workspace.
  - Run `pnpm -F @crewai-ts/nestjs test` — should pass (1 test, the scaffold test).
  - Run `pnpm -F @crewai-ts/nestjs build` — should emit `dist/index.{js,cjs,d.ts}`.

  **Must NOT do**:
  - Do NOT add `reflect-metadata` to peerDeps as optional (NestJS DI requires it; mark as non-optional).
  - Do NOT add controllers, modules with `@Module` containing controllers, or HTTP imports.
  - Do NOT import `@nestjs/core` NestFactory or any HTTP/RPC machinery.
  - Do NOT use `verbatimModuleSyntax: true` (incompatible with `@Injectable()`).
  - Do NOT add new features beyond the placeholder + scaffold test (deferred to tasks 6-10).

  **Recommended Agent Profile**:
  - **Category**: `quick` (template scaffolding; no logic to design)
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: N/A
    - `git-master`: not needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with tasks 4, 5)
  - **Blocks**: Tasks 6, 7, 8, 9, 10 (nestjs implementation tasks)
  - **Blocked By**: Task 1 (workspace must exist); task 2 (core must exist for peerDep resolution)

  **References**:
  - **Pattern References**:
    - `packages/core/package.json:451-470` — current dependencies pattern to match for nestjs's `package.json` (engines, sideEffects, files conventions)
    - `packages/core/tsup.config.ts:1-17` — template tsup config (entry: `{index: "src/index.ts"}` is identical)
    - `packages/core/vitest.config.ts:1-8` — template vitest config (verbatim copy)
  - **External References**:
    - NestJS Dynamic Modules: `https://docs.nestjs.com/fundamentals/dynamic-modules` — `forRoot` + `forRootAsync` pattern
    - NestJS peer dependencies: `https://docs.nestjs.com/fundamentals/installation` — required peer deps
  - **WHY Each Reference Matters**:
    - The vitest config in core is 8 lines and works perfectly — copy verbatim, no design needed
    - The tsup config in core shows the dual ESM+CJS emission pattern
    - NestJS docs confirm `reflect-metadata` is a hard requirement, not optional

  **Acceptance Criteria**:
  - [ ] `packages/nestjs/package.json` has `"name": "@crewai-ts/nestjs"`, `"version": "0.1.0"`, `"type": "module"`
  - [ ] `packages/nestjs/package.json` `peerDependencies` includes `@crewai-ts/core: "workspace:*"`, `@nestjs/common`, `@nestjs/core`, `reflect-metadata`
  - [ ] `packages/nestjs/tsconfig.json` has `"experimentalDecorators": true`, `"emitDecoratorMetadata": true`, `"verbatimModuleSyntax": false`
  - [ ] `packages/nestjs/tsup.config.ts` matches the spec (entry: `src/index.ts`, ESM+CJS, node22)
  - [ ] `packages/nestjs/vitest.config.ts` matches the spec
  - [ ] `packages/nestjs/src/index.ts` exports `NESTJS_PACKAGE_VERSION = "0.1.0"`
  - [ ] `packages/nestjs/test/scaffold.test.ts` exists with the 1-test scaffold
  - [ ] `pnpm install` at root succeeds with nestjs workspace linked
  - [ ] `pnpm -F @crewai-ts/nestjs test` exits 0 (1 passing test)
  - [ ] `pnpm -F @crewai-ts/nestjs build` exits 0; `dist/index.{js,cjs,d.ts}` emitted
  - [ ] `pnpm -F @crewai-ts/nestjs postbuild` exits 0 (smoke import passes)

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: nestjs workspace links and scaffold test passes
    Tool: Bash (pnpm install + pnpm test)
    Preconditions: tasks 1, 2 complete
    Steps:
      1. pnpm install 2>&1 | tee /tmp/nestjs-install.log
      2. grep "@crewai-ts/nestjs" /tmp/nestjs-install.log
      3. pnpm -F @crewai-ts/nestjs test 2>&1 | tee /tmp/nestjs-test.log
      4. grep -E "Tests +[0-9]+ passed" /tmp/nestjs-test.log
    Expected Result: install shows nestjs workspace; test shows "Tests 1 passed (1)"
    Failure Indicators: install fails to link, test fails
    Evidence: .omo/evidence/task-3-nestjs-scaffold-test.log

  Scenario: nestjs build emits all 3 formats (ESM, CJS, declarations)
    Tool: Bash (pnpm build + ls)
    Steps:
      1. pnpm -F @crewai-ts/nestjs build 2>&1 | tee /tmp/nestjs-build.log
      2. ls -la packages/nestjs/dist/index.{js,cjs,d.ts}
    Expected Result: build exits 0, all 3 files present
    Failure Indicators: any file missing, build fails
    Evidence: .omo/evidence/task-3-nestjs-build.log

  Scenario: TypeScript config has the right decorator flags
    Tool: Bash (cat + grep)
    Steps:
      1. grep -E '"experimentalDecorators"' packages/nestjs/tsconfig.json
      2. grep -E '"emitDecoratorMetadata"' packages/nestjs/tsconfig.json
      3. grep -E '"verbatimModuleSyntax"' packages/nestjs/tsconfig.json
    Expected Result: all 3 flags set correctly (`true`, `true`, `false`)
    Failure Indicators: any flag missing or wrong value
    Evidence: .omo/evidence/task-3-nestjs-tsconfig-flags.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-3-nestjs-scaffold-test.log` — full vitest output
  - [ ] `.omo/evidence/task-3-nestjs-build.log` — full tsup output
  - [ ] `.omo/evidence/task-3-nestjs-tsconfig-flags.txt` — `grep` output

  **Commit**: YES
  - Message: `feat(nestjs): scaffold @crewai-ts/nestjs`
  - Files: `packages/nestjs/**`
  - Pre-commit: `pnpm -F @crewai-ts/nestjs test && pnpm -F @crewai-ts/nestjs build`

- [ ] 4. Scaffold `packages/cli/` (`@crewai-ts/cli` v0.1.0, ships `crewai-ts` bin)

  **What to do**:
  - Create directory `packages/cli/` with subdirs `src/`, `test/`.
  - Create `packages/cli/package.json`:
    ```json
    {
      "name": "@crewai-ts/cli",
      "version": "0.1.0",
      "description": "CLI to run a user's crewai-ts project (TypeScript/JavaScript) via tsx.",
      "type": "module",
      "main": "./dist/index.js",
      "bin": { "crewai-ts": "./dist/index.js" },
      "exports": {
        ".": {
          "types": "./dist/index.d.ts",
          "import": "./dist/index.js",
          "require": "./dist/index.cjs",
          "default": "./dist/index.js"
        },
        "./package.json": "./package.json"
      },
      "files": ["dist"],
      "engines": { "node": ">=22.0.0" },
      "sideEffects": false,
      "scripts": {
        "build": "tsup && tsc -p tsconfig.build.json",
        "postbuild": "node --input-type=module -e \"import('./dist/index.js')\"",
        "check": "tsc --noEmit",
        "test": "vitest run",
        "prepack": "npm run build"
      },
      "dependencies": { "tsx": "^4.19.0" },
      "peerDependencies": {
        "@crewai-ts/core": "workspace:*"
      },
      "devDependencies": {
        "@types/node": "^25.9.1",
        "tsup": "^8.5.1",
        "typescript": "^6.0.3",
        "vitest": "^4.1.7"
      }
    }
    ```
  - Create `packages/cli/tsconfig.json` extending `../../tsconfig.base.json` with `"include": ["src", "test", "tsup.config.ts", "vitest.config.ts"]`. (CLI doesn't need `experimentalDecorators: true`; standard strict TS is enough.)
  - Create `packages/cli/tsconfig.build.json` extending `tsconfig.json` with `"rootDir": "src"`, `"outDir": "dist"`, `"emitDeclarationOnly": true`, `"include": ["src/**/*.ts"]`.
  - Create `packages/cli/tsup.config.ts` — **CRITICAL: must include shebang banner**:
    ```ts
    import { defineConfig } from "tsup";
    export default defineConfig({
      entry: { index: "src/bin.ts" },
      format: ["esm", "cjs"],
      dts: false,
      sourcemap: false,
      clean: true,
      shims: true,
      platform: "node",
      target: "node22",
      banner: { js: "#!/usr/bin/env node" },
    });
    ```
  - Create `packages/cli/vitest.config.ts` (verbatim copy of nestjs's):
    ```ts
    import { defineConfig } from "vitest/config";
    export default defineConfig({
      test: { globals: false, environment: "node" },
    });
    ```
  - Create `packages/cli/src/bin.ts` (placeholder):
    ```ts
    #!/usr/bin/env node
    // CLI entry point for `crewai-ts`. Implemented in tasks 11-15.
    const VERSION = "0.1.0";
    export const CLI_VERSION = VERSION;

    if (import.meta.url === `file://${process.argv[1]}`) {
      console.log(`crewai-ts v${VERSION} (scaffold; logic added in tasks 11-15)`);
    }
    ```
  - Create `packages/cli/test/scaffold.test.ts`:
    ```ts
    import { describe, it, expect } from "vitest";
    import { CLI_VERSION } from "../src/bin.js";

    describe("@crewai-ts/cli scaffold", () => {
      it("exports the CLI version", () => {
        expect(CLI_VERSION).toBe("0.1.0");
      });
    });
    ```
  - Run `pnpm install` at root to link the workspace.
  - Run `pnpm -F @crewai-ts/cli test` — should pass (1 test).
  - Run `pnpm -F @crewai-ts/cli build` — should emit `dist/index.{js,cjs,d.ts}` and `dist/bin.js` (or `dist/index.js` per the entry name). **CRITICAL: verify the bin file's first line is `#!/usr/bin/env node`** — read the first 32 bytes of the output file and assert.

  **Must NOT do**:
  - Do NOT use `commander`, `yargs`, or any argv parser library (hand-roll in task 11).
  - Do NOT add subcommands, watch mode, or interactive prompts.
  - Do NOT add `tsx` to peerDeps (it's a hard dep shipped with the CLI; user doesn't install it separately).
  - Do NOT include any `@crewai-ts/nestjs` import (CLI is standalone).

  **Recommended Agent Profile**:
  - **Category**: `quick` (template scaffolding)
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: N/A
    - `git-master`: not needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with tasks 3, 5)
  - **Blocks**: Tasks 11, 12, 13, 14, 15 (cli implementation tasks)
  - **Blocked By**: Task 1 (workspace must exist); task 2 (core must exist for peerDep resolution)

  **References**:
  - **Pattern References**:
    - `packages/nestjs/tsup.config.ts` — tsup config template (just add `banner: { js: "#!/usr/bin/env node" }`)
    - `packages/nestjs/package.json` — package.json template (just change `bin`, `dependencies`, remove nestjs-specific peerDeps)
  - **External References**:
    - tsup banner option: `https://tsup.egoist.dev/#banner` — adds shebang to bin output
    - npm bin field: `https://docs.npmjs.com/cli/v10/configuring-npm/package-json#bin` — single string or object form
  - **WHY Each Reference Matters**:
    - tsup's `banner` option is the standard way to inject shebangs; verify it works for CJS output too
    - npm's `bin` field supports both `string` (defaults bin name to package name) and `object` (multiple bins). Use object form to lock `crewai-ts` as the bin name (not the package name)

  **Acceptance Criteria**:
  - [ ] `packages/cli/package.json` has `"name": "@crewai-ts/cli"`, `"version": "0.1.0"`, `"type": "module"`
  - [ ] `packages/cli/package.json` has `"bin": { "crewai-ts": "./dist/index.js" }`
  - [ ] `packages/cli/package.json` has `dependencies.tsx: "^4.19.0"`
  - [ ] `packages/cli/package.json` has `peerDependencies."@crewai-ts/core": "workspace:*"`
  - [ ] `packages/cli/tsup.config.ts` has `banner: { js: "#!/usr/bin/env node" }`
  - [ ] `packages/cli/src/bin.ts` exists and starts with `#!/usr/bin/env node`
  - [ ] `packages/cli/test/scaffold.test.ts` exists
  - [ ] `pnpm install` at root succeeds with cli workspace linked
  - [ ] `pnpm -F @crewai-ts/cli test` exits 0 (1 passing test)
  - [ ] `pnpm -F @crewai-ts/cli build` exits 0
  - [ ] `head -c 32 packages/cli/dist/index.js` starts with `#!/usr/bin/env node` (asserted by a build-integrity test or shell assertion)
  - [ ] `pnpm -F @crewai-ts/cli postbuild` exits 0

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: cli scaffold test passes
    Tool: Bash (pnpm test)
    Preconditions: tasks 1, 2 complete
    Steps:
      1. pnpm install 2>&1 | tee /tmp/cli-install.log
      2. grep "@crewai-ts/cli" /tmp/cli-install.log
      3. pnpm -F @crewai-ts/cli test 2>&1 | tee /tmp/cli-test.log
      4. grep -E "Tests +[0-9]+ passed" /tmp/cli-test.log
    Expected Result: install links cli; test shows "Tests 1 passed (1)"
    Failure Indicators: install fails, test fails
    Evidence: .omo/evidence/task-4-cli-scaffold-test.log

  Scenario: cli bin output has shebang on first line
    Tool: Bash (head -c 32)
    Steps:
      1. pnpm -F @crewai-ts/cli build 2>&1 | tee /tmp/cli-build.log
      2. head -c 32 packages/cli/dist/index.js | xxd | head -2
      3. head -c 15 packages/cli/dist/index.js
    Expected Result: first 15 bytes are `#!/usr/bin/env n` (or similar — assert exact match)
    Failure Indicators: missing shebang, malformed shebang
    Evidence: .omo/evidence/task-4-cli-shebang.txt

  Scenario: cli is invokable as a script (smoke test)
    Tool: Bash (node packages/cli/dist/index.js --help or version)
    Steps:
      1. node packages/cli/dist/index.js
      2. echo "exit=$?"
    Expected Result: prints "crewai-ts v0.1.0 (scaffold; logic added in tasks 11-15)", exit 0
    Failure Indicators: throws, crashes, exits non-zero
    Evidence: .omo/evidence/task-4-cli-smoke.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-4-cli-scaffold-test.log` — full vitest output
  - [ ] `.omo/evidence/task-4-cli-shebang.txt` — `head -c 32` hex output
  - [ ] `.omo/evidence/task-4-cli-smoke.txt` — output of `node packages/cli/dist/index.js`

  **Commit**: YES
  - Message: `feat(cli): scaffold @crewai-ts/cli with crewai-ts bin`
  - Files: `packages/cli/**`
  - Pre-commit: `pnpm -F @crewai-ts/cli test && pnpm -F @crewai-ts/cli build && head -c 15 packages/cli/dist/index.js | grep -q '^#!/usr/bin/env node$'`

- [ ] 5. Root tooling update (eslint, CI, README, .codegraph)

  **What to do**:
  - Create root `eslint.config.js` that lints all 3 packages with per-package `tsconfig.eslint.json` references:
    ```js
    // @ts-check
    import js from "@eslint/js";
    import tseslint from "typescript-eslint";
    import globals from "globals";

    export default tseslint.config(
      { ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**"] },
      ...tseslint.configs.strictTypeChecked,
      {
        languageOptions: {
          parserOptions: {
            project: [
              "./packages/core/tsconfig.eslint.json",
              "./packages/core/tsconfig.json",
              "./packages/nestjs/tsconfig.json",
              "./packages/cli/tsconfig.json",
            ],
            tsconfigRootDir: import.meta.dirname,
          },
          globals: { ...globals.node },
        },
        rules: {
          // Lock in: no console.log in prod, no any, etc.
          "@typescript-eslint/no-explicit-any": "error",
          "@typescript-eslint/no-console": ["error", { allow: ["warn", "error"] }],
        },
      },
    );
    ```
  - Update `.github/workflows/ci.yml`: replace `actions/setup-node@v4` with `pnpm/action-setup@v4` + `actions/setup-node@v4` with `cache: "pnpm"`, replace `npm ci` with `pnpm install --frozen-lockfile`, replace `npm run build` with `pnpm -r build`, replace `npm run lint` with `pnpm -r lint`, replace `npm test` with `pnpm -r test`. Keep the matrix structure but the build/test/lint steps become per-workspace.
  - Update `.github/workflows/publish.yml`: scope the publish step to `@crewai-ts/core` only. Use `pnpm -F @crewai-ts/core exec npm publish --access public --provenance` (or `pnpm -F @crewai-ts/core publish`). Add a comment block at the top: "Follow-up: publish workflows for @crewai-ts/nestjs and @crewai-ts/cli will be added in a separate PR."
  - Update root `README.md`:
    - Add a top-level "Packages" section near the top, before "Installation", listing all 3 packages with one-line descriptions and links to each subdirectory's package.json
    - Update "Installation" section: `pnpm add @crewai-ts/core` (or `npm install @crewai-ts/core`) — keep the npm fallback for end-users
    - Add a new "Monorepo" section after "Installation" explaining: `pnpm install` at root, per-package scripts via `pnpm -F <name> <script>`, package list
    - Update "Development" section: replace `npm test` with `pnpm -r test`, `npm run build` with `pnpm -r build`, etc.
  - Add `pnpm` to a new "Build & Test" subsection under "Development"
  - Delete the `npm` references that are now obsolete in CI files (use grep guard in test)

  **Must NOT do**:
  - Do NOT change existing `tseslint.configs.strictTypeChecked` rules (don't add new rule plugins).
  - Do NOT auto-publish `@crewai-ts/nestjs` or `@crewai-ts/cli` in this PR.
  - Do NOT delete the existing `LICENSE` file.
  - Do NOT modify core's source/README; only the root README gets the new "Packages" + "Monorepo" sections.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` (multi-file tooling change; requires careful review of CI yaml semantics)
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: N/A
    - `git-master`: not needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with tasks 3, 4)
  - **Blocks**: Final Wave reviews (CI must be pnpm-native before reviews)
  - **Blocked By**: Task 1 (workspace must exist)

  **References**:
  - **Pattern References**:
    - `eslint.config.js:1-N` — current eslint config; transform to monorepo form
    - `.github/workflows/ci.yml:1-N` — current CI; replace `npm` with `pnpm`
    - `.github/workflows/publish.yml:1-N` — current publish; scope to core
    - `README.md:1-100` — current README; add "Packages" + "Monorepo" sections
  - **External References**:
    - pnpm CI setup: `https://pnpm.io/continuous-integration#github-actions` — pnpm/action-setup usage
    - eslint typescript-eslint project config: `https://typescript-eslint.io/getting-started/typed-linting` — multi-project array
  - **WHY Each Reference Matters**:
    - Current eslint config uses `tseslint.configs.strictTypeChecked` — preserve this to keep core's strictness
    - pnpm CI setup is well-documented; using `pnpm/action-setup@v4` is the current standard
    - `publish.yml` currently uses npm OIDC trusted publishing — keep that mechanism, just change the package filter

  **Acceptance Criteria**:
  - [ ] Root `eslint.config.js` exists with multi-project array referencing all 3 packages
  - [ ] Root `eslint.config.js` ignores `**/dist/**`, `**/node_modules/**`, `**/coverage/**`
  - [ ] `.github/workflows/ci.yml` uses `pnpm/action-setup@v4` and `pnpm install --frozen-lockfile`
  - [ ] `.github/workflows/ci.yml` has no `npm ci`, `npm test`, `npm run` commands (grep guard)
  - [ ] `.github/workflows/ci.yml` uses `pnpm -r build && pnpm -r lint && pnpm -r test` (or equivalent)
  - [ ] `.github/workflows/publish.yml` is scoped to `@crewai-ts/core` only
  - [ ] `.github/workflows/publish.yml` has a comment block referencing the follow-up PR for nestjs/cli
  - [ ] Root `README.md` has a "Packages" section listing all 3 packages
  - [ ] Root `README.md` has a "Monorepo" section with `pnpm install` + `pnpm -r <script>` instructions
  - [ ] Root `README.md` "Development" section uses `pnpm` instead of `npm`
  - [ ] `pnpm -r lint` exits 0 across all 3 packages (sanity check)

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: CI workflow no longer uses npm
    Tool: Bash (grep guard)
    Preconditions: task 1 complete
    Steps:
      1. grep -nE "(npm ci|npm test|npm run|npm install)" .github/workflows/ci.yml | grep -v "node-version"
      2. echo "remaining_npm_refs=$?"
    Expected Result: zero matches (exit 1 from grep = no matches = pass)
    Failure Indicators: any npm command remains
    Evidence: .omo/evidence/task-5-ci-npm-guard.txt

  Scenario: Publish workflow is scoped to core
    Tool: Bash (grep + read)
    Steps:
      1. grep -nE "(crewai-ts/core|crewai-ts/nestjs|crewai-ts/cli)" .github/workflows/publish.yml
      2. grep -nE "(follow-up|Follow-up|FOLLOW-UP)" .github/workflows/publish.yml
    Expected Result: only `@crewai-ts/core` referenced; comment about follow-up present
    Failure Indicators: nestjs or cli referenced for publish; no follow-up comment
    Evidence: .omo/evidence/task-5-publish-scope.txt

  Scenario: Lint passes across all packages
    Tool: Bash (pnpm -r lint)
    Steps:
      1. pnpm -r lint 2>&1 | tee /tmp/root-lint.log
      2. echo "exit=$?"
    Expected Result: exit 0, no errors across all 3 packages
    Failure Indicators: any lint error
    Evidence: .omo/evidence/task-5-root-lint.log

  Scenario: README has Packages and Monorepo sections
    Tool: Bash (grep)
    Steps:
      1. grep -nE "^## (Packages|Monorepo)" README.md
    Expected Result: both sections present
    Failure Indicators: missing section
    Evidence: .omo/evidence/task-5-readme-sections.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-5-ci-npm-guard.txt` — grep output
  - [ ] `.omo/evidence/task-5-publish-scope.txt` — grep output
  - [ ] `.omo/evidence/task-5-root-lint.log` — full lint output
  - [ ] `.omo/evidence/task-5-readme-sections.txt` — section headers

  **Commit**: YES
  - Message: `chore(tooling): pnpm-native CI, scoped publish, monorepo root eslint and README`
  - Files: `eslint.config.js`, `.github/workflows/ci.yml`, `.github/workflows/publish.yml`, `README.md`
  - Pre-commit: `pnpm -r lint && grep -qE "## Packages" README.md && grep -qE "## Monorepo" README.md`

---

- [ ] 6. NestJS: symbol tokens + injection types

  **What to do (TDD: RED first)**:
  - **RED**: Write `packages/nestjs/test/tokens.test.ts` that:
    1. Imports `CREW_FACTORY`, `LLM`, `MEMORY`, `KNOWLEDGE` from `../src/tokens.js`
    2. Asserts each is a `symbol` (not a string)
    3. Asserts each token has a `.toString()` that includes the token name (e.g., `Symbol(crewai-ts/CREW_FACTORY)`)
    4. Imports `LLMToken`, `MemoryToken`, `KnowledgeToken`, `CrewFactoryToken` TYPE exports from `../src/tokens.js` (use `import type`)
    5. Run: `pnpm -F @crewai-ts/nestjs test -- tokens` — should FAIL with "Cannot find module '../src/tokens.js'"
  - **GREEN**: Create `packages/nestjs/src/tokens.ts`:
    ```ts
    import type { Crew, Memory, Knowledge, LLM, Agent } from "@crewai-ts/core";

    export const CREW_FACTORY = Symbol.for("crewai-ts/CREW_FACTORY");
    export const LLM = Symbol.for("crewai-ts/LLM");
    export const MEMORY = Symbol.for("crewai-ts/MEMORY");
    export const KNOWLEDGE = Symbol.for("crewai-ts/KNOWLEDGE");

    export type CrewFactoryToken = symbol;
    export type LLMToken = symbol;
    export type MemoryToken = symbol;
    export type KnowledgeToken = symbol;

    // Helper types for injection
    export type LLMSupply = LLM | string | null | undefined;
    export type MemorySupply = Memory | null | undefined;
    export type KnowledgeSupply = readonly Knowledge[] | null | undefined;

    // CrewFactory contract: returns a configured Crew
    export interface CrewFactory {
      create(input: { agents: readonly Agent[]; tasks: readonly import("@crewai-ts/core").Task[] }): Crew;
    }
    ```
  - Add `import { CREW_FACTORY, LLM, MEMORY, KNOWLEDGE } from "./tokens.js";` to `packages/nestjs/src/index.ts` (re-export the public surface).
  - **VERIFY GREEN**: `pnpm -F @crewai-ts/nestjs test -- tokens` → "Tests 4 passed (4)".

  **Must NOT do**:
  - Do NOT use string tokens ("CREW_FACTORY" as a string) — must be `symbol` to be tree-shakable and type-safe.
  - Do NOT export Crew/Agent/Memory types from this file; re-use from `@crewai-ts/core`.
  - Do NOT add a `useFactory` here (that's forRoot's job in task 7).

  **Recommended Agent Profile**:
  - **Category**: `quick` (small file, focused TDD cycle)
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: N/A

  **Parallelization**:
  - **Can Run In Parallel**: YES (with tasks 7, 8, 9 in concept; but task 7-9 depend on this)
  - **Parallel Group**: Wave 2 (first task; task 9 factories can run in parallel with task 7 because they both only need tokens)
  - **Blocks**: Tasks 7, 8, 9
  - **Blocked By**: Task 3 (nestjs package must exist)

  **References**:
  - **Pattern References**:
    - `src/llm.ts:329` (LLM type from core) — `LLM` shape re-exported from `@crewai-ts/core`
    - `src/types.ts:30` (Tool type) — pattern for typed injection
  - **External References**:
    - NestJS custom providers: `https://docs.nestjs.com/fundamentals/custom-providers#symbol-providers` — symbol token pattern
  - **WHY Each Reference Matters**:
    - `Symbol.for(...)` creates a globally-registered symbol (shared across instances) vs `Symbol(...)` which is local. Use `.for` so the same token works in test fixtures and the real app.
    - The `LLM` type from core is the same type the user would pass to `Agent` — keeping this consistent means users can reuse their existing types.

  **Acceptance Criteria**:
  - [ ] `packages/nestjs/test/tokens.test.ts` exists
  - [ ] `packages/nestjs/src/tokens.ts` exports `CREW_FACTORY`, `LLM`, `MEMORY`, `KNOWLEDGE` as symbols
  - [ ] `packages/nestjs/src/tokens.ts` exports `LLMSupply`, `MemorySupply`, `KnowledgeSupply`, `CrewFactory` types
  - [ ] `packages/nestjs/src/index.ts` re-exports the 4 symbols
  - [ ] `pnpm -F @crewai-ts/nestjs test -- tokens` exits 0 with 4 passing tests
  - [ ] `pnpm -F @crewai-ts/nestjs build` exits 0 (re-exports compile)

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Symbol tokens are importable and have correct shape
    Tool: Bash (pnpm test -- tokens)
    Preconditions: tasks 1, 2, 3 complete
    Steps:
      1. pnpm -F @crewai-ts/nestjs test -- tokens 2>&1 | tee /tmp/nestjs-tokens-test.log
      2. grep -E "Tests +[0-9]+ passed" /tmp/nestjs-tokens-test.log
      3. node --input-type=module -e "import { CREW_FACTORY, LLM, MEMORY, KNOWLEDGE } from './packages/nestjs/src/tokens.ts'" 2>&1 || true
    Expected Result: "Tests 4 passed (4)" from vitest
    Failure Indicators: test count is 0, 1, 2, or 3; any test fails
    Evidence: .omo/evidence/task-6-tokens-test.log

  Scenario: Tokens are symbols (not strings)
    Tool: Bash (node REPL via inline script)
    Steps:
      1. pnpm -F @crewai-ts/nestjs build
      2. node --input-type=module -e "import { CREW_FACTORY, LLM, MEMORY, KNOWLEDGE } from './packages/nestjs/dist/index.js'; console.log(typeof CREW_FACTORY, typeof LLM, typeof MEMORY, typeof KNOWLEDGE);"
    Expected Result: prints "symbol symbol symbol symbol"
    Failure Indicators: any "string" output
    Evidence: .omo/evidence/task-6-tokens-types.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-6-tokens-test.log` — full vitest output
  - [ ] `.omo/evidence/task-6-tokens-types.txt` — `typeof` output

  **Commit**: YES
  - Message: `feat(nestjs): add symbol tokens (CREW_FACTORY, LLM, MEMORY, KNOWLEDGE)`
  - Files: `packages/nestjs/src/tokens.ts`, `packages/nestjs/test/tokens.test.ts`, `packages/nestjs/src/index.ts`
  - Pre-commit: `pnpm -F @crewai-ts/nestjs test -- tokens && pnpm -F @crewai-ts/nestjs build`

- [ ] 7. NestJS: `CrewModule.forRoot({ llm, memory, knowledge })`

  **What to do (TDD: RED first)**:
  - **RED**: Write `packages/nestjs/test/crew-module.test.ts`:
    1. Test "forRoot registers all 4 tokens": create a `Test.createTestingModule({ imports: [CrewModule.forRoot({ llm: () => "mock-llm-response", memory: null, knowledge: null })] }).compile()`, then resolve `LLM`, `MEMORY`, `KNOWLEDGE`, `CREW_FACTORY` — assert each resolves to the supplied value.
    2. Test "forRoot returns a DynamicModule": call `CrewModule.forRoot({ llm: null })`, assert the result has `module: CrewModule`, `providers: [...]`, `exports: [CREW_FACTORY, LLM, MEMORY, KNOWLEDGE]`.
    3. Test "forRoot without arguments errors": call `CrewModule.forRoot()`, expect throw with "llm is required" (or similar — pick a contract: forRoot always requires at least llm).
    4. Test "forRoot({ llm: 'string' }) registers the string": a string LLM is also valid (matches core's Agent API where llm can be a string).
    5. Test "knowledge array is registered as readonly": forRoot({ llm, knowledge: [{...}] }), resolve KNOWLEDGE, assert it's a readonly array.
    6. Run: `pnpm -F @crewai-ts/nestjs test -- crew-module` — should FAIL.
  - **GREEN**: Create `packages/nestjs/src/crew-module.ts`:
    ```ts
    import { DynamicModule, Module, Provider } from "@nestjs/common";
    import { CREW_FACTORY, KNOWLEDGE, LLM, MEMORY, type CrewFactory, type KnowledgeSupply, type LLMSupply, type MemorySupply } from "./tokens.js";

    export interface CrewModuleOptions {
      llm: LLMSupply;
      memory?: MemorySupply;
      knowledge?: KnowledgeSupply;
    }

    @Module({})
    export class CrewModule {
      static forRoot(options: CrewModuleOptions): DynamicModule {
        if (!options || !("llm" in options)) {
          throw new Error("CrewModule.forRoot requires at least { llm }");
        }
        const providers: Provider[] = [
          { provide: LLM, useValue: options.llm },
          { provide: MEMORY, useValue: options.memory ?? null },
          { provide: KNOWLEDGE, useValue: options.knowledge ?? null },
          {
            provide: CREW_FACTORY,
            useFactory: (): CrewFactory => ({
              create: ({ agents, tasks }) => {
                const { Crew, Process } = require("@crewai-ts/core") as typeof import("@crewai-ts/core");
                return new Crew({ agents: [...agents], tasks: [...tasks], process: Process.sequential });
              },
            }),
          },
        ];
        return {
          module: CrewModule,
          providers,
          exports: [CREW_FACTORY, LLM, MEMORY, KNOWLEDGE],
        };
      }
    }
    ```
  - Add `export { CrewModule, type CrewModuleOptions } from "./crew-module.js";` to `packages/nestjs/src/index.ts`.
  - **VERIFY GREEN**: All 5 tests pass.

  **Must NOT do**:
  - Do NOT add controllers to CrewModule.
  - Do NOT add a `forFeature` or `forFeatureAsync` method.
  - Do NOT use `useClass` providers (the value/factory is the right shape for this module).
  - Do NOT depend on `@nestjs/core` here (only `@nestjs/common`).
  - Do NOT hardcode the `Crew` import — use the `require` to avoid a circular import at module-load time (verify by building).

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` (NestJS dynamic module semantics; multiple test cases including edge cases)
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: N/A

  **Parallelization**:
  - **Can Run In Parallel**: YES (with task 9 — both only need tokens; task 8 depends on this)
  - **Parallel Group**: Wave 2 (second batch)
  - **Blocks**: Tasks 8, 10
  - **Blocked By**: Task 6 (tokens must exist)

  **References**:
  - **Pattern References**:
    - `src/index.ts` (Crew class export) — for the dynamic `require` in the factory
    - `packages/nestjs/src/tokens.ts` — tokens to provide/export
  - **External References**:
    - NestJS DynamicModule: `https://docs.nestjs.com/fundamentals/dynamic-modules#dynamic-modules` — `forRoot` return shape
    - NestJS custom providers: `https://docs.nestjs.com/fundamentals/custom-providers#factory-providers-usefactory` — `useFactory` shape
  - **WHY Each Reference Matters**:
    - DynamicModule shape must include `module`, `providers`, `exports` (no `controllers` allowed per the DI-only guardrail)
    - `useFactory` with no dependencies means the factory is called once at module init; this is what we want for the CrewFactory

  **Acceptance Criteria**:
  - [ ] `packages/nestjs/test/crew-module.test.ts` exists with 5 tests
  - [ ] `packages/nestjs/src/crew-module.ts` exports `CrewModule` (with `@Module({})` decorator) and `CrewModuleOptions` interface
  - [ ] `CrewModule.forRoot({ llm })` returns a `DynamicModule` with `module: CrewModule`, providers for all 4 tokens, exports for all 4 tokens
  - [ ] `CrewModule.forRoot()` (no args) throws
  - [ ] `Test.createTestingModule({ imports: [CrewModule.forRoot({ llm: () => "x" })] }).compile()` succeeds
  - [ ] All 4 tokens resolve to the supplied values
  - [ ] `pnpm -F @crewai-ts/nestjs test -- crew-module` exits 0 with 5 passing tests
  - [ ] `pnpm -F @crewai-ts/nestjs build` exits 0
  - [ ] `CrewModule` does NOT register any controllers (grep guard: `grep -E "controllers:" packages/nestjs/src/crew-module.ts` returns nothing)

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: CrewModule.forRoot registers all 4 tokens
    Tool: Bash (pnpm test + node REPL)
    Preconditions: tasks 1-3, 6 complete
    Steps:
      1. pnpm -F @crewai-ts/nestjs test -- crew-module 2>&1 | tee /tmp/nestjs-crew-test.log
      2. grep -E "Tests +[0-9]+ passed" /tmp/nestjs-crew-test.log
    Expected Result: "Tests 5 passed (5)"
    Failure Indicators: any test fails, count is wrong
    Evidence: .omo/evidence/task-7-crew-module-test.log

  Scenario: No controllers in CrewModule (guardrail)
    Tool: Bash (grep)
    Steps:
      1. grep -nE "controllers:" packages/nestjs/src/crew-module.ts || echo "no controllers (OK)"
    Expected Result: "no controllers (OK)"
    Failure Indicators: any controllers: array present
    Evidence: .omo/evidence/task-7-no-controllers.txt

  Scenario: Test module compiles end-to-end with mock LLM
    Tool: Bash (node REPL with @nestjs/testing)
    Steps:
      1. pnpm -F @crewai-ts/nestjs build
      2. node --input-type=module -e "
         import { Test } from '@nestjs/testing';
         import { CrewModule, LLM } from './packages/nestjs/dist/index.js';
         const m = await Test.createTestingModule({ imports: [CrewModule.forRoot({ llm: () => 'mock' })] }).compile();
         const llm = m.get(LLM);
         console.log('LLM type:', typeof llm, 'result:', llm());
         await m.close();
         "
    Expected Result: "LLM type: function result: mock"
    Failure Indicators: compile error, LLM is undefined
    Evidence: .omo/evidence/task-7-test-module-compile.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-7-crew-module-test.log` — full vitest output
  - [ ] `.omo/evidence/task-7-no-controllers.txt` — grep output
  - [ ] `.omo/evidence/task-7-test-module-compile.txt` — node REPL output

  **Commit**: YES
  - Message: `feat(nestjs): add CrewModule.forRoot({ llm, memory, knowledge })`
  - Files: `packages/nestjs/src/crew-module.ts`, `packages/nestjs/test/crew-module.test.ts`, `packages/nestjs/src/index.ts`
  - Pre-commit: `pnpm -F @crewai-ts/nestjs test -- crew-module && pnpm -F @crewai-ts/nestjs build && grep -L "controllers:" packages/nestjs/src/crew-module.ts`

- [ ] 8. NestJS: `CrewModule.forRootAsync({ useFactory, inject, imports })`

  **What to do (TDD: RED first)**:
  - **RED**: Write `packages/nestjs/test/crew-module-async.test.ts`:
    1. Test "forRootAsync with useFactory resolves async deps": use `Test.createTestingModule({ imports: [CrewModule.forRootAsync({ useFactory: () => ({ llm: async () => "async-llm", memory: null, knowledge: null })) })] }).compile()`, resolve LLM, assert it's the async function.
    2. Test "forRootAsync injects other providers": create a custom `ConfigModule` that provides a `CONFIG` token; forRootAsync injects `CONFIG` and returns `{ llm: config.defaultLlm }`. Assert resolved LLM matches the config value.
    3. Test "forRootAsync supports imports": import a `LoggerModule` that provides `LOGGER`; forRootAsync uses `imports: [LoggerModule]` and the factory returns `{ llm: () => "logged-llm" }`. Assert LLM resolves.
    4. Test "forRootAsync without useFactory throws": call `CrewModule.forRootAsync({})`, expect throw.
    5. Test "forRootAsync without useFactory OR useClass throws": same as above.
    6. Run: `pnpm -F @crewai-ts/nestjs test -- crew-module-async` — should FAIL.
  - **GREEN**: Add to `packages/nestjs/src/crew-module.ts`:
    ```ts
    import { DynamicModule, Module, Provider, Type, ForwardReference } from "@nestjs/common";

    export interface CrewModuleAsyncOptions {
      useFactory: (...args: unknown[]) => CrewModuleOptions | Promise<CrewModuleOptions>;
      inject?: readonly (string | symbol | Type | abstract new (...args: never[]) => unknown)[];
      imports?: readonly (DynamicModule | Type | ForwardReference)[];
    }

    // Inside the CrewModule class:
    static forRootAsync(options: CrewModuleAsyncOptions): DynamicModule {
      if (!options?.useFactory) {
        throw new Error("CrewModule.forRootAsync requires { useFactory }");
      }
      const factoryProvider: Provider = {
        provide: "CREW_MODULE_OPTIONS",
        useFactory: options.useFactory,
        inject: [...(options.inject ?? [])],
      };
      return {
        module: CrewModule,
        imports: [...(options.imports ?? [])],
        providers: [
          factoryProvider,
          {
            provide: LLM,
            useFactory: (opts: CrewModuleOptions) => opts.llm,
            inject: ["CREW_MODULE_OPTIONS"],
          },
          {
            provide: MEMORY,
            useFactory: (opts: CrewModuleOptions) => opts.memory ?? null,
            inject: ["CREW_MODULE_OPTIONS"],
          },
          {
            provide: KNOWLEDGE,
            useFactory: (opts: CrewModuleOptions) => opts.knowledge ?? null,
            inject: ["CREW_MODULE_OPTIONS"],
          },
          {
            provide: CREW_FACTORY,
            useFactory: (): CrewFactory => ({
              create: ({ agents, tasks }) => {
                const { Crew, Process } = require("@crewai-ts/core") as typeof import("@crewai-ts/core");
                return new Crew({ agents: [...agents], tasks: [...tasks], process: Process.sequential });
              },
            }),
          },
        ],
        exports: [CREW_FACTORY, LLM, MEMORY, KNOWLEDGE],
      };
    }
    ```
  - **VERIFY GREEN**: All 5 tests pass.

  **Must NOT do**:
  - Do NOT add `useClass` or `useExisting` — only `useFactory` (per scope: "forRoot + forRootAsync, no other factory patterns").
  - Do NOT support controller registration in forRootAsync.
  - Do NOT add a `isGlobal` flag (out of scope for v1).

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` (NestJS async module semantics; multi-provider dependency wiring)
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: N/A

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on task 7 for the forRoot pattern + same module file)
  - **Parallel Group**: Wave 2 (third batch; runs after task 7)
  - **Blocks**: Task 10 (E2E depends on forRootAsync)
  - **Blocked By**: Task 7 (forRoot pattern establishes the module class)

  **References**:
  - **Pattern References**:
    - `packages/nestjs/src/crew-module.ts` (task 7 output) — same module class, add `forRootAsync` static method
  - **External References**:
    - NestJS async providers: `https://docs.nestjs.com/fundamentals/async-providers` — `useFactory` + `inject` pattern
    - NestJS dynamic module imports: `https://docs.nestjs.com/fundamentals/dynamic-modules#community-guidelines-for-dynamic-modules` — `imports` field
  - **WHY Each Reference Matters**:
    - The `inject` array must be a list of tokens (string, symbol, or class) that NestJS will resolve before calling `useFactory`
    - The `imports` field lets the dynamic module bring in other modules' providers — needed for the "inject other providers" test case

  **Acceptance Criteria**:
  - [ ] `packages/nestjs/test/crew-module-async.test.ts` exists with 5 tests
  - [ ] `packages/nestjs/src/crew-module.ts` exports `CrewModuleAsyncOptions` interface
  - [ ] `CrewModule.forRootAsync({ useFactory: () => ({...}) })` returns a `DynamicModule`
  - [ ] The returned module has `imports`, `providers` (including a `CREW_MODULE_OPTIONS` factory provider), and `exports`
  - [ ] `forRootAsync` with no `useFactory` throws
  - [ ] `Test.createTestingModule({ imports: [CrewModule.forRootAsync({ useFactory: ... })] }).compile()` succeeds
  - [ ] All 4 tokens resolve to the factory's return values
  - [ ] When `inject` lists a token from a custom module, the factory receives it as a parameter
  - [ ] `pnpm -F @crewai-ts/nestjs test -- crew-module-async` exits 0 with 5 passing tests

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: forRootAsync resolves with useFactory
    Tool: Bash (pnpm test)
    Preconditions: tasks 1-3, 6, 7 complete
    Steps:
      1. pnpm -F @crewai-ts/nestjs test -- crew-module-async 2>&1 | tee /tmp/nestjs-async-test.log
      2. grep -E "Tests +[0-9]+ passed" /tmp/nestjs-async-test.log
    Expected Result: "Tests 5 passed (5)"
    Failure Indicators: any test fails
    Evidence: .omo/evidence/task-8-forrootasync-test.log

  Scenario: forRootAsync injects other providers
    Tool: Bash (node REPL)
    Steps:
      1. pnpm -F @crewai-ts/nestjs build
      2. node --input-type=module -e "
         import { Test, Module } from '@nestjs/testing';
         import { CrewModule, LLM } from './packages/nestjs/dist/index.js';
         const CONFIG = 'CONFIG';
         class ConfigModule {}
         ConfigModule = Module({ providers: [{ provide: CONFIG, useValue: { defaultLlm: () => 'from-config' } }], exports: [CONFIG] })(ConfigModule);
         const m = await Test.createTestingModule({ imports: [ConfigModule, CrewModule.forRootAsync({ useFactory: (config) => ({ llm: config.defaultLlm, memory: null, knowledge: null }), inject: [CONFIG] })] }).compile();
         const llm = m.get(LLM);
         console.log('LLM from config:', llm());
         await m.close();
         "
    Expected Result: "LLM from config: from-config"
    Failure Indicators: factory not called, inject not resolved
    Evidence: .omo/evidence/task-8-inject-config.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-8-forrootasync-test.log` — full vitest output
  - [ ] `.omo/evidence/task-8-inject-config.txt` — node REPL output

  **Commit**: YES
  - Message: `feat(nestjs): add CrewModule.forRootAsync({ useFactory, inject, imports })`
  - Files: `packages/nestjs/src/crew-module.ts`, `packages/nestjs/test/crew-module-async.test.ts`
  - Pre-commit: `pnpm -F @crewai-ts/nestjs test -- crew-module-async && pnpm -F @crewai-ts/nestjs build`

- [ ] 9. NestJS: `CrewFactory` + `AgentFactory` injectable classes

  **What to do (TDD: RED first)**:
  - **RED**: Write `packages/nestjs/test/factories.test.ts`:
    1. Test "CrewFactory.create() returns a Crew": resolve `CREW_FACTORY`, call `factory.create({ agents: [...], tasks: [...] })`, assert result is an instance of `Crew` from `@crewai-ts/core`.
    2. Test "CrewFactory.create() with empty inputs throws or returns empty Crew": empty agents and tasks — pick a contract (e.g., throws "agents required" or returns a Crew with empty arrays). Match core's `Crew` constructor behavior.
    3. Test "CrewFactory preserves agent role uniqueness": pass 2 agents with the same role, expect dedup or a clear error.
    4. Test "AgentFactory is provided when forRoot has agents option": add `agents: [new Agent({...})]` to forRoot config, register `AgentFactory` token, resolve and call `agentFactory.create({ role: 'x', goal: 'y', backstory: 'z' })`, assert result is an `Agent`.
    5. Test "AgentFactory uses injected LLM by default": forRoot config has `llm: () => 'mock'`, `agents: [{ role: 'x', llm: () => 'override' }]` — the AgentFactory should let user override LLM per-agent, or default to the injected one. Pick: if per-agent LLM is supplied, use it; else use injected.
    6. Run: `pnpm -F @crewai-ts/nestjs test -- factories` — should FAIL.
  - **GREEN**: Create `packages/nestjs/src/factories/crew-factory.ts`:
    ```ts
    import { Inject, Injectable, Optional } from "@nestjs/common";
    import { Agent, Crew, Process, type LLM, type Memory, type Task } from "@crewai-ts/core";
    import { LLM, MEMORY } from "../tokens.js";
    import type { CrewFactory } from "../tokens.js";

    @Injectable()
    export class DefaultCrewFactory implements CrewFactory {
      constructor(
        @Optional() @Inject(LLM) private readonly defaultLlm: LLM | string | null = null,
        @Optional() @Inject(MEMORY) private readonly memory: Memory | null = null,
      ) {}

      create({ agents, tasks }: { agents: readonly Agent[]; tasks: readonly Task[] }): Crew {
        if (!agents || agents.length === 0) {
          throw new Error("CrewFactory.create requires at least one agent");
        }
        return new Crew({
          agents: [...agents],
          tasks: [...tasks],
          process: Process.sequential,
          ...(this.memory ? { memory: this.memory } : {}),
        });
      }
    }
    ```
  - Create `packages/nestjs/src/factories/agent-factory.ts`:
    ```ts
    import { Inject, Injectable, Optional } from "@nestjs/common";
    import { Agent, type LLM } from "@crewai-ts/core";
    import { LLM } from "../tokens.js";

    @Injectable()
    export class AgentFactory {
      constructor(@Optional() @Inject(LLM) private readonly defaultLlm: LLM | string | null = null) {}

      create(options: { role: string; goal: string; backstory: string; llm?: LLM | string }): Agent {
        return new Agent({
          ...options,
          llm: options.llm ?? this.defaultLlm ?? (() => ""),
        });
      }
    }
    ```
  - Update `packages/nestjs/src/crew-module.ts` to provide these classes instead of the inline factory:
    ```ts
    // In forRoot providers, replace the CREW_FACTORY provider with:
    DefaultCrewFactory,
    { provide: CREW_FACTORY, useExisting: DefaultCrewFactory },
    // In forRootAsync providers, same change
    ```
  - Update `packages/nestjs/src/index.ts` to export `DefaultCrewFactory`, `AgentFactory`.
  - **VERIFY GREEN**: All 5 tests pass.

  **Must NOT do**:
  - Do NOT add `@Controller()` or HTTP-related decorators to these classes.
  - Do NOT add `forwardRef` or circular DI.
  - Do NOT make the factories `useClass` providers (use `useExisting` for token re-binding).

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` (NestJS DI patterns; class provider semantics)
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: N/A

  **Parallelization**:
  - **Can Run In Parallel**: YES (with task 7; both only need tokens)
  - **Parallel Group**: Wave 2 (second batch)
  - **Blocks**: Task 10
  - **Blocked By**: Task 6 (tokens must exist)

  **References**:
  - **Pattern References**:
    - `src/agent.ts` (Agent class options) — for the AgentFactory's `create` method signature
    - `src/crew.ts` (Crew class options) — for the CrewFactory's `create` method signature
    - `packages/nestjs/src/tokens.ts` — LLM, MEMORY tokens
  - **External References**:
    - NestJS useExisting: `https://docs.nestjs.com/fundamentals/custom-providers#class-providers-useclass` — aliasing pattern
    - NestJS @Injectable: `https://docs.nestjs.com/providers#services` — service registration
  - **WHY Each Reference Matters**:
    - `useExisting` allows the same instance to be available under multiple tokens (here: `DefaultCrewFactory` class AND `CREW_FACTORY` symbol)
    - `@Injectable()` on the factory class is what lets NestJS inject `LLM` and `MEMORY` via constructor parameters

  **Acceptance Criteria**:
  - [ ] `packages/nestjs/test/factories.test.ts` exists with 5 tests
  - [ ] `packages/nestjs/src/factories/crew-factory.ts` exports `DefaultCrewFactory` (with `@Injectable()`)
  - [ ] `packages/nestjs/src/factories/agent-factory.ts` exports `AgentFactory` (with `@Injectable()`)
  - [ ] `CrewModule.forRoot({ llm })` registers `DefaultCrewFactory` AND `CREW_FACTORY` (via useExisting)
  - [ ] `AgentFactory` is registered in forRoot's providers when `agents: [...]` option is supplied (or always — pick one and document)
  - [ ] `Test.createTestingModule(...).get(CREW_FACTORY)` returns a `DefaultCrewFactory` instance
  - [ ] `factory.create({ agents: [agent1], tasks: [task1] })` returns a `Crew` instance
  - [ ] `AgentFactory.create({ role, goal, backstory })` returns an `Agent` instance
  - [ ] `pnpm -F @crewai-ts/nestjs test -- factories` exits 0 with 5 passing tests

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: CrewFactory creates a real Crew
    Tool: Bash (pnpm test)
    Preconditions: tasks 1-3, 6 complete
    Steps:
      1. pnpm -F @crewai-ts/nestjs test -- factories 2>&1 | tee /tmp/nestjs-factories-test.log
      2. grep -E "Tests +[0-9]+ passed" /tmp/nestjs-factories-test.log
    Expected Result: "Tests 5 passed (5)"
    Failure Indicators: any test fails
    Evidence: .omo/evidence/task-9-factories-test.log

  Scenario: CREW_FACTORY is bound to DefaultCrewFactory via useExisting
    Tool: Bash (node REPL)
    Steps:
      1. pnpm -F @crewai-ts/nestjs build
      2. node --input-type=module -e "
         import { Test } from '@nestjs/testing';
         import { CrewModule, CREW_FACTORY, DefaultCrewFactory } from './packages/nestjs/dist/index.js';
         const m = await Test.createTestingModule({ imports: [CrewModule.forRoot({ llm: () => 'x' })] }).compile();
         const factory = m.get(CREW_FACTORY);
         console.log('isDefaultCrewFactory:', factory instanceof DefaultCrewFactory);
         await m.close();
         "
    Expected Result: "isDefaultCrewFactory: true"
    Failure Indicators: false (factory is not the class instance)
    Evidence: .omo/evidence/task-9-useexisting.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-9-factories-test.log` — full vitest output
  - [ ] `.omo/evidence/task-9-useexisting.txt` — node REPL output

  **Commit**: YES
  - Message: `feat(nestjs): add CrewFactory and AgentFactory injectable classes`
  - Files: `packages/nestjs/src/factories/crew-factory.ts`, `packages/nestjs/src/factories/agent-factory.ts`, `packages/nestjs/test/factories.test.ts`, updated `packages/nestjs/src/crew-module.ts` and `packages/nestjs/src/index.ts`
  - Pre-commit: `pnpm -F @crewai-ts/nestjs test -- factories && pnpm -F @crewai-ts/nestjs build`

- [ ] 10. NestJS: E2E integration test

  **What to do (TDD: E2E first since it exercises everything)**:
  - **E2E**: Write `packages/nestjs/test/e2e/crew-kickoff.e2e.test.ts`:
    1. Setup: create a `@crewai-ts/core` `Agent` with a mock LLM that returns `AgentFinish` directly (no tool calls), create a `Task` that uses this agent.
    2. Test "kickoff with mock LLM returns expected output":
       ```ts
       const mod = await Test.createTestingModule({
         imports: [CrewModule.forRoot({ llm: () => "mock-output" })],
       }).compile();
       const factory = mod.get(CREW_FACTORY);
       const crew = factory.create({ agents: [agent], tasks: [task] });
       const result = await crew.kickoff({ inputs: { topic: "test" } });
       expect(result.raw).toBe("mock-output");
       await mod.close();
       ```
    3. Test "forRootAsync with config-based LLM works end-to-end":
       ```ts
       const mod = await Test.createTestingModule({
         imports: [
           CrewModule.forRootAsync({
             useFactory: () => ({ llm: () => "async-mock", memory: null, knowledge: null }),
           }),
         ],
       }).compile();
       const crew = mod.get(CREW_FACTORY).create({ agents: [agent], tasks: [task] });
       const result = await crew.kickoff({ inputs: {} });
       expect(result.raw).toBe("async-mock");
       await mod.close();
       ```
    4. Test "AgentFactory + CrewFactory compose":
       ```ts
       const mod = await Test.createTestingModule({
         imports: [CrewModule.forRoot({ llm: () => "composed" })],
       }).compile();
       const agentFactory = mod.get(AgentFactory);
       const crewFactory = mod.get(CREW_FACTORY);
       const agent = agentFactory.create({ role: "tester", goal: "test", backstory: "test" });
       const crew = crewFactory.create({ agents: [agent], tasks: [task] });
       const result = await crew.kickoff({ inputs: {} });
       expect(result.raw).toBe("composed");
       await mod.close();
       ```
    5. Run: `pnpm -F @crewai-ts/nestjs test -- e2e` — should pass with 3 E2E tests.

  **Must NOT do**:
  - Do NOT use a real LLM API (mock the LLM function).
  - Do NOT add HTTP/controller E2E (out of scope).
  - Do NOT test memory or knowledge behaviors beyond confirming they're injectable.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` (E2E test that exercises the full DI + factory + kickoff chain)
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: N/A

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on tasks 7, 8, 9)
  - **Parallel Group**: Wave 2 (final task of wave)
  - **Blocks**: Final Wave reviews
  - **Blocked By**: Tasks 7, 8, 9

  **References**:
  - **Pattern References**:
    - `src/agent.ts` (Agent construction) — for the test fixture
    - `src/task.ts` (Task construction) — for the test fixture
    - `src/crew.ts` (Crew construction + kickoff) — for the test fixture
    - `src/agent-executors.ts:362-494` (BaseAgentExecutor.invoke) — mock the invoke method to return AgentFinish
  - **External References**:
    - @nestjs/testing: `https://docs.nestjs.com/fundamentals/testing` — `Test.createTestingModule` usage
  - **WHY Each Reference Matters**:
    - The mock LLM must return what the agent's executor expects to short-circuit the tool-use loop. Use a function LLM that returns `{ toolName: ..., arguments: ... }` (a tool call) AND a follow-up that returns a string, OR set `resultAsAnswer: true` on a tool.
    - `crew.kickoff({ inputs })` returns a `CrewOutput` (or async equivalent); the `raw` field is the final output string.

  **Acceptance Criteria**:
  - [ ] `packages/nestjs/test/e2e/crew-kickoff.e2e.test.ts` exists with 3 E2E tests
  - [ ] Test 1 (forRoot) — `crew.kickoff()` returns expected output from mock LLM
  - [ ] Test 2 (forRootAsync) — same, but with async config
  - [ ] Test 3 (composition) — `AgentFactory.create()` + `CrewFactory.create()` + `crew.kickoff()` all work
  - [ ] All tests use mock LLMs (no real API calls)
  - [ ] `pnpm -F @crewai-ts/nestjs test` exits 0 with all new + existing tests passing (4 + 5 + 5 + 5 + 3 + 1 = 23 total)
  - [ ] `pnpm -F @crewai-ts/nestjs build` exits 0

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: E2E test exercises the full kickoff flow
    Tool: Bash (pnpm test)
    Preconditions: tasks 1-3, 6, 7, 8, 9 complete
    Steps:
      1. pnpm -F @crewai-ts/nestjs test 2>&1 | tee /tmp/nestjs-e2e-test.log
      2. grep -E "Tests +[0-9]+ passed" /tmp/nestjs-e2e-test.log
      3. grep -E "Test Files" /tmp/nestjs-e2e-test.log
    Expected Result: "Tests 23 passed (23)" (or similar — 4 tokens + 5 forRoot + 5 forRootAsync + 5 factories + 3 E2E + 1 scaffold = 23)
    Failure Indicators: any test fails, count is wrong
    Evidence: .omo/evidence/task-10-nestjs-e2e.log

  Scenario: kickoff returns the expected output
    Tool: Bash (node REPL)
    Steps:
      1. pnpm -F @crewai-ts/nestjs build
      2. node --input-type=module -e "
         import { Test } from '@nestjs/testing';
         import { CrewModule, CREW_FACTORY } from './packages/nestjs/dist/index.js';
         import { Agent, Task, Process } from '@crewai-ts/core';
         const mod = await Test.createTestingModule({ imports: [CrewModule.forRoot({ llm: () => 'final-output' })] }).compile();
         const factory = mod.get(CREW_FACTORY);
         const agent = new Agent({ role: 'tester', goal: 'test', backstory: 'test', llm: () => 'final-output' });
         const task = new Task({ description: 'test', expectedOutput: 'output', agent });
         const crew = factory.create({ agents: [agent], tasks: [task] });
         const result = await crew.kickoff({ inputs: {} });
         console.log('result.raw:', result.raw);
         await mod.close();
         "
    Expected Result: "result.raw: final-output" (or whatever the core executor produces)
    Failure Indicators: result is undefined, kickoff throws
    Evidence: .omo/evidence/task-10-kickoff-output.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-10-nestjs-e2e.log` — full vitest output
  - [ ] `.omo/evidence/task-10-kickoff-output.txt` — node REPL output

  **Commit**: YES
  - Message: `test(nestjs): add E2E integration test for kickoff flow`
  - Files: `packages/nestjs/test/e2e/crew-kickoff.e2e.test.ts`
  - Pre-commit: `pnpm -F @crewai-ts/nestjs test && pnpm -F @crewai-ts/nestjs build`

---

- [ ] 11. CLI: hand-rolled argv parser

  **What to do (TDD: RED first)**:
  - **RED**: Write `packages/cli/test/argv.test.ts`:
    1. Test "parses positional <path>": `parseArgs(["/some/path"])`, assert `{ path: "/some/path", inputs: null, help: false, version: false, error: null }`.
    2. Test "parses --inputs {json}": `parseArgs(["/path", "--inputs", '{"x":1}'])`, assert `inputs` is `{x: 1}`.
    3. Test "parses --help flag": `parseArgs(["--help"])`, assert `help: true, path: null`.
    4. Test "parses --version flag": `parseArgs(["--version"])`, assert `version: true`.
    5. Test "rejects unknown flags": `parseArgs(["--unknown"])`, assert `error: "unknown flag: --unknown"`.
    6. Test "rejects --inputs without value": `parseArgs(["/path", "--inputs"])`, assert `error: "--inputs requires a JSON string value"`.
    7. Test "rejects --inputs with invalid JSON": `parseArgs(["/path", "--inputs", "not-json"])`, assert `error: "--inputs must be valid JSON: ..."`.
    8. Test "accepts --help and -h (short form)": `parseArgs(["-h"])` → `help: true`.
    9. Test "accepts --version and -v (short form)": `parseArgs(["-v"])` → `version: true`.
    10. Test "empty argv": `parseArgs([])`, assert `error: "missing required <path> argument"`.
    11. Run: `pnpm -F @crewai-ts/cli test -- argv` — should FAIL.
  - **GREEN**: Create `packages/cli/src/argv.ts`:
    ```ts
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

    export const HELP_TEXT = `crewai-ts <project-path> [options]

Run a crewai-ts project.

Arguments:
  <project-path>              Path to a directory with a package.json that depends on @crewai-ts/core.

Options:
  --inputs <json>             JSON object passed as kickoff inputs.
  -h, --help                  Show this help.
  -v, --version               Show version.
`;
    ```
  - **VERIFY GREEN**: All 10 tests pass.

  **Must NOT do**:
  - Do NOT use `commander`, `yargs`, or any other argv parser.
  - Do NOT support env-var fallback (out of scope).
  - Do NOT add subcommand parsing (e.g., `crewai-ts run`, `crewai-ts init`).

  **Recommended Agent Profile**:
  - **Category**: `quick` (10 test cases, simple state machine)
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: N/A

  **Parallelization**:
  - **Can Run In Parallel**: NO (first CLI task; tasks 12, 15 depend on parsed args)
  - **Parallel Group**: Wave 3 (first task)
  - **Blocks**: Tasks 12, 13, 14, 15
  - **Blocked By**: Task 4 (cli package must exist)

  **References**:
  - **Pattern References**:
    - `packages/cli/src/bin.ts` (scaffold) — uses `process.argv[1]` to detect direct invocation
  - **External References**:
    - POSIX getopt conventions: `https://man7.org/linux/man-pages/man1/getopt.1.html` — short and long flag forms
  - **WHY Each Reference Matters**:
    - POSIX `-h`/`-v` short forms are standard for `--help`/`--version`. Users expect this.
    - `--inputs <value>` (space-separated) is more user-friendly than `--inputs=<value>` or `--inputs <value>`-only.

  **Acceptance Criteria**:
  - [ ] `packages/cli/test/argv.test.ts` exists with 10 tests
  - [ ] `packages/cli/src/argv.ts` exports `parseArgs`, `ParsedArgs`, `HELP_TEXT`
  - [ ] All 10 parser tests pass
  - [ ] `pnpm -F @crewai-ts/cli test -- argv` exits 0
  - [ ] `pnpm -F @crewai-ts/cli build` exits 0

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: argv parser handles all 10 cases
    Tool: Bash (pnpm test)
    Preconditions: tasks 1, 2, 4 complete
    Steps:
      1. pnpm -F @crewai-ts/cli test -- argv 2>&1 | tee /tmp/cli-argv-test.log
      2. grep -E "Tests +[0-9]+ passed" /tmp/cli-argv-test.log
    Expected Result: "Tests 10 passed (10)"
    Failure Indicators: any test fails
    Evidence: .omo/evidence/task-11-argv-test.log

  Scenario: parseArgs is importable and runs in isolation
    Tool: Bash (node REPL)
    Steps:
      1. pnpm -F @crewai-ts/cli build
      2. node --input-type=module -e "
         import { parseArgs } from './packages/cli/dist/argv.js';
         console.log(JSON.stringify(parseArgs(['/p', '--inputs', '{\"a\":1}']), null, 2));
         "
    Expected Result: prints `{ path: '/p', inputs: { a: 1 }, help: false, version: false, error: null }`
    Failure Indicators: parse error, type mismatch
    Evidence: .omo/evidence/task-11-argv-repl.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-11-argv-test.log` — full vitest output
  - [ ] `.omo/evidence/task-11-argv-repl.txt` — node REPL output

  **Commit**: YES
  - Message: `feat(cli): add hand-rolled argv parser`
  - Files: `packages/cli/src/argv.ts`, `packages/cli/test/argv.test.ts`
  - Pre-commit: `pnpm -F @crewai-ts/cli test -- argv && pnpm -F @crewai-ts/cli build`

- [ ] 12. CLI: project validator

  **What to do (TDD: RED first)**:
  - **RED**: Write `packages/cli/test/validate-project.test.ts`:
    1. Test "valid project with @crewai-ts/core in dependencies": create a temp dir, write `package.json` with `dependencies: { "@crewai-ts/core": "0.1.11" }`, call `validateProject(tempDir)`, assert `{ valid: true, error: null }`.
    2. Test "valid project with @crewai-ts/core in devDependencies": same but with `devDependencies`. Assert valid.
    3. Test "valid project with @crewai-ts/core in peerDependencies": same but with `peerDependencies`. Assert valid.
    4. Test "invalid: missing package.json": call `validateProject("/non/existent/path")`, assert `{ valid: false, error: "path does not exist: /non/existent/path" }`.
    5. Test "invalid: path is a file, not a dir": create a temp file, call `validateProject(filePath)`, assert `{ valid: false, error: "not a directory" }`.
    6. Test "invalid: package.json missing @crewai-ts/core": create temp dir with `package.json` (no @crewai-ts/core), call validateProject, assert `{ valid: false, error: "Please install @crewai-ts/core in your project: ..." }`.
    7. Test "invalid: package.json malformed JSON": temp dir with `package.json` containing `not json`, call validateProject, assert `{ valid: false, error: "package.json is not valid JSON" }`.
    8. Run: `pnpm -F @crewai-ts/cli test -- validate-project` — should FAIL.
  - **GREEN**: Create `packages/cli/src/validate-project.ts`:
    ```ts
    import { existsSync, readFileSync, statSync } from "node:fs";
    import { join } from "node:path";

    export interface ValidationResult {
      valid: boolean;
      error: string | null;
      packageJson?: Record<string, unknown>;
    }

    function hasCoreInSection(pkg: Record<string, unknown>, section: string): boolean {
      const deps = pkg[section];
      return typeof deps === "object" && deps !== null && "@crewai-ts/core" in (deps as Record<string, unknown>);
    }

    export function validateProject(projectPath: string): ValidationResult {
      if (!existsSync(projectPath)) {
        return { valid: false, error: `path does not exist: ${projectPath}` };
      }
      const stat = statSync(projectPath);
      if (!stat.isDirectory()) {
        return { valid: false, error: `not a directory: ${projectPath}` };
      }
      const pkgPath = join(projectPath, "package.json");
      if (!existsSync(pkgPath)) {
        return { valid: false, error: `no package.json found in ${projectPath}. Please create a package.json that depends on @crewai-ts/core.` };
      }
      let pkg: Record<string, unknown>;
      try {
        const raw = readFileSync(pkgPath, "utf8");
        pkg = JSON.parse(raw) as Record<string, unknown>;
      } catch (e) {
        return { valid: false, error: `package.json is not valid JSON: ${(e as Error).message}` };
      }
      if (!hasCoreInSection(pkg, "dependencies") && !hasCoreInSection(pkg, "devDependencies") && !hasCoreInSection(pkg, "peerDependencies")) {
        return {
          valid: false,
          error: `Please install @crewai-ts/core in your project: cd ${projectPath} && pnpm add @crewai-ts/core`,
          packageJson: pkg,
        };
      }
      return { valid: true, error: null, packageJson: pkg };
    }
    ```
  - **VERIFY GREEN**: All 7 tests pass.

  **Must NOT do**:
  - Do NOT check `node_modules/` for actual installation (just check `package.json` declarations).
  - Do NOT auto-install `@crewai-ts/core` if missing (clear error only).
  - Do NOT validate `tsconfig.json` (out of scope; tsx handles that).

  **Recommended Agent Profile**:
  - **Category**: `quick` (7 test cases with simple file-system fixtures)
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: N/A

  **Parallelization**:
  - **Can Run In Parallel**: YES (with task 15; both only need task 11)
  - **Parallel Group**: Wave 3 (second batch)
  - **Blocks**: Task 13, 14
  - **Blocked By**: Task 11 (parses args to get path)

  **References**:
  - **Pattern References**:
    - `packages/cli/src/argv.ts` — `parseArgs` provides the `path` field
  - **External References**:
    - Node.js fs: `https://nodejs.org/api/fs.html` — `existsSync`, `readFileSync`, `statSync`
  - **WHY Each Reference Matters**:
    - `existsSync` + `statSync` is the canonical "check path exists and is a dir" pattern in Node.js
    - `JSON.parse` errors have a `message` field that includes the position of the parse failure — show it in the error

  **Acceptance Criteria**:
  - [ ] `packages/cli/test/validate-project.test.ts` exists with 7 tests
  - [ ] `packages/cli/src/validate-project.ts` exports `validateProject`, `ValidationResult`
  - [ ] All 7 validator tests pass
  - [ ] `pnpm -F @crewai-ts/cli test -- validate-project` exits 0
  - [ ] Validator returns the parsed `package.json` in the result for downstream use

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: validator handles all 7 cases
    Tool: Bash (pnpm test)
    Preconditions: tasks 1, 2, 4, 11 complete
    Steps:
      1. pnpm -F @crewai-ts/cli test -- validate-project 2>&1 | tee /tmp/cli-validate-test.log
      2. grep -E "Tests +[0-9]+ passed" /tmp/cli-validate-test.log
    Expected Result: "Tests 7 passed (7)"
    Failure Indicators: any test fails
    Evidence: .omo/evidence/task-12-validate-test.log

  Scenario: validator produces clear error for missing core
    Tool: Bash (node REPL)
    Steps:
      1. mkdir -p /tmp/test-fixture-no-core
      2. echo '{"name":"test","version":"0.0.1"}' > /tmp/test-fixture-no-core/package.json
      3. pnpm -F @crewai-ts/cli build
      4. node --input-type=module -e "
         import { validateProject } from './packages/cli/dist/validate-project.js';
         console.log(JSON.stringify(validateProject('/tmp/test-fixture-no-core')));
         "
      5. rm -rf /tmp/test-fixture-no-core
    Expected Result: `{ valid: false, error: "Please install @crewai-ts/core in your project: ..." }`
    Failure Indicators: valid: true (would be wrong), different error message
    Evidence: .omo/evidence/task-12-error-message.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-12-validate-test.log` — full vitest output
  - [ ] `.omo/evidence/task-12-error-message.txt` — error message content

  **Commit**: YES
  - Message: `feat(cli): add project validator (path/package.json/@crewai-ts/core check)`
  - Files: `packages/cli/src/validate-project.ts`, `packages/cli/test/validate-project.test.ts`
  - Pre-commit: `pnpm -F @crewai-ts/cli test -- validate-project && pnpm -F @crewai-ts/cli build`

- [ ] 13. CLI: tsx invocation

  **What to do (TDD: RED first)**:
  - **RED**: Write `packages/cli/test/spawn.test.ts`:
    1. Test "spawns tsx with user file and inputs": create a temp fixture with `package.json` (depends on @crewai-ts/core) and `index.ts` that does `console.log(JSON.stringify({ inputs, env }))`, call `runProject({ projectPath, inputs: { x: 1 }, file: "index.ts" })`, assert stdout contains `"x":1` and exit code is 0.
    2. Test "captures stderr from user code": fixture writes to stderr, assert stderr is captured.
    3. Test "propagates non-zero exit code": fixture exits with `process.exit(1)`, assert returned exit code is 1.
    4. Test "propagates uncaught error": fixture throws, assert returned code is 1 and stderr contains the error.
    5. Test "tsx path resolves to CLI's bundled tsx": use the actual `tsx` resolution, assert the spawned binary is the one in `packages/cli/node_modules/.bin/tsx` (or the hoisted equivalent).
    6. Test "respects user tsconfig": fixture with custom `tsconfig.json` (e.g., `target: ES2017`), verify the output reflects the user's config (e.g., by having a TS feature that differs between targets and checking compilation succeeds).
    7. Run: `pnpm -F @crewai-ts/cli test -- spawn` — should FAIL.
  - **GREEN**: Create `packages/cli/src/spawn.ts`:
    ```ts
    import { spawn } from "node:child_process";
    import { join, resolve } from "node:path";
    import { existsSync } from "node:fs";

    export interface SpawnOptions {
      projectPath: string;
      file: string;             // e.g., "index.ts" or "src/main.ts"
      inputs: Record<string, unknown> | null;
    }

    export interface SpawnResult {
      exitCode: number;
      stdout: string;
      stderr: string;
    }

    // Resolve the tsx binary that ships with this CLI package.
    function resolveTsxBin(): string {
      // Walk up from this module to find node_modules/.bin/tsx
      let dir = import.meta.dirname ?? __dirname;
      for (let i = 0; i < 6; i++) {
        const candidate = join(dir, "node_modules", ".bin", "tsx");
        if (existsSync(candidate)) return candidate;
        const parent = resolve(dir, "..");
        if (parent === dir) break;
        dir = parent;
      }
      throw new Error("tsx binary not found in CLI's node_modules. Reinstall @crewai-ts/cli.");
    }

    export function runProject(opts: SpawnOptions): Promise<SpawnResult> {
      return new Promise((resolveP) => {
        const tsxBin = resolveTsxBin();
        const userFile = join(opts.projectPath, opts.file);
        const env = {
          ...process.env,
          ...(opts.inputs ? { CREWAI_TS_INPUTS: JSON.stringify(opts.inputs) } : {}),
        };
        const child = spawn(tsxBin, [userFile], {
          cwd: opts.projectPath,
          env,
          stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (d: Buffer) => { stdout += d.toString("utf8"); });
        child.stderr.on("data", (d: Buffer) => { stderr += d.toString("utf8"); });
        child.on("close", (code) => {
          resolveP({ exitCode: code ?? 1, stdout, stderr });
        });
        child.on("error", (err) => {
          resolveP({ exitCode: 1, stdout, stderr: stderr + (stderr ? "\n" : "") + err.message });
        });
      });
    }
    ```
  - **VERIFY GREEN**: All 6 tests pass.

  **Must NOT do**:
  - Do NOT use `node:child_process.exec` (synchronous, blocks event loop).
  - Do NOT auto-install `tsx` at runtime (it's a hard dep of the CLI).
  - Do NOT pass inputs via stdin (use env var `CREWAI_TS_INPUTS` for clean separation; user code reads it).

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` (subprocess management + cross-platform path resolution + signal handling)
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: N/A

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on task 12 for valid project; task 14 depends on this)
  - **Parallel Group**: Wave 3 (third batch)
  - **Blocks**: Task 14
  - **Blocked By**: Task 12 (project must be validated)

  **References**:
  - **Pattern References**:
    - `packages/cli/src/validate-project.ts` (task 12) — pre-validates the project
  - **External References**:
    - Node.js child_process: `https://nodejs.org/api/child_process.html` — `spawn` vs `exec` semantics
    - tsx: `https://github.com/privatenumber/tsx` — usage as a binary
  - **WHY Each Reference Matters**:
    - `spawn` is async and streams stdout/stderr, which is what we need to capture user output
    - tsx is a shebang-script binary at `node_modules/.bin/tsx`; resolving relative to the CLI's own install ensures the right version is used regardless of the user's project

  **Acceptance Criteria**:
  - [ ] `packages/cli/test/spawn.test.ts` exists with 6 tests
  - [ ] `packages/cli/src/spawn.ts` exports `runProject`, `SpawnOptions`, `SpawnResult`
  - [ ] `runProject` returns `{ exitCode, stdout, stderr }` after the user process exits
  - [ ] Exit code is propagated (0 on success, 1 on user error, 130 on SIGINT)
  - [ ] User's stdout is captured verbatim
  - [ ] User's stderr is captured verbatim
  - [ ] `pnpm -F @crewai-ts/cli test -- spawn` exits 0 with 6 passing tests

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: spawn runs user code and captures output
    Tool: Bash (pnpm test)
    Preconditions: tasks 1, 2, 4, 11, 12 complete
    Steps:
      1. pnpm -F @crewai-ts/cli test -- spawn 2>&1 | tee /tmp/cli-spawn-test.log
      2. grep -E "Tests +[0-9]+ passed" /tmp/cli-spawn-test.log
    Expected Result: "Tests 6 passed (6)"
    Failure Indicators: any test fails
    Evidence: .omo/evidence/task-13-spawn-test.log

  Scenario: exit code is propagated
    Tool: Bash (node REPL)
    Steps:
      1. mkdir -p /tmp/test-fixture-spawn
      2. echo '{"name":"test","version":"0.0.1","dependencies":{"@crewai-ts/core":"*"}}' > /tmp/test-fixture-spawn/package.json
      3. echo 'console.log("hello"); process.exit(7);' > /tmp/test-fixture-spawn/index.ts
      4. pnpm -F @crewai-ts/cli build
      5. node --input-type=module -e "
         import { runProject } from './packages/cli/dist/spawn.js';
         const r = await runProject({ projectPath: '/tmp/test-fixture-spawn', file: 'index.ts', inputs: null });
         console.log('exitCode:', r.exitCode, 'stdout:', r.stdout.trim());
         "
      6. rm -rf /tmp/test-fixture-spawn
    Expected Result: "exitCode: 7 stdout: hello"
    Failure Indicators: exitCode is 0 (would be wrong), stdout empty
    Evidence: .omo/evidence/task-13-exit-code.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-13-spawn-test.log` — full vitest output
  - [ ] `.omo/evidence/task-13-exit-code.txt` — node REPL output

  **Commit**: YES
  - Message: `feat(cli): add tsx invocation with stdout/stderr capture`
  - Files: `packages/cli/src/spawn.ts`, `packages/cli/test/spawn.test.ts`
  - Pre-commit: `pnpm -F @crewai-ts/cli test -- spawn && pnpm -F @crewai-ts/cli build`

- [ ] 14. CLI: bin entry `src/bin.ts` wiring

  **What to do (TDD: RED first)**:
  - **RED**: Write `packages/cli/test/bin.test.ts` (E2E that spawns the bin):
    1. Test "bin --help prints help text to stdout": spawn `node packages/cli/dist/bin.js --help`, assert exit 0 and stdout contains "crewai-ts <project-path>".
    2. Test "bin --version prints version to stdout": spawn `node packages/cli/dist/bin.js --version`, assert exit 0 and stdout matches `/^crewai-ts v\d+\.\d+\.\d+/`.
    3. Test "bin with valid project runs user code": create a temp fixture with package.json (depends on @crewai-ts/core) and index.ts, spawn `node packages/cli/dist/bin.js <fixture> --inputs '{"x":1}'`, assert exit 0 and stdout reflects the inputs.
    4. Test "bin with invalid project errors": create temp fixture WITHOUT @crewai-ts/core, spawn, assert exit 2 and stderr contains "Please install @crewai-ts/core".
    5. Test "bin with non-existent path errors": spawn `node packages/cli/dist/bin.js /non/existent`, assert exit 2 and stderr contains "path does not exist".
    6. Test "bin propagates user exit code": fixture exits 7, spawn, assert exit 7.
    7. Run: `pnpm -F @crewai-ts/cli test -- bin` — should FAIL.
  - **GREEN**: Update `packages/cli/src/bin.ts`:
    ```ts
    #!/usr/bin/env node
    import { parseArgs, HELP_TEXT } from "./argv.js";
    import { validateProject } from "./validate-project.js";
    import { runProject } from "./spawn.js";
    import { readFileSync } from "node:fs";
    import { fileURLToPath } from "node:url";
    import { dirname, join } from "node:path";

    const __dirname = dirname(fileURLToPath(import.meta.url));
    // CLI_VERSION is set at scaffold time; can be kept as a literal.
    const CLI_VERSION = "0.1.0";

    // Detect package.json of the running project (optional)
    function findProjectEntry(projectPath: string): string {
      // Default: look for index.ts, then src/index.ts, then main entry from package.json
      const candidates = ["index.ts", "src/index.ts", "main.ts"];
      for (const c of candidates) {
        if (existsSync(join(projectPath, c))) return c;
      }
      // Fallback: read package.json "main" and append .ts
      try {
        const pkg = JSON.parse(readFileSync(join(projectPath, "package.json"), "utf8")) as { main?: string };
        if (pkg.main) return pkg.main.endsWith(".ts") ? pkg.main : `${pkg.main}.ts`;
      } catch { /* fall through */ }
      return "index.ts";
    }

    import { existsSync } from "node:fs";

    async function main(): Promise<void> {
      const argv = process.argv.slice(2);
      const parsed = parseArgs(argv);

      if (parsed.help) {
        process.stdout.write(HELP_TEXT);
        process.exit(0);
      }
      if (parsed.version) {
        process.stdout.write(`crewai-ts v${CLI_VERSION}\n`);
        process.exit(0);
      }
      if (parsed.error) {
        process.stderr.write(`crewai-ts: ${parsed.error}\n\n${HELP_TEXT}`);
        process.exit(2);
      }
      if (!parsed.path) {
        process.stderr.write(`crewai-ts: missing <project-path>\n\n${HELP_TEXT}`);
        process.exit(2);
      }

      const validation = validateProject(parsed.path);
      if (!validation.valid) {
        process.stderr.write(`crewai-ts: ${validation.error}\n`);
        process.exit(2);
      }

      const file = findProjectEntry(parsed.path);
      const result = await runProject({
        projectPath: parsed.path,
        file,
        inputs: parsed.inputs,
      });

      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
      process.exit(result.exitCode);
    }

    // Only run when invoked directly (not when imported by tests)
    if (import.meta.url === `file://${process.argv[1]}`) {
      main().catch((err: unknown) => {
        process.stderr.write(`crewai-ts: unexpected error: ${(err as Error).message}\n`);
        process.exit(1);
      });
    }

    export { main, findProjectEntry, CLI_VERSION };
    ```
  - **VERIFY GREEN**: All 6 E2E tests pass.

  **Must NOT do**:
  - Do NOT add a `chalk`, `ora`, or any output styling.
  - Do NOT prompt the user for input.
  - Do NOT swallow the user's exit code (propagate it exactly).

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` (E2E test that spawns the actual binary; signal handling + exit code propagation)
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: N/A

  **Parallelization**:
  - **Can Run In Parallel**: NO (final CLI task; depends on 11, 12, 13)
  - **Parallel Group**: Wave 3 (final task of wave)
  - **Blocks**: Final Wave reviews
  - **Blocked By**: Tasks 11, 12, 13

  **References**:
  - **Pattern References**:
    - `packages/cli/src/argv.ts` (task 11) — argv parser
    - `packages/cli/src/validate-project.ts` (task 12) — project validator
    - `packages/cli/src/spawn.ts` (task 13) — tsx invocation
  - **External References**:
    - POSIX exit codes: `https://tldp.org/LDP/abs/html/exitcodes.html` — 0/1/2/130/143 conventions
  - **WHY Each Reference Matters**:
    - The bin entry is just orchestration; the actual logic is in argv, validate, spawn. This keeps the bin file small and testable.
    - Exit code 2 is the standard "user error" code (vs 1 for runtime error). Use 2 for arg/validation errors, 1 for unexpected exceptions, and propagate the user's code otherwise.

  **Acceptance Criteria**:
  - [ ] `packages/cli/test/bin.test.ts` exists with 6 E2E tests
  - [ ] `packages/cli/src/bin.ts` exports `main`, `findProjectEntry`, `CLI_VERSION`
  - [ ] `node packages/cli/dist/bin.js --help` prints help and exits 0
  - [ ] `node packages/cli/dist/bin.js --version` prints version and exits 0
  - [ ] `node packages/cli/dist/bin.js <valid-fixture> --inputs '{"x":1}'` runs user code and exits with user's code
  - [ ] `node packages/cli/dist/bin.js <invalid-fixture>` exits 2 with clear stderr
  - [ ] `node packages/cli/dist/bin.js /non/existent` exits 2 with clear stderr
  - [ ] User's exit code is propagated exactly
  - [ ] `pnpm -F @crewai-ts/cli test -- bin` exits 0 with 6 passing tests
  - [ ] `pnpm -F @crewai-ts/cli test` exits 0 with all new + existing tests passing (10 + 7 + 6 + 6 + 1 = 30 total)

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: bin --help and --version work
    Tool: Bash (direct invocation)
    Preconditions: tasks 1, 2, 4, 11, 12, 13 complete
    Steps:
      1. pnpm -F @crewai-ts/cli build
      2. node packages/cli/dist/bin.js --help
      3. echo "exit=$?"
      4. node packages/cli/dist/bin.js --version
      5. echo "exit=$?"
    Expected Result: --help prints usage text, --version prints "crewai-ts v0.1.0", both exit 0
    Failure Indicators: non-zero exit, missing output
    Evidence: .omo/evidence/task-14-help-version.txt

  Scenario: bin runs user fixture and propagates exit code
    Tool: Bash (full E2E with fixture)
    Steps:
      1. mkdir -p /tmp/test-fixture-bin
      2. echo '{"name":"test","version":"0.0.1","dependencies":{"@crewai-ts/core":"*"}}' > /tmp/test-fixture-bin/package.json
      3. echo 'console.log("input:", process.env.CREWAI_TS_INPUTS); process.exit(7);' > /tmp/test-fixture-bin/index.ts
      4. pnpm -F @crewai-ts/cli build
      5. node packages/cli/dist/bin.js /tmp/test-fixture-bin --inputs '{"y":2}'
      6. echo "exit=$?"
      7. rm -rf /tmp/test-fixture-bin
    Expected Result: stdout "input: {\"y\":2}", exit code 7
    Failure Indicators: stdout missing, exit code 0 or 1
    Evidence: .omo/evidence/task-14-e2e-fixture.txt

  Scenario: bin error path is clear
    Tool: Bash (error path)
    Steps:
      1. mkdir -p /tmp/test-fixture-no-core
      2. echo '{"name":"test","version":"0.0.1"}' > /tmp/test-fixture-no-core/package.json
      3. echo 'console.log("should not run");' > /tmp/test-fixture-no-core/index.ts
      4. pnpm -F @crewai-ts/cli build
      5. node packages/cli/dist/bin.js /tmp/test-fixture-no-core 2>&1
      6. echo "exit=$?"
      7. rm -rf /tmp/test-fixture-no-core
    Expected Result: stderr "crewai-ts: Please install @crewai-ts-core in your project: ...", exit code 2
    Failure Indicators: exit 0, no clear error
    Evidence: .omo/evidence/task-14-error-path.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-14-help-version.txt` — output of --help and --version
  - [ ] `.omo/evidence/task-14-e2e-fixture.txt` — output of full E2E run
  - [ ] `.omo/evidence/task-14-error-path.txt` — output of error path

  **Commit**: YES
  - Message: `feat(cli): wire bin entry src/bin.ts with argv/validate/spawn`
  - Files: `packages/cli/src/bin.ts`, `packages/cli/test/bin.test.ts`
  - Pre-commit: `pnpm -F @crewai-ts/cli test && pnpm -F @crewai-ts/cli build`

- [ ] 15. CLI: --help and --version sub-tests

  **What to do (TDD: RED first)**:
  - **RED**: Write `packages/cli/test/help.test.ts`:
    1. Test "--help prints to stdout (not stderr)": capture stdout/stderr from `main()` with `["--help"]`, assert stdout contains "Usage:" and stderr is empty.
    2. Test "--help exits 0": same call, assert exit code 0.
    3. Test "--version prints to stdout": capture stdout from `main()` with `["--version"]`, assert stdout matches `/^crewai-ts v\d+\.\d+\.\d+\n/`.
    4. Test "--version exits 0": same, assert exit code 0.
    5. Test "missing path with --help still shows help": main() with `["--help"]`, assert exit 0 and help text is shown (--help takes precedence over path validation).
    6. Test "invalid JSON inputs gives clear error": main() with `["/path", "--inputs", "not-json"]`, assert exit 2 and stderr contains "--inputs must be valid JSON".
    7. Run: `pnpm -F @crewai-ts/cli test -- help` — should FAIL.
  - **GREEN**: These tests should mostly pass once task 14's bin.ts is correct. The main work here is to add the unit-level tests for the help/version subcommands. If any test fails, the bin.ts logic in task 14 needs adjustment.
  - **VERIFY GREEN**: All 7 tests pass.

  **Must NOT do**:
  - Do NOT add additional CLI features (this is just unit tests for existing features).

  **Recommended Agent Profile**:
  - **Category**: `quick` (7 small tests; existing bin.ts is the impl)
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: N/A

  **Parallelization**:
  - **Can Run In Parallel**: YES (with task 12; both only need task 11)
  - **Parallel Group**: Wave 3 (second batch, parallel with task 12)
  - **Blocks**: Final Wave reviews
  - **Blocked By**: Task 11 (argv parser must exist)

  **References**:
  - **Pattern References**:
    - `packages/cli/src/argv.ts:1-N` — `HELP_TEXT` constant
    - `packages/cli/src/bin.ts:1-N` (task 14 output) — `CLI_VERSION` constant
  - **WHY Each Reference Matters**:
    - Help text and version string are the only user-facing CLI strings; the tests verify they're on stdout (not stderr) and have the expected format.

  **Acceptance Criteria**:
  - [ ] `packages/cli/test/help.test.ts` exists with 7 tests
  - [ ] All 7 tests pass
  - [ ] `pnpm -F @crewai-ts/cli test` exits 0 with all tests passing (10 + 7 + 6 + 6 + 7 + 1 = 37 total)
  - [ ] `pnpm -F @crewai-ts/cli build` exits 0
  - [ ] The bin's help text contains "Usage:" and lists all 3 options
  - [ ] The bin's version string matches the package.json version exactly

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: help and version unit tests pass
    Tool: Bash (pnpm test)
    Preconditions: tasks 1, 2, 4, 11, 14 complete
    Steps:
      1. pnpm -F @crewai-ts/cli test -- help 2>&1 | tee /tmp/cli-help-test.log
      2. grep -E "Tests +[0-9]+ passed" /tmp/cli-help-test.log
    Expected Result: "Tests 7 passed (7)"
    Failure Indicators: any test fails
    Evidence: .omo/evidence/task-15-help-test.log

  Scenario: full CLI test suite passes
    Tool: Bash (pnpm test)
    Steps:
      1. pnpm -F @crewai-ts/cli test 2>&1 | tee /tmp/cli-full-test.log
      2. grep -E "Tests +[0-9]+ passed" /tmp/cli-full-test.log
      3. grep -E "Test Files" /tmp/cli-full-test.log
    Expected Result: "Tests 37 passed (37)" (10 argv + 7 validate + 6 spawn + 6 bin + 7 help + 1 scaffold)
    Failure Indicators: any test fails
    Evidence: .omo/evidence/task-15-full-cli-test.log
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-15-help-test.log` — full vitest output
  - [ ] `.omo/evidence/task-15-full-cli-test.log` — full CLI test suite

  **Commit**: YES
  - Message: `test(cli): add help and version unit tests`
  - Files: `packages/cli/test/help.test.ts`
  - Pre-commit: `pnpm -F @crewai-ts/cli test && pnpm -F @crewai-ts/cli build`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.
> Never mark F1-F4 as checked before getting user's okay. Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns (e.g. `reflect-metadata` in core, `commander` in cli, controllers in nestjs) — reject with file:line if found. Check evidence files exist in `.omo/evidence/`. Verify 851-test count, byte-identical `exports` block, shebang on cli bin, `experimentalDecorators` settings per package.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `pnpm -r check` (per-package tsc --noEmit). Run `pnpm -r lint`. Run `pnpm -r test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp). Verify `experimentalDecorators: false` is explicitly set in `packages/core/tsconfig.json` (not just inherited). Verify cli bin starts with `#!/usr/bin/env node`.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (nestjs module used inside a real NestJS app, cli running a real project with `@crewai-ts/core` installed). Test edge cases: missing @crewai-ts/core (cli error path), invalid --inputs JSON, non-existent project path, Ctrl+C propagation. Save to `.omo/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (`git diff packages/`). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance: no `reflect-metadata` in core, no controllers in nestjs, no subcommands in cli, no turborepo/changesets. Detect cross-task contamination: Task 7 touching Task 9's files. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

Per-wave commits (Wave 0 split into 2 commits, Waves 1-3 each get 1 commit per task group, Final Wave gets 0):

- `chore(workspace): bootstrap pnpm workspace and root tsconfig.base` — `pnpm-workspace.yaml`, root `package.json`, root `tsconfig.base.json`, root `.npmrc`, `.gitignore`
- `chore(core): move @crewai-ts/core into packages/core/` — `packages/core/**`, 851 tests green
- `feat(nestjs): scaffold @crewai-ts/nestjs` — `packages/nestjs/**`
- `feat(cli): scaffold @crewai-ts/cli` — `packages/cli/**`
- `chore(ci): migrate workflows to pnpm` — `.github/workflows/ci.yml`, `.github/workflows/publish.yml`
- `docs(readme): add Packages section and pnpm install instructions` — `README.md`
- `feat(nestjs): add symbol tokens and CrewModule.forRoot` — `packages/nestjs/src/tokens.ts`, `crew-module.ts`, tests
- `feat(nestjs): add CrewModule.forRootAsync` — `packages/nestjs/src/crew-module-async.ts`, tests
- `feat(nestjs): add CrewFactory and AgentFactory` — `packages/nestjs/src/factories/`, tests
- `test(nestjs): add E2E integration test` — `packages/nestjs/test/e2e/`
- `feat(cli): add argv parser` — `packages/cli/src/argv.ts`, tests
- `feat(cli): add project validator` — `packages/cli/src/validate-project.ts`, tests
- `feat(cli): add tsx invocation` — `packages/cli/src/spawn.ts`, tests
- `feat(cli): wire bin entry src/bin.ts` — `packages/cli/src/bin.ts`
- `test(cli): add help and version tests` — `packages/cli/test/help.test.ts`
- `chore(codegraph): re-init index post-restructure` — `.codegraph/` (rebuild)

---

## Success Criteria

### Verification Commands

```bash
# Workspace + tooling
pnpm install                                              # Expected: links all 3 workspaces, pnpm-lock.yaml created
corepack enable && corepack prepare pnpm@9.15.0 --activate  # Expected: pins pnpm version

# Core (moved)
pnpm -F @crewai-ts/core test                              # Expected: "Tests 851 passed (851)"
pnpm -F @crewai-ts/core build                             # Expected: dist/index.{js,cjs,d.ts} emitted
pnpm -F @crewai-ts/core smoke:pack                        # Expected: exit 0

# Parity scripts (after move)
python3 packages/core/scripts/check-class-method-parity.py      # Expected: total_missing=0
python3 packages/core/scripts/check-export-parity.py            # Expected: exit 0
python3 packages/core/scripts/check-subpath-export-parity.py    # Expected: exit 0
node packages/core/scripts/check-a2ui-schema-parity.mjs         # Expected: exit 0

# NestJS (new)
pnpm -F @crewai-ts/nestjs build                            # Expected: dist emitted
pnpm -F @crewai-ts/nestjs test                             # Expected: all new tests pass

# CLI (new)
pnpm -F @crewai-ts/cli build                               # Expected: dist/index.js with shebang on first line
pnpm -F @crewai-ts/cli test                                # Expected: all new tests pass
# E2E
./packages/cli/dist/index.js --help                        # Expected: usage text to stdout
./packages/cli/dist/index.js --version                     # Expected: version to stdout
# (Manual E2E fixture tests run in F3)

# CodeGraph re-init
codegraph init                                            # Expected: fresh index, status shows 0 pending
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] 851 core tests pass
- [ ] All new nestjs + cli tests pass
- [ ] All parity scripts exit 0
- [ ] `crewai-ts --help` prints usage
- [ ] `crewai-ts --version` prints version
- [ ] `crewai-ts <fixture> --inputs '{...}'` runs user code
- [ ] `crewai-ts <missing-deps-fixture>` errors with exit 2 and clear message
- [ ] CI uses pnpm (no `npm` commands)
- [ ] `codegraph_status` shows 0 pending files
