import type { LLMResponse } from "./llm.js";
import type { LLM, LLMMessage, MaybePromise, Tool } from "./types.js";

export class LLMCallHookContext {
  readonly executor: unknown;
  readonly agent: unknown;
  readonly task: unknown;
  readonly crew: unknown;
  readonly llm: LLM | string | null | undefined;
  readonly iterations: number;
  readonly messages: LLMMessage[];
  response: LLMResponse | null;

  constructor(options: {
    executor?: unknown;
    messages?: LLMMessage[];
    llm?: LLM | string | null;
    agent?: unknown;
    task?: unknown;
    crew?: unknown;
    iterations?: number;
    response?: LLMResponse | null;
  } = {}) {
    this.executor = options.executor ?? null;
    this.messages = options.messages ?? [];
    this.llm = options.llm ?? null;
    this.agent = options.agent ?? null;
    this.task = options.task ?? null;
    this.crew = options.crew ?? null;
    this.iterations = options.iterations ?? 0;
    this.response = options.response ?? null;
  }

  requestHumanInput(_prompt: string, _defaultMessage?: string): string {
    void _prompt;
    void _defaultMessage;
    return "";
  }

  request_human_input(prompt: string, defaultMessage = "Press Enter to continue, or provide feedback:"): string {
    return this.requestHumanInput(prompt, defaultMessage);
  }
}

export class ToolCallHookContext {
  readonly toolName: string;
  readonly tool_name: string;
  readonly tool: Tool;
  readonly agent: unknown;
  readonly task: unknown;
  readonly crew: unknown;
  readonly toolInput: Record<string, unknown>;
  readonly tool_input: Record<string, unknown>;
  toolResult: unknown;
  tool_result: unknown;

  constructor(options: {
    toolName?: string;
    tool_name?: string;
    toolInput?: Record<string, unknown>;
    tool_input?: Record<string, unknown>;
    tool: Tool;
    agent?: unknown;
    task?: unknown;
    crew?: unknown;
    toolResult?: unknown;
    tool_result?: unknown;
  }) {
    this.toolName = options.toolName ?? options.tool_name ?? options.tool.name;
    this.tool_name = this.toolName;
    this.toolInput = options.toolInput ?? options.tool_input ?? {};
    this.tool_input = this.toolInput;
    this.tool = options.tool;
    this.agent = options.agent ?? null;
    this.task = options.task ?? null;
    this.crew = options.crew ?? null;
    this.toolResult = options.toolResult ?? options.tool_result ?? null;
    this.tool_result = this.toolResult;
  }

  requestHumanInput(_prompt: string, _defaultMessage?: string): string {
    void _prompt;
    void _defaultMessage;
    return "";
  }

  request_human_input(prompt: string, defaultMessage = "Press Enter to continue, or provide feedback:"): string {
    return this.requestHumanInput(prompt, defaultMessage);
  }
}

export type BeforeLLMCallHook = (context: LLMCallHookContext) => MaybePromise<boolean | null | undefined>;
export type AfterLLMCallHook = (context: LLMCallHookContext) => MaybePromise<string | null | undefined>;
export type BeforeToolCallHook = (context: ToolCallHookContext) => MaybePromise<boolean | null | undefined>;
export type AfterToolCallHook = (context: ToolCallHookContext) => MaybePromise<string | null | undefined>;

export const ContextT = Object.freeze({ kind: "TypeVar" });
export const ReturnT = Object.freeze({ kind: "TypeVar" });
export const P = Object.freeze({ kind: "TypeVar" });
export const R = Object.freeze({ kind: "TypeVar" });
export const U = Object.freeze({ kind: "TypeVar" });
export const Hook = Object.freeze({ kind: "Hook" });
export const HTTPTransportKwargs = Object.freeze({ kind: "HTTPTransportKwargs" });
export type HTTPTransportKwargs = Record<string, unknown>;
export abstract class BaseInterceptor<TOutbound = unknown, TInbound = unknown> {
  abstract on_outbound(message: TOutbound): TOutbound;
  abstract on_inbound(message: TInbound): TInbound;

  static __get_pydantic_core_schema__(): {
    type: "plain-validator";
    validator: (value: unknown) => BaseInterceptor;
    serialization: { type: "identity" };
  } {
    return {
      type: "plain-validator",
      validator: (value: unknown) => this.validate_interceptor(value),
      serialization: { type: "identity" },
    };
  }

