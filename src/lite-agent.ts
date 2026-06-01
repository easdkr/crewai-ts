import { randomUUID } from "node:crypto";

import { Agent, type CodeExecutionMode } from "./agent.js";
import {
  AgentLogsExecutionEvent,
  LLMGuardrailCompletedEvent,
  LLMGuardrailStartedEvent,
  LiteAgentExecutionCompletedEvent,
  LiteAgentExecutionErrorEvent,
  LiteAgentExecutionStartedEvent,
  MemoryRetrievalCompletedEvent,
  MemoryRetrievalFailedEvent,
  MemoryRetrievalStartedEvent,
  crewaiEventBus,
} from "./events.js";
import { getAfterLlmCallHooks, getBeforeLlmCallHooks, type AfterLLMCallHook, type BeforeLLMCallHook } from "./hooks.js";
import { I18N_DEFAULT } from "./i18n.js";
import { extractInputFilesFromInputs, type InputFiles } from "./input-files.js";
import { createLLM, emptyUsageMetrics, type LLM, type LLMClient, type UsageMetrics } from "./llm.js";
import { LiteAgentOutput } from "./lite-agent-output.js";
import { Memory, type MemoryScope } from "./memory.js";
import { getToolNames, parseTools, renderTextDescriptionAndArgs } from "./agent-utils.js";
import type { AgentStepCallback, LLMMessage, Tool } from "./types.js";
import {
  _execute_task_with_a2a,
  create_extension_registry_from_config,
  get_a2a_agents_and_response_model,
  inject_a2a_server_methods,
  wrap_agent_with_a2a_instance,
} from "./a2a.js";

export type LiteAgentGuardrailResult =
  | readonly [boolean, unknown]
  | { success: boolean; result?: unknown; error?: unknown };

export type LiteAgentGuardrail = (
  output: LiteAgentOutput,
) => LiteAgentGuardrailResult | Promise<LiteAgentGuardrailResult>;

export type LiteAgentKickoffOptions = {
  responseFormat?: unknown;
  response_format?: unknown;
  inputFiles?: InputFiles;
  input_files?: InputFiles;
};

export type LiteAgentOptions = {
  id?: string;
  role: string;
  goal: string;
  backstory: string;
  llm?: LLM | string | null;
  tools?: readonly Tool[];
  verbose?: boolean;
  maxIterations?: number;
  max_iterations?: number;
  maxExecutionTime?: number | null;
  max_execution_time?: number | null;
  respectContextWindow?: boolean;
  respect_context_window?: boolean;
  useStopWords?: boolean;
  use_stop_words?: boolean;
  requestWithinRpmLimit?: (() => boolean) | null;
  request_within_rpm_limit?: (() => boolean) | null;
  responseFormat?: unknown;
  response_format?: unknown;
  guardrail?: LiteAgentGuardrail | null;
  guardrailMaxRetries?: number;
  guardrail_max_retries?: number;
  memory?: Memory | MemoryScope | boolean | null;
  stepCallback?: AgentStepCallback | null;
  step_callback?: AgentStepCallback | null;
  codeExecutionMode?: CodeExecutionMode;
  code_execution_mode?: CodeExecutionMode;
  a2a?: unknown;
};

export type LiteAgentKickoffInput = string | readonly LLMMessage[];

export type LiteAgentKickoffFunction = (
  messages: LiteAgentKickoffInput,
  responseFormatOrOptions?: unknown,
  inputFiles?: InputFiles,
) => LiteAgentOutput | Promise<LiteAgentOutput>;

export async function _kickoff_with_a2a_support(
  agent: LiteAgent,
  original_kickoff: LiteAgentKickoffFunction,
  messages: LiteAgentKickoffInput,
  response_format: unknown = null,
  input_files: InputFiles | null = null,
  extension_registry = create_extension_registry_from_config([]),
): Promise<LiteAgentOutput> {
  const [a2aAgents, agentResponseModel] = get_a2a_agents_and_response_model(agent.a2a as never);
  if (a2aAgents.length === 0) {
    return await original_kickoff(messages, response_format, input_files ?? undefined);
  }
  const description = liteAgentKickoffDescription(messages);
  if (!description) {
    return await original_kickoff(messages, response_format, input_files ?? undefined);
  }
  const result = await _execute_task_with_a2a({
    self: agent,
    a2a_agents: a2aAgents,
    original_fn: async () => {
      const output = await original_kickoff(messages, response_format, input_files ?? undefined);
      return output.raw;
    },
    task: {
      description,
      agent,
      expected_output: "Result from A2A delegation",
      input_files: input_files ?? {},
    },
    agent_response_model: agentResponseModel,
    context: null,
    tools: null,
    extension_registry,
  });
  return new LiteAgentOutput({
    raw: result,
    agent_role: agent.role,
    usage_metrics: null,
    messages: [],
  });
}

