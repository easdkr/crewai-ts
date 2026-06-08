import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

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
