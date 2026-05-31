import { ConfiguredLLM, CONTEXT_WINDOW_USAGE_RATIO, LocalFileUploader, type BaseLLMOptions, type LLMCallOptions, type LLMResponse } from "./llm.js";
import { convertToolsToOpenAISchema } from "./agent-utils.js";
import type { LLMMessage, Tool } from "./types.js";

export const TOOL_SEARCH_TOOL_TYPES = Object.freeze([
  "tool_search_tool_regex_20251119",
  "tool_search_tool_bm25_20251119",
] as const);
export const ANTHROPIC_FILES_API_BETA = "files-api-2025-04-14";
export const ANTHROPIC_STRUCTURED_OUTPUTS_BETA = "structured-outputs-2025-11-13";
export const NATIVE_STRUCTURED_OUTPUT_MODELS = Object.freeze([
  "claude-sonnet-4-5",
  "claude-sonnet-4.5",
  "claude-opus-4-5",
  "claude-opus-4.5",
  "claude-opus-4-1",
  "claude-opus-4.1",
  "claude-haiku-4-5",
  "claude-haiku-4.5",
] as const);

export type AnthropicThinkingConfigOptions = {
  type: "enabled" | "disabled";
  budget_tokens?: number | null;
  budgetTokens?: number | null;
};

export class AnthropicThinkingConfig {
  readonly type: "enabled" | "disabled";
  readonly budget_tokens: number | null;
  readonly budgetTokens: number | null;

  constructor(options: AnthropicThinkingConfigOptions) {
    this.type = options.type;
    this.budget_tokens = options.budget_tokens ?? options.budgetTokens ?? null;
    this.budgetTokens = this.budget_tokens;
  }
}

export type AnthropicToolSearchConfigOptions = {
  type?: "regex" | "bm25";
};

export class AnthropicToolSearchConfig {
  readonly type: "regex" | "bm25";

  constructor(options: AnthropicToolSearchConfigOptions = {}) {
    this.type = options.type ?? "bm25";
  }
}

export type AnthropicCompletionOptions = BaseLLMOptions & {
  timeout?: number | null;
  max_retries?: number;
  maxRetries?: number;
  max_tokens?: number;
  maxTokens?: number;
  top_p?: number | null;
  topP?: number | null;
  stream?: boolean;
  client_params?: Record<string, unknown> | null;
  clientParams?: Record<string, unknown> | null;
  interceptor?: unknown;
  thinking?: AnthropicThinkingConfig | AnthropicThinkingConfigOptions | null;
  tool_search?: AnthropicToolSearchConfig | AnthropicToolSearchConfigOptions | boolean | null;
  toolSearch?: AnthropicToolSearchConfig | AnthropicToolSearchConfigOptions | boolean | null;
};

export class AnthropicCompletion extends ConfiguredLLM {
  readonly timeout: number | null;
  readonly maxRetries: number;
  readonly max_retries: number;
  readonly maxTokens: number;
  readonly max_tokens: number;
  readonly topP: number | null;
  readonly top_p: number | null;
  readonly stream: boolean;
  readonly clientParams: Record<string, unknown> | null;
  readonly client_params: Record<string, unknown> | null;
  readonly interceptor: unknown;
  readonly thinking: AnthropicThinkingConfig | null;
  readonly toolSearch: AnthropicToolSearchConfig | null;
  readonly tool_search: AnthropicToolSearchConfig | null;
  readonly isClaude3: boolean;
  readonly is_claude_3: boolean;
  readonly supportsTools: boolean;
  readonly supports_tools: boolean;

  constructor(options: AnthropicCompletionOptions = { model: "claude-3-5-sonnet-20241022" }) {
    const model = options.model;
    super(stripUndefined({
      model,
      provider: options.provider ?? "anthropic",
      temperature: options.temperature,
      apiKey: options.apiKey,
      api_key: options.api_key,
      baseUrl: options.baseUrl,
      base_url: options.base_url,
      stop: options.stop,
      stopSequences: options.stopSequences,
      stop_sequences: options.stop_sequences,
      maxTokens: options.maxTokens ?? options.max_tokens ?? 4096,
      timeout: options.timeout ?? null,
    }) as BaseLLMOptions & { maxTokens?: number | null; timeout?: number | null });
    this.timeout = options.timeout ?? null;
    this.maxRetries = options.maxRetries ?? options.max_retries ?? 2;
    this.max_retries = this.maxRetries;
    this.maxTokens = options.maxTokens ?? options.max_tokens ?? 4096;
    this.max_tokens = this.maxTokens;
    this.topP = options.topP ?? options.top_p ?? null;
    this.top_p = this.topP;
    this.stream = options.stream ?? false;
    this.clientParams = options.clientParams ?? options.client_params ?? null;
    this.client_params = this.clientParams;
    this.interceptor = options.interceptor ?? null;
    this.thinking = normalizeThinking(options.thinking);
    this.toolSearch = normalizeToolSearch(options.toolSearch ?? options.tool_search ?? null);
    this.tool_search = this.toolSearch;
    this.isClaude3 = model.toLowerCase().includes("claude-3");
    this.is_claude_3 = this.isClaude3;
    this.supportsTools = true;
    this.supports_tools = true;
  }

  override call(messages: readonly LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse> {
    return super.call(messages, options);
  }

  prepareCompletionParams(
    messages: readonly LLMMessage[],
    systemMessage: string | readonly Record<string, unknown>[] | null = null,
    tools: readonly Tool[] | null = null,
    availableFunctions: Record<string, unknown> | null = null,
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {
      model: this.model,
      messages: [...messages],
      max_tokens: this.maxTokens,
      stream: this.stream,
    };
    if (systemMessage) {
      params.system = systemMessage;
    }
    if (this.temperature !== null) {
      params.temperature = this.temperature;
    }
    if (this.topP !== null) {
      params.top_p = this.topP;
    }
    if (this.stop.length > 0) {
      params.stop_sequences = [...this.stop];
    }
    if (tools && tools.length > 0 && this.supportsTools) {
      let convertedTools = this.convertToolsForInterference(tools);
      const regularTools = convertedTools.filter((tool) => !TOOL_SEARCH_TOOL_TYPES.includes(String(tool.type) as (typeof TOOL_SEARCH_TOOL_TYPES)[number]));
      if (this.toolSearch && regularTools.length >= 2) {
        convertedTools = this.applyToolSearch(convertedTools);
      }
      params.tools = convertedTools;
      if (availableFunctions && regularTools.length === 1) {
        const toolName = regularTools[0]?.name;
        if (typeof toolName === "string" && toolName in availableFunctions) {
          params.tool_choice = { type: "tool", name: toolName };
        }
      }
    }
    if (this.thinking) {
      params.thinking = {
        type: this.thinking.type,
        ...(this.thinking.budget_tokens === null ? {} : { budget_tokens: this.thinking.budget_tokens }),
      };
    }
    return params;
  }

  _prepare_completion_params(
    messages: readonly LLMMessage[],
    systemMessage: string | readonly Record<string, unknown>[] | null = null,
    tools: readonly Tool[] | null = null,
    availableFunctions: Record<string, unknown> | null = null,
  ): Record<string, unknown> {
    return this.prepareCompletionParams(messages, systemMessage, tools, availableFunctions);
  }

  convertToolsForInterference(tools: readonly Tool[]): Record<string, unknown>[] {
    const [schemas] = convertToolsToOpenAISchema(tools);
    return schemas.map((tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters,
      strict: true,
    }));
  }

