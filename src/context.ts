import { AsyncLocalStorage } from "node:async_hooks";

export type MismatchBehavior = "warn" | "raise" | "silent";
export const MismatchBehavior = Object.freeze({
  WARN: "warn",
  RAISE: "raise",
  SILENT: "silent",
} as const);

export type EventContextConfigOptions = {
  maxStackDepth?: number;
  mismatchBehavior?: MismatchBehavior;
  emptyPopBehavior?: MismatchBehavior;
};

export class StackDepthExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StackDepthExceededError";
  }
}

export class EventPairingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventPairingError";
  }
}

export class EmptyStackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmptyStackError";
  }
}

export class EventContextConfig {
  readonly maxStackDepth: number;
  readonly mismatchBehavior: MismatchBehavior;
  readonly emptyPopBehavior: MismatchBehavior;

  constructor(options: EventContextConfigOptions = {}) {
    this.maxStackDepth = options.maxStackDepth ?? 100;
    this.mismatchBehavior = options.mismatchBehavior ?? "warn";
    this.emptyPopBehavior = options.emptyPopBehavior ?? "warn";
  }
}

export type EventScopeEntry = readonly [eventId: string, eventType: string];

export type ExecutionContextOptions = {
  currentTaskId?: string | null;
  flowRequestId?: string | null;
  flowId?: string | null;
  flowName?: string | null;
  flowMethodName?: string;
  eventIdStack?: readonly EventScopeEntry[];
  lastEventId?: string | null;
  triggeringEventId?: string | null;
  emissionSequence?: number;
  feedbackCallbackInfo?: Record<string, unknown> | null;
  platformToken?: string | null;
  eventContextConfig?: EventContextConfig | EventContextConfigOptions | null;
};

export class ExecutionContext {
  currentTaskId: string | null;
  flowRequestId: string | null;
  flowId: string | null;
  flowName: string | null;
  flowMethodName: string;
  eventIdStack: EventScopeEntry[];
  lastEventId: string | null;
  triggeringEventId: string | null;
  emissionSequence: number;
  feedbackCallbackInfo: Record<string, unknown> | null;
  platformToken: string | null;
  eventContextConfig: EventContextConfig | null;

  constructor(options: ExecutionContextOptions = {}) {
    this.currentTaskId = options.currentTaskId ?? null;
    this.flowRequestId = options.flowRequestId ?? null;
    this.flowId = options.flowId ?? null;
    this.flowName = options.flowName ?? null;
    this.flowMethodName = options.flowMethodName ?? "unknown";
    this.eventIdStack = [...(options.eventIdStack ?? [])];
    this.lastEventId = options.lastEventId ?? null;
    this.triggeringEventId = options.triggeringEventId ?? null;
    this.emissionSequence = options.emissionSequence ?? 0;
    this.feedbackCallbackInfo = options.feedbackCallbackInfo ?? null;
    this.platformToken = options.platformToken ?? null;
    this.eventContextConfig = normalizeEventContextConfig(options.eventContextConfig);
  }

  clone(): ExecutionContext {
    return new ExecutionContext({
      currentTaskId: this.currentTaskId,
      flowRequestId: this.flowRequestId,
      flowId: this.flowId,
      flowName: this.flowName,
      flowMethodName: this.flowMethodName,
      eventIdStack: this.eventIdStack,
      lastEventId: this.lastEventId,
      triggeringEventId: this.triggeringEventId,
      emissionSequence: this.emissionSequence,
      feedbackCallbackInfo: this.feedbackCallbackInfo ? { ...this.feedbackCallbackInfo } : null,
      platformToken: this.platformToken,
      eventContextConfig: this.eventContextConfig,
    });
  }

  toJSON(): Record<string, unknown> {
    return {
      currentTaskId: this.currentTaskId,
      flowRequestId: this.flowRequestId,
      flowId: this.flowId,
      flowName: this.flowName,
      flowMethodName: this.flowMethodName,
      eventIdStack: this.eventIdStack.map(([eventId, eventType]) => [eventId, eventType]),
      lastEventId: this.lastEventId,
      triggeringEventId: this.triggeringEventId,
      emissionSequence: this.emissionSequence,
      feedbackCallbackInfo: this.feedbackCallbackInfo,
      platformToken: this.platformToken,
    };
  }
}

const storage = new AsyncLocalStorage<ExecutionContext>();
const defaultContext = new ExecutionContext();
const defaultEventContextConfig = new EventContextConfig();
let runtimeStateProvider: (() => unknown) | null = null;

export function setEventRuntimeStateProvider(provider: (() => unknown) | null): void {
  runtimeStateProvider = provider;
}

