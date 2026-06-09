# Goal: Split CrewAI TS Into Lightweight Packages

## Objective

Refactor the current monolithic `@crewai-ts/core` package into smaller packages
that can be installed independently, with provider packages named in the
`@crewai-ts/<provider-or-feature>` pattern.

This goal is allowed to introduce breaking changes. Do not preserve the current
`@crewai-ts/core` umbrella API if preserving it keeps Lambda users pulling in
unused providers, RAG/PDF parsing, MCP, A2A, Flow, or other optional surfaces.

The new `@crewai-ts/core` should become the small core contract package. Do not
introduce a second base package for this layer; use `@crewai-ts/core` for the
minimal execution core and public contracts.

## Target Package Shape

Create or reshape the workspace around these package boundaries:

- `@crewai-ts/core`: minimal core execution and contracts.
  - Agent, Crew, Task, Process, tool abstractions, LLM interfaces, provider
    registry hooks, message types, shared errors, shared utilities needed by
    the minimal execution path.
  - Must not depend on RAG/PDF, MCP, A2A/A2UI, Flow visualization/persistence,
    provider-specific HTTP clients, or optional platform integrations.
- `@crewai-ts/gemini`: Gemini native provider.
  - GeminiCompletion, Gemini model constants, Gemini request/response
    formatting, Gemini tool-call loop, Gemini structured output helpers, and
    Gemini provider registration.
  - Must depend on `@crewai-ts/core`, not the other way around.
- `@crewai-ts/openai`: OpenAI and OpenAI-compatible native provider pieces.
- `@crewai-ts/anthropic`: Anthropic native provider pieces.
- `@crewai-ts/bedrock`: AWS Bedrock native provider pieces.
- `@crewai-ts/azure`: Azure OpenAI native provider pieces.
- `@crewai-ts/mcp`: MCP tool integration and `@modelcontextprotocol/sdk`
  dependency.
- `@crewai-ts/rag`: Knowledge, Memory, RAG, file ingestion, PDF parsing, and
  `pdf-parse` dependency.
- `@crewai-ts/a2a`: A2A and A2UI protocol support.
- `@crewai-ts/flow`: Flow orchestration, persistence, and visualization.
- `@crewai-ts/nestjs`: NestJS integration, updated to depend on the new package
  boundaries.
- `@crewai-ts/cli`: CLI package, updated to install and import only the packages
  it actually needs.

If implementation evidence shows one of these boundaries is wrong, adjust it,
but keep the principle: provider/feature packages depend inward on
`@crewai-ts/core`; `@crewai-ts/core` must not depend outward on providers or
optional features.

## Non-Negotiables

- Breaking changes are acceptable in this goal.
- Do not keep `@crewai-ts/core` as an umbrella facade if doing so keeps the
  Lambda import/install path heavy.
- Do not create a second base package; the lightweight execution core and
  contract package is `@crewai-ts/core`.
- `@crewai-ts/gemini` must be usable without installing MCP, RAG, PDF parsing,
  A2A/A2UI, Flow, Bedrock, Anthropic, Azure, or OpenAI provider packages.
- Provider packages must not import from the old monolithic barrel.
- Subpath exports must point at real package-specific build entries, not all
  back to `dist/index.js`.
- Avoid circular dependencies between packages.
- Keep Node target and TypeScript module style consistent with the existing
  workspace unless there is a concrete reason to change it.
- Keep tests deterministic. Do not require live provider credentials in the
  default test gate.

## Starting Context

Current problems to fix:

- `@crewai-ts/core` is published as a broad package with many subpath exports.
- Most subpath exports, including `@crewai-ts/core/llm`, currently point to the
  same `dist/index.js` barrel.
- A user who only wants Gemini still pulls in the monolithic core surface.
- `@crewai-ts/core` currently depends on packages that belong to optional
  feature packages, notably `@modelcontextprotocol/sdk`, `pdf-parse`, and
  `yaml`.
- `provider-completions.ts` currently mixes several providers in one module,
  so Gemini cannot be imported independently.

## Execution Plan

### 1. Baseline and Dependency Map

Definition of done:

- Record the current package graph, build config, exports map, and dependency
  reasons.
- Identify the smallest set of symbols needed by `Agent`, `Crew`, `Task`, tools,
  and LLM provider registration.
- Identify all symbols used by Gemini and classify them as:
  - core contract,
  - Gemini-specific,
  - shared provider utility,
  - unrelated optional feature.
- Save findings in `.omo/plans/package-split.md` or a similarly named plan file.

Suggested checks:

```bash
pnpm -r build
pnpm -r test
npm pack --dry-run --json
```

### 2. Reshape `@crewai-ts/core`

Definition of done:

- Move or keep only the minimal core contracts and execution path in
  `packages/core`.
