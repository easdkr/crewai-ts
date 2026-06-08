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
