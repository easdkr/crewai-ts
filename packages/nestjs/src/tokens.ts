import type {
  Crew,
  LLM as LLMType,
  Agent,
  Task,
} from "@crewai-ts/core";
import type { MemoryLike } from "@crewai-ts/core/feature-hooks";

export const CREW_FACTORY = Symbol.for("crewai-ts/CREW_FACTORY");
export const LLM = Symbol.for("crewai-ts/LLM");
export const MEMORY = Symbol.for("crewai-ts/MEMORY");
export const KNOWLEDGE = Symbol.for("crewai-ts/KNOWLEDGE");

// v0.3.0 tokens — multi-LLM, planning, function-calling, eventing, and agent registry.
export const LLM_REGISTRY = Symbol.for("crewai-ts/LLM_REGISTRY");
export const LLM_ROUTER = Symbol.for("crewai-ts/LLM_ROUTER");
export const PLANNING_LLM = Symbol.for("crewai-ts/PLANNING_LLM");
export const FUNCTION_CALLING_LLM = Symbol.for("crewai-ts/FUNCTION_CALLING_LLM");
export const EVENT_BUS = Symbol.for("crewai-ts/EVENT_BUS");
export const AGENT_REGISTRY = Symbol.for("crewai-ts/AGENT_REGISTRY");

export type CrewFactoryToken = symbol;
export type LLMToken = symbol;
export type MemoryToken = symbol;
export type KnowledgeToken = symbol;
export type LlmRegistryToken = symbol;
export type LlmRouterToken = symbol;
export type PlanningLlmToken = symbol;
export type FunctionCallingLlmToken = symbol;
export type EventBusToken = symbol;
export type AgentRegistryToken = symbol;

// Helper types for injection.
//
// `LLMSupply` and `KnowledgeSupply` are intentionally more permissive than the
// core's strict `LLMFunction` / `Knowledge` class signatures. Rationale:
//   - Mock LLMs in tests typically use a zero-arg `(): string => "..."` shape,
//     which is structurally incompatible with the core's `LLMFunction`
//     `(messages, options?) => MaybePromise<LLMResponse>`.
//   - The Agent/Knowledge APIs accept these mocks because the downstream code
//     path is duck-typed (e.g. a function is called and its return is treated
//     as `LLMResponse`).
//   - Permissive `(...args: never[]) => unknown` and `readonly unknown[]`
//     still reject non-functions / non-arrays at the type level while letting
//     users pass mocks, decorators, and plain object knowledge sources.
//
// If the core's strict types are needed at a particular call site, narrow with
// `satisfies LLMType` there.
export type LLMSupply =
  | LLMType
  | string
  | ((...args: never[]) => unknown)
  | null
  | undefined;
export type MemorySupply = MemoryLike | null | undefined;
export type KnowledgeSupply = readonly unknown[] | null | undefined;

// CrewFactory contract: returns a configured Crew
export interface CrewFactory {
  create(input: {
    agents: readonly Agent[];
    tasks: readonly Task[];
    memory?: MemorySupply | false;
  }): Crew;
}

// Strategy used by LLM_REGISTRY / LLM_ROUTER to pick a provider from a set.
// `false` opts out of routing — the registry provides a single LLM directly.
export type RouterStrategy = "round-robin" | "fallback" | "race" | "weighted" | false;

export type LlmProviderName = "openai" | "anthropic" | "gemini" | "azure";
