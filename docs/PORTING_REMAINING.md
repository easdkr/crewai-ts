# CrewAI TypeScript Port - Remaining Work

This repository is a TypeScript port of `crewAIInc/crewAI`, with TS 5 standard decorators only. Keep `experimentalDecorators: false`; do not add `reflect-metadata`, parameter decorators, or Nest metadata integration. Nest should consume this as a normal TypeScript library.

## Current Verified State

- Full gate passed on 2026-06-02:
  - `npm test`
  - `npm run lint`
  - `npm audit --omit=dev`
  - `npm run build`
  - `npm run smoke:pack`
  - `python3 scripts/check-export-parity.py`
  - `python3 scripts/check-class-method-parity.py`
  - `python3 scripts/check-subpath-export-parity.py`
  - `node scripts/check-a2ui-schema-parity.mjs`
- Test suite: 797 passing tests.
- Upstream clone: `/tmp/crewai-upstream-current/lib/crewai/src/crewai` at commit `4dafb05735dfa0d6e265eaccbe784b820e8fbfad`.
- Root export parity: `total_missing=0`.
- Core public class method parity script: `total_missing=0`.
- Subpath export parity: `total_missing=0`, `total_mismatched=0`.

## Release Readiness Policy

Method/export parity is now a gate, not the next source of work. Do not add more aliases or helper wrappers only because an AST scan finds a name mismatch. Add new alias/helper surface only when at least one of these is true:

- An upstream example, documented workflow, or user-facing compatibility path fails without it.
- A behavior test that models upstream usage requires that exact method/property name.
- The method is part of a broader behavior implementation, not a standalone name-only change.

Remaining work should be classified by behavior parity:

- **Covered in the default deterministic gate:** behavior implemented without live cloud accounts, API keys, network services, or provider SDK side effects.
- **Documented deterministic shim:** behavior intentionally modeled with in-memory/local/fake-client semantics because the upstream implementation depends on Python-specific or SDK-backed runtime services.
- **Intentionally unsupported in this port:** cloud subscription/platform features, network exporters, live provider SDK clients, or Python-only runtime integrations that should not enter the default release gate.
- **Missing behavior:** upstream user workflow or example is not supported and can be verified by a focused failing test.

Release readiness is decided by the full validation gate plus this behavior classification, not by commit count or by driving the parity scripts beyond `missing=0`.

## Next-Work Selection Rules

Use these rules before opening a new porting branch or commit:

1. Start from an upstream example, upstream behavior test, or documented user workflow.
2. Reproduce the gap with a focused deterministic test in this repository.
3. If the failing condition is only a missing method/property name while behavior already works through an existing API, do not add the alias unless the upstream example/test calls that name directly.
4. If the upstream behavior depends on live cloud accounts, remote SDK clients, platform subscriptions, or Python-only optional packages, classify it as a shim or intentionally unsupported before writing runtime code.
5. Consider the work release-ready only after the full validation gate passes.

## Behavior Parity Release Map

Use this map before starting any new porting change. If a behavior lands in **covered** or **shimmed**, protect it with deterministic tests and keep it in the default gate. If it lands in **unsupported**, document the boundary and do not add runtime code unless the project explicitly chooses an optional integration gate. If it lands in **missing**, add a focused failing behavior test before implementation.

| Area | Classification | Release gate expectation |
| --- | --- | --- |
| Root exports, subpath exports, and public class method names | Covered in the default deterministic gate | Regression-only parity checks. Do not mine these scripts for new alias-only work while `missing=0`. |
| Core Agent, Task, Crew, Flow, Memory, Knowledge, Tool, and Process workflows | Covered in the default deterministic gate | Behavior tests should model upstream examples and tests with local LLM/tool fixtures. |
| Experimental `AgentExecutor` plan-and-execute workflow | Covered in the default deterministic gate, with behavior audit continuing | Continue only from upstream behavior gaps such as planning execution, tool observation, replanning, memory, human feedback, and native tool message semantics. Avoid private helper alias churn. |
| Provider request/response adapters | Documented deterministic shim | Test SDK-shaped request building, response parsing, streaming accumulation, usage extraction, file conversion, and error classification with fixtures. Live credentials and real SDK calls stay outside the default gate. |
| Storage, RAG, and vector backends | Documented deterministic shim | In-memory/fake-client lifecycle, filtering, reset, async aliases, and error conversion are release-gated. Real Qdrant, LanceDB, ChromaDB, and provider SDK coverage is optional only. |
| Telemetry, tracing, and evaluation listeners | Documented deterministic shim | Local span/event recording and evaluator behavior are release-gated. Remote exporters and OTLP upload paths are optional only. |
| CrewAI cloud/platform subscription, enterprise automations, hosted triggers, and remote dashboards | Intentionally unsupported in this port | Keep as documented boundaries. Do not port network/platform side effects into the default runtime. |
| Python-only optional runtime integrations | Intentionally unsupported or shimmed case-by-case | Prefer injected/local extractors or clear errors. Do not bundle Python-only dependencies into the TS package. |

## Behavior Gap Register

This register is the source of truth for continuing porting work while parity scripts report `missing=0`.

| Area | Status | Missing behavior to prove before coding | Intentionally unsupported boundary |
| --- | --- | --- | --- |
| Root/subpath exports and class method names | Parity gate green | None while export and method parity stay at `missing=0`. New aliases require a failing upstream example or behavior test. | Name-only compatibility churn is out of scope for release readiness. |
| Core Agent/Task/Crew/Flow/Memory/Knowledge/Tool workflows | Deterministically covered, audit by examples | Only workflows from current upstream examples or tests that fail with local LLM/tool fixtures. | None known beyond cloud/platform and live provider dependencies listed below. |
| Experimental `AgentExecutor` plan-and-execute | Deterministically covered, behavior audit continuing | End-to-end upstream gaps in planning execution, isolated step execution, observation/replan decisions, native tool execution, or human feedback loops. | Private helper parity without behavior impact is out of scope. |
| LLM providers and provider storage/files | Deterministic shim | SDK-shaped fixtures that fail request construction, response parsing, streaming accumulation, usage extraction, file conversion, or error classification. | Live OpenAI/Azure/Anthropic/Bedrock/Gemini credentials, network SDK calls, provider-hosted state, and remote file storage are optional integration scope only. |
| RAG/vector storage and embedding providers | Deterministic shim | Fake-client or in-memory behavior that fails lifecycle, filtering, reset, async, error-conversion, embedding config, or collection semantics. | Real Qdrant, LanceDB, ChromaDB, Vertex AI, hosted embedding services, and provider network credentials are optional integration scope only. |
| Telemetry/tracing/evaluation listeners | Deterministic shim | Local span/event/evaluator behavior that fails upstream-shaped event payloads or lifecycle ordering. | OTLP exporters, remote dashboards, hosted traces, and network upload paths are intentionally unsupported in the default gate. |
| CrewAI cloud/platform features | Intentionally unsupported | None unless represented as local metadata with no network side effects. | Subscription management, hosted triggers, enterprise automation, remote dashboards, and cloud identity workflows are outside this TS port's default scope. |
| Python-only optional parsers/integrations | Shimmed or unsupported case-by-case | Local injected extractor behavior that fails an upstream document workflow. | Bundling or invoking Python-only packages such as `pdfplumber`/Docling from the default TS package is out of scope. |

