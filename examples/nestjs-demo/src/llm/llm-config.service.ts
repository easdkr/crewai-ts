import { Injectable, Logger } from "@nestjs/common";
import { createLLM } from "@crewai-ts/core";
import { registerOpenAIProvider } from "@crewai-ts/openai";
import { registerGeminiProvider } from "@crewai-ts/gemini";
import { registerAnthropicProvider } from "@crewai-ts/anthropic";
import type {
  CrewModuleOptions,
  KnowledgeSupply,
  LLMSupply,
  MemorySupply,
} from "@crewai-ts/nestjs";

/**
 * The three providers this demo wires from `~/.zshrc`-style env vars.
 * (`azure` is also a valid `LlmProviderName` in the library but is not
 * exercised here.)
 */
export type DemoProvider = "openai" | "gemini" | "anthropic";

export const DEMO_PROVIDERS: readonly DemoProvider[] = ["openai", "gemini", "anthropic"];

/** Cheap/fast defaults; override per-provider via *_MODEL env vars. */
const DEFAULT_MODELS: Record<DemoProvider, string> = {
  openai: "gpt-4o-mini",
  gemini: "gemini-2.5-flash",
  anthropic: "claude-sonnet-4-5",
};

/**
 * Knowledge sources for the `KNOWLEDGE` token. `KnowledgeSupply` is just
 * `readonly unknown[]`, so plain `{ content, metadata }` objects are valid —
 * no `StringKnowledgeSource` import required. This value is held by the
 * `KNOWLEDGE` DI token and is never passed into `Crew`, so it is execution-safe.
 */
const DEMO_KNOWLEDGE: KnowledgeSupply = [
  {
    content: "The API service is built with NestJS modules, providers, and controllers.",
    metadata: { source: "architecture-notes" },
  },
  {
    content: "Prefer concise implementation briefs that list risks and next steps.",
    metadata: { source: "style-guide" },
  },
];

/**
 * A tiny array-backed `MemoryLike` for the `MEMORY` token demo. Implements the
 * full optional surface so attaching it to a `Crew` is safe. `recall` does a
 * naive case-insensitive substring match.
 */
function createDemoMemory(): MemorySupply {
  const store: string[] = [
    "Prefer concise implementation briefs.",
    "Backend team uses NestJS + pnpm workspaces.",
  ];
  const match = (query: string) =>
    store
      .filter((content) => content.toLowerCase().includes(query.toLowerCase()))
      .map((content) => ({ record: { content }, score: 1 }));
  const memory = {
    memoryKind: "demo-inmemory",
    recall: (query: string) => match(query),
    remember: (content: string) => {
      store.push(content);
      return content;
    },
    rememberMany: (contents: readonly string[]) => {
      store.push(...contents);
      return contents;
    },
    remember_many: (contents: readonly string[]) => {
      store.push(...contents);
      return contents;
    },
    extractMemories: () => [] as readonly string[],
    extract_memories: () => [] as readonly string[],
    reset: () => {
      store.length = 0;
    },
  };
  return memory as unknown as MemorySupply;
}

/**
 * Builds the `CrewModule.forRootAsync` options from the environment.
 *
 * Design notes:
 *  - **Live only**: throws if no provider key is present (no mock fallback).
 *  - Every registry entry is a fully-built **LLM client** (not a model
 *    string). Clients pass through both `AgentFactory` and `DefaultCrewFactory`
 *    by identity, which avoids `AgentFactory`'s "unknown LLM name" guard and
 *    lets the `PLANNING_LLM` / `FUNCTION_CALLING_LLM` tokens hold real,
 *    resolvable LLMs.
 *  - OpenAI/Gemini providers read their API key from `process.env`
 *    automatically. Anthropic's provider does NOT, so the key is passed
 *    explicitly (bridging `CLAUDE_API_KEY` -> `ANTHROPIC_API_KEY`) along with
 *    `ANTHROPIC_BASE_URL` (e.g. a local proxy), which core does not auto-inject
 *    for non-OpenAI providers.
 *  - No secret value is ever hardcoded; everything comes from `process.env`.
 */
@Injectable()
export class LlmConfigService {
  private readonly logger = new Logger(LlmConfigService.name);
  private readonly clients = new Map<DemoProvider, LLMSupply>();
  private resolvedDefault?: DemoProvider;

  /** Providers whose API key is present in the environment. */
  available(): DemoProvider[] {
    const out: DemoProvider[] = [];
    if (process.env.OPENAI_API_KEY) out.push("openai");
    if (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY) out.push("gemini");
    if (process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY) out.push("anthropic");
    return out;
  }

  /**
   * The provider that backs `llms.default`. Honors `LLM_PROVIDER` when set and
   * available; otherwise the first available provider in `DEMO_PROVIDERS` order.
   */
  defaultProvider(available: DemoProvider[] = this.available()): DemoProvider {
    const requested = process.env.LLM_PROVIDER?.trim().toLowerCase();
    if (requested) {
      if (!DEMO_PROVIDERS.includes(requested as DemoProvider)) {
        throw new Error(
          `LLM_PROVIDER='${requested}' is not one of ${DEMO_PROVIDERS.join(", ")}.`,
        );
      }
      if (!available.includes(requested as DemoProvider)) {
        throw new Error(
          `LLM_PROVIDER='${requested}' has no API key set. Available: ${available.join(", ") || "(none)"}.`,
        );
      }
      return requested as DemoProvider;
    }
    const first = available[0];
    if (!first) {
      throw new Error("No LLM provider available — cannot resolve a default.");
    }
    return first;
  }

