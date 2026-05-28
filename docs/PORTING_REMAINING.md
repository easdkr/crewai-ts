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

1. Storage backends
   - `memory/storage/backend.py`
   - `memory/storage/lancedb_storage.py`
   - `memory/storage/qdrant_edge_storage.py`
   - `knowledge/storage/*`
   - Verify sync/async save/search/delete/update/reset semantics and metadata filtering.

2. LLM providers
   - OpenAI, Azure, Anthropic, Bedrock, Gemini provider classes.
   - Fill `to_config_dict`, context window, function calling support, multimodal support, file uploader, response-chain/reset APIs.

3. Flow and persistence
   - `Flow` checkpoint/fork/resume/pending feedback/memory methods.
   - `SQLiteFlowPersistence` method parity and real persistence behavior.
   - Locked dict/list proxy behavior.

4. Unified memory
   - Async aliases and record/scope/category listing.
   - `remember_many`, `extract_memories`, `update`, `drain_writes`, `close`.
   - `MemoryScope` / `MemorySlice` methods like `bind`, `read_only`, `tree`, `list_categories`.

5. RAG clients
   - ChromaDB/Qdrant client method parity.
   - Async aliases and collection lifecycle behavior.

6. Evaluation and tracing listeners
   - Agent evaluator display/event helper methods.
   - Evaluation trace callback listener hooks.
   - Telemetry span methods are mostly compatibility placeholders and should be audited.

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
