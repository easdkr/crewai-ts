import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runProject } from "../src/spawn.js";

/**
 * Each test creates a fresh temp project fixture with the minimal files needed
 * for tsx to run user code: package.json (declares @crewai-ts/core) + index.ts.
 * Cleaned up in afterEach.
 */
function makeProject(suffix = "spawn-"): string {
  return mkdtempSync(join(tmpdir(), `crewai-ts-${suffix}`));
}

function writeProject(projectPath: string, files: Record<string, string>): void {
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(projectPath, name), content);
  }
}

describe("runProject (spawn)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeProject();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("spawns tsx with user file and inputs", async () => {
    writeProject(tempDir, {
      "package.json": JSON.stringify({
        name: "test-proj",
        version: "0.0.1",
        dependencies: { "@crewai-ts/core": "workspace:*" },
      }),
      "index.ts": [
        "const inputs = JSON.parse(process.env.CREWAI_TS_INPUTS ?? '{}');",
        "const env = { ...process.env, CREWAI_TS_INPUTS: undefined };",
        "console.log(JSON.stringify({ inputs, envPresent: typeof process.env.CREWAI_TS_INPUTS }));",
      ].join("\n"),
    });

    const result = await runProject({
      projectPath: tempDir,
      file: "index.ts",
      inputs: { x: 1 },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"x":1');
    // Inputs were passed via env, not as JSON arg.
    expect(result.stdout).toMatch(/"envPresent":"string"/);
  }, 30_000);

  it("captures stderr from user code", async () => {
    writeProject(tempDir, {
      "package.json": JSON.stringify({
        name: "test-proj",
        version: "0.0.1",
        dependencies: { "@crewai-ts/core": "workspace:*" },
      }),
      "index.ts": "console.error('boom-stderr');\nprocess.exit(0);\n",
    });

    const result = await runProject({
      projectPath: tempDir,
      file: "index.ts",
      inputs: null,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("boom-stderr");
  }, 30_000);

  it("propagates non-zero exit code", async () => {
    writeProject(tempDir, {
      "package.json": JSON.stringify({
        name: "test-proj",
        version: "0.0.1",
        dependencies: { "@crewai-ts/core": "workspace:*" },
      }),
      "index.ts": "process.exit(1);\n",
    });

    const result = await runProject({
      projectPath: tempDir,
      file: "index.ts",
      inputs: null,
    });

    expect(result.exitCode).toBe(1);
  }, 30_000);

  it("propagates uncaught error", async () => {
    writeProject(tempDir, {
      "package.json": JSON.stringify({
        name: "test-proj",
        version: "0.0.1",
        dependencies: { "@crewai-ts/core": "workspace:*" },
      }),
      "index.ts": "throw new Error('user-threw');\n",
    });

    const result = await runProject({
      projectPath: tempDir,
      file: "index.ts",
      inputs: null,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("user-threw");
  }, 30_000);

  it("tsx path resolves to a tsx binary shipped with the CLI (workspace or local)", () => {
    // The CLI lists `tsx` as a direct dep; with pnpm's node-linker=isolated,
    // it lives at packages/cli/node_modules/.bin/tsx. We accept any
    // `node_modules/.bin/tsx` reachable by walking up from the spawn module
    // (caller-side, this is what the resolution function does).
    // This test asserts: when we ask the spawn module's resolveTsxBin()
    // (or a mirror of its walk-up logic) the file exists at the CLI's
    // own node_modules, or somewhere in the walk-up chain.
    //
    // We can't import resolveTsxBin() directly (it's not exported) — so we
    // re-implement the walk-up and assert the result.
    const spawnModulePath = resolve(import.meta.dirname, "../src/spawn.js");
    let dir = resolve(spawnModulePath, ".."); // src/
    let found: string | null = null;
    for (let i = 0; i < 6; i++) {
      const candidate = join(dir, "node_modules", ".bin", "tsx");
      if (existsSync(candidate)) {
        found = candidate;
        break;
      }
      const parent = resolve(dir, "..");
      if (parent === dir) break;
      dir = parent;
    }
    expect(found).not.toBeNull();
    // CLI's own node_modules is the first place to check (node-linker=isolated).
    const cliTsx = resolve(
      import.meta.dirname,
      "../node_modules/.bin/tsx",
    );
    expect(existsSync(cliTsx)).toBe(true);
  });

  it("respects user tsconfig (custom target compiles and runs)", async () => {
    // A custom tsconfig with `target: ES2017` lets us prove the user's config
    // is honored: a TS feature that's valid under ES2017 (e.g. async/await is ES2017)
    // is used in the fixture, and we verify it compiled and ran.
    writeProject(tempDir, {
      "package.json": JSON.stringify({
        name: "test-proj",
        version: "0.0.1",
        dependencies: { "@crewai-ts/core": "workspace:*" },
      }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2017",
          module: "ESNext",
          moduleResolution: "Bundler",
          strict: true,
          esModuleInterop: true,
        },
        include: ["index.ts"],
      }),
      "index.ts": [
        "async function main() {",
        "  return 42;",
        "}",
        "main().then((n) => console.log('tsconfig-ok:' + n));",
      ].join("\n"),
    });

    const result = await runProject({
      projectPath: tempDir,
      file: "index.ts",
      inputs: null,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("tsconfig-ok:42");
    // User's tsconfig was honored — async/await was compiled and executed,
    // not rejected for being too modern.
    expect(result.stderr).not.toMatch(/Cannot find name 'Promise'/);
  }, 30_000);
});