  _convert_tools_for_interference(tools: readonly Tool[]): Record<string, unknown>[] {
    return this.convertToolsForInterference(tools);
  }

  applyToolSearch(tools: readonly Record<string, unknown>[]): Record<string, unknown>[] {
    if (!this.toolSearch) {
      return [...tools];
    }
    const result: Record<string, unknown>[] = [];
    const hasSearchTool = tools.some((tool) => TOOL_SEARCH_TOOL_TYPES.includes(String(tool.type) as (typeof TOOL_SEARCH_TOOL_TYPES)[number]));
    if (!hasSearchTool) {
      const type = this.toolSearch.type === "regex"
        ? "tool_search_tool_regex_20251119"
        : "tool_search_tool_bm25_20251119";
      result.push({ type, name: `tool_search_tool_${this.toolSearch.type}` });
    }
    for (const tool of tools) {
      if (TOOL_SEARCH_TOOL_TYPES.includes(String(tool.type) as (typeof TOOL_SEARCH_TOOL_TYPES)[number])) {
        result.push({ ...tool });
      } else {
        result.push("defer_loading" in tool ? { ...tool } : { ...tool, defer_loading: true });
      }
    }
    return result;
  }

  _apply_tool_search(tools: readonly Record<string, unknown>[]): Record<string, unknown>[] {
    return this.applyToolSearch(tools);
  }

  extractAnthropicTokenUsage(response: unknown): Record<string, number> {
    return AnthropicCompletion.extractAnthropicTokenUsage(response);
  }

  _extract_anthropic_token_usage(response: unknown): Record<string, number> {
    return this.extractAnthropicTokenUsage(response);
  }

  static extractAnthropicTokenUsage(response: unknown): Record<string, number> {
    const usage = readObject(readObject(response).usage);
    if (Object.keys(usage).length === 0) {
      return { total_tokens: 0 };
    }
    const inputTokens = numberField(usage, "input_tokens");
    const outputTokens = numberField(usage, "output_tokens");
    return {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
      cached_prompt_tokens: numberField(usage, "cache_read_input_tokens"),
      cache_creation_tokens: numberField(usage, "cache_creation_input_tokens"),
    };
  }

  static _extract_anthropic_token_usage(response: unknown): Record<string, number> {
    return AnthropicCompletion.extractAnthropicTokenUsage(response);
  }

  override supportsFunctionCalling(): boolean {
    return true;
  }

  override supportsStopWords(): boolean {
    return false;
  }

  override supportsMultimodal(): boolean {
    const model = this.model.toLowerCase();
    return ["claude-3", "claude-sonnet-4", "claude-opus-4", "claude-haiku-4"]
      .some((prefix) => model.startsWith(prefix));
  }

  override getFileUploader(): LocalFileUploader {
    return new LocalFileUploader("anthropic", { llm: this });
  }
}

export const STRUCTURED_OUTPUT_TOOL_NAME = "structured_output";
export const ToolInputSchema = Object.freeze({ kind: "ToolInputSchema" });
export const ToolSpec = Object.freeze({ kind: "ToolSpec" });
export const ConverseToolTypeDef = Object.freeze({ kind: "ConverseToolTypeDef" });
export const BedrockConverseRequestBody = Object.freeze({ kind: "BedrockConverseRequestBody" });
export const BedrockConverseStreamRequestBody = Object.freeze({ kind: "BedrockConverseStreamRequestBody" });

export type BedrockCompletionOptions = BaseLLMOptions & {
  region_name?: string | null;
  regionName?: string | null;
  session?: unknown;
  timeout?: number | null;
  max_retries?: number;
  maxRetries?: number;
  max_tokens?: number | null;
  maxTokens?: number | null;
  top_p?: number | null;
  topP?: number | null;
  top_k?: number | null;
  topK?: number | null;
  stream?: boolean;
  guardrail_config?: Record<string, unknown> | null;
  guardrailConfig?: Record<string, unknown> | null;
  additional_model_request_fields?: Record<string, unknown> | null;
  additionalModelRequestFields?: Record<string, unknown> | null;
  additional_model_response_field_paths?: string[] | null;
  additionalModelResponseFieldPaths?: string[] | null;
  interceptor?: unknown;
};

export class BedrockCompletion extends ConfiguredLLM {
  readonly regionName: string | null;
  readonly region_name: string | null;
  readonly session: unknown;
  readonly timeout: number | null;
  readonly maxRetries: number;
  readonly max_retries: number;
  readonly maxTokens: number | null;
  readonly max_tokens: number | null;
  readonly topP: number | null;
  readonly top_p: number | null;
  readonly topK: number | null;
  readonly top_k: number | null;
  readonly stream: boolean;
  readonly guardrailConfig: Record<string, unknown> | null;
  readonly guardrail_config: Record<string, unknown> | null;
  readonly additionalModelRequestFields: Record<string, unknown> | null;
  readonly additional_model_request_fields: Record<string, unknown> | null;
  readonly additionalModelResponseFieldPaths: string[] | null;
  readonly additional_model_response_field_paths: string[] | null;
  readonly interceptor: unknown;