- Remove direct dependencies on MCP SDK, PDF parsing, RAG-only utilities, A2A,
  Flow, and provider-specific implementation code.
- Ensure `@crewai-ts/core` exports real core entry points only.
- Ensure `@crewai-ts/core` can build and import without provider packages.

Core should own:

- `Agent`, `Crew`, `Task`, `Process`, base execution types.
- `LLM`, `LLMClient`, `ConfiguredLLM` only if they are provider-neutral.
- Provider registry interfaces and registration functions.
- Tool abstractions and schema conversion only when required by the core
  execution path.
- Shared message, output, context, error, and utility types needed by core.

Core should not own:

- `GeminiCompletion`, `OpenAICompletion`, `AnthropicCompletion`,
  `BedrockCompletion`, Azure provider implementations, or Snowflake provider
  implementations.
- MCP client implementations.
- RAG/Knowledge/Memory implementations that require file parsing or vector-like
  storage.
- A2A/A2UI protocol implementations.
- Flow orchestration, visualization, persistence, or optional storage adapters.

## Current Progress

### Completed in this slice

- Added `packages/gemini` as `@crewai-ts/gemini`.
- Moved the Gemini native provider implementation out of
  `packages/core/src/provider-completions.ts`.
- Removed `GeminiCompletion` and `GeminiCompletionOptions` from the
  `@crewai-ts/core` root barrel.
- Added real `@crewai-ts/core/llm` and `@crewai-ts/core/types` build entries so
  provider packages do not need to import the old monolithic barrel.
- Added a Gemini import-boundary test that verifies package metadata does not
  include MCP, RAG/PDF, A2A, Flow, or other provider package dependencies.
- Added a Gemini registration test proving `registerGeminiProvider()` wires the
  provider into `createLLM("gemini/...")`.
- Added `packages/gemini/test/provider.test.ts` with provider-owned coverage for
  Gemini aliases, Vertex AI fetch transport, interceptor rejection,
  multimodal file formatting, usage extraction, structured output handling,
  response schema selection, stop sequence synchronization, streaming chunk
  accumulation, tool schema conversion, native tool-call loops, and Agent tool
  pass-through.
- Fixed the local Gemini tool schema normalizer so `StructuredTool.argsSchema`
  field maps are emitted as object JSON Schema instead of raw field maps.
- Removed direct `GeminiCompletion` references from the old monolithic core
  test file; Gemini-owned provider tests now live in `packages/gemini`.
- Moved Gemini model catalog ownership fully to `@crewai-ts/gemini`:
  `@crewai-ts/core` no longer exports `GEMINI_MODELS` or `GeminiModels`, no
  longer includes `MODELS.gemini`, and no longer carries Gemini-specific
  context window entries. Core still recognizes Gemini by provider alias and
  model prefix for provider-neutral routing.
- Added `packages/openai` as `@crewai-ts/openai` with OpenAI and
  OpenAI-compatible provider code copied into the new package boundary.
- Added real `@crewai-ts/core/schema-utils` build/export entry so provider
  packages can use provider-neutral schema helpers without importing the old
  monolithic core barrel.
- Added an OpenAI import-boundary test that verifies package metadata does not
  include MCP, RAG/PDF, A2A, Flow, Gemini, or other optional feature packages.
- Added an OpenAI registration test proving `registerOpenAIProvider()` wires
  `OpenAICompletion` and `OpenAICompatibleCompletion` into `createLLM(...)`.
- Removed `OpenAICompletion`, `OpenAICompatibleCompletion`,
  `OPENAI_COMPATIBLE_PROVIDERS`, and `ResponsesAPIResult` from the
  `@crewai-ts/core` root barrel.
- Removed OpenAI/OpenAI-compatible provider auto-registration from
  `@crewai-ts/core`; native OpenAI routing now requires
  `@crewai-ts/openai` and an explicit `registerOpenAIProvider()` call.
- Updated the core `create_llm` contract test so unregistered OpenAI and
  OpenAI-compatible models resolve to provider-neutral `ConfiguredLLM` clients.
- Added `packages/snowflake` as `@crewai-ts/snowflake` with the Snowflake Cortex
  native provider moved out of `@crewai-ts/core`.
- Removed `SnowflakeCompletion`, `SnowflakeCompletionOptions`,
  `SNOWFLAKE_CORTEX_PATH`, and `SNOWFLAKE_TOKEN_ENV_VARS` from the
  `@crewai-ts/core` root barrel.
- Removed Snowflake provider auto-registration and source implementation from
  `packages/core/src/provider-completions.ts`; native Snowflake routing now
  requires `@crewai-ts/snowflake` and an explicit `registerSnowflakeProvider()`
  call.
