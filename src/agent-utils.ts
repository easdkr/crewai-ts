import { generateModelDescription, sanitizeToolParamsForOpenAIStrict, type JsonSchema } from "./schema-utils.js";
import { sanitizeToolName } from "./string-utils.js";
import {
  AgentAction,
  AgentFinish,
  FINAL_ANSWER_AND_PARSABLE_ACTION_ERROR_MESSAGE,
  OutputParserError,
  parseAgentOutput,
} from "./agent-parser.js";
import { BaseTool, ToolResult, type ToolArgsSchema, type ToolArgumentSpec } from "./tools.js";
import type { LLM, LLMMessage, MaybePromise, Tool, ToolContext } from "./types.js";
import { AgentRepositoryError } from "./errors.js";
import { BaseLLM, callStopOverride, type LLMResponse } from "./llm.js";
import {
  LLMCallHookContext,
  ToolCallHookContext,
  runAfterLlmCallHooks,
  runAfterToolCallHooks,
  runBeforeLlmCallHooks,
} from "./hooks.js";
import { I18N_DEFAULT } from "./i18n.js";
import { PRINTER, Printer, type ColoredText } from "./logger.js";

export type ToolRunner = (input?: ToolContext | Record<string, unknown> | string) => MaybePromise<unknown>;

export type SummaryContent = { content: string };

export const SummaryContent = class SummaryContent {
  readonly content: string;

  constructor(options: { content?: string } = {}) {
    this.content = options.content ?? "";
  }
};

export type AgentKnowledgeContextLike = {
  agentKnowledgeContext?: string | null;
  agent_knowledge_context?: string | null;
  crewKnowledgeContext?: string | null;
  crew_knowledge_context?: string | null;
};

export const DELEGATION_TOOL_NAMES: readonly string[] = [
  sanitizeToolName("Delegate work to coworker"),
  sanitizeToolName("Ask question to coworker"),
] as const;

export type NativeToolCallResultOptions = {
  text?: string;
  result?: unknown;
  resultAsAnswer?: boolean;
  result_as_answer?: boolean;
  toolCallId?: string | null;
  tool_call_id?: string | null;
  toolName?: string | null;
  tool_name?: string | null;
};

export class NativeToolCallResult {
  readonly text: string;
  readonly result: unknown;
  readonly resultAsAnswer: boolean;
  readonly result_as_answer: boolean;
  readonly toolCallId: string | null;
  readonly tool_call_id: string | null;
  readonly toolName: string | null;
  readonly tool_name: string | null;

  constructor(options: NativeToolCallResultOptions = {}) {
    this.result = options.result ?? options.text ?? "";
    this.text = options.text ?? formatAnswer(this.result);
    this.resultAsAnswer = options.resultAsAnswer ?? options.result_as_answer ?? false;
    this.result_as_answer = this.resultAsAnswer;
    this.toolCallId = options.toolCallId ?? options.tool_call_id ?? null;
    this.tool_call_id = this.toolCallId;
    this.toolName = options.toolName ?? options.tool_name ?? null;
    this.tool_name = this.toolName;
  }
}

export type OpenAIFunctionToolSchema = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
    strict: true;
  };
};

export type OpenAIToolConversionResult = [
  openaiTools: OpenAIFunctionToolSchema[],
  availableFunctions: Record<string, ToolRunner>,
  toolNameMapping: Record<string, Tool>,
];

type ToolWithArgsSchema = Tool & {
  argsSchema?: ToolArgsSchema | JsonSchema | null;
  args_schema?: ToolArgsSchema | JsonSchema | null;
};

type SummaryLLM = {
  call?: (messages: readonly LLMMessage[], options?: Record<string, unknown>) => MaybePromise<unknown>;
  acall?: (messages: readonly LLMMessage[], options?: Record<string, unknown>) => MaybePromise<unknown>;
  get_context_window_size?: () => number;
  getContextWindowSize?: () => number;
};

export function getToolNames(tools: readonly Tool[]): string {
  return tools.map((tool) => sanitizeToolName(tool.name)).join(", ");
}

export function renderTextDescriptionAndArgs(tools: readonly Tool[]): string {
  return tools.map((tool) => tool.description ?? "").join("\n");
}

export function convertToolsToOpenAISchema(tools: readonly Tool[]): OpenAIToolConversionResult {
  const openaiTools: OpenAIFunctionToolSchema[] = [];
  const availableFunctions: Record<string, ToolRunner> = {};
  const toolNameMapping: Record<string, Tool> = {};

  for (const tool of tools) {
    let sanitizedName = sanitizeToolName(tool.name);
    if (availableFunctions[sanitizedName]) {
      let counter = 2;
      let candidate = sanitizeToolName(`${sanitizedName}_${String(counter)}`);
      while (availableFunctions[candidate]) {
        counter += 1;
        candidate = sanitizeToolName(`${sanitizedName}_${String(counter)}`);
      }
      sanitizedName = candidate;
    }

    const schema = {
      type: "function",
      function: {
        name: sanitizedName,
        description: cleanToolDescription(tool.description ?? ""),
        parameters: toolParameters(tool),
        strict: true,
      },
    } satisfies OpenAIFunctionToolSchema;

    openaiTools.push(schema);
    availableFunctions[sanitizedName] = (input) => tool.run(input);
    toolNameMapping[sanitizedName] = tool;
  }

  return [openaiTools, availableFunctions, toolNameMapping];
}

