# CrewAI TypeScript Port - Remaining Work

This repository is a TypeScript port of `crewAIInc/crewAI`, with TS 5 standard decorators only. Keep `experimentalDecorators: false`; do not add `reflect-metadata`, parameter decorators, or Nest metadata integration. Nest should consume this as a normal TypeScript library.

## Current Verified State

- Full gate passed on 2026-05-31:
  - `npm run check`
  - `npm test`
  - `npm run build`
  - `npm run lint`
  - `npm run smoke:pack`
  - `python3 scripts/check-export-parity.py`
- Test suite: 443 passing tests.
- Root export parity against upstream clone `/tmp/crewai-upstream-current/lib/crewai/src/crewai` at commit `5cdc420`: `total_missing=0`.
- Public method parity has been tightened for core runtime classes:
  - `ConsoleFormatter`: `missing=0`
  - `Task`: `missing=0`
  - `AgentExecutor`: public lifecycle mostly covered; upstream property-style `state/messages/iterations` are fields in TS.
  - `Crew`: `missing=0`
  - `Agent`: `missing=0`
  - `BaseAgent`: `missing=0`

## Known Remaining Porting Areas

The export surface is broad, but several areas still need deeper behavioral parity rather than name-only compatibility:

## Resume Queue

When more goal budget is available, continue from the behavioral parity audits below. The next pass should stay test-driven: compare the Python upstream method contract, add focused tests for the missing or placeholder behavior, then implement the smallest TS-compatible behavior that keeps decorators standard-only.

## Completed In Current Storage/RAG Pass

- Added deterministic storage backend lifecycle parity for the TypeScript in-memory `QdrantEdgeStorage` and `LanceDBStorage` shims:
  - batch `save`/`asave`
  - positional and object-style `search`/`asearch`
  - metadata filters, category filters, segment-boundary-safe scope filters, min score, and limits
  - `delete`/`adelete`, `update`, `get_record`, `list_records`, `get_scope_info`, `list_scopes`, `list_categories`, `count`, and scoped/global `reset`
  - `touch_records`/`touchRecords`, `optimize`, `flush_to_central`/`flushToCentral`, `close`, and `aclose` maintenance hooks
- Replaced the root `StorageBackend` placeholder with the same deterministic lifecycle/filter/scope behavior used by the in-memory storage shims.
- Replaced root placeholder exports for `ChromaDBClient`, `KnowledgeStorage`, and `BaseKnowledgeStorage` with behavior-bearing implementations.
- Added fake-client-backed RAG tests for ChromaDB and Qdrant collection create/delete/reset, upsert overwrite behavior, search, metadata filters, and async aliases.
- Added `KnowledgeStorage` tests for collection naming, save/search, async aliases, and reset through the RAG client wrapper.
- Added upstream-style `KnowledgeStorage` save/asave error conversion for embedding dimension mismatches.
- Added upstream-style `KnowledgeStorage._get_client` plus collection-name helper aliases for storage extension compatibility.
- Added embedding provider config-field compatibility for OpenAI, Azure, SentenceTransformer, VoyageAI, VertexAI, HuggingFace, Instructor, Jina, Ollama, OpenCLIP, Text2Vec, Google Generative AI, Bedrock, Cohere, ONNX, Roboflow, and WatsonX defaults plus direct provider attribute access.
- Added upstream-style embedding factory fallback so built-in provider specs instantiate their provider classes when no custom builder is registered.
- Added VoyageAI and WatsonX embedding function `name()` helpers plus WatsonX `validate_space_or_project` parity.

## Completed In Current Flow/Persistence Pass

- Added upstream snake_case method compatibility for `JsonFlowPersistence` and `SQLiteFlowPersistence`:
  - `SQLiteFlowPersistence.init_db`
  - `save_state` / `load_state`
  - `save_pending_feedback` / `load_pending_feedback`
  - `clear_pending_feedback`
- Added `persistence_type` metadata on `JsonFlowPersistence` to match the persistence backend convention already present on SQLite.
- Added focused JSON and SQLite tests for these aliases, including pending-feedback round trip and clear semantics.
- Added Flow memory helper parity for auto-created flow memory plus explicit/disabled memory configuration:
  - `Flow.remember`
  - `Flow.recall`
  - `Flow.extract_memories`
