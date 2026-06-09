import { randomUUID } from "node:crypto";

import type { LLM } from "@crewai-ts/core/llm";
import type { LLMMessage } from "@crewai-ts/core/types";

const EXIT_COMMANDS_DEFAULT = Object.freeze(["exit", "quit"]);

export type ConversationalInputs = {
  id?: string;
  user_message?: string | Record<string, unknown>;
  last_intent?: string;
};
export const ConversationalInputs = Object.freeze({ kind: "ConversationalInputs" });

export type ConversationalConfigOptions = {
  defaultIntents?: readonly string[] | null;
  default_intents?: readonly string[] | null;
  intentLlm?: string | null;
  intent_llm?: string | null;
  interactivePrompt?: string;
  interactive_prompt?: string;
  interactiveTimeout?: number | null;
  interactive_timeout?: number | null;
  exitCommands?: readonly string[];
  exit_commands?: readonly string[];
  deferTraceFinalization?: boolean;
  defer_trace_finalization?: boolean;
};

export class ConversationalConfig {
  readonly defaultIntents: readonly string[] | null;
  readonly default_intents: readonly string[] | null;
  readonly intentLlm: string | null;
  readonly intent_llm: string | null;
  readonly interactivePrompt: string;
  readonly interactive_prompt: string;
  readonly interactiveTimeout: number | null;
  readonly interactive_timeout: number | null;
  readonly exitCommands: readonly string[];
  readonly exit_commands: readonly string[];
  readonly deferTraceFinalization: boolean;
  readonly defer_trace_finalization: boolean;

  constructor(options: ConversationalConfigOptions = {}) {
    this.defaultIntents = options.defaultIntents ?? options.default_intents ?? null;
    this.default_intents = this.defaultIntents;
    this.intentLlm = options.intentLlm ?? options.intent_llm ?? null;
    this.intent_llm = this.intentLlm;
    this.interactivePrompt = options.interactivePrompt ?? options.interactive_prompt ?? "You: ";
    this.interactive_prompt = this.interactivePrompt;
    this.interactiveTimeout = options.interactiveTimeout ?? options.interactive_timeout ?? null;
    this.interactive_timeout = this.interactiveTimeout;
    this.exitCommands = [...(options.exitCommands ?? options.exit_commands ?? EXIT_COMMANDS_DEFAULT)];
    this.exit_commands = this.exitCommands;
    this.deferTraceFinalization = options.deferTraceFinalization ?? options.defer_trace_finalization ?? true;
    this.defer_trace_finalization = this.deferTraceFinalization;
  }
}

export class ChatState {
  id: string;
  messages: LLMMessage[];
  last_user_message: string | null;
  lastUserMessage: string | null;
  last_intent: string | null;
  lastIntent: string | null;
  session_ready: boolean;
  sessionReady: boolean;

  constructor(options: {
    id?: string;
    messages?: readonly LLMMessage[];
    last_user_message?: string | null;
    lastUserMessage?: string | null;
    last_intent?: string | null;
    lastIntent?: string | null;
    session_ready?: boolean;
    sessionReady?: boolean;
  } = {}) {
    this.id = options.id ?? randomUUID();
    this.messages = [...(options.messages ?? [])];
    this.last_user_message = options.last_user_message ?? options.lastUserMessage ?? null;
    this.lastUserMessage = this.last_user_message;
    this.last_intent = options.last_intent ?? options.lastIntent ?? null;
    this.lastIntent = this.last_intent;
    this.session_ready = options.session_ready ?? options.sessionReady ?? false;
    this.sessionReady = this.session_ready;
  }
}

export function normalizeKickoffInputs(
  inputs: Record<string, unknown> | null | undefined,
  options: {
    userMessage?: string | Record<string, unknown> | null;
    user_message?: string | Record<string, unknown> | null;
    sessionId?: string | null;
    session_id?: string | null;
  } = {},
): Record<string, unknown> | null {
  const userMessage = options.userMessage ?? options.user_message ?? null;
  const sessionId = options.sessionId ?? options.session_id ?? null;
  if (inputs === null || inputs === undefined) {
    if (userMessage === null && sessionId === null) {
      return null;
    }
  }
  const merged = { ...(inputs ?? {}) };
  if (sessionId !== null) {
    merged.id = sessionId;
  }
  if (userMessage !== null) {
    merged.user_message = userMessage;
  }
  return merged;
}

export const normalize_kickoff_inputs = normalizeKickoffInputs;

export function getConversationMessages(flow: unknown): LLMMessage[] {
  const fallback = readRecord(flow)._conversation_messages;
  const fallbackMessages = Array.isArray(fallback) ? fallback as LLMMessage[] : [];
  const state = getFlowState(flow);
  const stateMessages = readRecord(state).messages;
  return Array.isArray(stateMessages) ? stateMessages as LLMMessage[] : [...fallbackMessages];
}

export const get_conversation_messages = getConversationMessages;

export function appendMessage(
  flow: unknown,
  role: LLMMessage["role"],
  content: string,
  extra: Record<string, unknown> = {},
): void {
  const message: Record<string, unknown> = { role, content };
  for (const key of ["tool_call_id", "name", "tool_calls", "files"]) {
    if (Object.hasOwn(extra, key)) {
      message[key] = extra[key];
    }
  }

  const state = getFlowState(flow);
  const stateRecord = readRecord(state);
  if (Array.isArray(stateRecord.messages)) {
    stateRecord.messages.push(message);
    return;
  }

  const flowRecord = readRecord(flow);
  if (!Array.isArray(flowRecord._conversation_messages)) {
    flowRecord._conversation_messages = [];
  }
  (flowRecord._conversation_messages as unknown[]).push(message);
}

