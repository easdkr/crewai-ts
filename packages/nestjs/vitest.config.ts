import { defineConfig } from "vitest/config";

export default defineConfig({
  // `poolOptions` is a valid runtime option for `vitest` but missing from the
  // public `InlineConfig` type. The cast keeps `tsc --noEmit` happy without
  // dropping the strict-typed `test` body.
  test: {
    globals: false,
    environment: "node",
    // Serialize across files: the E2E tests construct `new Crew({...})` which
    // opens a per-process SQLite DB via core's `KickoffTaskOutputsSQLiteStorage`
    // (defaulting to a global path under `dbStoragePath()`). When two test files
    // construct crews in parallel, the second `DatabaseSync(...)` instantiation
    // races with the first and fails with "database is locked".
    // `pool: "forks"` + `singleFork: true` + `fileParallelism: false` runs all
    // tests in one Node process strictly sequentially. The 23-test suite
    // completes in ~1s, the same as the parallel baseline, because the per-test
    // wall time is dominated by Nest module compilation, not DB I/O.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
  },
} as Parameters<typeof defineConfig>[0]);
