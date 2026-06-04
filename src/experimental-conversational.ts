import { randomUUID } from "node:crypto";

import type { LLMMessage } from "./types.js";

export type ConversationMessageRole = "user" | "assistant" | "system" | "tool";
export const ConversationMessageRole = Object.freeze({ kind: "ConversationMessageRole" });

export type ConversationEventVisibility = "private" | "public";
export const ConversationEventVisibility = Object.freeze({ kind: "ConversationEventVisibility" });

export type RouterConfigOptions = {
  prompt?: string | null;
  responseFormat?: unknown;
  response_format?: unknown;
  llm?: unknown;
  routes?: readonly string[] | null;
  routeDescriptions?: Record<string, string> | null;
  route_descriptions?: Record<string, string> | null;
  defaultIntent?: string | null;
  default_intent?: string | null;
  fallbackIntent?: string | null;
  fallback_intent?: string | null;
  intentField?: string;
  intent_field?: string;
};

export class RouterConfig {
  readonly prompt: string | null;
  readonly responseFormat: unknown;
  readonly response_format: unknown;
  readonly llm: unknown;
  readonly routes: readonly string[] | null;
  readonly routeDescriptions: Record<string, string> | null;
  readonly route_descriptions: Record<string, string> | null;
  readonly defaultIntent: string | null;
  readonly default_intent: string | null;
  readonly fallbackIntent: string | null;
  readonly fallback_intent: string | null;
  readonly intentField: string;
  readonly intent_field: string;

  constructor(options: RouterConfigOptions = {}) {
    this.prompt = options.prompt ?? null;
    this.responseFormat = options.responseFormat ?? options.response_format ?? null;
    this.response_format = this.responseFormat;
    this.llm = options.llm ?? null;
    this.routes = options.routes ? [...options.routes] : null;
    this.routeDescriptions = options.routeDescriptions ?? options.route_descriptions ?? null;
    this.route_descriptions = this.routeDescriptions;
    this.defaultIntent = options.defaultIntent ?? options.default_intent ?? "converse";
    this.default_intent = this.defaultIntent;
    this.fallbackIntent = options.fallbackIntent ?? options.fallback_intent ?? "converse";
    this.fallback_intent = this.fallbackIntent;
    this.intentField = options.intentField ?? options.intent_field ?? "intent";
    this.intent_field = this.intentField;
  }
}

export type ConversationConfigOptions = {
  systemPrompt?: string | null;
  system_prompt?: string | null;
  llm?: unknown;
  router?: RouterConfig | RouterConfigOptions | null;
  answerFromHistoryPrompt?: string | null;
  answer_from_history_prompt?: string | null;
  defaultIntents?: readonly string[] | null;
  default_intents?: readonly string[] | null;
  intentLlm?: unknown;
  intent_llm?: unknown;
  answerFromHistoryLlm?: unknown;
  answer_from_history_llm?: unknown;
  visibleAgentOutputs?: readonly string[] | "all" | null;
  visible_agent_outputs?: readonly string[] | "all" | null;
  deferTraceFinalization?: boolean;
  defer_trace_finalization?: boolean;
};

export class ConversationConfig {
  readonly systemPrompt: string | null;
  readonly system_prompt: string | null;
  readonly llm: unknown;
  readonly router: RouterConfig | null;
  readonly answerFromHistoryPrompt: string | null;
  readonly answer_from_history_prompt: string | null;
  readonly defaultIntents: readonly string[] | null;
  readonly default_intents: readonly string[] | null;
  readonly intentLlm: unknown;
  readonly intent_llm: unknown;
  readonly answerFromHistoryLlm: unknown;
  readonly answer_from_history_llm: unknown;
  readonly visibleAgentOutputs: readonly string[] | "all" | null;
  readonly visible_agent_outputs: readonly string[] | "all" | null;
  readonly deferTraceFinalization: boolean;
  readonly defer_trace_finalization: boolean;