  static validateInterceptor(value: unknown): BaseInterceptor {
    if (!(value instanceof BaseInterceptor)) {
      const typeName = value === null ? "null" : Array.isArray(value) ? "Array" : typeof value === "object" ? value.constructor.name : typeof value;
      throw new Error(`Expected BaseInterceptor instance, got ${typeName}`);
    }
    return value;
  }

  static validate_interceptor(value: unknown): BaseInterceptor {
    return this.validateInterceptor(value);
  }

  async aon_outbound(message: TOutbound): Promise<TOutbound> {
    await Promise.resolve();
    return this.on_outbound(message);
  }

  async aon_inbound(message: TInbound): Promise<TInbound> {
    await Promise.resolve();
    return this.on_inbound(message);
  }
}
export class AsyncHTTPTransport {
  readonly interceptor: BaseInterceptor;
  readonly kwargs: HTTPTransportKwargs;

  constructor(interceptor: BaseInterceptor, kwargs: HTTPTransportKwargs = {}) {
    this.interceptor = interceptor;
    this.kwargs = { ...kwargs };
  }

  async handle_async_request(request: unknown): Promise<unknown> {
    const outbound = await this.interceptor.aon_outbound(request);
    return await this.interceptor.aon_inbound(outbound);
  }
}

export class HTTPTransport {
  readonly interceptor: BaseInterceptor;
  readonly kwargs: HTTPTransportKwargs;

  constructor(interceptor: BaseInterceptor, kwargs: HTTPTransportKwargs = {}) {
    this.interceptor = interceptor;
    this.kwargs = { ...kwargs };
  }

  handle_request(request: unknown): unknown {
    const outbound = this.interceptor.on_outbound(request);
    return this.interceptor.on_inbound(outbound);
  }
}
export const BeforeLLMCallHook = Object.freeze({ kind: "BeforeLLMCallHook" });
export const AfterLLMCallHook = Object.freeze({ kind: "AfterLLMCallHook" });
export const BeforeToolCallHook = Object.freeze({ kind: "BeforeToolCallHook" });
export const AfterToolCallHook = Object.freeze({ kind: "AfterToolCallHook" });
export const BeforeLLMCallHookType = BeforeLLMCallHook;
export const AfterLLMCallHookType = AfterLLMCallHook;
export const BeforeToolCallHookType = BeforeToolCallHook;
export const AfterToolCallHookType = AfterToolCallHook;
export const BeforeLLMCallHookCallable = BeforeLLMCallHook;
export const AfterLLMCallHookCallable = AfterLLMCallHook;
export const BeforeToolCallHookCallable = BeforeToolCallHook;
export const AfterToolCallHookCallable = AfterToolCallHook;

class HookMethod {
  readonly _meth: (...args: unknown[]) => unknown;
  readonly agents: readonly string[] | null;
  readonly tools: readonly string[] | null;

  constructor(method: (...args: unknown[]) => unknown, options: { agents?: readonly string[] | null; tools?: readonly string[] | null } = {}) {
    this._meth = method;
    this.agents = options.agents ?? null;
    this.tools = options.tools ?? null;
    Object.defineProperties(this, {
      __name__: { value: method.name, enumerable: false },
      __doc__: { value: null, enumerable: false },
    });
  }

  call(...args: unknown[]): unknown {
    return this._meth(...args);
  }

  __call__(...args: unknown[]): unknown {
    return this.call(...args);
  }
}

export class BeforeLLMCallHookMethod extends HookMethod {
  readonly is_before_llm_call_hook = true;

  constructor(method: (...args: unknown[]) => unknown, agents: readonly string[] | null = null) {
    super(method, { agents });
  }
}

export class AfterLLMCallHookMethod extends HookMethod {
  readonly is_after_llm_call_hook = true;

  constructor(method: (...args: unknown[]) => unknown, agents: readonly string[] | null = null) {
    super(method, { agents });
  }
}

export class BeforeToolCallHookMethod extends HookMethod {
  readonly is_before_tool_call_hook = true;

  constructor(method: (...args: unknown[]) => unknown, tools: readonly string[] | null = null, agents: readonly string[] | null = null) {
    super(method, { agents, tools });
  }
}

