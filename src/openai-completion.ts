import { ConfiguredLLM, LocalFileUploader, type BaseLLMOptions, type LLMCallOptions, type LLMMessageInput, type LLMResponse } from "./llm.js";
import { convertToolsToOpenAISchema } from "./agent-utils.js";
import { generateModelDescription, type JsonSchema } from "./schema-utils.js";
import type { LLMMessage, Tool } from "./types.js";

export const WebSearchResult = Object.freeze({ kind: "WebSearchResult" });
export type WebSearchResult = {
  id?: string | null;
  status?: string | null;
  type: string;
};

export const FileSearchResultItem = Object.freeze({ kind: "FileSearchResultItem" });
export type FileSearchResultItem = {
  file_id?: string | null;
  fileId?: string | null;
  filename?: string | null;
  text?: string | null;
  score?: number | null;
  attributes?: Record<string, string | number | boolean> | null;
};

export const FileSearchResult = Object.freeze({ kind: "FileSearchResult" });
export type FileSearchResult = {
  id?: string | null;
  status?: string | null;
  type: string;
  queries?: string[];
  results?: FileSearchResultItem[];
};

export const CodeInterpreterLogResult = Object.freeze({ kind: "CodeInterpreterLogResult" });
export type CodeInterpreterLogResult = {
  type: string;
  logs: string;
};

export const CodeInterpreterFileResult = Object.freeze({ kind: "CodeInterpreterFileResult" });
export type CodeInterpreterFileResult = {
  type: string;
  files: Array<Record<string, unknown>>;
};

export const CodeInterpreterResult = Object.freeze({ kind: "CodeInterpreterResult" });
export type CodeInterpreterResult = {
  id?: string | null;
  status?: string | null;
  type: string;
  code?: string | null;
  container_id?: string | null;
  containerId?: string | null;
  results?: Array<CodeInterpreterLogResult | CodeInterpreterFileResult>;
};

export const ComputerUseResult = Object.freeze({ kind: "ComputerUseResult" });
export type ComputerUseResult = {
  id?: string | null;
  status?: string | null;
  type: string;
  call_id?: string | null;
  callId?: string | null;
  action?: Record<string, unknown>;
  pending_safety_checks?: Array<Record<string, unknown>>;
  pendingSafetyChecks?: Array<Record<string, unknown>>;
};

export const ReasoningSummary = Object.freeze({ kind: "ReasoningSummary" });
export type ReasoningSummary = {
  id?: string | null;
  status?: string | null;
  type: string;
  summary?: Array<Record<string, unknown>>;
  encrypted_content?: string | null;
  encryptedContent?: string | null;
};

export type ResponsesAPIResultOptions = {
  text?: string;
  web_search_results?: WebSearchResult[];
  webSearchResults?: WebSearchResult[];
  file_search_results?: FileSearchResult[];
  fileSearchResults?: FileSearchResult[];
  code_interpreter_results?: CodeInterpreterResult[];
  codeInterpreterResults?: CodeInterpreterResult[];
  computer_use_results?: ComputerUseResult[];
  computerUseResults?: ComputerUseResult[];
  reasoning_summaries?: ReasoningSummary[];
  reasoningSummaries?: ReasoningSummary[];
  function_calls?: Array<Record<string, unknown>>;
  functionCalls?: Array<Record<string, unknown>>;
  response_id?: string | null;
  responseId?: string | null;
};

export class ResponsesAPIResult {
  text: string;
  web_search_results: WebSearchResult[];
  webSearchResults: WebSearchResult[];
  file_search_results: FileSearchResult[];
  fileSearchResults: FileSearchResult[];
  code_interpreter_results: CodeInterpreterResult[];
  codeInterpreterResults: CodeInterpreterResult[];
  computer_use_results: ComputerUseResult[];
  computerUseResults: ComputerUseResult[];
  reasoning_summaries: ReasoningSummary[];
  reasoningSummaries: ReasoningSummary[];
  function_calls: Array<Record<string, unknown>>;
  functionCalls: Array<Record<string, unknown>>;
  response_id: string | null;
  responseId: string | null;

  constructor(options: ResponsesAPIResultOptions = {}) {
    this.text = options.text ?? "";
    this.web_search_results = [...(options.web_search_results ?? options.webSearchResults ?? [])];
    this.webSearchResults = this.web_search_results;
    this.file_search_results = [...(options.file_search_results ?? options.fileSearchResults ?? [])];
    this.fileSearchResults = this.file_search_results;
    this.code_interpreter_results = [...(options.code_interpreter_results ?? options.codeInterpreterResults ?? [])];
    this.codeInterpreterResults = this.code_interpreter_results;
    this.computer_use_results = [...(options.computer_use_results ?? options.computerUseResults ?? [])];
    this.computerUseResults = this.computer_use_results;
    this.reasoning_summaries = [...(options.reasoning_summaries ?? options.reasoningSummaries ?? [])];
    this.reasoningSummaries = this.reasoning_summaries;
    this.function_calls = [...(options.function_calls ?? options.functionCalls ?? [])];
    this.functionCalls = this.function_calls;
    this.response_id = options.response_id ?? options.responseId ?? null;
    this.responseId = this.response_id;
  }

