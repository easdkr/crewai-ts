import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { Agent, Crew, Process, StructuredTool, Task, type BaseTool } from "@crewai-ts/core";
import {
  AGENT_REGISTRY,
  CREW_FACTORY,
  FUNCTION_CALLING_LLM,
  LLM,
  LLM_REGISTRY,
  MEMORY,
  PLANNING_LLM,
} from "../src/tokens.js";
import { DefaultCrewFactory } from "../src/factories/crew-factory.js";
import { AgentFactory } from "../src/factories/agent-factory.js";
import { LlmRegistryService } from "../src/registry/llm-registry.js";
import { AgentRegistryService } from "../src/agents/agent-registry.js";

const buildAgent = (role: string, llm?: (messages: unknown) => unknown): Agent =>
  new Agent({
    role,
    goal: `Goal of ${role}`,
    backstory: `Backstory of ${role}`,
    llm: (llm ?? (() => "default")) as never,
  });

const buildTask = (description: string, agent: Agent): Task =>
  new Task({
    description,
    expectedOutput: `Output of ${description}`,
    agent,
  });

const buildTool = (name: string): BaseTool =>
  new StructuredTool({
    name,
    description: `tool ${name}`,
    argsSchema: { input: { type: "string", required: true } },
    func: (args: Record<string, unknown>): string =>
      `${name}:${String(args["input"] ?? "")}`,
  }) as unknown as BaseTool;

describe("@crewai-ts/nestjs factories", () => {
  it("CrewFactory.create() returns a Crew", async () => {
    const agent1 = buildAgent("researcher");
    const task1 = buildTask("Research {topic}", agent1);

    const moduleRef = await Test.createTestingModule({
      providers: [
        DefaultCrewFactory,
        { provide: CREW_FACTORY, useExisting: DefaultCrewFactory },
        { provide: LLM, useValue: (): string => "mock-llm" },
      ],
    }).compile();

    const factory = moduleRef.get<DefaultCrewFactory>(CREW_FACTORY);
    const crew = factory.create({ agents: [agent1], tasks: [task1] });

    expect(crew).toBeInstanceOf(Crew);
    expect(crew.agents).toHaveLength(1);
    expect(crew.tasks).toHaveLength(1);
    expect(crew.process).toBe(Process.sequential);

    await moduleRef.close();
  });

  it("CrewFactory.create() with empty agents throws 'agents required'", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DefaultCrewFactory,
        { provide: CREW_FACTORY, useExisting: DefaultCrewFactory },
        { provide: LLM, useValue: (): string => "mock-llm" },
      ],
    }).compile();

    const factory = moduleRef.get<DefaultCrewFactory>(CREW_FACTORY);

    expect(() => factory.create({ agents: [], tasks: [] })).toThrow(/at least one agent|agents required/i);

    await moduleRef.close();
  });

  it("CrewFactory preserves agent role uniqueness via the agents array", async () => {
    const agent1 = buildAgent("researcher");
    const agent2 = buildAgent("researcher"); // same role, different instance
    const task1 = buildTask("Research {topic}", agent1);

    const moduleRef = await Test.createTestingModule({
      providers: [
        DefaultCrewFactory,
        { provide: CREW_FACTORY, useExisting: DefaultCrewFactory },
        { provide: LLM, useValue: (): string => "mock-llm" },
      ],
    }).compile();

    const factory = moduleRef.get<DefaultCrewFactory>(CREW_FACTORY);
    const crew = factory.create({ agents: [agent1, agent2], tasks: [task1] });

    // The factory passes the array through to Crew — it does NOT silently dedup.
    // The caller is responsible for unique agent roles; the contract here is
    // "the agents array is forwarded verbatim".
    expect(crew.agents).toHaveLength(2);
    expect(crew.agents[0]?.role).toBe("researcher");
    expect(crew.agents[1]?.role).toBe("researcher");

    await moduleRef.close();
  });

  it("AgentFactory is injectable and create() returns an Agent", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AgentFactory,
        { provide: LLM, useValue: (): string => "injected-llm" },
      ],
    }).compile();

    const agentFactory = moduleRef.get(AgentFactory);
    const agent = agentFactory.create({
      role: "writer",
      goal: "Write things",
      backstory: "Skilled writer",
    });

    expect(agent).toBeInstanceOf(Agent);
    expect(agent.role).toBe("writer");
    expect(agent.goal).toBe("Write things");
    expect(agent.backstory).toBe("Skilled writer");

    await moduleRef.close();
  });

  it("AgentFactory uses injected LLM by default", async () => {
    const injectedLlm = (): string => "from-injected-llm";
    const moduleRef = await Test.createTestingModule({
      providers: [
        AgentFactory,
        { provide: LLM, useValue: injectedLlm },
      ],
    }).compile();

    const agentFactory = moduleRef.get(AgentFactory);

    // Per-agent llm NOT supplied → factory should use the injected one.
    const agentFromInjected = agentFactory.create({
      role: "researcher",
      goal: "Find facts",
      backstory: "Careful",
    });
    expect(typeof agentFromInjected.llm).toBe("function");

    // Per-agent llm IS supplied → factory should use the override, not the injected one.
    const overrideLlm = (): string => "from-override-llm";
    const agentFromOverride = agentFactory.create({
      role: "researcher",
      goal: "Find facts",
      backstory: "Careful",
      llm: overrideLlm as never,
    });
    expect(agentFromOverride.llm).toBe(overrideLlm);

    await moduleRef.close();
  });
});

