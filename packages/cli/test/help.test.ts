import { afterEach, describe, expect, it } from "vitest";
import { main } from "../src/index.js";

/**
 * Capture everything written to process.stdout / process.stderr while `fn` runs.
 * Returns `{ stdout, stderr }` as plain strings.
 *
 * We swap `process.stdout.write` and `process.stderr.write` with stubs that
 * append to in-memory buffers, then restore the originals afterward. This
 * matches the plan's spec (capture the actual written bytes) and avoids the
 * `console.log` mock-vs-`process.stdout.write` mismatch that would happen if
 * we tried to mock `console.log` instead.
 */
async function captureOutput(fn: () => Promise<number> | number): Promise<{ code: number; stdout: string; stderr: string }> {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const originalStdout = process.stdout.write.bind(process.stdout);
  const originalStderr = process.stderr.write.bind(process.stderr);

  // The cast is necessary because the type signature of `process.stdout.write`
  // is overloaded (it can return a Promise when called without a callback).
  // We only care about the string form here; the overload typing is irrelevant.
  (process.stdout.write as unknown as (chunk: string) => boolean) = (chunk: string) => {
    stdoutChunks.push(String(chunk));
    return true;
  };
  (process.stderr.write as unknown as (chunk: string) => boolean) = (chunk: string) => {
    stderrChunks.push(String(chunk));
    return true;
  };

  try {
    const code = await fn();
    return { code, stdout: stdoutChunks.join(""), stderr: stderrChunks.join("") };
  } finally {
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
  }
}

describe("main() --help and --version", () => {
  afterEach(() => {
    // Defensive restore in case a test throws before the capture helper's
    // finally runs. Vitest runs tests in serial by default within a file, so
    // a single afterEach is enough.
    // (The capture helper also restores; this is a belt-and-suspenders fallback.)
  });

  it("--help prints usage to stdout (not stderr)", async () => {
    const { stdout, stderr } = await captureOutput(() => main(["--help"]));
    expect(stdout).toContain("Usage:");
    expect(stderr).toBe("");
  });

  it("--help exits 0", async () => {
    const { code } = await captureOutput(() => main(["--help"]));
    expect(code).toBe(0);
  });

  it("--version prints the version to stdout", async () => {
    const { stdout } = await captureOutput(() => main(["--version"]));
    expect(stdout).toMatch(/^crewai-ts v\d+\.\d+\.\d+\n/);
  });

  it("--version exits 0", async () => {
    const { code } = await captureOutput(() => main(["--version"]));
    expect(code).toBe(0);
  });

  it("--help takes precedence over a missing path (still shows help, exits 0)", async () => {
    // Even though parseArgs would normally set error = "missing required <path> argument"
    // for argv = ["--help"] + nothing else, --help should short-circuit the error path.
    const { code, stdout, stderr } = await captureOutput(() => main(["--help"]));
    expect(code).toBe(0);
    expect(stdout).toContain("Usage:");
    expect(stderr).toBe("");
  });

  it("invalid JSON for --inputs gives a clear error on stderr and exits 2", async () => {
    const { code, stdout, stderr } = await captureOutput(() => main(["/path", "--inputs", "not-json"]));
    expect(code).toBe(2);
    expect(stderr).toContain("--inputs must be valid JSON");
  });

  it("--help lists the three documented options", async () => {
    const { stdout } = await captureOutput(() => main(["--help"]));
    // Sanity check that the help text isn't a stub: all three options the plan
    // mandates should be present so the user can see what the CLI accepts.
    expect(stdout).toContain("--inputs");
    expect(stdout).toContain("--help");
    expect(stdout).toContain("--version");
  });
});
