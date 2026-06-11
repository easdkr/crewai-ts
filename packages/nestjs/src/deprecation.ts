/**
 * @fileoverview Internal deprecation helper. Wraps `process.emitWarning` with
 * a fixed `DeprecationWarning` type to match the pattern used in the core
 * package (see `packages/core/src/task.ts:621`, `guardrail.ts:83`,
 * `utilities.ts:775`).
 *
 * Node's `process.emitWarning` deduplicates by default — no app-level
 * throttling is needed.
 *
 * NOT exported from `index.ts`. Consumers should not call this directly;
 * the v0.3.0 factories and `CrewModule.forRoot` invoke it when the legacy
 * `llm` field is supplied.
 */

export function emitDeprecationWarning(message: string): void {
  process.emitWarning(message, "DeprecationWarning");
}

export const LEGACY_LLM_FIELD_WARNING =
  "@crewai-ts/nestjs: CrewModuleOptions.llm and AgentFactory.create({llm}) are deprecated. " +
  "Use { llms: { default: '...' } } instead. " +
  "See https://github.com/easdkr/crewai-ts/blob/main/packages/nestjs/CHANGELOG.md for v0.3.0 migration.";
