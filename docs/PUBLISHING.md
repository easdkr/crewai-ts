# Publishing

crewai-ts releases should go through Changesets and CI, not local npm commands.

## Normal flow

1. Add a changeset in the feature PR when a package needs a version bump:
   `pnpm changeset`
   Public API, behavior, dependency, and package metadata changes need a changeset; docs-only and internal-only changes usually do not.
2. Merge feature PRs to the default branch after review and CI.
3. CI creates or updates the Changesets Release PR, including package versions, changelogs, and lockfile updates.
4. When `RELEASE_BOT_TOKEN` is configured, CI auto-merges the Release PR and the resulting `main` push publishes to npm.
5. If `RELEASE_BOT_TOKEN` is missing or auto-merge fails, merge the Release PR manually. CI still owns the npm publish step and any release tags required by the configured automation.
6. Verify the published packages with `npm view @crewai-ts/<package> version`.

## Automation requirements

- Enable repository auto-merge in GitHub.
- Keep Actions workflow permissions at read/write and allow GitHub Actions to create pull requests.
- Add a `RELEASE_BOT_TOKEN` repository secret with `contents:write` and `pull_requests:write` permissions. The token must belong to a user or GitHub App that can merge to `main`; this ensures the merge commit triggers the follow-up publish workflow.
- Keep npm Trusted Publishing configured for this repository and `.github/workflows/publish.yml`.

## Guardrails

- Do not run `npm publish`, `pnpm publish`, `pnpm release`, or `changeset publish` locally.
- Do not create or push local release tags to trigger publishing.
- Do not bypass a missing or broken Changesets Release PR with a local manual release.
- If automation is missing, incomplete, or failing, fix it in a reviewed PR first.

The local pre-push hook blocks release tag pushes matching:

- `refs/tags/v*`
- `refs/tags/@crewai-ts/*@*`
- `refs/tags/nestjs-v*`

Use `ALLOW_CREWAI_TS_MANUAL_RELEASE_TAG_PUSH=1` only for an explicitly approved break-glass operation.
