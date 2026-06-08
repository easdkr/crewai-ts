import { DynamicModule, Module, Provider } from "@nestjs/common";
import {
  CREW_FACTORY,
  KNOWLEDGE,
  LLM,
  MEMORY,
  type KnowledgeSupply,
  type LLMSupply,
  type MemorySupply,
} from "./tokens.js";
import { DefaultCrewFactory } from "./factories/crew-factory.js";

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
      // Class-based factory: DefaultCrewFactory is the canonical instance
      // (injects LLM + MEMORY). The CREW_FACTORY symbol is bound to the SAME
      // instance via useExisting so consumers can resolve it by either token.
      DefaultCrewFactory,
      { provide: CREW_FACTORY, useExisting: DefaultCrewFactory },
    ];
    return {
      module: CrewModule,
      providers,
      exports: [CREW_FACTORY, LLM, MEMORY, KNOWLEDGE, DefaultCrewFactory],
    };
  }
}