  hasToolOutputs(): boolean {
    return this.web_search_results.length > 0
      || this.file_search_results.length > 0
      || this.code_interpreter_results.length > 0
      || this.computer_use_results.length > 0;
  }

  has_tool_outputs(): boolean {
    return this.hasToolOutputs();
  }

  hasReasoning(): boolean {
    return this.reasoning_summaries.length > 0;
  }

  has_reasoning(): boolean {
    return this.hasReasoning();
  }
}

export type OpenAICompletionOptions = BaseLLMOptions & {
  organization?: string | null;
  project?: string | null;
  timeout?: number | null;
  max_retries?: number;
  maxRetries?: number;
  default_headers?: Record<string, string> | null;
  defaultHeaders?: Record<string, string> | null;
  default_query?: Record<string, unknown> | null;
  defaultQuery?: Record<string, unknown> | null;
  client_params?: Record<string, unknown> | null;
  clientParams?: Record<string, unknown> | null;
  top_p?: number | null;
  topP?: number | null;
  frequency_penalty?: number | null;
  frequencyPenalty?: number | null;
  presence_penalty?: number | null;
  presencePenalty?: number | null;
  max_tokens?: number | null;
  maxTokens?: number | null;
  max_completion_tokens?: number | null;
  maxCompletionTokens?: number | null;
  seed?: number | null;
  stream?: boolean;
  response_format?: unknown;
  responseFormat?: unknown;
  logprobs?: boolean | null;
  top_logprobs?: number | null;
  topLogprobs?: number | null;
  reasoning_effort?: string | null;
  reasoningEffort?: string | null;
  interceptor?: unknown;
  api?: "completions" | "responses";
  instructions?: string | null;
  store?: boolean | null;
  previous_response_id?: string | null;
  previousResponseId?: string | null;
  include?: string[] | null;
  builtin_tools?: string[] | null;
  builtinTools?: string[] | null;
  parse_tool_outputs?: boolean;
  parseToolOutputs?: boolean;
  auto_chain?: boolean;
  autoChain?: boolean;
  auto_chain_reasoning?: boolean;
  autoChainReasoning?: boolean;
  api_base?: string | null;
  apiBase?: string | null;
};

export class OpenAICompletion extends ConfiguredLLM {
  static readonly BUILTIN_TOOL_TYPES: Readonly<Record<string, string>> = Object.freeze({
    web_search: "web_search_preview",
    file_search: "file_search",
    code_interpreter: "code_interpreter",
    computer_use: "computer_use_preview",
  });

  readonly organization: string | null;
  readonly project: string | null;
  readonly maxRetries: number;
  readonly max_retries: number;
  readonly defaultHeaders: Record<string, string> | null;
  readonly default_headers: Record<string, string> | null;
  readonly defaultQuery: Record<string, unknown> | null;
  readonly default_query: Record<string, unknown> | null;
  readonly clientParams: Record<string, unknown> | null;
  readonly client_params: Record<string, unknown> | null;
  readonly topP: number | null;
  readonly top_p: number | null;
  readonly frequencyPenalty: number | null;
  readonly frequency_penalty: number | null;
  readonly presencePenalty: number | null;
  readonly presence_penalty: number | null;
  readonly seed: number | null;
  readonly stream: boolean;
  readonly topLogprobs: number | null;
  readonly top_logprobs: number | null;
  readonly reasoningEffort: string | null;
  readonly reasoning_effort: string | null;
  readonly interceptor: unknown;
  readonly api: "completions" | "responses";
  readonly instructions: string | null;
  readonly store: boolean | null;
  readonly previousResponseId: string | null;
  readonly previous_response_id: string | null;
  readonly include: string[] | null;
  readonly builtinTools: string[] | null;
  readonly builtin_tools: string[] | null;
  readonly parseToolOutputs: boolean;
  readonly parse_tool_outputs: boolean;
  readonly autoChain: boolean;
  readonly auto_chain: boolean;
  readonly autoChainReasoning: boolean;
  readonly auto_chain_reasoning: boolean;
  readonly isO1Model: boolean;
  readonly is_o1_model: boolean;
  readonly isGpt4Model: boolean;
  readonly is_gpt4_model: boolean;
  private responseChainId: string | null;
  private reasoningChainItems: unknown[];