export function task_to_kickoff_adapter(
  original_kickoff: LiteAgentKickoffFunction,
  messages: LiteAgentKickoffInput,
  response_format: unknown = null,
  input_files: InputFiles | null = null,
): (...args: unknown[]) => Promise<string> {
  return async () => {
    const result = await original_kickoff(messages, response_format, input_files ?? undefined);
    return result.raw;
  };
}

export class LiteAgent {
  readonly id: string;
  readonly role: string;
  readonly goal: string;
  readonly backstory: string;
  llm: LLM | LLMClient | string | null;
  readonly tools: readonly Tool[];
  readonly verbose: boolean;
  readonly maxIterations: number;
  readonly max_iterations: number;
  readonly maxExecutionTime: number | null;
  readonly max_execution_time: number | null;
  readonly respectContextWindow: boolean;
  readonly respect_context_window: boolean;
  readonly useStopWords: boolean;
  readonly use_stop_words: boolean;
  readonly requestWithinRpmLimit: (() => boolean) | null;
  readonly request_within_rpm_limit: (() => boolean) | null;
  readonly responseFormat: unknown;
  readonly response_format: unknown;
  readonly guardrail: LiteAgentGuardrail | null;
  readonly guardrailMaxRetries: number;
  readonly guardrail_max_retries: number;
  memory: Memory | MemoryScope | null;
  readonly stepCallback: AgentStepCallback | null;
  readonly codeExecutionMode: CodeExecutionMode;
  readonly code_execution_mode: CodeExecutionMode;
  readonly a2a: unknown;
  readonly originalAgent: Agent | null = null;
  readonly original_agent: Agent | null = null;
  toolsResults: Record<string, unknown>[] = [];
  tools_results: Record<string, unknown>[] = this.toolsResults;
  private readonly _key: string;
  private currentMessages: LLMMessage[] = [];
  private currentIterations = 0;
  private usageMetrics: UsageMetrics = emptyUsageMetrics();

  constructor(options: LiteAgentOptions) {
    this.id = options.id ?? randomUUID();
    this.role = options.role;
    this.goal = options.goal;
    this.backstory = options.backstory;
    this.llm = options.llm ?? null;
    this.tools = options.tools ?? [];
    this.verbose = options.verbose ?? false;
    this.maxIterations = options.maxIterations ?? options.max_iterations ?? 15;
    this.max_iterations = this.maxIterations;
    this.maxExecutionTime = options.maxExecutionTime ?? options.max_execution_time ?? null;
    this.max_execution_time = this.maxExecutionTime;
    this.respectContextWindow = options.respectContextWindow ?? options.respect_context_window ?? true;
    this.respect_context_window = this.respectContextWindow;
    this.useStopWords = options.useStopWords ?? options.use_stop_words ?? true;
    this.use_stop_words = this.useStopWords;
    this.requestWithinRpmLimit = options.requestWithinRpmLimit ?? options.request_within_rpm_limit ?? null;
    this.request_within_rpm_limit = this.requestWithinRpmLimit;
    this.responseFormat = options.responseFormat ?? options.response_format ?? null;
    this.response_format = this.responseFormat;
    this.guardrail = options.guardrail ?? null;
    this.guardrailMaxRetries = options.guardrailMaxRetries ?? options.guardrail_max_retries ?? 3;
    this.guardrail_max_retries = this.guardrailMaxRetries;
    this.memory = options.memory === true
      ? new Memory()
      : options.memory
        ? options.memory
        : null;
    this.stepCallback = options.stepCallback ?? options.step_callback ?? null;
    this.codeExecutionMode = options.codeExecutionMode ?? options.code_execution_mode ?? "safe";
    this.code_execution_mode = this.codeExecutionMode;
    this.a2a = options.a2a ?? null;
    this._key = randomUUID();
    this.resolveMemory();
  }

  get key(): string {
    return this._key;
  }