## Intentionally Unsupported Or Shimmed Areas

- CrewAI cloud/platform subscription features are outside this port's scope unless they can be represented as local deterministic metadata with no network side effects.
- Telemetry and trace upload paths are deterministic local span/event recordings. OpenTelemetry/remote trace exporters remain out of the default gate.
- RAG/vector storage integrations use deterministic in-memory or fake-client-backed shims in the default gate. Real Qdrant, LanceDB, ChromaDB, and provider SDK integration can be added later as optional peer-dependency coverage, but should not be required for release validation.
- LLM provider classes model request construction, capability flags, response parsing, usage extraction, streaming accumulation, file conversion, and error classification with SDK-like test doubles. Live OpenAI/Azure/Anthropic/Bedrock/Gemini SDK calls and real API credentials are intentionally outside the default gate.
- LLM usage normalization mirrors upstream `_usage_to_dict` behavior for dicts, private-field filtering, unsupported primitives, and model-like usage dumps without requiring live provider calls.
- LLM completion event usage payloads are normalized through the same deterministic `_usage_to_dict` behavior before event emission, so model-like usage objects and private fields do not leak into `LLMCallCompletedEvent.usage`.
- Azure `api: "responses"` is modeled as a deterministic shim over the OpenAI Responses adapter: endpoint-to-`/openai/v1/` base URL normalization, Responses request preparation, response-chain state delegation, config fields, and call/acall routing are release-gated without creating Azure SDK clients or making live calls.
- OpenAI Responses structured-output formatting is release-gated with deterministic schema-provider fixtures: local model-like schemas are converted to the flat `text.format` JSON schema shape expected by upstream Responses API requests.
- OpenAI SDK client parameter resolution is deterministic and release-gated: explicit `base_url` wins over `api_base`, which wins over `OPENAI_BASE_URL`, and `client_params` can override the assembled SDK params without constructing a live client.
- Provider-agnostic prompt-cache breakpoints are release-gated with deterministic OpenAI and Anthropic formatting tests: markers are stripped from wire payloads without mutating caller messages, Anthropic system/stable user blocks receive ephemeral cache control, assistant markers are ignored, and volatile tool-result carrier messages are not stamped.
- Google Vertex legacy `textembedding-gecko*` embeddings remain intentionally unsupported in the TypeScript runtime without Vertex AI SDK credentials; the current behavior raises a clear error.
- PDF/Excel/Docling-style optional parsing uses built-in or injected local extractors where possible. Python-only optional dependencies such as `pdfplumber` or Docling converters are not bundled.
- `crewai-files` typed file inputs are represented by deterministic local wrappers for path, bytes, stream, URL, image, PDF, text, audio, and video sources; URL references, provider-specific Bedrock URL fetch fallback, inline base64/bytes resolution, and injected-fetch URL reads are release-gated, while live provider uploaders and unmocked remote fetching remain outside the default gate.
- `crewai-files` upload tracking is represented by a deterministic in-memory `UploadCache` / `CachedUpload` shim with content-hash lookup, provider isolation, expiry cleanup, max-entry eviction, default cache reset, removal, async wrapper methods, provider-threshold resolver factory config, cached `FileReference` resolution, partial-success async batch resolution, and resolver cache controls; live provider uploaders remain outside the default gate.
- `crewai-files` provider constraints, file validators, and `FileProcessor` mode handling are deterministic local shims for size/type/duration checks, provider alias lookup, strict/warn/default processing, and async processing wrappers; image/PDF/audio/video metadata extraction and transformations stay best-effort or optional rather than adding Python-only dependencies.
- `crewai-files` text transformation is release-gated through deterministic `chunk_text` / `chunkText` behavior, including filenames, extension preservation, newline splitting, overlap, and `FileProcessor` CHUNK routing; Pillow/pypdf-backed image and PDF transformations remain explicit optional-dependency boundaries.
- JSON checkpoint storage is release-gated as a deterministic local filesystem shim: sync `checkpoint`, `prune`, and `from_checkpoint` calls now complete synchronously like upstream, while async wrappers remain available for async callers.
- SQLite checkpoint storage is release-gated as a deterministic local database shim: checkpoint payloads are validated and returned as canonical JSON like upstream's `jsonb(?)` / `json(data)` path, while branch, parent, prune, and async wrapper behavior remain in the default gate.
- `PickleHandler` remains a deterministic JSON-backed `.pkl` shim in the TypeScript runtime, but mirrors upstream corrupted-load behavior by surfacing a `pickle data was truncated` error instead of silently resetting damaged persistence files.
- MCP transports may use the installed JS SDK shape, but release tests should continue to rely on local/fake clients and error classification rather than live MCP servers.
- MCP native tool discovery is release-gated with deterministic fake-client behavior: empty or fully filtered tool lists warn and return no clients, and unexpected discovery failures are wrapped with a clear native MCP discovery error. Live MCP servers remain outside the default gate.
- Crew context metadata is release-gated with a deterministic `AsyncLocalStorage` shim rather than OpenTelemetry baggage: `CrewContext` carries upstream-style `id` and `key`, `get_crew_context` returns only an active scoped context, and `withCrewContext` preserves nested and throwing scopes.

## Known Remaining Porting Areas

The export surface is broad, but remaining work must be driven by behavior gaps rather than name-only compatibility.

High-value behavior audits still worth running:

1. **Upstream examples and docs smoke tests**
   - Translate current upstream examples into TS where practical.
   - Mark examples requiring cloud subscription/platform features as intentionally unsupported.
   - Any failing local example becomes the next behavior test.

2. **Experimental `AgentExecutor` plan-and-execute behavior**
   - Current TS implementation covers deterministic finalization, dynamic replanning triggers, object-style invoke setup, ReAct/native LLM routing, tool observations, native tool messages, memory save, human feedback, and plan refinement semantics.
   - TodoList behavior now covers upstream terminal dependency handling plus empty-string result preservation for completed/failed steps.
   - Continue auditing only with behavior tests for end-to-end plan generation, isolated step execution, observation/replan decisions, native tool execution, and human feedback loops.
   - Do not add private helper aliases unless the behavior test requires them.

3. **SDK-backed provider response translation**
   - Current provider shims cover deterministic request building and SDK-like response parsing.
   - Azure Responses API delegation, OpenAI Responses structured-output request formatting, and OpenAI SDK client parameter resolution are covered by local adapter fixtures; continue auditing other provider gaps with SDK-shaped responses rather than live credentials.
   - Audit upstream edge cases with SDK-shaped fixtures only.
   - Keep live API calls out of the default gate.