export const SCOPE_STARTING_EVENTS = new Set<string>([
  "flow_started",
  "method_execution_started",
  "crew_kickoff_started",
  "crew_train_started",
  "crew_test_started",
  "agent_execution_started",
  "agent_evaluation_started",
  "lite_agent_execution_started",
  "task_started",
  "llm_call_started",
  "llm_guardrail_started",
  "tool_usage_started",
  "mcp_connection_started",
  "mcp_tool_execution_started",
  "memory_retrieval_started",
  "memory_save_started",
  "memory_query_started",
  "knowledge_query_started",
  "knowledge_search_query_started",
  "a2a_delegation_started",
  "a2a_conversation_started",
  "a2a_server_task_started",
  "a2a_parallel_delegation_started",
  "agent_reasoning_started",
]);

export const SCOPE_ENDING_EVENTS = new Set<string>([
  "flow_finished",
  "flow_failed",
  "flow_paused",
  "method_execution_finished",
  "method_execution_failed",
  "method_execution_paused",
  "crew_kickoff_completed",
  "crew_kickoff_failed",
  "crew_train_completed",
  "crew_train_failed",
  "crew_test_completed",
  "crew_test_failed",
  "agent_execution_completed",
  "agent_execution_error",
  "agent_evaluation_completed",
  "agent_evaluation_failed",
  "lite_agent_execution_completed",
  "lite_agent_execution_error",
  "task_completed",
  "task_failed",
  "llm_call_completed",
  "llm_call_failed",
  "llm_guardrail_completed",
  "llm_guardrail_failed",
  "tool_usage_finished",
  "tool_usage_error",
  "mcp_connection_completed",
  "mcp_connection_failed",
  "mcp_tool_execution_completed",
  "mcp_tool_execution_failed",
  "memory_retrieval_completed",
  "memory_retrieval_failed",
  "memory_save_completed",
  "memory_save_failed",
  "memory_query_completed",
  "memory_query_failed",
  "knowledge_query_completed",
  "knowledge_query_failed",
  "knowledge_search_query_completed",
  "knowledge_search_query_failed",
  "a2a_delegation_completed",
  "a2a_conversation_completed",
  "a2a_server_task_completed",
  "a2a_server_task_canceled",
  "a2a_server_task_failed",
  "a2a_parallel_delegation_completed",
  "agent_reasoning_completed",
  "agent_reasoning_failed",
]);

export const VALID_EVENT_PAIRS: Readonly<Record<string, string>> = {
  flow_finished: "flow_started",
  flow_failed: "flow_started",
  flow_paused: "flow_started",
  method_execution_finished: "method_execution_started",
  method_execution_failed: "method_execution_started",
  method_execution_paused: "method_execution_started",
  crew_kickoff_completed: "crew_kickoff_started",
  crew_kickoff_failed: "crew_kickoff_started",
  crew_train_completed: "crew_train_started",
  crew_train_failed: "crew_train_started",
  crew_test_completed: "crew_test_started",
  crew_test_failed: "crew_test_started",
  agent_execution_completed: "agent_execution_started",
  agent_execution_error: "agent_execution_started",
  agent_evaluation_completed: "agent_evaluation_started",
  agent_evaluation_failed: "agent_evaluation_started",
  lite_agent_execution_completed: "lite_agent_execution_started",
  lite_agent_execution_error: "lite_agent_execution_started",
  task_completed: "task_started",
  task_failed: "task_started",
  llm_call_completed: "llm_call_started",
  llm_call_failed: "llm_call_started",
  llm_guardrail_completed: "llm_guardrail_started",
  llm_guardrail_failed: "llm_guardrail_started",
  tool_usage_finished: "tool_usage_started",
  tool_usage_error: "tool_usage_started",
  mcp_connection_completed: "mcp_connection_started",
  mcp_connection_failed: "mcp_connection_started",
  mcp_tool_execution_completed: "mcp_tool_execution_started",
  mcp_tool_execution_failed: "mcp_tool_execution_started",
  memory_retrieval_completed: "memory_retrieval_started",
  memory_retrieval_failed: "memory_retrieval_started",
  memory_save_completed: "memory_save_started",
  memory_save_failed: "memory_save_started",
  memory_query_completed: "memory_query_started",
  memory_query_failed: "memory_query_started",
  knowledge_query_completed: "knowledge_query_started",
  knowledge_query_failed: "knowledge_query_started",
  knowledge_search_query_completed: "knowledge_search_query_started",
  knowledge_search_query_failed: "knowledge_search_query_started",
  a2a_delegation_completed: "a2a_delegation_started",
  a2a_conversation_completed: "a2a_conversation_started",
  a2a_server_task_completed: "a2a_server_task_started",
  a2a_server_task_canceled: "a2a_server_task_started",
  a2a_server_task_failed: "a2a_server_task_started",
  a2a_parallel_delegation_completed: "a2a_parallel_delegation_started",
  agent_reasoning_completed: "agent_reasoning_started",
  agent_reasoning_failed: "agent_reasoning_started",
};

