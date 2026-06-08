import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validateProject } from "../src/validate-project.js";

describe("validateProject", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "crewai-ts-validate-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("valid project with @crewai-ts/core in dependencies", () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({
        name: "test-proj",
        version: "0.0.1",
        dependencies: { "@crewai-ts/core": "0.1.11" },
      }),
    );

    const result = validateProject(tempDir);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
    expect(result.packageJson).toBeDefined();
  });

  it("valid project with @crewai-ts/core in devDependencies", () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({
        name: "test-proj",
        version: "0.0.1",
        devDependencies: { "@crewai-ts/core": "0.1.11" },
      }),
    );

    const result = validateProject(tempDir);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it("valid project with @crewai-ts/core in peerDependencies", () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({
        name: "test-proj",
        version: "0.0.1",
        peerDependencies: { "@crewai-ts/core": "workspace:*" },
      }),
    );

    const result = validateProject(tempDir);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it("invalid: missing package.json (path does not exist)", () => {
    const result = validateProject("/non/existent/path/that/does/not/exist");
    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      "path does not exist: /non/existent/path/that/does/not/exist",
    );
  });

  it("invalid: path is a file, not a dir", () => {
    const filePath = join(tempDir, "not-a-dir.txt");
    writeFileSync(filePath, "hello");

    const result = validateProject(filePath);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/not a directory/);
  });

  it("invalid: package.json missing @crewai-ts/core", () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "test-proj", version: "0.0.1" }),
    );

    const result = validateProject(tempDir);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/^Please install @crewai-ts\/core/);
  });

  it("invalid: package.json malformed JSON", () => {
    writeFileSync(join(tempDir, "package.json"), "not json");

    const result = validateProject(tempDir);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/package\.json is not valid JSON/);
  });
});
