import type { Agent } from "@crewai-ts/core";

/**
 * Abstract base class for class-based Agent providers.
 *
 * Use this to register pre-built Agent instances via Nest DI. Agents can
 * inject other Nest providers (HTTP services, databases, etc.) into their
 * constructor and return a fully-constructed Agent from `provide()`.
 *
 * Example:
 *   class ResearcherProvider extends AgentProvider {
 *     constructor(private readonly config: ResearcherConfig) {
 *       super();
 *     }
 *     provide(): Agent {
 *       return new Agent({ role: "researcher", goal: this.config.goal, ... });
 *     }
 *   }
 */
export abstract class AgentProvider<TAgent extends Agent = Agent> {
  abstract provide(): TAgent;
}

export interface AgentProviderOptions {
  /** The role name this provider produces. Used to register against the AgentRegistryService. */
  role: string;
}

/**
 * Higher-order function that returns a Nest-injectable class derived from
 * `AgentProvider` with `role` baked in. The class is registered in the
 * AgentRegistryService under that role on first instantiation.
 */
export function AgentProviderClass<TAgent extends Agent = Agent>(
  options: AgentProviderOptions,
): new (...args: never[]) => AgentProvider<TAgent> {
  class BoundProvider extends AgentProvider<TAgent> {
    provide(): TAgent {
      // Subclass override; this base provides the contract surface only.
      throw new Error(`AgentProvider.provide() must be implemented (role: ${options.role})`);
    }
  }
  // Attach role as static metadata so the AgentRegistryService can read it.
  (BoundProvider as unknown as { __agentRole: string }).__agentRole = options.role;
  return BoundProvider;
}

/**
 * Read the role metadata attached by `AgentProviderClass()`.
 * Returns `undefined` if the class was not produced by `AgentProviderClass()`.
 */
export function getAgentRole(
  providerClass: new (...args: never[]) => AgentProvider,
): string | undefined {
  return (providerClass as unknown as { __agentRole?: string }).__agentRole;
}
