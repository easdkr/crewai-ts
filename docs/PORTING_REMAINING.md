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
- Test suite: 372 passing tests.
- Root export parity against upstream clone `/tmp/crewai-upstream.lPeuQi/crewAI` at commit `2148c7e`: `total_missing=0`.
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
  - `Memory.aremember_many` now applies configured LLM save analysis per batch item before pending background writes
  - upstream-style `remember_many` background write semantics with `recall`/`drain_writes` read barriers and batch `RememberTool` responses
  - `MemoryScope` / `MemorySlice` `remember_many`, `extract_memories`, and `bind`
  - `MemoryScope` relative sub-scope writes/recalls plus `read_only`, `tree`, and `list_categories`
  - `MemorySlice` upstream-style default read-only writes, opt-in writable slices, category-filtered recall, `tree`, `list_categories`, and path-scoped listing aggregation
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
  - `Flow.plot` now emits `flow_plot` and writes an interactive HTML visualization through the existing flow structure renderer.
- Added adapter-level LLM provider parity helpers:
  - `BaseLLM.acall` now provides the upstream async call surface by formatting string/list messages and delegating through the concrete `call` implementation.
  - `supportsFunctionCalling` / `supports_function_calling`
  - native OpenAI/Azure/Anthropic/Bedrock support overrides for function calling, stop words, and multimodal capability where deterministic
  - OpenAI/Azure response-chain compatibility getters and reset methods (`last_response_id`, `last_reasoning_items`, `reset_chain`, `reset_reasoning_chain`)
  - OpenAI native completion shim now exposes upstream-style chat completions and Responses API request parameter builders, including built-in tools, custom tools, response format, stream usage options, instructions, includes, and reasoning fields
  - OpenAI native completion shim now exposes upstream-style SDK response token usage extraction, Responses API output parsing for function calls, built-in tool outputs, and reasoning items, and deterministic Responses streaming event accumulation, including cached prompt tokens and reasoning tokens
  - OpenAI native completion shim now explicitly exposes upstream-style provider alias methods on the provider class, including async calls, config serialization, capability checks, file uploaders, context windows, and response-chain reset/getters.
  - Azure completion shim now exposes upstream-style request parameter builders with Azure OpenAI endpoint model omission, Azure AI model inclusion, `model_extras`, prompt cache keys, drop-params handling, stop words, and custom tools
  - Azure completion shim now explicitly exposes upstream-style provider alias methods on the provider class, including sync/async calls, close, config serialization, capability checks, context windows, and response-chain reset/getters.
  - Anthropic, Bedrock, and Gemini native completion shims now explicitly expose upstream-style provider alias methods on provider classes for async calls, config serialization, capability checks, file uploaders, context windows, and text formatting where applicable.
  - Anthropic completion shim now exposes upstream-style request parameter builders with system prompts, stop sequences, thinking config, custom tool conversion, single-tool forcing, and tool-search injection/deferred loading
  - Anthropic completion shim now exposes upstream-style SDK response token usage extraction, tool-use/structured-output response extraction, deterministic streaming event accumulation, and tool-result block execution helpers, including cache read and cache creation token fields
  - Bedrock completion shim now exposes upstream-style Converse request body builders, including Bedrock message content blocks, system prompts, inference config, toolConfig conversion, guardrail config, and additional model request/response fields
  - Bedrock completion shim now exposes upstream-style Converse token usage extraction/tracking, tool-use/structured-output response extraction, deterministic Converse streaming event accumulation, and tool-result follow-up message helpers, including cache read token fields
  - Gemini completion shim with upstream-style message formatting, generation config builders, tool conversion, function-call and structured-output response extraction/direct execution, deterministic streaming chunk accumulation, config, context-window, multimodal/text-formatting, token-usage extraction, response text extraction, property ordering, and content conversion helpers
  - Multimodal LLM message file handling now converts `files` into deterministic inline/upload content blocks, and native OpenAI/Azure/Anthropic/Bedrock/Gemini shims expose local provider file uploaders
  - Streaming tool-call argument accumulation now preserves id/name/index and concatenates function argument deltas into upstream-style tool call payloads
- Added evaluation compatibility behavior:
  - LLM-backed `GoalAlignmentEvaluator` and `SemanticQualityEvaluator` with upstream-style prompts and JSON score parsing
  - `EvaluationDisplayFormatter` aggregation helpers for per-agent metric averages, feedback summaries, and iteration display text
  - `ExperimentResultsDisplay` now exposes upstream-style `summary` and `comparison_summary` result formatting hooks.
  - `ExperimentResults.to_json` and `compare_with_baseline` now support upstream-style result file persistence, baseline comparison, regression/new/missing classification, and current-run appends.
  - `ExperimentRunner` now replaces the root placeholder with upstream-style dataset execution scaffolding, score extraction, and numeric/dict expected-score comparison rules.
  - `AgentEvaluator` aggregation now reuses display formatter logic and emits started/completed/failed evaluation lifecycle events
  - `EvaluationTraceCallback` now subscribes to event bus hooks for agent/lite-agent execution, tool success/error, validation errors, and LLM call traces
  - `BaseEvent.to_json` now exposes upstream-style event serialization with exclusion support and snake_case compatibility keys.
  - `Telemetry` now exposes deterministic local span recording for upstream task/tool/test/crew/flow/environment/human-feedback/feature/template span methods without enabling network exporters
- Added crew chat compatibility behavior:
  - `handleUserInput` now forwards the generated crew function schema and available function map to the chat LLM call so upstream-style conversational crew function calling can execute.
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
- Added A2A auth compatibility behavior:
  - `HTTPBasicAuth`, `HTTPDigestAuth`, and `APIKeyAuth` now expose upstream-style concrete `apply_auth` helpers.
  - `HTTPDigestAuth.configure_client` and `APIKeyAuth.configure_client` now idempotently configure digest auth and query-param request hooks.
  - `OAuth2AuthorizationCode` now exposes upstream-style `set_authorization_callback`, initial authorization-code token exchange, and refresh-token renewal behavior.
  - `TLSConfig.get_grpc_credentials` now exposes upstream-style gRPC credential material loading for mTLS and CA files.
- Added security compatibility behavior:
  - `SecurityConfig.validate_fingerprint` now exposes upstream-style fingerprint coercion for null, seed strings, dicts, and `Fingerprint` instances.
- Added i18n compatibility behavior:
  - `I18N.load_prompts` now exposes upstream-style prompt catalog reload semantics for custom prompt files and default prompts.
- Added LiteAgent compatibility behavior:
  - `LiteAgent` now exposes upstream-style setup/helper methods for LLM setup, tool parsing, A2A setup, guardrail validation, and memory resolution.
  - `LiteAgent` now exposes before/after LLM hook getters, an upstream-style `key` property getter, and resolves `memory: true` to a default `Memory` instance.
- Added token usage compatibility behavior:
  - `TokenProcess` now exposes upstream-style mutable token counters and `sum_*` helpers while preserving message-array prompt token estimation.

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