4. **Storage/RAG optional real-client behavior**
   - Current default gate uses deterministic shims and fake clients.
   - Any real-client integration should be optional and separately gated.

5. **Tracing/exporter integration**
   - Current behavior records deterministic local spans/events.
   - `CREWAI_TRACING_ENABLED=false` / `0` now mirrors upstream explicit tracing opt-out behavior even when local user consent state would otherwise allow tracing.
   - Remote exporter behavior remains intentionally unsupported unless the project decides to add an optional integration gate.
   - `Telemetry()` now mirrors upstream singleton construction behavior, and telemetry disable env vars such as `CREWAI_DISABLE_TELEMETRY=TRUE` / `OTEL_SDK_DISABLED=TRUE` dynamically suppress local telemetry operations after singleton creation.

## Resume Queue

When more goal budget is available, continue from the behavioral parity audits below. The next pass should stay test-driven: compare the Python upstream method contract, add focused tests for the missing or placeholder behavior, then implement the smallest TS-compatible behavior that keeps decorators standard-only.

## Completed In Current Storage/RAG Pass

- Added deterministic storage backend lifecycle parity for the TypeScript in-memory `QdrantEdgeStorage` and `LanceDBStorage` shims:
  - batch `save`/`asave`
  - positional and object-style `search`/`asearch`
  - metadata filters, category filters, segment-boundary-safe scope filters, min score, and limits
  - `delete`/`adelete`, `update`, `get_record`, `list_records`, `get_scope_info`, `list_scopes`, `list_categories`, `count`, and scoped/global `reset`
  - `touch_records`/`touchRecords`, `optimize`, `flush_to_central`/`flushToCentral`, `close`, and `aclose` maintenance hooks
  - `QdrantEdgeStorage` now carries deterministic `_build_config`, `_open_shard`, `_ensure_indexes`, `_record_to_point`, `_payload_to_record`, `_build_scope_filter`, `_scroll_all`, delete helper, central upsert, orphan cleanup, and local/closed state compatibility hooks.
  - `LanceDBStorage` now carries upstream-style table/compaction constructor options plus deterministic `_record_to_row`, `_row_to_record`, `_infer_dim_from_table`, `_ensure_table`, `_ensure_scope_index`, and compaction helper aliases.
- Replaced the root `StorageBackend` placeholder with the same deterministic lifecycle/filter/scope behavior used by the in-memory storage shims.
- Replaced root placeholder exports for `ChromaDBClient`, `KnowledgeStorage`, and `BaseKnowledgeStorage` with behavior-bearing implementations.
- Added fake-client-backed RAG tests for ChromaDB and Qdrant collection create/delete/reset, upsert overwrite behavior, search, metadata filters, and async aliases.
- Added `KnowledgeStorage` tests for collection naming, save/search, async aliases, and reset through the RAG client wrapper.
- `Knowledge.query` / `aquery` now honor upstream `results_limit` and `score_threshold` option names and the upstream default `score_threshold=0.6` when forwarding to storage search.
- The deterministic in-memory `Knowledge` search shim now preserves upstream vector-search-style recall under the default threshold by treating lexical hits as threshold-qualified results while still filtering no-hit documents.
- Agent knowledge search query generation now uses the upstream I18N prompt slices for the system and user messages before querying knowledge sources.
- Agent task execution now forwards upstream-style `knowledge_config` options such as `results_limit` and `score_threshold` into `Knowledge.query`.
- `Knowledge.add_sources` / `aadd_sources` now attach configured storage to each source and delegate through source `add` / `aadd` hooks before falling back to direct chunk saves.
- `KnowledgeStorage.reset` / `areset` now mirror upstream best-effort reset semantics by ignoring client deletion failures after attempting the reset.
- RAG optional-provider placeholders now mirror upstream missing optional import behavior by raising clear provider-specific errors instead of silently creating shim configs.
- `QdrantClient` now mirrors upstream sync/async client mismatch behavior by raising `ClientMethodMismatchError` when sync methods receive async clients or async methods receive sync clients.
- `ChromaDBClient` now mirrors upstream sync/async client mismatch behavior by raising clear TypeErrors when sync methods receive async clients or async methods receive sync clients.
- `ChromaDBClient.add_documents` / `aadd_documents` now mirror upstream upsert payload semantics by passing `metadatas: null` when an entire batch has no metadata.
- `ChromaDBClient.add_documents` / `aadd_documents` now use upstream collection lookup payloads and avoid forwarding add-only fields such as `documents` or `batch_size` to the Chroma client.
- `ChromaDBClient.search` / `asearch` now use the upstream default Chroma include ordering: `metadatas`, `documents`, then `distances`.
- `ChromaDBClient.search` / `asearch` now use upstream collection lookup payloads and avoid forwarding search-only fields such as `query`, `limit`, or `include` to the Chroma client.
- `ChromaDBClient.create_collection` / `get_or_create_collection` and async counterparts now use upstream SDK payload shapes without forwarding wrapper-only `collection_name` fields.
- `ChromaDBClient.delete_collection` / `adelete_collection` now use upstream SDK payload shapes and pass only the sanitized `name` field.
- Added upstream-style `KnowledgeStorage` save/asave error conversion for embedding dimension mismatches.
- Added upstream-style `KnowledgeStorage._get_client` plus collection-name helper aliases for storage extension compatibility.
- Added embedding provider config-field compatibility for OpenAI, Azure, SentenceTransformer, VoyageAI, VertexAI, HuggingFace, Instructor, Jina, Ollama, OpenCLIP, Text2Vec, Google Generative AI, Bedrock, Cohere, ONNX, Roboflow, and WatsonX defaults plus direct provider attribute access.
- OpenAI, Azure, Cohere, Google Generative AI, Google Vertex AI, and Jina embedding providers now accept upstream legacy `model` config keys as `model_name` aliases while preserving explicit `model_name` precedence.
- Added upstream-style embedding factory fallback so built-in provider specs instantiate their provider classes when no custom builder is registered.
- Added Google Vertex, VoyageAI, and WatsonX embedding function `name()` helpers, embedding function `__call__` aliases, plus WatsonX `validate_space_or_project` parity.
- `BaseRAGStorage` now exposes upstream-style `_initialize_agents` and `_sanitize_role` helpers alongside the TypeScript camelCase internals.

## Completed In Current Hooks/Tracing Pass

