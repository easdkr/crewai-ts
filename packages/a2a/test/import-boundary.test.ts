import { describe, expect, it } from "vitest";

import pkg from "../package.json" with { type: "json" };
import { Agent } from "@crewai-ts/core";
import { A2AServerConfig } from "../src/a2a.js";
import "../src/index.js";

describe("@crewai-ts/a2a package boundary", () => {
  it("keeps A2A owned by a feature package with only core as a workspace dependency", () => {
    expect(pkg.name).toBe("@crewai-ts/a2a");
    expect(pkg.dependencies).toEqual({
      "@crewai-ts/core": "workspace:^",
    });
    expect(pkg.dependencies).not.toHaveProperty("@crewai-ts/rag");
    expect(pkg.dependencies).not.toHaveProperty("@modelcontextprotocol/sdk");
    expect(pkg.dependencies).not.toHaveProperty("pdf-parse");
  });

  it("registers A2A hooks with core when the package is imported", () => {
    const agent = new Agent({
      role: "A2A Agent",
      goal: "Expose an agent card",
      backstory: "Uses the A2A package hook",
      a2a: new A2AServerConfig({ name: "A2A Agent" }),
    });

    expect(typeof (agent as unknown as { toAgentCard?: unknown }).toAgentCard).toBe("function");
    expect(typeof (agent as unknown as { to_agent_card?: unknown }).to_agent_card).toBe("function");
  });
});