describe("@crewai-ts/nestjs factories v0.3.0", () => {
  let originalEmitWarning: typeof process.emitWarning;
  let warnings: Array<{ msg: string; type: string | undefined }>;

  beforeEach(() => {
    originalEmitWarning = process.emitWarning;
    warnings = [];
    process.emitWarning = ((msg: string | Error, type?: string) => {
      warnings.push({ msg: typeof msg === "string" ? msg : msg.message, type });
    }) as typeof process.emitWarning;
  });
  afterEach(() => {
    process.emitWarning = originalEmitWarning;
  });

  it("AgentFactory.create({llm: 'fast'}) resolves from registry", async () => {
    const fastLlm = (): string => "fast";
    const moduleRef = await Test.createTestingModule({
      providers: [
        AgentFactory,
        LlmRegistryService,
        { provide: LLM_REGISTRY, useExisting: LlmRegistryService },
      ],
    }).compile();
    const registry = moduleRef.get(LlmRegistryService);
    registry.register("fast", fastLlm);

    const factory = moduleRef.get(AgentFactory);
    const agent = factory.create({ role: "r", goal: "g", backstory: "b", llm: "fast" });
    expect(agent.llm).toBe(fastLlm);
    await moduleRef.close();
  });

  it("AgentFactory.create({llm: 'unknown'}) with non-empty registry throws", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AgentFactory,
        LlmRegistryService,
        { provide: LLM_REGISTRY, useExisting: LlmRegistryService },
      ],
    }).compile();
    const registry = moduleRef.get(LlmRegistryService);
    registry.register("fast", (): string => "fast");

    const factory = moduleRef.get(AgentFactory);
    expect(() => factory.create({ role: "r", goal: "g", backstory: "b", llm: "unknown" }))
      .toThrow(/Unknown LLM name/);
    await moduleRef.close();
  });

  it("AgentFactory.create({llm: () => 'x'}) returns the function", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AgentFactory],
    }).compile();
    const fn = (): string => "x";
    const agent = moduleRef.get(AgentFactory).create({ role: "r", goal: "g", backstory: "b", llm: fn as never });
    expect(agent.llm).toBe(fn);
    await moduleRef.close();
  });

  it("AgentFactory.create({llm: 'x'}) emits DeprecationWarning", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AgentFactory],
    }).compile();
    const factory = moduleRef.get(AgentFactory);
    factory.create({ role: "r", goal: "g", backstory: "b", llm: "x" });
    expect(warnings.some((w) => w.type === "DeprecationWarning" && /llm/.test(w.msg))).toBe(true);
    await moduleRef.close();
  });

  it("AgentFactory.create({planningLlm: fn}) is accepted without error (Agent has no per-agent planningLlm field)", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AgentFactory],
    }).compile();
    const fn = (): string => "plan";
    const agent = moduleRef.get(AgentFactory).create({
      role: "r", goal: "g", backstory: "b",
      planningLlm: fn as never,
    });
    expect(agent).toBeInstanceOf(Agent);
    await moduleRef.close();
  });

  it("AgentFactory.create({functionCallingLlm: fn}) passes through", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AgentFactory],
    }).compile();
    const fn = (): string => "fn";
    const agent = moduleRef.get(AgentFactory).create({
      role: "r", goal: "g", backstory: "b",
      functionCallingLlm: fn as never,
    });
    expect(agent.functionCallingLlm).toBe(fn);
    await moduleRef.close();
  });

  it("AgentFactory.create({tools: [t1, t2]}) attaches tools", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AgentFactory],
    }).compile();
    const t1 = buildTool("t1");
    const t2 = buildTool("t2");
    const agent = moduleRef.get(AgentFactory).create({
      role: "r", goal: "g", backstory: "b",
      tools: [t1, t2],
    });
    expect((agent as unknown as { tools: BaseTool[] }).tools).toEqual([t1, t2]);
    await moduleRef.close();
  });

  it("AgentFactory.create({role: 'registered'}) returns the registered Agent by identity", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AgentFactory,
        AgentRegistryService,
        { provide: AGENT_REGISTRY, useExisting: AgentRegistryService },
      ],
    }).compile();
    const registry = moduleRef.get(AgentRegistryService);
    const prebuilt = buildAgent("writer");
    registry.register("writer", prebuilt);

    const factory = moduleRef.get(AgentFactory);
    const returned = factory.create({ role: "writer", goal: "ignored", backstory: "ignored" });
    expect(returned).toBe(prebuilt);
    await moduleRef.close();
  });

  it("AgentFactory.create() with no LLM and empty registry returns NOOP_LLM-backed agent", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AgentFactory],
    }).compile();
    const agent = moduleRef.get(AgentFactory).create({ role: "r", goal: "g", backstory: "b" });
    expect(typeof agent.llm).toBe("function");
    expect((agent.llm as () => string)()).toBe("");
    await moduleRef.close();
  });

  it("AgentFactory.create() uses FUNCTION_CALLING_LLM token as default (Agent has no per-agent planningLlm)", async () => {
    const planFn = (): string => "default-plan";
    const fcnFn = (): string => "default-fcn";
    const moduleRef = await Test.createTestingModule({
      providers: [
        AgentFactory,
        { provide: PLANNING_LLM, useValue: planFn },
        { provide: FUNCTION_CALLING_LLM, useValue: fcnFn },
      ],
    }).compile();
    const agent = moduleRef.get(AgentFactory).create({ role: "r", goal: "g", backstory: "b" });
    expect(agent.functionCallingLlm).toBe(fcnFn);
    await moduleRef.close();
  });

  it("DefaultCrewFactory.create({planning, verbose, cache}) passes through", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DefaultCrewFactory,
        { provide: CREW_FACTORY, useExisting: DefaultCrewFactory },
        { provide: LLM, useValue: (): string => "x" },
      ],
    }).compile();
    const factory = moduleRef.get<DefaultCrewFactory>(CREW_FACTORY);
    const crew = factory.create({
      agents: [buildAgent("a")],
      tasks: [buildTask("t", buildAgent("a"))],
      planning: true,
      verbose: true,
      cache: false,
    });
    expect(crew.planning).toBe(true);
    expect(crew.verbose).toBe(true);
    expect(crew.cache).toBe(false);
    await moduleRef.close();
  });

  it("DefaultCrewFactory.create({planningLlm: fn}) passes through", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DefaultCrewFactory,
        { provide: CREW_FACTORY, useExisting: DefaultCrewFactory },
        { provide: LLM, useValue: (): string => "x" },
      ],
    }).compile();
    const factory = moduleRef.get<DefaultCrewFactory>(CREW_FACTORY);
    const fn = (): string => "plan";
    const crew = factory.create({
      agents: [buildAgent("a")],
      tasks: [buildTask("t", buildAgent("a"))],
      planningLlm: fn as never,
    });
    expect(crew.planningLlm).toBe(fn);
    await moduleRef.close();
  });

  it("DefaultCrewFactory.create({tools: [t1]}) attaches to all agents (legacy alias)", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DefaultCrewFactory,
        { provide: CREW_FACTORY, useExisting: DefaultCrewFactory },
        { provide: LLM, useValue: (): string => "x" },
      ],
    }).compile();
    const factory = moduleRef.get<DefaultCrewFactory>(CREW_FACTORY);
    const t1 = buildTool("t1");
    const crew = factory.create({
      agents: [buildAgent("a1"), buildAgent("a2")],
      tasks: [buildTask("t", buildAgent("a1"))],
      tools: [t1],
    });
    // Both agents should have the tool
    for (const agent of crew.agents) {
      expect((agent as unknown as { tools: BaseTool[] }).tools).toEqual([t1]);
    }
    await moduleRef.close();
  });

  it("DefaultCrewFactory.create({functionCallingLlm: fn}) passes through", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DefaultCrewFactory,
        { provide: CREW_FACTORY, useExisting: DefaultCrewFactory },
        { provide: LLM, useValue: (): string => "x" },
      ],
    }).compile();
    const factory = moduleRef.get<DefaultCrewFactory>(CREW_FACTORY);
    const fn = (): string => "fn";
    const crew = factory.create({
      agents: [buildAgent("a")],
      tasks: [buildTask("t", buildAgent("a"))],
      functionCallingLlm: fn as never,
    });
    expect(crew.functionCallingLlm).toBe(fn);
    await moduleRef.close();
  });

  it("DefaultCrewFactory.create() uses PLANNING_LLM and FUNCTION_CALLING_LLM tokens as defaults", async () => {
    const planFn = (): string => "default-plan";
    const fcnFn = (): string => "default-fcn";
    const moduleRef = await Test.createTestingModule({
      providers: [
        DefaultCrewFactory,
        { provide: CREW_FACTORY, useExisting: DefaultCrewFactory },
        { provide: LLM, useValue: (): string => "x" },
        { provide: PLANNING_LLM, useValue: planFn },
        { provide: FUNCTION_CALLING_LLM, useValue: fcnFn },
      ],
    }).compile();
    const factory = moduleRef.get<DefaultCrewFactory>(CREW_FACTORY);
    const crew = factory.create({
      agents: [buildAgent("a")],
      tasks: [buildTask("t", buildAgent("a"))],
    });
    expect(crew.planningLlm).toBe(planFn);
    expect(crew.functionCallingLlm).toBe(fcnFn);
    await moduleRef.close();
  });
});