  constructor(options: BedrockCompletionOptions = { model: "anthropic.claude-3-5-sonnet-20241022-v2:0" }) {
    const model = options.model;
    super(stripUndefined({
      model,
      provider: options.provider ?? "bedrock",
      temperature: options.temperature,
      apiKey: options.apiKey,
      api_key: options.api_key,
      baseUrl: options.baseUrl,
      base_url: options.base_url,
      stop: options.stop,
      stopSequences: options.stopSequences,
      stop_sequences: options.stop_sequences,
      additionalParams: options.additionalParams,
      additional_params: options.additional_params,
      maxTokens: options.maxTokens ?? options.max_tokens ?? null,
      timeout: options.timeout ?? null,
    }) as BaseLLMOptions & { maxTokens?: number | null; timeout?: number | null });
    this.regionName = options.regionName ?? options.region_name ?? null;
    this.region_name = this.regionName;
    this.session = options.session ?? null;
    this.timeout = options.timeout ?? null;
    this.maxRetries = options.maxRetries ?? options.max_retries ?? 2;
    this.max_retries = this.maxRetries;
    this.maxTokens = options.maxTokens ?? options.max_tokens ?? null;
    this.max_tokens = this.maxTokens;
    this.topP = options.topP ?? options.top_p ?? null;
    this.top_p = this.topP;
    this.topK = options.topK ?? options.top_k ?? null;
    this.top_k = this.topK;
    this.stream = options.stream ?? false;
    this.guardrailConfig = options.guardrailConfig ?? options.guardrail_config ?? null;
    this.guardrail_config = this.guardrailConfig;
    this.additionalModelRequestFields = options.additionalModelRequestFields ?? options.additional_model_request_fields ?? null;
    this.additional_model_request_fields = this.additionalModelRequestFields;
    this.additionalModelResponseFieldPaths = options.additionalModelResponseFieldPaths ?? options.additional_model_response_field_paths ?? null;
    this.additional_model_response_field_paths = this.additionalModelResponseFieldPaths;
    this.interceptor = options.interceptor ?? null;
  }