  get messages(): readonly LLMMessage[] {
    return [...this.currentMessages];
  }

  get iterations(): number {
    return this.currentIterations;
  }

  get _original_role(): string {
    return this.role;
  }

  get beforeLlmCallHooks(): BeforeLLMCallHook[] {
    return getBeforeLlmCallHooks();
  }

  get before_llm_call_hooks(): BeforeLLMCallHook[] {
    return this.beforeLlmCallHooks;
  }

  get afterLlmCallHooks(): AfterLLMCallHook[] {
    return getAfterLlmCallHooks();
  }

  get after_llm_call_hooks(): AfterLLMCallHook[] {
    return this.afterLlmCallHooks;
  }

  setupLlm(): this {
    if (this.llm !== null && typeof this.llm === "string") {
      this.llm = createLLM(this.llm);
    }
    return this;
  }

  setup_llm(): this {
    return this.setupLlm();
  }

  parseTools(): this {
    parseTools(this.tools);
    return this;
  }

  parse_tools(): this {
    return this.parseTools();
  }

  setupA2aSupport(): this {
    if (this.a2a) {
      wrap_agent_with_a2a_instance(this);
    } else {
      inject_a2a_server_methods(this);
    }
    return this;
  }

  setup_a2a_support(): this {
    return this.setupA2aSupport();
  }

  ensureGuardrailIsCallable(): this {
    LiteAgent.validateGuardrailFunction(this.guardrail);
    return this;
  }

  ensure_guardrail_is_callable(): this {
    return this.ensureGuardrailIsCallable();
  }

  resolveMemory(): this {
    if (this.memory === null) {
      return this;
    }
    return this;
  }

  resolve_memory(): this {
    return this.resolveMemory();
  }

  static validateGuardrailFunction(value: LiteAgentGuardrail | string | null | undefined): LiteAgentGuardrail | string | null | undefined {
    if (value === null || value === undefined || typeof value === "string") {
      return value;
    }
    if (value.length !== 1) {
      throw new Error(`Guardrail function must accept exactly 1 parameter (LiteAgentOutput), but it accepts ${String(value.length)}`);
    }
    return value;
  }

  static validate_guardrail_function(value: LiteAgentGuardrail | string | null | undefined): LiteAgentGuardrail | string | null | undefined {
    return LiteAgent.validateGuardrailFunction(value);
  }

  async kickoff(
    messages: LiteAgentKickoffInput,
    responseFormatOrOptions?: unknown,
    inputFiles?: InputFiles,
  ): Promise<LiteAgentOutput> {
    const options = normalizeLiteAgentKickoffOptions(responseFormatOrOptions, inputFiles);
    const responseFormat = options.responseFormat ?? options.response_format ?? this.responseFormat;
    const formatted = formatLiteAgentMessages(messages, options.inputFiles ?? options.input_files);
    this.currentMessages = formatted.messages;
    this.currentIterations = 0;
    this.toolsResults = [];
    this.tools_results = this.toolsResults;
    const agentInfo = this.agentInfo();
    crewaiEventBus.emit(this, new LiteAgentExecutionStartedEvent({ agentInfo, messages: this.currentMessages }));
    try {
      const agent = this.toAgent();
      const beforeUsage = agent.getUsageMetrics();
      const raw = await agent.executeTask(formatted.prompt, {}, this.tools, {
        responseModel: responseFormat,
        inputFiles: formatted.inputFiles,
        stepCallbacks: [this.captureStepCallback.bind(this)],
      });
      this.usageMetrics = subtractUsageForLiteAgent(agent.getUsageMetrics(), beforeUsage);
      let output = new LiteAgentOutput({
        raw,
        pydantic: parseStructuredOutput(raw, responseFormat),
        agentRole: this.role,
        usageMetrics: this.usageMetrics,
        messages: this.currentMessages,
      });
      output = await this.applyGuardrail(output);
      crewaiEventBus.emit(this, new LiteAgentExecutionCompletedEvent({ agentInfo, output }));
      return output;
    } catch (error) {
      crewaiEventBus.emit(this, new LiteAgentExecutionErrorEvent({ agentInfo, error }));
      throw error;
    }
  }

  async kickoffAsync(
    messages: LiteAgentKickoffInput,
    responseFormatOrOptions?: unknown,
    inputFiles?: InputFiles,
  ): Promise<LiteAgentOutput> {
    return await this.kickoff(messages, responseFormatOrOptions, inputFiles);
  }

