import { describe, expect, it } from "vitest";

import pkg from "../package.json" with { type: "json" };
import { and_, or_ } from "../src/flow/dsl/_conditions.js";
import { humanFeedback } from "../src/flow/dsl/_human_feedback.js";
import { listen } from "../src/flow/dsl/_listen.js";
import { router } from "../src/flow/dsl/_router.js";
import { start } from "../src/flow/dsl/_start.js";
import { FlowMethodDecorator, FlowTrigger } from "../src/flow/dsl/_types.js";
import { getFlowMetadata } from "../src/flow/dsl/_utils.js";

describe("@crewai-ts/flow package boundary", () => {
  it("keeps Flow owned by a feature package with explicit dependencies", () => {
    expect(pkg.name).toBe("@crewai-ts/flow");
    expect(pkg.dependencies).toEqual({
      "@crewai-ts/core": "^0.2.0",
      "@crewai-ts/rag": "^0.2.0",
      yaml: "^2.9.0",
    });
    expect(pkg.dependencies).not.toHaveProperty("@modelcontextprotocol/sdk");
    expect(pkg.dependencies).not.toHaveProperty("@crewai-ts/a2a");
    expect(pkg.dependencies).not.toHaveProperty("@crewai-ts/gemini");
  });

  it("owns Flow DSL compatibility subpaths outside core", () => {
    expect(Object.keys(pkg.exports)).toEqual(expect.arrayContaining([
      "./flow/dsl/_conditions",
      "./flow/dsl/_human_feedback",
      "./flow/dsl/_listen",
      "./flow/dsl/_router",
      "./flow/dsl/_start",
      "./flow/dsl/_types",
      "./flow/dsl/_utils",
    ]));
    expect(and_("approved", or_("manual")).type).toBe("AND");
    expect(typeof humanFeedback).toBe("function");
    expect(typeof listen).toBe("function");
    expect(typeof router).toBe("function");
    expect(typeof start).toBe("function");
    expect(FlowTrigger).toEqual({ kind: "FlowTrigger" });
    expect(FlowMethodDecorator).toEqual({ kind: "FlowMethodDecorator" });
    expect(getFlowMetadata(class EmptyFlow {})).toEqual([]);
  });
});