- `CREWAI_TRACING_ENABLED=false` / `0` now mirrors upstream explicit tracing opt-out behavior even when local user consent state would otherwise allow tracing.
- `Telemetry()` now mirrors upstream singleton construction behavior, and telemetry disable env vars such as `CREWAI_DISABLE_TELEMETRY=TRUE` / `OTEL_SDK_DISABLED=TRUE` dynamically suppress local telemetry operations after singleton creation.
- `BaseLLM._emit_call_completed_event` now normalizes usage payloads before constructing `LLMCallCompletedEvent`, preserving upstream dict/model-dump behavior and filtering private usage fields in the event stream.
- `LLMCallHookContext` now mirrors upstream executor-derived initialization by taking `messages`, `agent`, `task`, `crew`, `llm`, and `iterations` from the executor when explicit context fields are not supplied, while preserving the mutable `messages` reference used by before-call hooks.
- `LLMCallHookContext.request_human_input` and `ToolCallHookContext.request_human_input` now mirror upstream approval-hook behavior in a deterministic TS shim: live-update formatters are paused/resumed around input, responses are trimmed, Enter returns an empty string, and resume runs even when input throws. The default Node path remains non-blocking unless a host `globalThis.prompt` is supplied.
- `CrewBase` now registers hook-decorated class methods per instance, preserving bound `this`, tool/agent filters, global registration order, and `_registered_hook_functions` tracking without adding name-only helper surface.
- `ConsoleFormatter.pause_live_updates` now mirrors upstream HITL behavior by stopping and clearing an active streaming session, keeping repeated pauses safe, and letting later stream chunks create a new deterministic live-session shim.
- `EventBus.aemit` now mirrors upstream async emission behavior by running only async handlers and ignoring dependency ordering on that path; sync handlers and dependency plans remain covered by `emit`.
- `EventBus` now mirrors upstream shutdown flag behavior: setting `_shutting_down` suppresses both `emit` and `aemit` delivery, while `shutdown()` marks the bus as shutting down before flushing and clearing handlers.
- `CrewContext` / `get_crew_context` now mirror upstream crew-context metadata behavior with a local deterministic scope shim: no active scope returns `null`, active scopes expose `id` and `key`, and nested/exception paths restore the previous context.

## Completed In Current Core Behavior Pass

- `interpolateOnly` now mirrors upstream sequential replacement behavior for task prompt variables: placeholders introduced by an earlier variable value are resolved when the placeholder also appears later in the original template variable list, preserving deterministic task interpolation parity without adding alias/helper surface.
- Flow visualization router paths now prefer statically inferred return constants for each router before falling back to listener-trigger discovery, preventing chained/shared router output strings from creating extra route edges or self loops while preserving deterministic graph rendering.
- Flow visualization now emits upstream-style diagnostics when router return paths cannot be determined and when listeners wait on string triggers that no router explicitly outputs, keeping graph gaps visible in the deterministic gate.
- Flow structure serialization now lets child flow methods override inherited parent method metadata by method/kind, matching upstream inheritance behavior while still preserving inherited methods that are not overridden.

## Completed In Current Tool Behavior Pass

- `BaseTool.run` / `arun` argument validation now mirrors upstream schema behavior for LLM-generated kwargs: when an `argsSchema` is present, validated execution receives only schema fields plus defaults, hallucinated extra keys are stripped before `_run` / `_arun`, and usage counts do not increment on validation errors.
- `PickleHandler.load` now mirrors upstream corrupted persistence behavior for the JSON-backed TS shim: missing or empty files still load as `{}`, while malformed saved data raises `pickle data was truncated` instead of being silently discarded.
- `MCPToolResolver._resolve_native` now mirrors upstream deterministic native MCP resolver behavior for fake clients: when discovery yields no usable tools it logs a warning and returns `[[], []]`, and unexpected discovery failures are wrapped as native MCP tool discovery errors while still disconnecting the discovery client.

## Completed In Current AgentExecutor Behavior Pass

- `AgentExecutor.finalize` now mirrors upstream plan-and-execute finalization for strong final todo answers:
  - uses the last completed todo result directly when it is a sufficiently complete prose answer and not tied to a required tool
  - avoids the direct-answer shortcut when structured output is requested through `response_model` / `responseModel`
  - preserves the deterministic fallback step-summary behavior when the shortcut is not applicable
- `AgentExecutor` dynamic replanning now mirrors upstream deterministic routing triggers:
  - multiple failed todos include the upstream failure-count reason
  - multiple `Error:` todo results trigger replanning even when todos are marked completed
  - agent messages containing upstream replan indicators route to `needs_replan`
  - configured `max_replans` / `maxReplans` stops further dynamic replanning
- `AgentExecutor` observation routing now reads upstream `planning_config.reasoning_effort` as well as the TypeScript camelCase config shape.
- `AgentExecutor.execute_native_tool` now executes pending native tool calls against deterministic available-function/tool fixtures, appends tool messages, clears pending calls, and short-circuits remaining calls for `result_as_answer` tools.
- `AgentExecutor.invoke` / `invoke_async` object-style execution now honors provided kickoff routines and requires them to produce an `AgentFinish`, raising when execution ends on an action instead of a final answer.
- `AgentExecutor.invoke` setup now formats upstream-style `prompt.system` / `prompt.user` or `prompt.prompt` templates into state messages before kickoff.
- `AgentExecutor.invoke` setup now injects upstream-style `files` inputs into the last user prompt message for deterministic multimodal handoff.
- `AgentExecutor.invoke` / `invoke_async` now run kickoff inside an upstream-style LLM stop-word override scope without mutating the base LLM stop list.
- `AgentExecutor.invoke` / `invoke_async` now preserve `ask_for_human_input` and apply sync/async human-feedback handlers to the final answer before returning output.
- `AgentExecutor.invoke` / `invoke_async` now save final answers to unified memory through upstream-style extraction and agent root-scope routing when memory is configured.
- `AgentExecutor.handle_goal_achieved` now preserves pending todo status while routing to finalization, matching upstream early-goal state semantics.
- `AgentExecutor.handle_refine_and_continue` now applies the latest planner observation refinements to pending todos before continuing.
- `PlannerObserver.observe` now builds upstream-style observation prompts, parses deterministic LLM JSON responses into `StepObservation`, and falls back conservatively when observation LLM calls fail.
- `AgentExecutor.execute_todo_sequential` now executes planning-enabled todos through isolated `StepExecutor` context, records upstream-style step execution audit fields, and falls back to upstream-style todo prompt injection only when planning is disabled.
- `AgentExecutor.execute_tool_action` now records non-final tool observations and appends the upstream post-tool reasoning prompt before continuing.
- `AgentExecutor.check_todo_completion` now requires ReAct tool actions to match the running todo's expected tool when one is specified, while still accepting final answers and todos without a specified tool.
- `AgentExecutor.execute_native_tool` now records the upstream assistant `tool_calls` message and named tool result messages before continuing or short-circuiting.
- `AgentExecutor` replanning now builds previous-execution context, temporarily enhances the task description for the planner, preserves completed/failed history, and replaces only pending todos when a ready structured plan is returned.
- `AgentExecutor.call_llm_and_parse` and `call_llm_native_tools` now execute deterministic LLM calls, enforce local RPM hooks, omit structured `response_model` requests while tools are active, and route native tool-call lists into `pending_tool_calls`.
- `AgentExecutor.observe_step_result` now respects upstream `PlanningConfig.observe_steps` and `reasoning_effort`: medium/high run planner observation by default, low and explicit `observe_steps=false` use heuristic observation, and observation audit logs record whether an LLM observation occurred.
- `StepExecutor.execute` now runs `TodoItem` inputs through isolated step execution and returns a failed `StepResult` when an expected upstream `tool_to_use` is available but was not called.