export function extractTaskSection(text: string): string {
  for (const marker of ["\n## Task\n", "\n## Task:", "## Task\n"]) {
    const index = text.indexOf(marker);
    if (index < 0) {
      continue;
    }
    const start = index + marker.length;
    for (const endMarker of ["\n---\n", "\n## "]) {
      const end = text.indexOf(endMarker, start);
      if (end > 0) {
        return text.slice(start, end).trim();
      }
    }
    return text.slice(start, start + 2000).trim();
  }
  return text.length > 2000 ? `${text.slice(0, 2000)}\n... [truncated]` : text;
}

export function hasReachedMaxIterations(iterations: number, maxIterations: number): boolean {
  return iterations >= maxIterations;
}

export function _executor_stop_words(executorContext: unknown): string[] {
  if (executorContext === null || executorContext === undefined || typeof executorContext !== "object") {
    return [];
  }
  const record = executorContext as Record<string, unknown>;
  const stops = record.stop ?? record.stop_words;
  if (Array.isArray(stops)) {
    return stops.map((stop) => String(stop));
  }
  if (typeof stops === "string") {
    return [stops];
  }
  return [];
}

export async function _llm_stop_words_applied<T>(
  llm: unknown,
  executorContext: unknown,
  callback: () => MaybePromise<T>,
): Promise<T> {
  const extra = _executor_stop_words(executorContext);
  if (extra.length === 0 || !(llm instanceof BaseLLM)) {
    return await callback();
  }
  if (extra.every((stop) => llm.stop.includes(stop))) {
    return await callback();
  }
  return await callStopOverride(llm, [...new Set([...llm.stop, ...extra])], callback);
}

export function formatMessageForLLM(
  prompt: string,
  role: "user" | "assistant" | "system" = "user",
): LLMMessage {
  return { role, content: prompt.trimEnd() };
}

export function combineKnowledgeContext(agent: AgentKnowledgeContextLike): string {
  const agentContext = agent.agentKnowledgeContext ?? agent.agent_knowledge_context ?? "";
  const crewContext = agent.crewKnowledgeContext ?? agent.crew_knowledge_context ?? "";
  const separator = agentContext && crewContext ? "\n" : "";
  return `${agentContext}${separator}${crewContext}`;
}

export const _combine_knowledge_context = combineKnowledgeContext;

export function isInsideEventLoop(): boolean {
  return false;
}

export const is_inside_event_loop = isInsideEventLoop;

export function parseTools(tools: readonly Tool[]): Tool[] {
  return tools.map((tool) => {
    if (tool instanceof BaseTool) {
      tool.resetUsageCount();
      return tool.toStructuredTool();
    }
    return tool;
  });
}

export const parse_tools = parseTools;

export type MaxIterationsPrinter = {
  print?: (options: { content: string; color?: string }) => void;
};

export type MaxIterationsLLM = {
  call?: (messages: readonly LLMMessage[], options?: Record<string, unknown>) => MaybePromise<unknown>;
};

export type HandleMaxIterationsExceededOptions = {
  formattedAnswer?: AgentAction | AgentFinish | null | undefined;
  formatted_answer?: AgentAction | AgentFinish | null | undefined;
  printer?: MaxIterationsPrinter | null | undefined;
  messages?: LLMMessage[] | undefined;
  llm?: MaxIterationsLLM | null | undefined;
  callbacks?: readonly unknown[] | undefined;
  verbose?: boolean | undefined;
};

export function handleMaxIterationsExceeded(options?: HandleMaxIterationsExceededOptions): AgentFinish | Promise<AgentFinish>;
export function handleMaxIterationsExceeded(
  formattedAnswer?: AgentAction | AgentFinish | null,
  printer?: MaxIterationsPrinter | null,
  messages?: LLMMessage[],
  llm?: MaxIterationsLLM | null,
  callbacks?: readonly unknown[],
  verbose?: boolean,
): AgentFinish | Promise<AgentFinish>;
export function handleMaxIterationsExceeded(
  optionsOrFormattedAnswer: HandleMaxIterationsExceededOptions | AgentAction | AgentFinish | null = null,
  printer: MaxIterationsPrinter | null = null,
  messages?: LLMMessage[],
  llm?: MaxIterationsLLM | null,
  callbacks: readonly unknown[] = [],
  verbose = true,
): AgentFinish | Promise<AgentFinish> {
  const options: HandleMaxIterationsExceededOptions = isHandleMaxIterationsExceededOptions(optionsOrFormattedAnswer)
    ? optionsOrFormattedAnswer
    : {
      formattedAnswer: optionsOrFormattedAnswer,
      printer,
      messages,
      llm,
      callbacks,
      verbose,
    };
  const resolvedMessages = options.messages;
  const resolvedLlm = options.llm;
  if (!resolvedMessages || !resolvedLlm?.call) {
    return new AgentFinish({
      thought: "",
      output: "Agent stopped due to max iterations.",
      text: "Agent stopped due to max iterations.",
    });
  }

  if (options.verbose ?? true) {
    options.printer?.print?.({
      content: "Maximum iterations reached. Requesting final answer.",
      color: "yellow",
    });
  }

  const formattedAnswer = options.formattedAnswer ?? options.formatted_answer ?? null;
  const assistantMessage = formattedAnswer?.text
    ? `${formattedAnswer.text}\n${I18N_DEFAULT.errors("force_final_answer")}`
    : I18N_DEFAULT.errors("force_final_answer");
  resolvedMessages.push(formatMessageForLLM(assistantMessage, "assistant"));

  const answer = resolvedLlm.call(resolvedMessages, { callbacks: options.callbacks ?? [] });
  if (isPromiseLike(answer)) {
    return Promise.resolve(answer).then((resolvedAnswer) => finalizeMaxIterationsAnswer(resolvedAnswer, options));
  }
  return finalizeMaxIterationsAnswer(answer, options);
}