  override call(messages: readonly LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse> {
    return super.call(messages, options);
  }

  formatMessagesForConverse(messages: string | readonly (Partial<LLMMessage> & Record<string, unknown>)[]): {
    messages: Record<string, unknown>[];
    systemMessage: string | null;
    system_message: string | null;
  } {
    const formattedMessages = this._format_messages(messages);
    const converseMessages: Record<string, unknown>[] = [];
    let systemMessage: string | null = null;
    let pendingToolResults: Record<string, unknown>[] = [];

    for (const message of formattedMessages) {
      const rawMessage = message as LLMMessage & Record<string, unknown>;
      const role = rawMessage.role;
      const content = rawMessage.content;
      const toolCalls = rawMessage.tool_calls;
      const toolCallId = rawMessage.tool_call_id;

      if (role === "system") {
        systemMessage = systemMessage ? `${systemMessage}\n\n${content}` : content;
        continue;
      }

      if (role === "tool") {
        const toolUseId = scalarToString(toolCallId);
        if (!toolUseId) {
          throw new Error("Tool message missing required tool_call_id");
        }
        pendingToolResults.push({
          toolResult: {
            toolUseId,
            content: [{ text: content || "" }],
          },
        });
        continue;
      }

      if (pendingToolResults.length > 0) {
        converseMessages.push({ role: "user", content: pendingToolResults });
        pendingToolResults = [];
      }

      if (role === "assistant" && Array.isArray(toolCalls)) {
        const bedrockContent = toolCalls.map((toolCall) => {
          const toolCallRecord = typeof toolCall === "object" && toolCall ? toolCall as Record<string, unknown> : {};
          const functionCall = toolCallRecord.function;
          const functionRecord = typeof functionCall === "object" && functionCall ? functionCall as Record<string, unknown> : {};
          const rawArguments = functionRecord.arguments;
          const input = typeof rawArguments === "string" ? JSON.parse(rawArguments || "{}") as Record<string, unknown> : rawArguments ?? {};
          const fallbackToolUseId = `call_${converseMessages.length.toString()}`;
          return {
            toolUse: {
              toolUseId: scalarToString(toolCallRecord.id) ?? fallbackToolUseId,
              name: scalarToString(functionRecord.name) ?? "",
              input,
            },
          };
        });
        converseMessages.push({ role: "assistant", content: bedrockContent });
        continue;
      }

      converseMessages.push({
        role,
        content: Array.isArray(content) ? content : [{ text: content || "" }],
      });
    }

    if (pendingToolResults.length > 0) {
      converseMessages.push({ role: "user", content: pendingToolResults });
    }

    const lastMessage = converseMessages.at(-1);
    if (lastMessage?.role === "assistant" && (
      this.model.toLowerCase().includes("cohere")
        || this.model.toLowerCase().includes("command")
        || this.model.toLowerCase().includes("coral")
        || this.isClaudeModel()
    )) {
      converseMessages.push({
        role: "user",
        content: [{ text: this.isClaudeModel() || this.model.toLowerCase().includes("cohere") ? "Please continue and provide your final answer." : "Continue your response." }],
      });
    }

    if (converseMessages.length === 0) {
      converseMessages.push({ role: "user", content: [{ text: "Hello, please help me with my request." }] });
    } else if (converseMessages[0]?.role !== "user") {
      converseMessages.unshift({ role: "user", content: [{ text: "Hello, please help me with my request." }] });
    }

    return { messages: converseMessages, systemMessage, system_message: systemMessage };
  }

  _format_messages_for_converse(messages: string | readonly (Partial<LLMMessage> & Record<string, unknown>)[]): [Record<string, unknown>[], string | null] {
    const prepared = this.formatMessagesForConverse(messages);
    return [prepared.messages, prepared.systemMessage];
  }

  getInferenceConfig(): Record<string, unknown> {
    const config: Record<string, unknown> = {};
    if (this.maxTokens !== null) {
      config.maxTokens = this.maxTokens;
    }
    if (this.temperature !== null) {
      config.temperature = this.temperature;
    }
    if (this.topP !== null) {
      config.topP = this.topP;
    }
    if (this.stopSequences.length > 0) {
      config.stopSequences = [...this.stopSequences];
    }
    if (this.isClaudeModel() && this.topK !== null) {
      config.topK = this.topK;
    }
    return config;
  }

  _get_inference_config(): Record<string, unknown> {
    return this.getInferenceConfig();
  }

  formatToolsForConverse(tools: readonly Tool[]): Record<string, unknown>[] {
    return convertToolsToOpenAISchema(tools)[0].map((tool) => ({
      toolSpec: {
        name: tool.function.name,
        description: tool.function.description,
        inputSchema: { json: tool.function.parameters },
      },
    }));
  }

  _format_tools_for_converse(tools: readonly Tool[]): Record<string, unknown>[] {
    return this.formatToolsForConverse(tools);
  }

  messagesContainToolContent(messages: readonly Record<string, unknown>[]): boolean {
    return messages.some((message) => Array.isArray(message.content) && message.content.some((block) => (
      typeof block === "object" && block !== null && ("toolUse" in block || "toolResult" in block)
    )));
  }

  _messages_contain_tool_content(messages: readonly Record<string, unknown>[]): boolean {
    return this.messagesContainToolContent(messages);
  }

  extractToolsFromMessageHistory(messages: readonly Record<string, unknown>[]): Record<string, unknown>[] {
    const tools: Record<string, unknown>[] = [];
    const seenNames = new Set<string>();
    for (const message of messages) {
      if (!Array.isArray(message.content)) {
        continue;
      }
      for (const block of message.content) {
        if (typeof block !== "object" || block === null || !("toolUse" in block)) {
          continue;
        }
        const toolUse = (block as Record<string, unknown>).toolUse;
        if (typeof toolUse !== "object" || toolUse === null) {
          continue;
        }
        const name = scalarToString((toolUse as Record<string, unknown>).name) ?? "";
        if (!name || seenNames.has(name)) {
          continue;
        }
        seenNames.add(name);
        tools.push({
          toolSpec: {
            name,
            description: `Tool: ${name}`,
            inputSchema: { json: { type: "object", properties: {} } },
          },
        });
      }
    }
    return tools;
  }

  _extract_tools_from_message_history(messages: readonly Record<string, unknown>[]): Record<string, unknown>[] {
    return this.extractToolsFromMessageHistory(messages);
  }

  prepareConverseRequestBody(messages: string | readonly (Partial<LLMMessage> & Record<string, unknown>)[], tools: readonly Tool[] | null = null): {
    messages: Record<string, unknown>[];
    body: Record<string, unknown>;
    systemMessage: string | null;
    system_message: string | null;
  } {
    const { messages: formattedMessages, systemMessage } = this.formatMessagesForConverse(messages);
    const body: Record<string, unknown> = { inferenceConfig: this.getInferenceConfig() };

    if (systemMessage) {
      body.system = [{ text: systemMessage }];
    }

    if (tools && tools.length > 0) {
      body.toolConfig = { tools: this.formatToolsForConverse(tools) };
    } else if (this.messagesContainToolContent(formattedMessages)) {
      const historyTools = this.extractToolsFromMessageHistory(formattedMessages);
      if (historyTools.length > 0) {
        body.toolConfig = { tools: historyTools };
      }
    }

    if (this.guardrailConfig) {
      body.guardrailConfig = this.guardrailConfig;
    }
    if (this.additionalModelRequestFields) {
      body.additionalModelRequestFields = this.additionalModelRequestFields;
    }
    if (this.additionalModelResponseFieldPaths) {
      body.additionalModelResponseFieldPaths = this.additionalModelResponseFieldPaths;
    }

    return { messages: formattedMessages, body, systemMessage, system_message: systemMessage };
  }

  _prepare_converse_request_body(messages: string | readonly (Partial<LLMMessage> & Record<string, unknown>)[], tools: readonly Tool[] | null = null): {
    messages: Record<string, unknown>[];
    body: Record<string, unknown>;
    systemMessage: string | null;
    system_message: string | null;
  } {
    return this.prepareConverseRequestBody(messages, tools);
  }

  prepareConverseStreamRequestBody(messages: string | readonly (Partial<LLMMessage> & Record<string, unknown>)[], tools: readonly Tool[] | null = null): {
    messages: Record<string, unknown>[];
    body: Record<string, unknown>;
    systemMessage: string | null;
    system_message: string | null;
  } {
    return this.prepareConverseRequestBody(messages, tools);
  }

  _prepare_converse_stream_request_body(messages: string | readonly (Partial<LLMMessage> & Record<string, unknown>)[], tools: readonly Tool[] | null = null): {
    messages: Record<string, unknown>[];
    body: Record<string, unknown>;
    systemMessage: string | null;
    system_message: string | null;
  } {
    return this.prepareConverseStreamRequestBody(messages, tools);
  }

  extractBedrockTokenUsage(usage: unknown): Record<string, number> {
    return BedrockCompletion.extractBedrockTokenUsage(usage);
  }

  _extract_bedrock_token_usage(usage: unknown): Record<string, number> {
    return this.extractBedrockTokenUsage(usage);
  }

  static extractBedrockTokenUsage(usage: unknown): Record<string, number> {
    const record = readObject(usage);
    const inputTokens = numberField(record, "inputTokens");
    const outputTokens = numberField(record, "outputTokens");
    const explicitTotal = numberField(record, "totalTokens");
    const cachedTokens = numberField(record, "cacheReadInputTokenCount") || numberField(record, "cacheReadInputTokens");
    return {
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      total_tokens: explicitTotal || inputTokens + outputTokens,
      cached_prompt_tokens: cachedTokens,
    };
  }

  static extract_bedrock_token_usage(usage: unknown): Record<string, number> {
    return BedrockCompletion.extractBedrockTokenUsage(usage);
  }

  override trackTokenUsageInternal(usageData: Record<string, unknown>): void {
    super.trackTokenUsageInternal(BedrockCompletion.extractBedrockTokenUsage(usageData));
  }

  override _track_token_usage_internal(usageData: Record<string, unknown>): void {
    this.trackTokenUsageInternal(usageData);
  }

  private isClaudeModel(): boolean {
    const model = this.model.toLowerCase();
    return model.includes("anthropic") || model.includes("claude");
  }

  override supportsFunctionCalling(): boolean {
    return true;
  }

  override supportsStopWords(): boolean {
    return true;
  }

  override getFileUploader(): LocalFileUploader {
    return new LocalFileUploader("bedrock", { llm: this, region_name: this.regionName });
  }
}

export type GeminiCompletionOptions = BaseLLMOptions & {
  project?: string | null;
  location?: string | null;
  use_vertexai?: boolean;
  useVertexai?: boolean;
  timeout?: number | null;
  max_retries?: number;
  maxRetries?: number;
  top_p?: number | null;
  topP?: number | null;
  top_k?: number | null;
  topK?: number | null;
  max_output_tokens?: number | null;
  maxOutputTokens?: number | null;
  safety_settings?: readonly unknown[] | null;
  safetySettings?: readonly unknown[] | null;
  thinking_config?: unknown;
  thinkingConfig?: unknown;
  stream?: boolean;
  client_params?: Record<string, unknown> | null;
  clientParams?: Record<string, unknown> | null;
  interceptor?: unknown;
};

export class GeminiCompletion extends ConfiguredLLM {
  readonly project: string | null;
  readonly location: string;
  readonly useVertexai: boolean;
  readonly use_vertexai: boolean;
  readonly timeout: number | null;
  readonly maxRetries: number;
  readonly max_retries: number;
  readonly topP: number | null;
  readonly top_p: number | null;
  readonly topK: number | null;
  readonly top_k: number | null;
  readonly maxOutputTokens: number | null;
  readonly max_output_tokens: number | null;
  readonly safetySettings: readonly unknown[] | null;
  readonly safety_settings: readonly unknown[] | null;
  readonly thinkingConfig: unknown;
  readonly thinking_config: unknown;
  readonly stream: boolean;
  readonly clientParams: Record<string, unknown> | null;
  readonly client_params: Record<string, unknown> | null;
  readonly interceptor: unknown;
  readonly supportsTools: boolean;
  readonly supports_tools: boolean;
  readonly isGemini20: boolean;
  readonly is_gemini_2_0: boolean;
  tools: readonly Tool[] | null;