export function runWithExecutionContext<T>(ctx: ExecutionContext | ExecutionContextOptions, fn: () => T): T {
  return storage.run(ctx instanceof ExecutionContext ? ctx.clone() : new ExecutionContext(ctx), fn);
}

export const run_with_execution_context = runWithExecutionContext;

export function captureExecutionContext(
  feedbackCallbackInfo?: Record<string, unknown> | null,
): ExecutionContext {
  const ctx = currentContext().clone();
  if (feedbackCallbackInfo !== undefined) {
    ctx.feedbackCallbackInfo = feedbackCallbackInfo;
  }
  return ctx;
}

export const capture_execution_context = captureExecutionContext;

export function applyExecutionContext(ctx: ExecutionContext): void {
  const target = currentContext();
  target.currentTaskId = ctx.currentTaskId;
  target.flowRequestId = ctx.flowRequestId;
  target.flowId = ctx.flowId;
  target.flowName = ctx.flowName;
  target.flowMethodName = ctx.flowMethodName;
  target.eventIdStack = [...ctx.eventIdStack];
  target.lastEventId = ctx.lastEventId;
  target.triggeringEventId = ctx.triggeringEventId;
  target.emissionSequence = ctx.emissionSequence;
  target.feedbackCallbackInfo = ctx.feedbackCallbackInfo ? { ...ctx.feedbackCallbackInfo } : null;
  target.platformToken = ctx.platformToken;
  target.eventContextConfig = ctx.eventContextConfig;
}

export const apply_execution_context = applyExecutionContext;

export function setPlatformIntegrationToken(integrationToken: string | null): void {
  currentContext().platformToken = integrationToken;
}

export const set_platform_integration_token = setPlatformIntegrationToken;

export function getPlatformIntegrationToken(): string | null {
  return currentContext().platformToken ?? process.env.CREWAI_PLATFORM_INTEGRATION_TOKEN ?? null;
}

export const get_platform_integration_token = getPlatformIntegrationToken;

export function withPlatformContext<T>(integrationToken: string, fn: () => T): T {
  const ctx = currentContext().clone();
  ctx.platformToken = integrationToken;
  return storage.run(ctx, fn);
}

export const platformContext = withPlatformContext;
export const platform_context = withPlatformContext;

export function setCurrentTaskId(taskId: string | null): string | null {
  const ctx = currentContext();
  const previous = ctx.currentTaskId;
  ctx.currentTaskId = taskId;
  return previous;
}

export const set_current_task_id = setCurrentTaskId;

export function resetCurrentTaskId(token: string | null): void {
  currentContext().currentTaskId = token;
}

export const reset_current_task_id = resetCurrentTaskId;

export function getCurrentTaskId(): string | null {
  return currentContext().currentTaskId;
}

export const get_current_task_id = getCurrentTaskId;

export function setCurrentFlowContext(options: {
  flowRequestId?: string | null;
  flowId?: string | null;
  flowName?: string | null;
  flowMethodName?: string;
}): void {
  const ctx = currentContext();
  if ("flowRequestId" in options) {
    ctx.flowRequestId = options.flowRequestId ?? null;
  }
  if ("flowId" in options) {
    ctx.flowId = options.flowId ?? null;
  }
  if ("flowName" in options) {
    ctx.flowName = options.flowName ?? null;
  }
  if (options.flowMethodName !== undefined) {
    ctx.flowMethodName = options.flowMethodName;
  }
}

export const set_current_flow_context = setCurrentFlowContext;

export function getCurrentFlowRequestId(): string | null {
  return currentContext().flowRequestId;
}

export const get_current_flow_request_id = getCurrentFlowRequestId;

export function getCurrentFlowId(): string | null {
  return currentContext().flowId;
}

export const get_current_flow_id = getCurrentFlowId;

export function getCurrentFlowName(): string | null {
  return currentContext().flowName;
}

export const get_current_flow_name = getCurrentFlowName;

export function getCurrentFlowMethodName(): string {
  return currentContext().flowMethodName;
}

export const get_current_flow_method_name = getCurrentFlowMethodName;

export type FlowContextVariable<T> = {
  get: () => T;
  set: (value: T) => T;
};