export const handle_max_iterations_exceeded = handleMaxIterationsExceeded;

function isHandleMaxIterationsExceededOptions(value: unknown): value is HandleMaxIterationsExceededOptions {
  if (!value || typeof value !== "object") {
    return false;
  }
  return (
    "messages" in value
    || "llm" in value
    || "formattedAnswer" in value
    || "formatted_answer" in value
    || "callbacks" in value
  );
}

function finalizeMaxIterationsAnswer(
  answer: unknown,
  options: Pick<HandleMaxIterationsExceededOptions, "printer" | "verbose">,
): AgentFinish {
  if (!answer) {
    if (options.verbose ?? true) {
      options.printer?.print?.({
        content: "Received None or empty response from LLM call.",
        color: "red",
      });
    }
    throw new Error("Invalid response from LLM call - None or empty.");
  }
  const parsed = formatFinalMaxIterationsAnswer(answer);
  if (parsed instanceof AgentFinish) {
    return parsed;
  }
  return new AgentFinish({
    thought: parsed.thought,
    output: parsed.text,
    text: parsed.text,
  });
}

function formatFinalMaxIterationsAnswer(answer: unknown): AgentAction | AgentFinish {
  if (answer instanceof AgentAction || answer instanceof AgentFinish) {
    return answer;
  }
  const text = typeof answer === "string" ? answer : safeJsonStringify(answer);
  try {
    return parseAgentOutput(text);
  } catch {
    return new AgentFinish({
      thought: "Failed to parse LLM response",
      output: text,
      text,
    });
  }
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return Boolean(value)
    && (typeof value === "object" || typeof value === "function")
    && typeof (value as { then?: unknown }).then === "function";
}

export function formatAnswer(answer: unknown): string {
  if (answer instanceof AgentFinish) {
    return String(answer.output);
  }
  if (typeof answer === "string") {
    return answer;
  }
  return safeJsonStringify(answer);
}

export const format_answer = formatAnswer;

export function enforceRpmLimit(requestWithinRpmLimit?: (() => boolean | Promise<boolean>) | null): void {
  if (!requestWithinRpmLimit) {
    return;
  }
  void requestWithinRpmLimit();
}

export const enforce_rpm_limit = enforceRpmLimit;

export type AgentUtilsExecutorContext = {
  messages?: readonly LLMMessage[];
  llm?: unknown;
  agent?: unknown;
  task?: unknown;
  crew?: unknown;
  iterations?: number;
};

export async function _prepare_llm_call(
  executorContext: AgentUtilsExecutorContext | null | undefined,
  messages: readonly LLMMessage[],
): Promise<LLMMessage[]> {
  if (!executorContext) {
    return [...messages];
  }
  const executorMessages = executorContext.messages;
  const resolvedMessages = executorMessages !== undefined
    ? [...executorMessages]
    : [...messages];
  await runBeforeLlmCallHooks(new LLMCallHookContext({
    executor: executorContext,
    messages: resolvedMessages,
    llm: coerceHookLlm(executorContext.llm),
    agent: executorContext.agent,
    task: executorContext.task,
    crew: executorContext.crew,
    iterations: executorContext.iterations ?? 0,
  }));
  return resolvedMessages;
}

export async function _validate_and_finalize_llm_response(
  answer: unknown,
  executorContext: AgentUtilsExecutorContext | null | undefined = null,
  messages: readonly LLMMessage[] = [],
): Promise<unknown> {
  if (!answer) {
    throw new Error("Invalid response from LLM call - None or empty.");
  }
  return await runAfterLlmCallHooks(new LLMCallHookContext({
    executor: executorContext ?? null,
    messages: [...messages],
    llm: coerceHookLlm(executorContext?.llm),
    agent: executorContext?.agent,
    task: executorContext?.task,
    crew: executorContext?.crew,
    iterations: executorContext?.iterations ?? 0,
    response: answer as LLMResponse,
  }));
}

export async function getLlmResponse(
  llm: { call?: (messages: readonly LLMMessage[], options?: Record<string, unknown>) => MaybePromise<unknown> },
  messages: readonly LLMMessage[],
  options: Record<string, unknown> = {},
): Promise<unknown> {
  const rawExecutorContext = options.executorContext ?? options.executor_context;
  const executorContext: AgentUtilsExecutorContext | null = isAgentUtilsExecutorContext(rawExecutorContext)
    ? rawExecutorContext
    : null;
  const resolvedMessages = await _prepare_llm_call(executorContext, messages);
  const answer = await llm.call?.(resolvedMessages, withoutExecutorOptions(options));
  return await _validate_and_finalize_llm_response(answer, executorContext, resolvedMessages);
}

export const get_llm_response = getLlmResponse;
export const aget_llm_response = getLlmResponse;

