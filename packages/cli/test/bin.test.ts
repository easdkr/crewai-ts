import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * E2E tests for the actual built CLI binary (`node packages/cli/dist/index.js`).
 *
 * The CLI is published as a bin and its real-world flow is:
 *   user types `crewai-ts <path> [--inputs ...]`
 *   -> node packages/cli/dist/index.js <path> [--inputs ...]
 *
 * These tests assert the end-to-end behavior of that binary: argv parsing,
 * --help/--version output, project validation, and exit code propagation.
 *
 * Each non-trivial test creates a temp fixture (package.json + index.ts)
 * and tears it down in afterEach so tests are isolated.
 */

// Path to the built CLI binary. `import.meta.dirname` is the `test/` folder;
// the binary lives in `../dist/index.js` relative to the cli package root,
// and the cli package root is two levels up from this file.
const BIN_PATH = resolve(import.meta.dirname, "../dist/index.js");
// `node` on PATH. We use the process's own node (Node >= 22 per engines).
const NODE_BIN = process.execPath;

interface BinResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Run the CLI binary with the given argv (each entry is one argument).
 * Returns exit code + captured stdout/stderr. Spawns with stdio piped
 * and a 60s timeout so a hung tsx invocation doesn't hang the test suite.
 */
function runBin(args: readonly string[]): Promise<BinResult> {
  return new Promise((resolveP, rejectP) => {
    const child = spawn(NODE_BIN, [BIN_PATH, ...args], {
      cwd: resolve(import.meta.dirname, "../.."), // monorepo root
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString("utf8");
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString("utf8");
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      rejectP(new Error(`CLI binary timed out after 60s. args=${JSON.stringify(args)}`));
    }, 60_000);

    child.on("close", (code) => {
      clearTimeout(timer);
      resolveP({ exitCode: code ?? 1, stdout, stderr });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      rejectP(err);
    });
  });
}

describe("CLI binary (E2E: node packages/cli/dist/index.js)", () => {
  let tempDir: string | null = null;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "crewai-ts-bin-"));
  });

  afterEach(() => {
    if (tempDir !== null) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  function writeFixture(files: Record<string, string>): string {
    // `tempDir` is set in beforeEach; assert non-null to satisfy TS narrowing.
    const dir = tempDir as string;
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(dir, name), content);
    }
    return dir;
  }

  it("--help prints help text to stdout and exits 0", async () => {
    const result = await runBin(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("crewai-ts <project-path>");
  });

  it("--version prints version to stdout and exits 0", async () => {
    const result = await runBin(["--version"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/^crewai-ts v\d+\.\d+\.\d+/);
  });

  it("runs user code for a valid project and propagates inputs", async () => {
    const dir = writeFixture({
      "package.json": JSON.stringify({
        name: "test",
        version: "0.0.1",
        dependencies: { "@crewai-ts/core": "workspace:*" },
      }),
      "index.ts": [
        "const inputs = process.env.CREWAI_TS_INPUTS ?? '<none>';",
        "console.log('input:', inputs);",
      ].join("\n"),
    });

    const result = await runBin([dir, "--inputs", '{"x":1}']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"x":1');
  }, 60_000);

  it("errors with exit 2 when the project has no @crewai-ts/core", async () => {
    const dir = writeFixture({
      "package.json": JSON.stringify({
        name: "test",
        version: "0.0.1",
        // Intentionally no @crewai-ts/core here.
      }),
      "index.ts": "console.log('should not run');\n",
    });

    const result = await runBin([dir]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Please install @crewai-ts/core");
  }, 60_000);

  it("errors with exit 2 when the project path does not exist", async () => {
    const result = await runBin(["/non/existent"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("path does not exist");
  });

  it("propagates the user's exit code exactly", async () => {
    const dir = writeFixture({
      "package.json": JSON.stringify({
        name: "test",
        version: "0.0.1",
        dependencies: { "@crewai-ts/core": "workspace:*" },
      }),
      "index.ts": "process.exit(7);\n",
    });

    const result = await runBin([dir]);
    expect(result.exitCode).toBe(7);
  }, 60_000);
});
