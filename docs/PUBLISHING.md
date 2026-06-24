# Publishing

crewai-ts releases should go through Changesets and CI, not local npm commands.

## Normal flow

1. Add a changeset in the feature PR when a package needs a version bump:
   `pnpm changeset`
   Public API, behavior, dependency, and package metadata changes need a changeset; docs-only and internal-only changes usually do not.
2. Merge feature PRs to the default branch after review and CI.
3. Let the Changesets Release PR collect pending changesets and update package versions and changelogs.
4. Review the Release PR for correct package versions, changelog text, and CI status.
5. Merge the Release PR. CI owns the npm publish step and any release tags required by the configured automation.
6. Verify the published packages with `npm view @crewai-ts/<package> version`.

## Guardrails

- Do not run `npm publish`, `pnpm publish`, `pnpm release`, or `changeset publish` locally.
- Do not create or push local release tags to trigger publishing.
- Do not bypass a missing or broken Changesets Release PR with a manual release.
- If automation is missing, incomplete, or failing, fix it in a reviewed PR first.

The local pre-push hook blocks release tag pushes matching:

- `refs/tags/v*`
- `refs/tags/@crewai-ts/*@*`
- `refs/tags/nestjs-v*`

Use `ALLOW_CREWAI_TS_MANUAL_RELEASE_TAG_PUSH=1` only for an explicitly approved break-glass operation.
