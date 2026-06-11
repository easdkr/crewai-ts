import { Inject, Injectable, Optional } from "@nestjs/common";
import { Agent, type LLM as LLMType } from "@crewai-ts/core";
import { AGENT_REGISTRY, LLM } from "../tokens.js";
import { AgentRegistryService } from "../agents/agent-registry.js";

const NOOP_LLM = (): string => "";

/**
 * NestJS-injectable AgentFactory. Builds an {@link Agent} from a
 * `{ role, goal, backstory, llm? }` shape. When the caller does not supply a
 * per-agent LLM, the factory falls back to the module-level LLM token; if
 * neither is bound, a no-op function LLM is used so the Agent stays
 * constructable in tests and stub setups.
 *
 * If `role` is registered in `AgentRegistryService`, the pre-built Agent is
 * returned directly (skipping `new Agent({...})`).
 */
@Injectable()
export class AgentFactory {
  constructor(
    @Optional() @Inject(LLM) private readonly defaultLlm: LLMType | string | null = null,
    @Optional() @Inject(AGENT_REGISTRY) private readonly agentRegistry: AgentRegistryService | null = null,
  ) {}

  create(options: { role: string; goal: string; backstory: string; llm?: LLMType | string }): Agent {
    if (this.agentRegistry?.has(options.role)) {
      return this.agentRegistry.get(options.role);
    }
    return new Agent({
      ...options,
      llm: options.llm ?? this.defaultLlm ?? NOOP_LLM,
    });
  }
}