  constructor(options: GeminiCompletionOptions = { model: "gemini-2.5-flash" }) {
    const model = options.model;
    super(stripUndefined({
      model,
      provider: options.provider ?? "gemini",
      temperature: options.temperature,
      apiKey: options.apiKey,
      api_key: options.api_key ?? process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? null,
      baseUrl: options.baseUrl,
      base_url: options.base_url,
      stop: options.stop,
      stopSequences: options.stopSequences,
      stop_sequences: options.stop_sequences,
      timeout: options.timeout ?? null,
    }) as BaseLLMOptions & { timeout?: number | null });
    this.project = options.project ?? process.env.GOOGLE_CLOUD_PROJECT ?? null;
    this.location = options.location ?? "us-central1";
    this.useVertexai = options.useVertexai ?? options.use_vertexai ?? false;
    this.use_vertexai = this.useVertexai;
    this.timeout = options.timeout ?? null;
    this.maxRetries = options.maxRetries ?? options.max_retries ?? 2;
    this.max_retries = this.maxRetries;
    this.topP = options.topP ?? options.top_p ?? null;
    this.top_p = this.topP;
    this.topK = options.topK ?? options.top_k ?? null;
    this.top_k = this.topK;
    this.maxOutputTokens = options.maxOutputTokens ?? options.max_output_tokens ?? null;
    this.max_output_tokens = this.maxOutputTokens;
    this.safetySettings = options.safetySettings ?? options.safety_settings ?? null;
    this.safety_settings = this.safetySettings;
    this.thinkingConfig = options.thinkingConfig ?? options.thinking_config ?? (geminiVersion(model) >= 2.5 ? { include_thoughts: true } : null);
    this.thinking_config = this.thinkingConfig;
    this.stream = options.stream ?? false;
    this.clientParams = options.clientParams ?? options.client_params ?? null;
    this.client_params = this.clientParams;
    this.interceptor = options.interceptor ?? null;
    this.supportsTools = geminiVersion(model) >= 1.5;
    this.supports_tools = this.supportsTools;
    this.isGemini20 = geminiVersion(model) >= 2.0;
    this.is_gemini_2_0 = this.isGemini20;
    this.tools = null;
  }