- Added unified memory compatibility helpers used by Flow and scoped views:
  - `Memory.remember_many`, `extract_memories`, `update`, `drain_writes`, `close`
  - `Memory.list_records` / `listRecords` plus `aremember`, `aremember_many`, `arecall`, and `aextract_memories`
  - `Memory` constructor now honors upstream snake_case `root_scope`, `read_only`, and memory scoring/consolidation config aliases
  - `Memory.aextract_memories` now routes through the configured LLM-backed extraction helper with safe fallback
  - `Memory.aremember` now uses configured LLM save analysis to infer missing scope, categories, importance, and extracted metadata
  - `Memory.aremember` now applies configured LLM consolidation plans for similar-record updates
  - `Memory.update` now supports upstream-style partial updates by record ID, preserving created timestamps, refreshing access time, and raising on missing records
  - `Memory.reset` now honors `root_scope` by resetting only that subtree when no explicit scope is provided
  - `Memory.list_scopes`, `list_categories`, `info`, and their `MemorySlice` variants now accept upstream-style path arguments while preserving existing boolean full-detail calls
  - `Memory.tree` and `MemoryScope.tree` now accept upstream-style path arguments and return formatted scope trees while preserving existing object-tree calls
  - consolidation plan execution now deduplicates actions by record so the first update/delete wins, matching upstream batch execution semantics
  - background batch memory writes now perform deterministic intra-batch duplicate dropping before persistence
  - `EncodingFlow.batch_embed`, `intra_batch_dedup`, and `parallel_find_similar` now expose upstream-style batch embedding, vector-similarity duplicate marking, effective-scope similar-record lookup, and result scoring for exported memory flow compatibility.
  - `EncodingFlow.parallel_analyze` now applies upstream-style fast-path field defaults, root-scope resolution, no-LLM insert plans, and async save/consolidation analysis wiring for exported memory flow compatibility.
  - `EncodingFlow.execute_plans` now applies upstream-style consolidation updates, update re-embedding, bulk inserts, write counters, and per-item result records for exported memory flow compatibility.
  - `RecallFlow` now exposes upstream-style query-analysis fast path, long-query LLM analysis with time filters, candidate-scope filtering, chunk search, recursive exploration/re-search, depth routing, result synthesis helpers, and kickoff orchestration for exported memory flow compatibility.
  - `Memory` now accepts an upstream-style `embedder` option, stores embeddings on saved records, and routes configured deep/shallow recall through vector-backed RecallFlow/search paths.
  - `Memory.update` now re-embeds records when content changes so vector recall follows updated content.
  - `Memory.forget` and `reset` now cover upstream-style older-than, metadata, record-id, and `scope_prefix` filter aliases.
  - `Memory.recall` now touches returned records so `lastAccessed` follows upstream read-side maintenance semantics.
  - `Memory.aremember_many` now applies configured LLM save analysis per batch item before pending background writes
  - upstream-style `remember_many` background write semantics with `recall`/`drain_writes` read barriers and batch `RememberTool` responses
  - `MemoryScope` / `MemorySlice` `remember_many`, `extract_memories`, and `bind`
  - `MemoryScope` relative sub-scope writes/recalls plus `read_only`, `tree`, and `list_categories`
  - `MemoryScope` metadata helpers and `reset` now resolve upstream-style relative path arguments under the scope root.
  - `MemoryScope.bind` and `MemorySlice.bind` now rebind the same view instance for upstream-style checkpoint restore semantics.
  - `MemorySlice.recall` now mirrors upstream scoped oversampling and final limit semantics when merging results from multiple scopes.
  - `MemorySlice` upstream-style default read-only writes, opt-in writable slices with explicit scope writes, category-filtered recall, `tree`, `list_categories`, and path-scoped listing aggregation
  - `Memory.model_post_init` now exposes upstream-style runtime initialization and preserves memory kind/read-only/root-scope aliases.
