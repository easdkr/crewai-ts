
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

## Task 5 (root tooling: eslint, CI, README) — 2026-06-08

**Gotchas**

- **The plan's `@typescript-eslint/no-console` rule does NOT exist in typescript-eslint v8.** The rule was removed/deprecated because base ESLint's `no-console` is the canonical rule. I confirmed this by inspecting `tseslint.configs.strictTypeChecked`'s plugin object (`Object.keys(plugin.rules)` has no `no-console` entry). Using the spec's rule verbatim makes the config fail with `Key "@typescript-eslint/no-console": Could not find "no-console" in plugin "@typescript-eslint"`. **Fix:** use the base ESLint rule name `no-console` instead of `@typescript-eslint/no-console`. I added a short comment in `eslint.config.js` explaining the divergence so a future reader doesn't reintroduce the bug. This is a minor spec correction, not a substantive policy change — the policy ("no `console.log` in prod") is preserved.

- **The spec's loose grep guard `grep -nE "(npm ci|npm test|npm run|npm install)" .github/workflows/ci.yml`** has a false positive: `pnpm install --frozen-lockfile` matches because the substring `npm install` appears in it. The guard is intended to catch real `npm` invocations, not the `npm` substring inside `pnpm install`. I documented this in `.omo/evidence/task-5-ci-npm-guard.txt` with two STRICT guards that pass cleanly: `grep -nE "^[[:space:]]*run:[[:space:]]+npm[[:space:]]"` and `grep -nE "(\$ )?(npm ci|npm test|npm run)"` — both return zero matches. The CI file is fully pnpm-native.

- **`pnpm -r lint` at the root runs the per-package `lint` scripts, not the root `eslint.config.js`.** pnpm recurses into each workspace package and runs that package's own `lint` script. The root `eslint.config.js` is NOT consulted by `pnpm -r lint` (the root has no `lint` script; it spreads `-r lint`). To use the new unified multi-project config, you must either `cd packages/core && npx eslint --config ../../eslint.config.js .` or (in a future wave) flip each package to use the root config. As of Task 5, the per-package configs (only `packages/core/eslint.config.js` exists) remain the active lint source. `pnpm -r lint` exits 0.

- **Direct invocation of the new root config against core surfaces 29 real `no-console` errors** in `packages/core/test/index.test.ts` (lines 45952-46190, 51092-51158) — these are intentional `console.log` calls in test fixtures (debug output, not production code). The plan's "Must NOT modify `packages/core`'s README/source" rule blocks fixing these. I left them as-is; the new rule expresses the policy going forward. If/when a follow-up wave wants to make the root config the canonical lint source, those 29 sites need to be refactored to use `console.warn` / `console.error` or removed.

- **`packages/nestjs` and `packages/cli` don't have a `lint` script in their `package.json`** as of Task 5 completion. Tasks 3 and 4 ship the package source but not a per-package eslint setup. pnpm skips them in `pnpm -r lint` ("Scope: 3 of 4 workspace projects"). This is acceptable for now — the root `eslint.config.js` is the catch-all for both. Future work: add a `lint` script to each new package (typically `eslint .` — they'll use the root config via Node module resolution from cwd, OR an explicit `--config ../../eslint.config.js`).

- **The plan's `precommit` for Task 5 says `pnpm -r lint && grep -qE "## Packages" README.md && grep -qE "## Monorepo" README.md`.** I ran this before committing: `pnpm -r lint` exits 0 (per-package configs, see above), and both `grep -qE "## Packages" README.md` and `grep -qE "## Monorepo" README.md` exit 0 (sections at lines 21 and 44 respectively). All three pass.

- **`pnpm/action-setup@v4` is the current standard for pnpm in GitHub Actions.** The `@v4` tag tracks pnpm 9.x and is consistent with our `packageManager: pnpm@9.15.0` pin. No need to pin to a specific tag.

- **The publish workflow's tag-version check now reads `packages/core/package.json` instead of the root `package.json`.** The root `package.json` doesn't have a meaningful `version` field (`"version": "0.0.0"`, `"private": true`). The new check `node -p "require('./packages/core/package.json').version"` correctly reads the version of the only package we currently publish.

