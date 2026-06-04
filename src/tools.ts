import type { InputValues, MaybePromise, Tool, ToolContext } from "./types.js";
import {
  ToolUsageErrorEvent,
  ToolUsageFinishedEvent,
  ToolSelectionErrorEvent,
  ToolUsageStartedEvent,
  ToolValidateInputErrorEvent,
  crewaiEventBus,
} from "./events.js";
import {
  ToolCallHookContext,
  getAfterToolCallHooks,
  getBeforeToolCallHooks,
  runAfterToolCallHooks,
  runBeforeToolCallHooks,
} from "./hooks.js";
import { sanitizeToolName } from "./string-utils.js";
import { AgentAction, OutputParserError, parseAgentOutput } from "./agent-parser.js";
import { I18N_DEFAULT } from "./i18n.js";
import { Converter } from "./converter.js";
import { Fingerprint } from "./security.js";
import type { LLMClient } from "./llm.js";

export const OPENAI_BIGGER_MODELS = Object.freeze([
  "gpt-4",
  "gpt-4o",
  "gpt-4.1",
] as const);

export type ToolArgumentType = "string" | "number" | "boolean" | "object" | "array" | "unknown";

export type ToolArgumentSpec = {
  type?: ToolArgumentType;
  description?: string;
  required?: boolean;
  default?: unknown;
};

export type ToolArgsSchema = Record<string, ToolArgumentSpec>;

export type ToolInvocationInput = string | Record<string, unknown> | ToolContext | undefined;

export type ToolHookContextOptions = {
  agent?: unknown;
  task?: unknown;
  crew?: unknown;
};

export type ToolCacheReadResult =
  | { hit: true; value: unknown }
  | { hit: false };

export type ToolCache = {
  read(toolName: string, input: string): ToolCacheReadResult;
  write(toolName: string, input: string, output: unknown): void;
  clear?(): void;
};

export type BaseToolOptions = {
  name: string;
  description: string;
  argsSchema?: ToolArgsSchema;
  args_schema?: ToolArgsSchema;
  envVars?: readonly EnvVar[];
  env_vars?: readonly EnvVar[];
  descriptionUpdated?: boolean;
  description_updated?: boolean;
  resultAsAnswer?: boolean;
  result_as_answer?: boolean;
  maxUsageCount?: number | null;
  max_usage_count?: number | null;
  currentUsageCount?: number;
  current_usage_count?: number;
  cacheFunction?: (args: Record<string, unknown>, result: unknown) => boolean;
  cache_function?: (args: Record<string, unknown>, result: unknown) => boolean;
  cache?: ToolCache | false;
};

export type AgentLikeForTool = {
  role: string;
  executeTask?: (task: unknown, context?: string | null) => MaybePromise<unknown>;
  execute_task?: (task: unknown, context?: string | null) => MaybePromise<unknown>;
};

export type StructuredToolOptions = BaseToolOptions & {
  func: (args: Record<string, unknown>) => MaybePromise<unknown>;
  originalTool?: BaseTool | null;
  original_tool?: BaseTool | null;
};

export type StructuredToolFromFunctionOptions = Omit<ToolDecoratorOptions, "resultAsAnswer" | "result_as_answer"> & {
  returnDirect?: boolean;
  return_direct?: boolean;
  inferSchema?: boolean;
  infer_schema?: boolean;
  args_schema?: ToolArgsSchema;
};

export type EnvVarOptions = {
  name: string;
  description: string;
  required?: boolean;
  default?: string | null;
};

export class EnvVar {
  readonly name: string;
  readonly description: string;
  readonly required: boolean;
  readonly default: string | null;

  constructor(options: EnvVarOptions) {
    this.name = options.name;
    this.description = options.description;
    this.required = options.required ?? true;
    this.default = options.default ?? null;
  }
}

export type ToolFunction<TArgs extends readonly unknown[] = readonly unknown[]> = (...args: TArgs) => MaybePromise<unknown>;

export type ToolDecoratorOptions = {
  name?: string;
  description?: string;
  argsSchema?: ToolArgsSchema;
  args_schema?: ToolArgsSchema;
  envVars?: readonly EnvVar[];
  env_vars?: readonly EnvVar[];
  resultAsAnswer?: boolean;
  result_as_answer?: boolean;
  maxUsageCount?: number | null;
  max_usage_count?: number | null;
  cacheFunction?: (args: Record<string, unknown>, result: unknown) => boolean;
  cache?: ToolCache | false;
};

export type ToolCalling = {
  toolName: string;
  tool_name?: string;
  arguments?: Record<string, unknown> | null;
};

export type ToolCallingOptions = {
  toolName?: string;
  tool_name?: string;
  arguments?: Record<string, unknown> | null;
};

export const ToolCalling = class ToolCalling {
  readonly toolName: string;
  readonly tool_name: string;
  readonly arguments: Record<string, unknown> | null;

  constructor(options: ToolCallingOptions) {
    const toolName = options.toolName ?? options.tool_name;
    if (!toolName) {
      throw new Error("ToolCalling requires a toolName or tool_name.");
    }
    this.toolName = toolName;
    this.tool_name = toolName;
    this.arguments = options.arguments ?? null;
  }
};

export const InstructorToolCalling = ToolCalling;
export type InstructorToolCalling = ToolCalling;

export type ToolCallingLike = {
  toolName?: string;
  tool_name?: string;
  arguments?: Record<string, unknown> | null;
};

export type ToolResultOptions = {
  result: unknown;
  resultAsAnswer?: boolean;
  result_as_answer?: boolean;
};

export class _ArgsSchemaPlaceholder {
  readonly kind = "_ArgsSchemaPlaceholder";
}

export function _default_cache_function(_args: unknown = null, _result: unknown = null): boolean {
  void _args;
  void _result;
  return true;
}

export function _is_async_callable(func: unknown): boolean {
  return typeof func === "function" && func.constructor.name === "AsyncFunction";
}

export function _is_awaitable<T = unknown>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return !!value
    && (typeof value === "object" || typeof value === "function")
    && "then" in value
    && typeof (value as { then?: unknown }).then === "function";
}

export function _serialize_schema(schema: ToolArgsSchema | null | undefined): ToolArgsSchema | null {
  return schema ? { ...schema } : null;
}

export function _deserialize_schema(value: unknown): ToolArgsSchema | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (isToolArgsSchema(value)) {
    return { ...value };
  }
  return null;
}

export class ToolResult {
  readonly result: unknown;
  readonly resultAsAnswer: boolean;
  readonly result_as_answer: boolean;

  constructor(options: ToolResultOptions);
  constructor(result: unknown, resultAsAnswer?: boolean);
  constructor(resultOrOptions: unknown, resultAsAnswer = false) {
    if (isToolResultOptions(resultOrOptions)) {
      this.result = resultOrOptions.result;
      this.resultAsAnswer = resultOrOptions.resultAsAnswer ?? resultOrOptions.result_as_answer ?? false;
    } else {
      this.result = resultOrOptions;
      this.resultAsAnswer = resultAsAnswer;
    }
    this.result_as_answer = this.resultAsAnswer;
  }
}

export function build_schema_hint(argsSchema: ToolArgsSchema | null = null): string {
  if (!argsSchema || Object.keys(argsSchema).length === 0) {
    return "";
  }
  const properties = Object.fromEntries(Object.entries(argsSchema).map(([name, spec]) => {
    const property = Object.fromEntries(Object.entries(spec).filter(([key]) => key !== "required"));
    return [name, property];
  }));
  const required = Object.entries(argsSchema)
    .filter(([, spec]) => spec.required)
    .map(([name]) => name);
  return `\nExpected arguments: ${jsonDumpsForHint(properties)}\nRequired: ${jsonDumpsForHint(required)}`;
}

export class ToolUsageLimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolUsageLimitExceededError";
  }
}

export class ToolValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolValidationError";
  }
}

export class InMemoryToolCache implements ToolCache {
  private readonly cache = new Map<string, unknown>();

  read(toolName: string, input: string): ToolCacheReadResult {
    const key = toolCacheKey(toolName, input);
    if (!this.cache.has(key)) {
      return { hit: false };
    }
    return { hit: true, value: this.cache.get(key) };
  }

  write(toolName: string, input: string, output: unknown): void {
    this.cache.set(toolCacheKey(toolName, input), output);
  }

  clear(): void {
    this.cache.clear();
  }
}

export class CacheHandler {
  private readonly cache = new Map<string, unknown>();

  add(tool: string, input: string, output: unknown): void {
    this.cache.set(toolCacheKey(tool, input), output);
  }

  read(tool: string, input: string): unknown {
    return this.cache.has(toolCacheKey(tool, input))
      ? this.cache.get(toolCacheKey(tool, input))
      : null;
  }

  clear(): void {
    this.cache.clear();
  }

  asToolCache(): ToolCache {
    return {
      read: (toolName, input) => {
        const value = this.read(toolName, input);
        return value === null ? { hit: false } : { hit: true, value };
      },
      write: (toolName, input, output) => {
        this.add(toolName, input, output);
      },
      clear: () => {
        this.clear();
      },
    };
  }
}

export type ToolsHandlerOptions = {
  cache?: CacheHandler | null;
  lastUsedTool?: ToolCallingLike | null;
  last_used_tool?: ToolCallingLike | null;
};

export class ToolsHandler {
  cache: CacheHandler | null;
  lastUsedTool: ToolCallingLike | null;
  last_used_tool: ToolCallingLike | null;

  constructor(options: ToolsHandlerOptions = {}) {
    this.cache = options.cache ?? null;
    this.lastUsedTool = options.lastUsedTool ?? options.last_used_tool ?? null;
    this.last_used_tool = this.lastUsedTool;
  }

  onToolUse(calling: ToolCallingLike, output: string, shouldCache = true): void {
    this.lastUsedTool = calling;
    this.last_used_tool = calling;
    if (!this.cache || !shouldCache || sanitizedCallingName(calling) === "hit_tool_cache") {
      return;
    }

    this.cache.add(
      sanitizedCallingName(calling),
      stringifyToolCallingArguments(calling.arguments),
      output,
    );
  }

  on_tool_use(calling: ToolCallingLike, output: string, should_cache = true): void {
    this.onToolUse(calling, output, should_cache);
  }
}

export abstract class BaseTool implements Tool {
  readonly name: string;
  readonly description: string;
  readonly envVars: readonly EnvVar[];
  readonly argsSchema: ToolArgsSchema;
  readonly descriptionUpdated: boolean;
  readonly resultAsAnswer: boolean;
  readonly maxUsageCount: number | null;
  readonly cacheFunction: (args: Record<string, unknown>, result: unknown) => boolean;
  readonly cache: ToolCache | null;
  currentUsageCount = 0;

  constructor(options: BaseToolOptions) {
    const maxUsageCount = options.maxUsageCount ?? options.max_usage_count ?? null;
    BaseTool.validateMaxUsageCount(maxUsageCount);
    this.name = sanitizeToolName(options.name);
    this.description = options.description;
    this.envVars = options.envVars ?? options.env_vars ?? [];
    this.argsSchema = options.argsSchema ?? options.args_schema ?? {};
    this.descriptionUpdated = options.descriptionUpdated ?? options.description_updated ?? false;
    this.resultAsAnswer = options.resultAsAnswer ?? options.result_as_answer ?? false;
    this.maxUsageCount = maxUsageCount;
    this.currentUsageCount = options.currentUsageCount ?? options.current_usage_count ?? 0;
    this.cacheFunction = options.cacheFunction ?? options.cache_function ?? _default_cache_function;
    this.cache = options.cache === false ? null : options.cache ?? new InMemoryToolCache();
  }

