import { Module } from "@nestjs/common";
import { CrewModule } from "@crewai-ts/nestjs";
import { LlmConfigModule } from "./llm/llm-config.module.js";
import { LlmConfigService } from "./llm/llm-config.service.js";
import { ResearchController } from "./research/research.controller.js";
import { ResearchService } from "./research/research.service.js";
import { RegistryController } from "./registry/registry.controller.js";
import { RouterController } from "./router/router.controller.js";
import { EventsController } from "./events/events.controller.js";
import { EventsService } from "./events/events.service.js";
import { AgentsController } from "./agents/agents.controller.js";
import { ResearcherProvider } from "./agents/researcher.provider.js";
import { AgentRegistrar } from "./agents/agent-registrar.js";
import { RuntimeController } from "./runtime/runtime.controller.js";

/**
 * Wires `CrewModule.forRootAsync` from {@link LlmConfigService} (env-driven,
 * live-only) and mounts one controller per helper area.
 *
 * `CrewModule` exports every factory/service/token, so the controllers and
 * services below can inject `AgentFactory`, `CREW_FACTORY`, `LLM_REGISTRY`,
 * `LlmRouterService`, `EventBusService`, `AgentRegistryService`, and the
 * `LLM`/`MEMORY`/`KNOWLEDGE`/`PLANNING_LLM`/`FUNCTION_CALLING_LLM` tokens.
 */
@Module({
  imports: [
    LlmConfigModule,
    CrewModule.forRootAsync({
      imports: [LlmConfigModule],
      inject: [LlmConfigService],
      useFactory: (config: LlmConfigService) => config.buildCrewModuleOptions(),
    }),
  ],
  controllers: [
    ResearchController,
    RegistryController,
    RouterController,
    EventsController,
    AgentsController,
    RuntimeController,
  ],
  providers: [ResearchService, EventsService, ResearcherProvider, AgentRegistrar],
})
export class AppModule {}
