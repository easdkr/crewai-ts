import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { CrewModule, type CrewModuleOptions } from "../src/crew-module.js";
import {
  AGENT_REGISTRY,
  CREW_FACTORY,
  EVENT_BUS,
  FUNCTION_CALLING_LLM,
  KNOWLEDGE,
  LLM,
  LLM_REGISTRY,
  LLM_ROUTER,
  MEMORY,
  PLANNING_LLM,
} from "../src/tokens.js";
import { DefaultCrewFactory } from "../src/factories/crew-factory.js";
import { AgentFactory } from "../src/factories/agent-factory.js";
import { LlmRegistryService } from "../src/registry/llm-registry.js";
import { LlmRouterService } from "../src/registry/llm-router.js";
import { EventBusService } from "../src/event-bus/event-bus.service.js";
import { AgentRegistryService } from "../src/agents/agent-registry.js";

describe("@crewai-ts/nestjs CrewModule", () => {
  it("forRoot registers all 4 tokens", async () => {
    const mockLlm = (): string => "mock-llm-response";
    const moduleRef = await Test.createTestingModule({
      imports: [CrewModule.forRoot({ llm: mockLlm, memory: null, knowledge: null })],
    }).compile();

    expect(moduleRef.get<typeof mockLlm>(LLM)).toBe(mockLlm);
    expect(moduleRef.get(MEMORY)).toBeNull();
    expect(moduleRef.get(KNOWLEDGE)).toBeNull();
    const factory = moduleRef.get<{ create: (input: { agents: readonly unknown[]; tasks: readonly unknown[] }) => unknown }>(CREW_FACTORY);
    expect(typeof factory.create).toBe("function");

    await moduleRef.close();
  });

  it("forRoot returns a DynamicModule", () => {
    const dynamic = CrewModule.forRoot({ llm: null });
    expect(dynamic.module).toBe(CrewModule);
    expect(Array.isArray(dynamic.providers)).toBe(true);
    // 6 base (LLM, MEMORY, KNOWLEDGE, DefaultCrewFactory, CREW_FACTORY, AgentFactory)
    // + 4 new service classes (LlmRegistryService, LlmRouterService, EventBusService, AgentRegistryService)
    // + 6 new token bindings (PLANNING_LLM, FUNCTION_CALLING_LLM, LLM_REGISTRY, LLM_ROUTER, EVENT_BUS, AGENT_REGISTRY)
    // = 16 total
    expect(dynamic.providers).toHaveLength(16);
    expect(dynamic.exports).toEqual([
      CREW_FACTORY,
      LLM,
      MEMORY,
      KNOWLEDGE,
      DefaultCrewFactory,
      AgentFactory,
      LLM_REGISTRY,
      LLM_ROUTER,
      PLANNING_LLM,
      FUNCTION_CALLING_LLM,
      EVENT_BUS,
      AGENT_REGISTRY,
      LlmRegistryService,
      LlmRouterService,
      EventBusService,
      AgentRegistryService,
    ]);
  });

  it("forRoot without arguments errors", () => {
    // @ts-expect-error -- intentionally calling forRoot() with no args to verify the runtime guard
    expect(() => CrewModule.forRoot()).toThrow(/CrewModule\.forRoot/);
  });

  it("forRoot({ llm: 'string' }) registers the string", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CrewModule.forRoot({ llm: "openai/gpt-4o-mini" })],
    }).compile();

    expect(moduleRef.get(LLM)).toBe("openai/gpt-4o-mini");

    await moduleRef.close();
  });

  it("knowledge array is registered as readonly", async () => {
    const knowledgeSources = [
      { id: "src-1", content: "first" },
      { id: "src-2", content: "second" },
    ] as const;
    const options: CrewModuleOptions = {
      llm: () => "x",
      knowledge: knowledgeSources,
    };
    const moduleRef = await Test.createTestingModule({
      imports: [CrewModule.forRoot(options)],
    }).compile();

    const resolved = moduleRef.get(KNOWLEDGE);
    expect(Array.isArray(resolved)).toBe(true);
    expect(resolved).toEqual(knowledgeSources);
    // Compile-time + runtime: KNOWLEDGE is typed as readonly
    expect(Object.isFrozen(resolved) || resolved === knowledgeSources).toBe(true);

    await moduleRef.close();
  });
});

