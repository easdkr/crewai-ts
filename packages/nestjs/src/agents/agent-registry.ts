import { Injectable } from "@nestjs/common";
import type { Agent } from "@crewai-ts/core";

/**
 * Role-keyed registry of pre-built Agent instances.
 *
 * Consumed by `AgentFactory.create({role})` — if a role is registered, the
 * pre-built Agent is returned (skipping `new Agent({...})`). This is the
 * v0.3.0 mechanism for class-based Agent registration via Nest DI.
 *
 * The class deliberately has no constructor: the `AGENT_REGISTRY` symbol
 * token is bound to the SAME instance via `useExisting: AgentRegistryService`
 * in `CrewModule` (and in tests). Injecting the token into this service's
 * own constructor would create a Nest circular dependency — Nest would try
 * to resolve the token while instantiating the class the token points to.
 */
@Injectable()
export class AgentRegistryService {
  private readonly map = new Map<string, Agent>();

  register(role: string, agent: Agent): this {
    this.map.set(role, agent);
    return this;
  }

  get(role: string): Agent {
    if (!this.map.has(role)) {
      throw new Error(
        `Unknown agent role: '${role}'. Registered: ${this.roles().join(", ")}`,
      );
    }
    return this.map.get(role) as Agent;
  }

  has(role: string): boolean {
    return this.map.has(role);
  }

  roles(): readonly string[] {
    return Array.from(this.map.keys());
  }
}
