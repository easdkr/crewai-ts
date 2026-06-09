export type A2AServerMethodsInjector = (agent: unknown) => unknown;
export type A2AAgentWrapper = (agent: unknown) => unknown;
export type LiteAgentA2AKickoffHandler = (options: {
  agent: unknown;
  originalKickoff: (messages: unknown, responseFormat?: unknown, inputFiles?: unknown) => unknown;
  messages: unknown;
  responseFormat?: unknown;
  inputFiles?: unknown;
}) => unknown;

export type EmbedderConfig = object | string | number | boolean;

export type MemoryMatchLike = {
  readonly record?: { readonly id?: string };
  format(): string;
};

export type MemoryLike = {
  readonly readOnly?: boolean;
  readonly read_only?: boolean;
  readonly memoryKind?: string;
  readonly memory_kind?: string;
  recall(query: string, options?: Record<string, unknown>): readonly MemoryMatchLike[];
  remember?(content: string, options?: Record<string, unknown>): unknown;
  remember_many?(contents: readonly string[], options?: Record<string, unknown>): unknown;
  rememberMany?(contents: readonly string[], options?: Record<string, unknown>): unknown;
  extract_memories?(content: string): readonly string[];
  extractMemories?(content: string): readonly string[];
  reset?(scope?: string): unknown;
};

export type MemoryScopeLike = MemoryLike & {
  readonly rootPath?: string;
  readonly root_path?: string;
  memory?: MemoryLike | null;
  bind?(memory: MemoryLike): unknown;
  _require_memory?(): MemoryLike;
};

export type KnowledgeSourceLike = {
  readonly sourceType?: string;
  readonly metadata?: Record<string, unknown>;
  storage?: unknown;
  chunks(): readonly string[];
  add?(): void;
  aadd?(): Promise<void>;
  get_embeddings?(): readonly unknown[];
  validate_content?(): unknown;
};

export type KnowledgeQueryOptions = {
  resultsLimit?: number;
  results_limit?: number;
  scoreThreshold?: number | null;
  score_threshold?: number | null;
};

export type KnowledgeLike = {
  readonly sources?: readonly KnowledgeSourceLike[];
  query(query: string | readonly string[], options?: KnowledgeQueryOptions): readonly unknown[];
  reset?(): unknown;
};

export type CreateMemoryOptions = {
  rootScope?: string;
  root_scope?: string;
  embedder?: EmbedderConfig | null;
};

export type CreateKnowledgeOptions = {
  sources: readonly KnowledgeSourceLike[];
  collectionName?: string | null;
  collection_name?: string | null;
  embedder?: EmbedderConfig | null;
};

export type RagFeatureHooks = {
  createMemory?: (options?: CreateMemoryOptions) => MemoryLike;
  createKnowledge?: (options: CreateKnowledgeOptions) => KnowledgeLike;
  createMemoryTools?: (memory: MemoryLike | MemoryScopeLike) => readonly unknown[];
  extractPDFText?: (content: Uint8Array, filename: string) => string | Promise<string>;
  isMemory?: (value: unknown) => value is MemoryLike;
  isMemoryScope?: (value: unknown) => value is MemoryScopeLike;
  isKnowledge?: (value: unknown) => value is KnowledgeLike;
  bindMemoryView?: (value: unknown, backing: MemoryLike) => void;
};

let a2aServerMethodsInjector: A2AServerMethodsInjector | null = null;
let a2aAgentWrapper: A2AAgentWrapper | null = null;
let liteAgentA2AKickoffHandler: LiteAgentA2AKickoffHandler | null = null;
let ragFeatureHooks: RagFeatureHooks = {};

export function registerA2AServerMethodsInjector(injector: A2AServerMethodsInjector | null): void {
  a2aServerMethodsInjector = injector;
}

export function applyA2AServerMethodsInjector<TAgent>(agent: TAgent): TAgent {
  return (a2aServerMethodsInjector?.(agent) ?? agent) as TAgent;
}

export function registerA2AAgentWrapper(wrapper: A2AAgentWrapper | null): void {
  a2aAgentWrapper = wrapper;
}

export function applyA2AAgentWrapper<TAgent>(agent: TAgent): TAgent {
  return (a2aAgentWrapper?.(agent) ?? agent) as TAgent;
}

export function registerLiteAgentA2AKickoffHandler(handler: LiteAgentA2AKickoffHandler | null): void {
  liteAgentA2AKickoffHandler = handler;
}

export function getLiteAgentA2AKickoffHandler(): LiteAgentA2AKickoffHandler | null {
  return liteAgentA2AKickoffHandler;
}

export function registerRagFeatureHooks(hooks: RagFeatureHooks | null): void {
  ragFeatureHooks = hooks ?? {};
}

export function createRegisteredMemory(options?: CreateMemoryOptions): MemoryLike | null {
  return ragFeatureHooks.createMemory?.(options) ?? null;
}

export function createRegisteredKnowledge(options: CreateKnowledgeOptions): KnowledgeLike | null {
  return ragFeatureHooks.createKnowledge?.(options) ?? null;
}

export function createRegisteredMemoryTools(memory: MemoryLike | MemoryScopeLike): readonly unknown[] {
  return ragFeatureHooks.createMemoryTools?.(memory) ?? [];
}

export async function extractRegisteredPDFText(content: Uint8Array, filename: string): Promise<string | null> {
  const text = await ragFeatureHooks.extractPDFText?.(content, filename);
  return typeof text === "string" ? text : null;
}

export function isRegisteredMemory(value: unknown): value is MemoryLike {
  if (ragFeatureHooks.isMemory?.(value)) {
    return true;
  }
  return isMemoryLike(value) && !isRegisteredMemoryScope(value);
}

export function isRegisteredMemoryScope(value: unknown): value is MemoryScopeLike {
  if (ragFeatureHooks.isMemoryScope?.(value)) {
    return true;
  }
  return isMemoryLike(value) && (
    readString(value, "memoryKind") === "scope"
    || readString(value, "memory_kind") === "scope"
    || typeof (value as { bind?: unknown }).bind === "function"
  );
}

export function isRegisteredKnowledge(value: unknown): value is KnowledgeLike {
  if (ragFeatureHooks.isKnowledge?.(value)) {
    return true;
  }
  return Boolean(value)
    && typeof value === "object"
    && typeof (value as { query?: unknown }).query === "function";
}

export function bindRegisteredMemoryView(value: unknown, backing: MemoryLike): void {
  if (ragFeatureHooks.bindMemoryView) {
    ragFeatureHooks.bindMemoryView(value, backing);
    return;
  }
  if (!value || typeof value !== "object" || value === backing) {
    return;
  }
  const bind = (value as { bind?: unknown }).bind;
  if (typeof bind === "function") {
    bind.call(value, backing);
  }
}

export function extractKnowledgeContext(results: readonly unknown[]): string {
  const content = results
    .map((result) => {
      if (!result || typeof result !== "object" || Array.isArray(result)) {
        return "";
      }
      const content = (result as { content?: unknown }).content;
      return typeof content === "string" ? content.trim() : "";
    })
    .filter(Boolean)
    .join("\n");
  return content ? `Additional Information:\n${content}` : "";
}

function isMemoryLike(value: unknown): value is MemoryLike {
  return Boolean(value)
    && typeof value === "object"
    && typeof (value as { recall?: unknown }).recall === "function";
}

function readString(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" ? candidate : null;
}
