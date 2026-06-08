import { existsSync, readFileSync } from "node:fs";
import { AsyncLocalStorage } from "node:async_hooks";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";

import type { LLMMessage } from "./types.js";
import { __version__ } from "./version.js";

export class ImportError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ImportError";
  }
}

export class OptionalDependencyError extends ImportError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "OptionalDependencyError";
  }
}

export function normalizePathLikeString(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof URL) {
    return value.protocol === "file:" ? fileURLToPath(value) : value.toString();
  }
  if (Buffer.isBuffer(value)) {
    return value.toString();
  }
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as { toString?: unknown };
  const toString = candidate.toString;
  if (typeof toString !== "function" || toString === Object.prototype.toString) {
    return null;
  }
  const rendered = String(toString.call(candidate));
  return rendered.length > 0 && rendered !== "[object Object]" ? rendered : null;
}

export const COMPONENTS = Object.freeze([
  "role_playing",
  "tools",
  "no_tools",
  "native_tools",
  "task",
  "native_task",
  "task_no_tools",
] as const);

export const UNACCEPTED_ATTRIBUTES = Object.freeze([
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_DEFAULT_REGION",
] as const);

export class InternalInstructor {
  readonly content: string;
  readonly model: unknown;
  readonly agent: unknown;
  readonly llm: unknown;
  readonly _client: unknown;

  constructor(content: string, model: unknown, agent: unknown = null, llm: unknown = null) {
    this.content = content;
    this.model = model;
    this.agent = agent;
    this.llm = llm ?? resolveInstructorAgentLlm(agent);
    this._client = this._create_instructor_client();
  }

  toJson(): string {
    return JSON.stringify(dumpInstructorModel(this.toPydantic(), this.model), null, 2);
  }

  to_json(): string {
    return this.toJson();
  }

  toPydantic(): unknown {
    if (!isValidInstructorLlm(this.llm)) {
      throw new Error("LLM must be provided and have a model attribute or be a string");
    }
    const messages: LLMMessage[] = [{ role: "user", content: this.content }];
    const response = callInstructorLlm(this.llm, messages, this.model);
    if (isPromiseLike(response)) {
      throw new Error("InternalInstructor.to_pydantic received an async LLM response; use a synchronous LLM client for this compatibility helper.");
    }
    return coerceInstructorResponseToModel(response, this.model);
  }

  to_pydantic(): unknown {
    return this.toPydantic();
  }

  _create_instructor_client(): unknown {
    const llm = this.llm;
    if (!isValidInstructorLlm(llm)) {
      throw new Error("LLM must be a string or have a model attribute");
    }
    return {
      provider: this._extract_provider(),
      model: typeof llm === "string" ? llm : llm && typeof llm === "object" ? (llm as Record<string, unknown>).model : null,
      chat: {
        completions: {
          create: (options: { messages?: readonly LLMMessage[]; response_model?: unknown; responseModel?: unknown }) => {
            if (!hasInstructorCall(llm)) {
              throw new Error("InternalInstructor requires an LLM client with a call method in TypeScript.");
            }
            return llm.call(options.messages ?? [], {
              responseModel: options.responseModel ?? options.response_model ?? this.model,
            });
          },
        },
      },
    };
  }

  _extract_provider(): string {
    const llm = this.llm;
    if (llm && typeof llm === "object" && "provider" in llm) {
      const provider = Reflect.get(llm, "provider");
      if (typeof provider === "string" && provider.length > 0) {
        return provider;
      }
    }
    const model = typeof llm === "string"
      ? llm
      : llm && typeof llm === "object" && "model" in llm
        ? Reflect.get(llm, "model")
        : null;
    return typeof model === "string" && model.includes("/")
      ? model.split("/", 1)[0] || "openai"
      : "openai";
  }
}

export function _is_valid_llm(llm: unknown): boolean {
  return isValidInstructorLlm(llm);
}

export const DEFAULT_TTL = 3600;

export class CrewJSONEncoder {
  default(value: unknown): Serializable {
    if (isPydanticLike(value)) {
      return this._handle_pydantic_model(value);
    }
    return toSerializable(value);
  }

  _handle_pydantic_model(value: unknown): Serializable {
    try {
      const dumped = modelDump(value);
      if (dumped && typeof dumped === "object" && !Array.isArray(dumped)) {
        return Object.fromEntries(Object.entries(dumped).map(([key, item]) => [
          key,
          isPydanticLike(item) ? repr(item) : toSerializable(item),
        ]));
      }
      return toSerializable(dumped);
    } catch (error) {
      if (error instanceof RangeError) {
        return repr(value);
      }
      throw error;
    }
  }
}