  static validateMaxUsageCount(value: number | null): number | null {
    if (value !== null && value <= 0) {
      throw new Error("max_usage_count must be a positive integer");
    }
    return value;
  }

  static validate_max_usage_count(value: number | null): number | null {
    return this.validateMaxUsageCount(value);
  }

  static defaultArgsSchema(value: ToolArgsSchema | null | undefined): ToolArgsSchema {
    return _deserialize_schema(value) ?? {};
  }

  static _default_args_schema(value: ToolArgsSchema | null | undefined): ToolArgsSchema {
    return this.defaultArgsSchema(value);
  }

  static fromLangchain(tool: { name?: string; description?: string; func?: (...args: never[]) => MaybePromise<unknown>; args_schema?: ToolArgsSchema; argsSchema?: ToolArgsSchema }): StructuredTool {
    if (typeof tool.func !== "function") {
      throw new Error("The provided tool must have a callable 'func' attribute.");
    }
    const func = tool.func as (args: Record<string, unknown>) => MaybePromise<unknown>;
    return new StructuredTool({
      name: tool.name ?? "Unnamed Tool",
      description: tool.description ?? "",
      argsSchema: tool.argsSchema ?? tool.args_schema ?? {},
      func,
    });
  }

  static from_langchain(tool: { name?: string; description?: string; func?: (...args: never[]) => MaybePromise<unknown>; args_schema?: ToolArgsSchema; argsSchema?: ToolArgsSchema }): StructuredTool {
    return this.fromLangchain(tool);
  }

  get toolType(): string {
    return this.constructor.name;
  }

  get tool_type(): string {
    return this.toolType;
  }

  modelPostInit(_context?: unknown): void {
    void _context;
  }

  model_post_init(_context?: unknown): void {
    this.modelPostInit(_context);
  }

  setArgsSchema(): ToolArgsSchema {
    return this.argsSchema;
  }

  _set_args_schema(): ToolArgsSchema {
    return this.setArgsSchema();
  }

  generateDescription(): string {
    return this.renderDescription();
  }

  _generate_description(): string {
    return this.generateDescription();
  }

  serializeArgsSchema(schema: ToolArgsSchema | null = this.argsSchema): ToolArgsSchema | null {
    return schema === null ? null : { ...schema };
  }

  _serialize_args_schema(schema: ToolArgsSchema | null = this.argsSchema): ToolArgsSchema | null {
    return this.serializeArgsSchema(schema);
  }

  _claim_usage(): string | null {
    return this.claimUsage();
  }

  validateKwargs(kwargs: Record<string, unknown>): Record<string, unknown> {
    return validateArgs(this.name, this.argsSchema, kwargs);
  }

  _validate_kwargs(kwargs: Record<string, unknown>): Record<string, unknown> {
    return this.validateKwargs(kwargs);
  }

  get env_vars(): readonly EnvVar[] {
    return this.envVars;
  }

  get args_schema(): ToolArgsSchema {
    return this.argsSchema;
  }

  get args(): ToolArgsSchema {
    return this.argsSchema;
  }

  get description_updated(): boolean {
    return this.descriptionUpdated;
  }

  get result_as_answer(): boolean {
    return this.resultAsAnswer;
  }

  get max_usage_count(): number | null {
    return this.maxUsageCount;
  }

  get current_usage_count(): number {
    return this.currentUsageCount;
  }

  set current_usage_count(value: number) {
    this.currentUsageCount = value;
  }

  get cache_function(): (args: Record<string, unknown>, result: unknown) => boolean {
    return this.cacheFunction;
  }

  run(input?: ToolInvocationInput, hookContext: ToolHookContextOptions = {}): MaybePromise<unknown> {
    let args: Record<string, unknown>;
    try {
      args = this.parseArgs(input);
    } catch (error) {
      crewaiEventBus.emit(this, new ToolValidateInputErrorEvent({
        toolName: this.name,
        toolArgs: rawToolArgs(input),
        toolClass: this.constructor.name,
        error,
      }));
      throw error;
    }
    if (getBeforeToolCallHooks().length > 0 || getAfterToolCallHooks().length > 0) {
      return this.runWithHooks(args, hookContext);
    }
    const startedAt = new Date();
    crewaiEventBus.emit(this, new ToolUsageStartedEvent({
      toolName: this.name,
      toolArgs: args,
      toolClass: this.constructor.name,
      ...toolEventContext(hookContext),
    }));
    const cacheInput = stableStringify(args);
    const cached = this.cache?.read(this.name, cacheInput);
    if (cached?.hit) {
      this.emitToolFinished(args, startedAt, cached.value, hookContext);
      return cached.value;
    }
    try {
      const usageLimitError = this.claimUsage();
      if (usageLimitError) {
        this.emitToolFinished(args, startedAt, usageLimitError, hookContext);
        return usageLimitError;
      }
      const result = this._run(args);
      if (isPromiseLike(result)) {
        return result
          .then((output: unknown) => {
            this.writeCache(args, cacheInput, output);
            this.emitToolFinished(args, startedAt, output, hookContext);
            return output;
          })
          .catch((error: unknown) => {
            this.emitToolError(args, error, hookContext);
            throw error;
          });
      }
      this.writeCache(args, cacheInput, result);
      this.emitToolFinished(args, startedAt, result, hookContext);
      return result;
    } catch (error) {
      this.emitToolError(args, error, hookContext);
      throw error;
    }
  }

  private async runWithHooks(args: Record<string, unknown>, hookContext: ToolHookContextOptions): Promise<unknown> {
    await runBeforeToolCallHooks(new ToolCallHookContext({
      toolName: this.name,
      toolInput: args,
      tool: this,
      agent: hookContext.agent,
      task: hookContext.task,
      crew: hookContext.crew,
    }));
    const startedAt = new Date();
    crewaiEventBus.emit(this, new ToolUsageStartedEvent({
      toolName: this.name,
      toolArgs: args,
      toolClass: this.constructor.name,
      ...toolEventContext(hookContext),
    }));
    const cacheInput = stableStringify(args);
    const cached = this.cache?.read(this.name, cacheInput);
    if (cached?.hit) {
      this.emitToolFinished(args, startedAt, cached.value, hookContext);
      return cached.value;
    }
    try {
      const usageLimitError = this.claimUsage();
      if (usageLimitError) {
        this.emitToolFinished(args, startedAt, usageLimitError, hookContext);
        return usageLimitError;
      }
      const rawResult = await this._run(args);
      const result = await runAfterToolCallHooks(new ToolCallHookContext({
        toolName: this.name,
        toolInput: args,
        tool: this,
        agent: hookContext.agent,
        task: hookContext.task,
        crew: hookContext.crew,
        toolResult: rawResult,
      }));
      this.writeCache(args, cacheInput, result);
      this.emitToolFinished(args, startedAt, result, hookContext);
      return result;
    } catch (error) {
      this.emitToolError(args, error, hookContext);
      throw error;
    }
  }

  async arun(input?: ToolInvocationInput): Promise<unknown> {
    let args: Record<string, unknown>;
    try {
      args = this.parseArgs(input);
    } catch (error) {
      crewaiEventBus.emit(this, new ToolValidateInputErrorEvent({
        toolName: this.name,
        toolArgs: rawToolArgs(input),
        toolClass: this.constructor.name,
        error,
      }));
      throw error;
    }
    const startedAt = new Date();
    crewaiEventBus.emit(this, new ToolUsageStartedEvent({
      toolName: this.name,
      toolArgs: args,
      toolClass: this.constructor.name,
    }));
    const cacheInput = stableStringify(args);
    const cached = this.cache?.read(this.name, cacheInput);
    if (cached?.hit) {
      this.emitToolFinished(args, startedAt, cached.value);
      return cached.value;
    }
    try {
      const usageLimitError = this.claimUsage();
      if (usageLimitError) {
        this.emitToolFinished(args, startedAt, usageLimitError);
        return usageLimitError;
      }
      const result = await this._arun(args);
      this.writeCache(args, cacheInput, result);
      this.emitToolFinished(args, startedAt, result);
      return result;
    } catch (error) {
      this.emitToolError(args, error);
      throw error;
    }
  }

  invoke(input?: ToolInvocationInput, _config?: Record<string, unknown> | null): MaybePromise<unknown> {
    void _config;
    return this.run(input);
  }

  async ainvoke(input?: ToolInvocationInput, _config?: Record<string, unknown> | null): Promise<unknown> {
    void _config;
    return await this.arun(input);
  }

  hasReachedMaxUsageCount(): boolean {
    return this.maxUsageCount !== null && this.currentUsageCount >= this.maxUsageCount;
  }

  has_reached_max_usage_count(): boolean {
    return this.hasReachedMaxUsageCount();
  }

  resetUsageCount(): void {
    this.currentUsageCount = 0;
  }

  reset_usage_count(): void {
    this.resetUsageCount();
  }

  clearCache(): void {
    this.cache?.clear?.();
  }

  clear_cache(): void {
    this.clearCache();
  }

  toStructuredTool(): StructuredTool {
    return this.withCache(this.cache ?? false);
  }

  to_structured_tool(): StructuredTool {
    return this.toStructuredTool();
  }

  toLangChain(): StructuredTool {
    return this.toStructuredTool();
  }

  to_langchain(): StructuredTool {
    return this.toLangChain();
  }

  withCache(cache: ToolCache | false): StructuredTool {
    return new StructuredTool({
      name: this.name,
      description: this.description,
      argsSchema: this.argsSchema,
      resultAsAnswer: this.resultAsAnswer,
      maxUsageCount: this.maxUsageCount,
      currentUsageCount: this.currentUsageCount,
      cacheFunction: this.cacheFunction,
      cache,
      func: (args) => this._run(args),
      originalTool: this,
    });
  }

  renderDescription(): string {
    return [
      `Tool Name: ${this.name}`,
      `Tool Arguments: ${JSON.stringify(this.argsSchema)}`,
      `Tool Description: ${this.description}`,
    ].join("\n");
  }

  protected abstract _run(args: Record<string, unknown>): MaybePromise<unknown>;

  protected _arun(args: Record<string, unknown>): Promise<unknown> {
    void args;
    return Promise.reject(new Error(`${this.constructor.name} does not implement _arun. Override _arun for async support or use run() for sync execution.`));
  }

  protected parseArgs(input: ToolInvocationInput): Record<string, unknown> {
    const raw = normalizeToolInput(input);
    return validateArgs(this.name, this.argsSchema, raw);
  }

  private claimUsage(): string | null {
    if (this.maxUsageCount !== null && this.currentUsageCount >= this.maxUsageCount) {
      return `Tool '${this.name}' has reached its usage limit of ${String(this.maxUsageCount)} times and cannot be used anymore.`;
    }
    this.currentUsageCount += 1;
    this.onUsageClaimed();
    return null;
  }

  protected onUsageClaimed(): void {
    // Hook for structured wrappers that mirror upstream _original_tool usage state.
  }

  private writeCache(args: Record<string, unknown>, cacheInput: string, output: unknown): void {
    if (this.cache && this.cacheFunction(args, output)) {
      this.cache.write(this.name, cacheInput, output);
    }
  }

  private emitToolFinished(args: Record<string, unknown>, startedAt: Date, output: unknown, hookContext: ToolHookContextOptions = {}): void {
    crewaiEventBus.emit(this, new ToolUsageFinishedEvent({
      toolName: this.name,
      toolArgs: args,
      toolClass: this.constructor.name,
      startedAt,
      output,
      ...toolEventContext(hookContext),
    }));
  }