export class AfterToolCallHookMethod extends HookMethod {
  readonly is_after_tool_call_hook = true;

  constructor(method: (...args: unknown[]) => unknown, tools: readonly string[] | null = null, agents: readonly string[] | null = null) {
    super(method, { agents, tools });
  }
}

const beforeLlmCallHooks: BeforeLLMCallHook[] = [];
const afterLlmCallHooks: AfterLLMCallHook[] = [];
const beforeToolCallHooks: BeforeToolCallHook[] = [];
const afterToolCallHooks: AfterToolCallHook[] = [];

export function registerBeforeLlmCallHook(hook: BeforeLLMCallHook): void {
  beforeLlmCallHooks.push(hook);
}

export const register_before_llm_call_hook = registerBeforeLlmCallHook;

export function registerAfterLlmCallHook(hook: AfterLLMCallHook): void {
  afterLlmCallHooks.push(hook);
}

export const register_after_llm_call_hook = registerAfterLlmCallHook;

export function getBeforeLlmCallHooks(): BeforeLLMCallHook[] {
  return [...beforeLlmCallHooks];
}

export const get_before_llm_call_hooks = getBeforeLlmCallHooks;

export function getAfterLlmCallHooks(): AfterLLMCallHook[] {
  return [...afterLlmCallHooks];
}

export const get_after_llm_call_hooks = getAfterLlmCallHooks;

export function unregisterBeforeLlmCallHook(hook: BeforeLLMCallHook): boolean {
  return removeHook(beforeLlmCallHooks, hook);
}

export const unregister_before_llm_call_hook = unregisterBeforeLlmCallHook;

export function unregisterAfterLlmCallHook(hook: AfterLLMCallHook): boolean {
  return removeHook(afterLlmCallHooks, hook);
}

export const unregister_after_llm_call_hook = unregisterAfterLlmCallHook;

export function clearBeforeLlmCallHooks(): number {
  return clearHooks(beforeLlmCallHooks);
}

export const clear_before_llm_call_hooks = clearBeforeLlmCallHooks;

export function clearAfterLlmCallHooks(): number {
  return clearHooks(afterLlmCallHooks);
}

export const clear_after_llm_call_hooks = clearAfterLlmCallHooks;

export function clearAllLlmCallHooks(): [number, number] {
  return [clearBeforeLlmCallHooks(), clearAfterLlmCallHooks()];
}

export const clear_all_llm_call_hooks = clearAllLlmCallHooks;

export function registerBeforeToolCallHook(hook: BeforeToolCallHook): void {
  beforeToolCallHooks.push(hook);
}

export const register_before_tool_call_hook = registerBeforeToolCallHook;

export function registerAfterToolCallHook(hook: AfterToolCallHook): void {
  afterToolCallHooks.push(hook);
}

export const register_after_tool_call_hook = registerAfterToolCallHook;

export function getBeforeToolCallHooks(): BeforeToolCallHook[] {
  return [...beforeToolCallHooks];
}

export const get_before_tool_call_hooks = getBeforeToolCallHooks;

export function getAfterToolCallHooks(): AfterToolCallHook[] {
  return [...afterToolCallHooks];
}

export const get_after_tool_call_hooks = getAfterToolCallHooks;

export function unregisterBeforeToolCallHook(hook: BeforeToolCallHook): boolean {
  return removeHook(beforeToolCallHooks, hook);
}

export const unregister_before_tool_call_hook = unregisterBeforeToolCallHook;

export function unregisterAfterToolCallHook(hook: AfterToolCallHook): boolean {
  return removeHook(afterToolCallHooks, hook);
}

export const unregister_after_tool_call_hook = unregisterAfterToolCallHook;

export function clearBeforeToolCallHooks(): number {
  return clearHooks(beforeToolCallHooks);
}

export const clear_before_tool_call_hooks = clearBeforeToolCallHooks;

export function clearAfterToolCallHooks(): number {
  return clearHooks(afterToolCallHooks);
}

export const clear_after_tool_call_hooks = clearAfterToolCallHooks;

export function clearAllToolCallHooks(): [number, number] {
  return [clearBeforeToolCallHooks(), clearAfterToolCallHooks()];
}

export const clear_all_tool_call_hooks = clearAllToolCallHooks;