  constructor(options: OpenAICompletionOptions = { model: "gpt-4o" }) {
    const model = options.model;
    super(stripUndefined({
      model,
      temperature: options.temperature,
      apiKey: options.apiKey,
      api_key: options.api_key,
      baseUrl: options.baseUrl,
      base_url: options.base_url,
      provider: options.provider ?? "openai",
      preferUpload: options.preferUpload,
      prefer_upload: options.prefer_upload,
      isLitellm: options.isLitellm,
      is_litellm: options.is_litellm,
      stop: options.stop,
      stopSequences: options.stopSequences,
      stop_sequences: options.stop_sequences,
      additionalParams: options.additionalParams,
      additional_params: options.additional_params,
      responseFormat: options.responseFormat,
      response_format: options.response_format,
      contextWindowSize: options.contextWindowSize,
      context_window_size: options.context_window_size,
      apiBase: options.apiBase ?? options.api_base ?? null,
      maxTokens: options.maxTokens ?? options.max_tokens ?? null,
      maxCompletionTokens: options.maxCompletionTokens ?? options.max_completion_tokens ?? null,
    }) as BaseLLMOptions & {
      apiBase?: string | null;
      maxTokens?: number | null;
      maxCompletionTokens?: number | null;
    });
    this.organization = options.organization ?? null;
    this.project = options.project ?? null;
    this.maxRetries = options.maxRetries ?? options.max_retries ?? 2;
    this.max_retries = this.maxRetries;
    this.defaultHeaders = options.defaultHeaders ?? options.default_headers ?? null;
    this.default_headers = this.defaultHeaders;
    this.defaultQuery = options.defaultQuery ?? options.default_query ?? null;
    this.default_query = this.defaultQuery;
    this.clientParams = options.clientParams ?? options.client_params ?? null;
    this.client_params = this.clientParams;
    this.topP = options.topP ?? options.top_p ?? null;
    this.top_p = this.topP;
    this.frequencyPenalty = options.frequencyPenalty ?? options.frequency_penalty ?? null;
    this.frequency_penalty = this.frequencyPenalty;
    this.presencePenalty = options.presencePenalty ?? options.presence_penalty ?? null;
    this.presence_penalty = this.presencePenalty;
    this.seed = options.seed ?? null;
    this.stream = options.stream ?? false;
    this.topLogprobs = options.topLogprobs ?? options.top_logprobs ?? null;
    this.top_logprobs = this.topLogprobs;
    this.reasoningEffort = options.reasoningEffort ?? options.reasoning_effort ?? null;
    this.reasoning_effort = this.reasoningEffort;
    this.interceptor = options.interceptor ?? null;
    this.api = options.api ?? "completions";
    this.instructions = options.instructions ?? null;
    this.store = options.store ?? null;
    this.previousResponseId = options.previousResponseId ?? options.previous_response_id ?? null;
    this.previous_response_id = this.previousResponseId;
    this.include = options.include ? [...options.include] : null;
    this.builtinTools = options.builtinTools ?? options.builtin_tools ?? null;
    this.builtin_tools = this.builtinTools ? [...this.builtinTools] : null;
    this.parseToolOutputs = options.parseToolOutputs ?? options.parse_tool_outputs ?? false;
    this.parse_tool_outputs = this.parseToolOutputs;
    this.autoChain = options.autoChain ?? options.auto_chain ?? false;
    this.auto_chain = this.autoChain;
    this.autoChainReasoning = options.autoChainReasoning ?? options.auto_chain_reasoning ?? false;
    this.auto_chain_reasoning = this.autoChainReasoning;
    const lowerModel = model.toLowerCase();
    this.isO1Model = lowerModel.includes("o1");
    this.is_o1_model = this.isO1Model;
    this.isGpt4Model = lowerModel.includes("gpt-4");
    this.is_gpt4_model = this.isGpt4Model;
    this.responseChainId = this.previousResponseId;
    this.reasoningChainItems = [];
  }