- Added Flow checkpoint restoration/fork compatibility plus mutable locked proxy behavior:
  - `Flow.fromCheckpoint` / `Flow.from_checkpoint`
  - `Flow.fork`
  - kickoff-time `fromCheckpoint` / `from_checkpoint` resume without replaying completed methods
  - EventBus `runtimeState` / `runtime_state`, `setRuntimeState` / `set_runtime_state`, and third-argument runtime state delivery to handlers
  - runtime checkpoint serialization of completed methods, method outputs/counts, and flow state
  - `LockedListProxy`, `LockedDictProxy`, and `StateProxy` mutation helpers backed by the original state values
  - `LockedListProxy` / `LockedDictProxy` now expose upstream-style collection helpers such as `append`, `insert`, `remove`, `count`, `sort`, `reverse`, `copy`, `pop`, `setdefault`, and `items`
  - `RuntimeState.afrom_checkpoint` / `afromCheckpoint` and `StateProxy.model_dump` / `modelDump` aliases now mirror upstream async checkpoint restore and state dump helpers
  - `Flow.pending_feedback`, `Flow.method_outputs`, and `Flow.flow_id` now expose upstream snake_case property aliases.
  - `Flow.model_post_init` now exposes the upstream post-init hook, emits `flow_created` idempotently, and preserves explicit disabled-memory configuration.
  - `Flow.kickoff` / `kickoffAsync` / `kickoff_async` / `akickoff` now accept upstream-style direct `inputs` arguments in addition to the TS options object.
  - `Flow.kickoff` / `kickoffAsync` now support upstream-style `restore_from_state_id` / `restoreFromStateId` fork hydration from persisted state without reusing the source flow ID and reject conflicting checkpoint restores.
  - `Flow.plot` now emits `flow_plot` and writes an interactive HTML visualization through the existing flow structure renderer.
- Added adapter-level LLM provider parity helpers:
  - `BaseLLM.acall` now provides the upstream async call surface by formatting string/list messages and delegating through the concrete `call` implementation.
  - `supportsFunctionCalling` / `supports_function_calling`
  - native OpenAI/Azure/Anthropic/Bedrock support overrides for function calling, stop words, and multimodal capability where deterministic
  - OpenAI/Azure response-chain compatibility getters and reset methods (`last_response_id`, `last_reasoning_items`, `reset_chain`, `reset_reasoning_chain`)
  - OpenAI native completion shim now exposes upstream-style chat completions and Responses API request parameter builders, including built-in tools, custom tools, response format, stream usage options, instructions, includes, and reasoning fields
  - OpenAI native completion shim now exposes upstream-style SDK response token usage extraction, Responses API output parsing for function calls, built-in tool outputs, and reasoning items, and deterministic Responses streaming event accumulation, including cached prompt tokens and reasoning tokens
  - OpenAI Responses API parsing now handles SDK-like usage/detail getters and `model_dump` action objects for built-in computer-use outputs.
  - OpenAI native completion shim now explicitly exposes upstream-style provider alias methods on the provider class, including async calls, config serialization, capability checks, file uploaders, context windows, and response-chain reset/getters.
  - OpenAI-compatible completion shim now exposes upstream-style provider config resolution helpers for API keys, base URLs, Ollama `/v1` normalization, and default header merging.
  - Azure completion shim now exposes upstream-style request parameter builders with Azure OpenAI endpoint model omission, Azure AI model inclusion, `model_extras`, prompt cache keys, drop-params handling, stop words, and custom tools
  - Azure completion shim now exposes upstream-style SDK token usage extraction with cached prompt and reasoning token details.
  - Azure completion shim now reads upstream-style credential scopes from `AZURE_CREDENTIAL_SCOPES` when no non-empty scopes are configured explicitly.
  - Azure completion shim now explicitly exposes upstream-style provider alias methods on the provider class, including sync/async calls, close, config serialization, capability checks, context windows, and response-chain reset/getters.
  - Anthropic, Bedrock, and Gemini native completion shims now explicitly expose upstream-style provider alias methods on provider classes for async calls, config serialization, capability checks, file uploaders, context windows, and text formatting where applicable.
  - Anthropic completion shim now exposes upstream-style request parameter builders with system prompts, stop sequences, thinking config, custom tool conversion, single-tool forcing, and tool-search injection/deferred loading
  - Anthropic completion shim now exposes upstream-style SDK response token usage extraction, tool-use/structured-output response extraction, deterministic streaming event accumulation, and tool-result block execution helpers, including cache read and cache creation token fields
  - Anthropic completion usage extraction now handles SDK-like usage getter objects for cache read/create token metadata.
  - Bedrock completion shim now exposes upstream-style Converse request body builders, including Bedrock message content blocks, system prompts, inference config, toolConfig conversion, guardrail config, and additional model request/response fields
  - Bedrock completion shim now exposes upstream-style document/video content-type format mapping helpers for multimodal payload preparation.
  - Bedrock completion shim now exposes upstream-style client error classification for common AWS Bedrock error codes.
  - Bedrock completion shim now exposes upstream-style Converse token usage extraction/tracking, tool-use/structured-output response extraction, deterministic Converse streaming event accumulation, and tool-result follow-up message helpers, including cache read token fields
  - Gemini completion shim with upstream-style message formatting, generation config builders, tool conversion, function-call and structured-output response extraction/direct execution, deterministic streaming chunk accumulation, config, context-window, multimodal/text-formatting, token-usage extraction, response text extraction, property ordering, and content conversion helpers
  - Gemini completion shim now exposes the upstream-style `_extract_token_usage` alias for SDK usage translation compatibility.
  - Gemini token usage extraction and streaming accumulation now handle SDK-like `usage_metadata` getter objects.
  - Multimodal LLM message file handling now converts `files` into deterministic inline/upload content blocks, and native OpenAI/Azure/Anthropic/Bedrock/Gemini shims expose local provider file uploaders
  - Streaming tool-call argument accumulation now preserves id/name/index and concatenates function argument deltas into upstream-style tool call payloads
  - Provider tool conversion helpers now reject non-dictionary tools and invalid `function` payloads with upstream-style errors while preserving OpenAI/direct schema extraction.
