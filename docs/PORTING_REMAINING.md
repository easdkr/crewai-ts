# CrewAI TypeScript Port - Remaining Work

This repository is a TypeScript port of `crewAIInc/crewAI`, with TS 5 standard decorators only. Keep `experimentalDecorators: false`; do not add `reflect-metadata`, parameter decorators, or Nest metadata integration. Nest should consume this as a normal TypeScript library.

## Current Verified State

- Full gate passed on 2026-05-28:
  - `npm run check`
  - `npm test`
  - `npm run build`
  - `npm run lint`
  - `npm run smoke:pack`
- Test suite: 292 passing tests.
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
  - metadata filters, category filters, scope filters, min score, and limits
  - `delete`/`adelete`, `update`, `get_record`, `list_records`, `get_scope_info`, `list_scopes`, `list_categories`, `count`, and scoped/global `reset`
- Replaced root placeholder exports for `ChromaDBClient`, `KnowledgeStorage`, and `BaseKnowledgeStorage` with behavior-bearing implementations.
- Added fake-client-backed RAG tests for ChromaDB and Qdrant collection create/delete/reset, upsert overwrite behavior, search, metadata filters, and async aliases.
- Added `KnowledgeStorage` tests for collection naming, save/search, async aliases, and reset through the RAG client wrapper.

## Completed In Current Flow/Persistence Pass

- Added upstream snake_case method compatibility for `JsonFlowPersistence` and `SQLiteFlowPersistence`:
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
  - `MemoryScope` / `MemorySlice` `remember_many`, `extract_memories`, and `bind`
- Added Flow checkpoint restoration/fork compatibility plus mutable locked proxy behavior:
  - `Flow.fromCheckpoint` / `Flow.from_checkpoint`
  - `Flow.fork`
  - kickoff-time `fromCheckpoint` / `from_checkpoint` resume without replaying completed methods
  - EventBus `runtimeState` / `runtime_state`, `setRuntimeState` / `set_runtime_state`, and third-argument runtime state delivery to handlers
  - runtime checkpoint serialization of completed methods, method outputs/counts, and flow state
  - `LockedListProxy`, `LockedDictProxy`, and `StateProxy` mutation helpers backed by the original state values
- Added adapter-level LLM provider parity helpers:
  - `supportsFunctionCalling` / `supports_function_calling`
  - native OpenAI/Azure/Anthropic/Bedrock support overrides for function calling, stop words, and multimodal capability where deterministic
  - OpenAI/Azure response-chain compatibility getters and reset methods (`last_response_id`, `last_reasoning_items`, `reset_chain`, `reset_reasoning_chain`)
  - Gemini completion shim with deterministic config, context-window, multimodal/text-formatting, token-usage extraction, response text extraction, property ordering, and content conversion helpers

1. Storage backends
   - `memory/storage/backend.py`
   - `memory/storage/lancedb_storage.py`
   - `memory/storage/qdrant_edge_storage.py`
   - `knowledge/storage/*`
   - The deterministic in-memory TypeScript shims now cover sync/async save/search/delete/update/reset semantics and metadata filtering.
   - Remaining: audit persistence-specific LanceDB/Qdrant Edge details that do not map to the no-SDK TypeScript shim yet, including compaction, central/local shard flushing, and provider-specific index behavior.

2. LLM providers
   - OpenAI, Azure, Anthropic, Bedrock, Gemini provider classes.
   - `to_config_dict`, context window, adapter-level function-calling support, deterministic multimodal support flags, response-chain/reset compatibility, and Gemini adapter helpers are now covered for the native provider shims.
   - Remaining: SDK-backed request/response translation details, streaming function-call accumulation, and file uploader integrations.
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
   - `remember_many`, `extract_memories`, `update`, `drain_writes`, `close`.
   - These compatibility helpers are now present in the deterministic TS memory shim; remaining work is deeper async/background write and LLM-powered extraction parity.
   - `MemoryScope` / `MemorySlice` methods like `bind`, `read_only`, `tree`, `list_categories`.
   - Confirm the intended TS shape for scoped memory before widening public types, so Python aliases do not force an awkward API.

5. RAG clients
   - ChromaDB/Qdrant client method parity.
   - Async aliases and collection lifecycle behavior.
   - Fake-client tests now cover collection creation, deletion, reset, upsert/search, overwrite behavior, metadata filters, and async aliases.
   - Remaining: optional real-client integration can be added outside the default gate if the project decides to carry provider SDK peer dependency coverage.

6. Evaluation and tracing listeners
   - Agent evaluator display/event helper methods.
   - Evaluation trace callback listener hooks.
   - Telemetry span methods are mostly compatibility placeholders and should be audited.
   - Separate no-op compatibility shims from behavior-bearing event hooks in tests, so placeholders stay intentional.

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