  async kickoff_async(
    messages: LiteAgentKickoffInput,
    responseFormatOrOptions?: unknown,
    inputFiles?: InputFiles,
  ): Promise<LiteAgentOutput> {
    return await this.kickoffAsync(messages, responseFormatOrOptions, inputFiles);
  }

  async akickoff(
    messages: LiteAgentKickoffInput,
    responseFormatOrOptions?: unknown,
    inputFiles?: InputFiles,
  ): Promise<LiteAgentOutput> {
    return await this.kickoffAsync(messages, responseFormatOrOptions, inputFiles);
  }

  getUsageMetrics(): UsageMetrics {
    return { ...this.usageMetrics };
  }

  getTokenUsageSummary(): UsageMetrics {
    return this.getUsageMetrics();
  }

  resetUsageMetrics(): void {
    this.usageMetrics = emptyUsageMetrics();
  }

  _formatMessages(
    messages: LiteAgentKickoffInput,
    responseFormat?: unknown,
    inputFiles?: InputFiles,
  ): LLMMessage[] {
    void responseFormat;
    return formatLiteAgentMessages(messages, inputFiles).messages;
  }

  _format_messages(
    messages: LiteAgentKickoffInput,
    response_format?: unknown,
    input_files?: InputFiles,
  ): LLMMessage[] {
    return this._formatMessages(messages, response_format, input_files);
  }

  _getDefaultSystemPrompt(responseFormat: unknown = null): string {
    const activeResponseFormat = responseFormat ?? this.responseFormat;
    let prompt = this.tools.length > 0
      ? I18N_DEFAULT.slice("lite_agent_system_prompt_with_tools").replace("{role}", this.role)
        .replace("{backstory}", this.backstory)
        .replace("{goal}", this.goal)
        .replace("{tools}", renderTextDescriptionAndArgs(this.tools))
        .replace("{tool_names}", getToolNames(this.tools))
      : I18N_DEFAULT.slice("lite_agent_system_prompt_without_tools").replace("{role}", this.role)
        .replace("{backstory}", this.backstory)
        .replace("{goal}", this.goal);
    if (activeResponseFormat) {
      prompt += I18N_DEFAULT.slice("lite_agent_response_format").replace(
        "{response_format}",
        JSON.stringify(this._serializeResponseFormat(activeResponseFormat), null, 2),
      );
    }
    return prompt;
  }

  _get_default_system_prompt(response_format: unknown = null): string {
    return this._getDefaultSystemPrompt(response_format);
  }

  _serializeResponseFormat(value: unknown): unknown {
    return serializeLiteAgentResponseFormat(value);
  }

  _serialize_response_format(value: unknown): unknown {
    return this._serializeResponseFormat(value);
  }

  _showLogs(formattedAnswer: unknown): void {
    crewaiEventBus.emit(this, new AgentLogsExecutionEvent({
      agent_role: this.role,
      formatted_answer: formattedAnswer,
      verbose: this.verbose,
    }));
  }

  _show_logs(formatted_answer: unknown): void {
    this._showLogs(formatted_answer);
  }

  _getLastUserContent(): string {
    for (let index = this.currentMessages.length - 1; index >= 0; index -= 1) {
      const message = this.currentMessages[index];
      if (message?.role === "user" && typeof message.content === "string") {
        return message.content;
      }
    }
    return "";
  }

  _get_last_user_content(): string {
    return this._getLastUserContent();
  }

  _appendMessage(message: LLMMessage): void {
    this.currentMessages.push({ ...message });
  }

  _append_message(message: LLMMessage): void {
    this._appendMessage(message);
  }

  _injectMemoryContext(): void {
    if (!this.memory) {
      return;
    }
    const startedAt = Date.now();
    crewaiEventBus.emit(this, new MemoryRetrievalStartedEvent({ task_id: null }));
    try {
      const matches = this.memory.recall(this._getLastUserContent(), { limit: 10 });
      const memoryBlock = matches.length > 0
        ? `Relevant memories:\n${matches.map((match) => match.format()).join("\n")}`
        : "";
      if (memoryBlock) {
        const formatted = `# Memories from past conversations:\n${memoryBlock}`;
        const [firstMessage] = this.currentMessages;
        if (firstMessage?.role === "system" && typeof firstMessage.content === "string") {
          this.currentMessages[0] = {
            ...firstMessage,
            content: `${firstMessage.content}\n\n${formatted}`,
          };
        } else {
          this.currentMessages.unshift({ role: "system", content: formatted });
        }
      }
      crewaiEventBus.emit(this, new MemoryRetrievalCompletedEvent({
        task_id: null,
        memory_content: memoryBlock,
        retrieval_time_ms: Date.now() - startedAt,
      }));
    } catch (error) {
      crewaiEventBus.emit(this, new MemoryRetrievalFailedEvent({
        task_id: null,
        error,
      }));
    }
  }

