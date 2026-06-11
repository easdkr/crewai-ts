import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "reflect-metadata";
import { Module } from "@nestjs/common";
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
import { LlmRegistryService } from "../src/registry/llm-registry.js";
import { LlmRouterService } from "../src/registry/llm-router.js";
import { EventBusService } from "../src/event-bus/event-bus.service.js";
import { AgentRegistryService } from "../src/agents/agent-registry.js";

describe("@crewai-ts/nestjs CrewModule.forRootAsync", () => {
  it("forRootAsync with useFactory resolves async deps", async () => {
    const asyncLlm = async (): Promise<string> => "async-llm";

    const moduleRef = await Test.createTestingModule({
      imports: [
        CrewModule.forRootAsync({
          useFactory: (): CrewModuleOptions => ({
            llm: asyncLlm,
            memory: null,
            knowledge: null,
          }),
        }),
      ],
    }).compile();

    expect(moduleRef.get(LLM)).toBe(asyncLlm);
    expect(moduleRef.get(MEMORY)).toBeNull();
    expect(moduleRef.get(KNOWLEDGE)).toBeNull();
    const factory = moduleRef.get<{ create: (input: { agents: readonly unknown[]; tasks: readonly unknown[] }) => unknown }>(CREW_FACTORY);
    expect(typeof factory.create).toBe("function");

    await moduleRef.close();
  });

  it("forRootAsync injects other providers", async () => {
    const CONFIG = "CONFIG";
    const defaultLlm = (): string => "from-config";

    @Module({
      providers: [{ provide: CONFIG, useValue: { defaultLlm } }],
      exports: [CONFIG],
    })
    class ConfigModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule,
        CrewModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (config: { defaultLlm: () => string }): CrewModuleOptions => ({
            llm: config.defaultLlm,
            memory: null,
            knowledge: null,
          }),
          inject: [CONFIG],
        }),
      ],
    }).compile();

    const resolvedLlm = moduleRef.get<() => string>(LLM);
    expect(resolvedLlm).toBe(defaultLlm);
    expect(resolvedLlm()).toBe("from-config");

    await moduleRef.close();
  });

  it("forRootAsync supports imports", async () => {
    const LOGGER = "LOGGER";
    const log = (msg: string): string => `log:${msg}`;

    @Module({
      providers: [{ provide: LOGGER, useValue: { log } }],
      exports: [LOGGER],
    })
    class LoggerModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [
        LoggerModule,
        CrewModule.forRootAsync({
          imports: [LoggerModule],
          inject: [LOGGER],
          useFactory: (): CrewModuleOptions => ({
            llm: (): string => "logged-llm",
            memory: null,
            knowledge: null,
          }),
        }),
      ],
    }).compile();

    expect((moduleRef.get<() => string>(LLM))()).toBe("logged-llm");
    expect(moduleRef.get<{ log: (msg: string) => string }>(LOGGER).log("hi")).toBe("log:hi");

    await moduleRef.close();
  });

  it("forRootAsync without useFactory throws", () => {
    expect(() =>
      // @ts-expect-error -- intentionally omitting useFactory to verify the runtime guard
      CrewModule.forRootAsync({}),
    ).toThrow(/useFactory/);
  });

  it("forRootAsync without useFactory OR useClass throws (same guard)", () => {
    expect(() =>
      // @ts-expect-error -- intentionally omitting useFactory to verify the runtime guard
      CrewModule.forRootAsync({}),
    ).toThrow(/useFactory/);
  });
});

describe("@crewai-ts/nestjs CrewModule.forRootAsync v0.3.0", () => {
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

  it("forRootAsync({llms: {default, fast}}) registers both in LLM_REGISTRY", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        CrewModule.forRootAsync({
          useFactory: (): CrewModuleOptions => ({
            llms: { default: "gpt-4o-mini", fast: "gpt-4o" },
          }),
        }),
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

  it("forRootAsync({llms: {default}}) resolves LLM token to llms.default", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        CrewModule.forRootAsync({
          useFactory: (): CrewModuleOptions => ({
            llms: { default: "from-registry" },
          }),
        }),
      ],
    }).compile();

    expect(moduleRef.get(LLM)).toBe("from-registry");

    await moduleRef.close();
  });

  it("forRootAsync({llm: 'x'}) emits DeprecationWarning", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        CrewModule.forRootAsync({
          useFactory: (): CrewModuleOptions => ({ llm: "x" }),
        }),
      ],
    }).compile();

    expect(
      warnings.some(
        (w) => w.type === "DeprecationWarning" && /llm/.test(w.msg),
      ),
    ).toBe(true);

    await moduleRef.close();
  });

  it("forRootAsync({llm: 'x', llms: {default: 'y'}}) resolves LLM token to 'y' (new shape wins)", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        CrewModule.forRootAsync({
          useFactory: (): CrewModuleOptions => ({
            llm: "x",
            llms: { default: "y" },
          }),
        }),
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

  it("forRootAsync({planningLlm: 'plan-llm'}) registers PLANNING_LLM token", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        CrewModule.forRootAsync({
          useFactory: (): CrewModuleOptions => ({
            llm: "ignored",
            planningLlm: "plan-llm",
          }),
        }),
      ],
    }).compile();

    expect(moduleRef.get(PLANNING_LLM)).toBe("plan-llm");

    await moduleRef.close();
  });

  it("forRootAsync({functionCallingLlm: 'fcn-llm'}) registers FUNCTION_CALLING_LLM token", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        CrewModule.forRootAsync({
          useFactory: (): CrewModuleOptions => ({
            llm: "ignored",
            functionCallingLlm: "fcn-llm",
          }),
        }),
      ],
    }).compile();

    expect(moduleRef.get(FUNCTION_CALLING_LLM)).toBe("fcn-llm");

    await moduleRef.close();
  });

  it("forRootAsync({llmRouter: 'fallback'}) configures the router", async () => {
    const a = (): string => "a";
    const b = (): string => "b";
    const moduleRef = await Test.createTestingModule({
      imports: [
        CrewModule.forRootAsync({
          useFactory: (): CrewModuleOptions => ({
            llms: { a, b },
            llmRouter: "fallback",
          }),
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

  it("forRootAsync({planning, verbose, cache}) accepts all boolean options without error", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        CrewModule.forRootAsync({
          useFactory: (): CrewModuleOptions => ({
            llm: "x",
            planning: true,
            verbose: true,
            cache: false,
          }),
        }),
      ],
    }).compile();

    expect(moduleRef).toBeDefined();

    await moduleRef.close();
  });

  it("forRootAsync registers EVENT_BUS and AGENT_REGISTRY services", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        CrewModule.forRootAsync({
          useFactory: (): CrewModuleOptions => ({ llm: "x" }),
        }),
      ],
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

  it("forRootAsync({llmProviders: ['openai']}) throws a clear error when @crewai-ts/openai is not installed", async () => {
    await expect(
      Test.createTestingModule({
        imports: [
          CrewModule.forRootAsync({
            useFactory: (): CrewModuleOptions => ({
              llm: "x",
              llmProviders: ["openai"],
            }),
          }),
        ],
      }).compile(),
    ).rejects.toThrow(/pnpm add @crewai-ts\/openai/);
  });
});
