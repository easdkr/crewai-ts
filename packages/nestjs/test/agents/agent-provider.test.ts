import { describe, it, expect, beforeEach } from "vitest";
import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { Agent } from "@crewai-ts/core";
import { AgentProvider, AgentProviderClass, getAgentRole } from "../../src/agents/agent-provider.js";
import { AgentRegistryService } from "../../src/agents/agent-registry.js";
import { AgentFactory } from "../../src/factories/agent-factory.js";
import { AGENT_REGISTRY, LLM } from "../../src/tokens.js";

describe("AgentProvider + AgentRegistryService", () => {
  let registry: AgentRegistryService;
  beforeEach(() => { registry = new AgentRegistryService(); });

  it("AgentProvider subclass is instantiable", () => {
    class TestProvider extends AgentProvider {
      provide(): Agent {
        return new Agent({ role: "test", goal: "g", backstory: "b", llm: (() => "x") as never });
      }
    }
    const p = new TestProvider();
    expect(p.provide()).toBeInstanceOf(Agent);
  });

  it("AgentRegistryService.register + get round-trips", () => {
    const agent = new Agent({ role: "researcher", goal: "g", backstory: "b", llm: (() => "x") as never });
    registry.register("researcher", agent);
    expect(registry.get("researcher")).toBe(agent);
  });

  it("AgentRegistryService.get(unknown) throws", () => {
    expect(() => registry.get("unknown")).toThrow(/Unknown agent role/);
  });

  it("AgentFactory.create({role: 'registered'}) returns the registered Agent", async () => {
    const agent = new Agent({ role: "researcher", goal: "g", backstory: "b", llm: (() => "x") as never });

    const moduleRef = await Test.createTestingModule({
      providers: [
        AgentFactory,
        AgentRegistryService,
        { provide: AGENT_REGISTRY, useExisting: AgentRegistryService },
        { provide: LLM, useValue: ((): string => "llm") },
      ],
    }).compile();

    // Register on the DI-managed registry (not the local `registry` from
    // beforeEach, which is a separate instance the factory never sees).
    const diRegistry = moduleRef.get(AgentRegistryService);
    diRegistry.register("researcher", agent);

    const factory = moduleRef.get(AgentFactory);
    const result = factory.create({
      role: "researcher",
      goal: "goal",
      backstory: "backstory",
    });
    expect(result).toBe(agent); // identity
    await moduleRef.close();
  });

  it("AgentFactory.create({role: 'unregistered'}) falls back to new Agent path", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AgentFactory,
        AgentRegistryService,
        { provide: AGENT_REGISTRY, useExisting: AgentRegistryService },
        { provide: LLM, useValue: ((): string => "llm") },
      ],
    }).compile();

    const factory = moduleRef.get(AgentFactory);
    const result = factory.create({
      role: "fresh-agent",
      goal: "g",
      backstory: "b",
    });
    expect(result).toBeInstanceOf(Agent);
    expect(result.role).toBe("fresh-agent");
    await moduleRef.close();
  });

  it("AgentProviderClass attaches role metadata", () => {
    const Provider = AgentProviderClass({ role: "writer" });
    expect(getAgentRole(Provider)).toBe("writer");
  });

  it("has() and roles() reflect registry state", () => {
    const a1 = new Agent({ role: "a", goal: "g", backstory: "b", llm: (() => "x") as never });
    const a2 = new Agent({ role: "b", goal: "g", backstory: "b", llm: (() => "x") as never });
    registry.register("a", a1);
    registry.register("b", a2);
    expect(registry.has("a")).toBe(true);
    expect(registry.has("c")).toBe(false);
    expect(new Set(registry.roles())).toEqual(new Set(["a", "b"]));
  });
});