export function processLlmResponse(response: unknown, useStopWords = true): unknown {
  if (response instanceof AgentAction || response instanceof AgentFinish || typeof response !== "string") {
    return response;
  }
  let answer = response;
  if (!useStopWords) {
    try {
      parseAgentOutput(answer);
    } catch (error) {
      if (error instanceof OutputParserError && error.error.includes(FINAL_ANSWER_AND_PARSABLE_ACTION_ERROR_MESSAGE)) {
        answer = answer.split("Observation:")[0]?.trim() ?? answer;
      }
    }
    if (containsFinalAnswerAndParsableAction(answer) && answer.includes("Observation:")) {
      answer = answer.split("Observation:")[0]?.trim() ?? answer;
    }
  }
  return parseAgentOutput(answer);
}

export const process_llm_response = processLlmResponse;

export function handleAgentActionCore(action: AgentAction, tools: readonly Tool[]): ToolResult;
export function handleAgentActionCore(
  formattedAnswer: AgentAction,
  toolResult: ToolResult,
  messages?: LLMMessage[] | null,
  stepCallback?: ((toolResult: ToolResult) => MaybePromise<unknown>) | null,
  showLogs?: ((formattedAnswer: AgentAction) => unknown) | null,
): AgentAction | AgentFinish | Promise<AgentAction | AgentFinish>;
export function handleAgentActionCore(
  action: AgentAction,
  toolsOrToolResult: readonly Tool[] | ToolResult,
  _messages: LLMMessage[] | null = null,
  stepCallback: ((toolResult: ToolResult) => MaybePromise<unknown>) | null = null,
  showLogs: ((formattedAnswer: AgentAction) => unknown) | null = null,
): ToolResult | AgentAction | AgentFinish | Promise<AgentAction | AgentFinish> {
  void _messages;
  if (Array.isArray(toolsOrToolResult)) {
    return runToolForAgentAction(action, toolsOrToolResult);
  }
  const toolResult = toolsOrToolResult as ToolResult;
  const callbackResult = stepCallback?.(toolResult);
  if (isPromiseLike(callbackResult)) {
    return Promise.resolve(callbackResult).then(() => finalizeAgentActionCore(action, toolResult, showLogs));
  }
  return finalizeAgentActionCore(action, toolResult, showLogs);
}

function finalizeAgentActionCore(
  formattedAnswer: AgentAction,
  toolResult: ToolResult,
  showLogs: ((formattedAnswer: AgentAction) => unknown) | null,
): AgentAction | AgentFinish {
  const text = `${formattedAnswer.text}\nObservation: ${String(toolResult.result)}`;
  const updatedAction = new AgentAction({
    thought: formattedAnswer.thought,
    tool: formattedAnswer.tool,
    toolInput: formattedAnswer.toolInput,
    text,
    result: String(toolResult.result),
  });
  if (toolResult.result_as_answer) {
    return new AgentFinish({
      thought: "",
      output: toolResult.result,
      text,
    });
  }
  showLogs?.(updatedAction);
  return updatedAction;
}

function containsFinalAnswerAndParsableAction(answer: string): boolean {
  return answer.includes("Final Answer:")
    && /Action\s*\d*\s*:/s.test(answer)
    && /Action\s*\d*\s*Input\s*\d*\s*:/s.test(answer);
}

function runToolForAgentAction(action: AgentAction, tools: readonly Tool[]): ToolResult {
  const tool = tools.find((candidate) => sanitizeToolName(candidate.name) === sanitizeToolName(action.tool));
  if (!tool) {
    return new ToolResult(`Tool '${action.tool}' is not available.`);
  }
  return new ToolResult(tool.run(action.toolInput));
}

export const handle_agent_action_core = handleAgentActionCore;

export function handleUnknownError(error: unknown): string;
export function handleUnknownError(printer: Printer, exception: unknown, verbose?: boolean): void;
export function handleUnknownError(errorOrPrinter: unknown, exception?: unknown, verbose = true): string | void {
  if (errorOrPrinter instanceof Printer) {
    if (!verbose) {
      return;
    }
    const errorMessage = exception instanceof Error ? exception.message : safeJsonStringify(exception);
    if (errorMessage.toLowerCase().includes("litellm")) {
      return;
    }
    errorOrPrinter.print("An unknown error occurred. Please check the details below.", "red");
    errorOrPrinter.print(`Error details: ${errorMessage}`, "red");
    return;
  }
  return errorOrPrinter instanceof Error ? errorOrPrinter.message : safeJsonStringify(errorOrPrinter);
}

export const handle_unknown_error = handleUnknownError;

export function handleOutputParserException(error: unknown): string;
export function handleOutputParserException(
  error: unknown,
  messages: LLMMessage[],
  iterations?: number,
  logErrorAfter?: number,
): AgentAction;
export function handleOutputParserException(
  error: unknown,
  messages?: LLMMessage[],
  iterations = 0,
  logErrorAfter = 3,
): string | AgentAction {
  const errorMessage = error instanceof OutputParserError ? error.error : handleUnknownError(error);
  if (!messages) {
    return errorMessage;
  }
  messages.push({ role: "user", content: errorMessage });
  if (iterations > logErrorAfter) {
    console.error(`Error parsing LLM output, agent will retry: ${errorMessage}`);
  }
  return new AgentAction({
    thought: "",
    tool: "",
    toolInput: "",
    text: errorMessage,
  });
}

export const handle_output_parser_exception = handleOutputParserException;

export function isContextLengthExceeded(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /context|token|length|maximum/i.test(message);
}

export const is_context_length_exceeded = isContextLengthExceeded;

export function handleContextLength(messages: readonly LLMMessage[], summary: string): LLMMessage[] {
  return [
    { role: "system", content: `Previous conversation summary:\n${summary}` },
    ...messages.slice(-4),
  ];
}

