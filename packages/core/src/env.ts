import {
  CCEnvEvent,
  CodexEnvEvent,
  CursorEnvEvent,
  DefaultEnvEvent,
  crewaiEventBus,
} from "./events.js";

export const CC_ENV_VAR = "CLAUDECODE";
export const CODEX_ENV_VARS = [
  "CODEX_CI",
  "CODEX_MANAGED_BY_NPM",
  "CODEX_SANDBOX",
  "CODEX_SANDBOX_NETWORK_DISABLED",
  "CODEX_THREAD_ID",
] as const;
export const CURSOR_ENV_VARS = [
  "CURSOR_AGENT",
  "CURSOR_EXTENSION_HOST_ROLE",
  "CURSOR_SANDBOX",
  "CURSOR_TRACE_ID",
  "CURSOR_WORKSPACE_LABEL",
] as const;

let envContextEmitted = false;

export function isCodexEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return CODEX_ENV_VARS.some((name) => Boolean(env[name]));
}

export const is_codex_env = isCodexEnv;
export const _is_codex_env = isCodexEnv;

export function isCursorEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return CURSOR_ENV_VARS.some((name) => Boolean(env[name]));
}

export const is_cursor_env = isCursorEnv;
export const _is_cursor_env = isCursorEnv;

export function getEnvContext(env: NodeJS.ProcessEnv = process.env): void {
  if (envContextEmitted) {
    return;
  }
  envContextEmitted = true;

  if (env[CC_ENV_VAR]) {
    crewaiEventBus.emit(null, new CCEnvEvent());
  } else if (isCodexEnv(env)) {
    crewaiEventBus.emit(null, new CodexEnvEvent());
  } else if (isCursorEnv(env)) {
    crewaiEventBus.emit(null, new CursorEnvEvent());
  } else {
    crewaiEventBus.emit(null, new DefaultEnvEvent());
  }
}

export const get_env_context = getEnvContext;

export function resetEnvContextForTesting(): void {
  envContextEmitted = false;
}

export const reset_env_context_for_testing = resetEnvContextForTesting;
