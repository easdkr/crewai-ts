import { describe, expect, it, vi } from "vitest";

import {
  Agent,
  Crew,
  LiteAgent,
  Task,
  _resolve_agent,
  _resolve_agents,
  default_reset,
  knowledge_reset,
} from "@crewai-ts/core";
import { createRegisteredMemory, createRegisteredMemoryTools } from "@crewai-ts/core/feature-hooks";
import {
  Knowledge,
  Memory,
  StringKnowledgeSource,
} from "../src/index.js";

describe("@crewai-ts/rag core integration hooks", () => {
  it("registers Memory factories and tools for core callers", () => {
    const memory = createRegisteredMemory();

    expect(memory).toBeInstanceOf(Memory);
    expect(createRegisteredMemoryTools(memory as Memory).map((tool) => (tool as { name: string }).name)).toEqual([
      "search_memory",
      "save_to_memory",
    ]);
  });

  it("lets core Agent create Knowledge from package-owned sources", () => {
    const source = new StringKnowledgeSource("Agent knowledge prefers explicit package imports.");
    const agent = new Agent({
      role: "Researcher",
      goal: "Use knowledge",
      backstory: "Careful analyst",
      knowledgeSources: [source],
    });

    expect(agent.knowledge).toBeInstanceOf(Knowledge);
    expect(agent.knowledge?.query("explicit package", { scoreThreshold: null })).toHaveLength(1);
  });

  it("lets core Crew resolve memory: true through the package-owned Memory factory", () => {
    const agent = new Agent({
      role: "Memory Agent",
      goal: "Use memory",
      backstory: "Memory test",
      llm: () => "done",
    });
    const task = new Task({
      description: "Use memory",
      expectedOutput: "Done",
      agent,
    });
    const crew = new Crew({
      agents: [agent],
      tasks: [task],
      memory: true,
    });
    const systems = crew._get_memory_systems();

    expect(systems.memory.system).toBeInstanceOf(Memory);
    (systems.memory.system as Memory).remember("CrewAI supports reset.");

    crew.resetMemories("memory");

    expect((systems.memory.system as Memory).recall("reset", { scoreThreshold: null })).toEqual([]);
  });

  it("resets crew and agent Knowledge through core reset helpers", () => {
    const agentKnowledge = new Knowledge({
      sources: [new StringKnowledgeSource("Agent knowledge prefers standard decorators.")],
    });
    const crewKnowledge = new Knowledge({
      sources: [new StringKnowledgeSource("Crew knowledge keeps Nest DI separate.")],
    });
    const agent = new Agent({
      role: "Researcher",
      goal: "Use knowledge",
      backstory: "Careful analyst",
      knowledge: agentKnowledge,
    });
    const crew = new Crew({
      agents: [agent],
      knowledge: crewKnowledge,
    });

    crew.resetMemories("agent_knowledge");
    expect(agentKnowledge.query("decorators", { scoreThreshold: null })).toEqual([]);
    expect(crewKnowledge.query("Nest", { scoreThreshold: null })).toHaveLength(1);

    crew.resetMemories("knowledge");
    expect(crewKnowledge.query("Nest", { scoreThreshold: null })).toEqual([]);
  });

  it("keeps legacy core helper callbacks compatible with package-owned Knowledge", () => {
    const existing = new Agent({
      role: "Existing",
      goal: "Stay",
      backstory: "Already built",
    });
    const resolved = _resolve_agents([
      existing,
      { role: "Researcher", goal: "Find facts", backstory: "Careful analyst" },
    ]);
    const single = _resolve_agent({ role: "Writer", goal: "Write", backstory: "Clear" });
    const reset = vi.fn();
    const knowledge = new Knowledge({
      sources: [new StringKnowledgeSource("Crew helper knowledge reset.")],
    });
    const agent = new Agent({ role: "Knowledge Reset Agent", goal: "Reset knowledge", backstory: "Knowledge reset" });
    const crew = new Crew({ agents: [agent], knowledge });

    expect(resolved).toHaveLength(2);
    expect((resolved as Agent[])[0]).toBe(existing);
    expect((resolved as Agent[])[1]).toBeInstanceOf(Agent);
    expect(single).toBeInstanceOf(Agent);
    default_reset({ reset });
    expect(reset).toHaveBeenCalledOnce();
    knowledge_reset(crew, [knowledge]);
    expect(knowledge.query("helper", { scoreThreshold: null })).toEqual([]);
  });

  it("lets LiteAgent memory: true resolve to package-owned Memory", () => {
    const agent = new LiteAgent({
      role: "Lite",
      goal: "Remember",
      backstory: "Uses package memory",
      llm: () => "done",
      memory: true,
    });

    expect(agent.memory).toBeInstanceOf(Memory);
  });

  it("lets Crew inject package-owned memory tools into task execution", async () => {
    const memory = new Memory();
    memory.remember("Prefer concise TypeScript ports.");
    const agent = new Agent({
      role: "Memory Agent",
      goal: "Use memory",
      backstory: "Memory test",
      llm: () => "done",
    });
    const task = new Task({
      description: "Search memory",
      expectedOutput: "Done",
      agent,
    });
    const crew = new Crew({
      agents: [agent],
      tasks: [task],
      memory,
    });

    const tools = crew._add_memory_tools([], memory);

    expect(tools.map((tool) => tool.name)).toEqual(["search_memory", "save_to_memory"]);
    await expect(crew.kickoff()).resolves.toMatchObject({ raw: "done" });
  });
});