export const handle_context_length = handleContextLength;

export function summarizeMessages(messages: readonly LLMMessage[]): SummaryContent;
export function summarizeMessages(
  messages: LLMMessage[],
  llm: SummaryLLM,
  callbacks?: readonly unknown[],
  verbose?: boolean,
): Promise<void>;
export function summarizeMessages(
  messages: readonly LLMMessage[] | LLMMessage[],
  llm?: SummaryLLM,
  callbacks: readonly unknown[] = [],
  _verbose = true,
): SummaryContent | Promise<void> {
  void _verbose;
  if (!llm) {
    return new SummaryContent({
      content: messages.map((message) => `${message.role}: ${message.content}`).join("\n"),
    });
  }
  return summarizeMessagesInPlace(messages as LLMMessage[], llm, callbacks);
}

export const summarize_messages = summarizeMessages;

async function summarizeMessagesInPlace(
  messages: LLMMessage[],
  llm: SummaryLLM,
  callbacks: readonly unknown[],
): Promise<void> {
  const preservedFiles: NonNullable<LLMMessage["files"]> = {};
  for (const message of messages) {
    if (message.role === "user" && message.files) {
      Object.assign(preservedFiles, message.files);
    }
  }

  const systemMessages = messages.filter((message) => message.role === "system");
  const nonSystemMessages = messages.filter((message) => message.role !== "system");
  if (nonSystemMessages.length === 0) {
    return;
  }

  const maxTokens = resolveSummaryContextWindow(llm);
  const chunks = _split_messages_into_chunks(nonSystemMessages, maxTokens);
  const summarizedContents = chunks.length <= 1
    ? await summarizeChunksSequentially(chunks, llm, callbacks)
    : await _asummarize_chunks(chunks, llm, callbacks);

  const mergedSummary = summarizedContents.map((content) => content.content).join("\n\n");
  const summaryMessage = formatMessageForLLM(
    I18N_DEFAULT.slice("summary").replace("{merged_summary}", mergedSummary),
  );
  if (Object.keys(preservedFiles).length > 0) {
    summaryMessage.files = preservedFiles;
  }

  messages.splice(0, messages.length, ...systemMessages, summaryMessage);
}

async function summarizeChunksSequentially(
  chunks: readonly (readonly LLMMessage[])[],
  llm: SummaryLLM,
  callbacks: readonly unknown[],
): Promise<SummaryContent[]> {
  const summarizedContents: SummaryContent[] = [];
  for (const chunk of chunks) {
    summarizedContents.push(...await _asummarize_chunks([chunk], llm, callbacks));
  }
  return summarizedContents;
}

function resolveSummaryContextWindow(llm: SummaryLLM): number {
  const size = llm.get_context_window_size?.() ?? llm.getContextWindowSize?.();
  return typeof size === "number" && Number.isFinite(size) && size > 0 ? size : 8_000;
}

export async function _asummarize_chunks(
  chunks: readonly (readonly LLMMessage[])[],
  llm: { acall?: (messages: readonly LLMMessage[], options?: Record<string, unknown>) => MaybePromise<unknown>; call?: (messages: readonly LLMMessage[], options?: Record<string, unknown>) => MaybePromise<unknown> },
  callbacks: readonly unknown[] = [],
): Promise<SummaryContent[]> {
  return await Promise.all(chunks.map(async (chunk) => {
    const conversationText = _format_messages_for_summary(chunk);
    const summarizationMessages = [
      formatMessageForLLM(I18N_DEFAULT.slice("summarizer_system_message"), "system"),
      formatMessageForLLM(
        I18N_DEFAULT.slice("summarize_instruction").replace("{conversation}", conversationText),
      ),
    ];
    const summary = llm.acall
      ? await llm.acall(summarizationMessages, { callbacks })
      : await llm.call?.(summarizationMessages, { callbacks });
    return new SummaryContent({ content: _extract_summary_tags(summaryToText(summary)) });
  }));
}

export function _estimate_token_count(text: string): number {
  return Math.floor(text.length / 4);
}

export function _format_messages_for_summary(messages: readonly LLMMessage[]): string {
  const lines: string[] = [];
  for (const message of messages) {
    const record = message as unknown as Record<string, unknown>;
    const role = typeof record.role === "string" ? record.role : "user";
    if (role === "system") {
      continue;
    }
    let content = record.content;
    if (content === null || content === undefined) {
      const toolCalls = Array.isArray(record.tool_calls) ? record.tool_calls : null;
      const toolNames = toolCalls?.map((toolCall) => {
        const toolCallRecord = toolCall as Record<string, unknown>;
        const functionRecord = typeof toolCallRecord.function === "object" && toolCallRecord.function !== null
          ? toolCallRecord.function as Record<string, unknown>
          : null;
        return typeof functionRecord?.name === "string" ? functionRecord.name : "unknown";
      }) ?? [];
      content = toolNames.length > 0
        ? `[Called tools: ${toolNames.join(", ")}]`
        : "";
    } else if (Array.isArray(content)) {
      const textParts = content
        .filter((block): block is { type?: unknown; text?: unknown } => Boolean(block) && typeof block === "object")
        .filter((block) => block.type === "text")
        .map((block) => typeof block.text === "string" ? block.text : "")
        .filter(Boolean);
      content = textParts.length > 0 ? textParts.join(" ") : "[multimodal content]";
    }

    const label = role === "assistant"
      ? "[ASSISTANT]:"
      : role === "tool"
        ? `[TOOL_RESULT (${typeof record.name === "string" ? record.name : "unknown"})]:`
        : "[USER]:";
    lines.push(`${label} ${String(content)}`);
  }
  return lines.join("\n\n");
}