function isPydanticLike(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as { model_dump?: unknown; modelDump?: unknown };
  return typeof record.model_dump === "function" || typeof record.modelDump === "function";
}

type ModelDumpOptions = {
  exclude?: ReadonlySet<string> | readonly string[] | null;
};

type ModelDumpLike = {
  model_dump?: (options?: ModelDumpOptions) => unknown;
  modelDump?: (options?: ModelDumpOptions) => unknown;
};

function modelDump(value: unknown, options?: ModelDumpOptions): unknown {
  const dump = getModelDumpFunction(value);
  if (dump) {
    return dump(options);
  }
  return value;
}

function getModelDumpFunction(value: unknown): ((options?: ModelDumpOptions) => unknown) | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as ModelDumpLike;
  if (typeof record.model_dump === "function") {
    return record.model_dump.bind(value);
  }
  if (typeof record.modelDump === "function") {
    return record.modelDump.bind(value);
  }
  return null;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export type CrewContextOptions = {
  id?: string;
  key?: string;
  crew?: unknown;
};

const crewContextStorage = new AsyncLocalStorage<CrewContext>();

export class CrewContext {
  readonly id: string;
  readonly key: string;
  readonly crew: unknown;

  constructor(options: CrewContextOptions | string = {}) {
    if (typeof options === "string") {
      this.id = options;
      this.key = "";
      this.crew = null;
      return;
    }
    this.crew = options.crew ?? null;
    const record = this.crew && typeof this.crew === "object" ? this.crew as Record<string, unknown> : {};
    this.id = options.id ?? stringOrEmpty(record.id);
    this.key = options.key ?? stringOrEmpty(record.key ?? record.name);
  }
}

export function getCrewContext(): CrewContext | null {
  return crewContextStorage.getStore() ?? null;
}

export function get_crew_context(): CrewContext | null {
  return getCrewContext();
}

export function withCrewContext<T>(context: CrewContext | CrewContextOptions, fn: () => T): T {
  const crewContext = context instanceof CrewContext ? context : new CrewContext(context);
  return crewContextStorage.run(crewContext, fn);
}

export const with_crew_context = withCrewContext;

export const console = globalThis.console;

export type ResetMemoriesCommandOptions = {
  crews?: readonly unknown[];
  flows?: readonly unknown[];
  getCrews?: () => readonly unknown[];
  get_crews?: () => readonly unknown[];
  getFlows?: () => readonly unknown[];
  get_flows?: () => readonly unknown[];
  console?: Pick<Console, "log" | "error">;
};