- Added Snowflake import-boundary and provider tests covering package
  dependencies, explicit registration, credential/base URL normalization,
  Claude tool-result history guards, fetch transport behavior, and usage
  accounting.
- Added `packages/azure` as `@crewai-ts/azure` with the Azure OpenAI native
  provider moved out of `@crewai-ts/core`.
- Removed `AzureCompletion`, `AzureCompletionParams`, and
  `AzureCompletionOptions` from the `@crewai-ts/core` root barrel.
- Removed Azure provider auto-registration and source implementation from
  `packages/core/src/provider-completions.ts`; native Azure routing now
  requires `@crewai-ts/azure` and an explicit `registerAzureProvider()` call.
- Added Azure import-boundary and provider tests covering package dependencies,
  explicit registration, alias handling, env credential scopes, fetch transport,
  completion parameter preparation, tool schema conversion, and Responses API
  delegation through `@crewai-ts/openai`.
- Excluded the legacy OpenAI provider source file from the `@crewai-ts/core`
  declaration build so stale provider declarations are not published from core.
- Added `packages/anthropic` as `@crewai-ts/anthropic` with the Anthropic
  native provider moved out of the `@crewai-ts/core` root surface.
- Removed `AnthropicCompletion`, Anthropic thinking/tool-search config exports,
  Anthropic beta constants, and Anthropic provider auto-registration from the
  published `@crewai-ts/core` build.
- Added Anthropic import-boundary and provider tests covering package
  dependencies, explicit registration, `claude` alias routing, request
  parameter preparation, Messages API fetch transport, structured output tool
  forcing, multimodal message formatting, and tool-use extraction.
- Added `packages/bedrock` as `@crewai-ts/bedrock` with the Bedrock native
  provider moved out of the `@crewai-ts/core` root surface.
- Removed `BedrockCompletion`, Bedrock Converse helper marker exports, and
  Bedrock provider auto-registration from the published `@crewai-ts/core`
  build.
- Added Bedrock import-boundary and provider tests covering package
  dependencies, explicit registration, `aws` alias routing, Converse request
  preparation, grouped tool-result formatting, tool execution follow-up
  messages, token usage extraction, structured output extraction, and stream
  accumulation.
- Excluded the legacy `provider-completions.ts` source file from the
  `@crewai-ts/core` declaration build so stale Anthropic/Bedrock provider
  declarations are not published from core.
- Added `packages/mcp` as `@crewai-ts/mcp` with the MCP client, transports,
  filters, resolver, native tool wrapper, and `@modelcontextprotocol/sdk`
  dependency moved out of `@crewai-ts/core`.
- Removed the `./mcp` export, MCP implementation exports, MCP tool wrappers,
  and the direct `@modelcontextprotocol/sdk` dependency from
  `@crewai-ts/core`.
- Removed `packages/core/src/mcp.ts` so the MCP SDK-backed implementation is no
  longer part of the core source tree.
- Added real `@crewai-ts/core/events` and `@crewai-ts/core/tools` build/export
  entries so feature packages can import provider-neutral contracts without
  reaching through the old root barrel.
- Updated the core pack-smoke contract so MCP deep imports are no longer treated
  as core public API.
- Moved focused MCP implementation coverage to `packages/mcp/test`, while
  keeping MCP lifecycle event coverage in core because those event contracts
  are still shared by the event bus.
- Added `packages/rag` as `@crewai-ts/rag` with RAG factories, Knowledge
  sources, Memory, memory tools, and `pdf-parse` dependency owned by the new
  package.
- Removed the direct `pdf-parse` dependency from `@crewai-ts/core`.
- Removed `./rag`, `./knowledge`, `./memory`, and matching wildcard subpath
  exports from `@crewai-ts/core`.
- Removed Knowledge, Memory, and RAG implementation exports from the
  `@crewai-ts/core` root barrel; users now import these from `@crewai-ts/rag`.
- Updated the core pack-smoke contract and subpath manifest so old RAG, MCP,
  and provider deep imports are no longer treated as core public API.
- Cut the Agent/Crew/LiteAgent/Task/Project direct RAG implementation
  dependency by extending `@crewai-ts/core/feature-hooks` with package-neutral
  Memory/Knowledge contracts and optional factories.
- `@crewai-ts/rag` now registers Memory, Knowledge, memory tools, and memory
  view binding hooks when the package root is imported.
- Moved representative legacy RAG/Memory core integration coverage into
  `packages/rag/test/core-integration.test.ts`, including core hook
  registration, Agent knowledge creation, Crew memory reset, Knowledge reset
  helpers, LiteAgent `memory: true`, and Crew memory tool injection.
