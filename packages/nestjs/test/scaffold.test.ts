import { describe, it, expect } from "vitest";
import { NESTJS_PACKAGE_VERSION } from "../src/index.js";

describe("@crewai-ts/nestjs scaffold", () => {
  it("exports the package version", () => {
    expect(NESTJS_PACKAGE_VERSION).toBe("0.1.3");
  });
});