## Completed In Current Flow/Persistence Pass

- Added upstream snake_case method compatibility for `JsonFlowPersistence` and `SQLiteFlowPersistence`:
  - `SQLiteFlowPersistence.init_db`
  - `save_state` / `load_state`
  - `save_pending_feedback` / `load_pending_feedback`
  - `clear_pending_feedback`
- Added `persistence_type` metadata on `JsonFlowPersistence` to match the persistence backend convention already present on SQLite.
- Added focused JSON and SQLite tests for these aliases, including pending-feedback round trip and clear semantics.
- `SQLiteFlowPersistence` now accepts upstream-style model dump state objects through `_to_state_dict` and exposes `_save_state_sql` for internal method parity.
- `Flow.fromPending` / `from_pending` now matches upstream pending-feedback restore defaults by creating `SQLiteFlowPersistence` when no backend is supplied.
- File store utilities now accept upstream-style object IDs with stable `toString()` keys for crew/task file storage, preserve task-level file overrides when merging, and cover sync/async retrieval with deterministic in-memory storage.
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
  - `sanitize_scope_name` now mirrors upstream root-scope name behavior for spaces, punctuation, unicode replacement, underscores, empty values, and null inputs.
  - `normalize_scope_path` and `join_scope_paths` now share upstream path normalization for collapsed slashes, trailing slashes, missing leading slashes, root-only children, and null root/child inputs.
  - `Memory.remember`, `aremember`, and background batch saves now honor upstream per-call `root_scope` / `rootScope` overrides when resolving final record scopes.
  - `Memory.remember` now applies upstream-style synchronous LLM save analysis when a local sync LLM is configured, so inferred scopes/categories/importance combine with `root_scope` on the sync save path.
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
  - EventBus now honors upstream-style `Depends` handler ordering and validates circular handler dependencies.
  - Event context now preserves enclosing agent scope after paired tool usage error events.
  - Event context stack depth limits, mismatch/empty-pop raise modes, and nested triggering-scope restoration are release-gated from upstream behavior tests.
  - runtime checkpoint serialization of completed methods, method outputs/counts, and flow state
  - `LockedListProxy`, `LockedDictProxy`, and `StateProxy` mutation helpers backed by the original state values
  - `LockedListProxy` / `LockedDictProxy` now expose upstream-style collection helpers such as `append`, `insert`, `remove`, `count`, `sort`, `reverse`, `copy`, `pop`, `setdefault`, and `items`
  - `LockedListProxy`, `LockedDictProxy`, and `StateProxy` now expose upstream-style dunder item, containment, iteration, and unwrap helpers for Python-port state code.
  - `RuntimeState.afrom_checkpoint` / `afromCheckpoint` and `StateProxy.model_dump` / `modelDump` aliases now mirror upstream async checkpoint restore and state dump helpers
  - `EventRecord.__contains__` now mirrors upstream event-id membership checks.
  - `EventRecord.model_dump_json` / `model_validate_json` now round-trip event payloads and relationship edges for checkpoint event history.
  - `RuntimeState.from_json` / `_deserialize` now restore serialized `event_record` payloads and keep old-format bare entity-list checkpoint JSON loadable.
  - `resume_task_scope` now restores the latest persisted `task_started` scope from runtime event records before a resumed task completion.
  - `Flow.pending_feedback`, `Flow.method_outputs`, and `Flow.flow_id` now expose upstream snake_case property aliases.
  - `Flow.model_post_init` now exposes the upstream post-init hook, emits `flow_created` idempotently, and preserves explicit disabled-memory configuration.
  - `Flow` now uses upstream-style static `initialState` / `initial_state` defaults when no constructor `initialState` is provided.
  - `Flow.kickoff` / `kickoffAsync` / `kickoff_async` / `akickoff` now accept upstream-style direct `inputs` arguments in addition to the TS options object.
- `humanFeedback` now validates upstream HITL routing configuration before decoration: `emit` requires a usable LLM, `defaultOutcome` requires `emit`, and defaults must be one of the emitted outcomes.
- Flow HITL routing now supports deterministic LLM-backed outcome collapse for injected local LLM clients, including JSON `outcome` responses and first-outcome fallback on LLM failure.
- Flow HITL learning now has deterministic local behavior for injected LLM clients: recalled memory lessons can pre-review method output before provider display, and non-empty feedback can distill new lessons into flow memory.
- `toSerializable` now mirrors upstream BaseModel serialization by honoring `modelDump` / `model_dump` output before object entry serialization, with recursive exclude handling.
  - `Flow.kickoff` / `kickoffAsync` now support upstream-style `restore_from_state_id` / `restoreFromStateId` fork hydration from persisted state without reusing the source flow ID and reject conflicting checkpoint restores.
  - `Flow.kickoff` / `kickoffAsync` now reload persisted state from `inputs.id` before applying non-id input overrides, matching upstream default-value override semantics.
  - Persisted Flow resume now skips pre-completed methods and continues downstream listeners, matching upstream listener resumability semantics.
  - Platform integration token context now has default-gate coverage for upstream env fallback, context precedence, empty token preservation, nested scope restoration, and exception restoration.
  - `Flow.plot` now emits `flow_plot` and writes an interactive HTML visualization through the existing flow structure renderer.
  - Flow visualization `CSSExtension` and `JSExtension` now expose upstream-style `parse` helpers for CSS/JS template tags.
  - `flow_structure` now has default-gate coverage for listener methods that become routers through `human_feedback(emit=[...])`.
  - `flow_structure` now mirrors upstream serializer validation by rejecting Flow instances and non-class inputs, while camelCase `flowStructure` continues to support TS instance metadata for standard decorators.