- Excluded transitional core RAG/Knowledge/Memory source files from the core
  declaration build; they remain in the source tree for now, but are no longer
  public core exports, package subpaths, emitted declarations, or the core root
  bundle path.
- Added `packages/a2a` as `@crewai-ts/a2a` with A2A and A2UI protocol support
  owned by the new feature package.
- Removed `./a2a` and `./a2a/*` package export subpaths from
  `@crewai-ts/core`.
- Removed A2A and A2UI implementation exports from the `@crewai-ts/core` root
  barrel; users now import these from `@crewai-ts/a2a`.
- Added real `@crewai-ts/core/auth` and
  `@crewai-ts/core/experimental/conversational` build/export entries so A2A can
  depend on small core contracts without importing the old root barrel.
- Updated the core pack-smoke contract and subpath manifest so old A2A deep
  imports are no longer treated as core public API.
- Cut the Agent/LiteAgent direct A2A implementation dependency by adding
  `@crewai-ts/core/feature-hooks`. `@crewai-ts/a2a` now registers A2A behavior
  into core explicitly when that package is imported.
- Moved representative legacy A2A/A2UI core integration coverage into
  `packages/a2a/test/core-integration.test.ts`, including A2UI validation,
  Agent server-card hook registration, A2A agent-card generation, transport
  config/negotiation, JSON-RPC error/template helpers, and LiteAgent A2A hook
  registration.
- Excluded transitional A2A/A2UI source files from the core declaration build;
  they remain in the source tree for now, but are no longer public core exports,
  package subpaths, or the Agent/LiteAgent bundle path.
- Added `packages/flow` as `@crewai-ts/flow` with Flow orchestration,
  conversation helpers, persistence, input-provider helpers, and visualization
  owned by the new feature package.
- Removed `./flow` and `./flow/*` package export subpaths from
  `@crewai-ts/core`.
- Removed Flow implementation exports from the `@crewai-ts/core` root barrel;
  users now import these from `@crewai-ts/flow`.
- Added real `@crewai-ts/flow/flow/dsl/*` build/export entries for Flow DSL
  compatibility paths, so those paths no longer require the old core umbrella.
- Moved representative legacy Flow core integration coverage into
  `packages/flow/test/core-integration.test.ts`, including Flow DSL execution,
  FlowDefinition serialization/validation, structure extraction, visualization
  output, direct kickoff inputs, conversational turn helpers, stream-enabled
  Flow output, crew-backed Flow streaming, conversational agent-result
  visibility, default conversational Flow state creation, conversational route
  catalog generation, router LLM turn routing, invalid-route fallback,
  conversational chat guardrails, builtin conversational graph routing,
  kickoff/chat loop helpers, chat output stringification, session finish-event
  deferral, trace-finalization configuration, builtin end-route handling,
  answer-from-history turns, router response-format inference, automatic router
  enablement, conversational start ordering, overridden start registration,
  repeated turn execution, default-intent router bypass, and conversational data
  shapes.
- Kept the transitional core Flow source files for now because some legacy
  internal utilities and tests still reference the old source tree. They are no
  longer public core exports, package subpaths, or emitted core declaration
  files.
- Removed the last direct install dependency from `@crewai-ts/core` package
  metadata. YAML parsing in legacy project/skills helpers now uses a lazy
  optional loader instead of a static `yaml` import, while `@crewai-ts/flow`
  owns its explicit `yaml` dependency.
- Added a build-integrity guardrail asserting that `@crewai-ts/core` declares
  no direct install dependencies.
- Added build-integrity guardrails asserting that core entry-path source files
  do not import `./memory.js`, `./knowledge.js`, or `./rag.js`, and that built
  root artifacts do not embed optional RAG implementation symbols.
- Removed the core `InputProvider` type dependency on Flow by making the
  optional Flow-facing parameter package-neutral.

### Verified in this slice