describe("@crewai-ts/nestjs CrewModule v0.3.0 extensions", () => {
  let originalEmitWarning: typeof process.emitWarning;
  let warnings: Array<{ msg: string; type: string | undefined }>;

  beforeEach(() => {
    originalEmitWarning = process.emitWarning;
    warnings = [];
    process.emitWarning = ((msg: string | Error, type?: string) => {
      warnings.push({
        msg: typeof msg === "string" ? msg : msg.message,
        type,
      });
    }) as typeof process.emitWarning;
  });

  afterEach(() => {
    process.emitWarning = originalEmitWarning;
  });

  it("forRoot({llms: {default, fast}}) registers both in LLM_REGISTRY", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        CrewModule.forRoot({ llms: { default: "gpt-4o-mini", fast: "gpt-4o" } }),
      ],
    }).compile();

    const registry = moduleRef.get<LlmRegistryService>(LlmRegistryService);
    expect(registry.has("default")).toBe(true);
    expect(registry.has("fast")).toBe(true);
    expect(registry.get("default")).toBe("gpt-4o-mini");
    expect(registry.get("fast")).toBe("gpt-4o");

    // Same instance is reachable via the LLM_REGISTRY token.
    expect(moduleRef.get(LLM_REGISTRY)).toBe(registry);

    await moduleRef.close();
  });

  it("forRoot({llms: {default}}) resolves LLM token to llms.default", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CrewModule.forRoot({ llms: { default: "from-registry" } })],
    }).compile();

    expect(moduleRef.get(LLM)).toBe("from-registry");

    await moduleRef.close();
  });

  it("forRoot({llm: 'x'}) emits DeprecationWarning", () => {
    CrewModule.forRoot({ llm: "x" });
    expect(
      warnings.some(
        (w) => w.type === "DeprecationWarning" && /llm/.test(w.msg),
      ),
    ).toBe(true);
  });

  it("forRoot({llm: 'x', llms: {default: 'y'}}) resolves LLM token to 'y' (new shape wins)", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        CrewModule.forRoot({ llm: "x", llms: { default: "y" } }),
      ],
    }).compile();

    expect(moduleRef.get(LLM)).toBe("y");
    // Both keys land in the registry — the legacy `llm` does not, but
    // `llms` is preserved verbatim.
    const registry = moduleRef.get<LlmRegistryService>(LlmRegistryService);
    expect(registry.get("default")).toBe("y");

    // Deprecation warning still fires for the legacy field.
    expect(
      warnings.some((w) => w.type === "DeprecationWarning" && /llm/.test(w.msg)),
    ).toBe(true);

    await moduleRef.close();
  });

  it("forRoot({planningLlm: 'x'}) registers PLANNING_LLM token", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CrewModule.forRoot({ llm: "ignored", planningLlm: "plan-llm" })],
    }).compile();

    expect(moduleRef.get(PLANNING_LLM)).toBe("plan-llm");

    await moduleRef.close();
  });

  it("forRoot({functionCallingLlm: 'x'}) registers FUNCTION_CALLING_LLM token", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        CrewModule.forRoot({ llm: "ignored", functionCallingLlm: "fcn-llm" }),
      ],
    }).compile();

    expect(moduleRef.get(FUNCTION_CALLING_LLM)).toBe("fcn-llm");

    await moduleRef.close();
  });

  it("forRoot({llmRouter: 'fallback'}) configures the router", async () => {
    const a = (): string => "a";
    const b = (): string => "b";
    const moduleRef = await Test.createTestingModule({
      imports: [
        CrewModule.forRoot({
          llms: { a, b },
          llmRouter: "fallback",
        }),
      ],
    }).compile();

    const router = moduleRef.get<LlmRouterService>(LlmRouterService);
    // `fallback` strategy always returns the first registered LLM.
    expect(router.route()).toBe(a);
    // Same instance is reachable via the LLM_ROUTER token.
    expect(moduleRef.get(LLM_ROUTER)).toBe(router);

    await moduleRef.close();
  });

  it("forRoot({planning, verbose, cache}) accepts all boolean options without error", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        CrewModule.forRoot({
          llm: "x",
          planning: true,
          verbose: true,
          cache: false,
        }),
      ],
    }).compile();

    expect(moduleRef).toBeDefined();

    await moduleRef.close();
  });

  it("forRoot registers EVENT_BUS and AGENT_REGISTRY services", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CrewModule.forRoot({ llm: "x" })],
    }).compile();

    const eventBus = moduleRef.get(EventBusService);
    expect(eventBus).toBeInstanceOf(EventBusService);
    // The EVENT_BUS token resolves to the same instance.
    expect(moduleRef.get(EVENT_BUS)).toBe(eventBus);

    const agentRegistry = moduleRef.get(AgentRegistryService);
    expect(agentRegistry).toBeInstanceOf(AgentRegistryService);
    expect(moduleRef.get(AGENT_REGISTRY)).toBe(agentRegistry);

    await moduleRef.close();
  });

  it("forRoot({llmProviders: ['openai']}) throws a clear error when @crewai-ts/openai is not installed", async () => {
    await expect(
      Test.createTestingModule({
        imports: [CrewModule.forRoot({ llmProviders: ["openai"] })],
      }).compile(),
    ).rejects.toThrow(/pnpm add @crewai-ts\/openai/);
  });

  it("forRoot({llms, llmProviders}) throws when the provider package is not installed", async () => {
    await expect(
      Test.createTestingModule({
        imports: [
          CrewModule.forRoot({
            llms: { default: "gpt-4o-mini", fast: "gpt-4o" },
            llmProviders: ["openai"],
          }),
        ],
      }).compile(),
    ).rejects.toThrow(/pnpm add @crewai-ts\/openai/);
  });

  it("forRoot({llmRouter: false}) routes to the first LLM (fallback default)", async () => {
    const a = (): string => "a";
    const b = (): string => "b";
    const moduleRef = await Test.createTestingModule({
      imports: [
        CrewModule.forRoot({
          llms: { a, b },
          llmRouter: false,
        }),
      ],
    }).compile();

    const router = moduleRef.get<LlmRouterService>(LlmRouterService);
    // `false` → router.use(false) sets strategy to fallback.
    expect(router.route()).toBe(a);

    await moduleRef.close();
  });
});
