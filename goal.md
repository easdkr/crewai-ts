# Goal: Continue CrewAI TypeScript Port Behavioral Parity

## Objective

Continue the CrewAI TypeScript port from the current verified state by closing
behavioral parity gaps against upstream CrewAI. Work must stay deterministic,
test-driven, and compatible with TS 5 standard decorators only.

## Resume Checkpoint

Last checkpoint before the token-budget interruption:

- Date: 2026-06-02
- Branch: `main`
- HEAD: `ecaca59` (`Align Responses reasoning empty state`)
- Remote sync: `origin/main` points at the same commit.
- Worktree status at handoff: clean.
- Upstream source used by the current ledger:
  `/tmp/crewai-upstream-current/lib/crewai/src/crewai` at commit
  `4dafb05735dfa0d6e265eaccbe784b820e8fbfad`.

The current release ledger is `docs/PORTING_REMAINING.md`. Read it first before
starting another goal run.

## Non-Negotiables

- Keep `experimentalDecorators: false`.
- Do not add `reflect-metadata`, parameter decorators, or Nest metadata
  integration.
- Treat Nest consumption as normal TypeScript library usage.
- Prefer test-driven changes: add focused failing tests first, then implement
  the smallest compatible behavior.
- Mock provider/network integrations in default tests. Do not require live API
  keys, live cloud accounts, provider SDK side effects, or remote CrewAI
  platform services.
- Do not add name-only aliases just because a parity script reports a symbol
  difference. Alias/helper surface must be justified by an upstream example,
  documented workflow, or behavior test.

## Current Verified Baseline

As of 2026-06-02, the full validation gate passed:

```bash
npm test
npm run lint
npm audit --omit=dev
npm run build
npm run smoke:pack
python3 scripts/check-export-parity.py
python3 scripts/check-class-method-parity.py
python3 scripts/check-subpath-export-parity.py
node scripts/check-a2ui-schema-parity.mjs
```

Known gate results from the ledger:

- Test suite: 851 passing tests.
- Root export parity: `total_missing=0`.
- Core public class method parity: `total_missing=0`.
- Subpath export parity: `total_missing=0`, `total_mismatched=0`.

## Next Goal Run

Start with behavior audits, not parity-script mining. A good next run is:

1. Pick one upstream behavior surface from `docs/PORTING_REMAINING.md` that is
   still marked as audit-worthy.
2. Compare the current upstream Python contract or upstream examples.
3. Add a focused failing deterministic test in `test/index.test.ts` or the
   narrowest existing test location.
4. Implement the smallest TS-compatible behavior.
5. Run the focused test, then the full validation gate.
6. Update `docs/PORTING_REMAINING.md` with the completed behavior or any newly
   classified unsupported/shimmed boundary.
7. Commit and push to `main`.

Recommended next audit candidates:

- Upstream examples and docs smoke tests that can run with local LLM/tool
  fixtures.
- Remaining `AgentExecutor` plan-and-execute behavior, especially end-to-end
  planning execution, isolated step execution, observation/replan decisions,
  native tool execution, and human feedback loops.
- SDK-shaped provider response translation gaps using fixtures only.
- Optional storage/RAG real-client behaviors only if they can be kept outside
  the default deterministic gate.
- Tracing/exporter behavior only as local deterministic span/event recording;
  remote exporters remain optional and unsupported by default.

## Useful Commands

Run the full validation gate:

```bash
npm test
npm run lint
npm audit --omit=dev
npm run build
npm run smoke:pack
python3 scripts/check-export-parity.py
python3 scripts/check-class-method-parity.py
python3 scripts/check-subpath-export-parity.py
node scripts/check-a2ui-schema-parity.mjs
```

Check current status before resuming:

```bash
git status --short
git log --oneline -5 --decorate
```

Compare against a fresh upstream checkout when needed:

```bash
UPSTREAM_CREWAI_SRC=/path/to/crewAI/lib/crewai/src/crewai python3 scripts/check-export-parity.py
UPSTREAM_CREWAI_SRC=/path/to/crewAI/lib/crewai/src/crewai python3 scripts/check-class-method-parity.py
UPSTREAM_CREWAI_SRC=/path/to/crewAI/lib/crewai/src/crewai python3 scripts/check-subpath-export-parity.py
```

## Done Criteria For Next Goal

- One behavior gap is proven by a focused deterministic test.
- The smallest compatible implementation is added.
- Full validation gate passes.
- `docs/PORTING_REMAINING.md` is updated with the completed behavior and any
  newly discovered gap classification.
- Changes are committed and pushed to GitHub.
