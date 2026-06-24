import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  Agent,
  Crew,
  Process,
  type BaseTool,
  type LLM as LLMType,
  type Task,
} from "@crewai-ts/core";
import type { MemoryLike } from "@crewai-ts/core/feature-hooks";
import {
  FUNCTION_CALLING_LLM,
  LLM,
  MEMORY,
  PLANNING_LLM,
  type LLMSupply,
} from "../tokens.js";

/**
 * Default NestJS-injectable CrewFactory. Builds a {@link Crew} from a
 * `{ agents, tasks, planning, planningLlm, functionCallingLlm, verbose, cache, tools }`
 * shape, defaulting to {@link Process.sequential} and optionally attaching
 * a module-level memory contract if one was provided.
 *
 * `tools` is per-agent (legacy alias): the `tools` option here is merged
 * into every agent that doesn't already carry tools (since core's `Crew`
 * doesn't have a `tools` field). Tools attached at the agent level via
 * `AgentFactory.create({ tools })` take precedence.
 *
 * The CREW_FACTORY DI token is bound to this class via `useExisting`, so the
 * same instance is addressable under both the class type and the symbol token.
 */
export interface DefaultCrewFactoryOptions {
  agents: readonly Agent[];
  tasks: readonly Task[];
  planning?: boolean;
  planningLlm?: LLMSupply;
  functionCallingLlm?: LLMSupply;
  verbose?: boolean;
  cache?: boolean;
  memory?: MemoryLike | false | null;
  /** Per-agent tools (legacy alias — applied to every agent if not already set). */
  tools?: readonly BaseTool[];
}

@Injectable()
export class DefaultCrewFactory {
  constructor(
    @Optional() @Inject(LLM) private readonly defaultLlm: LLMType | string | null = null,
    @Optional() @Inject(MEMORY) private readonly memory: MemoryLike | null = null,
    @Optional() @Inject(PLANNING_LLM) private readonly defaultPlanningLlm: LLMSupply = null,
    @Optional() @Inject(FUNCTION_CALLING_LLM) private readonly defaultFunctionCallingLlm: LLMSupply = null,
  ) {}

  create(options: DefaultCrewFactoryOptions): Crew {
    if (!options.agents || options.agents.length === 0) {
      throw new Error("CrewFactory.create requires at least one agent");
    }
    // Per-agent tools merge (legacy alias): if a tool isn't already on an agent, add it.
    const agents = options.tools
      ? options.agents.map((agent) => this.attachTools(agent, options.tools!))
      : [...options.agents];
    const memory = options.memory === undefined ? this.memory : options.memory || null;
    return new Crew({
      agents,
      tasks: [...options.tasks],
      process: Process.sequential,
      ...(memory ? { memory } : {}),
      ...(options.planning !== undefined ? { planning: options.planning } : {}),
      ...(options.verbose !== undefined ? { verbose: options.verbose } : {}),
      ...(options.cache !== undefined ? { cache: options.cache } : {}),
      ...(options.planningLlm || this.defaultPlanningLlm
        ? { planningLlm: (options.planningLlm ?? this.defaultPlanningLlm) as LLMType | string | null }
        : {}),
      ...(options.functionCallingLlm || this.defaultFunctionCallingLlm
        ? { functionCallingLlm: (options.functionCallingLlm ?? this.defaultFunctionCallingLlm) as LLMType | string | null }
        : {}),
    });
  }

  private attachTools(agent: Agent, tools: readonly BaseTool[]): Agent {
    // If the agent already has tools, return it unchanged (per-agent takes precedence).
    const existing = (agent as unknown as { tools?: readonly BaseTool[] }).tools;
    if (existing && existing.length > 0) {
      return agent;
    }
    // Mutate: Agent's `tools` field is a public array; we set it directly.
    (agent as unknown as { tools: readonly BaseTool[] }).tools = [...tools];
    return agent;
  }
}
