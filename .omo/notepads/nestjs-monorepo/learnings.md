
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

