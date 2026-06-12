# @crewai-ts/nestjs

NestJS dependency-injection helpers for `@crewai-ts/core`.

This package provides a `CrewModule`, stable injection tokens, and injectable factory classes for building CrewAI agents and crews inside a NestJS application.

## Install

```sh
npm install @crewai-ts/core @crewai-ts/nestjs @nestjs/common @nestjs/core reflect-metadata
```

Requirements:

- Node.js 22 or later
- NestJS 10 or 11
- `@crewai-ts/core` ^0.2.0

## Basic Usage

```ts
// app.module.ts
import { Module } from "@nestjs/common";
import { CrewModule } from "@crewai-ts/nestjs";
import { ResearchController } from "./research.controller";
import { ResearchService } from "./research.service";

@Module({
  imports: [
    CrewModule.forRoot({
      llm: "openai/gpt-4o-mini", // (Deprecated — use llms.default in v0.3+)
    }),
  ],
  controllers: [ResearchController],
  providers: [ResearchService],
})
export class AppModule {}
```

Create agents and crews from a regular NestJS provider:

```ts
// research.service.ts
import { Injectable, Inject } from "@nestjs/common";
import { Task } from "@crewai-ts/core";
import { AgentFactory, CREW_FACTORY, type CrewFactory } from "@crewai-ts/nestjs";

@Injectable()
export class ResearchService {
  constructor(
    private readonly agentFactory: AgentFactory,
    @Inject(CREW_FACTORY) private readonly crewFactory: CrewFactory,
  ) {}

  async run(topic: string) {
    const researcher = this.agentFactory.create({
      role: "Researcher",
      goal: `Research ${topic}`,
      backstory: "You find practical, source-grounded technical details.",
    });

    const writer = this.agentFactory.create({
      role: "Writer",
      goal: `Turn research about ${topic} into an implementation brief`,
      backstory: "You write concise engineering notes for busy backend teams.",
    });

    const task = new Task({
      description: `Research ${topic} and produce a short NestJS implementation brief.`,
      expectedOutput: "A concise implementation brief with risks and next steps.",
      agent: writer,
    });

    const crew = this.crewFactory.create({
      agents: [researcher, writer],
      tasks: [task],
    });

    const result = await crew.kickoff({
      inputs: { topic },
    });

    return result.raw;
  }
}
```

Expose it from a controller:

```ts
// research.controller.ts
import { Body, Controller, Post } from "@nestjs/common";
import { ResearchService } from "./research.service";

@Controller("research")
export class ResearchController {
  constructor(private readonly research: ResearchService) {}

  @Post()
  run(@Body("topic") topic: string) {
    return this.research.run(topic);
  }
}
```

## Multi-LLM

`@crewai-ts/nestjs` v0.3.0 introduces a named LLM registry and a per-module router. Configure LLMs by name and resolve them by string in your agents, tasks, or services.

```ts
// app.module.ts
import { Module } from "@nestjs/common";
import { CrewModule } from "@crewai-ts/nestjs";

@Module({
  imports: [
    CrewModule.forRoot({
      llms: {
        default: "openai/gpt-4o-mini",
        fast: "openai/gpt-4o-mini",
        smart: "openai/gpt-4o",
      },
      llmProviders: ["openai"], // auto-registers @crewai-ts/openai
      llmRouter: "fallback",
    }),
  ],
})
export class AppModule {}
```

`llms.default` is the reserved key for the default LLM. `llms` is wired to the `LLM_REGISTRY` token and the legacy `LLM` token resolves to `llms.default ?? options.llm`.

```ts
// some.service.ts
import { Injectable, Inject } from "@nestjs/common";
import { AgentFactory, LLM_REGISTRY, type LlmRegistryToken } from "@crewai-ts/nestjs";
import type { LLM } from "@crewai-ts/core";
import { LlmRegistryService } from "@crewai-ts/nestjs";

@Injectable()
export class MyService {
  constructor(
    private readonly agentFactory: AgentFactory,
    @Inject(LLM_REGISTRY) private readonly registry: LlmRegistryService,
  ) {}

  pickByName() {
    return this.registry.get("smart"); // returns the registered LLM
  }
}
```

