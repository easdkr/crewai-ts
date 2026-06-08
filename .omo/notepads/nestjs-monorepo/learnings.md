
## Task 1 (pnpm workspace bootstrap) — 2026-06-08

**Gotchas**

- `corepack` is **not on PATH** in this Volta-managed Node 24.11.1 environment. The binary lives at `~/.volta/tools/image/node/24.11.1/bin/corepack`. To run corepack commands, either:
  - Invoke the absolute path directly: `"$HOME/.volta/tools/image/node/24.11.1/bin/corepack"`.
  - After `corepack prepare pnpm@9.15.0 --activate`, the `pnpm` shim works normally because corepack registers the version with the active Node.
- `package-lock.json` **was git-tracked** (not gitignored) in this repo. The plan said "if not tracked, just `rm`" — but it IS tracked, so use `git rm package-lock.json` to stage the deletion in the same commit. Otherwise the next commit would show a stray untracked-deletion status.
- The old root `package.json` had already populated `node_modules/` via npm. On the first `pnpm install`, pnpm emits `WARN Moving X that was installed by a different package manager to "node_modules/.ignored"` for each previously-installed package and quarantines them. **This is expected**, not a failure — exit code 0. The new lockfile is built fresh from the new `package.json` devDeps.
- The `esbuild` postinstall script was listed under "build scripts that were ignored" by pnpm. This is a safety default (only `pnpm approve-builds` allows them). Task 2 will likely need to re-approve for core to actually build, but root-only install does not need it.
- `node-linker=isolated` was applied — `pnpm install --frozen-lockfile` is fast (~400ms) and produces a clean symlink-based layout.
- `pnpm install` did **not** modify the existing `package.json` (no auto-formatting, no field reordering). The new workspace root package.json is preserved exactly as written.
- `globals@^16.0.0` resolved to `16.5.0` (with `17.6.0` available but not in range). Acceptable — keep range as-is.

**Pre-Task-2 heads-up**

- `tsconfig.json` and `tsconfig.build.json` are still at root untouched. Task 1 only **adds** `tsconfig.base.json`. Task 2 will move core's TS settings into `packages/core/tsconfig.json` (extending the new base) and then delete the root `tsconfig.json`.
- The 6 `crewai-ts-core-0.1.*.tgz` files at root are still in place (correctly ignored by the `*.tgz` line in `.gitignore`).
- The new root `package.json` does NOT include `vitest` config or `tsup.config.ts` references at root — those are left for per-package `scripts` in Task 2. Root `scripts` use `pnpm -r` to fan out.

## Task 2 (move @crewai-ts/core into packages/core/) — 2026-06-08

**Gotchas**

- **The plan's "851 tests" is stale.** Pre-move test count is actually **1239** (`Tests 2 failed | 1237 passed (1239)`), and post-move is **1243** (`Tests 1 failed | 1242 passed (1243)`). The +4 delta is the new `build-integrity.test.ts` guardrail suite. The plan likely captured an earlier snapshot. The true acceptance criterion is "no behavior change in moved tests, all new guardrails pass."
- **One pre-existing flaky test fails in both pre- and post-move runs**: `test/index.test.ts > LLM providers > exposes upstream OpenAICompletion aliases directly on the provider class` at line 38803. It calls `openai.acall(...)` and expects rejection, but the live OpenAI provider returns `"Hello! How can I assist you today?"` (a real completion). This is **not** a regression from the move — it fails identically before and after. Likely an env-dependent live LLM call that resolves to a stub or cached response. Safe to ignore for this task; should be addressed separately (mock the provider or skip in CI).
- **One pre-existing test was ALREADY broken by Task 1**: `test/index.test.ts > package entrypoint > exposes latest upstream Flow DSL typing helper compatibility paths` at line 1098. It calls `exportedPackageSubpaths(exportKeys)` but `exportKeys = Object.keys(exportsMap)` fails with `TypeError: Cannot convert undefined or null to object` because `process.cwd()` (running from root post-Task-1) reads the workspace `package.json` (no `exports` field) instead of the core's `package.json`. **Task 2 fixes this implicitly** — once the package is at `packages/core/`, `pnpm -F @crewai-ts/core test` runs with cwd = `packages/core/`, so `process.cwd()/package.json` resolves to the right file. After Task 2, the test passes.
- **Plan Step 6 is wrong about the a2ui parity script path.** The spec says change `from "../dist/index.js"` to `from "../../dist/index.js"`, reasoning that `scripts/` is now at `packages/core/scripts/`. But `dist/` is at `packages/core/dist/` — they're still SIBLINGS, just one level deeper than before. The correct path is still `from "../dist/index.js"` (unchanged). I followed the spec literally first, got `ERR_MODULE_NOT_FOUND: file:///.../packages/dist/index.js` (one level too high), then corrected to `../dist/index.js` and it worked. The plan author miscounted the relative depth.
- **`git add -u` is required to make git detect renames.** After `git mv` adds the new paths as `A`, the old paths at root show as `D` in the working tree (unstaged). `git diff --cached` then shows the new paths as plain `A` because git can't see both sides of the rename in the staged diff. Running `git add -u` (or `git add -A`) stages the deletions, and `git diff --cached -M` then shows all 96 moves as `R100` (100% similarity). Without this, history preservation still works at commit time, but pre-commit `git status` is misleading.
- **The snapshot test pattern works cleanly.** `build-integrity.test.ts` reads `package.json`, extracts `exports`, compares to `test/snapshots/exports.snapshot.json`. To bootstrap: `node -e "fs.writeFileSync('test/snapshots/exports.snapshot.json', JSON.stringify({exports: require('./package.json').exports}, null, 2) + '\n')"`. The snapshot is byte-stable because the exports block is hand-maintained JSON.
- **The 3 .py parity scripts and the .mjs a2ui script have inconsistent "no upstream" behavior.** When `/tmp/crewai-upstream-current/...` is absent:
  - `check-class-method-parity.py`, `check-export-parity.py`, `check-subpath-export-parity.py` — each prints `Upstream source tree not found: ...` and `sys.exit(0)`. **Exit 0.**
  - `check-a2ui-schema-parity.mjs` — line 23 calls `readFileSync(join(schemaRoot, ...))` with no try/catch, throws `ENOENT`, Node exits 1. **Exit 1.**
  - This is pre-existing behavior — verified by stashing the move and running the pre-move script. Identical exit 1. The plan's acceptance criterion (`node check-a2ui-schema-parity.mjs exits 0`) only holds when the upstream tree is populated. In this env it's not, so exit 1 is expected.