export const currentFlowRequestId: FlowContextVariable<string | null> = {
  get: getCurrentFlowRequestId,
  set: (value) => {
    const previous = getCurrentFlowRequestId();
    setCurrentFlowContext({ flowRequestId: value });
    return previous;
  },
};

export const current_flow_request_id = currentFlowRequestId;

export const currentFlowId: FlowContextVariable<string | null> = {
  get: getCurrentFlowId,
  set: (value) => {
    const previous = getCurrentFlowId();
    setCurrentFlowContext({ flowId: value });
    return previous;
  },
};

export const current_flow_id = currentFlowId;

export const currentFlowName: FlowContextVariable<string | null> = {
  get: getCurrentFlowName,
  set: (value) => {
    const previous = getCurrentFlowName();
    setCurrentFlowContext({ flowName: value });
    return previous;
  },
};

export const current_flow_name = currentFlowName;

export const currentFlowMethodName: FlowContextVariable<string> = {
  get: getCurrentFlowMethodName,
  set: (value) => {
    const previous = getCurrentFlowMethodName();
    setCurrentFlowContext({ flowMethodName: value });
    return previous;
  },
};

export const current_flow_method_name = currentFlowMethodName;

export class FlowTrackable {
  _requestId: string | null;
  _request_id: string | null;
  _flowId: string | null;
  _flow_id: string | null;

  constructor() {
    this._requestId = null;
    this._request_id = null;
    this._flowId = null;
    this._flow_id = null;
    this._set_flow_context();
  }

  _set_flow_context(): this {
    const requestId = getCurrentFlowRequestId();
    this._requestId = requestId;
    this._request_id = requestId;
    this._flowId = requestId ? getCurrentFlowId() : null;
    this._flow_id = this._flowId;
    return this;
  }
}

export function getCurrentParentId(): string | null {
  const stack = currentContext().eventIdStack;
  return stack.at(-1)?.[0] ?? null;
}

export const get_current_parent_id = getCurrentParentId;

export function getEnclosingParentId(): string | null {
  const stack = currentContext().eventIdStack;
  return stack.length >= 2 ? stack.at(-2)?.[0] ?? null : null;
}

export const get_enclosing_parent_id = getEnclosingParentId;

export function getLastEventId(): string | null {
  return currentContext().lastEventId;
}

export const get_last_event_id = getLastEventId;

export function setLastEventId(eventId: string | null): void {
  currentContext().lastEventId = eventId;
}

export const set_last_event_id = setLastEventId;

export function resetLastEventId(): void {
  setLastEventId(null);
}

export const reset_last_event_id = resetLastEventId;

export function getTriggeringEventId(): string | null {
  return currentContext().triggeringEventId;
}

export const get_triggering_event_id = getTriggeringEventId;

export function setTriggeringEventId(eventId: string | null): void {
  currentContext().triggeringEventId = eventId;
}

export const set_triggering_event_id = setTriggeringEventId;

export function triggeredByScope<T>(eventId: string, fn: () => T): T {
  const ctx = currentContext().clone();
  ctx.triggeringEventId = eventId;
  return storage.run(ctx, fn);
}

export const triggered_by_scope = triggeredByScope;

export function restoreEventScope(stack: readonly EventScopeEntry[]): void {
  currentContext().eventIdStack = [...stack];
}

export const restore_event_scope = restoreEventScope;

export function resume_task_scope(task_id: string): boolean {
  const runtimeState = runtimeStateProvider?.();
  if (!runtimeState || typeof runtimeState !== "object") {
    return false;
  }
  const eventRecord = readObjectProperty(runtimeState, "eventRecord") ?? readObjectProperty(runtimeState, "event_record");
  const allNodes = readFunction(eventRecord, "allNodes") ?? readFunction(eventRecord, "all_nodes");
  if (!allNodes) {
    return false;
  }
  const nodes = allNodes.call(eventRecord);
  if (!Array.isArray(nodes)) {
    return false;
  }
  const events = nodes
    .map((node) => readObjectProperty(node, "event"))
    .filter(isResumableTaskStartEvent(task_id));
  const latest = events.sort((left, right) => eventSequence(right) - eventSequence(left))[0];
  const eventId = latest ? String(latest.eventId ?? latest.event_id) : null;
  if (!eventId) {
    return false;
  }
  pushEventScope(eventId, "task_started");
  return true;
}

export function pushEventScope(eventId: string, eventType = ""): void {
  const ctx = currentContext();
  const config = ctx.eventContextConfig ?? defaultEventContextConfig;
  if (config.maxStackDepth > 0 && ctx.eventIdStack.length >= config.maxStackDepth) {
    throw new StackDepthExceededError(
      `Event stack depth limit (${String(config.maxStackDepth)}) exceeded. This usually indicates missing ending events.`,
    );
  }
  ctx.eventIdStack = [...ctx.eventIdStack, [eventId, eventType]];
}