## Provider Auto-Registration

Pass `llmProviders` to auto-register native LLM provider packages via lazy `import()`. The 4 supported providers are `'openai' | 'anthropic' | 'gemini' | 'azure'`. Native packages are kept out of `peerDependencies` — install only what you use.

```ts
CrewModule.forRoot({
  llmProviders: ["openai", "gemini"],
  llms: { default: "gpt-4o-mini" },
});
```

If a provider package is not installed, the module throws a clear error:
```
Cannot auto-register provider 'openai': @crewai-ts/openai is not installed.
Run: pnpm add @crewai-ts/openai
```

## Router Strategies

`LlmRouterService` selects an LLM from the registry based on a strategy. Built-in strategies:

- `round-robin` (default) — atomic counter on `SharedArrayBuffer`; concurrency-safe under `Promise.all`
- `fallback` — always returns the first registered LLM
- `race` — deterministic first-by-index picker
- `weighted` — equal-weight random spread (`Math.random() * n`)

```ts
import { LlmRouterService } from "@crewai-ts/nestjs";

// Built-in
const router = moduleRef.get(LlmRouterService);
router.use("round-robin");
const llm = router.route(); // cycles through the registry

// Custom strategy
router.use((llms) => {
  // Pick the LLM that returned a cached value, fall back to the first
  return llms.find((l) => /* heuristic */) ?? llms[0];
});
```

Pass `false` via `llmRouter: false` in `forRoot` to opt out of routing (the registry serves a single LLM directly).

## EventBusService

A Nest-friendly facade over `crewaiEventBus`. Tracks the off-functions for handlers registered via this service so `destroy()` only removes THIS service's handlers (direct `crewaiEventBus.on()` handlers are preserved).

```ts
import { Injectable } from "@nestjs/common";
import { EventBusService } from "@crewai-ts/nestjs";

@Injectable()
export class TaskLogger {
  constructor(private readonly bus: EventBusService) {
    this.bus.on("task_completed", (event) => {
      console.log("Task completed:", event);
    });
  }

  onModuleDestroy() {
    this.bus.destroy(); // removes only the handlers this service registered
  }
}
```

`destroy()` is idempotent and never calls `crewaiEventBus.clear()` or `removeAllListeners()`.

## AgentProvider

Class-based agent registration via Nest DI. Subclass `AgentProvider`, inject other providers (HTTP services, databases, etc.) in the constructor, and return a fully-constructed `Agent` from `provide()`. The `AgentRegistryService` resolves by role.

```ts
import { Injectable, Inject } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { Agent } from "@crewai-ts/core";
import { AgentProvider, AgentProviderClass, CrewModule, AGENT_REGISTRY } from "@crewai-ts/nestjs";
import { AgentRegistryService } from "@crewai-ts/nestjs";

class ResearcherProvider extends AgentProvider {
  constructor(private readonly config: ResearcherConfig) { super(); }
  provide(): Agent {
    return new Agent({ role: "researcher", goal: this.config.goal, ... });
  }
}

@Module({
  imports: [
    CrewModule.forRoot({ llm: "gpt-4o-mini" }),
    // Register the provider; on first instantiation, the agent is added to AGENT_REGISTRY
  ],
  providers: [
    ResearcherProvider,
    { provide: AGENT_REGISTRY, useExisting: AgentRegistryService },
  ],
})
export class AppModule {}

// In another service:
class SomeService {
  constructor(private readonly agentFactory: AgentFactory) {}
  build() {
    // factory.create({role: "researcher", ...}) returns the registered agent by IDENTITY
    return this.agentFactory.create({ role: "researcher", goal: "x", backstory: "y" });
  }
}
```

