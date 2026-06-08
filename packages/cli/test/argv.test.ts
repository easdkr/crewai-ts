import { describe, expect, it } from "vitest";
import { parseArgs } from "../src/argv.js";

describe("parseArgs", () => {
  it("parses positional <path>", () => {
    const result = parseArgs(["/some/path"]);
    expect(result).toEqual({
      path: "/some/path",
      inputs: null,
      help: false,
      version: false,
      error: null,
    });
  });

  it("parses --inputs {json}", () => {
    const result = parseArgs(["/path", "--inputs", '{"x":1}']);
    expect(result.path).toBe("/path");
    expect(result.inputs).toEqual({ x: 1 });
    expect(result.error).toBeNull();
  });

  it("parses --help flag", () => {
    const result = parseArgs(["--help"]);
    expect(result.help).toBe(true);
    expect(result.path).toBeNull();
  });

  it("parses --version flag", () => {
    const result = parseArgs(["--version"]);
    expect(result.version).toBe(true);
  });

  it("rejects unknown flags", () => {
    const result = parseArgs(["--unknown"]);
    expect(result.error).toBe("unknown flag: --unknown");
  });

  it("rejects --inputs without value", () => {
    const result = parseArgs(["/path", "--inputs"]);
    expect(result.error).toBe("--inputs requires a JSON string value");
  });

  it("rejects --inputs with invalid JSON", () => {
    const result = parseArgs(["/path", "--inputs", "not-json"]);
    expect(result.error).toMatch(/^\-\-inputs must be valid JSON:/);
  });

  it("accepts --help and -h (short form)", () => {
    expect(parseArgs(["-h"]).help).toBe(true);
    expect(parseArgs(["--help"]).help).toBe(true);
  });

  it("accepts --version and -v (short form)", () => {
    expect(parseArgs(["-v"]).version).toBe(true);
    expect(parseArgs(["--version"]).version).toBe(true);
  });

  it("empty argv (missing <path>)", () => {
    const result = parseArgs([]);
    expect(result.error).toBe("missing required <path> argument");
  });
});