  override call(messages: readonly LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse> {
    return super.call(messages, options);
  }

  override async acall(messages: LLMMessageInput, options?: LLMCallOptions): Promise<LLMResponse> {
    return await super.acall(messages, options);
  }

  prepareCompletionParams(messages: readonly LLMMessage[], tools: readonly Tool[] | null = null): Record<string, unknown> {
    const params: Record<string, unknown> = {
      model: this.model,
      messages: [...messages],
      ...this.additionalParams,
    };
    if (this.stream) {
      params.stream = true;
      params.stream_options = { include_usage: true };
    }
    if (this.temperature !== null) {
      params.temperature = this.temperature;
    }
    if (this.topP !== null) {
      params.top_p = this.topP;
    }
    if (this.frequencyPenalty !== null) {
      params.frequency_penalty = this.frequencyPenalty;
    }
    if (this.presencePenalty !== null) {
      params.presence_penalty = this.presencePenalty;
    }
    if (this.maxCompletionTokens !== null) {
      params.max_completion_tokens = this.maxCompletionTokens;
    } else if (this.maxTokens !== null) {
      params.max_tokens = this.maxTokens;
    }
    if (this.seed !== null) {
      params.seed = this.seed;
    }
    if (this.logprobs !== null) {
      params.logprobs = this.logprobs;
    }
    if (this.topLogprobs !== null) {
      params.top_logprobs = this.topLogprobs;
    }
    if (this.isO1Model && this.reasoningEffort) {
      params.reasoning_effort = this.reasoningEffort;
    }
    if (this.responseFormat !== null) {
      params.response_format = this.responseFormat;
    }
    if (tools && tools.length > 0) {
      params.tools = this.convertToolsForInterference(tools);
      params.tool_choice = "auto";
    }
    return stripCrewAISpecificParams(params);
  }

  _prepare_completion_params(messages: readonly LLMMessage[], tools: readonly Tool[] | null = null): Record<string, unknown> {
    return this.prepareCompletionParams(messages, tools);
  }

  prepareResponsesParams(
    messages: readonly LLMMessage[],
    tools: readonly Tool[] | null = null,
    responseModel: unknown = null,
  ): Record<string, unknown> {
    let instructions = this.instructions;
    const inputMessages: LLMMessage[] = [];
    for (const message of messages) {
      if (message.role === "system") {
        instructions = instructions ? `${instructions}\n\n${message.content}` : message.content;
      } else {
        inputMessages.push({ ...message });
      }
    }

    const includeItems = [...(this.include ?? [])];
    if (this.autoChainReasoning && !includeItems.includes("reasoning.encrypted_content")) {
      includeItems.push("reasoning.encrypted_content");
    }
    const finalInput: unknown[] = [];
    if (this.autoChainReasoning && this.reasoningChainItems.length > 0) {
      finalInput.push(...this.reasoningChainItems);
    }
    finalInput.push(...(inputMessages.length > 0 ? inputMessages : messages));

    const params: Record<string, unknown> = {
      model: this.model,
      input: finalInput,
      ...this.additionalParams,
    };
    if (instructions) {
      params.instructions = instructions;
    }
    if (this.stream) {
      params.stream = true;
    }
    if (this.store !== null) {
      params.store = this.store;
    }
    if (this.previousResponseId) {
      params.previous_response_id = this.previousResponseId;
    } else if (this.autoChain && this.responseChainId) {
      params.previous_response_id = this.responseChainId;
    }
    if (includeItems.length > 0) {
      params.include = includeItems;
    }
    if (this.temperature !== null) {
      params.temperature = this.temperature;
    }
    if (this.topP !== null) {
      params.top_p = this.topP;
    }
    if (this.maxCompletionTokens !== null) {
      params.max_output_tokens = this.maxCompletionTokens;
    } else if (this.maxTokens !== null) {
      params.max_output_tokens = this.maxTokens;
    }
    if (this.seed !== null) {
      params.seed = this.seed;
    }
    if (this.reasoningEffort) {
      params.reasoning = { effort: this.reasoningEffort };
    }
    const formatModel = responseModel ?? this.responseFormat;
    if (formatModel !== null) {
      params.text = { format: openAIResponsesTextFormat(formatModel) };
    }
    const allTools: Record<string, unknown>[] = [];
    if (this.builtinTools) {
      for (const toolName of this.builtinTools) {
        allTools.push({ type: OpenAICompletion.BUILTIN_TOOL_TYPES[toolName] ?? toolName });
      }
    }
    if (tools && tools.length > 0) {
      allTools.push(...this.convertToolsForResponses(tools));
    }
    if (allTools.length > 0) {
      params.tools = allTools;
    }
    return stripCrewAISpecificParams(params);
  }

  _prepare_responses_params(
    messages: readonly LLMMessage[],
    tools: readonly Tool[] | null = null,
    responseModel: unknown = null,
  ): Record<string, unknown> {
    return this.prepareResponsesParams(messages, tools, responseModel);
  }

  convertToolsForInterference(tools: readonly Tool[]): Record<string, unknown>[] {
    return convertToolsToOpenAISchema(tools)[0];
  }

  _convert_tools_for_interference(tools: readonly Tool[]): Record<string, unknown>[] {
    return this.convertToolsForInterference(tools);
  }

  convertToolsForResponses(tools: readonly Tool[]): Record<string, unknown>[] {
    return this.convertToolsForInterference(tools).map((tool) => {
      const fn = tool.function;
      if (!fn || typeof fn !== "object" || Array.isArray(fn)) {
        return tool;
      }
      return {
        type: "function",
        ...fn,
      };
    });
  }

  _convert_tools_for_responses(tools: readonly Tool[]): Record<string, unknown>[] {
    return this.convertToolsForResponses(tools);
  }

  getClientParams(env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
    const apiKey = this.apiKey ?? env.OPENAI_API_KEY ?? null;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required");
    }
    const baseParams: Record<string, unknown> = {
      api_key: apiKey,
      organization: this.organization,
      project: this.project,
      base_url: this.baseUrl ?? this.apiBase ?? env.OPENAI_BASE_URL ?? null,
      timeout: this.timeout,
      max_retries: this.maxRetries,
      default_headers: this.defaultHeaders,
      default_query: this.defaultQuery,
    };
    const clientParams = Object.fromEntries(
      Object.entries(baseParams).filter(([, value]) => value !== null && value !== undefined),
    );
    if (this.clientParams) {
      Object.assign(clientParams, this.clientParams);
    }
    return clientParams;
  }

  _get_client_params(env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
    return this.getClientParams(env);
  }