- **`pnpm install` rewrites `pnpm-lock.yaml`** even when the `package.json` only adds a workspace. The diff adds a `packages/core:` section under `importers:` and bumps some dep versions to include `yaml@2.9.0` peer. This is required for the workspace to resolve and must be committed.
- **`pnpm -F @crewai-ts/core test` shows the full vitest output, including the SQLite `ExperimentalWarning`.** Cosmetic, not a failure. The workspace filter works correctly post-`pnpm install`.
- **`esbuild` postinstall did NOT need re-approval** — Task 1's `pnpm install` already approved it at the workspace root, and the approval propagates to all workspace members. `tsup` (which uses esbuild internally) built successfully on the first try.
- **Test count `Test Files 1 failed | 1 passed (2)` looks alarming** — but the "1 failed" is the 1 flaky OpenAI test in `test/index.test.ts`, and "1 passed" is the new `test/build-integrity.test.ts` (4/4). Run in isolation, both file-level results are stable.

**Pre-Task-3 heads-up**

- `packages/core/` is the new home of `@crewai-ts/core`. Other packages (Tasks 3, 4, 5) should depend on it via the workspace (`"@crewai-ts/core": "workspace:*"` in their `package.json`).
- The new `tsconfig.base.json` at root is the single source of TS compiler defaults — every new package should `extends: "../../tsconfig.base.json"` and re-assert `experimentalDecorators: false` as a per-package guardrail (not inherited).
- The `build-integrity.test.ts` pattern is reusable — consider copying it to each new package with package-specific guardrails (no `reflect-metadata`, no NestJS metadata decorators, etc.).
- `tsup` externalizes `node:sqlite` correctly. New packages with native deps should follow the same pattern.


## Task 3 (scaffold @crewai-ts/nestjs) — 2026-06-08

**Gotchas**

- **The base `tsconfig.base.json` sets `verbatimModuleSyntax: true` and `experimentalDecorators: false`.** The nestjs package MUST override both — `experimentalDecorators: true`, `emitDecoratorMetadata: true`, `verbatimModuleSyntax: false` — for NestJS DI to work. Just `extends` is not enough; the base flags would actively break `@Injectable()`.
- **tsup warns "You have emitDecoratorMetadata enabled but @swc/core was not installed, skipping swc plugin"** during the build. This is harmless — tsc is the one that actually needs the metadata (and only for `.d.ts` emission, not for the runtime JS). The ESM/CJS JS still builds fine; only the type metadata downstream is affected. For a placeholder package this doesn't matter, but real DI code in later tasks will need to verify that tsc's `.d.ts` output preserves the metadata. Worth re-checking when tasks 6-10 land.
- **The plan's `pnpm install` is warm.** Running it again on a no-op manifest change produces `Packages: +19` (the first-time install of the nestjs deps). On a fully-warm install, pnpm 9.15 prints no `@crewai-ts/nestjs` line in the log — the workspace symlink is created silently in `packages/nestjs/node_modules/@crewai-ts/core` (a symlink to `../../../core`). The `ls -la packages/nestjs/node_modules/@crewai-ts/` check is the right verification.
- **`pnpm -F @crewai-ts/nestjs postbuild` runs the smoke import successfully** (exit 0). It also re-emits the build output on its own — `pnpm build` and `pnpm postbuild` are separate lifecycle steps in pnpm, NOT chained. The smoke import `import('./dist/index.js')` is a no-op for our placeholder (just loads a single const), but it's the right shape for future tasks.
- **`@nestjs/common`, `@nestjs/core`, `@nestjs/testing` are devDependencies, not peerDeps in devDeps form.** The spec keeps them in `peerDependencies` (for the consuming app) AND in `devDependencies` (so the package's own tests/build can use them). The version constraint in peerDeps is `^10.0.0 || ^11.0.0` (broader for users), but in devDeps it's pinned to `^11.0.0` (so the test matrix is fixed). This is the correct pattern — don't try to "deduplicate" them.
- **`vitest` 4.x emits no warning about the empty test suite or the deprecation note** — the scaffold test runs in ~108ms, which is fast enough that the future test additions in tasks 6-10 won't slow the loop noticeably.