export function reset_memories_command(
  memory = false,
  knowledge = false,
  agent_knowledge = false,
  kickoff_outputs = false,
  all = false,
  options: ResetMemoriesCommandOptions = {},
): void {
  const output = options.console ?? console;
  try {
    if (!memory && !knowledge && !agent_knowledge && !kickoff_outputs && !all) {
      output.log("No memory type specified. Please specify at least one type to reset.");
      return;
    }

    const crews = [
      ...(options.crews ?? []),
      ...((options.getCrews ?? options.get_crews)?.() ?? []),
    ];
    const flows = [
      ...(options.flows ?? []),
      ...((options.getFlows ?? options.get_flows)?.() ?? []),
    ];

    if (crews.length === 0 && flows.length === 0) {
      throw new Error("No crew or flow found.");
    }

    for (const crew of crews) {
      const reset = getCallable(crew, "reset_memories", "resetMemories");
      if (!reset) {
        continue;
      }
      const crewLabel = crewDisplayName(crew);
      if (all) {
        reset("all");
        output.log(`[Crew (${crewLabel})] Reset memories command has been completed.`);
        continue;
      }
      if (memory) {
        reset("memory");
        output.log(`[Crew (${crewLabel})] Memory has been reset.`);
      }
      if (kickoff_outputs) {
        reset("kickoff_outputs");
        output.log(`[Crew (${crewLabel})] Latest Kickoff outputs stored has been reset.`);
      }
      if (knowledge) {
        reset("knowledge");
        output.log(`[Crew (${crewLabel})] Knowledge has been reset.`);
      }
      if (agent_knowledge) {
        reset("agent_knowledge");
        output.log(`[Crew (${crewLabel})] Agents knowledge has been reset.`);
      }
    }

    for (const flow of flows) {
      const flowLabel = flowDisplayName(flow);
      if (all) {
        resetFlowMemory(flow, output);
        output.log(`[Flow (${flowLabel})] Reset memories command has been completed.`);
        continue;
      }
      if (memory) {
        resetFlowMemory(flow, output);
        output.log(`[Flow (${flowLabel})] Memory has been reset.`);
      }
    }
  } catch (error) {
    output.error(`An unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function getCallable(target: unknown, ...names: string[]): ((value: string) => void) | null {
  if (!target || typeof target !== "object") {
    return null;
  }
  const record = target as Record<string, unknown>;
  for (const name of names) {
    const value = record[name];
    if (typeof value === "function") {
      return (argument: string) => {
        (value as (this: unknown, value: string) => void).call(target, argument);
      };
    }
  }
  return null;
}

export function _reset_flow_memory(flow: unknown, output: Pick<Console, "error"> = console): void {
  resetFlowMemory(flow, output);
}

function resetFlowMemory(flow: unknown, output: Pick<Console, "error"> = console): void {
  if (!flow || typeof flow !== "object") {
    return;
  }
  const memoryValue = (flow as { memory?: unknown }).memory;
  if (!memoryValue || typeof memoryValue !== "object") {
    return;
  }
  const directReset = (memoryValue as { reset?: unknown }).reset;
  if (typeof directReset === "function") {
    try {
      (directReset as (this: unknown) => void).call(memoryValue);
    } catch (error) {
      if (!isMissingStorageError(error)) {
        handleFlowMemoryResetError(error, output);
      }
    }
    return;
  }
  const nestedMemory = (memoryValue as { memory?: unknown; _memory?: unknown }).memory
    ?? (memoryValue as { _memory?: unknown })._memory;
  const nestedReset = nestedMemory && typeof nestedMemory === "object"
    ? (nestedMemory as { reset?: unknown }).reset
    : null;
  if (typeof nestedReset === "function") {
    try {
      (nestedReset as (this: unknown) => void).call(nestedMemory);
    } catch (error) {
      if (!isMissingStorageError(error)) {
        handleFlowMemoryResetError(error, output);
      }
    }
  }
}

function handleFlowMemoryResetError(error: unknown, output: Pick<Console, "error">): void {
  if (isOSError(error)) {
    output.error(`Memory reset skipped: storage I/O error (${error instanceof Error ? error.message : String(error)}).`);
    return;
  }
  if (error instanceof Error && error.name === "RuntimeError") {
    output.error(`Memory reset skipped: ${error.message}`);
    return;
  }
  throw error;
}

function isMissingStorageError(error: unknown): boolean {
  return error instanceof Error
    && (error.name === "FileNotFoundError" || error.name === "ENOENT" || "code" in error && (error as { code?: unknown }).code === "ENOENT");
}

function isOSError(error: unknown): boolean {
  return error instanceof Error
    && (error.name === "OSError" || error.name === "EIO" || "code" in error && typeof (error as { code?: unknown }).code === "string");
}

function crewDisplayName(crew: unknown): string {
  if (!crew || typeof crew !== "object") {
    return "unknown";
  }
  const record = crew as { name?: unknown; id?: unknown };
  return typeof record.name === "string" && record.name
    ? record.name
    : typeof record.id === "string" && record.id
      ? record.id
      : "unknown";
}

function flowDisplayName(flow: unknown): string {
  if (!flow || typeof flow !== "object") {
    return "unknown";
  }
  const record = flow as { name?: unknown; constructor?: { name?: string } };
  return typeof record.name === "string" && record.name
    ? record.name
    : record.constructor?.name ?? "unknown";
}

function resolveInstructorAgentLlm(agent: unknown): unknown {
  if (!agent || typeof agent !== "object") {
    return null;
  }
  const record = agent as {
    function_calling_llm?: unknown;
    functionCallingLlm?: unknown;
    llm?: unknown;
  };
  return record.function_calling_llm ?? record.functionCallingLlm ?? record.llm ?? null;
}

function isValidInstructorLlm(llm: unknown): boolean {
  return llm !== null
    && llm !== undefined
    && (typeof llm === "string" || typeof llm === "function" || (typeof llm === "object" && ("model" in llm || "call" in llm)));
}

function hasInstructorCall(llm: unknown): llm is { call(messages: readonly LLMMessage[], options?: Record<string, unknown>): unknown } {
  return Boolean(llm && typeof llm === "object" && "call" in llm && typeof (llm as { call?: unknown }).call === "function");
}

function callInstructorLlm(llm: unknown, messages: readonly LLMMessage[], model: unknown): unknown {
  if (typeof llm === "function") {
    const callable = llm as (messages: readonly LLMMessage[], options?: Record<string, unknown>) => unknown;
    return callable(messages, { responseModel: model, response_model: model });
  }
  if (llm && typeof llm === "object" && "call" in llm && typeof (llm as { call?: unknown }).call === "function") {
    return (llm as { call(messages: readonly LLMMessage[], options?: Record<string, unknown>): unknown }).call(messages, {
      responseModel: model,
      response_model: model,
    });
  }
  throw new Error("InternalInstructor requires an LLM client with a call method in TypeScript.");
}

function coerceInstructorResponseToModel(response: unknown, model: unknown): unknown {
  const value = typeof response === "string" ? parseInstructorJson(response) : response;
  if (typeof model === "function") {
    const validate = model as (value: unknown) => unknown;
    return validate(value);
  }
  if (model && typeof model === "object") {
    const record = model as {
      modelValidate?: (value: unknown) => unknown;
      model_validate?: (value: unknown) => unknown;
      modelValidateJson?: (value: string) => unknown;
      model_validate_json?: (value: string) => unknown;
    };
    if (record.modelValidate) {
      return record.modelValidate(value);
    }
    if (record.model_validate) {
      return record.model_validate(value);
    }
    if (typeof response === "string" && record.modelValidateJson) {
      return record.modelValidateJson(response);
    }
    if (typeof response === "string" && record.model_validate_json) {
      return record.model_validate_json(response);
    }
  }
  return value;
}

function dumpInstructorModel(value: unknown, model: unknown): Record<string, unknown> {
  if (model && typeof model === "object") {
    const record = model as {
      modelDump?: (value: unknown) => Record<string, unknown>;
      model_dump?: (value: unknown) => Record<string, unknown>;
    };
    if (record.modelDump) {
      return record.modelDump(value);
    }
    if (record.model_dump) {
      return record.model_dump(value);
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : { value };
}

function parseInstructorJson(response: string): unknown {
  try {
    return JSON.parse(response);
  } catch {
    const match = /({.*})/s.exec(response);
    if (match?.[1]) {
      return JSON.parse(match[1]);
    }
    return response;
  }
}

function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return typeof value === "object" && value !== null && "then" in value && typeof (value as { then?: unknown }).then === "function";
}

export type SerializablePrimitive = string | number | boolean | null;
export const SerializablePrimitive = Object.freeze({ kind: "SerializablePrimitive" });
export type Serializable = SerializablePrimitive | Serializable[] | { [key: string]: Serializable };
export const Serializable = Object.freeze({ kind: "Serializable" });
export type ImportedDefinition = unknown;
export const ImportedDefinition = Object.freeze({ kind: "ImportedDefinition" });
export const adapter = Object.freeze({
  async validate_python(value: string): Promise<unknown> {
    return await importAndValidateDefinition(value);
  },
});

export type ToSerializableOptions = {
  exclude?: ReadonlySet<string> | readonly string[] | null;
  maxDepth?: number;
  max_depth?: number;
};

export function toSerializable(
  obj: unknown,
  options: ToSerializableOptions = {},
  currentDepth = 0,
  ancestors: ReadonlySet<object> = new Set<object>(),
): Serializable {
  const maxDepth = options.maxDepth ?? options.max_depth ?? 5;
  if (currentDepth >= maxDepth) {
    return repr(obj);
  }
  if (
    obj === null
    || typeof obj === "string"
    || typeof obj === "number"
    || typeof obj === "boolean"
  ) {
    return obj;
  }
  if (typeof obj === "bigint" || typeof obj === "symbol" || typeof obj === "function") {
    return repr(obj);
  }
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  if (obj instanceof Uint8Array) {
    return Buffer.from(obj).toString("base64");
  }
  if (Array.isArray(obj) || obj instanceof Set) {
    const objectValue = obj as object;
    if (ancestors.has(objectValue)) {
      return `<circular_ref:${constructorName(obj)}>`;
    }
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(objectValue);
    return [...obj].map((item) => toSerializable(item, options, currentDepth + 1, nextAncestors));
  }
  if (obj instanceof Map) {
    const objectValue = obj as object;
    if (ancestors.has(objectValue)) {
      return `<circular_ref:${constructorName(obj)}>`;
    }
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(objectValue);
    return Object.fromEntries([...obj.entries()].map(([key, value]) => [
      toSerializableKey(key),
      toSerializable(value, options, currentDepth + 1, nextAncestors),
    ]));
  }
  if (typeof obj === "object") {
    if (ancestors.has(obj)) {
      return `<circular_ref:${constructorName(obj)}>`;
    }
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(obj);
    const exclude = normalizeExclude(options.exclude);
    const dump = getModelDumpFunction(obj);
    if (dump) {
      try {
        return toSerializable(dump({ exclude }), options, currentDepth + 1, nextAncestors);
      } catch {
        return repr(obj);
      }
    }
    const withToJSON = obj as { toJSON?: () => unknown };
    if (typeof withToJSON.toJSON === "function" && !isPlainObject(obj)) {
      try {
        return toSerializable(withToJSON.toJSON(), options, currentDepth + 1, nextAncestors);
      } catch {
        return repr(obj);
      }
    }
    const entries = Object.entries(obj as Record<string, unknown>)
      .filter(([key]) => !exclude.has(key))
      .map(([key, value]) => [key, toSerializable(value, options, currentDepth + 1, nextAncestors)] as const);
    return Object.fromEntries(entries);
  }
  return repr(obj);
}

export const to_serializable = toSerializable;

export function toString(obj: unknown): string | null {
  const serializable = toSerializable(obj);
  return serializable === null ? null : pythonJsonDumps(serializable);
}

export const to_string = toString;

function pythonJsonDumps(value: Serializable): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return ensureAsciiJsonString(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => pythonJsonDumps(item)).join(", ")}]`;
  }
  return `{${Object.entries(value)
    .map(([key, item]) => `${ensureAsciiJsonString(key)}: ${pythonJsonDumps(item)}`)
    .join(", ")}}`;
}

function ensureAsciiJsonString(value: string): string {
  const json = JSON.stringify(value);
  let ascii = "";
  for (let index = 0; index < json.length; index += 1) {
    const char = json[index] ?? "";
    const codePoint = char.charCodeAt(0);
    ascii += codePoint > 127 ? `\\u${codePoint.toString(16).padStart(4, "0")}` : char;
  }
  return ascii;
}

export function crewJsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("base64");
  }
  if (isNodeBufferJson(value)) {
    return Buffer.from(value.data).toString("base64");
  }
  return value;
}

