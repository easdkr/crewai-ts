/**
 * Build-integrity guardrails for the @crewai-ts/core package.
 *
 * This test enforces four invariants the monorepo migration depends on:
 *
 *  1. The `exports` field in `packages/core/package.json` is byte-identical
 *     to the snapshot at `packages/core/test/snapshots/exports.snapshot.json`.
 *     Snapshot drift indicates a public-contract change that must be reviewed.
 *
 *  2. `packages/core/tsconfig.json` explicitly sets
 *     `"experimentalDecorators": false`. This is a guardrail — the library
 *     intentionally avoids NestJS-style decorator metadata. Inheriting `false`
 *     from `tsconfig.base.json` is not enough; the value must be re-asserted
 *     in the per-package config so a future flip in the base cannot silently
 *     introduce NestJS-style decorators.
 *
 *  3. The string `reflect-metadata` must not appear in any of
 *     `dependencies`, `peerDependencies`, or `devDependencies` of
 *     `packages/core/package.json`. The library does not use it; adding it
 *     would invite unintended coupling to NestJS metadata.
 *
 *  4. The three Python parity scripts under `packages/core/scripts/` exist.
 *     They are invoked from CI to compare the TypeScript port against the
 *     Python upstream and would silently no-op (return success without
 *     checking anything) if their paths were renamed.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, "..");
const PACKAGE_JSON_PATH = join(PACKAGE_ROOT, "package.json");
const TSCONFIG_PATH = join(PACKAGE_ROOT, "tsconfig.json");
const SNAPSHOT_PATH = join(
  PACKAGE_ROOT,
  "test",
  "snapshots",
  "exports.snapshot.json",
);

const PYTHON_SCRIPTS = [
  "check-class-method-parity.py",
  "check-export-parity.py",
  "check-subpath-export-parity.py",
] as const;

type PackageJson = {
  name?: string;
  exports?: Record<string, unknown>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const readPackageJson = (): PackageJson =>
  JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8")) as PackageJson;

describe("build-integrity guardrails", () => {
  it("exports block is byte-identical to the snapshot", () => {
    const pkg = readPackageJson();
    const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")) as {
      exports: Record<string, unknown>;
    };

    // Use deep equality via JSON stringification so the test fails loudly on
    // any key-order or value difference.
    expect(JSON.stringify(pkg.exports, null, 2)).toBe(
      JSON.stringify(snapshot.exports, null, 2),
    );
  });

  it('tsconfig.json explicitly sets "experimentalDecorators": false', () => {
    const raw = readFileSync(TSCONFIG_PATH, "utf8");
    // String-grep for the exact guardrail phrase. A bare inherited "false"
    // in the base tsconfig is not enough; the per-package override must be
    // present and visible at a glance.
    expect(raw).toMatch(/"experimentalDecorators"\s*:\s*false/);
  });

  it('package.json contains no "reflect-metadata" dependency', () => {
    const pkg = readPackageJson();
    const sources = [
      pkg.dependencies ?? {},
      pkg.peerDependencies ?? {},
      pkg.devDependencies ?? {},
    ];

    for (const bucket of sources) {
      for (const depName of Object.keys(bucket)) {
        expect(depName).not.toBe("reflect-metadata");
      }
    }
  });

  it("all three Python parity scripts exist under scripts/", () => {
    for (const script of PYTHON_SCRIPTS) {
      const scriptPath = join(PACKAGE_ROOT, "scripts", script);
      expect(existsSync(scriptPath), `missing ${script}`).toBe(true);
    }
  });
});
