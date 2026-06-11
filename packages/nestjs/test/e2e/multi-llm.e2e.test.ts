import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { Agent, Task } from "@crewai-ts/core";
import { CrewModule } from "../../src/crew-module.js";
import { AGENT_REGISTRY, CREW_FACTORY, LLM, LLM_REGISTRY, LLM_ROUTER } from "../../src/tokens.js";
import { AgentFactory } from "../../src/factories/agent-factory.js";
import { DefaultCrewFactory } from "../../src/factories/crew-factory.js";
import { LlmRegistryService } from "../../src/registry/llm-registry.js";
import { LlmRouterService } from "../../src/registry/llm-router.js";
import { EventBusService } from "../../src/event-bus/event-bus.service.js";
import { AgentRegistryService } from "../../src/agents/agent-registry.js";

/**
 * E2E tests for the v0.3.0 multi-LLM stack.
 *
 * Each test composes a `CrewModule.forRoot({...})` with 2+ mock LLMs and
 * exercises the full path: DI tokens → factories → Crew.kickoff → task
 * output. All LLMs are function mocks — no real network calls.
 *
 * `@nestjs/testing` `Test.createTestingModule` is used for every test to
 * mirror a real Nest application. `moduleRef.close()` is called in every
 * `it` for resource cleanup.
 *
 * The `process.emitWarning` spy from the existing `crew-module.test.ts`
 * pattern is reused for the deprecation test.
 */
