import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { cpus, hostname, machine, networkInterfaces, platform, userInfo } from "node:os";

import {
  hasUserDeclinedTracing,
  isTracingEnabled,
  loadUserData,
  saveUserData,
} from "./settings.js";
import { toSerializable } from "./utilities.js";

export {
  hasUserDeclinedTracing,
  has_user_declined_tracing,
  isTracingEnabled,
  is_tracing_enabled,
  updateUserData,
  update_user_data,
} from "./settings.js";

export type TracingEnabledToken = {
  readonly previous: boolean | null;
};

export type SuppressTracingMessagesToken = {
  readonly previous: boolean;
};

let tracingEnabled: boolean | null = null;
let suppressTracingMessages = false;
let firstTimeTraceHook: (() => boolean) | null = null;
let cachedMachineId: string | null = null;

export type GenericSystemIdOptions = {
  hostname?: () => string;
  username?: () => string;
  machine?: () => string;
  processor?: () => string;
};

export type MachineIdOptions = {
  linuxMachineIdPaths?: readonly string[];
  genericSystemId?: () => string | null;
  macAddress?: () => string | null;
  fallbackId?: string;
};

export function setTracingEnabled(enabled: boolean): TracingEnabledToken {
  const token = { previous: tracingEnabled };
  tracingEnabled = enabled;
  return token;
}

export const set_tracing_enabled = setTracingEnabled;

export function resetTracingEnabled(token: TracingEnabledToken): void {
  tracingEnabled = token.previous;
}

export const reset_tracing_enabled = resetTracingEnabled;

export function isTracingEnabledInContext(): boolean {
  return tracingEnabled ?? false;
}

export const is_tracing_enabled_in_context = isTracingEnabledInContext;

export function setSuppressTracingMessages(suppress: boolean): SuppressTracingMessagesToken {
  const token = { previous: suppressTracingMessages };
  suppressTracingMessages = suppress;
  return token;
}

export const set_suppress_tracing_messages = setSuppressTracingMessages;

export function shouldSuppressTracingMessages(): boolean {
  return suppressTracingMessages;
}

export const should_suppress_tracing_messages = shouldSuppressTracingMessages;

export function shouldEnableTracing(options: { override?: boolean | null } = {}): boolean {
  if (options.override === true) {
    return true;
  }
  if (options.override === false) {
    return false;
  }
  return isTracingEnabled();
}

export const should_enable_tracing = shouldEnableTracing;

export function onFirstExecutionTracingConfirmation(): boolean {
  if (isTestEnvironment()) {
    return false;
  }
  if (!isFirstExecution()) {
    return false;
  }
  markFirstExecutionDone();
  return false;
}

export const on_first_execution_tracing_confirmation = onFirstExecutionTracingConfirmation;

export function getUserId(): string {
  const data = loadUserData();
  const existing = data.user_id;
  if (typeof existing === "string" && existing.length > 0) {
    return existing;
  }
  const uid = generateUserId();
  saveUserData({ ...data, user_id: uid });
  return uid;
}

export const get_user_id = getUserId;

export function isFirstExecution(): boolean {
  return loadUserData().first_execution_done !== true;
}

export const is_first_execution = isFirstExecution;

export function markFirstExecutionDone(userConsented = false): void {
  const data = loadUserData();
  if (data.first_execution_done === true) {
    return;
  }
  const userId = typeof data.user_id === "string" ? data.user_id : generateUserId();
  saveUserData({
    ...data,
    first_execution_done: true,
    first_execution_at: Date.now() / 1000,
    user_id: userId,
    machine_id: getMachineId(),
    trace_consent: userConsented,
  });
}

export const mark_first_execution_done = markFirstExecutionDone;

export function markFirstExecutionCompleted(userConsented = false): void {
  markFirstExecutionDone(userConsented);
}

export const mark_first_execution_completed = markFirstExecutionCompleted;

export function safeSerializeToDict(obj: unknown, exclude?: Set<string> | readonly string[] | null): Record<string, unknown> {
  try {
    const serialized = toSerializable(obj, { exclude: exclude ?? null });
    if (isRecord(serialized)) {
      return serialized;
    }
    return { serialized_data: serialized };
  } catch (error) {
    return {
      serialization_error: error instanceof Error ? error.message : String(error),
      object_type: obj === null ? "null" : typeof obj,
    };
  }
}