- `pnpm -F @crewai-ts/core build`
- `pnpm -F @crewai-ts/gemini check`
- `pnpm -F @crewai-ts/gemini test`
- `pnpm -F @crewai-ts/gemini build`
- `pnpm -F @crewai-ts/gemini smoke:pack`
- `pnpm -F @crewai-ts/openai check`
- `pnpm -F @crewai-ts/openai build`
- `pnpm -F @crewai-ts/openai test`
- `pnpm -F @crewai-ts/openai smoke:pack`
- `pnpm -F @crewai-ts/snowflake check`
- `pnpm -F @crewai-ts/snowflake test`
- `pnpm -F @crewai-ts/snowflake build`
- `pnpm -F @crewai-ts/snowflake smoke:pack`
- `pnpm -F @crewai-ts/azure check`
- `pnpm -F @crewai-ts/azure test`
- `pnpm -F @crewai-ts/azure build`
- `pnpm -F @crewai-ts/azure smoke:pack`
- `pnpm -F @crewai-ts/anthropic check`
- `pnpm -F @crewai-ts/anthropic test`
- `pnpm -F @crewai-ts/anthropic build`
- `pnpm -F @crewai-ts/anthropic smoke:pack`
- `pnpm -F @crewai-ts/bedrock check`
- `pnpm -F @crewai-ts/bedrock test`
- `pnpm -F @crewai-ts/bedrock build`
- `pnpm -F @crewai-ts/bedrock smoke:pack`
- `pnpm -F @crewai-ts/mcp check`
- `pnpm -F @crewai-ts/mcp test`
- `pnpm -F @crewai-ts/mcp build`
- `pnpm -F @crewai-ts/mcp smoke:pack`
- `pnpm -F @crewai-ts/rag check`
- `pnpm -F @crewai-ts/rag test`
- `pnpm -F @crewai-ts/rag build`
- `pnpm -F @crewai-ts/rag smoke:pack`
- `pnpm -F @crewai-ts/a2a check`
- `pnpm -F @crewai-ts/a2a test`
- `pnpm -F @crewai-ts/a2a build`
- `pnpm -F @crewai-ts/a2a smoke:pack`
- `pnpm -F @crewai-ts/flow check`
- `pnpm -F @crewai-ts/flow test`
- `pnpm -F @crewai-ts/flow build`
- `pnpm -F @crewai-ts/flow smoke:pack`
- `pnpm -F @crewai-ts/core test -- test/build-integrity.test.ts`
- `pnpm -F @crewai-ts/core smoke:pack`
- `pnpm -r build`
- `pnpm -r check`
- `pnpm -r test`
  - Core's old monolithic `packages/core/test/index.test.ts` has been removed
    instead of staying as an excluded stale umbrella-contract test.
  - `@crewai-ts/rag` now runs 11 tests across import-boundary and core
    integration coverage.