  _inject_memory_context(): void {
    this._injectMemoryContext();
  }

  _saveToMemory(outputText: string): void {
    if (!this.memory || this.memory.readOnly) {
      return;
    }
    const inputText = this._getLastUserContent() || "User request";
    const raw = `Input: ${inputText}\nAgent: ${this.role}\nResult: ${outputText}`;
    const extracted = this.memory.extract_memories(raw);
    if (extracted.length > 0) {
      this.memory.remember_many(extracted, { agentRole: this.role });
    }
  }

  _save_to_memory(output_text: string): void {
    this._saveToMemory(output_text);
  }

  private toAgent(): Agent {
    return new Agent({
      role: this.role,
      goal: this.goal,
      backstory: this.backstory,
      llm: this.llm,
      tools: this.tools,
      verbose: this.verbose,
      maxIter: this.maxIterations,
      maxExecutionTime: this.maxExecutionTime,
      respectContextWindow: this.respectContextWindow,
      memory: this.memory,
      stepCallback: this.stepCallback,
      codeExecutionMode: this.codeExecutionMode,
    });
  }

  private agentInfo(): Record<string, unknown> {
    return {
      id: this.id,
      role: this.role,
      goal: this.goal,
      backstory: this.backstory,
      tools: this.tools,
      verbose: this.verbose,
    };
  }

  private captureStepCallback(step: Parameters<AgentStepCallback>[0]): void {
    this.currentIterations = Math.max(this.currentIterations, step.iteration + 1);
    if (step.type === "tool" || step.type === "direct_tool") {
      this.toolsResults.push({
        toolName: step.toolName,
        tool_name: step.toolName,
        arguments: step.toolArgs,
        output: step.output,
        resultAsAnswer: step.resultAsAnswer,
        result_as_answer: step.resultAsAnswer,
      });
    }
  }

  private async applyGuardrail(initialOutput: LiteAgentOutput): Promise<LiteAgentOutput> {
    if (!this.guardrail) {
      return initialOutput;
    }
    let output = initialOutput;
    let lastError: unknown = "Guardrail validation failed";
    for (let attempt = 0; attempt <= this.guardrailMaxRetries; attempt += 1) {
      crewaiEventBus.emit(this, new LLMGuardrailStartedEvent({
        guardrail: this.guardrail,
        retry_count: attempt,
        from_agent: this,
      }));
      let result: ReturnType<typeof normalizeLiteAgentGuardrailResult>;
      try {
        result = normalizeLiteAgentGuardrailResult(await this.guardrail(output));
      } catch (error) {
        crewaiEventBus.emit(this, new LLMGuardrailCompletedEvent({
          success: false,
          result: null,
          error,
          retry_count: attempt,
          from_agent: this,
        }));
        throw error;
      }
      crewaiEventBus.emit(this, new LLMGuardrailCompletedEvent({
        success: result.success,
        result: result.result ?? null,
        ...(result.success ? {} : { error: result.error ?? result.result }),
        retry_count: attempt,
        from_agent: this,
      }));
      if (result.success) {
        if (result.result === undefined || result.result === null) {
          return output;
        }
        return outputFromGuardrailResult(output, result.result);
      }
      lastError = result.error ?? result.result ?? lastError;
      if (attempt >= this.guardrailMaxRetries) {
        throw new Error(`Agent's guardrail failed validation after ${String(this.guardrailMaxRetries)} retries. Last error: ${String(lastError)}`);
      }
      if (result.result !== undefined && result.result !== null) {
        output = outputFromGuardrailResult(output, result.result);
      }
    }
    return output;
  }
}

