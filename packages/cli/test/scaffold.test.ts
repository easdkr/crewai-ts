import { describe, it, expect } from "vitest";
import { CLI_VERSION } from "../src/index.js";

describe("@crewai-ts/cli scaffold", () => {
  it("exports the CLI version", () => {
    expect(CLI_VERSION).toBe("0.1.0");
  });
});