export function crewJsonStringify(value: unknown, space?: number): string {
  return JSON.stringify(value, crewJsonReplacer, space);
}

export const crew_json_stringify = crewJsonStringify;

function isNodeBufferJson(value: unknown): value is { type: "Buffer"; data: number[] } {
  return Boolean(
    value
    && typeof value === "object"
    && (value as { type?: unknown }).type === "Buffer"
    && Array.isArray((value as { data?: unknown }).data)
    && (value as { data: unknown[] }).data.every((item) => (
      typeof item === "number" && Number.isInteger(item) && item >= 0 && item <= 255
    )),
  );
}

export type SerializableCallable = (...args: readonly unknown[]) => unknown;
export const SerializableCallable = Function;

const callableRegistry = new Map<string, SerializableCallable>();
const trustedDeserializeValues = new Set(["1", "true", "yes"]);

export function _trusted_deserialize(env: NodeJS.ProcessEnv = process.env): boolean {
  return trustedDeserializeValues.has((env.CREWAI_DESERIALIZE_CALLBACKS ?? "").trim().toLowerCase());
}

export function _is_non_roundtrippable(value: unknown): boolean {
  if (typeof value !== "function") {
    return true;
  }
  for (const registered of callableRegistry.values()) {
    if (registered === value) {
      return false;
    }
  }
  const name = value.name;
  return !name || name === "anonymous" || name.includes("bound ") || name.includes("=>");
}

