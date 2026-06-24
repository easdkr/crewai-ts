# Agent Instructions

## Release and npm publishing

- Use the Changesets Release PR flow for package releases. Normal feature PRs may add changesets, but version bumps, changelog updates, tags, and npm publishing belong to the release automation.
- Do not run `npm publish`, `pnpm publish`, `pnpm release`, `changeset publish`, or manual tag-based releases from a local checkout.
- Do not push release tags such as `v*`, `@crewai-ts/*@*`, or `nestjs-v*` unless the maintainer explicitly sets `ALLOW_CREWAI_TS_MANUAL_RELEASE_TAG_PUSH=1` for a break-glass operation.
- If release automation is missing or failing, stop and fix the automation in a reviewed PR instead of bypassing it locally.