export const append_message = appendMessage;

export function setStateField(flow: unknown, name: string, value: unknown): void {
  const state = getFlowState(flow);
  if (state === null) {
    return;
  }
  const stateRecord = readRecord(state);
  stateRecord[name] = value;
  if (name === "last_user_message") {
    stateRecord.lastUserMessage = value;
  } else if (name === "last_intent") {
    stateRecord.lastIntent = value;
  } else if (name === "current_user_message") {
    stateRecord.currentUserMessage = value;
  } else if (name === "session_ready") {
    stateRecord.sessionReady = value;
  }
}

export const set_state_field = setStateField;

export function receiveUserMessage(
  flow: unknown,
  text: string,
  options: {
    outcomes?: readonly string[] | null;
    llm?: string | LLM | null;
  } = {},
): string {
  appendMessage(flow, "user", text);
  setStateField(flow, "current_user_message", text);
  setStateField(flow, "last_user_message", text);

  if (options.outcomes && options.outcomes.length > 0 && options.llm !== null && options.llm !== undefined) {
    const classifierCandidate = readRecord(flow).classify_intent ?? readRecord(flow).classifyIntent;
    if (typeof classifierCandidate !== "function") {
      throw new Error("Flow must define classify_intent when conversational intents are provided");
    }
    const classifier = classifierCandidate as (
      text: string,
      outcomes: readonly string[],
      options: { llm: string | LLM; context: LLMMessage[] },
    ) => unknown;
    const intent = classifier.call(flow, text, options.outcomes, {
      llm: options.llm,
      context: getConversationMessages(flow),
    });
    const intentText = stringifyConversationValue(intent);
    setStateField(flow, "last_intent", intentText);
    return intentText;
  }

  return text;
}

export const receive_user_message = receiveUserMessage;

export function prepareConversationalTurn(
  flow: unknown,
  options: {
    userMessage?: string | Record<string, unknown> | null;
    user_message?: string | Record<string, unknown> | null;
    intents?: readonly string[] | null;
    intentLlm?: string | LLM | null;
    intent_llm?: string | LLM | null;
    config?: ConversationalConfig | null;
  } = {},
): void {
  let userMessage = options.userMessage ?? options.user_message ?? null;
  const stateRecord = readRecord(getFlowState(flow));
  if (userMessage === null && Object.hasOwn(stateRecord, "user_message")) {
      userMessage = stateRecord.user_message as string | Record<string, unknown> | null;
  }
  if (userMessage === null) {
    return;
  }
  const text = coerceUserMessageText(userMessage);
  if (!text.trim()) {
    return;
  }

  const config = options.config ?? null;
  const intents = options.intents ?? config?.defaultIntents ?? null;
  const intentLlm = options.intentLlm ?? options.intent_llm ?? config?.intentLlm ?? null;
  const constructor = readRecord(flow).constructor;
  const staticConfig = readRecord(constructor).conversational_config ?? readRecord(constructor).conversationalConfig ?? null;
  const hasRouterConfig = Boolean(readRecord(config).router ?? readRecord(staticConfig).router);
  if (!hasRouterConfig) {
    setStateField(flow, "last_intent", null);
  }
  if (intents && intents.length > 0) {
    if (intentLlm === null) {
      throw new Error("intent_llm is required when intents are provided");
    }
    receiveUserMessage(flow, text, { outcomes: intents, llm: intentLlm });
  } else {
    receiveUserMessage(flow, text);
  }
}

export const prepare_conversational_turn = prepareConversationalTurn;

export function inputHistoryToMessages(entries: readonly unknown[]): LLMMessage[] {
  const messages: LLMMessage[] = [];
  for (const entry of entries) {
    const record = readRecord(entry);
    const prompt = record.message;
    const response = record.response;
    if (prompt) {
      messages.push({ role: "assistant", content: stringifyConversationValue(prompt) });
    }
    if (response) {
      messages.push({ role: "user", content: stringifyConversationValue(response) });
    }
  }
  return messages;
}

export const input_history_to_messages = inputHistoryToMessages;

export function getConversationalConfig(flow: unknown): ConversationalConfig | null {
  const constructor = readRecord(flow).constructor;
  const config = readRecord(constructor).conversational_config ?? readRecord(constructor).conversationalConfig;
  return config instanceof ConversationalConfig || config === null || config === undefined
    ? config ?? null
    : new ConversationalConfig(config);
}

export const get_conversational_config = getConversationalConfig;

function coerceUserMessageText(userMessage: unknown): string {
  if (typeof userMessage === "string") {
    return userMessage;
  }
  const record = readRecord(userMessage);
  if (record.content !== undefined && record.content !== null) {
    return stringifyConversationValue(record.content);
  }
  return stringifyConversationValue(userMessage);
}

function getFlowState(flow: unknown): unknown {
  const record = readRecord(flow);
  return record._state ?? record.state ?? null;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && (typeof value === "object" || typeof value === "function") ? value as Record<string, unknown> : {};
}

function stringifyConversationValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (typeof value === "symbol") {
    return value.description ?? "";
  }
  if (typeof value === "function") {
    return value.name || "[function]";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}
