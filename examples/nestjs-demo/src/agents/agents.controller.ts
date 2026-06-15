import { Controller, Get, Inject, Param } from "@nestjs/common";
import { AgentFactory, AgentRegistryService } from "@crewai-ts/nestjs";

/**
 * Demonstrates `AGENT_REGISTRY` / `AgentRegistryService` + `AgentProvider`:
 * a role registered by {@link AgentRegistrar} is returned by identity from
 * `AgentFactory.create({ role })`.
 */
@Controller("agents")
export class AgentsController {
  constructor(
    @Inject(AgentFactory) private readonly agentFactory: AgentFactory,
    @Inject(AgentRegistryService) private readonly registry: AgentRegistryService,
  ) {}

  /** GET /agents → roles currently in the registry. */
  @Get()
  list() {
    return { roles: this.registry.roles() };
  }

  /**
   * GET /agents/:role → build an agent for a role. For a registered role the
   * factory returns the SAME pre-built instance (goal/backstory args ignored).
   */
  @Get(":role")
  get(@Param("role") role: string) {
    const fromRegistry = this.registry.has(role);
    const agent = this.agentFactory.create({
      role,
      goal: "(ignored when role is pre-registered)",
      backstory: "(ignored when role is pre-registered)",
    });
    return {
      role: agent.role,
      goal: agent.goal,
      servedFromRegistry: fromRegistry,
    };
  }
}