Alternatively, use `AgentProviderClass({role: "researcher"})` to derive a class with `role` metadata baked in.

## Async Configuration

Use `forRootAsync` when your LLM, memory, or knowledge sources come from another NestJS provider.

```ts
// app.module.ts
import { Module } from "@nestjs/common";
import { CrewModule } from "@crewai-ts/nestjs";
import { ConfigService } from "./config.service";

@Module({
  imports: [
    CrewModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        llm: config.defaultLlm,
      }),
    }),
  ],
})
export class AppModule {}
```

## Injection Tokens

`CrewModule` registers ten stable symbol tokens. Use them when a provider needs the module-level AI runtime configuration directly.

| Token | What it contains | Typical use |
| --- | --- | --- |
| `LLM` | The module default LLM. This can be a model string, a function LLM, or a core LLM provider object. | Let `AgentFactory` create agents without repeating `llm` on every agent. |
| `MEMORY` | The optional shared `Memory` instance passed to `CrewModule.forRoot({ memory })`. | Attach a crew-level memory store and inject it into services that need recall/save access. |
| `KNOWLEDGE` | The optional module-level knowledge source list passed to `CrewModule.forRoot({ knowledge })`. | Keep knowledge sources in Nest DI so services can inspect or reuse them. |
| `CREW_FACTORY` | The `DefaultCrewFactory` instance bound under a symbol token. | Build a configured `Crew` from agents and tasks. |
| `LLM_REGISTRY` | The named LLM registry (instance of `LlmRegistryService`). | Inject the registry in services that need to resolve LLMs by name. |
| `LLM_ROUTER` | The router service. | Pick an LLM from the registry by strategy. |
| `PLANNING_LLM` | Module-level planning LLM. | Used by the Crew factory for planning. |
| `FUNCTION_CALLING_LLM` | Module-level function-calling LLM. | Used by the Agent factory for tool-calling LLMs. |
| `EVENT_BUS` | The `EventBusService` instance. | Subscribe to crew events in Nest providers. |
| `AGENT_REGISTRY` | The `AgentRegistryService` (role → Agent). | Pre-register Agents by role; factory returns them by identity. |

Configure all tokens up front:

```ts
// app.module.ts
import { Module } from "@nestjs/common";
import {
  Memory,
  StringKnowledgeSource,
  type KnowledgeSource,
} from "@crewai-ts/core";
import { CrewModule } from "@crewai-ts/nestjs";
import { ResearchService } from "./research.service";

const memory = new Memory();
memory.remember("Prefer concise implementation briefs.", {
  scope: "/research",
  categories: ["preference"],
});

const knowledge: KnowledgeSource[] = [
  new StringKnowledgeSource({
    content: "The API service uses NestJS modules, providers, and controllers.",
    metadata: { source: "architecture-notes" },
  }),
];

@Module({
  imports: [
    CrewModule.forRoot({
      llm: "openai/gpt-4o-mini",
      memory,
      knowledge,
    }),
  ],
  providers: [ResearchService],
})
export class AppModule {}
```

Inject `LLM`, `MEMORY`, and `KNOWLEDGE` from any Nest provider:

```ts
// runtime-context.service.ts
import { Inject, Injectable } from "@nestjs/common";
import {
  Memory,
  type KnowledgeSource,
  type LLM as CoreLLM,
} from "@crewai-ts/core";
import { KNOWLEDGE, LLM, MEMORY } from "@crewai-ts/nestjs";

@Injectable()
export class RuntimeContextService {
  constructor(
    @Inject(LLM) private readonly llm: CoreLLM | string | null,
    @Inject(MEMORY) private readonly memory: Memory | null,
    @Inject(KNOWLEDGE) private readonly knowledge: readonly KnowledgeSource[] | null,
  ) {}

  async summarizeRuntime() {
    const recalled = this.memory?.recall("implementation preferences", {
      scope: "/research",
      limit: 3,
    }) ?? [];

    return {
      llm: typeof this.llm === "string" ? this.llm : "custom-provider",
      memoryMatches: recalled.map((match) => match.record.content),
      knowledgeSources: this.knowledge?.length ?? 0,
    };
  }
}
```