  private emitToolError(args: Record<string, unknown>, error: unknown, hookContext: ToolHookContextOptions = {}): void {
    crewaiEventBus.emit(this, new ToolUsageErrorEvent({
      toolName: this.name,
      toolArgs: args,
      toolClass: this.constructor.name,
      error,
      ...toolEventContext(hookContext),
    }));
  }
}

function toolEventContext(hookContext: ToolHookContextOptions): Record<string, unknown> {
  const context: Record<string, unknown> = {};
  if (hookContext.task !== undefined) {
    context.from_task = hookContext.task;
  }
  if (hookContext.agent !== undefined) {
    context.from_agent = hookContext.agent;
    const agentRecord = hookContext.agent && typeof hookContext.agent === "object"
      ? hookContext.agent as Record<string, unknown>
      : {};
    if (typeof agentRecord.key === "string") {
      context.agent_key = agentRecord.key;
    }
    if (typeof agentRecord.role === "string") {
      context.agent_role = agentRecord.role;
    }
  }
  return context;
}

export function to_langchain(tool: BaseTool): StructuredTool;
export function to_langchain(tools: (BaseTool | StructuredTool)[]): StructuredTool[];
export function to_langchain(toolOrTools: BaseTool | (BaseTool | StructuredTool)[]): StructuredTool | StructuredTool[] {
  if (Array.isArray(toolOrTools)) {
    return toolOrTools.map((tool) => tool instanceof StructuredTool ? tool : tool.toStructuredTool());
  }
  return toolOrTools.toStructuredTool();
}

export class StructuredTool extends BaseTool {
  private readonly func: (args: Record<string, unknown>) => MaybePromise<unknown>;
  private readonly originalTool: BaseTool | null;

  constructor(options: StructuredToolOptions) {
    super(options);
    this.func = options.func;
    this.originalTool = options.originalTool ?? options.original_tool ?? null;
  }

  static fromFunction(
    func: ToolFunction,
    options?: StructuredToolFromFunctionOptions,
  ): StructuredTool;
  static fromFunction(
    func: ToolFunction,
    name?: string | null,
    description?: string | null,
    returnDirect?: boolean,
    argsSchema?: ToolArgsSchema | null,
    inferSchema?: boolean,
  ): StructuredTool;
  static fromFunction(
    func: ToolFunction,
    optionsOrName: StructuredToolFromFunctionOptions | string | null = {},
    description?: string | null,
    returnDirect = false,
    argsSchema?: ToolArgsSchema | null,
    inferSchema = true,
  ): StructuredTool {
    const options = normalizeFromFunctionOptions(optionsOrName, description, returnDirect, argsSchema, inferSchema);
    const shouldInferSchema = options.inferSchema ?? options.infer_schema ?? true;
    if (!shouldInferSchema && !(options.argsSchema ?? options.args_schema)) {
      throw new Error("Either argsSchema must be provided or inferSchema must be true.");
    }
    return createToolFromFunction(func, {
      ...options,
      resultAsAnswer: options.returnDirect ?? options.return_direct ?? false,
    });
  }

  static from_function(
    func: ToolFunction,
    options?: StructuredToolFromFunctionOptions,
  ): StructuredTool;
  static from_function(
    func: ToolFunction,
    name?: string | null,
    description?: string | null,
    returnDirect?: boolean,
    argsSchema?: ToolArgsSchema | null,
    inferSchema?: boolean,
  ): StructuredTool;
  static from_function(
    func: ToolFunction,
    optionsOrName: StructuredToolFromFunctionOptions | string | null = {},
    description?: string | null,
    returnDirect = false,
    argsSchema?: ToolArgsSchema | null,
    inferSchema = true,
  ): StructuredTool {
    const options = normalizeFromFunctionOptions(optionsOrName, description, returnDirect, argsSchema, inferSchema);
    const shouldInferSchema = options.inferSchema ?? options.infer_schema ?? true;
    if (!shouldInferSchema && !(options.argsSchema ?? options.args_schema)) {
      throw new Error("Either argsSchema must be provided or inferSchema must be true.");
    }
    return createToolFromFunction(func, {
      ...options,
      resultAsAnswer: options.returnDirect ?? options.return_direct ?? false,
    });
  }

  protected _run(args: Record<string, unknown>): MaybePromise<unknown> {
    return this.callStructuredFunction(args);
  }

  protected override parseArgs(input: ToolInvocationInput): Record<string, unknown> {
    const rawArgs = normalizeStructuredToolInput(input, this.argsSchema, false);
    return validateArgs(this.name, this.argsSchema, rawArgs);
  }

  override invoke(input?: ToolInvocationInput, _config?: Record<string, unknown> | null): MaybePromise<unknown> {
    void _config;
    const parsedArgs = this._parseArgs(input);
    if (this.hasReachedMaxUsageCount()) {
      throw new ToolUsageLimitExceededError(
        `Tool '${sanitizeToolName(this.name)}' has reached its maximum usage limit of ${String(this.maxUsageCount)}. You should not use the ${sanitizeToolName(this.name)} tool again.`,
      );
    }
    this._incrementUsageCount();
    return this.callStructuredFunction(parsedArgs);
  }

  override async ainvoke(input?: ToolInvocationInput, _config?: Record<string, unknown> | null): Promise<unknown> {
    void _config;
    const parsedArgs = this._parseArgs(input);
    if (this.hasReachedMaxUsageCount()) {
      throw new ToolUsageLimitExceededError(
        `Tool '${sanitizeToolName(this.name)}' has reached its maximum usage limit of ${String(this.maxUsageCount)}. You should not use the ${sanitizeToolName(this.name)} tool again.`,
      );
    }
    this._incrementUsageCount();
    return await this.callStructuredFunction(parsedArgs);
  }

  override async arun(input?: ToolInvocationInput): Promise<unknown> {
    return await this.run(input);
  }

  _validate_func(): this {
    this._validate_function_signature();
    return this;
  }

  static _create_schema_from_function(name: string, func: ToolFunction): ToolArgsSchema {
    void name;
    const parameterNames = inferFunctionParameterNames(func);
    return Object.fromEntries(parameterNames.map((parameterName) => [
      parameterName,
      { type: "unknown" as const, required: true },
    ]));
  }

  _validate_function_signature(): void {
    const parameterNames = inferFunctionParameterNames(this.func);
    if (parameterNames.length === 1 && parameterNames[0] === "args" && !this.argsSchema.args) {
      return;
    }
    for (const parameterName of parameterNames) {
      const spec = this.argsSchema[parameterName];
      if (!spec) {
        throw new Error(`Required function parameter '${parameterName}' not found in args_schema`);
      }
    }
  }

  _parseArgs(input: ToolInvocationInput): Record<string, unknown> {
    const rawArgs = normalizeStructuredToolInput(input, this.argsSchema, true);
    try {
      return validateArgs(this.name, this.argsSchema, rawArgs);
    } catch (error) {
      throw new Error(`Arguments validation failed: ${error instanceof Error ? error.message : String(error)}${build_schema_hint(this.argsSchema)}`, {
        cause: error,
      });
    }
  }

  _parse_args(input: ToolInvocationInput): Record<string, unknown> {
    return this._parseArgs(input);
  }

  _incrementUsageCount(): void {
    this.currentUsageCount += 1;
    this.onUsageClaimed();
  }

  _increment_usage_count(): void {
    this._incrementUsageCount();
  }

  private callStructuredFunction(parsedArgs: Record<string, unknown>): MaybePromise<unknown> {
    const parameterNames = inferFunctionParameterNames(this.func);
    if (parameterNames.length <= 1) {
      return this.func(parsedArgs);
    }
    const orderedNames = Object.keys(this.argsSchema).length > 0
      ? Object.keys(this.argsSchema)
      : parameterNames;
    const positional = orderedNames.map((parameterName) => parsedArgs[parameterName]);
    return (this.func as (...args: unknown[]) => MaybePromise<unknown>)(...positional);
  }

  __repr__(): string {
    return `CrewStructuredTool(name='${sanitizeToolName(this.name)}', description='${this.description}')`;
  }

  toString(): string {
    return this.__repr__();
  }

  protected onUsageClaimed(): void {
    if (this.originalTool) {
      this.originalTool.current_usage_count = this.currentUsageCount;
    }
  }
}

export const CrewStructuredTool = StructuredTool;
export type CrewStructuredTool = StructuredTool;

export const AddImageToolSchema = {
  image_url: { type: "string", required: true, description: "The URL or path of the image to add" },
  action: { type: "string", required: false, description: "Optional context or question about the image" },
} satisfies ToolArgsSchema;

export class AddImageTool extends BaseTool {
  constructor(options: Partial<BaseToolOptions> = {}) {
    const addImage = I18N_DEFAULT.tools("add_image") as { name: string; description: string };
    super({
      name: options.name ?? addImage.name,
      description: options.description ?? addImage.description,
      argsSchema: options.argsSchema ?? options.args_schema ?? AddImageToolSchema,
      ...baseToolPassthroughOptions(options),
    });
  }

  protected _run(args: Record<string, unknown>): Record<string, unknown> {
    const addImage = I18N_DEFAULT.tools("add_image") as { default_action: string };
    const action = typeof args.action === "string" && args.action.trim() ? args.action : addImage.default_action;
    return {
      role: "user",
      content: [
        { type: "text", text: action },
        { type: "image_url", image_url: { url: toToolString(args.image_url) } },
      ],
    };
  }
}

export const ReadFileToolSchema = {
  file_name: { type: "string", required: true, description: "The name of the input file to read" },
} satisfies ToolArgsSchema;

export class ReadFileTool extends BaseTool {
  private files: Record<string, { read(): Uint8Array | Buffer | string; content_type?: string; contentType?: string; filename?: string | null }> | null = null;

  constructor(options: Partial<BaseToolOptions> & { files?: Record<string, { read(): Uint8Array | Buffer | string; content_type?: string; contentType?: string; filename?: string | null }> | null } = {}) {
    super({
      name: options.name ?? "read_file",
      description: options.description ?? "Read content from an input file by name. Returns file content as text for text files, or base64 for binary files.",
      argsSchema: options.argsSchema ?? options.args_schema ?? ReadFileToolSchema,
      cache: options.cache ?? false,
      ...baseToolPassthroughOptions(options),
    });
    this.files = options.files ?? null;
  }

  setFiles(files: Record<string, { read(): Uint8Array | Buffer | string; content_type?: string; contentType?: string; filename?: string | null }> | null): void {
    this.files = files;
  }

  set_files(files: Record<string, { read(): Uint8Array | Buffer | string; content_type?: string; contentType?: string; filename?: string | null }> | null): void {
    this.setFiles(files);
  }

  protected _run(args: Record<string, unknown>): MaybePromise<string> {
    if (!this.files) {
      return "No input files available.";
    }
    const fileName = toToolString(args.file_name ?? args.fileName);
    const file = this.files[fileName];
    if (!file) {
      return `File '${fileName}' not found. Available files: ${Object.keys(this.files).join(", ")}`;
    }
    const content = file.read();
    const contentType = file.content_type ?? file.contentType ?? "application/octet-stream";
    if (contentType === "application/pdf") {
      const bytes = typeof content === "string" ? Buffer.from(content) : Buffer.from(content);
      return readPDFFileText(bytes, file.filename ?? fileName);
    }
    if (contentType.startsWith("text/") || ["application/json", "application/xml", "application/x-yaml"].includes(contentType)) {
      return typeof content === "string" ? content : Buffer.from(content).toString("utf8");
    }
    const encoded = typeof content === "string" ? Buffer.from(content).toString("base64") : Buffer.from(content).toString("base64");
    return `[Binary file: ${file.filename ?? fileName} (${contentType})]\nBase64: ${encoded}`;
  }
}