- Added evaluation compatibility behavior:
  - LLM-backed `GoalAlignmentEvaluator` and `SemanticQualityEvaluator` with upstream-style prompts and JSON score parsing
  - `EvaluationDisplayFormatter` aggregation helpers for per-agent metric averages, feedback summaries, and iteration display text
  - `ExperimentResultsDisplay` now exposes upstream-style `summary` and `comparison_summary` result formatting hooks.
  - `ExperimentResults.to_json` and `compare_with_baseline` now support upstream-style result file persistence, baseline comparison, regression/new/missing classification, and current-run appends.
  - `ExperimentRunner` now replaces the root placeholder with upstream-style dataset execution scaffolding, score extraction, and numeric/dict expected-score comparison rules.
  - `AgentEvaluator` aggregation now reuses display formatter logic and emits started/completed/failed evaluation lifecycle events
  - `EvaluationTraceCallback` now subscribes to event bus hooks for agent/lite-agent execution, tool success/error, validation errors, and LLM call traces
  - `BaseEvent.to_json` now exposes upstream-style event serialization with exclusion support and snake_case compatibility keys.
  - Agent execution lifecycle events now expose upstream-style `set_fingerprint_data` helpers for fingerprint metadata refresh.
  - `Telemetry` now exposes deterministic local span recording for upstream task/tool/test/crew/flow/environment/human-feedback/feature/template span methods without enabling network exporters
  - `Telemetry` now records upstream-style `crewai_version` metadata from the shared version export rather than a TypeScript package label.
  - `TraceBatch` now defaults its batch version from the shared CrewAI version export, matching upstream trace batch manager metadata.
  - `EventListener.setup_listeners` and `TraceCollectionListener.setup_listeners` now expose subclass-level upstream listener setup aliases.
  - `FirstTimeTraceHandler` now exposes upstream-style first-time trace collection state hooks and records local consent/completion without enabling cloud upload behavior.
- Added crew chat compatibility behavior:
  - `handleUserInput` now forwards the generated crew function schema and available function map to the chat LLM call so upstream-style conversational crew function calling can execute.
  - `check_conversational_crews_version` now accepts the upstream pyproject data argument and rejects invalid version strings instead of loosely parsing embedded digits.
- Added converter compatibility behavior:
  - `asyncConvertToModel` / `asyncHandlePartialJson` now use the agent LLM fallback path for non-JSON or malformed partial JSON results, matching upstream async conversion dispatch.
  - `OutputConverter` now explicitly exposes upstream-style `to_pydantic` and `to_json` methods while preserving the shared converter implementation.