  extractOpenAITokenUsage(response: unknown): Record<string, number> {
    const usage = readObject(readObject(response).usage);
    if (!hasNumericField(usage, "prompt_tokens", "completion_tokens", "total_tokens")) {
      return { total_tokens: 0 };
    }

    const result: Record<string, number> = {
      prompt_tokens: numberField(usage, "prompt_tokens"),
      completion_tokens: numberField(usage, "completion_tokens"),
      total_tokens: numberField(usage, "total_tokens"),
    };
    const promptDetails = readObject(usage.prompt_tokens_details);
    if (hasNumericField(promptDetails, "cached_tokens")) {
      result.cached_prompt_tokens = numberField(promptDetails, "cached_tokens");
    }
    const completionDetails = readObject(usage.completion_tokens_details);
    if (hasNumericField(completionDetails, "reasoning_tokens")) {
      result.reasoning_tokens = numberField(completionDetails, "reasoning_tokens");
    }
    return result;
  }

  _extract_openai_token_usage(response: unknown): Record<string, number> {
    return this.extractOpenAITokenUsage(response);
  }

  static extractOpenAITokenUsage(response: unknown): Record<string, number> {
    return new OpenAICompletion({ model: "gpt-4o" }).extractOpenAITokenUsage(response);
  }

  static extract_openai_token_usage(response: unknown): Record<string, number> {
    return OpenAICompletion.extractOpenAITokenUsage(response);
  }

  extractResponsesTokenUsage(response: unknown): Record<string, number> {
    const usage = readObject(readObject(response).usage);
    if (!hasNumericField(usage, "input_tokens", "output_tokens", "total_tokens")) {
      return { total_tokens: 0 };
    }

    const result: Record<string, number> = {
      prompt_tokens: numberField(usage, "input_tokens"),
      completion_tokens: numberField(usage, "output_tokens"),
      total_tokens: numberField(usage, "total_tokens"),
    };
    const inputDetails = readObject(usage.input_tokens_details);
    if (hasNumericField(inputDetails, "cached_tokens")) {
      result.cached_prompt_tokens = numberField(inputDetails, "cached_tokens");
    }
    const outputDetails = readObject(usage.output_tokens_details);
    if (hasNumericField(outputDetails, "reasoning_tokens")) {
      result.reasoning_tokens = numberField(outputDetails, "reasoning_tokens");
    }
    return result;
  }

  _extract_responses_token_usage(response: unknown): Record<string, number> {
    return this.extractResponsesTokenUsage(response);
  }

  extractFunctionCallsFromResponse(response: unknown): Record<string, unknown>[] {
    return responseOutput(response)
      .map((item) => readObject(item))
      .filter((item) => item.type === "function_call")
      .map((item) => ({
        id: item.call_id,
        name: item.name,
        arguments: item.arguments,
      }));
  }

  _extract_function_calls_from_response(response: unknown): Record<string, unknown>[] {
    return this.extractFunctionCallsFromResponse(response);
  }

  extractReasoningItems(response: unknown): unknown[] {
    return responseOutput(response).filter((item) => readObject(item).type === "reasoning");
  }

  _extract_reasoning_items(response: unknown): unknown[] {
    return this.extractReasoningItems(response);
  }

  extractBuiltinToolOutputs(response: unknown): ResponsesAPIResult {
    const responseRecord = readObject(response);
    const result = new ResponsesAPIResult({
      text: typeof responseRecord.output_text === "string" ? responseRecord.output_text : "",
      response_id: typeof responseRecord.id === "string" ? responseRecord.id : null,
    });

    for (const rawItem of responseOutput(response)) {
      const item = readObject(rawItem);
      const type = typeof item.type === "string" ? item.type : "";
      if (type === "web_search_call" || type === "web_search_preview") {
        result.web_search_results.push({
          id: stringOrNull(item.id),
          status: stringOrNull(item.status),
          type,
        });
      } else if (type === "file_search_call" || type === "file_search") {
        const rawResults = Array.isArray(item.results) ? item.results : [];
        result.file_search_results.push({
          id: stringOrNull(item.id),
          status: stringOrNull(item.status),
          type,
          queries: Array.isArray(item.queries) ? item.queries.filter((query): query is string => typeof query === "string") : [],
          results: rawResults.map((rawResult) => {
            const fileResult = readObject(rawResult);
            return {
              file_id: stringOrNull(fileResult.file_id),
              filename: stringOrNull(fileResult.filename),
              text: stringOrNull(fileResult.text),
              score: typeof fileResult.score === "number" ? fileResult.score : null,
              attributes: readStringNumberBooleanRecord(fileResult.attributes),
            };
          }),
        });
      } else if (type === "code_interpreter_call" || type === "code_interpreter") {
        const rawOutputs = Array.isArray(item.outputs) ? item.outputs : [];
        const codeResults: Array<CodeInterpreterLogResult | CodeInterpreterFileResult> = [];
        for (const rawOutput of rawOutputs) {
          const output = readObject(rawOutput);
          if (output.type === "logs") {
            codeResults.push({ type: "logs", logs: typeof output.logs === "string" ? output.logs : "" });
          } else if (output.type === "image") {
            codeResults.push({ type: "files", files: [{ url: output.url }] });
          }
        }
        result.code_interpreter_results.push({
          id: stringOrNull(item.id),
          status: stringOrNull(item.status),
          type,
          code: stringOrNull(item.code),
          container_id: stringOrNull(item.container_id),
          results: codeResults,
        });
      } else if (type === "computer_call" || type === "computer_use_preview") {
        const rawSafetyChecks = Array.isArray(item.pending_safety_checks) ? item.pending_safety_checks : [];
        result.computer_use_results.push({
          id: stringOrNull(item.id),
          status: stringOrNull(item.status),
          type,
          call_id: stringOrNull(item.call_id),
          action: readSdkObject(item.action),
          pending_safety_checks: rawSafetyChecks.map((rawCheck) => {
            const check = readObject(rawCheck);
            return {
              id: stringOrNull(check.id),
              code: stringOrNull(check.code),
              message: stringOrNull(check.message),
            };
          }),
        });
      } else if (type === "reasoning") {
        const rawSummary = Array.isArray(item.summary) ? item.summary : [];
        result.reasoning_summaries.push({
          id: stringOrNull(item.id),
          status: stringOrNull(item.status),
          type,
          summary: rawSummary.map((entry) => readObject(entry)),
          encrypted_content: stringOrNull(item.encrypted_content),
        });
      } else if (type === "function_call") {
        result.function_calls.push({
          id: item.call_id,
          name: item.name,
          arguments: item.arguments,
        });
      }
    }

    return result;
  }