Override the module-level `LLM` for a single agent when needed:

```ts
const fastAgent = this.agentFactory.create({
  role: "Fast classifier",
  goal: "Classify the request quickly",
  backstory: "A small deterministic classifier.",
  llm: "openai/gpt-4o-mini",
});

const deepAgent = this.agentFactory.create({
  role: "Deep researcher",
  goal: "Write a more complete answer",
  backstory: "A slower, more careful analyst.",
  llm: "openai/gpt-4o",
});
```

For tests, pass a function LLM and use Nest's testing module:

```ts
import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { Agent, Task } from "@crewai-ts/core";
import { CrewModule, CREW_FACTORY, type CrewFactory } from "@crewai-ts/nestjs";

it("runs a crew without network calls", async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [
      CrewModule.forRoot({
        llm: (() => "mock-output") as never,
      }),
    ],
  }).compile();

  const crewFactory = moduleRef.get<CrewFactory>(CREW_FACTORY);
  const agent = new Agent({
    role: "Tester",
    goal: "Exercise the NestJS integration",
    backstory: "A deterministic test agent.",
    llm: (() => "mock-output") as never,
  });
  const task = new Task({
    description: "Return the mock result.",
    expectedOutput: "mock-output",
    agent,
  });

  const crew = crewFactory.create({ agents: [agent], tasks: [task] });
  const result = await crew.kickoff({ inputs: {} });

  expect(result.raw).toBe("mock-output");
  await moduleRef.close();
});
```

## Exports

```ts
import {
  AgentFactory,
  AgentProvider,
  AgentProviderClass,
  AgentRegistryService,
  AGENT_REGISTRY,
  CREW_FACTORY,
  CrewModule,
  DefaultCrewFactory,
  EVENT_BUS,
  EventBusService,
  FUNCTION_CALLING_LLM,
  KNOWLEDGE,
  LLM,
  LLM_REGISTRY,
  LLM_ROUTER,
  LlmRegistryService,
  LlmRouterService,
  MEMORY,
  PLANNING_LLM,
} from "@crewai-ts/nestjs";
```

`CrewModule` exports:

- `CREW_FACTORY`
- `LLM`
- `MEMORY`
- `KNOWLEDGE`
- `LLM_REGISTRY`
- `LLM_ROUTER`
- `PLANNING_LLM`
- `FUNCTION_CALLING_LLM`
- `EVENT_BUS`
- `AGENT_REGISTRY`
- `DefaultCrewFactory`
- `AgentFactory`
- `LlmRegistryService`
- `LlmRouterService`
- `EventBusService`
- `AgentRegistryService`

## Migration from v0.2.x

v0.3.0 deprecates the legacy `llm` field on `CrewModuleOptions` and `AgentFactory.create({llm})`. A `DeprecationWarning` is emitted at runtime. Removal is planned for v1.0.0.

```ts
// v0.2.x (still works, but emits DeprecationWarning)
CrewModule.forRoot({ llm: "gpt-4o-mini" });

// v0.3.0+
CrewModule.forRoot({ llms: { default: "gpt-4o-mini" } });
```

When both `llm` and `llms.default` are set, `llms.default` wins. The legacy `LLM` token continues to resolve to the default LLM (now sourced from `llms.default` when present).

The peer dependency on `@crewai-ts/core` was bumped from `^0.2.0` to `^0.3.0`.

## Notes

`CREW_FACTORY` is bound to the same instance as `DefaultCrewFactory`, so consumers can inject either the symbol token or the class provider.

`AgentFactory` uses the module-level `LLM` by default. Callers can still pass a per-agent `llm` when creating an agent.