- Dist import smoke:
  - `@crewai-ts/core` package metadata now declares no direct install
    dependencies.
  - `@crewai-ts/core` no longer exports `GeminiCompletion`.
  - `@crewai-ts/core` no longer exports `GEMINI_MODELS` or `GeminiModels`, and
    `@crewai-ts/core/llm` no longer exposes `MODELS.gemini`.
  - `@crewai-ts/gemini` exports `GeminiCompletion` and
    `registerGeminiProvider`.
  - `@crewai-ts/gemini` exports `GEMINI_MODELS`; current catalog count is 61.
  - `@crewai-ts/openai` exports `OpenAICompletion` and
    `registerOpenAIProvider`.
  - `@crewai-ts/core` no longer exports `OpenAICompletion`,
    `OpenAICompatibleCompletion`, or `OPENAI_COMPATIBLE_PROVIDERS`.
  - Before `registerOpenAIProvider()`, `createLLM("gpt-4o")` returns
    `ConfiguredLLM`; after registration, it returns the OpenAI package provider.
  - `@crewai-ts/core` no longer exports `SnowflakeCompletion` or
    `SNOWFLAKE_CORTEX_PATH`.
  - `@crewai-ts/snowflake` exports `SnowflakeCompletion` and
    `registerSnowflakeProvider`.
  - `@crewai-ts/core` no longer exports `AzureCompletion`.
  - Before `registerAzureProvider()`, `createLLM("azure/gpt-4o")` returns
    `ConfiguredLLM`; after registration, it returns the Azure package provider.
  - `@crewai-ts/azure` exports `AzureCompletion` and `registerAzureProvider`.
  - `@crewai-ts/core` no longer exports `AnthropicCompletion` or
    `BedrockCompletion`.
  - Before `registerAnthropicProvider()` and `registerBedrockProvider()`,
    `createLLM("anthropic/...")` and `createLLM("bedrock/...")` return
    `ConfiguredLLM`; after registration, they return the provider package
    classes.
  - `@crewai-ts/anthropic` exports `AnthropicCompletion` and
    `registerAnthropicProvider`.
  - `@crewai-ts/bedrock` exports `BedrockCompletion` and
    `registerBedrockProvider`.
  - `@crewai-ts/core` no longer exports `MCPClient`, `MCPToolResolver`, or
    `MCPNativeTool`.
  - `@crewai-ts/mcp` exports `MCPClient`, `MCPToolResolver`, and
    `MCPNativeTool`.
  - `@crewai-ts/core` no longer declares `pdf-parse` as a dependency.
  - `@crewai-ts/core` no longer exports `Knowledge`, `Memory`, or
    `createRagClient` from the root barrel.
  - `@crewai-ts/core` no longer exposes `./rag`, `./knowledge`, or `./memory`
    package export subpaths.
  - `@crewai-ts/rag` declares `pdf-parse` and exports `Knowledge`, `Memory`,
    `PDFKnowledgeSource`, and `createRagClient`.
  - Importing `@crewai-ts/rag` registers optional Memory/Knowledge hooks with
    core; `createRegisteredMemory()` returns a RAG `Memory` instance and
    `createRegisteredMemoryTools(...)` returns the package-owned memory tools.
  - `@crewai-ts/core` no longer exports `A2AConfig` or `A2UIMessage` from the
    root barrel.
  - `@crewai-ts/core` no longer exposes `./a2a` or `./a2a/*` package export
    subpaths.
  - `@crewai-ts/core` now exposes only the package-neutral
    `@crewai-ts/core/feature-hooks` hook point for optional A2A registration.
  - Importing `@crewai-ts/a2a` registers the optional hook, and an Agent created
    with `A2AServerConfig` receives `toAgentCard`/`to_agent_card`.
  - `@crewai-ts/a2a` exports `A2AConfig`, `A2AServerConfig`, `A2UIMessage`,
    `A2UIServerExtension`, and `validate_a2ui_message`.
  - `@crewai-ts/a2a` declares only `@crewai-ts/core` as a workspace dependency.
  - `@crewai-ts/a2a` now runs 9 tests across package-boundary and core
    integration coverage.
  - `@crewai-ts/core` no longer exports `Flow`, `start`, `listen`, or `router`
    from the root barrel.
  - `@crewai-ts/core` no longer exposes `./flow` or `./flow/*` package export
    subpaths.
  - `@crewai-ts/flow` exports `Flow`, `start`, `listen`, `router`,
    `FlowDefinition`, `SQLiteFlowPersistence`, and `renderInteractive`.
  - `@crewai-ts/flow` owns the `./flow/dsl/_conditions`,
    `./flow/dsl/_human_feedback`, `./flow/dsl/_listen`, `./flow/dsl/_router`,
    `./flow/dsl/_start`, `./flow/dsl/_types`, and `./flow/dsl/_utils` package
    export subpaths.
  - `@crewai-ts/flow` declares `@crewai-ts/core`, `@crewai-ts/rag`, and `yaml`
    as explicit dependencies.
  - `@crewai-ts/flow` now runs 32 tests across package-boundary and core
    integration coverage.
  - `packages/core/dist` no longer contains A2A/A2UI/Flow declaration files.
  - `packages/core/dist/index.js`, `packages/core/dist/index.d.ts`, and
    `packages/core/package.json` no longer contain A2A implementation symbols
    such as `A2AConfig`, `A2UIMessage`, `inject_a2a_server_methods`, or
    `wrap_agent_with_a2a_instance`.
  - `@crewai-ts/core/schema-utils` exports `generateModelDescription`.
  - `packages/core/dist` no longer contains provider-specific OpenAI, Azure,
    Snowflake, Gemini, Anthropic, or Bedrock declaration files.
  - `packages/core/dist` and `packages/core/package.json` no longer contain
    MCP SDK imports or MCP implementation symbols.
  - `packages/core/dist/index.js`, `packages/core/dist/index.d.ts`, and
    `packages/core/package.json` no longer contain RAG implementation symbols
    such as `class Memory`, `class Knowledge`, `RecallMemoryTool`,
    `buildEmbedder`, or `pdf-parse`.
  - `packages/core/dist` no longer contains `memory`, `knowledge`, or `rag`
    declaration or JavaScript entry files.
- Search smoke:
  - `GeminiCompletion` and `GeminiCompletionOptions` now appear only under
    `packages/gemini` in source and provider tests.
  - `GEMINI_MODELS` and `GeminiModels` now appear only under `packages/gemini`
    in source and provider tests.
  - `SnowflakeCompletion`, `SNOWFLAKE_CORTEX_PATH`, and
    `SNOWFLAKE_TOKEN_ENV_VARS` now appear only under `packages/snowflake` in
    source and provider tests.
  - `AzureCompletion`, `AzureCompletionParams`, and `AzureCompletionOptions`
    now appear only under `packages/azure` in source and provider tests.
  - MCP SDK-backed implementation symbols now appear under `packages/mcp`, not
    under `packages/core/src`, `packages/core/scripts`, or
    `packages/core/package.json`.
  - RAG package metadata owns `pdf-parse`; core package metadata does not.
  - Core entry-path source files no longer import `./memory.js`,
    `./knowledge.js`, or `./rag.js`.
- Representative RAG/Memory tests now live under `packages/rag/test` instead
    of relying on the old monolithic core test file.
  - Flow package metadata owns `yaml`; core package metadata does not.
  - Old `@crewai-ts/core/a2a` import checks no longer appear in the core
    pack-smoke contract, subpath manifest, package export map, or export
    snapshot.