  /** The model id that will be used for `provider` (env override or default). */
  modelFor(provider: DemoProvider): string {
    switch (provider) {
      case "openai":
        return process.env.OPENAI_MODEL ?? DEFAULT_MODELS.openai;
      case "gemini":
        return process.env.GEMINI_MODEL ?? DEFAULT_MODELS.gemini;
      case "anthropic":
        return process.env.ANTHROPIC_MODEL ?? DEFAULT_MODELS.anthropic;
    }
  }

  /** Build (and cache) a native LLM client for `provider`. */
  clientFor(provider: DemoProvider): LLMSupply {
    const cached = this.clients.get(provider);
    if (cached) return cached;

    // `createLLM` returns the structural `LLMClient`; the library's `LLMSupply`
    // is keyed off core's `LLM` (a class), so cast through `unknown`.
    let client: LLMSupply;
    if (provider === "openai") {
      registerOpenAIProvider();
      client = createLLM({
        model: this.modelFor("openai"),
        ...(process.env.OPENAI_BASE_URL ? { base_url: process.env.OPENAI_BASE_URL } : {}),
      }) as unknown as LLMSupply;
    } else if (provider === "gemini") {
      registerGeminiProvider();
      client = createLLM({ model: this.modelFor("gemini") }) as unknown as LLMSupply;
    } else {
      // Anthropic: provider does not auto-read env — pass the (bridged) key
      // explicitly, plus a custom base URL when set (e.g. a local proxy).
      const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY;
      registerAnthropicProvider();
      client = createLLM({
        model: this.modelFor("anthropic"),
        api_key: apiKey,
        ...(process.env.ANTHROPIC_BASE_URL ? { base_url: process.env.ANTHROPIC_BASE_URL } : {}),
      }) as unknown as LLMSupply;
    }

    if (!client) {
      throw new Error(`Failed to build an LLM client for provider '${provider}'.`);
    }
    this.clients.set(provider, client);
    return client;
  }

  /** Assemble the `CrewModule.forRoot` options consumed by `forRootAsync`. */
  buildCrewModuleOptions(): CrewModuleOptions {
    const available = this.available();
    if (available.length === 0) {
      throw new Error(
        "No LLM provider key found. This demo is LIVE-ONLY. Set one of:\n" +
          "  - OPENAI_API_KEY\n" +
          "  - GEMINI_API_KEY (or GOOGLE_API_KEY)\n" +
          "  - ANTHROPIC_API_KEY (or CLAUDE_API_KEY; ANTHROPIC_BASE_URL for a proxy)\n" +
          "Then re-run. See examples/nestjs-demo/.env.example for the full list.",
      );
    }

    const def = this.defaultProvider(available);
    this.resolvedDefault = def;

    // One named registry entry per available provider, plus the reserved
    // `default` key. All values are clients (identity-safe everywhere).
    const llms: Record<string, LLMSupply> = {};
    for (const provider of available) {
      llms[provider] = this.clientFor(provider) as LLMSupply;
    }
    llms.default = this.clientFor(def) as LLMSupply;
    const defaultClient = this.clientFor(def) as LLMSupply;

    this.logger.log(
      `Live LLM wiring → providers=[${available.join(", ")}], default=${def} (${this.modelFor(def)})`,
    );

    return {
      // Named multi-LLM registry (LLM_REGISTRY) + reserved `default` (LLM token).
      llms,
      // NOTE: `llmProviders: [...]` is intentionally OMITTED. It triggers a lazy
      // `import('@crewai-ts/<name>')` from INSIDE the @crewai-ts/nestjs package,
      // which fails in a pnpm-isolated workspace (the provider packages are not
      // visible from nestjs's own node_modules). This demo instead eager-registers
      // each provider in `clientFor()` — the same end state, workspace-safe. In a
      // normal flat-install app you can pass `llmProviders: available` here.
      // Module-level planning / function-calling LLMs (PLANNING_LLM / FUNCTION_CALLING_LLM tokens).
      planningLlm: defaultClient,
      functionCallingLlm: defaultClient,
      // Keep planning OFF so the smoke is a single fast/cheap LLM round-trip.
      planning: false,
      verbose: false,
      cache: true,
      // Router strategy over the registry (LLM_ROUTER token).
      llmRouter: "round-robin",
      // MEMORY + KNOWLEDGE tokens.
      memory: createDemoMemory(),
      knowledge: DEMO_KNOWLEDGE,
    };
  }

  /** The provider chosen as default on the last build (for status endpoints). */
  resolvedDefaultProvider(): DemoProvider {
    return this.resolvedDefault ?? this.defaultProvider();
  }
}
