import { Inject, Injectable, Optional } from "@nestjs/common";
import { Agent, type LLM as LLMType } from "@crewai-ts/core";
import { LLM } from "../tokens.js";

const NOOP_LLM = (): string => "";

/**
 * NestJS-injectable AgentFactory. Builds an {@link Agent} from a
 * `{ role, goal, backstory, llm? }` shape. When the caller does not supply a
 * per-agent LLM, the factory falls back to the module-level LLM token; if
 * neither is bound, a no-op function LLM is used so the Agent stays
 * constructable in tests and stub setups.
 */
@Injectable()
export class AgentFactory {
  constructor(
    @Optional() @Inject(LLM) private readonly defaultLlm: LLMType | string | null = null,
  ) {}

  create(options: { role: string; goal: string; backstory: string; llm?: LLMType | string }): Agent {
    return new Agent({
      ...options,
      llm: options.llm ?? this.defaultLlm ?? NOOP_LLM,
    });
  }
}