- Representative A2A/A2UI tests now live under `packages/a2a/test` instead
  of relying on the old monolithic core test file.
- Deleted the transitional `packages/core/src/a2a.ts`,
  `packages/core/src/a2ui.ts`, and `packages/core/src/a2ui-schemas.ts` source
  files. A2A/A2UI implementation source now lives in `@crewai-ts/a2a`, and a
  core build-integrity guardrail prevents those optional implementation files
  from reappearing under `packages/core/src`.
- Deleted the transitional `packages/core/src/flow.ts`,
  `packages/core/src/flow-conversation.ts`, `packages/core/src/flow-definition.ts`,
  `packages/core/src/flow-persistence.ts`, and
  `packages/core/src/flow-visualization.ts` source files. Flow implementation
  source now lives in `@crewai-ts/flow`, and the core build-integrity guardrail
  covers those optional implementation files.
- Deleted the transitional `packages/core/src/rag.ts`,
  `packages/core/src/knowledge.ts`, and `packages/core/src/memory.ts` source
  files. RAG/Knowledge/Memory implementation source now lives in
  `@crewai-ts/rag`, and the core build-integrity guardrail covers those
  optional implementation files.
- Removed the remaining core `pdf-parse` dynamic import from `ReadFileTool`.
  Core now uses a package-neutral PDF text extraction hook and falls back to
  binary/base64 output when no optional extractor is registered. Importing
  `@crewai-ts/rag` registers its `pdf-parse`-backed extractor.
- Deleted the transitional `packages/core/src/openai-completion.ts` and
  `packages/core/src/provider-completions.ts` source files. Native provider
  implementation source now lives in the provider packages, and the core
  build-integrity guardrail covers those files so provider code does not return
  to `packages/core/src`.
- Old `@crewai-ts/core/flow` import checks no longer appear in the core
  pack-smoke contract, subpath manifest, package export map, or export
  snapshot.
- Old Flow DSL package entrypoint checks have moved from the core legacy test
  file to `packages/flow/test/import-boundary.test.ts`.
- Representative Flow tests now live under `packages/flow/test` instead of
  relying on the old monolithic core test file.
- Deleted the old monolithic `packages/core/test/index.test.ts` file and
  removed the matching Vitest exclusion. The remaining core test suite now runs
  through the normal default gate.
- Updated the root README so `@crewai-ts/core` is described as the lightweight
  execution core and contract package, not the old umbrella package for
  providers, RAG, MCP, A2A, or Flow.
- Added `docs/PACKAGE_SPLIT_MIGRATION.md` documenting the breaking package
  split, Gemini-only install path, provider registration pattern, and old
  `@crewai-ts/core` import replacements.
- Updated `docs/PORTING_REMAINING.md` so `ReadFileTool` PDF extraction is
  documented as a package-neutral core hook with `@crewai-ts/rag` owning
  `pdf-parse`.

### Final audit

- `@crewai-ts/core` still owns broad compatibility source for core concepts, but
  provider packages plus MCP, RAG, A2A, and Flow are no longer core public
  package surfaces or root bundle implementation paths.
- Package metadata audit confirms `@crewai-ts/core` declares no direct install
  dependencies.
- Package metadata audit confirms `@crewai-ts/gemini` depends only on
  `@crewai-ts/core` and does not depend on MCP, RAG/PDF, A2A/A2UI, Flow, or
  other provider packages.
- Search audit confirms deleted optional/provider implementation files are no
  longer present under `packages/core/src`.
- Migration documentation now covers the breaking package split and explicit
  package imports.
- Dist import smoke confirms a sample can import `Agent` from
  `@crewai-ts/core`, import `GeminiCompletion` and `registerGeminiProvider`
  from `@crewai-ts/gemini`, register Gemini, and instantiate an Agent without
  importing optional feature packages.
- Live provider smoke using locally configured credentials:
  - OpenAI passed with `OPENAI_API_KEY` and `gpt-4o-mini`.
  - Gemini passed with `GEMINI_API_KEY` and `gemini-2.5-flash`.
  - Anthropic passed with the local Claude API key and
    `claude-haiku-4-5-20251001`. The older `claude-3-5-haiku-20241022` model
    returned a provider API 404 for this key, and `/v1/models` confirmed the key
    has access to the newer 4.5 model family.
  - Bedrock passed through `AWS_PROFILE=wisely`, region `ap-northeast-2`, and
    an injected Converse client backed by the AWS CLI Bedrock Converse command.
  - Azure and Snowflake were not run because the required local endpoint/token
    environment variables are not configured.

### 3. Create `@crewai-ts/gemini`

Definition of done:

