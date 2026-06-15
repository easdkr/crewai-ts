import { Inject, Injectable } from "@nestjs/common";
import { Agent } from "@crewai-ts/core";
import { AgentProvider } from "@crewai-ts/nestjs";
import { LlmConfigService } from "../llm/llm-config.service.js";

/**
 * Class-based Agent provider (extends `AgentProvider`). It injects other Nest
 * providers (here, {@link LlmConfigService}) and returns a fully-built `Agent`
 * from `provide()`. {@link AgentRegistrar} registers the result under a role so
 * `AgentFactory.create({ role })` returns it by identity.
 */
@Injectable()
export class ResearcherProvider extends AgentProvider {
  constructor(@Inject(LlmConfigService) private readonly config: LlmConfigService) {
    super();
  }

  provide(): Agent {
    const llm = this.config.clientFor(this.config.resolvedDefaultProvider());
    return new Agent({
      role: "researcher",
      goal: "Research topics and surface source-grounded technical detail.",
      backstory: "A meticulous researcher who cites concrete specifics.",
      llm: llm as never,
    });
  }
}