- Added output compatibility behavior:
  - `TaskOutput.set_summary` now exposes the upstream summary recomputation hook while preserving constructor-time summary defaults.
  - `CrewStreamingOutput.results` now exposes upstream-style list access for completed streaming crew results.
- Added knowledge compatibility behavior:
  - `Knowledge` now accepts storage-backed configuration and exposes upstream-style `add_sources`, `aadd_sources`, `aquery`, and `areset` helpers while preserving the in-memory deterministic path.
  - Knowledge sources now expose upstream-style `add`, `aadd`, `validate_content`, and `get_embeddings` helpers and can save their chunks through configured storage.
  - `BaseKnowledgeSource` now replaces the root placeholder with chunking, embedding-list, and sync/async storage save helpers.
  - `BaseFileKnowledgeSource` now replaces the root placeholder with upstream-style `file_path` / `file_paths`, `safe_file_paths`, `content`, `convert_to_path`, `load_content`, and validation helpers shared by file-backed sources.
- Added tool compatibility behavior:
  - `BaseTool` / `StructuredTool` now expose upstream-style `tool_type`, `model_post_init`, `validate_max_usage_count`, and `from_langchain` helpers.
  - `ToolUsage` now exposes upstream-style `on_tool_error` and `on_tool_use_finished` event helpers, including snake_case event payload aliases and fingerprint metadata passthrough.
  - `CacheTools.hit_cache` now exposes the upstream direct cache lookup helper used by the generated cache tool.
- Added MCP compatibility behavior:
  - `MCPClient.list_prompts` and `get_prompt` now normalize SDK prompt responses into upstream-style prompt definition and prompt-content shapes.
  - `MCPToolWrapper._run_async` now returns upstream-style classified execution error strings instead of leaking wrapper execution exceptions.
- Added project wrapper compatibility behavior:
  - `TaskMethod` now exposes upstream-style `ensure_task_name` and applies default task names on direct `call`/`invoke` paths.
  - `CrewAIPlugin.get_class_decorator_hook` now exposes a deterministic no-op-compatible mypy plugin hook surface for `CrewBase` decorator metadata.
- Added hooks compatibility behavior:
  - Filtered hook decorator factories now register upstream-style global wrappers for function hooks, preserve snake_case marker metadata, and apply sanitized tool/agent filters.
- Added planning compatibility behavior:
  - `StepObservation.coerce_single_refinement_to_list` now exposes the upstream validator helper for single refinement objects.
  - `PlanningConfig` now accepts and exposes upstream snake_case field names directly alongside TypeScript camelCase aliases.
- Added rate-limit compatibility behavior:
  - `RPMController.reset_counter` now exposes the upstream reset helper and returns the controller instance.
- Added A2A auth compatibility behavior:
  - `A2AEventBase.extract_task_and_agent_metadata` now exposes the upstream pre-validation metadata extraction helper for task/agent source fingerprints.
  - `HTTPBasicAuth`, `HTTPDigestAuth`, and `APIKeyAuth` now expose upstream-style concrete `apply_auth` helpers.
  - `HTTPDigestAuth.configure_client` and `APIKeyAuth.configure_client` now idempotently configure digest auth and query-param request hooks.
  - `OAuth2AuthorizationCode` now exposes upstream-style `set_authorization_callback`, initial authorization-code token exchange, and refresh-token renewal behavior.
  - `OAuth2ServerAuth.to_security_scheme` now exposes upstream-style OAuth2 AgentCard flow declarations for client-credentials and authorization-code flows.
  - `AgentCardSigningConfig.get_private_key` now loads AgentCard signing keys from PEM strings or PEM files and validates mutually exclusive key sources.
  - `TLSConfig.get_grpc_credentials` now exposes upstream-style gRPC credential material loading for mTLS and CA files.
