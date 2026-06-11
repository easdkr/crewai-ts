import {
  DynamicModule,
  ForwardReference,
  Module,
  Provider,
  Type,
} from "@nestjs/common";
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
  type KnowledgeSupply,
  type LlmProviderName,
  type LLMSupply,
  type MemorySupply,
  type RouterStrategy,
} from "./tokens.js";
import type { RouterStrategyFn } from "./registry/llm-router.js";
import { DefaultCrewFactory } from "./factories/crew-factory.js";
import { AgentFactory } from "./factories/agent-factory.js";
import { LlmRegistryService } from "./registry/llm-registry.js";
import { LlmRouterService } from "./registry/llm-router.js";
import { EventBusService } from "./event-bus/event-bus.service.js";
import { AgentRegistryService } from "./agents/agent-registry.js";
import {
  emitDeprecationWarning,
  LEGACY_LLM_FIELD_WARNING,
} from "./deprecation.js";

/**
 * v0.3.0 module options.
 *
 * The legacy `llm` field is deprecated — emit a `DeprecationWarning` whenever
 * it is set, but the runtime still binds it for backward compatibility. New
 * code should pass `llms.default` (and any number of named LLMs) instead.
 *
 * The router, registry, event bus, and agent registry are bound to dedicated
 * services that consumers can inject via the corresponding symbol tokens.
 */
export interface CrewModuleOptions {
  /** @deprecated since 0.3.0 — use `llms.default` */
  llm?: LLMSupply;
  memory?: MemorySupply;
  knowledge?: KnowledgeSupply;
  /** Named LLM registry. `llms.default` is the reserved key for the default LLM. */
  llms?: Record<string, LLMSupply>;
  /** Auto-register native provider packages via lazy `import()`. */
  llmProviders?: readonly LlmProviderName[];
  /** Module-level planning LLM. */
  planningLlm?: LLMSupply;
  /** Module-level function-calling LLM. */
  functionCallingLlm?: LLMSupply;
  /** Enable crew-level planning. */
  planning?: boolean;
  /** Enable verbose logging. */
  verbose?: boolean;
  /** Disable crew-level tool result caching when false. */
  cache?: boolean;
  /** Router strategy. `false` opts out (registry provides a single LLM directly). */
  llmRouter?: RouterStrategy | RouterStrategyFn;
}

export interface CrewModuleAsyncOptions {
  // `useFactory` is intentionally variadic. Each `inject` token flows through
  // Nest as an `unknown`, and consumers typically annotate their factory
  // with a concrete tuple (e.g. `(config: MyConfig) => ...`). We type the
  // parameters as `any[]` rather than `unknown[]` so those typed factories
  // remain assignable here without losing their inner argument types.
  useFactory: (
    ...args: any[]
  ) => CrewModuleOptions | Promise<CrewModuleOptions>;
  inject?: readonly (
    | string
    | symbol
    | Type
    | (abstract new (...args: never[]) => unknown)
  )[];
  imports?: readonly (DynamicModule | Type | ForwardReference)[];
}

/**
 * Native-provider registration function name lookup. The 4 locked
 * `LlmProviderName` values map to the named export in their respective
 * package's `index.ts`. The mapping is intentionally a literal table
 * (not a generic `capitalize(name)`) because "openai" → "OpenAI" (the AI
 * part is all-caps), while the other three follow a plain `Capitalized`
 * convention.
 */
const REGISTER_FN_BY_PROVIDER: Record<LlmProviderName, string> = {
  openai: "registerOpenAIProvider",
  anthropic: "registerAnthropicProvider",
  gemini: "registerGeminiProvider",
  azure: "registerAzureProvider",
};

/**
 * Lazy auto-registration of a native provider package. The dynamic `import()`
 * is what keeps `@crewai-ts/openai` (and siblings) out of `peerDependencies`
 * — a consumer that does not pass `llmProviders: ['openai']` never triggers
 * the import, and pnpm does not need to install the package.
 *
 * @throws with a "Run: pnpm add @crewai-ts/<name>" hint if the package is
 *   not installed (dynamic import rejects with `ERR_MODULE_NOT_FOUND`) OR
 *   if the package is installed but does not export the expected
 *   `register<Name>Provider` function.
 */