- Added adapter-level LLM provider parity helpers:
  - `BaseLLM.acall` now provides the upstream async call surface by formatting string/list messages and delegating through the concrete `call` implementation.
  - `BaseLLM.stop` direct assignment now stays synchronized with `stop_sequences`, including string and null assignments used by upstream provider/executor paths.
  - `UsageMetrics` now exposes upstream-style `model_dump` / `modelDump` serialization including reasoning and cache-creation token fields.
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
  - Anthropic completion shim now exposes upstream-style request parameter builders with system prompts, stop sequences, thinking config, thinking-block preservation across formatted assistant turns, custom tool conversion, single-tool forcing, and tool-search injection/deferred loading
  - Anthropic completion shim now exposes upstream-style SDK response token usage extraction, tool-use/structured-output response extraction, deterministic streaming event accumulation, and tool-result block execution helpers, including cache read and cache creation token fields
  - Anthropic completion usage extraction now handles SDK-like usage getter objects for cache read/create token metadata.
  - Bedrock completion shim now exposes upstream-style Converse request body builders, including Bedrock message content blocks, system prompts, inference config, raw OpenAI-style function tool conversion, multimodal image/document file blocks for Claude 3/4 models, toolConfig conversion, guardrail config, and additional model request/response fields
  - Bedrock completion shim now exposes upstream-style document/video content-type format mapping helpers for multimodal payload preparation.
  - Bedrock completion shim now exposes upstream-style client error classification for common AWS Bedrock error codes.
  - Bedrock completion shim now exposes upstream-style Converse token usage extraction/tracking, tool-use/structured-output response extraction, deterministic Converse streaming event accumulation, and tool-result follow-up message helpers, including cache read token fields
  - Gemini completion shim with upstream-style message formatting, generation config builders, raw OpenAI-style function tool conversion, function-call and structured-output response extraction/direct execution, deterministic streaming chunk accumulation, config, context-window, multimodal/text-formatting, token-usage extraction, response text extraction, property ordering, and content conversion helpers
  - Gemini message formatting now preserves upstream-style `raw_tool_call_parts` when present, falling back to JSON tool-call conversion otherwise.
  - Gemini completion shim now exposes the upstream-style `_extract_token_usage` alias for SDK usage translation compatibility.
  - Gemini token usage extraction and streaming accumulation now handle SDK-like `usage_metadata` getter objects.
  - Multimodal LLM message file handling now converts `files` into deterministic inline/upload content blocks, native OpenAI/Azure/Anthropic/Bedrock/Gemini shims expose local provider file uploaders, and Bedrock maps inline files into Converse image/document blocks.
  - Streaming tool-call argument accumulation now preserves id/name/index and concatenates function argument deltas into upstream-style tool call payloads
  - Provider tool conversion helpers now reject non-dictionary tools and invalid `function` payloads with upstream-style errors while preserving OpenAI/direct schema extraction.
- Added evaluation compatibility behavior:
  - `EvaluationScore` and `AgentAggregatedEvaluationResult` now expose upstream-style `__str__` aliases for their formatted summaries.
  - LLM-backed `GoalAlignmentEvaluator` and `SemanticQualityEvaluator` with upstream-style prompts and JSON score parsing
  - LLM-backed `ToolSelectionEvaluator`, `ParameterExtractionEvaluator`, `ToolInvocationEvaluator`, and `ReasoningEfficiencyEvaluator` now replace placeholder compatibility scoring with upstream-style unevaluable-trace handling, prompt construction, JSON score parsing, and metric-specific feedback.
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
  - `Telemetry.crew_creation` now records upstream-style `share_crew` platform details plus crew/agent/task fingerprint timestamps and metadata in the deterministic local span.
  - `TraceBatch` now defaults its batch version from the shared CrewAI version export, matching upstream trace batch manager metadata.
  - Tracing machine-id helpers now expose upstream-style Linux, generic-system, MAC, and fallback hashing behavior without network exporters.
  - `EventListener.setup_listeners` and `TraceCollectionListener.setup_listeners` now expose subclass-level upstream listener setup aliases.
  - `FirstTimeTraceHandler` now exposes upstream-style first-time trace collection state hooks and records local consent/completion without enabling cloud upload behavior.
- Added crew chat compatibility behavior:
  - `handleUserInput` now forwards the generated crew function schema and available function map to the chat LLM call so upstream-style conversational crew function calling can execute.
  - `check_conversational_crews_version` now accepts the upstream pyproject data argument and rejects invalid version strings instead of loosely parsing embedded digits.
  - `load_crew_and_name` now supports a project-specific TypeScript crew loader hook and an upstream-style `pyproject.toml` / `src/<project>/crew` CommonJS module fallback instead of unconditionally failing at runtime.
- Added converter compatibility behavior:
  - `asyncConvertToModel` / `asyncHandlePartialJson` now use the agent LLM fallback path for non-JSON or malformed partial JSON results, matching upstream async conversion dispatch.
  - `convertToModel` / `handlePartialJson` and `convert_with_instructions` now use an upstream-style synchronous agent LLM fallback for non-JSON or malformed partial JSON results when the configured LLM returns synchronously.
  - `createConverter` now mirrors upstream converter selection behavior: agent-provided output converter first, explicit converter class construction, and upstream-style error cases when no converter can be resolved.
  - `OutputConverter` now explicitly exposes upstream-style `to_pydantic` and `to_json` methods while preserving the shared converter implementation.
- Added output compatibility behavior:
  - `Task.prompt` and task execution prompts now use the upstream markdown instruction block when `markdown` is enabled.
  - `Task.aexecute_sync` now routes through the async agent execution path while preserving task context, tools, response model options, timestamps, and processed-agent tracking.
  - `TaskOutput.messages` now captures the agent execution messages from the task run, matching upstream task-output inspection behavior.
  - `TaskOutput.set_summary` now exposes the upstream summary recomputation hook while preserving constructor-time summary defaults.
  - `TaskOutput`, `CrewOutput`, and `LiteAgentOutput` now expose upstream-style `__str__` aliases, and `CrewOutput.__getitem__` mirrors keyed pydantic/json access.
  - `CrewStreamingOutput.results` now exposes upstream-style list access for completed streaming crew results.
  - `StreamingOutputBase` now exposes upstream-style `__aenter__` / `__aexit__` async context-manager aliases that close/cancel unfinished streams.
  - `StreamChunk.__str__` and `StreamingOutputBase.__iter__` now mirror upstream string and sync-iteration helpers.
  - `InternalInstructor.to_pydantic` now exposes upstream-style structured conversion through a provided synchronous LLM client and model validation/dump hooks.
