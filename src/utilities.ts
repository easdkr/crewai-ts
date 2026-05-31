import { existsSync, readFileSync } from "node:fs";

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

  constructor(content: string, model: unknown, agent: unknown = null, llm: unknown = null) {
    this.content = content;
    this.model = model;
    this.agent = agent;
    this.llm = llm ?? resolveInstructorAgentLlm(agent);
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
}

export const DEFAULT_TTL = 3600;

export class CrewJSONEncoder {
  default(value: unknown): Serializable {
    return toSerializable(value);
  }
}

export class CrewContext {
  readonly crew: unknown;

  constructor(crew: unknown = null) {
    this.crew = crew;
  }
}

export function get_crew_context(crew: unknown = null): CrewContext {
  return new CrewContext(crew);
}

export const console = globalThis.console;

export function reset_memories_command(
  memory = false,
  knowledge = false,
  agent_knowledge = false,
  kickoff_outputs = false,
  all = false,
): void {
  void memory;
  void knowledge;
  void agent_knowledge;
  void kickoff_outputs;
  void all;
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
  ancestors = new WeakSet<object>(),
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
    ancestors.add(objectValue);
    return [...obj].map((item) => toSerializable(item, options, currentDepth + 1, ancestors));
  }
  if (obj instanceof Map) {
    const objectValue = obj as object;
    if (ancestors.has(objectValue)) {
      return `<circular_ref:${constructorName(obj)}>`;
    }
    ancestors.add(objectValue);
    return Object.fromEntries([...obj.entries()].map(([key, value]) => [
      toSerializableKey(key),
      toSerializable(value, options, currentDepth + 1, ancestors),
    ]));
  }
  if (typeof obj === "object") {
    if (ancestors.has(obj)) {
      return `<circular_ref:${constructorName(obj)}>`;
    }
    ancestors.add(obj);
    const exclude = normalizeExclude(options.exclude);
    const withToJSON = obj as { toJSON?: () => unknown };
    if (typeof withToJSON.toJSON === "function" && !isPlainObject(obj)) {
      try {
        return toSerializable(withToJSON.toJSON(), options, currentDepth + 1, ancestors);
      } catch {
        return repr(obj);
      }
    }
    const entries = Object.entries(obj as Record<string, unknown>)
      .filter(([key]) => !exclude.has(key))
      .map(([key, value]) => [key, toSerializable(value, options, currentDepth + 1, ancestors)] as const);
    return Object.fromEntries(entries);
  }
  return repr(obj);
}

export const to_serializable = toSerializable;

export function toString(obj: unknown): string | null {
  const serializable = toSerializable(obj);
  return serializable === null ? null : JSON.stringify(serializable);
}

export const to_string = toString;

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
  return value;
}

export function crewJsonStringify(value: unknown, space?: number): string {
  return JSON.stringify(value, crewJsonReplacer, space);
}

export const crew_json_stringify = crewJsonStringify;

export type SerializableCallable = (...args: readonly unknown[]) => unknown;
export const SerializableCallable = Function;

const callableRegistry = new Map<string, SerializableCallable>();

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
  const name = callable.name;
  if (!name || name === "anonymous") {
    return null;
  }
  return null;
}

export const callable_to_string = callableToString;

export async function stringToCallable(value: unknown): Promise<SerializableCallable> {
  if (typeof value === "function") {
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
  if (!trustedCallbackDeserialization()) {
    throw new Error(
      `Refusing to resolve callback path '${value}': set CREWAI_DESERIALIZE_CALLBACKS=1 to allow. Only enable this for trusted checkpoint data.`,
    );
  }
  const resolved = await resolveDottedPath(value);
  if (typeof resolved !== "function") {
    throw new Error(`Cannot resolve callback '${value}' to a callable.`);
  }
  return resolved as SerializableCallable;
}

export const string_to_callable = stringToCallable;

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

async function resolveDottedPath(path: string): Promise<unknown> {
  const parts = path.split(".");
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

function trustedCallbackDeserialization(): boolean {
  return new Set(["1", "true", "yes"]).has((process.env.CREWAI_DESERIALIZE_CALLBACKS ?? "").trim().toLowerCase());
}

function normalizeExclude(exclude: ToSerializableOptions["exclude"]): Set<string> {
  if (!exclude) {
    return new Set();
  }
  return exclude instanceof Set ? new Set<string>(exclude) : new Set<string>(exclude);
}

function toSerializableKey(key: unknown): string {
  return typeof key === "string" || typeof key === "number" ? String(key) : `key_${repr(key)}`;
}

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
  return `[object ${constructorName(value)}]`;
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