  _extract_builtin_tool_outputs(response: unknown): ResponsesAPIResult {
    return this.extractBuiltinToolOutputs(response);
  }

  accumulateResponsesStreamEvents(events: readonly unknown[]): {
    text: string;
    response_id: string | null;
    function_calls: Record<string, unknown>[];
    usage: Record<string, number> | null;
    final_response: unknown;
    reasoning_items: unknown[];
  } {
    let text = "";
    let responseId: string | null = null;
    let finalResponse: unknown = null;
    let usage: Record<string, number> | null = null;
    let reasoningItems: unknown[] = [];
    const functionCalls: Record<string, unknown>[] = [];

    for (const rawEvent of events) {
      const event = readObject(rawEvent);
      const type = typeof event.type === "string" ? event.type : "";
      if (type === "response.created") {
        const createdResponse = readObject(event.response);
        responseId = stringOrNull(createdResponse.id);
      } else if (type === "response.output_text.delta") {
        text += typeof event.delta === "string" ? event.delta : "";
      } else if (type === "response.output_item.done") {
        const item = readObject(event.item);
        if (item.type === "function_call") {
          functionCalls.push({
            id: item.call_id,
            name: item.name,
            arguments: item.arguments,
          });
        }
      } else if (type === "response.completed") {
        finalResponse = event.response ?? null;
        const completedResponse = readObject(finalResponse);
        responseId = stringOrNull(completedResponse.id) ?? responseId;
        reasoningItems = this.extractReasoningItems(finalResponse);
        if (this.autoChain && responseId) {
          this.responseChainId = responseId;
        }
        if (this.autoChainReasoning && reasoningItems.length > 0) {
          this.reasoningChainItems = reasoningItems;
        }
        if (Object.keys(readObject(completedResponse.usage)).length > 0) {
          usage = this.extractResponsesTokenUsage(finalResponse);
          this.trackTokenUsageInternal(usage);
        }
      }
    }

    return {
      text,
      response_id: responseId,
      function_calls: functionCalls,
      usage,
      final_response: finalResponse,
      reasoning_items: reasoningItems,
    };
  }

  _accumulate_responses_stream_events(events: readonly unknown[]): {
    text: string;
    response_id: string | null;
    function_calls: Record<string, unknown>[];
    usage: Record<string, number> | null;
    final_response: unknown;
    reasoning_items: unknown[];
  } {
    return this.accumulateResponsesStreamEvents(events);
  }

  override supportsFunctionCalling(): boolean {
    return !this.isO1Model;
  }

  override supports_function_calling(): boolean {
    return this.supportsFunctionCalling();
  }

  override supportsStopWords(): boolean {
    const model = this.model.toLowerCase();
    if (model.includes("gpt-5")) {
      return false;
    }
    return !this.isO1Model;
  }

  override supports_stop_words(): boolean {
    return this.supportsStopWords();
  }

  override supportsMultimodal(): boolean {
    const model = this.model.toLowerCase();
    return ["gpt-4o", "gpt-4.1", "gpt-4-turbo", "gpt-4-vision", "gpt-5", "o1", "o3", "o4"]
      .some((prefix) => model.startsWith(prefix));
  }

  override supports_multimodal(): boolean {
    return this.supportsMultimodal();
  }

  override getFileUploader(): LocalFileUploader {
    return new LocalFileUploader("openai", { llm: this });
  }

  override get_file_uploader(): LocalFileUploader {
    return this.getFileUploader();
  }

  override getContextWindowSize(): number {
    return super.getContextWindowSize();
  }

  override get_context_window_size(): number {
    return this.getContextWindowSize();
  }

  override get lastResponseId(): string | null {
    return this.responseChainId;
  }

  override get last_response_id(): string | null {
    return this.lastResponseId;
  }

  override get lastReasoningItems(): readonly unknown[] {
    return [...this.reasoningChainItems];
  }

  override get last_reasoning_items(): readonly unknown[] {
    return this.lastReasoningItems;
  }