async function readPDFFileText(content: Buffer, filename: string): Promise<string> {
  try {
    const module = await import("pdf-parse");
    const PDFParse = module.PDFParse as new (options: { data: Buffer }) => {
      getText(): Promise<{ text?: string }>;
      destroy?: () => Promise<void> | void;
    };
    const parser = new PDFParse({ data: content });
    try {
      const result = await parser.getText();
      const text = result.text?.trim() ?? "";
      return text.length > 0 ? text : `[PDF file with no extractable text: ${filename}]`;
    } finally {
      await parser.destroy?.();
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Cannot find package")) {
      const encoded = content.toString("base64");
      return `[Binary file: ${filename} (application/pdf)]\nBase64: ${encoded}`;
    }
    return `Unable to extract text from PDF '${filename}': ${error instanceof Error ? error.message : String(error)}`;
  }
}

export class BaseAgentTool extends BaseTool {
  readonly agents: readonly AgentLikeForTool[];

  constructor(options: Partial<BaseToolOptions> & { agents?: readonly AgentLikeForTool[] } = {}) {
    super({
      name: options.name ?? "agent_tool",
      description: options.description ?? "Agent tool",
      argsSchema: options.argsSchema ?? options.args_schema ?? {},
      ...baseToolPassthroughOptions(options),
    });
    this.agents = options.agents ?? [];
  }

  sanitizeAgentName(name: string): string {
    return name ? name.trim().split(/\s+/).join(" ").replaceAll("\"", "").toLocaleLowerCase() : "";
  }

  sanitize_agent_name(name: string): string {
    return this.sanitizeAgentName(name);
  }

  static _getCoworker(coworker: unknown, args: Record<string, unknown> = {}): string | null {
    const raw = coworker ?? args.co_worker ?? args.coworker;
    if (typeof raw !== "string") {
      return null;
    }
    if (raw.startsWith("[") && raw.endsWith("]")) {
      return raw.slice(1, -1).split(",")[0]?.trim() ?? "";
    }
    return raw;
  }

  static _get_coworker(coworker: unknown, args: Record<string, unknown> = {}): string | null {
    return this._getCoworker(coworker, args);
  }

  _getCoworker(coworker: unknown, args: Record<string, unknown> = {}): string | null {
    return BaseAgentTool._getCoworker(coworker, args);
  }

  _get_coworker(coworker: unknown, args: Record<string, unknown> = {}): string | null {
    return this._getCoworker(coworker, args);
  }

  protected _execute(agentName: string | null, task: string, context: string | null = null): MaybePromise<string> {
    const sanitizedName = this.sanitizeAgentName(agentName ?? "");
    const selectedAgent = this.agents.find((agent) => this.sanitizeAgentName(agent.role) === sanitizedName);
    if (!selectedAgent) {
      return I18N_DEFAULT.errors("agent_tool_unexisting_coworker").replace("{coworkers}", this.formatCoworkers());
    }
    const execute = selectedAgent.executeTask ?? selectedAgent.execute_task;
    if (!execute) {
      return I18N_DEFAULT.errors("agent_tool_execution_error")
        .replace("{agent_role}", this.sanitizeAgentName(selectedAgent.role))
        .replace("{error}", "Selected agent does not expose executeTask.");
    }
    try {
      const result = execute.call(selectedAgent, { description: task, expected_output: I18N_DEFAULT.slice("manager_request"), agent: selectedAgent }, context);
      return isPromiseLike(result) ? result.then(stringifyToolOutput) : stringifyToolOutput(result);
    } catch (error) {
      return I18N_DEFAULT.errors("agent_tool_execution_error")
        .replace("{agent_role}", this.sanitizeAgentName(selectedAgent.role))
        .replace("{error}", error instanceof Error ? error.message : stringifyToolOutput(error));
    }
  }

  protected _run(args: Record<string, unknown>): MaybePromise<unknown> {
    void args;
    throw new Error("BaseAgentTool must be subclassed.");
  }

  private formatCoworkers(): string {
    return this.agents.map((agent) => `- ${this.sanitizeAgentName(agent.role)}`).join("\n");
  }
}

export const AskQuestionToolSchema = {
  question: { type: "string", required: true, description: "The question to ask" },
  context: { type: "string", required: true, description: "The context for the question" },
  coworker: { type: "string", required: true, description: "The role/name of the coworker to ask" },
} satisfies ToolArgsSchema;

export class AskQuestionTool extends BaseAgentTool {
  constructor(options: Partial<BaseToolOptions> & { agents?: readonly AgentLikeForTool[] } = {}) {
    super({
      ...options,
      name: options.name ?? "Ask question to coworker",
      description: options.description ?? "Ask question to coworker",
      argsSchema: options.argsSchema ?? options.args_schema ?? AskQuestionToolSchema,
    });
  }

  protected _run(args: Record<string, unknown>): MaybePromise<string> {
    return this._execute(
      this._getCoworker(args.coworker, args),
      toToolString(args.question),
      typeof args.context === "string" ? args.context : null,
    );
  }
}

export const DelegateWorkToolSchema = {
  task: { type: "string", required: true, description: "The task to delegate" },
  context: { type: "string", required: true, description: "The context for the task" },
  coworker: { type: "string", required: true, description: "The role/name of the coworker to delegate to" },
} satisfies ToolArgsSchema;

export class DelegateWorkTool extends BaseAgentTool {
  constructor(options: Partial<BaseToolOptions> & { agents?: readonly AgentLikeForTool[] } = {}) {
    super({
      ...options,
      name: options.name ?? "Delegate work to coworker",
      description: options.description ?? "Delegate work to coworker",
      argsSchema: options.argsSchema ?? options.args_schema ?? DelegateWorkToolSchema,
    });
  }

  protected _run(args: Record<string, unknown>): MaybePromise<string> {
    return this._execute(
      this._getCoworker(args.coworker, args),
      toToolString(args.task),
      typeof args.context === "string" ? args.context : null,
    );
  }
}

export type AgentToolsOptions = {
  agents: readonly AgentLikeForTool[];
};

export class AgentTools {
  readonly agents: readonly AgentLikeForTool[];

  constructor(agentsOrOptions: readonly AgentLikeForTool[] | AgentToolsOptions) {
    this.agents = "agents" in agentsOrOptions ? agentsOrOptions.agents : agentsOrOptions;
  }

  tools(): BaseTool[] {
    const coworkers = this.agents.map((agent) => agent.role).join(", ");
    return [
      new DelegateWorkTool({
        agents: this.agents,
        description: promptLeafToString(I18N_DEFAULT.tools("delegate_work")).replace("{coworkers}", coworkers),
      }),
      new AskQuestionTool({
        agents: this.agents,
        description: promptLeafToString(I18N_DEFAULT.tools("ask_question")).replace("{coworkers}", coworkers),
      }),
    ];
  }
}

export class CacheTools {
  readonly cacheHandler: CacheHandler;
  readonly cache_handler: CacheHandler;

  constructor(cacheHandler: CacheHandler = new CacheHandler()) {
    this.cacheHandler = cacheHandler;
    this.cache_handler = cacheHandler;
  }

  tool(): StructuredTool {
    return new StructuredTool({
      name: "Hit Tool Cache",
      description: "Read cached output for a previous tool call.",
      argsSchema: {
        key: { type: "string", required: true },
      },
      func: ({ key }) => this.hitCache(String(key)) ?? "",
    });
  }

  hitCache(key: string): unknown {
    const match = key.match(/tool:\s*(.*?)\s*\|\s*input:\s*(.*)$/s);
    if (!match) {
      return null;
    }
    const [, toolPart = "", inputPart = ""] = match;
    return this.cacheHandler.read(toolPart.trim(), inputPart.trim());
  }

  hit_cache(key: string): unknown {
    return this.hitCache(key);
  }
}

export type MCPNativeToolOptions = {
  clientFactory?: () => unknown;
  client_factory?: () => unknown;
  toolName?: string;
  tool_name?: string;
  toolSchema?: Record<string, unknown>;
  tool_schema?: Record<string, unknown>;
  serverName?: string;
  server_name?: string;
  originalToolName?: string | null;
  original_tool_name?: string | null;
};

export class MCPNativeTool extends BaseTool {
  private readonly clientFactory: () => unknown;
  private readonly originalToolNameValue: string;
  private readonly serverNameValue: string;

  constructor(options: MCPNativeToolOptions);
  constructor(
    clientFactory: () => unknown,
    toolName: string,
    toolSchema: Record<string, unknown>,
    serverName: string,
    originalToolName?: string | null,
  );
  constructor(
    optionsOrClientFactory: MCPNativeToolOptions | (() => unknown),
    toolName?: string,
    toolSchema: Record<string, unknown> = {},
    serverName?: string,
    originalToolName: string | null = null,
  ) {
    const options: MCPNativeToolOptions = typeof optionsOrClientFactory === "function"
      ? ({
          clientFactory: optionsOrClientFactory,
          ...(toolName === undefined ? {} : { toolName }),
          toolSchema,
          ...(serverName === undefined ? {} : { serverName }),
          originalToolName,
        })
      : optionsOrClientFactory;
    const resolvedToolName = options.toolName ?? options.tool_name;
    const resolvedServerName = options.serverName ?? options.server_name;
    const resolvedClientFactory = options.clientFactory ?? options.client_factory;
    if (!resolvedToolName || !resolvedServerName || !resolvedClientFactory) {
      throw new Error("MCPNativeTool requires clientFactory, toolName, and serverName.");
    }
    const schema = options.toolSchema ?? options.tool_schema ?? {};
    super({
      name: `${resolvedServerName}_${resolvedToolName}`,
      description: toolSchemaDescription(schema, resolvedToolName, resolvedServerName),
      argsSchema: toolSchemaArgs(schema),
    });
    this.clientFactory = resolvedClientFactory;
    this.originalToolNameValue = options.originalToolName ?? options.original_tool_name ?? resolvedToolName;
    this.serverNameValue = resolvedServerName;
  }

  get originalToolName(): string {
    return this.originalToolNameValue;
  }

  get original_tool_name(): string {
    return this.originalToolName;
  }

  get serverName(): string {
    return this.serverNameValue;
  }

  get server_name(): string {
    return this.serverName;
  }

  protected _run(args: Record<string, unknown>): Promise<string> {
    return this.runAsync(args);
  }

  protected override async _arun(args: Record<string, unknown>): Promise<string> {
    return await this.runAsync(args);
  }

  async runAsync(args: Record<string, unknown> = {}): Promise<string> {
    const client = this.clientFactory();
    if (!isMCPClientLike(client)) {
      throw new Error("MCPNativeTool clientFactory must return an MCPClient-like object.");
    }
    await client.connect();
    try {
      return stringifyToolOutput(await client.callTool(this.originalToolName, args));
    } finally {
      await client.disconnect();
    }
  }

  async _run_async(args: Record<string, unknown> = {}): Promise<string> {
    return await this.runAsync(args);
  }
}

export type MCPToolWrapperOptions = {
  mcpServerParams?: Record<string, unknown>;
  mcp_server_params?: Record<string, unknown>;
  toolName?: string;
  tool_name?: string;
  toolSchema?: Record<string, unknown>;
  tool_schema?: Record<string, unknown>;
  serverName?: string;
  server_name?: string;
};

const MCP_WRAPPER_MAX_RETRIES = 3;
const MCP_TOOL_EXECUTION_TIMEOUT_SECONDS = 60;
type MCPWrapperOperation = (args?: Record<string, unknown>) => Promise<string>;

export class MCPToolWrapper extends BaseTool {
  private readonly mcpServerParamsValue: Record<string, unknown>;
  private readonly originalToolNameValue: string;
  private readonly serverNameValue: string;