export function _split_messages_into_chunks(messages: readonly LLMMessage[], max_tokens: number): LLMMessage[][] {
  const nonSystem = messages.filter((message) => message.role !== "system");
  if (nonSystem.length === 0) {
    return [];
  }
  const chunks: LLMMessage[][] = [];
  let currentChunk: LLMMessage[] = [];
  let currentTokens = 0;
  for (const message of nonSystem) {
    const rawContent = (message as unknown as Record<string, unknown>).content;
    const content = Array.isArray(rawContent)
      ? JSON.stringify(rawContent)
      : typeof rawContent === "string" ? rawContent : "";
    const messageTokens = _estimate_token_count(content);
    if (currentChunk.length > 0 && currentTokens + messageTokens > max_tokens) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentTokens = 0;
    }
    currentChunk.push(message);
    currentTokens += messageTokens;
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  return chunks;
}

export function _extract_summary_tags(text: string): string {
  const match = /<summary>([\s\S]*?)<\/summary>/.exec(text);
  return (match?.[1] ?? text).trim();
}

const MULTIPLE_NEWLINES = /\n{2,}/g;

export function showAgentLogs(
  printer: Printer,
  agentRole: string,
  formattedAnswer?: AgentAction | AgentFinish | null,
  taskDescription?: string | null,
  verbose?: boolean,
): void;
export function showAgentLogs(agent: unknown, message: string): void;
export function showAgentLogs(
  printerOrAgent: unknown,
  agentRoleOrMessage: string,
  formattedAnswer: AgentAction | AgentFinish | null = null,
  taskDescription: string | null = null,
  verbose = false,
): void {
  const printer = printerOrAgent instanceof Printer ? printerOrAgent : PRINTER;
  if (!(printerOrAgent instanceof Printer)) {
    return;
  }
  if (!verbose) {
    return;
  }

  const agentRole = agentRoleOrMessage.split("\n", 1)[0] ?? "";
  if (formattedAnswer === null) {
    printer.print(coloredParts([
      ["# Agent: ", "bold_purple"],
      [agentRole, "bold_green"],
    ]), null, "");
    if (taskDescription) {
      printer.print(coloredParts([
        ["## Task: ", "purple"],
        [taskDescription, "green"],
      ]), null, "");
    }
    return;
  }

  printer.print(coloredParts([
    ["\n\n# Agent: ", "bold_purple"],
    [agentRole, "bold_green"],
  ]), null, "");

  if (formattedAnswer instanceof AgentAction) {
    const thought = formattedAnswer.thought.replace(MULTIPLE_NEWLINES, "\n");
    if (thought) {
      printer.print(coloredParts([
        ["## Thought: ", "purple"],
        [thought, "green"],
      ]), null, "");
    }
    printer.print(coloredParts([
      ["## Using tool: ", "purple"],
      [formattedAnswer.tool, "green"],
    ]), null, "");
    printer.print(coloredParts([
      ["## Tool Input: ", "purple"],
      [`\n${formatToolInputForAgentLog(formattedAnswer.toolInput)}`, "green"],
    ]), null, "");
    printer.print(coloredParts([
      ["## Tool Output: ", "purple"],
      [`\n${formattedAnswer.result ?? ""}`, "green"],
    ]), null, "");
    return;
  }

  if (formattedAnswer instanceof AgentFinish) {
    printer.print(coloredParts([
      ["## Final Answer: ", "purple"],
      [`\n${String(formattedAnswer.output)}\n\n`, "green"],
    ]), null, "");
  }
}

export const show_agent_logs = showAgentLogs;

function coloredParts(parts: readonly (readonly [string, NonNullable<ColoredText["color"]>])[]): ColoredText[] {
  return parts.map(([text, color]) => ({ text, color }));
}

function formatToolInputForAgentLog(toolInput: unknown): string {
  if (typeof toolInput === "string") {
    try {
      return JSON.stringify(JSON.parse(toolInput), null, 2);
    } catch {
      return JSON.stringify(toolInput, null, 2);
    }
  }
  return JSON.stringify(toolInput, null, 2);
}

type AgentRepositoryResponse = {
  status?: number;
  status_code?: number;
  ok?: boolean;
  text?: string | (() => string);
  json?: Record<string, unknown> | (() => Record<string, unknown>);
};

type AgentRepositoryClient = {
  getAgent?: (repository: string) => AgentRepositoryResponse;
  get_agent?: (repository: string) => AgentRepositoryResponse;
};

let createPlusClientHook: (() => AgentRepositoryClient) | null = null;

export function setCreatePlusClientHook(hook: (() => AgentRepositoryClient) | null): void {
  createPlusClientHook = hook;
}

export const set_create_plus_client_hook = setCreatePlusClientHook;