  override resetChain(): void {
    this.responseChainId = null;
  }

  override reset_chain(): void {
    this.resetChain();
  }

  override resetReasoningChain(): void {
    this.reasoningChainItems = [];
  }

  override reset_reasoning_chain(): void {
    this.resetReasoningChain();
  }

  override toConfigDict(): Record<string, unknown> {
    return super.toConfigDict();
  }

  override to_config_dict(): Record<string, unknown> {
    return this.toConfigDict();
  }
}

function openAIResponsesTextFormat(formatModel: unknown): unknown {
  const schemaProvider = formatModel as {
    name?: unknown;
    model_json_schema?: () => unknown;
    modelJsonSchema?: () => unknown;
    schema?: unknown;
  } | null;
  const schema = schemaProvider?.model_json_schema?.() ?? schemaProvider?.modelJsonSchema?.() ?? schemaProvider?.schema;
  if (schema && typeof schema === "object" && !Array.isArray(schema)) {
    const name = typeof schemaProvider?.name === "string"
      ? schemaProvider.name
      : typeof (schema as Record<string, unknown>).title === "string"
        ? String((schema as Record<string, unknown>).title)
        : "ResponseFormat";
    const description = generateModelDescription(name, schema as JsonSchema);
    return {
      type: "json_schema",
      name: description.json_schema.name,
      strict: description.json_schema.strict,
      schema: description.json_schema.schema,
    };
  }
  return formatModel;
}

export type ProviderConfigOptions = {
  base_url?: string;
  baseUrl?: string;
  api_key_env?: string;
  apiKeyEnv?: string;
  base_url_env?: string | null;
  baseUrlEnv?: string | null;
  default_headers?: Record<string, string>;
  defaultHeaders?: Record<string, string>;
  api_key_required?: boolean;
  apiKeyRequired?: boolean;
  default_api_key?: string | null;
  defaultApiKey?: string | null;
};

export class ProviderConfig {
  readonly base_url: string;
  readonly baseUrl: string;
  readonly api_key_env: string;
  readonly apiKeyEnv: string;
  readonly base_url_env: string | null;
  readonly baseUrlEnv: string | null;
  readonly default_headers: Record<string, string>;
  readonly defaultHeaders: Record<string, string>;
  readonly api_key_required: boolean;
  readonly apiKeyRequired: boolean;
  readonly default_api_key: string | null;
  readonly defaultApiKey: string | null;

  constructor(options: ProviderConfigOptions) {
    this.base_url = options.base_url ?? options.baseUrl ?? "";
    this.baseUrl = this.base_url;
    this.api_key_env = options.api_key_env ?? options.apiKeyEnv ?? "";
    this.apiKeyEnv = this.api_key_env;
    this.base_url_env = options.base_url_env ?? options.baseUrlEnv ?? null;
    this.baseUrlEnv = this.base_url_env;
    this.default_headers = { ...(options.default_headers ?? options.defaultHeaders ?? {}) };
    this.defaultHeaders = this.default_headers;
    this.api_key_required = options.api_key_required ?? options.apiKeyRequired ?? true;
    this.apiKeyRequired = this.api_key_required;
    this.default_api_key = options.default_api_key ?? options.defaultApiKey ?? null;
    this.defaultApiKey = this.default_api_key;
  }
}

export const OPENAI_COMPATIBLE_PROVIDERS: Readonly<Record<string, ProviderConfig>> = Object.freeze({
  openrouter: new ProviderConfig({
    base_url: "https://openrouter.ai/api/v1",
    api_key_env: "OPENROUTER_API_KEY",
    base_url_env: "OPENROUTER_BASE_URL",
    default_headers: { "HTTP-Referer": "https://crewai.com" },
  }),
  deepseek: new ProviderConfig({
    base_url: "https://api.deepseek.com/v1",
    api_key_env: "DEEPSEEK_API_KEY",
    base_url_env: "DEEPSEEK_BASE_URL",
  }),
  ollama: new ProviderConfig({
    base_url: "http://localhost:11434/v1",
    api_key_env: "OLLAMA_API_KEY",
    base_url_env: "OLLAMA_HOST",
    api_key_required: false,
    default_api_key: "ollama",
  }),
  ollama_chat: new ProviderConfig({
    base_url: "http://localhost:11434/v1",
    api_key_env: "OLLAMA_API_KEY",
    base_url_env: "OLLAMA_HOST",
    api_key_required: false,
    default_api_key: "ollama",
  }),
  hosted_vllm: new ProviderConfig({
    base_url: "http://localhost:8000/v1",
    api_key_env: "VLLM_API_KEY",
    base_url_env: "VLLM_BASE_URL",
    api_key_required: false,
    default_api_key: "dummy",
  }),
  cerebras: new ProviderConfig({
    base_url: "https://api.cerebras.ai/v1",
    api_key_env: "CEREBRAS_API_KEY",
    base_url_env: "CEREBRAS_BASE_URL",
  }),
  dashscope: new ProviderConfig({
    base_url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    api_key_env: "DASHSCOPE_API_KEY",
    base_url_env: "DASHSCOPE_BASE_URL",
  }),
});

