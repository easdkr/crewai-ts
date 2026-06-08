import { DynamicModule, Module, Provider } from "@nestjs/common";
import {
  CREW_FACTORY,
  KNOWLEDGE,
  LLM,
  MEMORY,
  type CrewFactory,
  type KnowledgeSupply,
  type LLMSupply,
  type MemorySupply,
} from "./tokens.js";

export interface CrewModuleOptions {
  llm: LLMSupply;
  memory?: MemorySupply;
  knowledge?: KnowledgeSupply;
}

@Module({})
export class CrewModule {
  static forRoot(options: CrewModuleOptions): DynamicModule {
    if (!options || !("llm" in options)) {
      throw new Error("CrewModule.forRoot requires at least { llm }");
    }
    const providers: Provider[] = [
      { provide: LLM, useValue: options.llm },
      { provide: MEMORY, useValue: options.memory ?? null },
      { provide: KNOWLEDGE, useValue: options.knowledge ?? null },
      {
        provide: CREW_FACTORY,
        useFactory: (): CrewFactory => ({
          create: ({ agents, tasks }) => {
            const { Crew, Process } = require("@crewai-ts/core") as typeof import("@crewai-ts/core");
            return new Crew({ agents: [...agents], tasks: [...tasks], process: Process.sequential });
          },
        }),
      },
    ];
    return {
      module: CrewModule,
      providers,
      exports: [CREW_FACTORY, LLM, MEMORY, KNOWLEDGE],
    };
  }
}