- Added A2A update-handler compatibility behavior:
  - `StreamingHandler.execute` now sends the initial A2A message, emits streaming lifecycle/chunk events, accumulates message chunks, processes final task results, and returns streaming errors as task-state results.
  - `PollingHandler.execute` now sends the initial A2A message, polls task state through terminal/actionable states, processes final task results, and returns timeout/error task-state results.
  - `PushNotificationHandler.execute` now validates push config/result stores, sends the initial A2A message, waits for stored push results, processes final task results, and reports configuration/timeout failures.
  - A2A content-type negotiation now emits upstream-style negotiation events with effective/client/server modes and success metadata.
  - A2A dynamic response models now default `a2a_ids` to an empty list and enforce upstream-style maximum delegation count plus allowed-agent validation.
  - A2A update handler registry now maps streaming, polling, and push-notification config classes to their concrete handler classes, with streaming as the default.
  - A2A client configs now default `updates` to `StreamingConfig`, matching upstream default update handling.
  - A2A server configs now expose upstream-style AgentCard defaults, security/signing/extension fields, and deprecated `preferred_transport` migration.
  - A2A agent-card fetching now resolves endpoint paths through `fetch`, applies auth headers when available, returns fetched card JSON, and emits fetched-card events.
  - A2A agent-card fetch failures now classify 401, timeout, connection, and request failures and emit upstream-style authentication/connection error events.
  - A2A task/tool to AgentSkill conversion helpers now mirror upstream id, tag, fallback-name, and examples semantics.
  - A2A server method injection now adds `to_agent_card`/`toAgentCard` for agents with server config and builds AgentCards from config, tool skills, and agent metadata.
  - Generated A2A AgentCards now merge configured server extensions into `capabilities.extensions` without duplicating existing extension URIs.
- Added A2UI compatibility behavior:
  - `A2UIClientExtension` now filters restored conversation surfaces by configured catalog ID and advertises both default and custom catalog capabilities for v0.8/v0.9 metadata, matching upstream client extension semantics.
  - `A2UIServerExtension` now activates request hooks only when clients declare the server extension URI, matching upstream A2A server extension activation semantics.
  - `ServerExtensionRegistry` now isolates request/response hook failures and records successfully activated server extensions on the server context.
  - A2UI standard catalog validation now skips unknown custom components and validates required fields for known standard components.
- Added security compatibility behavior:
  - `SecurityConfig.validate_fingerprint` now exposes upstream-style fingerprint coercion for null, seed strings, dicts, and `Fingerprint` instances.
- Added guardrail compatibility behavior:
  - `GuardrailResult.validate_result_error_exclusivity` now exposes the upstream validator helper for result/error mutual exclusivity.
- Added skills compatibility behavior:
  - `SkillFrontmatter.parse_allowed_tools` now exposes the upstream frontmatter pre-parse helper for space-delimited allowed tool lists.
- Added i18n compatibility behavior:
  - `I18N.load_prompts` now exposes upstream-style prompt catalog reload semantics for custom prompt files and default prompts.
- Added LiteAgent compatibility behavior:
  - `LiteAgent` now exposes upstream-style setup/helper methods for LLM setup, tool parsing, A2A setup, guardrail validation, and memory resolution.
  - `LiteAgent` now exposes before/after LLM hook getters, an upstream-style `key` property getter, and resolves `memory: true` to a default `Memory` instance.
- Added token usage compatibility behavior:
  - `TokenProcess` now exposes upstream-style mutable token counters and `sum_*` helpers while preserving message-array prompt token estimation.
- Added version compatibility behavior:
  - Root `version`, `__version__`, `get_crewai_version`, and runtime checkpoint metadata now report the upstream CrewAI version from the current upstream clone.

1. Storage backends
   - `memory/storage/backend.py`
   - `memory/storage/lancedb_storage.py`
   - `memory/storage/qdrant_edge_storage.py`
   - `knowledge/storage/*`
   - The deterministic in-memory TypeScript shims now cover sync/async save/search/delete/update/reset semantics, metadata filtering, access-time touching, and maintenance hook compatibility.
   - Remaining: audit persistence-specific LanceDB/Qdrant Edge details that do not map to the no-SDK TypeScript shim yet, including compaction, central/local shard flushing, and provider-specific index behavior.