function normalizeLiteAgentKickoffOptions(responseFormatOrOptions?: unknown, inputFiles?: InputFiles): LiteAgentKickoffOptions {
  if (isLiteAgentKickoffOptions(responseFormatOrOptions)) {
    return {
      ...responseFormatOrOptions,
      ...(inputFiles === undefined ? {} : { inputFiles }),
    };
  }
  return {
    ...(responseFormatOrOptions === undefined ? {} : { responseFormat: responseFormatOrOptions }),
    ...(inputFiles === undefined ? {} : { inputFiles }),
  };
}

function isLiteAgentKickoffOptions(value: unknown): value is LiteAgentKickoffOptions {
  return Boolean(
    value
    && typeof value === "object"
    && (
      "responseFormat" in value
      || "response_format" in value
      || "inputFiles" in value
      || "input_files" in value
    ),
  );
}

function formatLiteAgentMessages(input: LiteAgentKickoffInput, explicitInputFiles?: InputFiles): { prompt: string; messages: LLMMessage[]; inputFiles: InputFiles } {
  if (typeof input === "string") {
    const extracted = extractInputFilesFromInputs({});
    return {
      prompt: input,
      messages: [{ role: "user", content: input }],
      inputFiles: { ...extracted.inputFiles, ...(explicitInputFiles ?? {}) },
    };
  }

  const messageInputFiles: InputFiles = {};
  const messages = input.map((message) => {
    if (message.files) {
      Object.assign(messageInputFiles, message.files);
    }
    return { ...message };
  });
  return {
    prompt: messages.map((message) => message.content).filter(Boolean).join("\n"),
    messages,
    inputFiles: { ...messageInputFiles, ...(explicitInputFiles ?? {}) },
  };
}

function liteAgentKickoffDescription(messages: LiteAgentKickoffInput): string {
  if (typeof messages === "string") {
    return messages;
  }
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "user" && typeof message.content === "string") {
      return message.content;
    }
  }
  return "";
}

function parseStructuredOutput(raw: string, responseFormat: unknown): unknown {
  if (!responseFormat) {
    return null;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function serializeLiteAgentResponseFormat(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "function" && value.name) {
    return value.name;
  }
  if (typeof value === "object") {
    const maybeNamed = value as { name?: unknown; type?: unknown };
    if (typeof maybeNamed.name === "string") {
      return maybeNamed.name;
    }
    if (maybeNamed.type === "json_object") {
      return { type: "json_object" };
    }
  }
  return value;
}

function normalizeLiteAgentGuardrailResult(result: LiteAgentGuardrailResult): { success: boolean; result?: unknown; error?: unknown } {
  if (isLiteAgentGuardrailTuple(result)) {
    return { success: result[0], result: result[1] };
  }
  return result;
}

function isLiteAgentGuardrailTuple(result: LiteAgentGuardrailResult): result is readonly [boolean, unknown] {
  return Array.isArray(result);
}

function outputFromGuardrailResult(previous: LiteAgentOutput, result: unknown): LiteAgentOutput {
  if (result instanceof LiteAgentOutput) {
    return result;
  }
  if (typeof result === "string") {
    return new LiteAgentOutput({
      raw: result,
      pydantic: previous.pydantic,
      agentRole: previous.agentRole,
      usageMetrics: previous.usageMetrics,
      messages: previous.messages,
      plan: previous.plan,
      todos: previous.todos,
      replanCount: previous.replanCount,
      lastReplanReason: previous.lastReplanReason,
    });
  }
  return new LiteAgentOutput({
    raw: JSON.stringify(result),
    pydantic: result,
    agentRole: previous.agentRole,
    usageMetrics: previous.usageMetrics,
    messages: previous.messages,
    plan: previous.plan,
    todos: previous.todos,
    replanCount: previous.replanCount,
    lastReplanReason: previous.lastReplanReason,
  });
}

function subtractUsageForLiteAgent(current: UsageMetrics, before: UsageMetrics): UsageMetrics {
  return {
    totalTokens: Math.max(0, current.totalTokens - before.totalTokens),
    promptTokens: Math.max(0, current.promptTokens - before.promptTokens),
    cachedPromptTokens: Math.max(0, current.cachedPromptTokens - before.cachedPromptTokens),
    completionTokens: Math.max(0, current.completionTokens - before.completionTokens),
    reasoningTokens: Math.max(0, current.reasoningTokens - before.reasoningTokens),
    cacheCreationTokens: Math.max(0, current.cacheCreationTokens - before.cacheCreationTokens),
    successfulRequests: Math.max(0, current.successfulRequests - before.successfulRequests),
  };
}
