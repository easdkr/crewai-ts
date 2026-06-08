import {
  DynamicModule,
  ForwardReference,
  Module,
  Provider,
  Type,
} from "@nestjs/common";
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

export interface CrewModuleAsyncOptions {
  useFactory: (
    ...args: unknown[]
  ) => CrewModuleOptions | Promise<CrewModuleOptions>;
  inject?: readonly (
    | string
    | symbol
    | Type
    | (abstract new (...args: never[]) => unknown)
  )[];
  imports?: readonly (DynamicModule | Type | ForwardReference)[];
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

  static forRootAsync(options: CrewModuleAsyncOptions): DynamicModule {
    if (!options?.useFactory) {
      throw new Error("CrewModule.forRootAsync requires { useFactory }");
    }
    const factoryProvider: Provider = {
      provide: "CREW_MODULE_OPTIONS",
      useFactory: options.useFactory,
      inject: [...(options.inject ?? [])],
    };
    return {
      module: CrewModule,
      imports: [...(options.imports ?? [])],
      providers: [
        factoryProvider,
        {
          provide: LLM,
          useFactory: (opts: CrewModuleOptions) => opts.llm,
          inject: ["CREW_MODULE_OPTIONS"],
        },
        {
          provide: MEMORY,
          useFactory: (opts: CrewModuleOptions) => opts.memory ?? null,
          inject: ["CREW_MODULE_OPTIONS"],
        },
        {
          provide: KNOWLEDGE,
          useFactory: (opts: CrewModuleOptions) => opts.knowledge ?? null,
          inject: ["CREW_MODULE_OPTIONS"],
        },
        // Class-based factory (same as forRoot): DefaultCrewFactory is the
        // canonical instance. CREW_FACTORY is bound to it via useExisting so
        // consumers can resolve it by either the symbol token or the class.
        DefaultCrewFactory,
        { provide: CREW_FACTORY, useExisting: DefaultCrewFactory },
      ],
      exports: [CREW_FACTORY, LLM, MEMORY, KNOWLEDGE, DefaultCrewFactory],
    };
  }
}