export function registerCallable(path: string, callable: SerializableCallable): void {
  if (!path.includes(".")) {
    throw new Error(`Invalid callback path '${path}': expected 'module.name' format.`);
  }
  callableRegistry.set(path, callable);
}

export const register_callable = registerCallable;

export function unregisterCallable(path: string): void {
  callableRegistry.delete(path);
}

export const unregister_callable = unregisterCallable;

export function clearCallableRegistry(): void {
  callableRegistry.clear();
}

export const clear_callable_registry = clearCallableRegistry;

export function callableToString(callable: SerializableCallable): string | null {
  for (const [path, registered] of callableRegistry.entries()) {
    if (registered === callable) {
      return path;
    }
  }
  const path = getCallableDottedPath(callable);
  if (!path || _is_non_roundtrippable(callable)) {
    return null;
  }
  return path;
}

export const callable_to_string = callableToString;

export async function stringToCallable(value: unknown): Promise<SerializableCallable> {
  if (typeof value === "function") {
    if (_is_non_roundtrippable(value)) {
      process.emitWarning(
        `${value.constructor.name} callbacks cannot be serialized and will prevent checkpointing. Use a module-level named function instead.`,
        { type: "UserWarning" },
      );
    }
    return value as SerializableCallable;
  }
  if (typeof value !== "string") {
    throw new Error(`Expected a callable or dotted-path string, got ${typeof value}.`);
  }
  if (!value.includes(".")) {
    throw new Error(`Invalid callback path '${value}': expected 'module.name' format.`);
  }
  const registered = callableRegistry.get(value);
  if (registered) {
    return registered;
  }
  if (!_trusted_deserialize()) {
    throw new Error(
      `Refusing to resolve callback path '${value}': set CREWAI_DESERIALIZE_CALLBACKS=1 to allow. Only enable this for trusted checkpoint data.`,
    );
  }
  const resolved = await _resolve_dotted_path(value);
  if (typeof resolved !== "function") {
    throw new Error(`Cannot resolve callback '${value}' to a callable.`);
  }
  return resolved as SerializableCallable;
}