2. LLM providers
   - OpenAI, Azure, Anthropic, Bedrock, Gemini provider classes.
   - `to_config_dict`, context window, adapter-level function-calling support, deterministic multimodal support flags, response-chain/reset compatibility, file input content-block conversion, local uploader compatibility, streaming tool-call accumulation, OpenAI/Anthropic/Bedrock SDK usage extraction, OpenAI Responses built-in output parsing and streaming event accumulation, Anthropic/Bedrock event accumulation, Anthropic and Bedrock tool-result helpers, Gemini function-call direct execution and streaming chunk accumulation, Anthropic/Bedrock/Gemini function-call/structured-output response extraction, and OpenAI/Azure/Anthropic/Bedrock/Gemini request builders are now covered for the native provider shims.
   - Remaining: deeper SDK-backed response translation details.
   - Keep provider tests adapter-level and mock network calls. Do not introduce live API keys or provider-specific SDK side effects into the default test gate.

3. Flow and persistence
   - `Flow` checkpoint/fork/resume/pending feedback/memory methods.
   - `SQLiteFlowPersistence` method parity and real persistence behavior.
   - Prioritize persistence replay and resume behavior because it affects user-visible workflow recovery.
   - Flow persistence backends now expose upstream snake_case aliases for state and pending-feedback lifecycle methods.
   - Flow now supports auto memory plus `remember`, `recall`, and `extract_memories` delegation.
   - Flow checkpoint snapshots now restore/fork completed methods, method outputs/counts, and state through `from_checkpoint`/`fork`; kickoff-time `from_checkpoint` delegates to the restored flow and does not replay completed methods; restored checkpoint RuntimeState is wired through the event bus and handlers can receive it as a third argument; locked dict/list proxies now mutate the backing values.
   - Remaining: any Pydantic/BaseModel-only state behavior that has no direct TypeScript equivalent yet.

4. Unified memory
   - Async aliases and record/scope/category listing.
   - `remember_many`, `extract_memories`, partial `update`, `drain_writes`, `close`.
   - `MemoryScope` / `MemorySlice` scoped writes/recalls, `bind`, `read_only`, `tree`, `list_categories`, and path-scoped listing aggregation.
   - These compatibility helpers are now present in the deterministic TS memory shim; remaining work is deeper executor-backed async scheduling and batch-level cross-item consolidation parity.

5. RAG clients
   - ChromaDB/Qdrant client method parity.
   - Async aliases and collection lifecycle behavior.
   - Fake-client tests now cover collection creation, deletion, reset, upsert/search, overwrite behavior, metadata filters, and async aliases.
   - `Knowledge` and knowledge sources can now route source add/query/reset through `KnowledgeStorage` for sync and async upstream-style calls.
   - Remaining: optional real-client integration can be added outside the default gate if the project decides to carry provider SDK peer dependency coverage.

6. Evaluation and tracing listeners
   - Agent evaluator now has behavior-bearing display aggregation and lifecycle event helper methods.
   - Goal-alignment and semantic-quality evaluator placeholders have been replaced with LLM-backed evaluators.
   - Evaluation trace callback now records event-bus-driven agent/lite-agent traces, tool uses, tool errors, validation errors, LLM calls, and final output.
   - Telemetry span methods now record deterministic local `RecordedSpan` objects for task/tool/test/crew/flow/environment/human-feedback/feature/template telemetry without external OTLP side effects.
   - Remaining: deeper OpenTelemetry exporter integration can stay outside the default gate unless the project decides to carry SDK-backed telemetry coverage.

## Suggested Next Order

1. Start with storage and RAG parity because they share save/search/delete/filter semantics and are easiest to validate with deterministic fake backends.
2. Move to `Flow` persistence after storage because checkpoint/resume tests are broader and may need storage decisions.
3. Audit unified memory once storage primitives are stable.
4. Finish provider-specific LLM compatibility after the core runtime behavior is stable.
5. Sweep evaluator/tracing compatibility last, separating documented no-ops from missing behavior.

## Useful Audit Commands

Run full validation:

```bash
npm run check && npm test && npm run build && npm run lint && npm run smoke:pack
```

Check root export parity:

```bash
python3 scripts/check-export-parity.py
```

Set `UPSTREAM_CREWAI_SRC=/path/to/crewAI/lib/crewai/src/crewai` when comparing against a fresh upstream clone.

Check class public method parity by comparing upstream Python AST class methods to TS class methods in `src/*.ts`. Prior work used this to prioritize gaps by missing method count.