  constructor(options: ConversationConfigOptions = {}) {
    this.systemPrompt = options.systemPrompt ?? options.system_prompt ?? null;
    this.system_prompt = this.systemPrompt;
    this.llm = options.llm ?? null;
    const router = options.router ?? null;
    this.router = router instanceof RouterConfig ? router : router ? new RouterConfig(router) : null;
    this.answerFromHistoryPrompt = options.answerFromHistoryPrompt ?? options.answer_from_history_prompt ?? null;
    this.answer_from_history_prompt = this.answerFromHistoryPrompt;
    this.defaultIntents = options.defaultIntents ?? options.default_intents ?? null;
    this.default_intents = this.defaultIntents;
    this.intentLlm = options.intentLlm ?? options.intent_llm ?? null;
    this.intent_llm = this.intentLlm;
    this.answerFromHistoryLlm = options.answerFromHistoryLlm ?? options.answer_from_history_llm ?? null;
    this.answer_from_history_llm = this.answerFromHistoryLlm;
    this.visibleAgentOutputs = options.visibleAgentOutputs ?? options.visible_agent_outputs ?? null;
    this.visible_agent_outputs = this.visibleAgentOutputs;
    this.deferTraceFinalization = options.deferTraceFinalization ?? options.defer_trace_finalization ?? true;
    this.defer_trace_finalization = this.deferTraceFinalization;
  }

  __call__<T extends object>(flowClass: T): T {
    (flowClass as Record<string, unknown>).conversational_config = this;
    return flowClass;
  }
}

export type ConversationMessageOptions = {
  role: ConversationMessageRole;
  content: string | readonly Record<string, unknown>[] | null;
  name?: string | null;
  tool_call_id?: string | null;
  toolCallId?: string | null;
  tool_calls?: readonly Record<string, unknown>[] | null;
  toolCalls?: readonly Record<string, unknown>[] | null;
  files?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};

export class ConversationMessage {
  readonly role: ConversationMessageRole;
  readonly content: string | readonly Record<string, unknown>[] | null;
  readonly name: string | null;
  readonly tool_call_id: string | null;
  readonly toolCallId: string | null;
  readonly tool_calls: readonly Record<string, unknown>[] | null;
  readonly toolCalls: readonly Record<string, unknown>[] | null;
  readonly files: Record<string, unknown> | null;
  readonly metadata: Record<string, unknown>;

  constructor(options: ConversationMessageOptions) {
    this.role = options.role;
    this.content = options.content;
    this.name = options.name ?? null;
    this.tool_call_id = options.tool_call_id ?? options.toolCallId ?? null;
    this.toolCallId = this.tool_call_id;
    this.tool_calls = options.tool_calls ?? options.toolCalls ?? null;
    this.toolCalls = this.tool_calls;
    this.files = options.files ?? null;
    this.metadata = options.metadata ?? {};
  }

  modelDump(options: { exclude_none?: boolean; excludeNone?: boolean } = {}): Record<string, unknown> {
    return compactObject({
      role: this.role,
      content: this.content,
      name: this.name,
      tool_call_id: this.tool_call_id,
      tool_calls: this.tool_calls,
      files: this.files,
      metadata: this.metadata,
    }, options.excludeNone ?? options.exclude_none ?? false);
  }

  model_dump(options: { exclude_none?: boolean; excludeNone?: boolean } = {}): Record<string, unknown> {
    return this.modelDump(options);
  }
}

export type AgentMessageOptions = {
  role?: string;
  content: unknown;
  metadata?: Record<string, unknown>;
};

export class AgentMessage {
  readonly role: string;
  readonly content: unknown;
  readonly metadata: Record<string, unknown>;

  constructor(options: AgentMessageOptions) {
    this.role = options.role ?? "assistant";
    this.content = options.content;
    this.metadata = options.metadata ?? {};
  }

  model_dump(options: { exclude_none?: boolean; excludeNone?: boolean } = {}): Record<string, unknown> {
    return compactObject({ role: this.role, content: this.content, metadata: this.metadata }, options.excludeNone ?? options.exclude_none ?? false);
  }
}

export type ConversationEventOptions = {
  type: string;
  payload?: Record<string, unknown>;
  agent_name?: string | null;
  agentName?: string | null;
  visibility?: ConversationEventVisibility;
};