export const string_to_callable = stringToCallable;

export function _instance_to_dotted_path(value: unknown): string {
  if (typeof value === "function") {
    const path = getCallableDottedPath(value as (...args: readonly unknown[]) => unknown);
    throw new Error(`Expected an instance, got class ${path ?? value.name}.`);
  }
  if (!value || typeof value !== "object") {
    throw new Error(`Cannot serialize ${formatUnknownForMessage(value)}: builtin values are not checkpointable instances.`);
  }
  const ctor = value.constructor;
  const path = typeof ctor === "function" ? getCallableDottedPath(ctor as (...args: readonly unknown[]) => unknown) : null;
  if (!path || path.startsWith("globalThis.")) {
    throw new Error(`Cannot serialize ${value.constructor.name}: class missing module path. Use a module-level class for checkpointable instances.`);
  }
  return path;
}

export async function _dotted_path_to_instance(value: unknown): Promise<unknown> {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value !== "string") {
    if (typeof value === "function") {
      const path = getCallableDottedPath(value as (...args: readonly unknown[]) => unknown);
      throw new Error(`Expected an instance or dotted path string, got class ${path ?? value.name}.`);
    }
    if (typeof value !== "object") {
      throw new Error(`Expected an instance of a user-defined class or dotted path string, got builtin value ${formatUnknownForMessage(value)}.`);
    }
    return value;
  }
  if (!value.includes(".")) {
    throw new Error(`Invalid provider path '${value}': expected 'module.name' format.`);
  }
  if (!_trusted_deserialize()) {
    throw new Error(
      `Refusing to resolve provider path '${value}': set CREWAI_DESERIALIZE_CALLBACKS=1 to allow. Only enable this for trusted checkpoint data.`,
    );
  }
  const cls = await _resolve_dotted_path(value);
  if (typeof cls !== "function") {
    throw new Error(`Invalid provider path '${value}': expected a class, got ${typeof cls}.`);
  }
  try {
    return new (cls as new () => unknown)();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot reinstantiate '${value}' with no arguments: ${message}. Only no-arg constructors are checkpointable; rebuild the instance manually and assign it after restore.`, { cause: error });
  }
}

export function readToml(filePath = "pyproject.toml"): Record<string, unknown> {
  return parseToml(readFileSync(filePath, "utf8"));
}

export const read_toml = readToml;

export function parseToml(content: string): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  let current: Record<string, unknown> = root;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = stripTomlComment(rawLine).trim();
    if (!line) {
      continue;
    }
    const section = line.match(/^\[([^\]]+)]$/);
    if (section?.[1]) {
      current = ensureTomlSection(root, section[1].split("."));
      continue;
    }
    const assignment = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
    if (!assignment?.[1] || assignment[2] === undefined) {
      continue;
    }
    current[assignment[1]] = parseTomlValue(assignment[2].trim());
  }
  return root;
}

export const parse_toml = parseToml;

export function getProjectName(pyprojectPath = "pyproject.toml", require = false): string | null {
  return getProjectAttribute(pyprojectPath, ["project", "name"], require);
}

export const get_project_name = getProjectName;

export function getProjectVersion(pyprojectPath = "pyproject.toml", require = false): string | null {
  return getProjectAttribute(pyprojectPath, ["project", "version"], require);
}

export const get_project_version = getProjectVersion;

export function getProjectDescription(pyprojectPath = "pyproject.toml", require = false): string | null {
  return getProjectAttribute(pyprojectPath, ["project", "description"], require);
}

export const get_project_description = getProjectDescription;

export function getCrewaiVersion(): string {
  return __version__;
}

export const get_crewai_version = getCrewaiVersion;

export function getProjectAttribute(pyprojectPath: string, keys: readonly string[], require = false): string | null {
  let attribute: unknown;
  try {
    if (!existsSync(pyprojectPath)) {
      throw new Error(`${pyprojectPath} not found.`);
    }
    const parsed = readToml(pyprojectPath);
    const dependencies = getNestedValue(parsed, ["project", "dependencies"]);
    if (!Array.isArray(dependencies) || !dependencies.some((dep) => typeof dep === "string" && dep.includes("crewai"))) {
      throw new Error("crewai is not in the dependencies.");
    }
    attribute = getNestedValue(parsed, keys);
  } catch {
    attribute = null;
  }
  if (require && !attribute) {
    throw new Error(`Unable to read '${keys.join(".")}' in the pyproject.toml file.`);
  }
  return typeof attribute === "string" ? attribute : null;
}

export const get_project_attribute = getProjectAttribute;

export async function validateImportPath(path: string): Promise<unknown> {
  const [modulePath, attr] = splitImportPath(path);
  if (!modulePath || !attr) {
    throw new Error(`import_path '${path}' must be of the form 'module.ClassName'`);
  }
  let imported: unknown;
  try {
    imported = await import(modulePath) as unknown;
  } catch (error) {
    const packageName = modulePath.split(".")[0] ?? modulePath;
    throw new Error(
      `Package '${packageName}' could not be imported. Install it with: uv add ${packageName}`,
      { cause: error },
    );
  }
  const value = (imported as Record<string, unknown>)[attr];
  if (value === undefined) {
    throw new Error(`Attribute '${attr}' not found in module '${modulePath}'`);
  }
  return value;
}

export const validate_import_path = validateImportPath;

export async function importAndValidateDefinition(path: string): Promise<unknown> {
  return await validateImportPath(path);
}

export const import_and_validate_definition = importAndValidateDefinition;

export async function requireModule(name: string, options: { purpose: string; attr?: string | null }): Promise<unknown> {
  const packageName = name.split(".")[0] ?? name;
  try {
    const imported: unknown = await import(name) as unknown;
    if (options.attr) {
      const value = (imported as Record<string, unknown>)[options.attr];
      if (value === undefined) {
        throw new AttributeError(`Module '${name}' has no attribute '${options.attr}'`);
      }
      return value;
    }
    return imported;
  } catch (error) {
    if (error instanceof AttributeError) {
      throw error;
    }
    throw new OptionalDependencyError(
      `${options.purpose} requires the optional dependency '${name}'.\nInstall it with: uv add ${packageName}`,
      { cause: error },
    );
  }
}

export const require_module = requireModule;
export const require = requireModule;

export class AttributeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttributeError";
  }
}

export async function _resolve_dotted_path(path: string): Promise<unknown> {
  const parts = path.split(".");
  const globalResolved = resolveGlobalDottedPath(parts);
  if (globalResolved !== undefined) {
    return globalResolved;
  }
  for (let index = parts.length - 1; index > 0; index -= 1) {
    const modulePath = parts.slice(0, index).join(".");
    try {
      let value: unknown = await import(modulePath) as unknown;
      for (const attr of parts.slice(index)) {
        if (!value || typeof value !== "object" && typeof value !== "function") {
          value = undefined;
          break;
        }
        value = (value as Record<string, unknown>)[attr];
      }
      if (value !== undefined) {
        return value;
      }
    } catch {
      continue;
    }
  }
  throw new Error(`Cannot resolve callback '${path}'.`);
}

function resolveGlobalDottedPath(parts: readonly string[]): unknown {
  let value: unknown = globalThis;
  for (const part of parts) {
    if (!value || typeof value !== "object" && typeof value !== "function") {
      return undefined;
    }
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

function getCallableDottedPath(value: (...args: readonly unknown[]) => unknown): string | null {
  for (const [path, registered] of callableRegistry.entries()) {
    if (registered === value) {
      return path;
    }
  }
  const path = (value as { __module_path__?: unknown }).__module_path__;
  if (typeof path === "string" && path.includes(".")) {
    return path;
  }
  if (value === Math.max) {
    return "Math.max";
  }
  if (value === Math.min) {
    return "Math.min";
  }
  return null;
}

function formatUnknownForMessage(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined || typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

function normalizeExclude(exclude: ToSerializableOptions["exclude"]): Set<string> {
  if (!exclude) {
    return new Set();
  }
  return exclude instanceof Set ? new Set<string>(exclude) : new Set<string>(exclude);
}

export function _to_serializable_key(key: unknown): string {
  return typeof key === "string" || typeof key === "number" ? String(key) : `key_${repr(key)}`;
}

const toSerializableKey = _to_serializable_key;

function repr(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "bigint" || typeof value === "number" || typeof value === "boolean" || typeof value === "symbol" || typeof value === "function") {
    return String(value);
  }
  if (value === null || value === undefined) {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => reprValue(item)).join(", ")}]`;
  }
  if (value instanceof Set) {
    return `{${[...value].map((item) => reprValue(item)).join(", ")}}`;
  }
  if (value instanceof Map) {
    return `{${[...value.entries()].map(([key, item]) => `${reprValue(key)}: ${reprValue(item)}`).join(", ")}}`;
  }
  if (typeof value === "object" && isPlainObject(value)) {
    return `{${Object.entries(value as Record<string, unknown>).map(([key, item]) => `${reprValue(key)}: ${reprValue(item)}`).join(", ")}}`;
  }
  return `[object ${constructorName(value)}]`;
}

