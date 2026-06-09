import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  Agent,
  Crew,
  Process,
  type LLM as LLMType,
  type Task,
} from "@crewai-ts/core";
import type { MemoryLike } from "@crewai-ts/core/feature-hooks";
import { LLM, MEMORY, type CrewFactory } from "../tokens.js";

/**
 * Default NestJS-injectable CrewFactory. Builds a {@link Crew} from a
 * `{ agents, tasks }` shape, defaulting to {@link Process.sequential} and
 * optionally attaching a module-level memory contract if one was provided.
 *
 * The CREW_FACTORY DI token is bound to this class via `useExisting`, so the
 * same instance is addressable under both the class type and the symbol token.
 */
@Injectable()
export class DefaultCrewFactory implements CrewFactory {
  constructor(
    @Optional() @Inject(LLM) private readonly defaultLlm: LLMType | string | null = null,
    @Optional() @Inject(MEMORY) private readonly memory: MemoryLike | null = null,
  ) {}

  create({ agents, tasks }: { agents: readonly Agent[]; tasks: readonly Task[] }): Crew {
    if (!agents || agents.length === 0) {
      throw new Error("CrewFactory.create requires at least one agent");
    }
    return new Crew({
      agents: [...agents],
      tasks: [...tasks],
      process: Process.sequential,
      ...(this.memory ? { memory: this.memory } : {}),
    });
  }
}