export function clearAllGlobalHooks(): { llm_hooks: [number, number]; tool_hooks: [number, number]; total: [number, number] } {
  const llmHooks = clearAllLlmCallHooks();
  const toolHooks = clearAllToolCallHooks();
  return {
    llm_hooks: llmHooks,
    tool_hooks: toolHooks,
    total: [llmHooks[0] + toolHooks[0], llmHooks[1] + toolHooks[1]],
  };
}

export const clear_all_global_hooks = clearAllGlobalHooks;

export function beforeLlmCall(hook: BeforeLLMCallHook): BeforeLLMCallHook;
export function beforeLlmCall(options: { agents?: readonly string[] }): MethodDecorator;
export function beforeLlmCall(value: BeforeLLMCallHook | { agents?: readonly string[] }): BeforeLLMCallHook | MethodDecorator {
  if (typeof value === "function") {
    return registerDecoratedHook(value, registerBeforeLlmCallHook, "is_before_llm_call_hook", {});
  }
  return createHookDecorator(registerBeforeLlmCallHook, "is_before_llm_call_hook", hookFilterOptions(value));
}

export const before_llm_call = beforeLlmCall;

export function afterLlmCall(hook: AfterLLMCallHook): AfterLLMCallHook;
export function afterLlmCall(options: { agents?: readonly string[] }): MethodDecorator;
export function afterLlmCall(value: AfterLLMCallHook | { agents?: readonly string[] }): AfterLLMCallHook | MethodDecorator {
  if (typeof value === "function") {
    return registerDecoratedHook(value, registerAfterLlmCallHook, "is_after_llm_call_hook", {});
  }
  return createHookDecorator(registerAfterLlmCallHook, "is_after_llm_call_hook", hookFilterOptions(value));
}

export const after_llm_call = afterLlmCall;

export function beforeToolCall(hook: BeforeToolCallHook): BeforeToolCallHook;
export function beforeToolCall(options: { tools?: readonly string[]; agents?: readonly string[] }): MethodDecorator;
export function beforeToolCall(value: BeforeToolCallHook | { tools?: readonly string[]; agents?: readonly string[] }): BeforeToolCallHook | MethodDecorator {
  if (typeof value === "function") {
    return registerDecoratedHook(value, registerBeforeToolCallHook, "is_before_tool_call_hook", {});
  }
  return createHookDecorator(registerBeforeToolCallHook, "is_before_tool_call_hook", hookFilterOptions(value));
}

export const before_tool_call = beforeToolCall;

export function afterToolCall(hook: AfterToolCallHook): AfterToolCallHook;
export function afterToolCall(options: { tools?: readonly string[]; agents?: readonly string[] }): MethodDecorator;
export function afterToolCall(value: AfterToolCallHook | { tools?: readonly string[]; agents?: readonly string[] }): AfterToolCallHook | MethodDecorator {
  if (typeof value === "function") {
    return registerDecoratedHook(value, registerAfterToolCallHook, "is_after_tool_call_hook", {});
  }
  return createHookDecorator(registerAfterToolCallHook, "is_after_tool_call_hook", hookFilterOptions(value));
}

export const after_tool_call = afterToolCall;

export async function runBeforeLlmCallHooks(context: LLMCallHookContext): Promise<void> {
  for (const hook of beforeLlmCallHooks) {
    if (await hook(context) === false) {
      throw new Error("LLM call blocked by before_llm_call hook.");
    }
  }
}

export async function runAfterLlmCallHooks(context: LLMCallHookContext): Promise<LLMResponse> {
  let response = context.response ?? "";
  for (const hook of afterLlmCallHooks) {
    context.response = response;
    const replacement = await hook(context);
    if (replacement !== null && replacement !== undefined) {
      response = replacement;
    }
  }
  return response;
}

export async function runBeforeToolCallHooks(context: ToolCallHookContext): Promise<void> {
  for (const hook of beforeToolCallHooks) {
    if (await hook(context) === false) {
      throw new Error(`Tool '${context.toolName}' execution blocked by before_tool_call hook.`);
    }
  }
}

export async function runAfterToolCallHooks(context: ToolCallHookContext): Promise<unknown> {
  let result = context.toolResult;
  for (const hook of afterToolCallHooks) {
    context.toolResult = result;
    context.tool_result = result;
    const replacement = await hook(context);
    if (replacement !== null && replacement !== undefined) {
      result = replacement;
    }
  }
  return result;
}