- **The follow-up comment block is at the top of `publish.yml`** (lines 1-2) and the publish step name is `"Publish @crewai-ts/core"` (not `"Publish to npm"`) to make the package scope visually obvious in the GitHub Actions UI.

- **The README's "Packages" section links core to npmjs** (`https://www.npmjs.com/package/@crewai-ts/core`) and nestjs/cli to their local paths (no npm page yet). This is the correct current state — only core is published.

- **`.gitignore` already covers `**/dist/**`, `**/node_modules/**`, `**/coverage/**`** — the eslint config's `ignores` are redundant with .gitignore for tracked files but still needed because eslint's `ignores` is the canonical way to skip files (faster, runs before the file is even opened). No .gitignore change needed.

**Pre-Final-Wave heads-up**

- The root `eslint.config.js` is a "policy document" more than an actively-run config in this PR. If/when a follow-up wave wants to flip all packages to use the root config, the migration is: delete `packages/core/eslint.config.js`, add `lint: eslint .` script to `packages/nestjs` and `packages/cli` (eslint will auto-discover the root config from cwd), and refactor the 29 `console.log` calls in core's test fixtures to use `console.warn` / `console.error` or remove them. This is a non-trivial follow-up; out of scope for Task 5.

- Final Wave reviewers should know that `pnpm -r lint` exits 0 (per-package configs), and the root `eslint.config.js` is "dormant" (loaded but not run by the standard `pnpm -r lint` flow). The plan's acceptance criterion "lint passes across all 3 packages" is technically not met (only core has a lint script) but is consistent with the current state of Tasks 3 and 4 (which also didn't add lint scripts to new packages).


## Task 3 (scaffold @crewai-ts/nestjs) — 2026-06-08

**Gotchas**

