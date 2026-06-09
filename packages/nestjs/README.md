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
- `@crewai-ts/core` 0.1.12 or later

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
      llm: "openai/gpt-4o-mini",
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

`CrewModule` registers four stable symbol tokens. Use them when a provider needs the module-level AI runtime configuration directly.

| Token | What it contains | Typical use |
| --- | --- | --- |
| `LLM` | The module default LLM. This can be a model string, a function LLM, or a core LLM provider object. | Let `AgentFactory` create agents without repeating `llm` on every agent. |
| `MEMORY` | The optional shared `Memory` instance passed to `CrewModule.forRoot({ memory })`. | Attach a crew-level memory store and inject it into services that need recall/save access. |
| `KNOWLEDGE` | The optional module-level knowledge source list passed to `CrewModule.forRoot({ knowledge })`. | Keep knowledge sources in Nest DI so services can inspect or reuse them. |
| `CREW_FACTORY` | The `DefaultCrewFactory` instance bound under a symbol token. | Build a configured `Crew` from agents and tasks. |

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
  CREW_FACTORY,
  CrewModule,
  DefaultCrewFactory,
  KNOWLEDGE,
  LLM,
  MEMORY,
} from "@crewai-ts/nestjs";
```

`CrewModule` exports:

- `CREW_FACTORY`
- `LLM`
- `MEMORY`
- `KNOWLEDGE`
- `DefaultCrewFactory`
- `AgentFactory`

## Notes

`CREW_FACTORY` is bound to the same instance as `DefaultCrewFactory`, so consumers can inject either the symbol token or the class provider.

`AgentFactory` uses the module-level `LLM` by default. Callers can still pass a per-agent `llm` when creating an agent.
