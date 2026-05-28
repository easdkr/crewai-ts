# Goal: Continue CrewAI TypeScript Port Behavioral Parity

## Objective

Continue the CrewAI TypeScript port from the current verified state by closing behavioral parity gaps, starting with storage and RAG behavior. Keep the project compatible with TS 5 standard decorators only.

## Non-Negotiables

- Keep `experimentalDecorators: false`.
- Do not add `reflect-metadata`, parameter decorators, or Nest metadata integration.
- Treat Nest consumption as normal TypeScript library usage.
- Prefer test-driven changes: add focused failing tests first, then implement the smallest compatible behavior.
- Mock provider/network integrations in default tests. Do not require live API keys.

## Current Verified Baseline

As of 2026-05-28:

- `npm run check`
- `npm test`
- `npm run build`
- `npm run lint`
- `npm run smoke:pack`
- Test suite: 292 passing tests.
- Root export parity against upstream clone `/tmp/crewai-upstream.lPeuQi/crewAI` at commit `2148c7e`: `total_missing=0`.
- Core public method parity tightened for `ConsoleFormatter`, `Task`, `AgentExecutor`, `Crew`, `Agent`, and `BaseAgent`.

## First Workstream

Start with storage and RAG parity because they share deterministic save/search/delete/filter semantics.

### Storage Backends

Audit and implement behavior parity for:

- `memory/storage/backend.py`
- `memory/storage/lancedb_storage.py`
- `memory/storage/qdrant_edge_storage.py`
- `knowledge/storage/*`

Expected test coverage:

- save/search/delete/update/reset lifecycle
- sync and async aliases
- id overwrite/update behavior
- metadata filter matching
- vector store reset semantics
- knowledge storage lifecycle

### RAG Clients

Audit and implement behavior parity for ChromaDB/Qdrant client wrappers.

Expected test coverage:

- collection creation
- collection deletion
- upsert/search
- metadata filters
- async aliases
- fake-client behavior in unit tests, optional real-client integration left out of default gate

## Suggested Next Order

1. Storage backends.
2. RAG clients.
3. Flow checkpoint/fork/resume/pending feedback/persistence behavior.
4. Unified memory aliases, scoped records, `remember_many`, `extract_memories`, `update`, `drain_writes`, `close`.
5. LLM provider compatibility: OpenAI, Azure, Anthropic, Bedrock, Gemini.
6. Evaluation/tracing listener hooks and intentional telemetry placeholders.

## Useful Commands

Run the full validation gate:

```bash
npm run check && npm test && npm run build && npm run lint && npm run smoke:pack
```

Check root export parity:

```bash
python3 scripts/check-export-parity.py
```

Compare against a fresh upstream clone when needed:

```bash
UPSTREAM_CREWAI_SRC=/path/to/crewAI/lib/crewai/src/crewai python3 scripts/check-export-parity.py
```

## Done Criteria For Next Goal

- Storage and RAG parity gaps are audited against upstream Python source.
- New tests cover the behavior added in the next pass.
- Full validation gate passes.
- `docs/PORTING_REMAINING.md` is updated with completed work and any newly discovered gaps.
- Changes are committed and pushed to GitHub.