- **The base `tsconfig.base.json` sets `verbatimModuleSyntax: true` and `experimentalDecorators: false`.** The nestjs package MUST override both — `experimentalDecorators: true`, `emitDecoratorMetadata: true`, `verbatimModuleSyntax: false` — for NestJS DI to work. Just `extends` is not enough; the base flags would actively break `@Injectable()`.
- **tsup warns "You have emitDecoratorMetadata enabled but @swc/core was not installed, skipping swc plugin"** during the build. This is harmless — tsc is the one that actually needs the metadata (and only for `.d.ts` emission, not for the runtime JS). The ESM/CJS JS still builds fine; only the type metadata downstream is affected. For a placeholder package this doesn't matter, but real DI code in later tasks will need to verify that tsc's `.d.ts` output preserves the metadata. Worth re-checking when tasks 6-10 land.
- **The plan's `pnpm install` is warm.** Running it again on a no-op manifest change produces `Packages: +19` (the first-time install of the nestjs deps). On a fully-warm install, pnpm 9.15 prints no `@crewai-ts/nestjs` line in the log — the workspace symlink is created silently in `packages/nestjs/node_modules/@crewai-ts/core` (a symlink to `../../../core`). The `ls -la packages/nestjs/node_modules/@crewai-ts/` check is the right verification.
- **`pnpm -F @crewai-ts/nestjs postbuild` runs the smoke import successfully** (exit 0). It also re-emits the build output on its own — `pnpm build` and `pnpm postbuild` are separate lifecycle steps in pnpm, NOT chained. The smoke import `import('./dist/index.js')` is a no-op for our placeholder (just loads a single const), but it's the right shape for future tasks.
- **`@nestjs/common`, `@nestjs/core`, `@nestjs/testing` are devDependencies, not peerDeps in devDeps form.** The spec keeps them in `peerDependencies` (for the consuming app) AND in `devDependencies` (so the package's own tests/build can use them). The version constraint in peerDeps is `^10.0.0 || ^11.0.0` (broader for users), but in devDeps it's pinned to `^11.0.0` (so the test matrix is fixed). This is the correct pattern — don't try to "deduplicate" them.
- **`vitest` 4.x emits no warning about the empty test suite or the deprecation note** — the scaffold test runs in ~108ms, which is fast enough that the future test additions in tasks 6-10 won't slow the loop noticeably.

## Task 4 (scaffold @crewai-ts/cli) — 2026-06-08

**Gotchas**

- **The plan's `src/bin.ts` is wrong: it starts with `#!/usr/bin/env node`.** tsup's `banner: { js: "#!/usr/bin/env node" }` pre-injects a shebang on line 1, and tsup's ESM emit keeps the source-comment shebang on line 2. The result is `#!/usr/bin/env node\n#!/usr/bin/env node\n...` in `dist/index.js`, which Node ESM rejects as `SyntaxError: Invalid or unexpected token` on line 2 — breaking both the `postbuild` self-import smoke test and the `node packages/cli/dist/index.js` smoke test. **Fix: do NOT put a shebang in the TS source.** The plan's source example is internally inconsistent with its own `banner` option. I removed the `#!/usr/bin/env node` line from `src/bin.ts`; tsup's banner now produces a clean single shebang.
- **The plan's source filename `bin.ts` produces the wrong `.d.ts` filename.** With `tsup entry: { index: "src/bin.ts" }`, tsup emits `dist/index.{js,cjs}` (using the entry NAME), but `tsc -p tsconfig.build.json` walks the SOURCE filename and emits `dist/bin.d.ts`. The plan's `package.json` exports field points at `./dist/index.d.ts` (so consumers would fail to resolve types). **Fix: renamed `src/bin.ts` → `src/index.ts`** so the source filename matches the tsup entry name and `tsc` emits `dist/index.d.ts`. The `entry: { index: "src/index.ts" }` change in `tsup.config.ts` and the `import { CLI_VERSION } from "../src/index.js"` change in `test/scaffold.test.ts` follow trivially. This is the same pattern core uses (`src/index.ts` + entry `index`).
- **The plan's spec said "or `dist/bin.js` (or `dist/index.js` per the entry name)" in the build step (line 757)** — acknowledging the tsup entry-name behavior. But the spec never reconciled the `.d.ts` emit, which is what `tsc` (not tsup) controls. The plan author was thinking only about tsup output. Real fix is the rename.
- **CJS output also gets the shebang.** tsup applies `banner` to both ESM and CJS. `dist/index.cjs` starts with `#!/usr/bin/env node`, followed by `"use strict";`. Harmless for `node dist/index.cjs` (Node ignores shebangs on `.cjs`), but it means the `bin` field could point at either file. The plan chose `./dist/index.js` (ESM). Sticking with the plan.
- **`postbuild` smoke test** (`node --input-type=module -e "import('./dist/index.js')"`) is a useful canary. If the `dist/index.js` is malformed, it fails immediately at the ESM parse stage with `SyntaxError`, which is the same error a real CLI invocation would produce. The fix for the duplicate shebang was visible here first.
- **Test count is exactly 1 passing** (`Test Files 1 passed (1) | Tests 1 passed (1)`), matching the plan's expected `Tests 1 passed (1)`. Vitest 4.x renders the summary in two lines.
- **The `bin.ts` → `index.ts` rename is the right call long-term** — when tasks 11-15 add the actual CLI logic, they'll likely re-export public helpers from a `src/index.ts` entrypoint (so library consumers can `import { run } from "@crewai-ts/cli"`). Having the entry file named `index.ts` keeps that surface stable. The plan's `bin.ts` name is misleading because the file is BOTH the bin entry AND the library entry.
- **No `experimentalDecorators` override needed** for cli — the plan explicitly said so, and verified: the base `tsconfig.base.json` already has `experimentalDecorators: false`, which is correct for a CLI that won't use NestJS-style decorators.
- **`tsx@^4.19.0` in `dependencies` (not peerDeps)** is correct: the CLI is a standalone runtime that bundles tsx for hot-reload / TS execution, so users running `crewai-ts dev` don't need to install tsx separately. Tasks 11-15 will use this.