  constructor(options: MCPToolWrapperOptions);
  constructor(
    mcpServerParams: Record<string, unknown>,
    toolName: string,
    toolSchema: Record<string, unknown>,
    serverName: string,
  );
  constructor(
    optionsOrServerParams: MCPToolWrapperOptions | Record<string, unknown>,
    toolName?: string,
    toolSchema: Record<string, unknown> = {},
    serverName?: string,
  ) {
    const options: MCPToolWrapperOptions = isMCPToolWrapperOptions(optionsOrServerParams)
      ? optionsOrServerParams
      : {
          mcpServerParams: optionsOrServerParams,
          ...(toolName === undefined ? {} : { toolName }),
          toolSchema,
          ...(serverName === undefined ? {} : { serverName }),
        };
    const params = options.mcpServerParams ?? options.mcp_server_params;
    const resolvedToolName = options.toolName ?? options.tool_name;
    const resolvedServerName = options.serverName ?? options.server_name;
    if (!params || !resolvedToolName || !resolvedServerName) {
      throw new Error("MCPToolWrapper requires mcpServerParams, toolName, and serverName.");
    }
    const schema = options.toolSchema ?? options.tool_schema ?? {};
    super({
      name: `${resolvedServerName}_${resolvedToolName}`,
      description: toolSchemaDescription(schema, resolvedToolName, resolvedServerName),
      argsSchema: toolSchemaArgs(schema),
    });
    this.mcpServerParamsValue = { ...params };
    this.originalToolNameValue = resolvedToolName;
    this.serverNameValue = resolvedServerName;
  }

  get mcpServerParams(): Record<string, unknown> {
    return { ...this.mcpServerParamsValue };
  }

  get mcp_server_params(): Record<string, unknown> {
    return this.mcpServerParams;
  }

  get originalToolName(): string {
    return this.originalToolNameValue;
  }

  get original_tool_name(): string {
    return this.originalToolName;
  }

  get serverName(): string {
    return this.serverNameValue;
  }

  get server_name(): string {
    return this.serverName;
  }

  protected _run(args: Record<string, unknown>): Promise<string> {
    return this._run_async(args);
  }

  protected override async _arun(args: Record<string, unknown>): Promise<string> {
    return await this._run_async(args);
  }

  async runAsync(args: Record<string, unknown> = {}): Promise<string> {
    return await this._execute_tool(args);
  }

  async _run_async(args: Record<string, unknown> = {}): Promise<string> {
    return await this._retry_with_exponential_backoff(this._execute_tool_with_timeout.bind(this), args);
  }

  async _retry_with_exponential_backoff(
    operationFunc: MCPWrapperOperation,
    args: Record<string, unknown> = {},
  ): Promise<string> {
    let lastError = "";
    for (let attempt = 0; attempt < MCP_WRAPPER_MAX_RETRIES; attempt += 1) {
      const [result, error, shouldRetry] = await this._execute_single_attempt(operationFunc, args);
      if (result !== null) {
        return result;
      }
      if (!shouldRetry) {
        return error;
      }
      lastError = error;
      if (attempt < MCP_WRAPPER_MAX_RETRIES - 1) {
        await waitForMCPWrapperRetry(2 ** attempt);
      }
    }
    return `MCP tool execution failed after ${String(MCP_WRAPPER_MAX_RETRIES)} attempts: ${lastError}`;
  }

  async _execute_single_attempt(
    operationFunc: MCPWrapperOperation,
    args: Record<string, unknown> = {},
  ): Promise<[string | null, string, boolean]> {
    try {
      return [await operationFunc(args), "", false];
    } catch (error) {
      const classified = classifyMCPWrapperError(error, this.originalToolName);
      return [null, classified.message, classified.retryable];
    }
  }

  async _execute_tool_with_timeout(args: Record<string, unknown> = {}): Promise<string> {
    return await withMCPWrapperTimeout(this._execute_tool(args));
  }

  async _execute_tool(args: Record<string, unknown> = {}): Promise<string> {
    return await this._do_mcp_call(args);
  }

  async _do_mcp_call(args: Record<string, unknown> = {}): Promise<string> {
    const { MCPClient, HTTPTransport } = await import("./mcp.js");
    const url = this.mcpServerParamsValue.url;
    if (typeof url !== "string") {
      throw new Error("MCPToolWrapper requires an mcpServerParams.url string.");
    }
    const client = new MCPClient(new HTTPTransport({ url }), {
      connectTimeout: 15,
      executionTimeout: 60,
      discoveryTimeout: 15,
      maxRetries: 3,
    });
    await client.connect();
    try {
      return await client.callTool(this.originalToolName, args);
    } finally {
      await client.disconnect();
    }
  }
}

function classifyMCPWrapperError(error: unknown, toolName: string): { message: string; retryable: boolean } {
  const message = error instanceof Error ? error.message : stringifyToolOutput(error);
  const lower = message.toLowerCase();
  if (lower.includes("authentication") || lower.includes("unauthorized")) {
    return { message: `Authentication failed for MCP server: ${message}`, retryable: false };
  }
  if (lower.includes("not found")) {
    return { message: `Tool '${toolName}' not found on MCP server`, retryable: false };
  }
  if (lower.includes("connection") || lower.includes("network")) {
    return { message: `Network connection failed: ${message}`, retryable: true };
  }
  if (lower.includes("json") || lower.includes("parsing")) {
    return { message: `Server response parsing error: ${message}`, retryable: true };
  }
  return { message: `MCP execution error: ${message}`, retryable: false };
}

async function waitForMCPWrapperRetry(seconds: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
}

async function withMCPWrapperTimeout(operation: Promise<string>): Promise<string> {
  let timeout!: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      operation,
      new Promise<string>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`Connection timed out after ${String(MCP_TOOL_EXECUTION_TIMEOUT_SECONDS)} seconds`));
        }, MCP_TOOL_EXECUTION_TIMEOUT_SECONDS * 1000);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

export class ToolUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolUsageError";
  }
}

export type ToolUsageOptions = {
  toolsHandler?: ToolsHandler | null;
  tools_handler?: ToolsHandler | null;
  tools?: readonly Tool[];
  task?: unknown;
  functionCallingLlm?: unknown;
  function_calling_llm?: unknown;
  agent?: unknown;
  action?: AgentAction | null;
  fingerprintContext?: Record<string, string> | null;
  fingerprint_context?: Record<string, string> | null;
};

export class ToolUsage {
  private runAttempts = 1;
  private readonly maxParsingAttempts = 3;
  private readonly rememberFormatAfterUsages = 3;
  readonly toolsHandler: ToolsHandler | null;
  readonly tools_handler: ToolsHandler | null;
  readonly tools: readonly Tool[];
  readonly task: unknown;
  readonly functionCallingLlm: unknown;
  readonly function_calling_llm: unknown;
  readonly agent: unknown;
  readonly action: AgentAction | null;
  readonly fingerprintContext: Record<string, string>;
  readonly fingerprint_context: Record<string, string>;

  constructor(options: ToolUsageOptions = {}) {
    this.toolsHandler = options.toolsHandler ?? options.tools_handler ?? null;
    this.tools_handler = this.toolsHandler;
    this.tools = options.tools ?? [];
    this.task = options.task;
    this.functionCallingLlm = options.functionCallingLlm ?? options.function_calling_llm;
    this.function_calling_llm = this.functionCallingLlm;
    this.agent = options.agent;
    this.action = options.action ?? null;
    this.fingerprintContext = options.fingerprintContext ?? options.fingerprint_context ?? {};
    this.fingerprint_context = this.fingerprintContext;
  }

  get run_attempts(): number {
    return this.runAttempts;
  }

  get _run_attempts(): number {
    return this.runAttempts;
  }

  get _max_parsing_attempts(): number {
    return this.maxParsingAttempts;
  }

  get _remember_format_after_usages(): number {
    return this.rememberFormatAfterUsages;
  }

  parseToolCalling(toolString: string): ToolCalling | ToolUsageError {
    const calling = normalizeToolCalling(toolString);
    return calling ?? new ToolUsageError("Could not parse tool calling.");
  }

  parse_tool_calling(toolString: string): ToolCalling | ToolUsageError {
    return this.parseToolCalling(toolString);
  }

  async use(calling: ToolCalling | ToolUsageError, toolString = ""): Promise<string> {
    if (calling instanceof ToolUsageError) {
      return calling.message;
    }
    const action = this.action ?? new AgentAction({
      thought: "",
      text: toolString,
      tool: calling.toolName,
      toolInput: JSON.stringify(calling.arguments ?? {}),
    });
    const result = await aexecuteToolAndCheckFinality(action, this.tools, {
      toolsHandler: this.toolsHandler,
      task: this.task,
      agent: this.agent,
      functionCallingLlm: this.functionCallingLlm,
      fingerprintContext: this.fingerprintContext,
    });
    return stringifyToolOutput(result.result);
  }

  async ause(calling: ToolCalling | ToolUsageError, toolString = ""): Promise<string> {
    return await this.use(calling, toolString);
  }

  async _ause(toolString: string, tool: Tool, calling: ToolCallingLike): Promise<string> {
    if (this._check_tool_repeated_usage(calling)) {
      return this._format_result(I18N_DEFAULT.errors("task_repeated_usage"));
    }
    const startedAt = Date.now() / 1000;
    try {
      const usageLimitError = ToolUsage._check_usage_limit(tool, sanitizeToolName(tool.name));
      if (usageLimitError) {
        throw new ToolUsageLimitExceededError(usageLimitError);
      }
      const input = calling.arguments ?? {};
      const result = await tool.run(input);
      this.onToolUseFinished(tool, calling, false, startedAt, result);
      this.toolsHandler?.onToolUse(calling, stringifyToolOutput(result), true);
      return this._format_result(result);
    } catch (error) {
      this.onToolError(tool, calling, error);
      return stringifyToolError(error);
    }
  }

  _format_result(result: unknown): string {
    const taskRecord = getRecord(this.task);
    if (taskRecord) {
      const usedTools = typeof taskRecord.used_tools === "number" ? taskRecord.used_tools : 0;
      taskRecord.used_tools = usedTools + 1;
    }
    const output = stringifyToolOutput(result);
    return this._should_remember_format() ? this._remember_format(output) : output;
  }

  _should_remember_format(): boolean {
    const usedTools = getNumberProperty(this.task, "used_tools");
    return usedTools !== null && usedTools % this.rememberFormatAfterUsages === 0;
  }

  _remember_format(result: unknown): string {
    const toolsSlice = I18N_DEFAULT.slice("tools")
      .replaceAll("{tools}", renderToolsDescription(this.tools))
      .replaceAll("{tool_names}", this.tools.map((tool) => sanitizeToolName(tool.name)).join(", "));
    return `${stringifyToolOutput(result)}\n\n${toolsSlice}`;
  }

  _check_tool_repeated_usage(calling: ToolCallingLike): boolean {
    const lastToolUsage = this.toolsHandler?.lastUsedTool;
    if (!lastToolUsage) {
      return false;
    }
    return sanitizedCallingName(calling) === sanitizedCallingName(lastToolUsage)
      && JSON.stringify(calling.arguments ?? {}) === JSON.stringify(lastToolUsage.arguments ?? {});
  }

  static _check_usage_limit(tool: unknown, toolName: string): string | null {
    const record = getRecord(tool);
    const maxUsageCount = record?.max_usage_count ?? record?.maxUsageCount;
    const currentUsageCount = record?.current_usage_count ?? record?.currentUsageCount;
    if (typeof maxUsageCount === "number" && typeof currentUsageCount === "number" && currentUsageCount >= maxUsageCount) {
      return `Tool '${toolName}' has reached its usage limit of ${String(maxUsageCount)} times and cannot be used anymore.`;
    }
    return null;
  }

