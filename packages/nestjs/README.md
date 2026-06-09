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
import { Module } from "@nestjs/common";
import { CrewModule } from "@crewai-ts/nestjs";

@Module({
  imports: [
    CrewModule.forRoot({
      llm: "openai/gpt-4o-mini",
    }),
  ],
})
export class AppModule {}
```

Inject the factories from any provider:

```ts
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
      backstory: "A concise technical researcher.",
    });

    const task = new Task({
      description: `Summarize the important points about ${topic}.`,
      expected_output: "A short summary.",
      agent: researcher,
    });

    const crew = this.crewFactory.create({
      agents: [researcher],
      tasks: [task],
    });

    return crew.kickoff();
  }
}
```

## Async Configuration

Use `forRootAsync` when your LLM, memory, or knowledge sources come from another NestJS provider.

```ts
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