- `Task._export_output` / `_aexport_output` now preserve already-converted structured output model instances instead of re-validating or calling class-style models as raw-output converters.
- `PendingFeedbackContext` now mirrors upstream value-object behavior with snake_case construction, JSON-safe `to_dict` serialization, and `from_dict` restoration while preserving existing flow pause/resume context fields.
- Added knowledge compatibility behavior:
  - `Knowledge` now accepts storage-backed configuration and exposes upstream-style `add_sources`, `aadd_sources`, `aquery`, and `areset` helpers while preserving the in-memory deterministic path.
  - Knowledge sources now expose upstream-style `add`, `aadd`, `validate_content`, and `get_embeddings` helpers and can save their chunks through configured storage.
  - `BaseKnowledgeSource` now replaces the root placeholder with chunking, embedding-list, and sync/async storage save helpers.
  - `BaseFileKnowledgeSource` now replaces the root placeholder with upstream-style `file_path` / `file_paths`, `safe_file_paths`, `content`, `convert_to_path`, `load_content`, and validation helpers shared by file-backed sources.
  - `CrewDoclingSource` now supports upstream-style document conversion/chunking through injected local converter and chunker adapters while preserving the optional-dependency error when no converter is provided.
  - File-backed knowledge sources now expose upstream-style `_load_content` and `_process_file_paths` helper aliases used by PDF/Excel/Text/JSON/CSV source implementations.
  - `StringKnowledgeSource` and file-backed text sources now expose upstream-style `source_type`, `model_post_init`, and `_chunk_text` helpers where applicable.
  - `extractKnowledgeContext` / `extract_knowledge_context` now filter empty, null, missing-content, and non-object search results before building upstream-style additional-information context.
- `MemoryRecord` and `MemoryMatch` default JSON serialization now excludes embedding vectors while preserving embeddings for vector search, matching upstream's token-saving memory serialization boundary.
- Added tool compatibility behavior:
  - `BaseTool` / `StructuredTool` now expose upstream-style `tool_type`, `model_post_init`, `validate_max_usage_count`, and `from_langchain` helpers.
  - `ToolUsage` now exposes upstream-style `on_tool_error` and `on_tool_use_finished` event helpers, including snake_case event payload aliases and fingerprint metadata passthrough.
  - `CacheTools.hit_cache` now exposes the upstream direct cache lookup helper used by the generated cache tool.
- Added MCP compatibility behavior:
  - `BaseTransport` and `MCPClient` now expose upstream-style `__aenter__` / `__aexit__` async context-manager aliases.
  - `MCPClient.list_prompts` and `get_prompt` now normalize SDK prompt responses into upstream-style prompt definition and prompt-content shapes.
  - `MCPToolWrapper._run_async` now returns upstream-style classified execution error strings instead of leaking wrapper execution exceptions.
  - `StaticToolFilter.__call__` now mirrors upstream callable filter semantics while preserving the existing `filter`/`call` helpers.
  - `create_model_from_schema` now returns an upstream-style model-like schema validator for MCP/tool JSON schemas, including explicit `root_schema` ref resolution, creation-time unsupported-type rejection, required fields, optional `null` defaults, enum/const rejection, string/numeric field constraints, supported date/date-time/time format checks with JS `Date` object acceptance and string-to-`Date` coercion for date/date-time fields, closed-object extra-field rejection, nested, recursive, and mutually recursive objects, arrays, `$ref`, `allOf`, `anyOf`/`oneOf`, and enriched field descriptions.
- Added project wrapper compatibility behavior:
  - `TaskMethod` now exposes upstream-style `ensure_task_name` and applies default task names on direct `call`/`invoke` paths.
  - `DecoratedMethod`, `TaskMethod`, and `BoundTaskMethod` now expose upstream-style `__call__` aliases for direct wrapper invocation.
  - `CrewAIPlugin.get_class_decorator_hook` now exposes a deterministic no-op-compatible mypy plugin hook surface for `CrewBase` decorator metadata.
  - `FlowMethod.__call__` now mirrors upstream flow wrapper direct invocation for bound and unbound flow methods.
- Added agent adapter compatibility behavior:
  - `OpenAIAgentAdapter` and `LangGraphAgentAdapter` now expose upstream-style direct `execute_task`, `configure_tools`, `configure_structured_output`, delegation-tool creation, and LangGraph output converter helpers while staying deterministic and SDK-free in the default gate.
  - `BaseAgentAdapter` now preserves upstream-style `_agent_config` initialization state alongside the TypeScript camelCase/snake_case config fields.
  - `BaseToolAdapter` now mirrors upstream instance `sanitize_tool_name` usage and returns Python-style `converted_tools` storage from `tools()`.
- Added hooks compatibility behavior:
  - Filtered hook decorator factories now register upstream-style global wrappers for function hooks, preserve snake_case marker metadata, and apply sanitized tool/agent filters.
  - Filtered hook wrapper classes now expose upstream-style `__call__` aliases while preserving existing `call` helpers.
  - LLM hook transport subpath now exports upstream-style synchronous `HTTPTransport.handle_request` alongside `AsyncHTTPTransport`.
  - `BaseInterceptor` now exposes upstream-style Pydantic schema and interceptor validation hooks for model compatibility.
- Added planning compatibility behavior:
  - ReAct agent parser `_safe_repair_json` now handles upstream loose tool-input JSON cases such as markdown-prefixed inputs, trailing commas, single quotes, missing colons/commas, unclosed objects, unquoted string values, and trailing text.
  - `StepObservation.coerce_single_refinement_to_list` now exposes the upstream validator helper for single refinement objects.
  - `PlannerObserver.apply_refinements` now applies structured observation refinements to remaining todo descriptions in place.
  - `StepExecutor.execute` now exposes the upstream todo-item execution alias while preserving the existing TypeScript `executeStep` path.
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
  - A2UI standard/basic catalog validation now skips unknown custom components and validates required fields for known v0.8/v0.9 components.
  - A2UI server response DataParts now serialize validated payloads without null fields or duplicate snake_case aliases, matching upstream `model_dump(by_alias=True, exclude_none=True)` behavior.
  - A2UI client response processing now stores extracted messages with the same alias-only non-null serialization used by upstream.
  - A2UI conversation history restore now flattens v0.8 `dataModelUpdate.contents` while preserving v0.9 `updateDataModel` objects, matching upstream state aggregation.
  - A2UI conversation history restore now honors snake_case message aliases for begin/update/delete/data-model payloads.
  - A2A client `ExtensionRegistry` now keys conversation state by extension type and invokes alias hook pairs once, matching upstream registry dispatch semantics.
  - `A2AClientConfig` now validates client extension protocol methods at construction, matching upstream `ValidatedA2AExtension` behavior while preserving camelCase/snake_case aliases.
- Added security compatibility behavior:
  - `Fingerprint` now exposes the upstream-style `__str__` alias for UUID string conversion.
  - `SecurityConfig.validate_fingerprint` now exposes upstream-style fingerprint coercion for null, seed strings, dicts, and `Fingerprint` instances.
  - `Fingerprint` and `SecurityConfig` now pin upstream lifecycle behavior for direct UUID/timestamp construction, lazy invalid-UUID validation, metadata mutation, direct fingerprint replacement, and JSON round-trips.
- Added guardrail compatibility behavior:
  - `GuardrailResult.validate_result_error_exclusivity` now exposes the upstream validator helper for result/error mutual exclusivity.
  - `LLMGuardrail.__call__` and `HallucinationGuardrail.__call__` now mirror upstream direct guardrail invocation while preserving the existing `call`/`asGuardrail` helpers.
  - `Task`, `Agent`, and `LiteAgent` model-dump JSON paths now drop callable guardrails with upstream-style warnings while preserving serializable string guardrails.