export const safe_serialize_to_dict = safeSerializeToDict;

export function truncateMessages<T extends Record<string, unknown>>(
  messages: readonly T[],
  maxContentLength = 500,
  maxMessages = 5,
): T[] {
  return messages.slice(0, maxMessages).map((message) => {
    const content = message.content;
    if (typeof content !== "string" || content.length <= maxContentLength) {
      return { ...message };
    }
    return { ...message, content: `${content.slice(0, maxContentLength)}...` };
  });
}

export const truncate_messages = truncateMessages;

export function shouldAutoCollectFirstTimeTraces(): boolean {
  if (firstTimeTraceHook) {
    return firstTimeTraceHook();
  }
  if (isTestEnvironment()) {
    return false;
  }
  if (hasUserDeclinedTracing()) {
    return false;
  }
  if (isTracingEnabledInContext()) {
    return false;
  }
  return isFirstExecution();
}

export const should_auto_collect_first_time_traces = shouldAutoCollectFirstTimeTraces;

export function setFirstTimeTraceHook(hook: (() => boolean) | null): void {
  firstTimeTraceHook = hook;
}

export const set_first_time_trace_hook = setFirstTimeTraceHook;

export function promptUserForTraceViewing(timeoutSeconds = 20): boolean {
  void timeoutSeconds;
  if (isTestEnvironment() || shouldSuppressTracingMessages()) {
    return false;
  }
  return false;
}

export const prompt_user_for_trace_viewing = promptUserForTraceViewing;

function generateUserId(): string {
  const username = safeUsername();
  return hash(`${username}|${getMachineId()}`);
}

function getMachineId(): string {
  return _get_machine_id();
}

function safeUsername(): string {
  try {
    return userInfo().username || "unknown";
  } catch {
    return "unknown";
  }
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function _get_machine_id(options: MachineIdOptions = {}): string {
  if (Object.keys(options).length === 0 && cachedMachineId) {
    return cachedMachineId;
  }
  const parts = [
    _get_linux_machine_id(options.linuxMachineIdPaths),
    options.genericSystemId ? safeCall(options.genericSystemId) : _get_generic_system_id(),
    options.macAddress ? safeCall(options.macAddress) : getMacAddress(),
    process.env.HOSTNAME ?? null,
    process.env.CONTAINER_ID ?? null,
  ].filter((part): part is string => typeof part === "string" && part.length > 0);
  const source = parts.length > 0 ? parts.join("|") : (options.fallbackId ?? "unknown-system");
  const machineId = hash(source);
  if (Object.keys(options).length === 0) {
    cachedMachineId = machineId;
  }
  return machineId;
}

export function _get_linux_machine_id(paths: readonly string[] = ["/etc/machine-id", "/var/lib/dbus/machine-id"]): string | null {
  for (const path of paths) {
    try {
      if (!existsSync(path)) {
        continue;
      }
      const value = readFileSync(path, "utf8").trim();
      if (value.length > 0) {
        return value;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function _get_generic_system_id(options: GenericSystemIdOptions = {}): string | null {
  const parts = [
    safeCall(options.hostname ?? hostname),
    safeCall(options.username ?? safeUsername),
    safeCall(options.machine ?? machine),
    safeCall(options.processor ?? (() => cpus()[0]?.model ?? platform())),
  ].filter((part): part is string => typeof part === "string" && part.length > 0);
  return parts.length > 0 ? parts.join("-") : null;
}

function getMacAddress(): string | null {
  try {
    for (const interfaces of Object.values(networkInterfaces())) {
      for (const entry of interfaces ?? []) {
        if (!entry.internal && entry.mac && entry.mac !== "00:00:00:00:00:00") {
          return entry.mac;
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

function safeCall(callback: () => string | null | undefined): string | null {
  try {
    const value = callback();
    return typeof value === "string" && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function isTestEnvironment(): boolean {
  return process.env.CREWAI_TESTING?.toLowerCase() === "true" || process.env.NODE_ENV === "test";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
