import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { AgentRegistryService } from "@crewai-ts/nestjs";
import { ResearcherProvider } from "./researcher.provider.js";

/**
 * Registers class-based `AgentProvider`s into the `AGENT_REGISTRY` at startup.
 * Once registered, `AgentFactory.create({ role: "researcher" })` short-circuits
 * to the pre-built Agent (by identity) instead of constructing a new one.
 */
@Injectable()
export class AgentRegistrar implements OnModuleInit {
  private readonly logger = new Logger(AgentRegistrar.name);

  constructor(
    @Inject(ResearcherProvider) private readonly researcher: ResearcherProvider,
    @Inject(AgentRegistryService) private readonly registry: AgentRegistryService,
  ) {}

  onModuleInit(): void {
    if (!this.registry.has("researcher")) {
      this.registry.register("researcher", this.researcher.provide());
      this.logger.log("Registered pre-built agent under role 'researcher'.");
    }
  }
}