function reprValue(value: unknown): string {
  if (typeof value === "string") {
    return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
  }
  return repr(value);
}

function constructorName(value: unknown): string {
  return value && typeof value === "object" ? value.constructor.name : typeof value;
}

function isPlainObject(value: object): boolean {
  return Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null;
}

function stripTomlComment(line: string): string {
  let inString = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"" && line[index - 1] !== "\\") {
      inString = !inString;
    }
    if (char === "#" && !inString) {
      return line.slice(0, index);
    }
  }
  return line;
}

function ensureTomlSection(root: Record<string, unknown>, path: readonly string[]): Record<string, unknown> {
  let current = root;
  for (const key of path) {
    const existing = current[key];
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  return current;
}

function parseTomlValue(value: string): unknown {
  if (value.startsWith("\"") && value.endsWith("\"")) {
    return value.slice(1, -1).replaceAll("\\\"", "\"");
  }
  if (value === "true" || value === "false") {
    return value === "true";
  }
  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return Number(value);
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    return parseTomlArray(value);
  }
  if (value.startsWith("{") && value.endsWith("}")) {
    return parseTomlInlineTable(value);
  }
  return value;
}

function parseTomlArray(value: string): unknown[] {
  const inner = value.slice(1, -1).trim();
  if (!inner) {
    return [];
  }
  return splitTomlComma(inner).map((item) => parseTomlValue(item.trim()));
}

