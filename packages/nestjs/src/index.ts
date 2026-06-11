// Public API of @crewai-ts/nestjs v0.3.0.
// v0.2.x: 4 tokens (CREW_FACTORY, LLM, MEMORY, KNOWLEDGE) + 2 factories (AgentFactory, DefaultCrewFactory) + CrewModule.
// v0.3.0: +6 tokens (LLM_REGISTRY, LLM_ROUTER, PLANNING_LLM, FUNCTION_CALLING_LLM, EVENT_BUS, AGENT_REGISTRY)
//         +4 services (LlmRegistryService, LlmRouterService, EventBusService, AgentRegistryService)
//         +AgentProvider abstract + AgentProviderClass HOF

// v0.2.x tokens
export {
  CREW_FACTORY,
  LLM,
  MEMORY,
  KNOWLEDGE,
  // v0.3.0 tokens
  LLM_REGISTRY,
  LLM_ROUTER,
  PLANNING_LLM,
  FUNCTION_CALLING_LLM,
  EVENT_BUS,
  AGENT_REGISTRY,
  type CrewFactoryToken,
  type LLMToken,
  type MemoryToken,
  type KnowledgeToken,
  type LlmRegistryToken,
  type LlmRouterToken,
  type PlanningLlmToken,
  type FunctionCallingLlmToken,
  type EventBusToken,
  type AgentRegistryToken,
  type LLMSupply,
  type MemorySupply,
  type KnowledgeSupply,
  type RouterStrategy,
  type LlmProviderName,
  type CrewFactory,
} from "./tokens.js";

// CrewModule
export {
  CrewModule,
  type CrewModuleOptions,
  type CrewModuleAsyncOptions,
} from "./crew-module.js";

// v0.2.x factories
export { DefaultCrewFactory } from "./factories/crew-factory.js";
export { AgentFactory } from "./factories/agent-factory.js";

// v0.3.0 services
export { LlmRegistryService } from "./registry/llm-registry.js";
export {
  LlmRouterService,
  type RouterStrategyFn,
} from "./registry/llm-router.js";
export { EventBusService } from "./event-bus/event-bus.service.js";
export {
  AgentProvider,
  AgentProviderClass,
  type AgentProviderOptions,
} from "./agents/agent-provider.js";
export { AgentRegistryService } from "./agents/agent-registry.js";