- Added skills compatibility behavior:
  - `SkillFrontmatter.parse_allowed_tools` now exposes the upstream frontmatter pre-parse helper for space-delimited allowed tool lists.
  - `SkillFrontmatter` now keeps `version` under `metadata.version` like the upstream agentskills spec and ignores top-level `version` during `SKILL.md` normalization.
  - `SkillCacheManager.store` now unpacks registry tar.gz and zip archive bytes into the local cache with upstream-style metadata and path traversal protection.
- Added i18n compatibility behavior:
  - `I18N.load_prompts` now exposes upstream-style prompt catalog reload semantics for custom prompt files and default prompts.
  - `StandardPromptResult` now exposes upstream-style `__getitem__` and `__contains__` access for dict-like prompt result usage.
- Added LiteAgent compatibility behavior:
  - `LiteAgent` now exposes upstream-style setup/helper methods for LLM setup, tool parsing, A2A setup, guardrail validation, and memory resolution.
  - `LiteAgent` now exposes before/after LLM hook getters, an upstream-style `key` property getter, and resolves `memory: true` to a default `Memory` instance.
- Added token usage compatibility behavior:
  - `TokenProcess` now exposes upstream-style mutable token counters and `sum_*` helpers while preserving message-array prompt token estimation.
- Added converter compatibility behavior:
  - `validateModel`, `convertToModel`, and `handlePartialJson` now tolerate literal JSON control characters inside string values before structured model validation, while non-JSON curly blocks still fall through to the configured conversion fallback or raw output.
- Added version compatibility behavior:
  - Root `version`, `__version__`, `get_crewai_version`, and runtime checkpoint metadata now report the upstream CrewAI version from the current upstream clone.

1. Storage backends
   - `memory/storage/backend.py`
   - `memory/storage/lancedb_storage.py`
   - `memory/storage/qdrant_edge_storage.py`
   - `knowledge/storage/*`
   - The deterministic in-memory TypeScript shims now cover sync/async save/search/delete/update/reset semantics, metadata filtering, access-time touching, maintenance hooks, LanceDB row conversion/compaction helper compatibility, and Qdrant Edge point/payload/scope-filter helper compatibility.
   - Remaining: any provider-specific LanceDB/Qdrant SDK behavior that would require carrying real storage SDK integration outside the default deterministic gate.

2. LLM providers
   - OpenAI, Azure, Anthropic, Bedrock, Gemini provider classes.
   - `to_config_dict`, context window, adapter-level function-calling support, deterministic multimodal support flags, response-chain/reset compatibility, file input content-block conversion, local uploader compatibility, Bedrock Converse multimodal image/document conversion, streaming tool-call accumulation, OpenAI/Anthropic/Bedrock SDK usage extraction, OpenAI Responses built-in output parsing and streaming event accumulation, Anthropic/Bedrock event accumulation, Anthropic thinking-block turn preservation, Anthropic tool-search/native tool passthrough, Anthropic and Bedrock tool-result helpers, Bedrock Converse grouping for single, parallel, and turn-separated tool results, Gemini function-call direct execution and streaming chunk accumulation, Anthropic/Bedrock/Gemini function-call/structured-output response extraction, and OpenAI/Azure/Anthropic/Bedrock/Gemini request builders are now covered for the native provider shims.
   - Remaining: deeper SDK-backed response translation details.
   - Keep provider tests adapter-level and mock network calls. Do not introduce live API keys or provider-specific SDK side effects into the default test gate.

3. Flow and persistence
   - `Flow` checkpoint/fork/resume/pending feedback/memory methods.
   - `SQLiteFlowPersistence` method parity and real persistence behavior.
   - Prioritize persistence replay and resume behavior because it affects user-visible workflow recovery.
   - Flow persistence backends now expose upstream snake_case aliases for state and pending-feedback lifecycle methods.
   - Flow now supports auto memory plus `remember`, `recall`, and `extract_memories` delegation.
   - Flow checkpoint snapshots now restore/fork completed methods, method outputs/counts, and state through `from_checkpoint`/`fork`; kickoff-time `from_checkpoint` delegates to the restored flow and does not replay completed methods; restored checkpoint RuntimeState is wired through the event bus and handlers can receive it as a third argument; locked dict/list proxies now mutate the backing values.
   - `Flow.ask` now mirrors upstream input durability by saving an `_ask_checkpoint` state snapshot before invoking the input provider, preserving state gathered before a blocking or timed-out human input wait.
   - SQLite persistence now accepts upstream-style `model_dump` / `modelDump` state objects for saved flow state and pending feedback state.
   - Remaining: any additional Pydantic/BaseModel-only state behavior that has no direct TypeScript equivalent yet.

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
   - Telemetry span methods now record deterministic local `RecordedSpan` objects for task/tool/test/crew/flow/environment/human-feedback/feature/template telemetry, including `share_crew` platform/fingerprint payload details, without external OTLP side effects.
   - Remaining: deeper OpenTelemetry exporter integration can stay outside the default gate unless the project decides to carry SDK-backed telemetry coverage.

## Suggested Next Order

1. Run translated upstream examples against the local TS runtime; promote failures into behavior tests.
2. Audit `AgentExecutor` plan-and-execute behavior end to end, not by private helper name count.
3. Add SDK-shaped fixture tests for provider edge cases only when they expose missing response/request behavior.
4. Keep deterministic storage/RAG shims in the default gate; document real-client differences unless optional integration gates are added.
5. Sweep telemetry/tracing by behavior category: local deterministic spans are covered, remote upload/export remains intentionally unsupported.

## Useful Audit Commands

Run full validation:

```bash
npm test && npm run lint && npm audit --omit=dev && npm run build && npm run smoke:pack && \
UPSTREAM_CREWAI_SRC=/tmp/crewai-upstream-current/lib/crewai/src/crewai python3 scripts/check-export-parity.py && \
UPSTREAM_CREWAI_SRC=/tmp/crewai-upstream-current/lib/crewai/src/crewai python3 scripts/check-class-method-parity.py && \
UPSTREAM_CREWAI_SRC=/tmp/crewai-upstream-current/lib/crewai/src/crewai python3 scripts/check-subpath-export-parity.py && \
UPSTREAM_CREWAI_SRC=/tmp/crewai-upstream-current/lib/crewai/src/crewai node scripts/check-a2ui-schema-parity.mjs
```

Check root export parity:

```bash
python3 scripts/check-export-parity.py
```

Set `UPSTREAM_CREWAI_SRC=/path/to/crewAI/lib/crewai/src/crewai` when comparing against a fresh upstream clone.

Class-method parity is useful as a regression check, but it is no longer a prioritization mechanism. Prefer behavior audits and upstream example compatibility tests.