  _check_usage_limit(tool: unknown, toolName: string): string | null {
    return ToolUsage._check_usage_limit(tool, toolName);
  }

  _select_tool(toolName: string): Tool {
    const sanitizedInput = sanitizeToolName(toolName);
    const orderedTools = [...this.tools].sort((left, right) =>
      toolNameSimilarity(right.name, sanitizedInput) - toolNameSimilarity(left.name, sanitizedInput));
    for (const tool of orderedTools) {
      const sanitizedTool = sanitizeToolName(tool.name);
      if (sanitizedTool === sanitizedInput || toolNameSimilarity(tool.name, sanitizedInput) > 0.85) {
        return tool;
      }
    }
    incrementTaskToolErrors(this.task);
    const error = toolName
      ? `Action '${toolName}' don't exist, these are the only available Actions:\n${renderToolsDescription(this.tools)}`
      : `I forgot the Action name, these are the only available Actions: ${renderToolsDescription(this.tools)}`;
    crewaiEventBus.emit(this, new ToolSelectionErrorEvent({
      toolName,
      toolArgs: {},
      toolClass: renderToolsDescription(this.tools),
      error,
      ...this.toolUsageErrorEventContext(toolName, {}),
    }));
    throw new Error(error);
  }

  _render(): string {
    return this.tools.map((tool) => tool.description ?? "").join("\n--\n");
  }

  async _function_calling(toolString: string): Promise<ToolCalling> {
    if (!isLLMClient(this.functionCallingLlm)) {
      throw new ToolUsageError("Function calling LLM is not available.");
    }
    const converter = new Converter<ToolCalling>({
      text: `Only tools available:\n###\n${this._render()}\n\nReturn a valid schema for the tool, the tool name must be exactly equal one of the options, use this text to inform the valid output schema:\n\n### TEXT \n${toolString}`,
      llm: this.functionCallingLlm,
      model: coerceToolCallingModel,
      instructions: [
        "The schema should have the following structure, only two keys:",
        "- tool_name: str",
        "- arguments: dict (always a dictionary, with all arguments being passed)",
        "",
        "Example:",
        "{\"tool_name\":\"tool name\",\"arguments\":{\"arg_name1\":\"value\",\"arg_name2\":2}}",
      ].join("\n"),
      maxAttempts: 1,
    });
    return await converter.toPydantic();
  }

  _original_tool_calling(_toolString: string, raiseError = false): ToolCalling | ToolUsageError {
    const action = this.action;
    if (!action) {
      return new ToolUsageError(I18N_DEFAULT.errors("tool_arguments_error"));
    }
    try {
      const tool = this._select_tool(action.tool);
      const arguments_ = this._validate_tool_input(action.toolInput);
      return new ToolCalling({
        toolName: sanitizeToolName(tool.name),
        arguments: arguments_,
      });
    } catch (error) {
      if (raiseError) {
        throw error;
      }
      return new ToolUsageError(I18N_DEFAULT.errors("tool_arguments_error"));
    }
  }

  async _tool_calling(toolString: string): Promise<ToolCalling | ToolUsageError> {
    try {
      try {
        return this._original_tool_calling(toolString, true);
      } catch {
        if (this.functionCallingLlm) {
          return await this._function_calling(toolString);
        }
        return this._original_tool_calling(toolString);
      }
    } catch (error) {
      this.runAttempts += 1;
      if (this.runAttempts > this.maxParsingAttempts) {
        incrementTaskToolErrors(this.task);
        return new ToolUsageError(
          `${I18N_DEFAULT.errors("tool_usage_error").replace("{error}", error instanceof Error ? error.message : String(error))}\nMoving on then. ${I18N_DEFAULT.slice("format").replaceAll("{tool_names}", this.tools.map((tool) => sanitizeToolName(tool.name)).join(", "))}`,
        );
      }
      return await this._tool_calling(toolString);
    }
  }

  _validate_tool_input(toolInput: string | null | undefined): Record<string, unknown> {
    if (toolInput === null || toolInput === undefined) {
      return {};
    }
    if (typeof toolInput !== "string" || toolInput.trim().length === 0) {
      const error = "Tool input must be a valid dictionary in JSON or Python literal format";
      this._emit_validate_input_error(error);
      throw new Error(error);
    }
    const parsed = parseToolInputDictionary(toolInput);
    if (parsed) {
      return parsed;
    }
    const error = "Tool input must be a valid dictionary in JSON or Python literal format";
    this._emit_validate_input_error(error);
    throw new Error(error);
  }

  _emit_validate_input_error(finalError: string): void {
    crewaiEventBus.emit(this, new ToolValidateInputErrorEvent({
      toolName: this.action?.tool ?? "",
      toolArgs: this.action?.toolInput ?? "",
      toolClass: this.constructor.name,
      error: finalError,
      ...this.toolUsageErrorEventContext(this.action?.tool ?? "", this.action?.toolInput ?? ""),
    }));
  }

  _prepare_event_data(tool: unknown, toolCalling: ToolCallingLike): Record<string, unknown> {
    return this.prepareEventData(tool, toolCalling);
  }

  _build_fingerprint_config(): Record<string, unknown> {
    const securityContext: Record<string, unknown> = {};
    const agentFingerprint = fingerprintToRecord(getRecord(getRecord(this.agent)?.security_config)?.fingerprint);
    if (agentFingerprint) {
      securityContext.agent_fingerprint = agentFingerprint;
    }
    const taskFingerprint = fingerprintToRecord(getRecord(getRecord(this.task)?.security_config)?.fingerprint);
    if (taskFingerprint) {
      securityContext.task_fingerprint = taskFingerprint;
    }
    return Object.keys(securityContext).length > 0 ? { security_context: securityContext } : {};
  }

  onToolError(tool: unknown, toolCalling: ToolCallingLike, error: unknown): void {
    const eventData = this.prepareEventData(tool, toolCalling);
    crewaiEventBus.emit(this, new ToolUsageErrorEvent({
      ...eventData,
      task_id: getStringProperty(this.task, "id"),
      task_name: getTaskDisplayName(this.task),
      error,
    }));
  }

  on_tool_error(tool: unknown, toolCalling: ToolCallingLike, error: unknown): void {
    this.onToolError(tool, toolCalling, error);
  }

  onToolUseFinished(
    tool: unknown,
    toolCalling: ToolCallingLike,
    fromCache: boolean,
    startedAt: number,
    result: unknown,
  ): void {
    const finishedAt = Date.now() / 1000;
    crewaiEventBus.emit(this, new ToolUsageFinishedEvent({
      ...this.prepareEventData(tool, toolCalling),
      started_at: new Date(startedAt * 1000),
      finished_at: new Date(finishedAt * 1000),
      from_cache: fromCache,
      output: result,
      ...(this.task
        ? {
          task_id: getStringProperty(this.task, "id"),
          task_name: getTaskDisplayName(this.task),
        }
        : {}),
    }));
  }

  on_tool_use_finished(
    tool: unknown,
    toolCalling: ToolCallingLike,
    fromCache: boolean,
    startedAt: number,
    result: unknown,
  ): void {
    this.onToolUseFinished(tool, toolCalling, fromCache, startedAt, result);
  }

  private prepareEventData(tool: unknown, toolCalling: ToolCallingLike): Record<string, unknown> {
    return {
      run_attempts: this.run_attempts,
      delegations: getNumberProperty(this.task, "delegations") ?? 0,
      tool_name: sanitizeToolName(getStringProperty(tool, "name") ?? toolCalling.toolName ?? toolCalling.tool_name ?? ""),
      tool_args: toolCalling.arguments ?? {},
      tool_class: getConstructorName(tool),
      agent_key: getStringProperty(this.agent, "key") ?? "unknown",
      agent_role: getStringProperty(this.agent, "_original_role") ?? getStringProperty(this.agent, "role") ?? "unknown",
      ...this.fingerprintContext,
    };
  }

  private toolUsageErrorEventContext(toolName: string, toolArgs: Record<string, unknown> | string): Record<string, unknown> {
    return {
      agent_key: getStringProperty(this.agent, "key") ?? "unknown",
      agent_role: getStringProperty(this.agent, "_original_role") ?? getStringProperty(this.agent, "role") ?? "unknown",
      tool_name: toolName,
      tool_args: toolArgs,
      ...this.fingerprintContext,
    };
  }
}

export function createTool(options: StructuredToolOptions): StructuredTool {
  return new StructuredTool(options);
}

export function functionTool<TArgs extends readonly unknown[]>(func: ToolFunction<TArgs>): StructuredTool;
export function functionTool(name: string, options?: Omit<ToolDecoratorOptions, "name">): <TArgs extends readonly unknown[]>(func: ToolFunction<TArgs>) => StructuredTool;
export function functionTool(options: ToolDecoratorOptions): <TArgs extends readonly unknown[]>(func: ToolFunction<TArgs>) => StructuredTool;
export function functionTool<TArgs extends readonly unknown[]>(
  first: ToolFunction<TArgs> | string | ToolDecoratorOptions,
  options: Omit<ToolDecoratorOptions, "name"> = {},
): StructuredTool | (<TDecoratedArgs extends readonly unknown[]>(func: ToolFunction<TDecoratedArgs>) => StructuredTool) {
  if (typeof first === "function") {
    return createToolFromFunction(first, {});
  }
  const normalizedOptions = typeof first === "string" ? { ...options, name: first } : first;
  return <TDecoratedArgs extends readonly unknown[]>(func: ToolFunction<TDecoratedArgs>) =>
    createToolFromFunction(func, normalizedOptions);
}

export const create_tool = createTool;
export const createFunctionTool = functionTool;
export const create_function_tool = functionTool;

export function _make_tool<TArgs extends readonly unknown[]>(func: ToolFunction<TArgs>): StructuredTool {
  return createToolFromFunction(func, {});
}

export function _make_with_name(name: string, options: Omit<ToolDecoratorOptions, "name"> = {}): <TArgs extends readonly unknown[]>(func: ToolFunction<TArgs>) => StructuredTool {
  return <TArgs extends readonly unknown[]>(func: ToolFunction<TArgs>) => createToolFromFunction(func, { ...options, name });
}

export function _resolve_tool_dict(value: Record<string, unknown>): StructuredTool {
  const name = typeof value.name === "string" ? value.name : "tool";
  const description = typeof value.description === "string" ? value.description : "";
  const maxUsageCount = value.maxUsageCount ?? value.max_usage_count;
  const currentUsageCount = value.currentUsageCount ?? value.current_usage_count;
  return new StructuredTool({
    name,
    description,
    argsSchema: _deserialize_schema(value.argsSchema ?? value.args_schema) ?? {},
    resultAsAnswer: Boolean(value.resultAsAnswer ?? value.result_as_answer),
    maxUsageCount: typeof maxUsageCount === "number" ? maxUsageCount : null,
    currentUsageCount: typeof currentUsageCount === "number" ? currentUsageCount : 0,
    cacheFunction: typeof value.cacheFunction === "function"
      ? value.cacheFunction as (args: Record<string, unknown>, result: unknown) => boolean
      : typeof value.cache_function === "function"
        ? value.cache_function as (args: Record<string, unknown>, result: unknown) => boolean
        : _default_cache_function,
    func: typeof value.func === "function"
      ? value.func as (args: Record<string, unknown>) => MaybePromise<unknown>
      : (args: Record<string, unknown>) => args,
  });
}