export function loadAgentFromRepository(repository: string): Record<string, unknown> {
  if (!repository) {
    return {};
  }
  if (!createPlusClientHook) {
    return {};
  }
  const client = createPlusClientHook();
  const getAgent = client.getAgent ?? client.get_agent;
  if (!getAgent) {
    throw new AgentRepositoryError("Agent repository client does not provide get_agent.");
  }
  const response = getAgent.call(client, repository);
  const status = response.status_code ?? response.status ?? (response.ok === false ? 500 : 200);
  if (status === 404) {
    throw new AgentRepositoryError(
      `Agent ${repository} does not exist, make sure the name is correct or the agent is available on your organization.`,
    );
  }
  if (status !== 200) {
    throw new AgentRepositoryError(`Agent ${repository} could not be loaded: ${repositoryResponseText(response)}`);
  }
  return normalizeRepositoryAgent(repository, repositoryResponseJson(response));
}

export const load_agent_from_repository = loadAgentFromRepository;

function repositoryResponseText(response: AgentRepositoryResponse): string {
  return typeof response.text === "function" ? response.text() : response.text ?? "";
}

function repositoryResponseJson(response: AgentRepositoryResponse): Record<string, unknown> {
  const payload = typeof response.json === "function" ? response.json() : response.json;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new AgentRepositoryError("Agent repository response did not include agent attributes.");
  }
  return payload;
}

function normalizeRepositoryAgent(repository: string, agent: Record<string, unknown>): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(agent)) {
    if (key === "tools") {
      if (!Array.isArray(value)) {
        attributes.tools = [];
        continue;
      }
      attributes.tools = value.map((tool) => {
        if (isRunnableTool(tool)) {
          return tool;
        }
        throw new AgentRepositoryError(
          `Agent ${repository} includes a repository tool that cannot be synchronously loaded in the TypeScript runtime.`,
        );
      });
      continue;
    }
    attributes[key] = value;
  }
  return attributes;
}

function isRunnableTool(value: unknown): value is Tool {
  return Boolean(value) && typeof value === "object" && typeof (value as { run?: unknown }).run === "function";
}

export function trackDelegationIfNeeded(toolName: string, args: Record<string, unknown>, task: { incrementDelegations?: (coworker?: unknown) => void } | null = null): void {
  if (DELEGATION_TOOL_NAMES.includes(sanitizeToolName(toolName))) {
    task?.incrementDelegations?.(args.coworker);
  }
}

export const track_delegation_if_needed = trackDelegationIfNeeded;

export function extractToolCallInfo(value: unknown): { toolName: string; arguments: Record<string, unknown> | null; argumentParseError: string | null; id: string | null } | null {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : null;
  if (!record) {
    return null;
  }
  const functionRecord = record.function && typeof record.function === "object" ? record.function as Record<string, unknown> : null;
  const rawFunctionCall = record.functionCall ?? record.function_call;
  const functionCallRecord = rawFunctionCall && typeof rawFunctionCall === "object" ? rawFunctionCall as Record<string, unknown> : null;
  const name = record.name ?? record.toolName ?? record.tool_name ?? functionRecord?.name ?? functionCallRecord?.name;
  if (typeof name !== "string") {
    return null;
  }
  const rawArguments = functionRecord && "arguments" in functionRecord
    ? functionRecord.arguments
    : functionCallRecord && "args" in functionCallRecord
      ? functionCallRecord.args
      : functionCallRecord && "arguments" in functionCallRecord
        ? functionCallRecord.arguments
        : record.arguments ?? record.input ?? record.args;
  const parsed = parseToolCallArgsForNative(rawArguments);
  return {
    toolName: name,
    arguments: parsed.args,
    argumentParseError: parsed.error,
    id: typeof record.id === "string"
      ? record.id
      : typeof record.toolUseId === "string"
        ? record.toolUseId
        : null,
  };
}

export const extract_tool_call_info = extractToolCallInfo;

export function isToolCallList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value) && value.length > 0 && extractToolCallInfo(value[0]) !== null;
}

export const is_tool_call_list = isToolCallList;

export function checkNativeToolSupport(llm: unknown, tools: readonly Tool[]): boolean {
  const record = llm && typeof llm === "object" ? llm as Record<string, unknown> : {};
  const supportsFunctionCalling = record.supportsFunctionCalling ?? record.supports_function_calling;
  const supportsNativeToolCalling = record.supportsNativeToolCalling ?? record.supports_native_tool_calling;
  return tools.length > 0 && (
    (typeof supportsFunctionCalling === "function" && Boolean(supportsFunctionCalling.call(llm)))
    || supportsNativeToolCalling === true
  );
}

export const check_native_tool_support = checkNativeToolSupport;

export function setupNativeTools(tools: readonly Tool[]): OpenAIToolConversionResult {
  return convertToolsToOpenAISchema(tools);
}

export const setup_native_tools = setupNativeTools;

export function buildToolCallsAssistantMessage(results: readonly NativeToolCallResult[]): LLMMessage {
  return {
    role: "assistant",
    content: results.map((result) => result.text).join("\n"),
  };
}

export const build_tool_calls_assistant_message = buildToolCallsAssistantMessage;

export type ExecuteSingleNativeToolCallOptions = {
  originalTools?: readonly Tool[];
  original_tools?: readonly Tool[];
};

