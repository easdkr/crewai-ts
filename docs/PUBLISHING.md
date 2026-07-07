# Publishing

crewai-ts releases should go through Changesets and CI, not local npm commands.

## Normal flow

1. Add a changeset in the feature PR when a package needs a version bump:
   `pnpm changeset`
   Public API, behavior, dependency, and package metadata changes need a changeset; docs-only and internal-only changes usually do not.
2. Merge feature PRs to the default branch after review and CI.
3. The `Publish to npm` workflow validates `main`, runs `pnpm changeset:version`, and commits package versions, changelogs, and lockfile updates directly to `main` when changesets are pending.
4. The same workflow publishes any unpublished package versions to npm and pushes the package release tags.
5. Verify the published packages with `npm view @crewai-ts/<package> version`.

## Automation requirements

- Keep Actions workflow permissions at read/write so CI can commit version updates to `main`.
- `RELEASE_BOT_TOKEN` is optional while `main` allows the built-in `GITHUB_TOKEN` to push. Add it with `contents:write` if branch protection later requires a dedicated bot token.
- Keep npm Trusted Publishing configured for this repository and `.github/workflows/publish.yml`.

## Guardrails

- Do not run `npm publish`, `pnpm publish`, `pnpm release`, or `changeset publish` locally.
- Do not create or push local release tags to trigger publishing.
- Do not bypass broken release automation with a local manual release.
- If automation is missing, incomplete, or failing, fix it in a reviewed PR first.

The local pre-push hook blocks release tag pushes matching:

- `refs/tags/v*`
- `refs/tags/@crewai-ts/*@*`
- `refs/tags/nestjs-v*`

Use `ALLOW_CREWAI_TS_MANUAL_RELEASE_TAG_PUSH=1` only for an explicitly approved break-glass operation.
