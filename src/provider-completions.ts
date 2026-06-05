import { ConfiguredLLM, CONTEXT_WINDOW_USAGE_RATIO, LocalFileUploader, registerLLMProviderFactory, stripCacheBreakpoint, type BaseLLMOptions, type LLMAvailableFunction, type LLMCallOptions, type LLMMessageInput, type LLMResponse } from "./llm.js";
import { convertToolsToOpenAISchema } from "./agent-utils.js";
import { OpenAICompletion, type OpenAICompletionOptions } from "./openai-completion.js";
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
export const SNOWFLAKE_CORTEX_PATH = "/api/v2/cortex/v1";
export const SNOWFLAKE_TOKEN_ENV_VARS = Object.freeze([
  "SNOWFLAKE_PAT",
  "SNOWFLAKE_TOKEN",
  "SNOWFLAKE_JWT",
] as const);
const LLM_ROLES = new Set(["system", "user", "assistant", "tool"]);

const BEDROCK_DOCUMENT_FORMATS: Record<string, string> = {
  "application/pdf": "pdf",
  "text/csv": "csv",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/html": "html",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

const BEDROCK_VIDEO_FORMATS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/x-matroska": "mkv",
  "video/webm": "webm",
  "video/x-flv": "flv",
  "video/mpeg": "mpeg",
  "video/x-ms-wmv": "wmv",
  "video/3gpp": "three_gp",
};

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
  max_tokens?: number | null;
  maxTokens?: number | null;
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
  previousThinkingBlocks: Record<string, unknown>[];
  _previous_thinking_blocks: Record<string, unknown>[];

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
    this.previousThinkingBlocks = [];
    this._previous_thinking_blocks = this.previousThinkingBlocks;
  }

  override call(messages: readonly LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse> {
    return super.call(messages, options);
  }

  override async acall(messages: LLMMessageInput, options?: LLMCallOptions): Promise<LLMResponse> {
    return await super.acall(messages, options);
  }

  static convertImageBlocks(content: unknown): unknown {
    if (!Array.isArray(content)) {
      return content;
    }
    return (content as unknown[]).map((block): unknown => {
      const record = readObject(block);
      if (record.type !== "image_url") {
        return block;
      }
      const imageInfo = readObject(record.image_url);
      const url = scalarToString(imageInfo.url) ?? "";
      if (!url.startsWith("data:") || !url.includes(";base64,")) {
        return block;
      }
      const [header, data] = url.split(";base64,", 2);
      return {
        type: "image",
        source: {
          type: "base64",
          media_type: header?.startsWith("data:") ? header.slice("data:".length) : "image/png",
          data: data ?? "",
        },
      };
    });
  }

  static _convert_image_blocks(content: unknown): unknown {
    return AnthropicCompletion.convertImageBlocks(content);
  }

  formatMessagesForAnthropic(
    messages: LLMMessageInput,
  ): [Record<string, unknown>[], string | Record<string, unknown>[] | null] {
    const cacheSystem = Array.isArray(messages)
      && messages.some((message) => {
        const record = readObject(message);
        return record.role === "system" && record.cache_breakpoint === true;
      });
    const cacheMatchContents = Array.isArray(messages)
      ? messages
        .map((message) => readObject(message))
        .filter((message) => message.role === "user" && message.cache_breakpoint === true)
        .map((message) => anthropicCacheMatchText(message.content))
        .filter((text): text is string => text !== null)
      : [];
    const baseFormatted = typeof messages === "string"
      ? [{ role: "user" as const, content: messages }]
      : this.processMessageFiles(messages.map((message, index) => {
          if (Array.isArray(message)) {
            throw new Error(`Message at index ${String(index)} must be a dictionary.`);
          }
          const role = message.role;
          if (!isAnthropicRole(role) || !("content" in message)) {
            throw new Error(`Message at index ${String(index)} must have 'role' and 'content' keys.`);
          }
          const { cache_breakpoint: _cacheBreakpoint, ...copy } = message;
          void _cacheBreakpoint;
          return copy as LLMMessage;
        }));

    const formattedMessages: Record<string, unknown>[] = [];
    let systemMessage: string | null = null;
    let pendingToolResults: Record<string, unknown>[] = [];

    for (const rawMessage of baseFormatted) {
      const message = rawMessage as LLMMessage & Record<string, unknown>;
      const role = message.role;
      const content = message.content as unknown;

      if (role === "system") {
        const textContent = anthropicContentToText(content);
        systemMessage = systemMessage ? `${systemMessage}\n\n${textContent}` : textContent;
        continue;
      }

      if (role === "tool") {
        const toolCallId = scalarToString(message.tool_call_id);
        if (!toolCallId) {
          throw new Error("Tool message missing required tool_call_id");
        }
        pendingToolResults.push({
          type: "tool_result",
          tool_use_id: toolCallId,
          content: content ? AnthropicCompletion.convertImageBlocks(content) : "",
        });
        continue;
      }

      if (role === "assistant") {
        if (pendingToolResults.length > 0) {
          formattedMessages.push({ role: "user", content: pendingToolResults });
          pendingToolResults = [];
        }

        const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
        if (toolCalls.length > 0) {
          const assistantContent = toolCalls
            .map((toolCall) => anthropicToolUseBlock(toolCall))
            .filter((toolUse): toolUse is Record<string, unknown> => toolUse !== null);
          if (assistantContent.length > 0) {
            formattedMessages.push({ role: "assistant", content: assistantContent });
          }
          continue;
        }

        if (Array.isArray(content)) {
          formattedMessages.push({ role: "assistant", content: AnthropicCompletion.convertImageBlocks(content) });
        } else if (this.thinking && this.previousThinkingBlocks.length > 0) {
          formattedMessages.push({
            role: "assistant",
            content: [
              ...this.previousThinkingBlocks.map((block) => ({ ...block })),
              { type: "text", text: scalarToString(content) ?? "" },
            ],
          });
        } else {
          formattedMessages.push({ role: "assistant", content: scalarToString(content) ?? "" });
        }
        continue;
      }

      if (pendingToolResults.length > 0) {
        formattedMessages.push({ role: "user", content: pendingToolResults });
        pendingToolResults = [];
      }
      formattedMessages.push({
        role,
        content: Array.isArray(content) ? AnthropicCompletion.convertImageBlocks(content) : content ?? "",
      });
    }

    if (pendingToolResults.length > 0) {
      formattedMessages.push({ role: "user", content: pendingToolResults });
    }
    if (formattedMessages.length === 0) {
      formattedMessages.push({ role: "user", content: "Hello" });
    } else if (formattedMessages[0]?.role !== "user") {
      formattedMessages.unshift({ role: "user", content: "Hello" });
    }

    for (const needle of cacheMatchContents) {
      const match = formattedMessages.find((message) => message.role === "user" && anthropicCacheMatchText(message.content) === needle);
      if (match) {
        AnthropicCompletion.stampCacheControlOnMessage(match);
      }
    }

    const systemPayload = systemMessage && cacheSystem
      ? [{ type: "text", text: systemMessage, cache_control: { type: "ephemeral" } }]
      : systemMessage;
    return [formattedMessages, systemPayload];
  }

  _format_messages_for_anthropic(
    messages: LLMMessageInput,
  ): [Record<string, unknown>[], string | Record<string, unknown>[] | null] {
    return this.formatMessagesForAnthropic(messages);
  }

  static stampCacheControlOnMessage(message: Record<string, unknown>): void {
    const content = message.content;
    if (typeof content === "string") {
      message.content = [{ type: "text", text: content, cache_control: { type: "ephemeral" } }];
      return;
    }
    if (Array.isArray(content) && content.length > 0) {
      const contentBlocks: unknown[] = content;
      const last = contentBlocks.at(-1);
      if (last && typeof last === "object" && !Array.isArray(last)) {
        (last as Record<string, unknown>).cache_control = { type: "ephemeral" };
      }
    }
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
    return tools.map((tool) => {
      const record = readObject(tool);
      const type = scalarToString(record.type);
      if (type && TOOL_SEARCH_TOOL_TYPES.includes(type as (typeof TOOL_SEARCH_TOOL_TYPES)[number])) {
        return { ...record };
      }
      if (typeof record.name === "string" && Object.keys(readObject(record.input_schema)).length > 0) {
        return { ...record };
      }
      const functionRecord = readObject(record.function);
      if (type === "function" && typeof functionRecord.name === "string") {
        return {
          name: functionRecord.name,
          description: scalarToString(functionRecord.description) ?? "",
          input_schema: readObject(functionRecord.parameters),
          strict: true,
        };
      }
      const [schemas] = convertToolsToOpenAISchema([tool]);
      const converted = schemas[0];
      return {
        name: converted?.function.name ?? "",
        description: converted?.function.description ?? "",
        input_schema: converted?.function.parameters ?? {},
        strict: true,
      };
    });
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
    if (!hasNumericField(usage, "input_tokens", "output_tokens")) {
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

  static extractToolUsesFromResponse(response: unknown): Record<string, unknown>[] {
    return anthropicResponseContent(response)
      .map((block) => readObject(block))
      .filter((block) => (scalarToString(block.type) ?? "") === "tool_use" || Object.keys(readObject(block.input)).length > 0)
      .filter((block) => (scalarToString(block.name) ?? "") !== STRUCTURED_OUTPUT_TOOL_NAME);
  }

  static extract_tool_uses_from_response(response: unknown): Record<string, unknown>[] {
    return AnthropicCompletion.extractToolUsesFromResponse(response);
  }

  static extractStructuredOutputFromResponse(response: unknown): Record<string, unknown> | null {
    for (const block of anthropicResponseContent(response)) {
      const record = readObject(block);
      if ((scalarToString(record.name) ?? "") === STRUCTURED_OUTPUT_TOOL_NAME) {
        return readObject(record.input);
      }
    }
    return null;
  }

  static extract_structured_output_from_response(response: unknown): Record<string, unknown> | null {
    return AnthropicCompletion.extractStructuredOutputFromResponse(response);
  }

  static extractThinkingBlocksFromResponse(response: unknown): Record<string, unknown>[] {
    const blocks: Record<string, unknown>[] = [];
    for (const rawBlock of anthropicResponseContent(response)) {
      const block = readObject(rawBlock);
      const type = scalarToString(block.type) ?? "";
      if (type === "thinking") {
        const thinking = scalarToString(block.thinking);
        const signature = scalarToString(block.signature);
        blocks.push({
          type,
          ...(thinking === null ? {} : { thinking }),
          ...(signature === null ? {} : { signature }),
        });
      } else if (type === "redacted_thinking") {
        blocks.push({ ...block, type });
      }
    }
    return blocks;
  }

  static extract_thinking_blocks_from_response(response: unknown): Record<string, unknown>[] {
    return AnthropicCompletion.extractThinkingBlocksFromResponse(response);
  }

  accumulateStreamEvents(events: readonly unknown[], finalMessage: unknown = null): {
    text: string;
    response_id: string | null;
    tool_calls: Record<string, unknown>[];
    usage: Record<string, number> | null;
    thinking_blocks: Record<string, unknown>[];
  } {
    let text = "";
    let responseId: string | null = null;
    let usage: Record<string, number> | null = null;
    const toolCallsByIndex = new Map<number, { id: string; name: string; arguments: string; index: number }>();

    for (const rawEvent of events) {
      const event = readObject(rawEvent);
      const messageId = scalarToString(readObject(event.message).id);
      if (messageId !== null) {
        responseId = messageId;
      }

      const type = scalarToString(event.type) ?? "";
      const index = typeof event.index === "number" && Number.isFinite(event.index) ? event.index : null;
      const delta = readObject(event.delta);
      const deltaType = scalarToString(delta.type) ?? "";

      if (deltaType === "text_delta" || (type === "content_block_delta" && typeof delta.text === "string")) {
        text += scalarToString(delta.text) ?? "";
      }

      if (type === "content_block_start" && index !== null) {
        const block = readObject(event.content_block ?? event.contentBlock);
        if ((scalarToString(block.type) ?? "") === "tool_use") {
          toolCallsByIndex.set(index, {
            id: scalarToString(block.id) ?? "",
            name: scalarToString(block.name) ?? "",
            arguments: "",
            index,
          });
        }
      } else if (type === "content_block_delta" && index !== null && deltaType === "input_json_delta") {
        const partialJson = scalarToString(delta.partial_json ?? delta.partialJson) ?? "";
        const existing = toolCallsByIndex.get(index);
        if (existing && partialJson) {
          existing.arguments += partialJson;
        }
      }
    }

    const thinkingBlocks = AnthropicCompletion.extractThinkingBlocksFromResponse(finalMessage);
    if (thinkingBlocks.length > 0) {
      this.previousThinkingBlocks = thinkingBlocks;
      this._previous_thinking_blocks = this.previousThinkingBlocks;
    }

    if (hasNumericField(readObject(readObject(finalMessage).usage), "input_tokens", "output_tokens")) {
      usage = this.extractAnthropicTokenUsage(finalMessage);
      this.trackTokenUsageInternal(usage);
    }

    return {
      text,
      response_id: responseId,
      tool_calls: [...toolCallsByIndex.values()]
        .sort((left, right) => left.index - right.index)
        .map((toolCall) => ({
          id: toolCall.id,
          type: "function",
          function: {
            name: toolCall.name,
            arguments: toolCall.arguments,
          },
          index: toolCall.index,
        })),
      usage,
      thinking_blocks: thinkingBlocks,
    };
  }

  _accumulate_stream_events(events: readonly unknown[], finalMessage: unknown = null): {
    text: string;
    response_id: string | null;
    tool_calls: Record<string, unknown>[];
    usage: Record<string, number> | null;
    thinking_blocks: Record<string, unknown>[];
  } {
    return this.accumulateStreamEvents(events, finalMessage);
  }

  async executeToolsAndCollectResults(
    toolUses: readonly unknown[],
    availableFunctions: Record<string, LLMAvailableFunction>,
  ): Promise<Record<string, unknown>[]> {
    const toolResults: Record<string, unknown>[] = [];
    for (const rawToolUse of toolUses) {
      const toolUse = readObject(rawToolUse);
      const functionName = scalarToString(toolUse.name) ?? "";
      const result = await this.handleToolExecution({
        functionName,
        functionArgs: readObject(toolUse.input),
        availableFunctions,
      });
      toolResults.push({
        type: "tool_result",
        tool_use_id: scalarToString(toolUse.id) ?? "",
        content: result ?? "Tool execution completed",
      });
    }
    return toolResults;
  }

  async _execute_tools_and_collect_results(
    toolUses: readonly unknown[],
    availableFunctions: Record<string, LLMAvailableFunction>,
  ): Promise<Record<string, unknown>[]> {
    return await this.executeToolsAndCollectResults(toolUses, availableFunctions);
  }

  async executeFirstTool(
    toolUses: readonly unknown[],
    availableFunctions: Record<string, LLMAvailableFunction>,
  ): Promise<string | null> {
    const toolUse = readObject(toolUses[0]);
    const functionName = scalarToString(toolUse.name) ?? "";
    return await this.handleToolExecution({
      functionName,
      functionArgs: readObject(toolUse.input),
      availableFunctions,
    });
  }

  async _execute_first_tool(
    toolUses: readonly unknown[],
    availableFunctions: Record<string, LLMAvailableFunction>,
  ): Promise<string | null> {
    return await this.executeFirstTool(toolUses, availableFunctions);
  }

  override supportsFunctionCalling(): boolean {
    return true;
  }

  override supports_function_calling(): boolean {
    return this.supportsFunctionCalling();
  }

  override supportsStopWords(): boolean {
    return false;
  }

  override supports_stop_words(): boolean {
    return this.supportsStopWords();
  }

  override supportsMultimodal(): boolean {
    const model = this.model.toLowerCase();
    return ["claude-3", "claude-sonnet-4", "claude-opus-4", "claude-haiku-4"]
      .some((prefix) => model.startsWith(prefix));
  }

  override supports_multimodal(): boolean {
    return this.supportsMultimodal();
  }

  override getFileUploader(): LocalFileUploader {
    return new LocalFileUploader("anthropic", { llm: this });
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

  override toConfigDict(): Record<string, unknown> {
    return super.toConfigDict();
  }

  override to_config_dict(): Record<string, unknown> {
    return this.toConfigDict();
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
    if (options.interceptor !== null && options.interceptor !== undefined) {
      throw new Error("Bedrock provider does not support interceptor transport.");
    }
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
    this.interceptor = null;
  }

  override call(messages: readonly LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse> {
    return super.call(messages, options);
  }

  override async acall(messages: LLMMessageInput, options?: LLMCallOptions): Promise<LLMResponse> {
    return await super.acall(messages, options);
  }

  override supportsFunctionCalling(): boolean {
    return true;
  }

  override supports_function_calling(): boolean {
    return this.supportsFunctionCalling();
  }

  override supportsStopWords(): boolean {
    return true;
  }

  override supports_stop_words(): boolean {
    return this.supportsStopWords();
  }

  override supportsMultimodal(): boolean {
    const model = this.model.toLowerCase();
    return model.includes("claude-3")
      || model.includes("claude-sonnet-4")
      || model.includes("claude-opus-4")
      || model.includes("claude-haiku-4")
      || model.includes("nova");
  }

  override supports_multimodal(): boolean {
    return this.supportsMultimodal();
  }

  override getContextWindowSize(): number {
    return super.getContextWindowSize();
  }

  override get_context_window_size(): number {
    return this.getContextWindowSize();
  }

  override formatTextContent(text: string): Record<string, string> {
    return super.formatTextContent(text);
  }

  override format_text_content(text: string): Record<string, string> {
    return this.formatTextContent(text);
  }

  getDocumentFormat(contentType: string): string | null {
    return BEDROCK_DOCUMENT_FORMATS[contentType] ?? null;
  }

  _get_document_format(contentType: string): string | null {
    return this.getDocumentFormat(contentType);
  }

  getVideoFormat(contentType: string): string | null {
    return BEDROCK_VIDEO_FORMATS[contentType] ?? null;
  }

  _get_video_format(contentType: string): string | null {
    return this.getVideoFormat(contentType);
  }

  handleClientError(error: unknown): string {
    const record = readObject(error);
    const errorRecord = readObject(readObject(record.response).Error);
    const errorCode = scalarToString(errorRecord.Code) ?? "Unknown";
    const errorMessage = scalarToString(errorRecord.Message) ?? (error instanceof Error ? error.message : String(error));
    const errorMapping: Record<string, string> = {
      AccessDeniedException: `Access denied to model ${this.model}: ${errorMessage}`,
      ResourceNotFoundException: `Model ${this.model} not found: ${errorMessage}`,
      ThrottlingException: `API throttled, please retry later: ${errorMessage}`,
      ValidationException: `Invalid request: ${errorMessage}`,
      ModelTimeoutException: `Model request timed out: ${errorMessage}`,
      ServiceQuotaExceededException: `Service quota exceeded: ${errorMessage}`,
      ModelNotReadyException: `Model ${this.model} not ready: ${errorMessage}`,
      ModelErrorException: `Model error: ${errorMessage}`,
    };
    return errorMapping[errorCode] ?? `Bedrock API error: ${errorMessage}`;
  }

  _handle_client_error(error: unknown): string {
    return this.handleClientError(error);
  }

  override getFileUploader(): LocalFileUploader {
    return new LocalFileUploader("bedrock", { llm: this, region_name: this.regionName });
  }

  override get_file_uploader(): LocalFileUploader {
    return this.getFileUploader();
  }

  override toConfigDict(): Record<string, unknown> {
    return super.toConfigDict();
  }

  override to_config_dict(): Record<string, unknown> {
    return this.toConfigDict();
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
        content: Array.isArray(content)
          ? bedrockConverseContentBlocks(content)
          : [{ text: content || "" }],
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
    return normalizeOpenAIFunctionToolSchemas(tools).map((tool) => ({
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

  static extractToolUsesFromResponse(response: unknown): Record<string, unknown>[] {
    return bedrockResponseContent(response)
      .map((block) => readObject(readObject(block).toolUse))
      .filter((toolUse) => Object.keys(toolUse).length > 0)
      .filter((toolUse) => (scalarToString(toolUse.name) ?? "") !== STRUCTURED_OUTPUT_TOOL_NAME);
  }

  static extract_tool_uses_from_response(response: unknown): Record<string, unknown>[] {
    return BedrockCompletion.extractToolUsesFromResponse(response);
  }

  static extractStructuredOutputFromResponse(response: unknown): Record<string, unknown> | null {
    for (const block of bedrockResponseContent(response)) {
      const toolUse = readObject(readObject(block).toolUse);
      if ((scalarToString(toolUse.name) ?? "") === STRUCTURED_OUTPUT_TOOL_NAME) {
        return readObject(toolUse.input);
      }
    }
    return null;
  }

  static extract_structured_output_from_response(response: unknown): Record<string, unknown> | null {
    return BedrockCompletion.extractStructuredOutputFromResponse(response);
  }

  async executeToolUseAndPrepareMessages(
    messages: readonly Record<string, unknown>[],
    toolUse: unknown,
    availableFunctions: Record<string, LLMAvailableFunction>,
  ): Promise<{ result: string | null; messages: Record<string, unknown>[] }> {
    const toolUseBlock = readObject(toolUse);
    const toolUseId = scalarToString(toolUseBlock.toolUseId) ?? "";
    const functionName = scalarToString(toolUseBlock.name) ?? "";
    const result = await this.handleToolExecution({
      functionName,
      functionArgs: readObject(toolUseBlock.input),
      availableFunctions,
    });
    if (result === null) {
      return { result, messages: [...messages] };
    }
    return {
      result,
      messages: [
        ...messages,
        {
          role: "assistant",
          content: [{ toolUse: toolUseBlock }],
        },
        {
          role: "user",
          content: [{
            toolResult: {
              toolUseId,
              content: [{ text: result }],
            },
          }],
        },
      ],
    };
  }

  async _execute_tool_use_and_prepare_messages(
    messages: readonly Record<string, unknown>[],
    toolUse: unknown,
    availableFunctions: Record<string, LLMAvailableFunction>,
  ): Promise<{ result: string | null; messages: Record<string, unknown>[] }> {
    return await this.executeToolUseAndPrepareMessages(messages, toolUse, availableFunctions);
  }

  accumulateConverseStreamEvents(events: readonly unknown[]): {
    text: string;
    tool_calls: Record<string, unknown>[];
    usage: Record<string, number> | null;
    stop_reason: string | null;
  } {
    let text = "";
    let usage: Record<string, number> | null = null;
    let stopReason: string | null = null;
    let currentToolIndex: number | null = null;
    const toolCallsByIndex = new Map<number, { id: string; name: string; arguments: string; index: number }>();

    for (const rawEvent of events) {
      const event = readObject(rawEvent);
      const start = readObject(event.contentBlockStart);
      if (Object.keys(start).length > 0) {
        const index = numberField(start, "contentBlockIndex");
        const toolUse = readObject(readObject(start.start).toolUse);
        if (Object.keys(toolUse).length > 0) {
          currentToolIndex = index;
          toolCallsByIndex.set(index, {
            id: scalarToString(toolUse.toolUseId) ?? "",
            name: scalarToString(toolUse.name) ?? "",
            arguments: "",
            index,
          });
        }
        continue;
      }

      const deltaEvent = readObject(event.contentBlockDelta);
      if (Object.keys(deltaEvent).length > 0) {
        const delta = readObject(deltaEvent.delta);
        if (typeof delta.text === "string") {
          text += delta.text;
          continue;
        }
        const toolUseDelta = readObject(delta.toolUse);
        const input = scalarToString(toolUseDelta.input) ?? "";
        if (input) {
          const index = typeof deltaEvent.contentBlockIndex === "number" && Number.isFinite(deltaEvent.contentBlockIndex)
            ? deltaEvent.contentBlockIndex
            : currentToolIndex;
          const existing = index === null ? null : toolCallsByIndex.get(index);
          if (existing) {
            existing.arguments += input;
          }
        }
        continue;
      }

      const stop = readObject(event.messageStop);
      if (Object.keys(stop).length > 0) {
        stopReason = scalarToString(stop.stopReason);
        continue;
      }

      const metadata = readObject(event.metadata);
      const metadataUsage = readObject(metadata.usage);
      if (Object.keys(metadataUsage).length > 0) {
        usage = BedrockCompletion.extractBedrockTokenUsage(metadataUsage);
        this.trackTokenUsageInternal(metadataUsage);
      }
    }

    return {
      text,
      tool_calls: [...toolCallsByIndex.values()]
        .sort((left, right) => left.index - right.index)
        .map((toolCall) => ({
          id: toolCall.id,
          type: "function",
          function: {
            name: toolCall.name,
            arguments: toolCall.arguments,
          },
          index: toolCall.index,
        })),
      usage,
      stop_reason: stopReason,
    };
  }

  _accumulate_converse_stream_events(events: readonly unknown[]): {
    text: string;
    tool_calls: Record<string, unknown>[];
    usage: Record<string, number> | null;
    stop_reason: string | null;
  } {
    return this.accumulateConverseStreamEvents(events);
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
  _client: Record<string, unknown> | null;
  tools: readonly Tool[] | null;

  constructor(options: GeminiCompletionOptions = { model: "gemini-2.5-flash" }) {
    if (options.interceptor !== null && options.interceptor !== undefined) {
      throw new Error("Gemini provider does not support interceptor transport.");
    }
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
    this.interceptor = null;
    this.supportsTools = geminiVersion(model) >= 1.5;
    this.supports_tools = this.supportsTools;
    this.isGemini20 = geminiVersion(model) >= 2.0;
    this.is_gemini_2_0 = this.isGemini20;
    this._client = null;
    this.tools = null;
  }

  override call(messages: readonly LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse> {
    if (this.useVertexai) {
      return super.call(messages, options);
    }

    const apiKey = this.apiKey ?? process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? null;
    if (!apiKey) {
      throw new Error("Gemini API key required. Set GEMINI_API_KEY or GOOGLE_API_KEY, or pass api_key.");
    }

    const [contents, systemInstruction] = this.formatMessagesForGemini(messages);
    const tools = (options?.tools ?? null) as readonly Tool[] | null;
    const generationConfig = this.prepareGenerationConfig(
      systemInstruction,
      tools,
      options?.responseModel ?? null,
    );
    const requestBody = readObject(generationConfig);
    const generationConfigBody = { ...generationConfig };
    delete generationConfigBody.system_instruction;
    delete generationConfigBody.tools;
    delete generationConfigBody.safety_settings;
    const model = this.model.replace(/^(?:gemini|google)\//, "");
    const baseUrl = this.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
    const requestInit: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        ...(Object.keys(generationConfigBody).length > 0 ? { generationConfig: generationConfigBody } : {}),
        ...("system_instruction" in requestBody ? { system_instruction: requestBody.system_instruction } : {}),
        ...("tools" in requestBody ? { tools: requestBody.tools } : {}),
        ...("safety_settings" in requestBody ? { safety_settings: requestBody.safety_settings } : {}),
      }),
    };
    if (options?.signal) {
      requestInit.signal = options.signal;
    }

    return fetch(
      `${baseUrl.replace(/\/$/, "")}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      requestInit,
    ).then(async (response) => {
      const body = await response.json();
      if (!response.ok) {
        const error = readObject(readObject(body).error);
        throw new Error(scalarToString(error.message) ?? `Gemini request failed with HTTP ${response.status.toString()}.`);
      }
      return await this.processResponseWithTools(
        body,
        contents,
        (options?.availableFunctions ?? options?.available_functions ?? null) as Record<string, LLMAvailableFunction> | null,
      ) as LLMResponse;
    });
  }

  override async acall(messages: LLMMessageInput, options?: LLMCallOptions): Promise<LLMResponse> {
    return await this.call(this.formatMessages(messages), options);
  }

  override supportsFunctionCalling(): boolean {
    return true;
  }

  override supports_function_calling(): boolean {
    return this.supportsFunctionCalling();
  }

  override supportsStopWords(): boolean {
    return true;
  }

  override supports_stop_words(): boolean {
    return this.supportsStopWords();
  }

  override supportsMultimodal(): boolean {
    return true;
  }

  override supports_multimodal(): boolean {
    return this.supportsMultimodal();
  }

  override getContextWindowSize(): number {
    return geminiContextWindowSize(this.model);
  }

  override get_context_window_size(): number {
    return this.getContextWindowSize();
  }

  override formatTextContent(text: string): { text: string } {
    return { text };
  }

  override format_text_content(text: string): { text: string } {
    return this.formatTextContent(text);
  }

  override getFileUploader(): LocalFileUploader {
    return new LocalFileUploader("gemini", { llm: this, project: this.project, location: this.location });
  }

  override get_file_uploader(): LocalFileUploader {
    return this.getFileUploader();
  }

  getSyncClient(env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
    if (this._client) {
      return this._client;
    }
    const apiKey = this.apiKey ?? env.GOOGLE_API_KEY ?? env.GEMINI_API_KEY ?? null;
    if (apiKey && this.apiKey !== apiKey) {
      Object.assign(this, { apiKey, api_key: apiKey });
    }
    this._client = {
      provider: "gemini",
      model: this.model,
      api_key: apiKey,
      project: this.project,
      location: this.location,
      use_vertexai: this.useVertexai,
    };
    return this._client;
  }

  _get_sync_client(env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
    return this.getSyncClient(env);
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
    return normalizeOpenAIFunctionToolSchemas(tools).map((tool) => ({
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
        const rawToolCallParts = rawMessage.raw_tool_call_parts;
        const toolParts: Record<string, unknown>[] = [];
        const hasRawToolCallParts = Array.isArray(rawToolCallParts)
          && rawToolCallParts.length > 0
          && rawToolCallParts.every((part) => typeof part === "object" && part !== null && !Array.isArray(part));
        if (hasRawToolCallParts) {
          toolParts.push(...rawToolCallParts as Record<string, unknown>[]);
          if (textContent) {
            toolParts.unshift({ text: textContent });
          }
        } else {
          toolParts.push(...parts);
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

  override to_config_dict(): Record<string, unknown> {
    return this.toConfigDict();
  }

  static extractTokenUsage(response: unknown): Record<string, number> {
    const usage = readObject(readObject(response).usage_metadata);
    if (!hasNumericField(usage, "prompt_token_count", "candidates_token_count", "total_token_count")) {
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

  static _extract_token_usage(response: unknown): Record<string, number> {
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

  async processResponseWithTools(
    response: unknown,
    contents: readonly unknown[] = [],
    availableFunctions: Record<string, LLMAvailableFunction> | null = null,
  ): Promise<unknown> {
    void contents;
    const candidates = readObject(response).candidates;
    if (!Array.isArray(candidates)) {
      return GeminiCompletion.extractTextFromResponse(response);
    }
    const first = readObject(candidates[0]);
    const rawParts = Array.isArray(readObject(first.content).parts)
      ? readObject(first.content).parts as unknown[]
      : [];
    const functionCallParts = rawParts.filter((part) => Object.keys(readObject(readObject(part).functionCall ?? readObject(part).function_call)).length > 0);
    const nonStructuredParts = functionCallParts.filter((part) => {
      const partRecord = readObject(part);
      const functionCall = readObject(partRecord.functionCall ?? partRecord.function_call);
      return (scalarToString(functionCall.name) ?? "") !== STRUCTURED_OUTPUT_TOOL_NAME;
    });

    if (nonStructuredParts.length > 0 && !availableFunctions) {
      return nonStructuredParts;
    }

    if (nonStructuredParts.length > 0 && availableFunctions) {
      for (const part of nonStructuredParts) {
        const partRecord = readObject(part);
        const functionCall = readObject(partRecord.functionCall ?? partRecord.function_call);
        const functionName = scalarToString(functionCall.name);
        if (!functionName) {
          continue;
        }
        const result = await this.handleToolExecution({
          functionName,
          functionArgs: readObject(functionCall.args),
          availableFunctions,
        });
        if (result !== null) {
          return result;
        }
      }
    }

    return GeminiCompletion.extractTextFromResponse(response);
  }

  async _process_response_with_tools(
    response: unknown,
    contents: readonly unknown[] = [],
    availableFunctions: Record<string, LLMAvailableFunction> | null = null,
  ): Promise<unknown> {
    return await this.processResponseWithTools(response, contents, availableFunctions);
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

  accumulateStreamChunks(chunks: readonly unknown[]): {
    text: string;
    function_calls: Record<string, unknown>[];
    usage: Record<string, number> | null;
    thinking_text: string;
    response_id: string | null;
  } {
    let text = "";
    let thinkingText = "";
    let usage: Record<string, number> | null = null;
    let responseId: string | null = null;
    const functionCalls: Record<string, unknown>[] = [];

    for (const rawChunk of chunks) {
      const chunk = readObject(rawChunk);
      responseId = scalarToString(chunk.response_id ?? chunk.responseId) ?? responseId;
      const usageMetadata = readObject(chunk.usage_metadata ?? chunk.usageMetadata);
      if (hasNumericField(usageMetadata, "prompt_token_count", "candidates_token_count", "total_token_count")) {
        usage = GeminiCompletion.extractTokenUsage(chunk);
      }

      const candidates = Array.isArray(chunk.candidates) ? chunk.candidates : [];
      const candidate = readObject(candidates[0]);
      const parts = Array.isArray(readObject(candidate.content).parts)
        ? readObject(candidate.content).parts as unknown[]
        : [];

      for (const rawPart of parts) {
        const part = readObject(rawPart);
        const functionCall = readObject(part.functionCall ?? part.function_call);
        if (Object.keys(functionCall).length > 0) {
          const index = functionCalls.length;
          const args = readObject(functionCall.args);
          functionCalls.push({
            id: `call_${index.toString()}`,
            type: "function",
            function: {
              name: scalarToString(functionCall.name) ?? "",
              arguments: JSON.stringify(args),
            },
            args,
            index,
            raw_part: rawPart,
          });
        } else if (part.thought === true && typeof part.text === "string") {
          thinkingText += part.text;
        } else if (typeof part.text === "string") {
          text += part.text;
        }
      }
    }

    if (usage) {
      this.trackTokenUsageInternal(usage);
    }

    return {
      text,
      function_calls: functionCalls,
      usage,
      thinking_text: thinkingText,
      response_id: responseId,
    };
  }

  _accumulate_stream_chunks(chunks: readonly unknown[]): {
    text: string;
    function_calls: Record<string, unknown>[];
    usage: Record<string, number> | null;
    thinking_text: string;
    response_id: string | null;
  } {
    return this.accumulateStreamChunks(chunks);
  }
}

export type SnowflakeCompletionOptions = OpenAICompletionOptions & {
  account_url?: string | null;
  accountUrl?: string | null;
  account_identifier?: string | null;
  accountIdentifier?: string | null;
  account?: string | null;
  snowflake_account?: string | null;
  snowflakeAccount?: string | null;
  database?: string | null;
  schema_name?: string | null;
  schemaName?: string | null;
  warehouse?: string | null;
  role?: string | null;
};

export class SnowflakeCompletion extends OpenAICompletion {
  readonly accountUrl: string;
  readonly account_url: string;
  readonly accountIdentifier: string | null;
  readonly account_identifier: string | null;
  readonly database: string | null;
  readonly schemaName: string | null;
  readonly schema_name: string | null;
  readonly warehouse: string | null;
  readonly role: string | null;

  constructor(options: SnowflakeCompletionOptions = { model: "claude-3-5-sonnet" }) {
    if (options.api && options.api !== "completions") {
      throw new Error("Snowflake Cortex native provider supports only the Chat Completions API");
    }
    const apiKey = SnowflakeCompletion.resolveToken(options.apiKey ?? options.api_key ?? null);
    const accountUrl = SnowflakeCompletion.resolveBaseUrl(options);
    super({
      ...options,
      provider: "snowflake",
      api: "completions",
      apiKey,
      api_key: apiKey,
      baseUrl: accountUrl,
      base_url: accountUrl,
    });
    this.accountUrl = accountUrl;
    this.account_url = accountUrl;
    this.accountIdentifier = options.accountIdentifier
      ?? options.account_identifier
      ?? options.account
      ?? options.snowflakeAccount
      ?? options.snowflake_account
      ?? null;
    this.account_identifier = this.accountIdentifier;
    this.database = options.database ?? null;
    this.schemaName = options.schemaName ?? options.schema_name ?? null;
    this.schema_name = this.schemaName;
    this.warehouse = options.warehouse ?? null;
    this.role = options.role ?? null;
  }

  static normalizeSnowflakeBaseUrl(value: string): string {
    let baseUrl = value.trim().replace(/\/+$/u, "");
    if (baseUrl.length === 0) {
      throw new Error("Snowflake account URL cannot be empty");
    }
    if (!baseUrl.includes("://")) {
      baseUrl = `https://${baseUrl}`;
    }
    if (baseUrl.endsWith(SNOWFLAKE_CORTEX_PATH)) {
      return baseUrl;
    }
    if (baseUrl.includes("/api/v2/cortex")) {
      throw new Error(
        `Snowflake base URL must be the account URL or Cortex API root ending in ${SNOWFLAKE_CORTEX_PATH}; do not include endpoint paths.`,
      );
    }
    return `${baseUrl}${SNOWFLAKE_CORTEX_PATH}`;
  }

  static _normalize_snowflake_base_url(value: string): string {
    return SnowflakeCompletion.normalizeSnowflakeBaseUrl(value);
  }

  static baseUrlFromAccountIdentifier(accountIdentifier: string): string {
    const account = accountIdentifier.trim();
    if (account.length === 0) {
      throw new Error("Snowflake account identifier cannot be empty");
    }
    return SnowflakeCompletion.normalizeSnowflakeBaseUrl(`${account}.snowflakecomputing.com`);
  }

  static _base_url_from_account_identifier(accountIdentifier: string): string {
    return SnowflakeCompletion.baseUrlFromAccountIdentifier(accountIdentifier);
  }

  static resolveToken(apiKey: string | null | undefined): string {
    let token = apiKey ?? null;
    if (!token) {
      for (const envVar of SNOWFLAKE_TOKEN_ENV_VARS) {
        token = process.env[envVar] ?? null;
        if (token) {
          break;
        }
      }
    }
    if (!token) {
      throw new Error("Snowflake token is required. Set SNOWFLAKE_PAT, SNOWFLAKE_TOKEN, or SNOWFLAKE_JWT, or pass api_key.");
    }
    return token.startsWith("pat/") ? token.slice(4) : token;
  }

  static _resolve_token(apiKey: string | null | undefined): string {
    return SnowflakeCompletion.resolveToken(apiKey);
  }

  static resolveBaseUrl(data: SnowflakeCompletionOptions): string {
    const explicitBaseUrl = data.baseUrl ?? data.base_url ?? data.apiBase ?? data.api_base ?? null;
    if (explicitBaseUrl) {
      return SnowflakeCompletion.normalizeSnowflakeBaseUrl(explicitBaseUrl);
    }
    const accountUrl = data.accountUrl ?? data.account_url ?? process.env.SNOWFLAKE_ACCOUNT_URL ?? null;
    if (accountUrl) {
      return SnowflakeCompletion.normalizeSnowflakeBaseUrl(accountUrl);
    }
    const accountIdentifier = data.accountIdentifier
      ?? data.account_identifier
      ?? data.account
      ?? data.snowflakeAccount
      ?? data.snowflake_account
      ?? process.env.SNOWFLAKE_ACCOUNT
      ?? process.env.SNOWFLAKE_ACCOUNT_ID
      ?? process.env.SNOWFLAKE_ACCOUNT_IDENTIFIER
      ?? null;
    if (accountIdentifier) {
      return SnowflakeCompletion.baseUrlFromAccountIdentifier(accountIdentifier);
    }
    throw new Error(
      "Snowflake account URL is required. Set SNOWFLAKE_ACCOUNT_URL or SNOWFLAKE_ACCOUNT, or pass account_url/base_url/account_identifier.",
    );
  }

  static _resolve_base_url(data: SnowflakeCompletionOptions): string {
    return SnowflakeCompletion.resolveBaseUrl(data);
  }

  override formatMessages(messages: LLMMessageInput): LLMMessage[] {
    let formattedMessages = SnowflakeCompletion.hasProviderContentBlocks(messages)
      ? SnowflakeCompletion.formatProviderContentBlockMessages(messages)
      : super.formatMessages(messages);
    if (!this.isClaudeModel()) {
      return formattedMessages;
    }
    formattedMessages = SnowflakeCompletion.normalizeStringifiedToolCalls(formattedMessages);
    formattedMessages = SnowflakeCompletion.removeIncompleteClaudeToolUses(formattedMessages);
    return SnowflakeCompletion.ensureClaudeConversationEndsWithUser(formattedMessages);
  }

  override _format_messages(messages: LLMMessageInput): LLMMessage[] {
    return this.formatMessages(messages);
  }

  static hasProviderContentBlocks(messages: LLMMessageInput): boolean {
    return Array.isArray(messages) && messages.some((message) => !Array.isArray(message) && Array.isArray(readObject(message).content));
  }

  static formatProviderContentBlockMessages(messages: LLMMessageInput): LLMMessage[] {
    if (typeof messages === "string") {
      return [{ role: "user", content: messages }];
    }
    return messages.map((message, index) => {
      if (Array.isArray(message)) {
        throw new Error(`Message at index ${String(index)} must be a dictionary.`);
      }
      if (!LLM_ROLES.has(String(message.role)) || (typeof message.content !== "string" && !Array.isArray(message.content))) {
        throw new Error(`Message at index ${String(index)} must have 'role' and 'content' keys.`);
      }
      const copy = { ...message };
      stripCacheBreakpoint(copy);
      return copy as LLMMessage;
    });
  }

  isClaudeModel(): boolean {
    const model = this.model.toLowerCase();
    return model.startsWith("claude-") || model.startsWith("anthropic.");
  }

  _is_claude_model(): boolean {
    return this.isClaudeModel();
  }

  static normalizeStringifiedToolCalls(messages: readonly LLMMessage[]): LLMMessage[] {
    return messages.map((message) => {
      const toolCalls = readObject(message).tool_calls;
      if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
        return { ...message };
      }
      let changed = false;
      const normalizedToolCalls: unknown[] = [];
      for (const toolCall of toolCalls) {
        if (typeof toolCall !== "string") {
          normalizedToolCalls.push(toolCall);
          continue;
        }
        const parsed = parsePythonishObjectLiteral(toolCall);
        if (parsed !== null) {
          changed = true;
          normalizedToolCalls.push(parsed);
          continue;
        }
        normalizedToolCalls.push(toolCall);
      }
      return changed
        ? { ...message, tool_calls: normalizedToolCalls } as LLMMessage
        : { ...message };
    });
  }

  static _normalize_stringified_tool_calls(messages: readonly LLMMessage[]): LLMMessage[] {
    return SnowflakeCompletion.normalizeStringifiedToolCalls(messages);
  }

  static removeIncompleteClaudeToolUses(messages: readonly LLMMessage[]): LLMMessage[] {
    const sanitized: LLMMessage[] = [];
    let index = 0;

    while (index < messages.length) {
      const message = messages[index] as LLMMessage & Record<string, unknown>;
      const expectedIds = SnowflakeCompletion.extractClaudeToolUseIds(message);
      if (message.role !== "assistant" || expectedIds.size === 0) {
        sanitized.push({ ...message });
        index += 1;
        continue;
      }

      const toolResultIds = new Set<string>();
      let lookahead = index + 1;
      while (lookahead < messages.length && SnowflakeCompletion.isToolResultMessage(messages[lookahead] as LLMMessage & Record<string, unknown>)) {
        for (const id of SnowflakeCompletion.extractClaudeToolResultIds(messages[lookahead] as LLMMessage & Record<string, unknown>)) {
          toolResultIds.add(id);
        }
        lookahead += 1;
      }

      if ([...expectedIds].every((id) => toolResultIds.has(id))) {
        const summary = SnowflakeCompletion.summarizeToolResults(messages.slice(index + 1, lookahead), expectedIds);
        if (summary) {
          sanitized.push({ role: "user", content: summary });
        }
      }

      index = lookahead;
    }

    return sanitized;
  }

  static _remove_incomplete_claude_tool_uses(messages: readonly LLMMessage[]): LLMMessage[] {
    return SnowflakeCompletion.removeIncompleteClaudeToolUses(messages);
  }

  static summarizeToolResults(messages: readonly LLMMessage[], expectedIds: Set<string>): string {
    const summaries: string[] = [];
    for (const message of messages) {
      const resultIds = SnowflakeCompletion.extractClaudeToolResultIds(message);
      if (![...resultIds].some((id) => expectedIds.has(id))) {
        continue;
      }
      const name = scalarToString(readObject(message).name) ?? "tool";
      const content = readObject(message).content;
      if (typeof content === "string") {
        summaries.push(`${name}: ${content}`);
      } else if (Array.isArray(content)) {
        const extractedText = SnowflakeCompletion.extractToolResultText(content, expectedIds);
        summaries.push(`${name}: ${extractedText || String(content)}`);
      }
    }
    return summaries.length === 0
      ? ""
      : `Tool results from previous tool calls:\n${summaries.map((summary) => `- ${summary}`).join("\n")}`;
  }

  static _summarize_tool_results(messages: readonly LLMMessage[], expectedIds: Set<string>): string {
    return SnowflakeCompletion.summarizeToolResults(messages, expectedIds);
  }

  static extractToolResultText(content: readonly unknown[], expectedIds: Set<string> | null = null): string {
    const texts: string[] = [];
    for (const item of content) {
      const toolResult = readObject(readObject(item).toolResult);
      const toolUseId = scalarToString(toolResult.toolUseId);
      if (expectedIds && (toolUseId === null || !expectedIds.has(toolUseId))) {
        continue;
      }
      const resultContent = toolResult.content;
      if (!Array.isArray(resultContent)) {
        continue;
      }
      for (const inner of resultContent) {
        const text = scalarToString(readObject(inner).text);
        if (text !== null) {
          texts.push(text);
        }
      }
    }
    return texts.join(" ");
  }

  static _extract_tool_result_text(content: readonly unknown[]): string {
    return SnowflakeCompletion.extractToolResultText(content);
  }

  static extractClaudeToolUseIds(message: LLMMessage & Record<string, unknown>): Set<string> {
    const ids = new Set<string>();
    const toolCalls = message.tool_calls;
    if (Array.isArray(toolCalls)) {
      for (const toolCall of toolCalls) {
        const id = scalarToString(readObject(toolCall).id);
        if (id !== null) {
          ids.add(id);
        }
      }
    }
    const content = message.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        const toolUseId = scalarToString(readObject(readObject(block).toolUse).toolUseId);
        if (toolUseId !== null) {
          ids.add(toolUseId);
        }
      }
    }
    return ids;
  }

  static _extract_claude_tool_use_ids(message: LLMMessage & Record<string, unknown>): Set<string> {
    return SnowflakeCompletion.extractClaudeToolUseIds(message);
  }

  static extractClaudeToolResultIds(message: LLMMessage & Record<string, unknown>): Set<string> {
    const ids = new Set<string>();
    const toolCallId = scalarToString(message.tool_call_id);
    if (toolCallId !== null) {
      ids.add(toolCallId);
    }
    const content = message.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        const toolUseId = scalarToString(readObject(readObject(block).toolResult).toolUseId);
        if (toolUseId !== null) {
          ids.add(toolUseId);
        }
      }
    }
    return ids;
  }

  static _extract_claude_tool_result_ids(message: LLMMessage & Record<string, unknown>): Set<string> {
    return SnowflakeCompletion.extractClaudeToolResultIds(message);
  }

  static isToolResultMessage(message: LLMMessage & Record<string, unknown>): boolean {
    return message.role === "tool" || SnowflakeCompletion.extractClaudeToolResultIds(message).size > 0;
  }

  static _is_tool_result_message(message: LLMMessage & Record<string, unknown>): boolean {
    return SnowflakeCompletion.isToolResultMessage(message);
  }

  static ensureClaudeConversationEndsWithUser(messages: readonly LLMMessage[]): LLMMessage[] {
    if (messages.length === 0) {
      return [{ role: "user", content: "Hello" }];
    }
    let normalizedMessages = [...messages];
    const lastMessage = normalizedMessages.at(-1) as (LLMMessage & Record<string, unknown>) | undefined;
    if (lastMessage?.role === "assistant" && !lastMessage.tool_calls) {
      normalizedMessages = normalizedMessages.slice(0, -1);
    }
    if (normalizedMessages.length === 0) {
      return [{ role: "user", content: "Hello" }];
    }
    if (normalizedMessages.at(-1)?.role === "user") {
      return normalizedMessages.map((message) => ({ ...message }));
    }
    return [
      ...normalizedMessages.map((message) => ({ ...message })),
      { role: "user", content: "Please continue and provide your final answer." },
    ];
  }

  static _ensure_claude_conversation_ends_with_user(messages: readonly LLMMessage[]): LLMMessage[] {
    return SnowflakeCompletion.ensureClaudeConversationEndsWithUser(messages);
  }

  override prepareCompletionParams(messages: readonly LLMMessage[], tools: readonly Tool[] | null = null): Record<string, unknown> {
    const params = super.prepareCompletionParams(messages, tools);
    if (this.isClaudeModel() && "max_tokens" in params) {
      params.max_completion_tokens = params.max_tokens;
      delete params.max_tokens;
    }
    return params;
  }

  override _prepare_completion_params(messages: readonly LLMMessage[], tools: readonly Tool[] | null = null): Record<string, unknown> {
    return this.prepareCompletionParams(messages, tools);
  }

  getSyncClient(env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
    void env;
    const endpoint = `${this.accountUrl.replace(/\/+$/u, "")}/chat/completions`;
    const token = this.api_key ?? "";
    return {
      chat: {
        completions: {
          create: async (params: Record<string, unknown>) => {
            const response = await fetch(endpoint, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(params),
              ...(this.timeout === null ? {} : { signal: AbortSignal.timeout(this.timeout * 1000) }),
            });
            if (!response.ok) {
              throw new Error(`Snowflake completion request failed with status ${String(response.status)}.`);
            }
            return await response.json();
          },
        },
      },
    };
  }

  _get_sync_client(env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
    return this.getSyncClient(env);
  }

  override async call(messages: readonly LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse> {
    const tools = options?.tools as readonly Tool[] | undefined;
    const params = this.prepareCompletionParams(this.formatMessages(messages), tools ?? null);
    const client = this._get_sync_client();
    const completions = readObject(readObject(readObject(client).chat).completions);
    const create = completions.create;
    if (!isCompletionCreate(create)) {
      throw new Error("Snowflake OpenAI-compatible client is missing chat.completions.create.");
    }
    const response = await create(params);
    this.trackTokenUsageInternal(this.extractOpenAITokenUsage(response));

    const choices = readObject(response).choices;
    const firstChoice = Array.isArray(choices) ? readObject(choices[0]) : {};
    const content = readObject(firstChoice.message).content;
    return typeof content === "string" ? content : "";
  }

  override supportsFunctionCalling(): boolean {
    const model = this.model.toLowerCase();
    return model.startsWith("openai-") || model.startsWith("claude-") || model.startsWith("anthropic.");
  }

  override supports_function_calling(): boolean {
    return this.supportsFunctionCalling();
  }

  override supportsMultimodal(): boolean {
    const model = this.model.toLowerCase();
    return model.startsWith("openai-") || model.startsWith("claude-") || model.startsWith("anthropic.");
  }

  override supports_multimodal(): boolean {
    return this.supportsMultimodal();
  }

  override toConfigDict(): Record<string, unknown> {
    return {
      ...super.toConfigDict(),
      account_url: this.accountUrl,
      account_identifier: this.accountIdentifier,
      database: this.database,
      schema_name: this.schemaName,
      warehouse: this.warehouse,
      role: this.role,
    };
  }

  override to_config_dict(): Record<string, unknown> {
    return this.toConfigDict();
  }
}

registerLLMProviderFactory("anthropic", (options) => new AnthropicCompletion(options));
registerLLMProviderFactory("bedrock", (options) => new BedrockCompletion(options));
registerLLMProviderFactory("gemini", (options) => new GeminiCompletion(options));
registerLLMProviderFactory("google", (options) => new GeminiCompletion({ ...options, provider: "gemini" }));
registerLLMProviderFactory("snowflake", (options) => new SnowflakeCompletion(options as SnowflakeCompletionOptions));

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
  readonly api: "completions" | "responses";
  readonly reasoningEffort: string | null;
  readonly reasoning_effort: string | null;
  readonly instructions: string | null;
  readonly store: boolean | null;
  readonly previousResponseId: string | null;
  readonly previous_response_id: string | null;
  readonly include: readonly string[] | null;
  readonly builtinTools: readonly string[] | null;
  readonly builtin_tools: readonly string[] | null;
  readonly parseToolOutputs: boolean;
  readonly parse_tool_outputs: boolean;
  readonly autoChain: boolean;
  readonly auto_chain: boolean;
  readonly autoChainReasoning: boolean;
  readonly auto_chain_reasoning: boolean;
  readonly maxCompletionTokens: number | null;
  readonly max_completion_tokens: number | null;
  readonly _responses_delegate: OpenAICompletion | null;
  _client: Record<string, unknown> | null;
  private responseChainId: string | null;
  private reasoningChainItems: unknown[] | null;

  constructor(options: AzureCompletionOptions = { model: "gpt-4o-mini" }) {
    if (options.interceptor !== null && options.interceptor !== undefined) {
      throw new Error("Azure provider does not support interceptor transport.");
    }
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
    this.interceptor = null;
    this.responseFormat = options.responseFormat ?? options.response_format ?? null;
    this.response_format = this.responseFormat;
    this.isAzureOpenAIEndpoint = isAzureOpenAIEndpoint(endpoint);
    this.is_azure_openai_endpoint = this.isAzureOpenAIEndpoint;
    this.isOpenAIModel = /(?:^|[/:])(gpt-|o1-|text-)/i.test(options.model);
    this.is_openai_model = this.isOpenAIModel;
    const configuredCredentialScopes = options.credentialScopes ?? options.credential_scopes ?? null;
    this.credentialScopes = configuredCredentialScopes && configuredCredentialScopes.length > 0
      ? configuredCredentialScopes
      : AzureCompletion.credentialScopesFromEnv();
    this.credential_scopes = this.credentialScopes;
    this.api = options.api ?? "completions";
    this.reasoningEffort = options.reasoningEffort ?? options.reasoning_effort ?? null;
    this.reasoning_effort = this.reasoningEffort;
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
    this.maxCompletionTokens = options.maxCompletionTokens ?? options.max_completion_tokens ?? null;
    this.max_completion_tokens = this.maxCompletionTokens;
    this.responseChainId = this.previousResponseId;
    this.reasoningChainItems = null;
    this._client = null;
    this._responses_delegate = this.api === "responses"
      ? new OpenAICompletion(stripUndefined({
        model: azureResponsesModelName(options.model),
        provider: "openai",
        api: "responses",
        apiKey: options.apiKey,
        api_key: options.api_key ?? process.env.AZURE_API_KEY ?? null,
        baseUrl: azureResponsesBaseUrl(endpoint ?? this.baseUrl),
        base_url: azureResponsesBaseUrl(endpoint ?? this.baseUrl),
        temperature: options.temperature,
        topP: this.topP,
        top_p: this.topP,
        maxTokens: this.maxTokens,
        max_tokens: this.maxTokens,
        maxCompletionTokens: this.maxCompletionTokens,
        max_completion_tokens: this.maxCompletionTokens,
        reasoningEffort: this.reasoningEffort,
        reasoning_effort: this.reasoningEffort,
        instructions: this.instructions,
        store: this.store,
        previousResponseId: this.previousResponseId,
        previous_response_id: this.previousResponseId,
        include: this.include ? [...this.include] : null,
        builtinTools: this.builtinTools ? [...this.builtinTools] : null,
        builtin_tools: this.builtinTools ? [...this.builtinTools] : null,
        parseToolOutputs: this.parseToolOutputs,
        parse_tool_outputs: this.parseToolOutputs,
        autoChain: this.autoChain,
        auto_chain: this.autoChain,
        autoChainReasoning: this.autoChainReasoning,
        auto_chain_reasoning: this.autoChainReasoning,
        stream: this.stream,
        stop: options.stop,
        stopSequences: options.stopSequences,
        stop_sequences: options.stop_sequences,
        additionalParams: options.additionalParams,
        additional_params: options.additional_params,
      }) as ConstructorParameters<typeof OpenAICompletion>[0])
      : null;
  }

  override call(messages: readonly LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse> {
    if (this._responses_delegate) {
      return this._responses_delegate.call(messages, options);
    }
    return super.call(messages, options);
  }

  override async acall(messages: LLMMessageInput, options?: LLMCallOptions): Promise<LLMResponse> {
    if (this._responses_delegate) {
      return await this._responses_delegate.acall(messages, options);
    }
    return await super.acall(messages, options);
  }

  async aclose(): Promise<void> {
    await Promise.resolve();
  }

  override supportsFunctionCalling(): boolean {
    if (this._responses_delegate) {
      return this._responses_delegate.supportsFunctionCalling();
    }
    return this.isOpenAIModel;
  }

  override supports_function_calling(): boolean {
    return this.supportsFunctionCalling();
  }

  override supportsStopWords(): boolean {
    const model = this.model.toLowerCase();
    if (model.includes("gpt-5")) {
      return false;
    }
    return !["o1", "o3", "o4", "o1-mini", "o3-mini", "o4-mini", "computer-use-preview"]
      .some((unsupported) => model.includes(unsupported));
  }

  override supports_stop_words(): boolean {
    return this.supportsStopWords();
  }

  override supportsMultimodal(): boolean {
    return super.supportsMultimodal();
  }

  override supports_multimodal(): boolean {
    return this.supportsMultimodal();
  }

  override getContextWindowSize(): number {
    return super.getContextWindowSize();
  }

  override get_context_window_size(): number {
    return this.getContextWindowSize();
  }

  override get lastResponseId(): string | null {
    if (this._responses_delegate) {
      return this._responses_delegate.lastResponseId;
    }
    return this.responseChainId;
  }

  override get last_response_id(): string | null {
    return this.lastResponseId;
  }

  override get lastReasoningItems(): readonly unknown[] | null {
    if (this._responses_delegate) {
      return this._responses_delegate.lastReasoningItems;
    }
    return this.reasoningChainItems ? [...this.reasoningChainItems] : null;
  }

  override get last_reasoning_items(): readonly unknown[] | null {
    return this.lastReasoningItems;
  }

  override resetChain(): void {
    if (this._responses_delegate) {
      this._responses_delegate.resetChain();
      return;
    }
    this.responseChainId = null;
  }

  override reset_chain(): void {
    this.resetChain();
  }

  override resetReasoningChain(): void {
    if (this._responses_delegate) {
      this._responses_delegate.resetReasoningChain();
      return;
    }
    this.reasoningChainItems = null;
  }

  override reset_reasoning_chain(): void {
    this.resetReasoningChain();
  }

  override toConfigDict(): Record<string, unknown> {
    return {
      ...super.toConfigDict(),
      ...(this.endpoint === null ? {} : { endpoint: this.endpoint }),
      ...(this.apiVersion === null ? {} : { api_version: this.apiVersion }),
      ...(this.timeout === null ? {} : { timeout: this.timeout }),
      ...(this.maxRetries === 2 ? {} : { max_retries: this.maxRetries }),
      ...(this.topP === null ? {} : { top_p: this.topP }),
      ...(this.frequencyPenalty === null ? {} : { frequency_penalty: this.frequencyPenalty }),
      ...(this.presencePenalty === null ? {} : { presence_penalty: this.presencePenalty }),
      ...(this.maxTokens === null ? {} : { max_tokens: this.maxTokens }),
      ...(this.api === "responses" ? { api: "responses" } : {}),
      ...(this.reasoningEffort === null ? {} : { reasoning_effort: this.reasoningEffort }),
      ...(this.instructions === null ? {} : { instructions: this.instructions }),
      ...(this.store === null ? {} : { store: this.store }),
      ...(this.previousResponseId === null ? {} : { previous_response_id: this.previousResponseId }),
      ...(this.include === null ? {} : { include: [...this.include] }),
      ...(this.builtinTools === null ? {} : { builtin_tools: [...this.builtinTools] }),
      ...(this.parseToolOutputs ? { parse_tool_outputs: true } : {}),
      ...(this.autoChain ? { auto_chain: true } : {}),
      ...(this.autoChainReasoning ? { auto_chain_reasoning: true } : {}),
      ...(this.maxCompletionTokens === null ? {} : { max_completion_tokens: this.maxCompletionTokens }),
    };
  }

  override to_config_dict(): Record<string, unknown> {
    return this.toConfigDict();
  }

  makeClientKwargs(env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
    const apiKey = this.apiKey ?? env.AZURE_API_KEY ?? null;
    const endpoint = this.endpoint ?? env.AZURE_ENDPOINT ?? env.AZURE_OPENAI_ENDPOINT ?? env.AZURE_API_BASE ?? null;
    const credentialScopes = this.credentialScopes ?? AzureCompletion.credentialScopesFromEnv(env);
    const updates: Record<string, unknown> = {};
    if (apiKey && this.apiKey !== apiKey) {
      updates.apiKey = apiKey;
      updates.api_key = apiKey;
    }
    if (endpoint && this.endpoint !== endpoint) {
      const isAzureEndpoint = isAzureOpenAIEndpoint(endpoint);
      updates.endpoint = endpoint;
      updates.baseUrl = endpoint;
      updates.base_url = endpoint;
      updates.isAzureOpenAIEndpoint = isAzureEndpoint;
      updates.is_azure_openai_endpoint = isAzureEndpoint;
    }
    if (credentialScopes && this.credentialScopes !== credentialScopes) {
      updates.credentialScopes = credentialScopes;
      updates.credential_scopes = credentialScopes;
    }
    if (Object.keys(updates).length > 0) {
      Object.assign(this, updates);
    }
    return {
      endpoint,
      api_key: apiKey,
      api_version: this.apiVersion,
      ...(credentialScopes ? { credential_scopes: credentialScopes } : {}),
    };
  }

  _make_client_kwargs(env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
    return this.makeClientKwargs(env);
  }

  getSyncClient(env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
    if (this._client) {
      return this._client;
    }
    const kwargs = this.makeClientKwargs(env);
    if (!kwargs.endpoint) {
      throw new Error("Azure endpoint is required");
    }
    if (!kwargs.api_key) {
      throw new Error("Azure API key is required");
    }
    this._client = {
      provider: "azure",
      model: this.model,
      ...kwargs,
    };
    return this._client;
  }

  _get_sync_client(env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
    return this.getSyncClient(env);
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

  prepareResponsesParams(
    messages: readonly LLMMessage[],
    tools: readonly Tool[] | null = null,
    responseModel: unknown = null,
  ): Record<string, unknown> {
    if (!this._responses_delegate) {
      throw new Error("Azure Responses API is only available when api is set to 'responses'.");
    }
    return this._responses_delegate.prepareResponsesParams(messages, tools, responseModel);
  }

  _prepare_responses_params(
    messages: readonly LLMMessage[],
    tools: readonly Tool[] | null = null,
    responseModel: unknown = null,
  ): Record<string, unknown> {
    return this.prepareResponsesParams(messages, tools, responseModel);
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

  static credentialScopesFromEnv(env: NodeJS.ProcessEnv = process.env): string[] | null {
    const raw = env.AZURE_CREDENTIAL_SCOPES;
    if (!raw) {
      return null;
    }
    const scopes = raw.split(",").map((scope) => scope.trim()).filter((scope) => scope.length > 0);
    return scopes.length > 0 ? scopes : null;
  }

  static _credential_scopes_from_env(): string[] | null {
    return AzureCompletion.credentialScopesFromEnv();
  }

  extractAzureTokenUsage(response: unknown): Record<string, number> {
    return AzureCompletion.extractAzureTokenUsage(response);
  }

  _extract_azure_token_usage(response: unknown): Record<string, number> {
    return this.extractAzureTokenUsage(response);
  }

  static extractAzureTokenUsage(response: unknown): Record<string, number> {
    const usage = readObject(readObject(response).usage);
    if (!hasNumericField(usage, "prompt_tokens", "completion_tokens", "total_tokens")) {
      return { total_tokens: 0 };
    }
    const promptDetails = readObject(usage.prompt_tokens_details);
    const completionDetails = readObject(usage.completion_tokens_details);
    return {
      prompt_tokens: numberField(usage, "prompt_tokens"),
      completion_tokens: numberField(usage, "completion_tokens"),
      total_tokens: numberField(usage, "total_tokens"),
      cached_prompt_tokens: numberField(promptDetails, "cached_tokens"),
      reasoning_tokens: numberField(completionDetails, "reasoning_tokens"),
    };
  }

  static extract_azure_token_usage(response: unknown): Record<string, number> {
    return AzureCompletion.extractAzureTokenUsage(response);
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

function isAnthropicRole(value: unknown): value is LLMMessage["role"] {
  return value === "system" || value === "user" || value === "assistant" || value === "tool";
}

function anthropicContentToText(content: unknown): string {
  if (Array.isArray(content)) {
    return content
      .map((block) => scalarToString(readObject(block).text))
      .filter((text): text is string => text !== null)
      .join("\n");
  }
  return scalarToString(content) ?? "";
}

function anthropicCacheMatchText(content: unknown): string | null {
  if (typeof content === "string" && content.length > 0) {
    return content;
  }
  if (!Array.isArray(content)) {
    return null;
  }
  const textBlocks = content
    .map((block) => scalarToString(readObject(block).text))
    .filter((text): text is string => text !== null);
  return textBlocks.length === 1 ? textBlocks[0] ?? null : null;
}

function anthropicToolUseBlock(toolCall: unknown): Record<string, unknown> | null {
  const toolCallRecord = readObject(toolCall);
  const functionRecord = readObject(toolCallRecord.function);
  const name = scalarToString(functionRecord.name);
  if (!name) {
    return null;
  }
  return {
    type: "tool_use",
    id: scalarToString(toolCallRecord.id) ?? "",
    name,
    input: parseToolArguments(functionRecord.arguments),
  };
}

function normalizeOpenAIFunctionToolSchemas(tools: readonly unknown[]): Array<{
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}> {
  return tools.map((tool) => {
    const toolRecord = readObject(tool);
    const functionRecord = readObject(toolRecord.function);
    const rawName = scalarToString(functionRecord.name);
    if (toolRecord.type === "function" && rawName) {
      return {
        function: {
          name: rawName,
          description: scalarToString(functionRecord.description) ?? "",
          parameters: readObject(functionRecord.parameters),
        },
      };
    }
    const [schemas] = convertToolsToOpenAISchema([tool as Tool]);
    const schema = schemas[0];
    return {
      function: {
        name: schema?.function.name ?? "",
        description: schema?.function.description ?? "",
        parameters: schema?.function.parameters ?? {},
      },
    };
  });
}

function bedrockConverseContentBlocks(blocks: readonly unknown[]): Record<string, unknown>[] {
  return blocks.map((block) => {
    const record = readObject(block);
    if (record.type === "file" && record.source === "inline") {
      const contentType = scalarToString(record.content_type) ?? scalarToString(record.contentType) ?? "";
      const content = scalarToString(record.content) ?? "";
      if (contentType.startsWith("image/")) {
        return {
          image: {
            format: bedrockInlineImageFormat(contentType, scalarToString(record.filename)),
            source: { bytes: content },
          },
        };
      }
      const documentFormat = bedrockInlineDocumentFormat(contentType, scalarToString(record.filename));
      if (documentFormat) {
        return {
          document: {
            name: bedrockDocumentName(scalarToString(record.filename) ?? scalarToString(record.name) ?? "document"),
            format: documentFormat,
            source: { bytes: content },
          },
        };
      }
    }
    if (record.type === "text" && typeof record.text === "string") {
      return { text: record.text };
    }
    return { ...record };
  });
}

function bedrockInlineImageFormat(contentType: string, filename: string | null): string {
  const lower = contentType.toLowerCase();
  if (lower.includes("png")) {
    return "png";
  }
  if (lower.includes("jpeg") || lower.includes("jpg")) {
    return "jpeg";
  }
  if (lower.includes("gif")) {
    return "gif";
  }
  if (lower.includes("webp")) {
    return "webp";
  }
  const extension = filename?.split(".").pop()?.toLowerCase();
  return extension === "jpg" ? "jpeg" : extension || "png";
}

function bedrockInlineDocumentFormat(contentType: string, filename: string | null): string | null {
  const lower = contentType.toLowerCase();
  if (lower === "application/pdf") {
    return "pdf";
  }
  if (lower === "text/csv") {
    return "csv";
  }
  if (lower === "text/plain") {
    return "txt";
  }
  if (lower === "text/markdown") {
    return "md";
  }
  if (lower === "text/html") {
    return "html";
  }
  const extension = filename?.split(".").pop()?.toLowerCase();
  if (extension && ["pdf", "csv", "txt", "md", "html", "doc", "docx", "xls", "xlsx"].includes(extension)) {
    return extension;
  }
  return null;
}

function bedrockDocumentName(filename: string): string {
  const name = filename.replace(/\.[^.]+$/u, "");
  const sanitized = name.replace(/[^\p{L}\p{N}\s\-()[\]]/gu, " ").replace(/\s+/gu, " ").trim();
  return sanitized || "document";
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

function parsePythonishObjectLiteral(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    // Fall through to a narrow Python dict-literal compatibility parser.
  }
  try {
    const normalized = value
      .replace(/\bNone\b/gu, "null")
      .replace(/\bTrue\b/gu, "true")
      .replace(/\bFalse\b/gu, "false")
      .replace(/'((?:\\.|[^'\\])*)'/gu, (_match, inner: string) => JSON.stringify(inner.replace(/\\'/gu, "'")));
    const parsed: unknown = JSON.parse(normalized);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
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

function anthropicResponseContent(response: unknown): unknown[] {
  const content = readObject(response).content;
  return Array.isArray(content) ? content : [];
}

function bedrockResponseContent(response: unknown): unknown[] {
  const output = readObject(readObject(response).output);
  const message = readObject(output.message);
  return Array.isArray(message.content) ? message.content : [];
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

function azureResponsesModelName(model: string): string {
  return model.replace(/^azure\//i, "");
}

function azureResponsesBaseUrl(endpoint: string | null | undefined): string | null {
  if (!endpoint) {
    return null;
  }
  try {
    const url = new URL(endpoint);
    return `${url.origin}/openai/v1/`;
  } catch {
    const trimmed = endpoint.replace(/\/+$/, "");
    const deploymentIndex = trimmed.toLowerCase().indexOf("/openai/deployments/");
    if (deploymentIndex >= 0) {
      return `${trimmed.slice(0, deploymentIndex)}/openai/v1/`;
    }
    return `${trimmed.replace(/\/openai(?:\/v1)?$/i, "")}/openai/v1/`;
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

function hasNumericField(record: Record<string, unknown>, ...fields: string[]): boolean {
  return fields.some((field) => typeof record[field] === "number" && Number.isFinite(record[field]));
}

function isCompletionCreate(value: unknown): value is (params: Record<string, unknown>) => unknown {
  return typeof value === "function";
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