export const push_event_scope = pushEventScope;

export function popEventScope(): EventScopeEntry | null {
  const ctx = currentContext();
  const entry = ctx.eventIdStack.at(-1) ?? null;
  if (!entry) {
    return null;
  }
  ctx.eventIdStack = ctx.eventIdStack.slice(0, -1);
  return entry;
}

export const pop_event_scope = popEventScope;

export function eventScope<T>(eventId: string, eventType: string, fn: () => T): T {
  const alreadyOnStack = currentContext().eventIdStack.some(([entryEventId]) => entryEventId === eventId);
  if (!alreadyOnStack) {
    pushEventScope(eventId, eventType);
  }
  try {
    return fn();
  } finally {
    if (!alreadyOnStack) {
      popEventScope();
    }
  }
}

export const event_scope = eventScope;

export function getNextEmissionSequence(): number {
  const ctx = currentContext();
  ctx.emissionSequence += 1;
  return ctx.emissionSequence;
}

export const get_next_emission_sequence = getNextEmissionSequence;

export function getEmissionSequence(): number {
  return currentContext().emissionSequence;
}

export const get_emission_sequence = getEmissionSequence;

export function resetEmissionCounter(): void {
  currentContext().emissionSequence = 0;
}

export const reset_emission_counter = resetEmissionCounter;

export function setEmissionCounter(start: number): void {
  currentContext().emissionSequence = Math.max(0, Math.trunc(start));
}

export const set_emission_counter = setEmissionCounter;

export function setEventContextConfig(config: EventContextConfig | EventContextConfigOptions | null): void {
  currentContext().eventContextConfig = normalizeEventContextConfig(config);
}

export const set_event_context_config = setEventContextConfig;

export function getEventContextConfig(): EventContextConfig {
  return currentContext().eventContextConfig ?? defaultEventContextConfig;
}

export const get_event_context_config = getEventContextConfig;

export function handleEmptyPop(eventTypeName: string): void {
  const config = getEventContextConfig();
  const message = `Ending event '${eventTypeName}' emitted with empty scope stack. Missing starting event?`;
  if (config.emptyPopBehavior === "raise") {
    throw new EmptyStackError(message);
  }
  if (config.emptyPopBehavior === "warn") {
    console.warn(`[CrewAIEventsBus] Warning: ${message}`);
  }
}

export const handle_empty_pop = handleEmptyPop;

export function handleMismatch(eventTypeName: string, poppedType: string, expectedStart: string): void {
  const config = getEventContextConfig();
  const message = `Event pairing mismatch. '${eventTypeName}' closed '${poppedType}' (expected '${expectedStart}')`;
  if (config.mismatchBehavior === "raise") {
    throw new EventPairingError(message);
  }
  if (config.mismatchBehavior === "warn") {
    console.warn(`[CrewAIEventsBus] Warning: ${message}`);
  }
}

export const handle_mismatch = handleMismatch;

function currentContext(): ExecutionContext {
  return storage.getStore() ?? defaultContext;
}

function normalizeEventContextConfig(
  config: EventContextConfig | EventContextConfigOptions | null | undefined,
): EventContextConfig | null {
  if (!config) {
    return null;
  }
  return config instanceof EventContextConfig ? config : new EventContextConfig(config);
}

function readObjectProperty(value: unknown, key: string): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || !(key in value)) {
    return null;
  }
  const property = (value as Record<string, unknown>)[key];
  return property && typeof property === "object" ? property as Record<string, unknown> : null;
}

function readFunction(value: unknown, key: string): ((...args: unknown[]) => unknown) | null {
  if (!value || typeof value !== "object" || !(key in value)) {
    return null;
  }
  const property = (value as Record<string, unknown>)[key];
  return typeof property === "function" ? property as (...args: unknown[]) => unknown : null;
}

function isResumableTaskStartEvent(taskId: string): (event: Record<string, unknown> | null) => event is Record<string, unknown> {
  return (event): event is Record<string, unknown> => {
    if (!event) {
      return false;
    }
    return event.type === "task_started"
      && (event.taskId === taskId || event.task_id === taskId)
      && typeof (event.eventId ?? event.event_id) === "string";
  };
}

function eventSequence(event: Record<string, unknown>): number {
  const sequence = event.emissionSequence ?? event.emission_sequence;
  return typeof sequence === "number" && Number.isFinite(sequence) ? sequence : 0;
}
