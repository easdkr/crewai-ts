import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Task } from "@crewai-ts/core";
import {
  AgentFactory,
  CREW_FACTORY,
  LLM_REGISTRY,
  LlmRegistryService,
  type CrewFactory,
  type LLMSupply,
} from "@crewai-ts/nestjs";
import { LlmConfigService } from "../llm/llm-config.service.js";

/**
 * The core "does it actually work end-to-end" path:
 * `AgentFactory.create` (x2) → `CREW_FACTORY.create` → `crew.kickoff` (LIVE LLM call).
 *
 * Demonstrates: `AgentFactory`, `CREW_FACTORY`/`DefaultCrewFactory`,
 * `LLM_REGISTRY` (per-agent LLM override by provider name), and the default
 * LLM falling through from the `LLM` token.
 */
@Injectable()
export class ResearchService {
  // NOTE: every dependency is injected with an explicit `@Inject(...)`. The
  // tsx/esbuild runner does not emit `design:paramtypes` decorator metadata, so
  // type-based DI would resolve to `undefined`. Explicit tokens are metadata-free.
  constructor(
    @Inject(AgentFactory) private readonly agentFactory: AgentFactory,
    @Inject(CREW_FACTORY) private readonly crewFactory: CrewFactory,
    @Inject(LLM_REGISTRY) private readonly registry: LlmRegistryService,
    @Inject(LlmConfigService) private readonly config: LlmConfigService,
  ) {}

  async run(topic: string, provider?: string): Promise<{ provider: string; topic: string; output: string }> {
    // Optional per-agent LLM override: resolve a named entry from the registry.
    let override: LLMSupply | undefined;
    if (provider) {
      if (!this.registry.has(provider)) {
        throw new BadRequestException(
          `Unknown provider '${provider}'. Registered: ${this.registry.names().join(", ")}.`,
        );
      }
      override = this.registry.get(provider);
    }

    const researcher = this.agentFactory.create({
      role: "Researcher",
      goal: `Research ${topic}`,
      backstory: "You find practical, source-grounded technical details.",
      ...(override ? { llm: override } : {}),
    });
    const writer = this.agentFactory.create({
      role: "Writer",
      goal: `Turn research about ${topic} into a short implementation brief`,
      backstory: "You write concise engineering notes for busy backend teams.",
      ...(override ? { llm: override } : {}),
    });

    const task = new Task({
      description: `Research "${topic}" and produce a SHORT (<= 120 words) NestJS implementation brief.`,
      expectedOutput: "A concise implementation brief with risks and next steps.",
      agent: writer,
    });

    // When no override is given, agents fall back to the LLM token (llms.default).
    const crew = this.crewFactory.create({ agents: [researcher, writer], tasks: [task] });
    const result = await crew.kickoff({ inputs: { topic } });

    return {
      provider: provider ?? this.config.resolvedDefaultProvider(),
      topic,
      output: result.raw,
    };
  }
}