async function autoRegisterProvider(name: LlmProviderName): Promise<void> {
  const pkg = `@crewai-ts/${name}`;
  let mod: Record<string, unknown>;
  try {
    mod = (await import(pkg)) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Cannot auto-register provider '${name}': ${pkg} is not installed. ` +
        `Run: pnpm add ${pkg}`,
    );
  }
  const fnName = REGISTER_FN_BY_PROVIDER[name];
  const fn = mod[fnName];
  if (typeof fn !== "function") {
    throw new Error(
      `Cannot auto-register provider '${name}': ${pkg} does not export ` +
        `${fnName}(). Run: pnpm add ${pkg}`,
    );
  }
  (fn as () => void)();
}

@Module({})
export class CrewModule {
  static forRoot(options: CrewModuleOptions): DynamicModule {
    if (
      !options ||
      (!("llm" in options) && !options.llms && !options.llmProviders)
    ) {
      throw new Error(
        "CrewModule.forRoot requires at least { llms.default } or { llm }",
      );
    }
    // Deprecation: the legacy `llm` field is still wired (LLM token resolves
    // to it) but a DeprecationWarning is emitted. v0.3.0 consumers should
    // pass `llms.default` instead. Both can be supplied simultaneously —
    // `llms.default` wins.
    if ("llm" in options && options.llm !== undefined) {
      emitDeprecationWarning(LEGACY_LLM_FIELD_WARNING);
    }

    const providers: Provider[] = [
      // Module-level tokens. Legacy `llm` is still bound for backward
      // compatibility; LlmRegistryService is the new canonical home for
      // v0.3+ multi-LLM setups.
      {
        provide: LLM,
        useValue: options.llms?.default ?? options.llm ?? null,
      },
      { provide: MEMORY, useValue: options.memory ?? null },
      { provide: KNOWLEDGE, useValue: options.knowledge ?? null },
      { provide: PLANNING_LLM, useValue: options.planningLlm ?? null },
      {
        provide: FUNCTION_CALLING_LLM,
        useValue: options.functionCallingLlm ?? null,
      },
      // Class-based factories + token bindings (legacy pattern).
      DefaultCrewFactory,
      { provide: CREW_FACTORY, useExisting: DefaultCrewFactory },
      AgentFactory,
      // New v0.3.0 services + tokens.
      LlmRegistryService,
      {
        provide: LLM_REGISTRY,
        useFactory: async (registry: LlmRegistryService) => {
          if (options.llms) {
            registry.registerAll(options.llms);
          }
          if (options.llmProviders) {
            for (const name of options.llmProviders) {
              await autoRegisterProvider(name);
            }
          }
          return registry;
        },
        inject: [LlmRegistryService],
      },
      LlmRouterService,
      {
        provide: LLM_ROUTER,
        useFactory: (router: LlmRouterService) => {
          if (options.llmRouter !== undefined) {
            router.use(options.llmRouter);
          }
          return router;
        },
        inject: [LlmRouterService],
      },
      EventBusService,
      { provide: EVENT_BUS, useExisting: EventBusService },
      AgentRegistryService,
      { provide: AGENT_REGISTRY, useExisting: AgentRegistryService },
    ];

    return {
      module: CrewModule,
      providers,
      exports: [
        // Legacy exports
        CREW_FACTORY,
        LLM,
        MEMORY,
        KNOWLEDGE,
        DefaultCrewFactory,
        AgentFactory,
        // v0.3.0 new tokens
        LLM_REGISTRY,
        LLM_ROUTER,
        PLANNING_LLM,
        FUNCTION_CALLING_LLM,
        EVENT_BUS,
        AGENT_REGISTRY,
        // v0.3.0 new services
        LlmRegistryService,
        LlmRouterService,
        EventBusService,
        AgentRegistryService,
      ],
    };
  }

  static forRootAsync(options: CrewModuleAsyncOptions): DynamicModule {
    if (!options?.useFactory) {
      throw new Error("CrewModule.forRootAsync requires { useFactory }");
    }
    // Carry the `useFactory` return value through a single CREW_MODULE_OPTIONS
    // provider so every downstream provider can read it via `inject`. The
    // factory itself may return a Promise; Nest awaits it before downstream
    // factories see the resolved object.
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
        // Module-level tokens. Legacy `llm` is still bound for backward
        // compatibility; LlmRegistryService is the new canonical home for
        // v0.3+ multi-LLM setups. The DeprecationWarning fires synchronously
        // here at module-init time (not on every consumer get()), exactly
        // once per `llm` field presence.
        {
          provide: LLM,
          useFactory: (opts: CrewModuleOptions) => {
            if ("llm" in opts && opts.llm !== undefined) {
              emitDeprecationWarning(LEGACY_LLM_FIELD_WARNING);
            }
            return opts.llms?.default ?? opts.llm ?? null;
          },
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
        {
          provide: PLANNING_LLM,
          useFactory: (opts: CrewModuleOptions) => opts.planningLlm ?? null,
          inject: ["CREW_MODULE_OPTIONS"],
        },
        {
          provide: FUNCTION_CALLING_LLM,
          useFactory: (opts: CrewModuleOptions) =>
            opts.functionCallingLlm ?? null,
          inject: ["CREW_MODULE_OPTIONS"],
        },
        // Class-based factory (same as forRoot): DefaultCrewFactory is the
        // canonical instance. CREW_FACTORY is bound to it via useExisting so
        // consumers can resolve it by either the symbol token or the class.
        DefaultCrewFactory,
        { provide: CREW_FACTORY, useExisting: DefaultCrewFactory },
        AgentFactory,
        // v0.3.0 services + tokens. LLM_REGISTRY and LLM_ROUTER are wired
        // through a useFactory that reads `CREW_MODULE_OPTIONS` (the
        // async-supplied options object) AND the class instance, so the
        // registry/router is populated with the same `llms` / `llmProviders` /
        // `llmRouter` payload that the sync `forRoot` path uses.
        LlmRegistryService,
        {
          provide: LLM_REGISTRY,
          useFactory: async (
            registry: LlmRegistryService,
            opts: CrewModuleOptions,
          ) => {
            if (opts.llms) {
              registry.registerAll(opts.llms);
            }
            if (opts.llmProviders) {
              for (const name of opts.llmProviders) {
                await autoRegisterProvider(name);
              }
            }
            return registry;
          },
          inject: [LlmRegistryService, "CREW_MODULE_OPTIONS"],
        },
        LlmRouterService,
        {
          provide: LLM_ROUTER,
          useFactory: (
            router: LlmRouterService,
            opts: CrewModuleOptions,
          ) => {
            if (opts.llmRouter !== undefined) {
              router.use(opts.llmRouter);
            }
            return router;
          },
          inject: [LlmRouterService, "CREW_MODULE_OPTIONS"],
        },
        EventBusService,
        { provide: EVENT_BUS, useExisting: EventBusService },
        AgentRegistryService,
        { provide: AGENT_REGISTRY, useExisting: AgentRegistryService },
      ],
      exports: [
        // Legacy exports
        CREW_FACTORY,
        LLM,
        MEMORY,
        KNOWLEDGE,
        DefaultCrewFactory,
        AgentFactory,
        // v0.3.0 new tokens
        LLM_REGISTRY,
        LLM_ROUTER,
        PLANNING_LLM,
        FUNCTION_CALLING_LLM,
        EVENT_BUS,
        AGENT_REGISTRY,
        // v0.3.0 new services
        LlmRegistryService,
        LlmRouterService,
        EventBusService,
        AgentRegistryService,
      ],
    };
  }
}
