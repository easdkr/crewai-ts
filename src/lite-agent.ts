import { randomUUID } from "node:crypto";

import { Agent, type CodeExecutionMode } from "./agent.js";
import {
  LLMGuardrailCompletedEvent,
  LLMGuardrailStartedEvent,
  LiteAgentExecutionCompletedEvent,
  LiteAgentExecutionErrorEvent,
  LiteAgentExecutionStartedEvent,
  crewaiEventBus,
} from "./events.js";
import { extractInputFilesFromInputs, type InputFiles } from "./input-files.js";
import { emptyUsageMetrics, type LLM, type UsageMetrics } from "./llm.js";
import { LiteAgentOutput } from "./lite-agent-output.js";
import type { Memory, MemoryScope } from "./memory.js";
import type { AgentStepCallback, LLMMessage, Tool } from "./types.js";

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
};

export type LiteAgentKickoffInput = string | readonly LLMMessage[];

export class LiteAgent {
  readonly id: string;
  readonly role: string;
  readonly goal: string;
  readonly backstory: string;
  readonly llm: LLM | string | null;
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
  readonly memory: Memory | MemoryScope | null;
  readonly stepCallback: AgentStepCallback | null;
  readonly codeExecutionMode: CodeExecutionMode;
  readonly code_execution_mode: CodeExecutionMode;
  readonly key: string;
  readonly originalAgent: Agent | null = null;
  readonly original_agent: Agent | null = null;
  toolsResults: Record<string, unknown>[] = [];
  tools_results: Record<string, unknown>[] = this.toolsResults;
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
    this.memory = options.memory && options.memory !== true ? options.memory : null;
    this.stepCallback = options.stepCallback ?? options.step_callback ?? null;
    this.codeExecutionMode = options.codeExecutionMode ?? options.code_execution_mode ?? "safe";
    this.code_execution_mode = this.codeExecutionMode;
    this.key = randomUUID();
  }

  get messages(): readonly LLMMessage[] {
    return [...this.currentMessages];
  }

  get iterations(): number {
    return this.currentIterations;
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