- Add `packages/gemini`.
- Move Gemini native provider code into this package.
- `@crewai-ts/gemini` depends on `@crewai-ts/core`.
- `@crewai-ts/gemini` does not depend on `@crewai-ts/core` barrel internals,
  MCP SDK, PDF parsing, RAG, A2A/A2UI, Flow, or other provider packages.
- Provide explicit exports for:
  - `GeminiCompletion`
  - `GeminiCompletionOptions`
  - Gemini model constants/types
  - `registerGeminiProvider` or an equivalent explicit registration function
  - a convenient factory if appropriate
- Add a smoke test proving a Gemini-only import works.

Example target usage:

```ts
import { Agent, Task, Crew } from "@crewai-ts/core";
import { GeminiCompletion, registerGeminiProvider } from "@crewai-ts/gemini";

registerGeminiProvider();

const llm = new GeminiCompletion({ model: "gemini-2.5-flash" });
```

### 4. Split Remaining Provider Packages

Definition of done:

- Create provider packages for OpenAI, Anthropic, Bedrock, and Azure.
- Move provider-specific request/response formatting, model constants, auth
  handling, and provider registration into the package that owns the provider.
- Shared provider-neutral utilities can stay in `@crewai-ts/core` only if they
  are genuinely provider-neutral and needed by more than one provider.
- If shared provider utility code becomes too large, create a private internal
  workspace package only if it reduces duplication without becoming a new
  monolith.

### 5. Split Optional Feature Packages

Definition of done:

- Move MCP code and `@modelcontextprotocol/sdk` to `@crewai-ts/mcp`.
- Move Knowledge, Memory, RAG, file ingestion, and `pdf-parse` to
  `@crewai-ts/rag`.
- Move A2A and A2UI code to `@crewai-ts/a2a`.
- Move Flow code to `@crewai-ts/flow`.
- Update imports across tests, examples, CLI, and NestJS package to use the new
  packages explicitly.

### 6. Update Exports, Builds, and Package Metadata

Definition of done:

- Each package has its own `package.json`, `tsconfig`, build config, and export
  map.
- Subpath exports point to package-specific generated files.
- Workspace scripts build and test the packages in dependency order.
- Package versions and peer dependencies reflect the breaking line.
- Remove dependency declarations from packages that no longer need them.
- `@crewai-ts/core` no longer publishes a broad compatibility barrel.

### 7. Tests and Smoke Coverage

Definition of done:

- Add tests proving lightweight imports stay lightweight.
- Add tests proving provider registration still works after package split.
- Add pack smoke checks for at least:
  - `@crewai-ts/core`
  - `@crewai-ts/gemini`
  - `@crewai-ts/rag`
  - `@crewai-ts/mcp`
- Add a regression check that `@crewai-ts/gemini` package metadata does not
  include `pdf-parse` or `@modelcontextprotocol/sdk`.
- Add an import smoke that imports `@crewai-ts/gemini` without importing
  `@crewai-ts/rag` or `@crewai-ts/mcp`.

Suggested commands:

```bash
pnpm -r build
pnpm -r test
pnpm -r check
pnpm -F @crewai-ts/core smoke:pack
pnpm -F @crewai-ts/gemini smoke:pack
```

If the exact scripts differ after the split, update the scripts and this file.

## Final Verification Gate

The goal is complete only when:

- `pnpm -r build` passes.
- `pnpm -r test` passes, or any remaining failures are proven pre-existing and
  documented with exact failing test names.
- `pnpm -r check` passes.
- `npm pack --dry-run --json` for `@crewai-ts/gemini` shows a small package that
  does not include or depend on MCP, RAG, PDF parsing, A2A/A2UI, Flow, or other
  provider packages.
- A sample project can import and instantiate Gemini using only
  `@crewai-ts/core` and `@crewai-ts/gemini`.
- Existing examples/tests are updated to the new package boundaries.
- Documentation explains the breaking migration from old monolithic
  `@crewai-ts/core` imports to explicit package imports.

## Migration Notes To Document

Document these changes for users:

- `@crewai-ts/core` is no longer the everything package.
- Provider imports move to explicit provider packages.
- Gemini users install `@crewai-ts/core` and `@crewai-ts/gemini`.
- RAG/PDF users install `@crewai-ts/rag`.
- MCP users install `@crewai-ts/mcp`.
- A2A/A2UI users install `@crewai-ts/a2a`.
- Flow users install `@crewai-ts/flow`.
- This is a breaking package boundary change and should be released on the next
  breaking version line.

## Out Of Scope

- Do not preserve every old subpath export if doing so keeps packages heavy.
- Do not publish packages from this goal unless explicitly asked.
- Do not add live provider integration tests to the default test suite.
- Do not solve every provider parity gap while splitting packages; keep behavior
  unchanged unless the split exposes a real bug.