export class ConversationEvent {
  readonly type: string;
  readonly payload: Record<string, unknown>;
  readonly agent_name: string | null;
  readonly agentName: string | null;
  readonly visibility: ConversationEventVisibility;

  constructor(options: ConversationEventOptions) {
    this.type = options.type;
    this.payload = options.payload ?? {};
    this.agent_name = options.agent_name ?? options.agentName ?? null;
    this.agentName = this.agent_name;
    this.visibility = options.visibility ?? "private";
  }

  model_dump(options: { exclude_none?: boolean; excludeNone?: boolean } = {}): Record<string, unknown> {
    return compactObject({
      type: this.type,
      payload: this.payload,
      agent_name: this.agent_name,
      visibility: this.visibility,
    }, options.excludeNone ?? options.exclude_none ?? false);
  }
}

export type ConversationStateOptions = {
  id?: string;
  messages?: readonly (ConversationMessage | ConversationMessageOptions)[];
  current_user_message?: string | null;
  currentUserMessage?: string | null;
  last_user_message?: string | null;
  lastUserMessage?: string | null;
  last_intent?: string | null;
  lastIntent?: string | null;
  ended?: boolean;
  events?: readonly (ConversationEvent | ConversationEventOptions)[];
  agent_threads?: Record<string, readonly (AgentMessage | AgentMessageOptions)[]>;
  agentThreads?: Record<string, readonly (AgentMessage | AgentMessageOptions)[]>;
  session_ready?: boolean;
  sessionReady?: boolean;
};

export class ConversationState {
  readonly id: string;
  messages: ConversationMessage[];
  current_user_message: string | null;
  currentUserMessage: string | null;
  last_user_message: string | null;
  lastUserMessage: string | null;
  last_intent: string | null;
  lastIntent: string | null;
  ended: boolean;
  events: ConversationEvent[];
  agent_threads: Record<string, AgentMessage[]>;
  agentThreads: Record<string, AgentMessage[]>;
  session_ready: boolean;
  sessionReady: boolean;

  constructor(options: ConversationStateOptions = {}) {
    this.id = options.id ?? randomUUID();
    this.messages = (options.messages ?? []).map((message) => message instanceof ConversationMessage ? message : new ConversationMessage(message));
    this.current_user_message = options.current_user_message ?? options.currentUserMessage ?? null;
    this.currentUserMessage = this.current_user_message;
    this.last_user_message = options.last_user_message ?? options.lastUserMessage ?? null;
    this.lastUserMessage = this.last_user_message;
    this.last_intent = options.last_intent ?? options.lastIntent ?? null;
    this.lastIntent = this.last_intent;
    this.ended = options.ended ?? false;
    this.events = (options.events ?? []).map((event) => event instanceof ConversationEvent ? event : new ConversationEvent(event));
    this.agent_threads = Object.fromEntries(
      Object.entries(options.agent_threads ?? options.agentThreads ?? {}).map(([agent, messages]) => [
        agent,
        messages.map((message) => message instanceof AgentMessage ? message : new AgentMessage(message)),
      ]),
    );
    this.agentThreads = this.agent_threads;
    this.session_ready = options.session_ready ?? options.sessionReady ?? false;
    this.sessionReady = this.session_ready;
  }

  isReady(): boolean {
    return this.session_ready;
  }

  is_ready(): boolean {
    return this.isReady();
  }
}

export function messageToLlmDict(message: unknown): LLMMessage {
  const data = message instanceof ConversationMessage
    ? message.model_dump({ exclude_none: true })
    : isRecord(message)
      ? { ...message }
      : { role: "user", content: stringifyMessageContent(message) };
  Reflect.deleteProperty(data, "metadata");
  return data as LLMMessage;
}

export const message_to_llm_dict = messageToLlmDict;

export function _conversational_only<T extends (...args: never[]) => unknown>(func: T): T {
  (func as unknown as Record<string, unknown>).__conversational_only__ = true;
  return func;
}

function compactObject(record: Record<string, unknown>, excludeNone: boolean): Record<string, unknown> {
  if (!excludeNone) {
    return record;
  }
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== null && value !== undefined));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringifyMessageContent(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}