export class OpenAICompatibleCompletion extends OpenAICompletion {
  constructor(options: OpenAICompletionOptions & { provider?: string | null } = { model: "gpt-4o-mini", provider: "openrouter" }) {
    const resolved = OpenAICompatibleCompletion._resolveProviderConfig(options);
    super({
      ...options,
      ...resolved,
    });
  }

  static _resolveProviderConfig<TOptions extends OpenAICompletionOptions & { provider?: string | null }>(data: TOptions): TOptions {
    const provider = data.provider ?? "";
    const config = OPENAI_COMPATIBLE_PROVIDERS[provider];
    if (!config) {
      throw new Error(`Unknown OpenAI-compatible provider: ${provider}. Supported providers: ${Object.keys(OPENAI_COMPATIBLE_PROVIDERS).sort().join(", ")}`);
    }
    return {
      ...data,
      provider,
      api_key: OpenAICompatibleCompletion.resolveApiKey(data.api_key ?? data.apiKey ?? null, config, provider),
      base_url: OpenAICompatibleCompletion.resolveBaseUrl(data.base_url ?? data.baseUrl ?? null, config, provider),
      default_headers: OpenAICompatibleCompletion.resolveHeaders(data.default_headers ?? data.defaultHeaders ?? null, config),
    };
  }

  static _resolve_provider_config<TOptions extends OpenAICompletionOptions & { provider?: string | null }>(data: TOptions): TOptions {
    return OpenAICompatibleCompletion._resolveProviderConfig(data);
  }

  override supports_function_calling(): boolean {
    return super.supports_function_calling();
  }

  static resolveApiKey(apiKey: string | null, config: ProviderConfig, provider: string): string | null {
    if (apiKey) {
      return apiKey;
    }
    const envKey = process.env[config.api_key_env];
    if (envKey) {
      return envKey;
    }
    if (config.api_key_required) {
      throw new Error(`API key required for ${provider}. Set ${config.api_key_env} environment variable or pass api_key parameter.`);
    }
    return config.default_api_key;
  }

  static _resolve_api_key(apiKey: string | null, config: ProviderConfig, provider: string): string | null {
    return OpenAICompatibleCompletion.resolveApiKey(apiKey, config, provider);
  }

  static resolveBaseUrl(baseUrl: string | null, config: ProviderConfig, provider: string): string {
    const envValue = config.base_url_env ? process.env[config.base_url_env] : undefined;
    const resolved = baseUrl || envValue || config.base_url;
    return normalizeOpenAICompatibleBaseUrl(resolved, provider);
  }

  static _resolve_base_url(baseUrl: string | null, config: ProviderConfig, provider: string): string {
    return OpenAICompatibleCompletion.resolveBaseUrl(baseUrl, config, provider);
  }

  static resolveHeaders(headers: Record<string, string> | null, config: ProviderConfig): Record<string, string> | null {
    const hasDefaultHeaders = Object.keys(config.default_headers).length > 0;
    if (!hasDefaultHeaders && !headers) {
      return null;
    }
    const merged = {
      ...config.default_headers,
      ...(headers ?? {}),
    };
    return Object.keys(merged).length > 0 ? merged : null;
  }

  static _resolve_headers(headers: Record<string, string> | null, config: ProviderConfig): Record<string, string> | null {
    return OpenAICompatibleCompletion.resolveHeaders(headers, config);
  }
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

function stripCrewAISpecificParams(params: Record<string, unknown>): Record<string, unknown> {
  const blocked = new Set([
    "callbacks",
    "available_functions",
    "from_task",
    "from_agent",
    "provider",
    "api_key",
    "base_url",
    "api_base",
    "timeout",
  ]);
  return Object.fromEntries(Object.entries(params).filter(([key]) => !blocked.has(key)));
}

function normalizeOpenAICompatibleBaseUrl(baseUrl: string, provider: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if ((provider === "ollama" || provider === "ollama_chat") && !trimmed.endsWith("/v1")) {
    return `${trimmed}/v1`;
  }
  return trimmed;
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readSdkObject(value: unknown): Record<string, unknown> {
  const record = readObject(value);
  const dump = record.model_dump ?? record.modelDump ?? record.toJSON;
  if (typeof dump === "function") {
    return readObject(dump.call(value));
  }
  return record;
}

function numberField(record: Record<string, unknown>, key: string): number {
  return typeof record[key] === "number" ? record[key] : 0;
}

function hasNumericField(record: Record<string, unknown>, ...keys: string[]): boolean {
  return keys.some((key) => typeof record[key] === "number");
}

function responseOutput(response: unknown): unknown[] {
  const output = readObject(response).output;
  return Array.isArray(output) ? output : [];
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readStringNumberBooleanRecord(value: unknown): Record<string, string | number | boolean> | null {
  const record = readObject(value);
  if (Object.keys(record).length === 0) {
    return null;
  }
  return Object.fromEntries(
    Object.entries(record).filter(([, entry]) => (
      typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean"
    )),
  ) as Record<string, string | number | boolean>;
}
