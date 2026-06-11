import { describe, it, expect } from "vitest";
import {
  CREW_FACTORY,
  LLM,
  MEMORY,
  KNOWLEDGE,
  LLM_REGISTRY,
  LLM_ROUTER,
  PLANNING_LLM,
  FUNCTION_CALLING_LLM,
  EVENT_BUS,
  AGENT_REGISTRY,
} from "../src/tokens.js";
import type {
  CrewFactoryToken,
  LLMToken,
  MemoryToken,
  KnowledgeToken,
  LlmRegistryToken,
  LlmRouterToken,
  PlanningLlmToken,
  FunctionCallingLlmToken,
  EventBusToken,
  AgentRegistryToken,
} from "../src/tokens.js";

describe("@crewai-ts/nestjs tokens", () => {
  it("CREW_FACTORY is a symbol with the expected name", () => {
    expect(typeof CREW_FACTORY).toBe("symbol");
    expect(CREW_FACTORY.toString()).toContain("crewai-ts/CREW_FACTORY");
    // compile-time: token TYPE alias is assignable from the runtime symbol
    const token: CrewFactoryToken = CREW_FACTORY;
    expect(token).toBe(CREW_FACTORY);
  });

  it("LLM is a symbol with the expected name", () => {
    expect(typeof LLM).toBe("symbol");
    expect(LLM.toString()).toContain("crewai-ts/LLM");
    const token: LLMToken = LLM;
    expect(token).toBe(LLM);
  });

  it("MEMORY is a symbol with the expected name", () => {
    expect(typeof MEMORY).toBe("symbol");
    expect(MEMORY.toString()).toContain("crewai-ts/MEMORY");
    const token: MemoryToken = MEMORY;
    expect(token).toBe(MEMORY);
  });

  it("KNOWLEDGE is a symbol with the expected name", () => {
    expect(typeof KNOWLEDGE).toBe("symbol");
    expect(KNOWLEDGE.toString()).toContain("crewai-ts/KNOWLEDGE");
    const token: KnowledgeToken = KNOWLEDGE;
    expect(token).toBe(KNOWLEDGE);
  });

  it("LLM_REGISTRY is a symbol with the expected name", () => {
    expect(typeof LLM_REGISTRY).toBe("symbol");
    expect(LLM_REGISTRY.toString()).toContain("crewai-ts/LLM_REGISTRY");
    // compile-time: token TYPE alias is assignable from the runtime symbol
    const token: LlmRegistryToken = LLM_REGISTRY;
    expect(token).toBe(LLM_REGISTRY);
  });

  it("LLM_ROUTER is a symbol with the expected name", () => {
    expect(typeof LLM_ROUTER).toBe("symbol");
    expect(LLM_ROUTER.toString()).toContain("crewai-ts/LLM_ROUTER");
    // compile-time: token TYPE alias is assignable from the runtime symbol
    const token: LlmRouterToken = LLM_ROUTER;
    expect(token).toBe(LLM_ROUTER);
  });

  it("PLANNING_LLM is a symbol with the expected name", () => {
    expect(typeof PLANNING_LLM).toBe("symbol");
    expect(PLANNING_LLM.toString()).toContain("crewai-ts/PLANNING_LLM");
    // compile-time: token TYPE alias is assignable from the runtime symbol
    const token: PlanningLlmToken = PLANNING_LLM;
    expect(token).toBe(PLANNING_LLM);
  });

  it("FUNCTION_CALLING_LLM is a symbol with the expected name", () => {
    expect(typeof FUNCTION_CALLING_LLM).toBe("symbol");
    expect(FUNCTION_CALLING_LLM.toString()).toContain("crewai-ts/FUNCTION_CALLING_LLM");
    // compile-time: token TYPE alias is assignable from the runtime symbol
    const token: FunctionCallingLlmToken = FUNCTION_CALLING_LLM;
    expect(token).toBe(FUNCTION_CALLING_LLM);
  });

  it("EVENT_BUS is a symbol with the expected name", () => {
    expect(typeof EVENT_BUS).toBe("symbol");
    expect(EVENT_BUS.toString()).toContain("crewai-ts/EVENT_BUS");
    // compile-time: token TYPE alias is assignable from the runtime symbol
    const token: EventBusToken = EVENT_BUS;
    expect(token).toBe(EVENT_BUS);
  });

  it("AGENT_REGISTRY is a symbol with the expected name", () => {
    expect(typeof AGENT_REGISTRY).toBe("symbol");
    expect(AGENT_REGISTRY.toString()).toContain("crewai-ts/AGENT_REGISTRY");
    // compile-time: token TYPE alias is assignable from the runtime symbol
    const token: AgentRegistryToken = AGENT_REGISTRY;
    expect(token).toBe(AGENT_REGISTRY);
  });
});
