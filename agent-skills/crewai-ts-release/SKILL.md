---
name: crewai-ts-release
description: Use when planning, reviewing, or executing crewai-ts versioning, Changesets Release PRs, npm publishing, or release-tag work.
---

# crewai-ts Release

Use the Changesets Release PR flow. Feature PRs may add changesets, but release PRs own version bumps, changelog updates, tags, and npm publishing.
Read `docs/PUBLISHING.md` first when it is available; treat it as the repository source of truth.

## Workflow

1. Confirm the package change has an appropriate changeset.
2. Wait for the Changesets Release PR to aggregate pending changesets.
3. Review package versions, changelog entries, and CI.
4. Merge the Release PR and let CI publish to npm.
5. Verify with `npm view @crewai-ts/<package> version`.

## Guardrails

- Do not run local `npm publish`, `pnpm publish`, `pnpm release`, or `changeset publish`.
- Do not create or push release tags locally.
- Do not bypass broken release automation; fix the automation in a reviewed PR.
- Treat `ALLOW_CREWAI_TS_MANUAL_RELEASE_TAG_PUSH=1` as break-glass only after explicit maintainer approval.