function createToolFromFunction<TArgs extends readonly unknown[]>(
  func: ToolFunction<TArgs>,
  options: ToolDecoratorOptions,
): StructuredTool {
  const inferredName = options.name ?? func.name;
  if (!inferredName) {
    throw new Error("Tool function must have a name or explicit tool name.");
  }
  const parameterNames = inferFunctionParameterNames(func);
  const argsSchema = options.argsSchema ?? options.args_schema ?? inferFunctionArgsSchema(func);
  return new StructuredTool({
    name: inferredName,
    description: options.description ?? inferFunctionDescription(func, inferredName),
    argsSchema,
    envVars: options.envVars ?? options.env_vars ?? [],
    resultAsAnswer: options.resultAsAnswer ?? options.result_as_answer ?? false,
    maxUsageCount: options.maxUsageCount ?? options.max_usage_count ?? null,
    ...(options.cacheFunction === undefined ? {} : { cacheFunction: options.cacheFunction }),
    ...(options.cache === undefined ? {} : { cache: options.cache }),
    func: (args) => func(...parameterNames.map((parameterName) => args[parameterName]) as unknown as TArgs),
  });
}

function normalizeFromFunctionOptions(
  optionsOrName: StructuredToolFromFunctionOptions | string | null,
  description: string | null | undefined,
  returnDirect: boolean,
  argsSchema: ToolArgsSchema | null | undefined,
  inferSchema: boolean,
): StructuredToolFromFunctionOptions {
  if (typeof optionsOrName === "string" || optionsOrName === null) {
    return {
      ...(optionsOrName === null ? {} : { name: optionsOrName }),
      ...(description === undefined || description === null ? {} : { description }),
      returnDirect,
      ...(argsSchema === undefined || argsSchema === null ? {} : { argsSchema }),
      inferSchema,
    };
  }
  return optionsOrName;
}

export function isToolCalling(value: unknown): value is ToolCalling {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof (record.toolName ?? record.tool_name) === "string";
}

export function normalizeToolCalling(value: unknown): ToolCalling | null {
  if (typeof value === "string") {
    try {
      return normalizeToolCalling(JSON.parse(value));
    } catch {
      try {
        const parsed = parseAgentOutput(value);
        if (!(parsed instanceof AgentAction)) {
          return null;
        }
        return {
          toolName: parsed.tool,
          arguments: normalizeToolInput(parsed.toolInput),
        };
      } catch (error) {
        if (error instanceof OutputParserError) {
          return null;
        }
        throw error;
      }
    }
  }
  if (!isToolCalling(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const args = record.arguments;
  return {
    toolName: String(record.toolName ?? record.tool_name),
    arguments: args && typeof args === "object" && !Array.isArray(args)
      ? args as Record<string, unknown>
      : null,
  };
}

function coerceToolCallingModel(value: unknown): ToolCalling {
  const normalized = normalizeToolCalling(value);
  if (!normalized) {
    throw new ToolUsageError("Failed to parse tool calling");
  }
  return new ToolCalling(normalized);
}

function isLLMClient(value: unknown): value is LLMClient {
  return Boolean(value && typeof value === "object" && typeof (value as { call?: unknown }).call === "function");
}

export async function aexecuteToolAndCheckFinality(
  agentAction: AgentAction,
  tools: readonly Tool[],
  options: {
    agentKey?: string | null;
    agent_key?: string | null;
    agentRole?: string | null;
    agent_role?: string | null;
    toolsHandler?: ToolsHandler | null;
    tools_handler?: ToolsHandler | null;
    task?: unknown;
    agent?: unknown;
    functionCallingLlm?: unknown;
    function_calling_llm?: unknown;
    fingerprintContext?: Record<string, string> | null;
    fingerprint_context?: Record<string, string> | null;
    crew?: unknown;
  } = {},
): Promise<ToolResult> {
  void options.functionCallingLlm;
  void options.function_calling_llm;
  const agentKey = options.agentKey ?? options.agent_key ?? null;
  const agentRole = options.agentRole ?? options.agent_role ?? null;
  if (agentKey && agentRole && options.agent) {
    setAgentFingerprintFromContext(options.agent, options.fingerprintContext ?? options.fingerprint_context ?? {});
  }
  const toolNameToToolMap = new Map(tools.map((tool) => [sanitizeToolName(tool.name), tool] as const));
  const toolCalling = normalizeToolCalling(agentAction.text) ?? {
    toolName: agentAction.tool,
    arguments: normalizeToolInput(agentAction.toolInput),
  };
  const sanitizedToolName = sanitizeToolName(toolCalling.toolName);
  const tool = toolNameToToolMap.get(sanitizedToolName);
  if (!tool) {
    return new ToolResult({
      result: I18N_DEFAULT.errors("wrong_tool_name")
        .replaceAll("{tool}", sanitizedToolName)
        .replaceAll("{tools}", [...toolNameToToolMap.keys()].join(", ")),
      resultAsAnswer: false,
    });
  }

  const toolInput = toolCalling.arguments ?? {};
  const output = tool instanceof BaseTool
    ? await tool.run(toolInput, { agent: options.agent, task: options.task, crew: options.crew })
    : await runPlainToolWithHooks(tool, sanitizedToolName, toolInput, options);
  const result = new ToolResult({
    result: output,
    resultAsAnswer: tool.resultAsAnswer ?? false,
  });
  const toolsHandler = options.toolsHandler ?? options.tools_handler ?? null;
  toolsHandler?.onToolUse({
    toolName: sanitizedToolName,
    tool_name: sanitizedToolName,
    arguments: toolInput,
  }, stringifyToolOutput(output), true);
  return result;
}

export const aexecute_tool_and_check_finality = aexecuteToolAndCheckFinality;

export function executeToolAndCheckFinality(
  agentAction: AgentAction,
  tools: readonly Tool[],
  options: Parameters<typeof aexecuteToolAndCheckFinality>[2] = {},
): Promise<ToolResult> {
  return aexecuteToolAndCheckFinality(agentAction, tools, options);
}

export const execute_tool_and_check_finality = executeToolAndCheckFinality;

export function renderToolsDescription(tools: readonly Tool[]): string {
  return tools.map((tool) => {
    if (tool instanceof BaseTool) {
      return tool.renderDescription();
    }
    return [
      `Tool Name: ${sanitizeToolName(tool.name)}`,
      "Tool Arguments: {}",
      `Tool Description: ${tool.description ?? ""}`,
    ].join("\n");
  }).join("\n\n");
}

export { sanitizeToolName };

export function normalizeToolInput(input: ToolInvocationInput): Record<string, unknown> {
  if (input === undefined) {
    return {};
  }
  if (typeof input === "string") {
    try {
      const parsed: unknown = JSON.parse(input);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : { input };
    } catch {
      return { input };
    }
  }
  if (isToolContext(input)) {
    return { input: input.input, inputs: input.inputs };
  }
  return { ...input };
}

function normalizeStructuredToolInput(
  input: ToolInvocationInput,
  argsSchema: ToolArgsSchema | null = null,
  strictJsonStrings = true,
): Record<string, unknown> {
  if (input === undefined) {
    return {};
  }
  if (typeof input === "string") {
    try {
      const parsed: unknown = JSON.parse(input);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      const singleArgName = singleSchemaArgName(argsSchema);
      return singleArgName ? { [singleArgName]: parsed } : {};
    } catch (error) {
      const singleArgName = singleSchemaArgName(argsSchema);
      if (!strictJsonStrings && singleArgName) {
        return { [singleArgName]: input };
      }
      throw new Error(`Failed to parse arguments as JSON: ${error instanceof Error ? error.message : String(error)}`, {
        cause: error,
      });
    }
  }
  if (isToolContext(input)) {
    return { input: input.input, inputs: input.inputs };
  }
  return { ...input };
}

function singleSchemaArgName(argsSchema: ToolArgsSchema | null): string | null {
  if (!argsSchema) {
    return null;
  }
  const argNames = Object.keys(argsSchema);
  return argNames.length === 1 ? argNames[0] ?? null : null;
}

function jsonDumpsForHint(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => jsonDumpsForHint(item)).join(", ")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${JSON.stringify(key)}: ${jsonDumpsForHint(item)}`)
      .join(", ")}}`;
  }
  return JSON.stringify(value);
}

export function validateArgs(
  toolName: string,
  schema: ToolArgsSchema,
  args: Record<string, unknown>,
): Record<string, unknown> {
  const schemaEntries = Object.entries(schema);
  if (schemaEntries.length === 0) {
    return { ...args };
  }
  const validated: Record<string, unknown> = {};
  for (const [name, spec] of schemaEntries) {
    const value = args[name];
    if (value === undefined) {
      if (spec.default !== undefined) {
        validated[name] = spec.default;
        continue;
      }
      if (spec.required) {
        throw new ToolValidationError(`Tool '${toolName}' missing required argument '${name}'.`);
      }
      continue;
    }
    if (spec.type && spec.type !== "unknown" && !matchesType(value, spec.type)) {
      throw new ToolValidationError(
        `Tool '${toolName}' argument '${name}' expected ${spec.type}, got ${Array.isArray(value) ? "array" : typeof value}.`,
      );
    }
    validated[name] = value;
  }
  return validated;
}

function isToolContext(input: Record<string, unknown> | ToolContext): input is ToolContext {
  return typeof input.input === "string" && "inputs" in input;
}

function matchesType(value: unknown, type: ToolArgumentType): boolean {
  switch (type) {
    case "array":
      return Array.isArray(value);
    case "object":
      return Boolean(value) && typeof value === "object" && !Array.isArray(value);
    case "string":
    case "number":
    case "boolean":
      return typeof value === type;
    case "unknown":
      return true;
    default:
      return false;
  }
}

export function buildToolContext(input: string, inputs: InputValues): ToolContext {
  return { input, inputs };
}

function rawToolArgs(input: ToolInvocationInput): Record<string, unknown> | string {
  if (typeof input === "string") {
    return input;
  }
  if (input === undefined) {
    return {};
  }
  return { ...input };
}

async function runPlainToolWithHooks(
  tool: Tool,
  sanitizedToolName: string,
  toolInput: Record<string, unknown>,
  options: { task?: unknown; agent?: unknown; crew?: unknown },
): Promise<unknown> {
  const context = new ToolCallHookContext({
    toolName: sanitizedToolName,
    toolInput,
    tool,
    agent: options.agent,
    task: options.task,
    crew: options.crew,
  });
  await runBeforeToolCallHooks(context);
  const rawResult = await tool.run(toolInput);
  return await runAfterToolCallHooks(new ToolCallHookContext({
    toolName: sanitizedToolName,
    toolInput,
    tool,
    agent: options.agent,
    task: options.task,
    crew: options.crew,
    toolResult: rawResult,
  }));
}

function isToolResultOptions(value: unknown): value is ToolResultOptions {
  return value !== null
    && typeof value === "object"
    && "result" in value;
}

function isToolArgsSchema(value: unknown): value is ToolArgsSchema {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.values(value as Record<string, unknown>).every((entry) =>
    entry !== null && typeof entry === "object" && !Array.isArray(entry));
}