describe("@crewai-ts/nestjs E2E multi-LLM v0.3.0", () => {
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

  // ─────────────────────────────────────────────────────────────────────
  // Test 1: 2 named mock LLMs in a single crew, each agent uses its own.
  // ─────────────────────────────────────────────────────────────────────
  it("2 named LLMs in a single crew: each agent uses its own LLM", async () => {
    const fastLlm = (): string => "fast-output";
    const smartLlm = (): string => "smart-output";
    const moduleRef = await Test.createTestingModule({
      imports: [
        CrewModule.forRoot({
          llms: { fast: fastLlm, smart: smartLlm },
        }),
      ],
    }).compile();

    const factory = moduleRef.get<DefaultCrewFactory>(CREW_FACTORY);
    const agent1 = new Agent({
      role: "fast-agent",
      goal: "g",
      backstory: "b",
      llm: fastLlm as never,
    });
    const agent2 = new Agent({
      role: "smart-agent",
      goal: "g",
      backstory: "b",
      llm: smartLlm as never,
    });
    const task1 = new Task({ description: "t1", expectedOutput: "out1", agent: agent1 });
    const task2 = new Task({ description: "t2", expectedOutput: "out2", agent: agent2 });
    const crew = factory.create({ agents: [agent1, agent2], tasks: [task1, task2] });

    const result = await crew.kickoff({ inputs: {} });
    expect(result.tasksOutput[0]?.raw).toBe("fast-output");
    expect(result.tasksOutput[1]?.raw).toBe("smart-output");
    await moduleRef.close();
  });

  // ─────────────────────────────────────────────────────────────────────
  // Test 2: Router round-robin over 4 calls — both outputs observed.
  // ─────────────────────────────────────────────────────────────────────
  it("router round-robin: 2 LLMs alternated across 4 route() calls", async () => {
    const fastLlm = (): string => "fast";
    const smartLlm = (): string => "smart";
    const moduleRef = await Test.createTestingModule({
      imports: [
        CrewModule.forRoot({
          llms: { fast: fastLlm, smart: smartLlm },
          llmRouter: "round-robin",
        }),
      ],
    }).compile();

    const router = moduleRef.get<LlmRouterService>(LlmRouterService);
    // `route()` returns one LLM per call. Round-robin alternates
    // over `names()`: [fast, smart, fast, smart] (or starting from smart
    // if `Object.keys({fast, smart})` were ever to reorder, which it
    // does not). Either way, 4 calls produce 2 of each.
    const all = [router.route(), router.route(), router.route(), router.route()];
    expect(all).toHaveLength(4);
    expect(all.filter((x) => x === fastLlm)).toHaveLength(2);
    expect(all.filter((x) => x === smartLlm)).toHaveLength(2);
    // Strict alternation check: even and odd positions use different LLMs.
    expect(all[0]).not.toBe(all[1]);
    expect(all[1]).toBe(all[3]);
    expect(all[0]).toBe(all[2]);
    await moduleRef.close();
  });

  // ─────────────────────────────────────────────────────────────────────
  // Test 3: Legacy deprecation — warning captured AND result correct.
  // ─────────────────────────────────────────────────────────────────────
  it("legacy llm field emits DeprecationWarning end-to-end + kickoff returns the result", async () => {
    const legacyLlm = (): string => "legacy-output";
    const moduleRef = await Test.createTestingModule({
      imports: [CrewModule.forRoot({ llm: legacyLlm as never })],
    }).compile();

    // The DeprecationWarning fires synchronously at `forRoot()` time
    // (see `crew-module.ts:151-153`).
    expect(
      warnings.some(
        (w) => w.type === "DeprecationWarning" && /llm/.test(w.msg),
      ),
    ).toBe(true);

    // Backward compat: the legacy `llm` is still bound to the LLM token
    // AND is usable for a real kickoff.
    const factory = moduleRef.get<DefaultCrewFactory>(CREW_FACTORY);
    const agent = new Agent({
      role: "a",
      goal: "g",
      backstory: "b",
      llm: legacyLlm as never,
    });
    const task = new Task({ description: "t", expectedOutput: "o", agent });
    const crew = factory.create({ agents: [agent], tasks: [task] });
    const result = await crew.kickoff({ inputs: {} });
    expect(result.raw).toBe("legacy-output");
    await moduleRef.close();
  });

  // ─────────────────────────────────────────────────────────────────────
  // Test 4: Missing provider — clear "pnpm add" error.
  //
  // The negative path is already covered by the unit test
  // `crew-module.test.ts:262` (`forRoot({llmProviders: ['openai']})` rejects
  // with `/pnpm add @crewai-ts\/openai/`). Here we run the same assertion
  // through the full E2E test module so the failure surfaces as a
  // `Test.createTestingModule({...}).compile()` rejection — i.e. the same
  // path a consumer would hit in their own app.
  // ─────────────────────────────────────────────────────────────────────
  it("missing provider: forRoot({llmProviders: ['openai']}) throws clear 'pnpm add' error", async () => {
    await expect(
      Test.createTestingModule({
        imports: [
          CrewModule.forRoot({
            llms: { default: "gpt-4o-mini" },
            llmProviders: ["openai"],
          }),
        ],
      }).compile(),
    ).rejects.toThrow(/pnpm add @crewai-ts\/openai/);
  });

  // ─────────────────────────────────────────────────────────────────────
  // Test 5: `llms.default` fallback — agent without explicit llm uses
  // llms.default (which the LLM token resolves to).
  // ─────────────────────────────────────────────────────────────────────
  it("llms.default fallback: agent without explicit llm uses llms.default", async () => {
    const defaultLlm = (): string => "default-output";
    const moduleRef = await Test.createTestingModule({
      imports: [CrewModule.forRoot({ llms: { default: defaultLlm } })],
    }).compile();

    // LLM token resolves to llms.default.
    expect(moduleRef.get<typeof defaultLlm>(LLM)).toBe(defaultLlm);

    const agentFactory = moduleRef.get(AgentFactory);
    const agent = agentFactory.create({ role: "a", goal: "g", backstory: "b" });
    expect(agent.llm).toBe(defaultLlm);

    const factory = moduleRef.get<DefaultCrewFactory>(CREW_FACTORY);
    const task = new Task({ description: "t", expectedOutput: "o", agent });
    const crew = factory.create({ agents: [agent], tasks: [task] });
    const result = await crew.kickoff({ inputs: {} });
    expect(result.raw).toBe("default-output");
    await moduleRef.close();
  });

  // ─────────────────────────────────────────────────────────────────────
  // Test 6: AgentProvider integration — factory.create({role: 'r'}) returns
  // the SAME pre-built Agent instance from the registry.
  // ─────────────────────────────────────────────────────────────────────
  it("AgentProvider integration: factory.create({role}) returns the registered Agent by identity", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CrewModule.forRoot({ llm: ((): string => "x") as never })],
    }).compile();

    // Get the DI-managed registry (NOT a local `new AgentRegistryService()` —
    // see Wave 2 learnings: a local instance would be a silent no-op for
    // the factory).
    const agentRegistry = moduleRef.get(AgentRegistryService);
    const agentFactory = moduleRef.get(AgentFactory);
    const prebuilt = new Agent({
      role: "researcher",
      goal: "g",
      backstory: "b",
      llm: ((): string => "x") as never,
    });
    agentRegistry.register("researcher", prebuilt);

    // The factory short-circuits to the registered agent by identity —
    // even if the caller passes different goal/backstory, those are ignored.
    const returned = agentFactory.create({
      role: "researcher",
      goal: "different",
      backstory: "different",
    });
    expect(returned).toBe(prebuilt);
    // AGENT_REGISTRY token resolves to the same instance.
    expect(moduleRef.get(AGENT_REGISTRY)).toBe(agentRegistry);
    await moduleRef.close();
  });

  // ─────────────────────────────────────────────────────────────────────
  // Test 7: EventBus E2E — handler subscribed via EventBusService.on()
  // fires on task_completed after kickoff.
  //
  // Note: `crewaiEventBus` is a process-wide singleton. The handler we
  // register here is per-test (per-EventBusService instance), so the
  // `off()` cleanup at the end of the test is critical to avoid
  // cross-test bleed.
  // ─────────────────────────────────────────────────────────────────────
  it("EventBus E2E: handler subscribed via EventBusService.on() fires on task_completed", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CrewModule.forRoot({ llm: ((): string => "evbus-output") as never })],
    }).compile();

    const eventBus = moduleRef.get(EventBusService);
    const handler = vi.fn();
    const off = eventBus.on("task_completed", handler);

    const factory = moduleRef.get<DefaultCrewFactory>(CREW_FACTORY);
    const agent = new Agent({
      role: "a",
      goal: "g",
      backstory: "b",
      llm: ((): string => "evbus-output") as never,
    });
    const task = new Task({ description: "t", expectedOutput: "o", agent });
    const crew = factory.create({ agents: [agent], tasks: [task] });

    await crew.kickoff({ inputs: {} });
    // Crew emits task_completed synchronously inside `kickoff()`. The 50ms
    // flush is a defensive tail for any microtask scheduling the bus may
    // do internally; 0ms would also work in practice.
    await new Promise((r) => setTimeout(r, 50));

    expect(handler).toHaveBeenCalled();
    const received = handler.mock.calls[0]?.[0] as { type: string };
    expect(received).toMatchObject({ type: "task_completed" });

    off();
    eventBus.destroy();
    await moduleRef.close();
  });
});
