# Changelog

All notable changes to `@crewai-ts/nestjs` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## 0.3.0 (Unreleased)

### Added

- **`LlmRegistryService`**: Named LLM registry backed by `Map<name, LLM>`. Resolves string names, LLM instances, and LLMClient objects uniformly. `llms.default` is the reserved key for the default LLM.
- **`LlmRouterService`**: 4 strategies for routing LLM calls:
  - `round-robin`: atomic counter on `SharedArrayBuffer` (concurrency-safe)
  - `fallback`: always returns the first registered LLM
  - `race`: deterministic first-by-index picker
  - `weighted`: equal-weight random spread picker
  - `use(strategy)` plugs a custom strategy
- **`EventBusService`**: Nest-friendly facade over `crewaiEventBus` with `on/off/emit/destroy`. `destroy()` only removes handlers THIS service registered; direct `crewaiEventBus.on()` handlers are preserved.
- **`AgentProvider`**: Abstract class + `AgentProviderClass({role})` HOF for class-based Agent registration via DI. `AgentRegistryService` resolves by role (AgentFactory returns the registered Agent by identity).
- **6 new tokens**: `LLM_REGISTRY`, `LLM_ROUTER`, `PLANNING_LLM`, `FUNCTION_CALLING_LLM`, `EVENT_BUS`, `AGENT_REGISTRY`.
- **`CrewModule.forRoot` / `forRootAsync` extended** with: `llms`, `llmProviders`, `planningLlm`, `functionCallingLlm`, `planning`, `verbose`, `cache`, `llmRouter`.
- **`AgentFactory.create` extended** with `planningLlm`, `functionCallingLlm`, `tools`; resolves `llm` from the registry by name (4 LLM resolution forms).
- **`DefaultCrewFactory.create` extended** with `planning`, `verbose`, `cache`, `planningLlm`, `functionCallingLlm`, `tools`.
- **Coverage tooling**: `@vitest/coverage-v8` + `test:coverage` script. 80% threshold baseline on new code.

### Changed

- `AgentFactory.create({llm})` and `CrewModuleOptions.llm` marked `@deprecated` with `process.emitWarning(..., "DeprecationWarning")`. `llms.default` is the recommended replacement. Removal planned for v1.0.0.
- Peer dependency on `@crewai-ts/core` bumped from `^0.2.0` to `^0.3.0`.

### Removed

- `NESTJS_PACKAGE_VERSION` constant (drift bug; source of truth = `package.json`).
- `scaffold.test.ts` (only tested the drift constant).