  override call(messages: readonly LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse> {
    return super.call(messages, options);
  }

  override supportsFunctionCalling(): boolean {
    return true;
  }

  override supportsStopWords(): boolean {
    return true;
  }

  override supportsMultimodal(): boolean {
    return true;
  }

  override getContextWindowSize(): number {
    return geminiContextWindowSize(this.model);
  }

  override formatTextContent(text: string): { text: string } {
    return { text };
  }

  override getFileUploader(): LocalFileUploader {
    return new LocalFileUploader("gemini", { llm: this, project: this.project, location: this.location });
  }

  prepareGenerationConfig(
    systemInstruction: string | null = null,
    tools: readonly Tool[] | null = null,
    responseModel: unknown = null,
  ): Record<string, unknown> {
    this.tools = tools;
    const config: Record<string, unknown> = {};

    if (systemInstruction) {
      config.system_instruction = { role: "user", parts: [{ text: systemInstruction }] };
    }
    if (this.temperature !== null) {
      config.temperature = this.temperature;
    }
    if (this.topP !== null) {
      config.top_p = this.topP;
    }
    if (this.topK !== null) {
      config.top_k = this.topK;
    }
    if (this.maxOutputTokens !== null) {
      config.max_output_tokens = this.maxOutputTokens;
    }
    if (this.stopSequences.length > 0) {
      config.stop_sequences = [...this.stopSequences];
    }

    if (tools && tools.length > 0 && this.supportsTools) {
      const geminiTools = this.convertToolsForInterference(tools);
      const schema = geminiResponseSchema(responseModel);
      if (schema) {
        geminiTools.push({
          functionDeclarations: [{
            name: STRUCTURED_OUTPUT_TOOL_NAME,
            description: "Use this tool to provide your final structured response. Call this tool when you have gathered all necessary information and are ready to provide the final answer in the required format.",
            parametersJsonSchema: this.isGemini20 ? GeminiCompletion.addPropertyOrdering(structuredClone(schema)) : schema,
          }],
        });
      }
      config.tools = geminiTools;
    } else {
      const schema = geminiResponseSchema(responseModel);
      if (schema) {
        config.response_mime_type = "application/json";
        if (this.isGemini20) {
          config.response_json_schema = GeminiCompletion.addPropertyOrdering(structuredClone(schema));
        } else {
          config.response_schema = responseModel;
        }
      }
    }

    if (this.safetySettings) {
      config.safety_settings = this.safetySettings;
    }
    if (this.thinkingConfig !== null && this.thinkingConfig !== undefined) {
      config.thinking_config = this.thinkingConfig;
    }

    return config;
  }

  _prepare_generation_config(
    systemInstruction: string | null = null,
    tools: readonly Tool[] | null = null,
    responseModel: unknown = null,
  ): Record<string, unknown> {
    return this.prepareGenerationConfig(systemInstruction, tools, responseModel);
  }

  convertToolsForInterference(tools: readonly Tool[]): Record<string, unknown>[] {
    return convertToolsToOpenAISchema(tools)[0].map((tool) => ({
      functionDeclarations: [{
        name: tool.function.name,
        description: tool.function.description,
        parametersJsonSchema: tool.function.parameters,
      }],
    }));
  }

  _convert_tools_for_interference(tools: readonly Tool[]): Record<string, unknown>[] {
    return this.convertToolsForInterference(tools);
  }

  formatMessagesForGemini(messages: string | readonly (Partial<LLMMessage> & Record<string, unknown>)[]): [Record<string, unknown>[], string | null] {
    const baseFormatted = this._format_messages(messages);
    const contents: Record<string, unknown>[] = [];
    let systemInstruction: string | null = null;

    for (const message of baseFormatted) {
      const rawMessage = message as LLMMessage & Record<string, unknown>;
      const role = rawMessage.role;
      const content = rawMessage.content;
      const parts = geminiTextParts(content);
      const textContent = parts
        .map((part) => readObject(part).text)
        .filter((text): text is string => typeof text === "string")
        .join(" ");

      if (role === "system") {
        systemInstruction = systemInstruction ? `${systemInstruction}\n\n${textContent}` : textContent;
        continue;
      }

      if (role === "tool") {
        const toolName = scalarToString(rawMessage.name) ?? "";
        const response = parseGeminiToolResponse(textContent);
        const functionResponsePart = { functionResponse: { name: toolName, response } };
        const previous = contents.at(-1);
        if (previous?.role === "user" && Array.isArray(previous.parts)) {
          const previousParts = previous.parts;
          const lastPart = readObject(previousParts.at(-1));
          if ("functionResponse" in lastPart) {
            previousParts.push(functionResponsePart);
            continue;
          }
        }
        contents.push({ role: "user", parts: [functionResponsePart] });
        continue;
      }

      if (role === "assistant" && Array.isArray(rawMessage.tool_calls)) {
        const toolParts: Record<string, unknown>[] = [...parts];
        for (const toolCall of rawMessage.tool_calls) {
          const toolCallRecord = typeof toolCall === "object" && toolCall ? toolCall as Record<string, unknown> : {};
          const functionCall = toolCallRecord.function;
          const functionRecord = typeof functionCall === "object" && functionCall ? functionCall as Record<string, unknown> : {};
          toolParts.push({
            functionCall: {
              name: scalarToString(functionRecord.name) ?? "",
              args: parseToolArguments(functionRecord.arguments),
            },
          });
        }
        contents.push({ role: "model", parts: toolParts });
        continue;
      }

      contents.push({ role: role === "assistant" ? "model" : "user", parts });
    }

    return [contents, systemInstruction];
  }

  _format_messages_for_gemini(messages: string | readonly (Partial<LLMMessage> & Record<string, unknown>)[]): [Record<string, unknown>[], string | null] {
    return this.formatMessagesForGemini(messages);
  }

  override toConfigDict(): Record<string, unknown> {
    return {
      ...super.toConfigDict(),
      ...(this.project ? { project: this.project } : {}),
      ...(this.location !== "us-central1" ? { location: this.location } : {}),
      ...(this.topP === null ? {} : { top_p: this.topP }),
      ...(this.topK === null ? {} : { top_k: this.topK }),
      ...(this.maxOutputTokens === null ? {} : { max_output_tokens: this.maxOutputTokens }),
      ...(this.safetySettings ? { safety_settings: [...this.safetySettings] } : {}),
    };
  }

  static extractTokenUsage(response: unknown): Record<string, number> {
    const usage = readObject(readObject(response).usage_metadata);
    if (Object.keys(usage).length === 0) {
      return { total_tokens: 0 };
    }
    const candidatesTokens = numberField(usage, "candidates_token_count");
    const thinkingTokens = numberField(usage, "thoughts_token_count");
    return {
      prompt_token_count: numberField(usage, "prompt_token_count"),
      candidates_token_count: candidatesTokens,
      completion_tokens: candidatesTokens + thinkingTokens,
      total_token_count: numberField(usage, "total_token_count"),
      total_tokens: numberField(usage, "total_token_count"),
      cached_prompt_tokens: numberField(usage, "cached_content_token_count"),
      reasoning_tokens: thinkingTokens,
    };
  }

  static extract_token_usage(response: unknown): Record<string, number> {
    return GeminiCompletion.extractTokenUsage(response);
  }

  static extractTextFromResponse(response: unknown): string {
    const candidates = readObject(response).candidates;
    if (!Array.isArray(candidates)) {
      return "";
    }
    const first = readObject(candidates[0]);
    const rawParts = Array.isArray(readObject(first.content).parts)
      ? readObject(first.content).parts as unknown[]
      : [];
    return rawParts
      .map((part) => readObject(part))
      .filter((part) => typeof part.text === "string" && part.thought !== true)
      .map((part) => String(part.text))
      .join("");
  }

  static extract_text_from_response(response: unknown): string {
    return GeminiCompletion.extractTextFromResponse(response);
  }

  static extractFunctionCallsFromResponse(response: unknown): Record<string, unknown>[] {
    const candidates = readObject(response).candidates;
    if (!Array.isArray(candidates)) {
      return [];
    }
    const first = readObject(candidates[0]);
    const rawParts = Array.isArray(readObject(first.content).parts)
      ? readObject(first.content).parts as unknown[]
      : [];
    const calls: Record<string, unknown>[] = [];
    for (const part of rawParts) {
      const partRecord = readObject(part);
      const functionCall = readObject(partRecord.functionCall ?? partRecord.function_call);
      if (Object.keys(functionCall).length === 0) {
        continue;
      }
      if ((scalarToString(functionCall.name) ?? "") === STRUCTURED_OUTPUT_TOOL_NAME) {
        continue;
      }
      const index = calls.length;
      const args = readObject(functionCall.args);
      calls.push({
        id: `call_${index.toString()}`,
        type: "function",
        function: {
          name: scalarToString(functionCall.name) ?? "",
          arguments: JSON.stringify(args),
        },
        args,
        index,
      });
    }
    return calls;
  }

  static extract_function_calls_from_response(response: unknown): Record<string, unknown>[] {
    return GeminiCompletion.extractFunctionCallsFromResponse(response);
  }

  static extractStructuredOutputFromResponse(response: unknown): Record<string, unknown> | null {
    const candidates = readObject(response).candidates;
    if (!Array.isArray(candidates)) {
      return null;
    }
    const first = readObject(candidates[0]);
    const rawParts = Array.isArray(readObject(first.content).parts)
      ? readObject(first.content).parts as unknown[]
      : [];
    for (const part of rawParts) {
      const partRecord = readObject(part);
      const functionCall = readObject(partRecord.functionCall ?? partRecord.function_call);
      if ((scalarToString(functionCall.name) ?? "") === STRUCTURED_OUTPUT_TOOL_NAME) {
        return readObject(functionCall.args);
      }
    }
    return null;
  }

  static extract_structured_output_from_response(response: unknown): Record<string, unknown> | null {
    return GeminiCompletion.extractStructuredOutputFromResponse(response);
  }

  static addPropertyOrdering<T extends Record<string, unknown>>(schema: T): T {
    addGeminiPropertyOrdering(schema);
    return schema;
  }

  static add_property_ordering<T extends Record<string, unknown>>(schema: T): T {
    return GeminiCompletion.addPropertyOrdering(schema);
  }

  static convertContentsToDict(contents: readonly unknown[]): LLMMessage[] {
    return contents.map((content) => {
      const record = readObject(content);
      const role = record.role === "model"
        ? "assistant"
        : typeof record.role === "string"
          ? record.role
          : "user";
      const parts = Array.isArray(record.parts) ? record.parts : [];
      return {
        role: role === "assistant" || role === "system" ? role : "user",
        content: parts
          .map((part) => readObject(part).text)
          .filter((text): text is string => typeof text === "string")
          .join(" "),
      };
    });
  }

  static convert_contents_to_dict(contents: readonly unknown[]): LLMMessage[] {
    return GeminiCompletion.convertContentsToDict(contents);
  }
}

export const AzureCompletionParams = Object.freeze({ kind: "AzureCompletionParams" });
export type AzureCompletionParams = {
  messages?: readonly LLMMessage[];
  stream?: boolean;
  model_extras?: Record<string, unknown>;
  response_format?: unknown;
  model?: string;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  max_tokens?: number;
  stop?: readonly string[];
  tools?: readonly unknown[];
  tool_choice?: string;
};

export type AzureCompletionOptions = BaseLLMOptions & {
  endpoint?: string | null;
  api_version?: string | null;
  apiVersion?: string | null;
  timeout?: number | null;
  max_retries?: number;
  maxRetries?: number;
  top_p?: number | null;
  topP?: number | null;
  frequency_penalty?: number | null;
  frequencyPenalty?: number | null;
  presence_penalty?: number | null;
  presencePenalty?: number | null;
  max_tokens?: number | null;
  maxTokens?: number | null;
  stream?: boolean;
  interceptor?: unknown;
  response_format?: unknown;
  responseFormat?: unknown;
  credential_scopes?: readonly string[] | null;
  credentialScopes?: readonly string[] | null;
  api?: "completions" | "responses";
  reasoning_effort?: string | null;
  reasoningEffort?: string | null;
  instructions?: string | null;
  store?: boolean | null;
  previous_response_id?: string | null;
  previousResponseId?: string | null;
  include?: readonly string[] | null;
  builtin_tools?: readonly string[] | null;
  builtinTools?: readonly string[] | null;
  parse_tool_outputs?: boolean;
  parseToolOutputs?: boolean;
  auto_chain?: boolean;
  autoChain?: boolean;
  auto_chain_reasoning?: boolean;
  autoChainReasoning?: boolean;
  max_completion_tokens?: number | null;
  maxCompletionTokens?: number | null;
};

export class AzureCompletion extends ConfiguredLLM {
  readonly endpoint: string | null;
  readonly apiVersion: string | null;
  readonly api_version: string | null;
  readonly timeout: number | null;
  readonly maxRetries: number;
  readonly max_retries: number;
  readonly topP: number | null;
  readonly top_p: number | null;
  readonly frequencyPenalty: number | null;
  readonly frequency_penalty: number | null;
  readonly presencePenalty: number | null;
  readonly presence_penalty: number | null;
  readonly maxTokens: number | null;
  readonly max_tokens: number | null;
  readonly stream: boolean;
  readonly interceptor: unknown;
  readonly responseFormat: ConfiguredLLM["responseFormat"];
  readonly response_format: ConfiguredLLM["response_format"];
  readonly isOpenAIModel: boolean;
  readonly is_openai_model: boolean;
  readonly isAzureOpenAIEndpoint: boolean;
  readonly is_azure_openai_endpoint: boolean;
  readonly credentialScopes: readonly string[] | null;
  readonly credential_scopes: readonly string[] | null;
  private responseChainId: string | null;
  private reasoningChainItems: unknown[];

