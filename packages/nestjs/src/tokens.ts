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

export type CrewFactoryToken = symbol;
export type LLMToken = symbol;
export type MemoryToken = symbol;
export type KnowledgeToken = symbol;

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
  create(input: { agents: readonly Agent[]; tasks: readonly Task[] }): Crew;
}