function baseToolPassthroughOptions(options: Partial<BaseToolOptions>): Partial<BaseToolOptions> {
  return {
    ...(options.envVars === undefined ? {} : { envVars: options.envVars }),
    ...(options.env_vars === undefined ? {} : { env_vars: options.env_vars }),
    ...(options.descriptionUpdated === undefined ? {} : { descriptionUpdated: options.descriptionUpdated }),
    ...(options.description_updated === undefined ? {} : { description_updated: options.description_updated }),
    ...(options.resultAsAnswer === undefined ? {} : { resultAsAnswer: options.resultAsAnswer }),
    ...(options.result_as_answer === undefined ? {} : { result_as_answer: options.result_as_answer }),
    ...(options.maxUsageCount === undefined ? {} : { maxUsageCount: options.maxUsageCount }),
    ...(options.max_usage_count === undefined ? {} : { max_usage_count: options.max_usage_count }),
    ...(options.cacheFunction === undefined ? {} : { cacheFunction: options.cacheFunction }),
    ...(options.cache_function === undefined ? {} : { cache_function: options.cache_function }),
    ...(options.cache === undefined ? {} : { cache: options.cache }),
  };
}

function promptLeafToString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toToolString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value.toString();
  }
  return JSON.stringify(value);
}

function stringifyToolOutput(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  if (!value || typeof value !== "object" || !("then" in value)) {
    return false;
  }
  return typeof value.then === "function";
}

function toolCacheKey(toolName: string, input: string): string {
  return `${sanitizeToolName(toolName)}-${input}`;
}

function sanitizedCallingName(calling: ToolCallingLike): string {
  return sanitizeToolName(calling.toolName ?? calling.tool_name ?? "");
}

function stringifyToolCallingArguments(args: Record<string, unknown> | null | undefined): string {
  if (!args) {
    return "";
  }
  return JSON.stringify(args);
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function getStringProperty(value: unknown, key: string): string | null {
  const property = getRecord(value)?.[key];
  return typeof property === "string" ? property : null;
}

function getNumberProperty(value: unknown, key: string): number | null {
  const property = getRecord(value)?.[key];
  return typeof property === "number" ? property : null;
}

function getTaskDisplayName(task: unknown): string | null {
  const name = getStringProperty(task, "name");
  if (name) {
    return name;
  }
  return getStringProperty(task, "description");
}

function getConstructorName(value: unknown): string | null {
  return value && typeof value === "object" ? value.constructor.name : null;
}

function incrementTaskToolErrors(task: unknown): void {
  const record = getRecord(task);
  if (!record) {
    return;
  }
  if (typeof record.increment_tools_errors === "function") {
    (record.increment_tools_errors as () => void).call(task);
    return;
  }
  if (typeof record.incrementToolsErrors === "function") {
    (record.incrementToolsErrors as () => void).call(task);
    return;
  }
  const current = typeof record.tools_errors === "number" ? record.tools_errors : 0;
  record.tools_errors = current + 1;
}

function parseToolInputDictionary(toolInput: string): Record<string, unknown> | null {
  const candidates = [
    toolInput,
    toolInput.trim().replaceAll("'", "\""),
    normalizePythonLiteralObject(toolInput),
    normalizeJson5LikeObject(toolInput),
  ].filter((candidate): candidate is string => typeof candidate === "string");
  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try the next compatible representation.
    }
  }
  return null;
}

function normalizePythonLiteralObject(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return null;
  }
  return trimmed
    .replaceAll(/\bTrue\b/g, "true")
    .replaceAll(/\bFalse\b/g, "false")
    .replaceAll(/\bNone\b/g, "null")
    .replaceAll(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, content: string) => JSON.stringify(content.replaceAll("\\'", "'")));
}

function normalizeJson5LikeObject(value: string): string | null {
  const pythonLike = normalizePythonLiteralObject(value);
  if (!pythonLike) {
    return null;
  }
  return stripTrailingCommas(quoteUnquotedObjectKeys(pythonLike));
}

function stripTrailingCommas(value: string): string {
  let output = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index] ?? "";
    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      output += char;
      continue;
    }
    if (char === ",") {
      let nextIndex = index + 1;
      while (/\s/.test(value[nextIndex] ?? "")) {
        nextIndex += 1;
      }
      if (value[nextIndex] === "}" || value[nextIndex] === "]") {
        continue;
      }
    }
    output += char;
  }
  return output;
}

function quoteUnquotedObjectKeys(value: string): string {
  let output = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index] ?? "";
    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      output += char;
      continue;
    }
    if (char === "{" || char === ",") {
      output += char;
      let cursor = index + 1;
      while (/\s/.test(value[cursor] ?? "")) {
        output += value[cursor] ?? "";
        cursor += 1;
      }
      const keyStart = cursor;
      if (/[A-Za-z_$]/.test(value[cursor] ?? "")) {
        cursor += 1;
        while (/[A-Za-z0-9_$]/.test(value[cursor] ?? "")) {
          cursor += 1;
        }
        let colonCursor = cursor;
        while (/\s/.test(value[colonCursor] ?? "")) {
          colonCursor += 1;
        }
        if (value[colonCursor] === ":") {
          output += JSON.stringify(value.slice(keyStart, cursor));
          index = cursor - 1;
          continue;
        }
      }
      index = keyStart - 1;
      continue;
    }
    output += char;
  }
  return output;
}

function stringifyToolError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return stringifyToolOutput(error);
}

function fingerprintToRecord(value: unknown): unknown {
  const record = getRecord(value);
  if (!record) {
    return null;
  }
  if (typeof record.to_dict === "function") {
    return (record.to_dict as () => unknown).call(value);
  }
  if (typeof record.toDict === "function") {
    return (record.toDict as () => unknown).call(value);
  }
  return record;
}

function setAgentFingerprintFromContext(agent: unknown, fingerprintContext: Record<string, unknown>): void {
  const record = getRecord(agent);
  if (!record) {
    return;
  }
  const setter = typeof record.set_fingerprint === "function"
    ? record.set_fingerprint
    : typeof record.setFingerprint === "function"
      ? record.setFingerprint
      : null;
  if (!setter) {
    return;
  }
  try {
    setter.call(agent, Fingerprint.fromDict(fingerprintContext));
  } catch (error) {
    throw new Error(`Failed to set fingerprint: ${stringifyToolError(error)}`, { cause: error });
  }
}

function toolNameSimilarity(toolName: string, sanitizedInput: string): number {
  return stringSimilarity(sanitizeToolName(toolName), sanitizedInput);
}

function stringSimilarity(left: string, right: string): number {
  if (left === right) {
    return 1;
  }
  if (left.length === 0 || right.length === 0) {
    return 0;
  }
  const distance = levenshteinDistance(left, right);
  return 1 - (distance / Math.max(left.length, right.length));
}

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_value, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + 1,
        (previous[rightIndex - 1] ?? 0) + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length] ?? 0;
}

function inferFunctionParameterNames(func: unknown): string[] {
  return inferFunctionParameters(func).map((parameter) => parameter.name);
}

function inferFunctionArgsSchema(func: unknown): ToolArgsSchema {
  return Object.fromEntries(inferFunctionParameters(func).map((parameter) => [
    parameter.name,
    parameter.hasDefault
      ? { type: "unknown" as const, required: false, default: parameter.defaultValue }
      : { type: "unknown" as const, required: true },
  ]));
}

function inferFunctionParameters(func: unknown): Array<{ name: string; hasDefault: boolean; defaultValue?: unknown }> {
  const source = Function.prototype.toString.call(func);
  const parametersSource = source.match(/^[^(]*\(([^)]*)\)/)?.[1]
    ?? source.match(/^([^=()]+)=>/)?.[1]
    ?? "";
  return parametersSource
    .split(",")
    .map((parameter) => parameter.trim())
    .map(parseFunctionParameter)
    .filter((parameter): parameter is { name: string; hasDefault: boolean; defaultValue?: unknown } =>
      parameter !== null && /^[A-Za-z_$][\w$]*$/.test(parameter.name));
}

function parseFunctionParameter(parameter: string): { name: string; hasDefault: boolean; defaultValue?: unknown } | null {
  const [rawName = "", ...defaultParts] = parameter.split("=");
  const name = rawName.trim();
  if (!name) {
    return null;
  }
  if (defaultParts.length === 0) {
    return { name, hasDefault: false };
  }
  return { name, hasDefault: true, defaultValue: parseFunctionDefaultValue(defaultParts.join("=").trim()) };
}

function parseFunctionDefaultValue(rawDefault: string): unknown {
  if (rawDefault === "null") {
    return null;
  }
  if (rawDefault === "undefined") {
    return undefined;
  }
  if (rawDefault === "true") {
    return true;
  }
  if (rawDefault === "false") {
    return false;
  }
  if (/^-?\d+(?:\.\d+)?$/.test(rawDefault)) {
    return Number(rawDefault);
  }
  if ((rawDefault.startsWith("\"") && rawDefault.endsWith("\""))
    || (rawDefault.startsWith("'") && rawDefault.endsWith("'"))) {
    try {
      return JSON.parse(rawDefault.startsWith("'")
        ? `"${rawDefault.slice(1, -1).replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`
        : rawDefault);
    } catch {
      return rawDefault.slice(1, -1);
    }
  }
  return undefined;
}

function inferFunctionDescription(func: unknown, name: string): string {
  if (typeof func !== "object" && typeof func !== "function" || func === null) {
    return `Tool generated from function ${name}.`;
  }
  const propertyDescription: unknown = Object.getOwnPropertyDescriptor(func, "description")?.value;
  if (typeof propertyDescription === "string" && propertyDescription.trim()) {
    return propertyDescription.trim();
  }
  return `Tool generated from function ${name}.`;
}

function isMCPClientLike(value: unknown): value is {
  connect(): Promise<unknown>;
  disconnect(): Promise<unknown>;
  callTool(toolName: string, args: Record<string, unknown>): Promise<unknown>;
} {
  return !!value
    && typeof value === "object"
    && typeof (value as { connect?: unknown }).connect === "function"
    && typeof (value as { disconnect?: unknown }).disconnect === "function"
    && typeof (value as { callTool?: unknown }).callTool === "function";
}

function isMCPToolWrapperOptions(value: MCPToolWrapperOptions | Record<string, unknown>): value is MCPToolWrapperOptions {
  return "mcpServerParams" in value
    || "mcp_server_params" in value
    || "toolName" in value
    || "tool_name" in value
    || "toolSchema" in value
    || "tool_schema" in value
    || "serverName" in value
    || "server_name" in value;
}

function toolSchemaDescription(schema: Record<string, unknown>, toolName: string, serverName: string): string {
  return typeof schema.description === "string" && schema.description.trim()
    ? schema.description
    : `Tool ${toolName} from ${serverName}`;
}

function toolSchemaArgs(schema: Record<string, unknown>): ToolArgsSchema {
  const argsSchema = schema.argsSchema ?? schema.args_schema;
  if (argsSchema && typeof argsSchema === "object" && !Array.isArray(argsSchema)) {
    return argsSchema as ToolArgsSchema;
  }
  const inputSchema = schema.inputSchema ?? schema.input_schema;
  if (!inputSchema || typeof inputSchema !== "object" || Array.isArray(inputSchema)) {
    return {};
  }
  const record = inputSchema as Record<string, unknown>;
  const properties = record.properties;
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return {};
  }
  const required = new Set(Array.isArray(record.required) ? record.required.filter((item): item is string => typeof item === "string") : []);
  return Object.fromEntries(
    Object.entries(properties as Record<string, unknown>).map(([name, value]) => {
      const property = value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
      const spec: ToolArgumentSpec = {
        type: normalizeJsonSchemaType(property.type),
        required: required.has(name),
      };
      if (typeof property.description === "string") {
        spec.description = property.description;
      }
      if ("default" in property) {
        spec.default = property.default;
      }
      return [name, spec];
    }),
  );
}

function normalizeJsonSchemaType(value: unknown): ToolArgumentType {
  if (value === "string" || value === "number" || value === "boolean" || value === "object" || value === "array") {
    return value;
  }
  if (value === "integer") {
    return "number";
  }
  return "unknown";
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