  constructor(options: AzureCompletionOptions = { model: "gpt-4o-mini" }) {
    const endpoint = options.endpoint ?? process.env.AZURE_ENDPOINT ?? process.env.AZURE_OPENAI_ENDPOINT ?? process.env.AZURE_API_BASE ?? null;
    super(stripUndefined({
      model: options.model,
      provider: options.provider ?? "azure",
      temperature: options.temperature,
      apiKey: options.apiKey,
      api_key: options.api_key ?? process.env.AZURE_API_KEY ?? null,
      baseUrl: options.baseUrl,
      base_url: options.base_url ?? endpoint,
      stop: options.stop,
      stopSequences: options.stopSequences,
      stop_sequences: options.stop_sequences,
      additionalParams: options.additionalParams,
      additional_params: options.additional_params,
      maxTokens: options.maxTokens ?? options.max_tokens ?? null,
      timeout: options.timeout ?? null,
    }) as BaseLLMOptions & { maxTokens?: number | null; timeout?: number | null });
    this.endpoint = endpoint;
    this.apiVersion = options.apiVersion ?? options.api_version ?? process.env.AZURE_API_VERSION ?? "2024-06-01";
    this.api_version = this.apiVersion;
    this.timeout = options.timeout ?? null;
    this.maxRetries = options.maxRetries ?? options.max_retries ?? 2;
    this.max_retries = this.maxRetries;
    this.topP = options.topP ?? options.top_p ?? null;
    this.top_p = this.topP;
    this.frequencyPenalty = options.frequencyPenalty ?? options.frequency_penalty ?? null;
    this.frequency_penalty = this.frequencyPenalty;
    this.presencePenalty = options.presencePenalty ?? options.presence_penalty ?? null;
    this.presence_penalty = this.presencePenalty;
    this.maxTokens = options.maxTokens ?? options.max_tokens ?? null;
    this.max_tokens = this.maxTokens;
    this.stream = options.stream ?? false;
    this.interceptor = options.interceptor ?? null;
    this.responseFormat = options.responseFormat ?? options.response_format ?? null;
    this.response_format = this.responseFormat;
    this.isAzureOpenAIEndpoint = isAzureOpenAIEndpoint(endpoint);
    this.is_azure_openai_endpoint = this.isAzureOpenAIEndpoint;
    this.isOpenAIModel = /(?:^|[/:])(gpt-|o1-|text-)/i.test(options.model);
    this.is_openai_model = this.isOpenAIModel;
    this.credentialScopes = options.credentialScopes ?? options.credential_scopes ?? null;
    this.credential_scopes = this.credentialScopes;
    this.responseChainId = options.previousResponseId ?? options.previous_response_id ?? null;
    this.reasoningChainItems = [];
  }

  override supportsFunctionCalling(): boolean {
    return this.isOpenAIModel;
  }

  override supportsStopWords(): boolean {
    const model = this.model.toLowerCase();
    if (model.includes("gpt-5")) {
      return false;
    }
    return !["o1", "o3", "o4", "o1-mini", "o3-mini", "o4-mini", "computer-use-preview"]
      .some((unsupported) => model.includes(unsupported));
  }

