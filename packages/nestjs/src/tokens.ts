import type {
  Crew,
  Memory,
  Knowledge,
  LLM as LLMType,
  Agent,
  Task,
} from "@crewai-ts/core";

export const CREW_FACTORY = Symbol.for("crewai-ts/CREW_FACTORY");
export const LLM = Symbol.for("crewai-ts/LLM");
export const MEMORY = Symbol.for("crewai-ts/MEMORY");
export const KNOWLEDGE = Symbol.for("crewai-ts/KNOWLEDGE");

export type CrewFactoryToken = symbol;
export type LLMToken = symbol;
export type MemoryToken = symbol;
export type KnowledgeToken = symbol;

// Helper types for injection
export type LLMSupply = LLMType | string | null | undefined;
export type MemorySupply = Memory | null | undefined;
export type KnowledgeSupply = readonly Knowledge[] | null | undefined;

// CrewFactory contract: returns a configured Crew
export interface CrewFactory {
  create(input: { agents: readonly Agent[]; tasks: readonly Task[] }): Crew;
}