function parseTomlInlineTable(value: string): Record<string, unknown> {
  const inner = value.slice(1, -1).trim();
  const table: Record<string, unknown> = {};
  if (!inner) {
    return table;
  }
  for (const part of splitTomlComma(inner)) {
    const [key, ...rest] = part.split("=");
    if (!key || rest.length === 0) {
      continue;
    }
    table[key.trim()] = parseTomlValue(rest.join("=").trim());
  }
  return table;
}

function splitTomlComma(value: string): string[] {
  const parts: string[] = [];
  let inString = false;
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "\"" && value[index - 1] !== "\\") {
      inString = !inString;
    } else if (!inString && (char === "[" || char === "{")) {
      depth += 1;
    } else if (!inString && (char === "]" || char === "}")) {
      depth -= 1;
    } else if (!inString && depth === 0 && char === ",") {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(value.slice(start));
  return parts;
}

function getNestedValue(data: Record<string, unknown>, keys: readonly string[]): unknown {
  let current: unknown = data;
  for (const key of keys) {
    if (!current || typeof current !== "object" || !(key in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function splitImportPath(path: string): [modulePath: string, attr: string | null] {
  const [modulePath, attr] = path.split("#");
  if (attr && modulePath) {
    return [modulePath, attr];
  }
  const lastDot = path.lastIndexOf(".");
  const protocolIndex = path.indexOf("://");
  const searchStart = protocolIndex >= 0 ? protocolIndex + 3 : 0;
  if (lastDot > searchStart && !path.startsWith(".") && !path.startsWith("/")) {
    return [path.slice(0, lastDot), path.slice(lastDot + 1)];
  }
  return [path, null];
}