function removeHook<THook>(hooks: THook[], hook: THook): boolean {
  const index = hooks.indexOf(hook);
  if (index < 0) {
    return false;
  }
  hooks.splice(index, 1);
  return true;
}

function clearHooks(hooks: unknown[]): number {
  const count = hooks.length;
  hooks.length = 0;
  return count;
}

type HookFilterOptions = {
  agents?: readonly string[];
  tools?: readonly string[];
};

type HookRegister<THook> = (hook: THook) => void;

function createHookDecorator<THook extends (context: never) => unknown>(
  register: HookRegister<THook>,
  marker: string,
  options: HookFilterOptions,
): MethodDecorator {
  const normalizedOptions = normalizeHookFilterOptions(options);
  return ((targetOrHook: object, propertyKeyOrContext?: string | symbol | { kind: string; name?: string | symbol }) => {
    if (typeof targetOrHook === "function" && (propertyKeyOrContext === undefined || isStandardDecoratorContext(propertyKeyOrContext))) {
      markHook(targetOrHook, marker, normalizedOptions);
      if (propertyKeyOrContext === undefined) {
        registerFilteredHook(targetOrHook as THook, register, normalizedOptions);
      }
      return targetOrHook;
    }
    if (propertyKeyOrContext === undefined || typeof propertyKeyOrContext === "object") {
      return undefined;
    }
    const target = targetOrHook as Record<string | symbol, unknown>;
    const method = target[propertyKeyOrContext];
    if (typeof method === "function") {
      markHook(method, marker, normalizedOptions);
    }
    return undefined;
  }) as MethodDecorator;
}

function registerDecoratedHook<THook extends (context: never) => unknown>(
  hook: THook,
  register: HookRegister<THook>,
  marker: string,
  options: HookFilterOptions,
): THook {
  const normalizedOptions = normalizeHookFilterOptions(options);
  markHook(hook, marker, normalizedOptions);
  registerFilteredHook(hook, register, normalizedOptions);
  return hook;
}

function registerFilteredHook<THook extends (context: never) => unknown>(
  hook: THook,
  register: HookRegister<THook>,
  options: HookFilterOptions,
): void {
  if (!options.tools?.length && !options.agents?.length) {
    register(hook);
    return;
  }
  register(((context: never) => {
    if (!hookContextMatchesFilters(context, options)) {
      return null;
    }
    return hook(context);
  }) as THook);
}

function markHook(hook: object, marker: string, options: HookFilterOptions): void {
  Object.assign(hook, {
    [marker]: true,
    ...(options.agents?.length ? { agents: [...options.agents], _filter_agents: [...options.agents] } : {}),
    ...(options.tools?.length ? { tools: [...options.tools], _filter_tools: [...options.tools] } : {}),
  });
}

function normalizeHookFilterOptions(options: HookFilterOptions): HookFilterOptions {
  return {
    ...(options.agents ? { agents: [...options.agents] } : {}),
    ...(options.tools ? { tools: options.tools.map(sanitizeHookToolName) } : {}),
  };
}

function hookFilterOptions(options: { agents?: readonly string[]; tools?: readonly string[] }): HookFilterOptions {
  return {
    ...(options.agents ? { agents: options.agents } : {}),
    ...(options.tools ? { tools: options.tools } : {}),
  };
}

function hookContextMatchesFilters(context: unknown, options: HookFilterOptions): boolean {
  if (options.tools?.length && hasStringProperty(context, "tool_name") && !options.tools.includes(context.tool_name)) {
    return false;
  }
  const agent = getObjectProperty(context, "agent");
  if (options.agents?.length && agent && hasStringProperty(agent, "role") && !options.agents.includes(agent.role)) {
    return false;
  }
  return true;
}

function isStandardDecoratorContext(value: unknown): value is { kind: string } {
  return typeof value === "object" && value !== null && "kind" in value;
}

function getObjectProperty(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null && key in value
    ? (value as Record<string, unknown>)[key]
    : null;
}

function hasStringProperty<T extends string>(value: unknown, key: T): value is Record<T, string> {
  return typeof value === "object"
    && value !== null
    && key in value
    && typeof (value as Record<T, unknown>)[key] === "string";
}

function sanitizeHookToolName(name: string): string {
  return name.trim().replace(/[^\w-]/g, "_");
}