export async function executeSingleNativeToolCall(
  toolCall: unknown,
  availableFunctions: Record<string, ToolRunner>,
  options: ExecuteSingleNativeToolCallOptions = {},
): Promise<NativeToolCallResult> {
  const info = extractToolCallInfo(toolCall);
  if (!info) {
    return new NativeToolCallResult({ text: "Invalid tool call." });
  }
  const runner = availableFunctions[sanitizeToolName(info.toolName)] ?? availableFunctions[info.toolName];
  if (!runner) {
    return new NativeToolCallResult({ text: `Tool '${info.toolName}' is not available.`, toolCallId: info.id, toolName: info.toolName });
  }
  if (info.argumentParseError) {
    return new NativeToolCallResult({
      result: `Failed to parse tool arguments as JSON: ${info.argumentParseError}`,
      resultAsAnswer: false,
      toolCallId: info.id,
      toolName: info.toolName,
    });
  }
  const originalTools = options.originalTools ?? options.original_tools ?? [];
  const originalTool = originalTools.find((tool) => sanitizeToolName(tool.name) === sanitizeToolName(info.toolName)) ?? null;
  const resultAsAnswer = Boolean(originalTool?.resultAsAnswer);
  try {
    const output = await runner(info.arguments ?? {});
    return new NativeToolCallResult({
      result: output,
      resultAsAnswer,
      toolCallId: info.id,
      toolName: info.toolName,
    });
  } catch (error) {
    let result: unknown = `Error executing tool: ${errorMessage(error)}`;
    if (originalTool && errorMessage(error).includes("blocked by before_tool_call hook")) {
      result = await runAfterToolCallHooks(new ToolCallHookContext({
        toolName: sanitizeToolName(info.toolName),
        toolInput: info.arguments ?? {},
        tool: originalTool,
        toolResult: result,
      }));
    }
    return new NativeToolCallResult({
      result,
      resultAsAnswer: false,
      toolCallId: info.id,
      toolName: info.toolName,
    });
  }
}

export const execute_single_native_tool_call = executeSingleNativeToolCall;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function parseToolCallArgs(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : { input: value };
    } catch {
      return { input: value };
    }
  }
  return null;
}

function parseToolCallArgsForNative(value: unknown): { args: Record<string, unknown> | null; error: string | null } {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { args: value as Record<string, unknown>, error: null };
  }
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { args: parsed as Record<string, unknown>, error: null };
      }
      return { args: null, error: "tool arguments must be a JSON object" };
    } catch (error) {
      return { args: null, error: errorMessage(error) };
    }
  }
  return { args: null, error: null };
}

export const parse_tool_call_args = parseToolCallArgs;

function cleanToolDescription(description: string): string {
  const marker = "Tool Description:";
  return description.includes(marker) ? description.split(marker).at(-1)?.trim() ?? "" : description;
}

function toolParameters(tool: Tool): JsonSchema {
  const toolWithSchema = tool as ToolWithArgsSchema;
  const argsSchema = toolWithSchema.argsSchema ?? toolWithSchema.args_schema;
  if (!argsSchema) {
    return {};
  }

  if (isJsonSchema(argsSchema)) {
    const description = argsSchema.description;
    const title = argsSchema.title;
    const modelDescription = generateModelDescription("ToolParameters", argsSchema, { stripNullTypes: false });
    const schema = modelDescription.json_schema.schema;
    if (title !== undefined) {
      Reflect.deleteProperty(schema, "title");
    }
    if (description !== undefined) {
      Reflect.deleteProperty(schema, "description");
    }
    return schema;
  }

  return sanitizeToolParamsForOpenAIStrict(toolArgsSchemaToJsonSchema(argsSchema));
}

function isJsonSchema(schema: ToolArgsSchema | JsonSchema): schema is JsonSchema {
  return typeof schema.type === "string"
    || "$defs" in schema
    || "properties" in schema
    || "anyOf" in schema
    || "oneOf" in schema;
}

function toolArgsSchemaToJsonSchema(argsSchema: ToolArgsSchema): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const [name, spec] of Object.entries(argsSchema)) {
    properties[name] = toolArgumentSpecToJsonSchema(spec);
    if (spec.required) {
      required.push(name);
    }
  }

  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

function toolArgumentSpecToJsonSchema(spec: ToolArgumentSpec): JsonSchema {
  const schema: JsonSchema = {};
  if (spec.type && spec.type !== "unknown") {
    schema.type = spec.type === "number" ? "number" : spec.type;
  }
  if (spec.description) {
    schema.description = spec.description;
  }
  if (spec.default !== undefined) {
    schema.default = spec.default;
  }
  if (!schema.type) {
    schema.type = "object";
  }
  return schema;
}

function isAgentUtilsExecutorContext(value: unknown): value is AgentUtilsExecutorContext {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function coerceHookLlm(value: unknown): LLM | string | null {
  return typeof value === "string" || typeof value === "function" || (Boolean(value) && typeof value === "object")
    ? value as LLM | string
    : null;
}

function withoutExecutorOptions(options: Record<string, unknown>): Record<string, unknown> {
  const { executorContext: _executorContext, executor_context: _executor_context, ...rest } = options;
  void _executorContext;
  void _executor_context;
  return rest;
}

function summaryToText(summary: unknown): string {
  if (summary === null || summary === undefined) {
    return "";
  }
  if (typeof summary === "string") {
    return summary;
  }
  if (typeof summary === "number" || typeof summary === "boolean" || typeof summary === "bigint") {
    return summary.toString();
  }
  return safeJsonStringify(summary);
}

export const get_tool_names = getToolNames;
export const render_text_description_and_args = renderTextDescriptionAndArgs;
export const convert_tools_to_openai_schema = convertToolsToOpenAISchema;
export const extract_task_section = extractTaskSection;
export const has_reached_max_iterations = hasReachedMaxIterations;
export const format_message_for_llm = formatMessageForLLM;

export type { BaseTool };

function safeJsonStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value.toString();
  }
  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}