  override get lastResponseId(): string | null {
    return this.responseChainId;
  }

  override get lastReasoningItems(): readonly unknown[] {
    return [...this.reasoningChainItems];
  }

  override resetChain(): void {
    this.responseChainId = null;
  }

  override resetReasoningChain(): void {
    this.reasoningChainItems = [];
  }

  prepareCompletionParams(messages: readonly LLMMessage[], tools: readonly Tool[] | null = null): AzureCompletionParams {
    const params: AzureCompletionParams = {
      messages: [...messages],
      stream: this.stream,
    };
    const modelExtras: Record<string, unknown> = {};
    if (this.stream) {
      modelExtras.stream_options = { include_usage: true };
    }
    if (!this.isAzureOpenAIEndpoint) {
      params.model = this.model;
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
    if (this.maxTokens !== null) {
      params.max_tokens = this.maxTokens;
    }
    if (this.stop.length > 0 && this.supportsStopWords()) {
      params.stop = [...this.stop];
    }
    if (tools && tools.length > 0 && this.isOpenAIModel) {
      params.tools = this.convertToolsForInterference(tools);
      params.tool_choice = "auto";
    }
    const promptCacheKey = this.additionalParams.prompt_cache_key;
    if (promptCacheKey) {
      modelExtras.prompt_cache_key = promptCacheKey;
    }
    if (Object.keys(modelExtras).length > 0) {
      params.model_extras = modelExtras;
    }
    const dropParams = this.additionalParams.drop_params;
    const additionalDropParams = this.additionalParams.additional_drop_params;
    if (dropParams && Array.isArray(additionalDropParams)) {
      const dropped = new Set(additionalDropParams.filter((dropParam): dropParam is string => typeof dropParam === "string"));
      return Object.fromEntries(Object.entries(params).filter(([key]) => !dropped.has(key)));
    }
    return params;
  }

  _prepare_completion_params(messages: readonly LLMMessage[], tools: readonly Tool[] | null = null): AzureCompletionParams {
    return this.prepareCompletionParams(messages, tools);
  }

  convertToolsForInterference(tools: readonly Tool[]): Record<string, unknown>[] {
    return convertToolsToOpenAISchema(tools)[0].map((tool) => ({
      type: "function",
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      },
    }));
  }

  _convert_tools_for_interference(tools: readonly Tool[]): Record<string, unknown>[] {
    return this.convertToolsForInterference(tools);
  }

  override getFileUploader(): LocalFileUploader {
    return new LocalFileUploader("azure", { llm: this, endpoint: this.endpoint, api_version: this.apiVersion });
  }
}

function normalizeThinking(value: AnthropicCompletionOptions["thinking"]): AnthropicThinkingConfig | null {
  if (!value) {
    return null;
  }
  return value instanceof AnthropicThinkingConfig ? value : new AnthropicThinkingConfig(value);
}

function normalizeToolSearch(value: AnthropicCompletionOptions["tool_search"]): AnthropicToolSearchConfig | null {
  if (!value) {
    return null;
  }
  if (value === true) {
    return new AnthropicToolSearchConfig();
  }
  return value instanceof AnthropicToolSearchConfig ? value : new AnthropicToolSearchConfig(value);
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

function scalarToString(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function geminiVersion(model: string): number {
  const match = /gemini-(\d+(?:\.\d+)?)/iu.exec(model.toLowerCase());
  return match ? Number.parseFloat(match[1] ?? "0") : 0;
}

function geminiTextParts(content: unknown): Record<string, unknown>[] {
  if (Array.isArray(content)) {
    return content.map((item) => {
      if (typeof item === "object" && item !== null) {
        const record = item as Record<string, unknown>;
        if (typeof record.text === "string") {
          return { text: record.text };
        }
        if (typeof record.inlineData === "object" && record.inlineData !== null) {
          return { inlineData: record.inlineData };
        }
      }
      return { text: scalarToString(item) ?? "" };
    });
  }
  return [{ text: scalarToString(content) ?? "" }];
}

function parseToolArguments(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed: unknown = value ? JSON.parse(value) : {};
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function parseGeminiToolResponse(text: string): Record<string, unknown> {
  try {
    const parsed: unknown = text ? JSON.parse(text) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : { result: parsed };
  } catch {
    return { result: text };
  }
}

function geminiResponseSchema(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const schemaProvider = value as {
    model_json_schema?: () => unknown;
    modelJsonSchema?: () => unknown;
    schema?: unknown;
  };
  const schema = schemaProvider.model_json_schema?.() ?? schemaProvider.modelJsonSchema?.() ?? schemaProvider.schema;
  return schema && typeof schema === "object" && !Array.isArray(schema)
    ? schema as Record<string, unknown>
    : null;
}

function isAzureOpenAIEndpoint(endpoint: string | null): boolean {
  if (!endpoint) {
    return false;
  }
  try {
    const url = new URL(endpoint);
    return (url.hostname === "openai.azure.com" || url.hostname.endsWith(".openai.azure.com")) && url.pathname.includes("/openai/deployments/");
  } catch {
    return false;
  }
}

function geminiContextWindowSize(model: string): number {
  const windows: Record<string, number> = {
    "gemini-3-pro-preview": 1048576,
    "gemini-2.0-flash-thinking": 32768,
    "gemini-2.0-flash-lite": 1048576,
    "gemini-2.0-flash": 1048576,
    "gemini-2.5-flash": 1048576,
    "gemini-2.5-pro": 1048576,
    "gemini-1.5-pro": 2097152,
    "gemini-1.5-flash-8b": 1048576,
    "gemini-1.5-flash": 1048576,
    "gemini-1.0-pro": 32768,
    "gemma-3-1b": 32000,
    "gemma-3-4b": 128000,
    "gemma-3-12b": 128000,
    "gemma-3-27b": 128000,
  };
  const match = Object.entries(windows).find(([prefix]) => model.startsWith(prefix));
  return Math.trunc((match?.[1] ?? 1048576) * CONTEXT_WINDOW_USAGE_RATIO);
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberField(record: Record<string, unknown>, field: string): number {
  const value = record[field];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function addGeminiPropertyOrdering(schema: Record<string, unknown>): void {
  if (schema.type === "object" && !("propertyOrdering" in schema)) {
    const properties = readObject(schema.properties);
    if (Object.keys(properties).length > 0) {
      schema.propertyOrdering = Object.keys(properties);
    }
  }
  for (const value of Object.values(schema)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      addGeminiPropertyOrdering(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          addGeminiPropertyOrdering(item as Record<string, unknown>);
        }
      }
    }
  }
}
