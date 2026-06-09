import { ConfiguredLLM, LocalFileUploader, registerLLMProviderFactory, type BaseLLMOptions, type LLMAvailableFunction, type LLMCallOptions, type LLMMessageInput, type LLMResponse } from "@crewai-ts/core/llm";
import { generateModelDescription, sanitizeToolParamsForAnthropicStrict, type JsonSchema } from "@crewai-ts/core/schema-utils";
import type { LLMMessage, Tool } from "@crewai-ts/core/types";


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
      responseFormat: options.responseFormat,
      response_format: options.response_format,
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

  override async call(messages: readonly LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse> {
    const apiKey = this.apiKey;
    if (!apiKey) {
      throw new Error("Anthropic API key required. Pass api_key when constructing AnthropicCompletion.");
    }
    if (this.stream) {
      throw new Error("Anthropic streaming responses are not supported by the built-in HTTP transport yet.");
    }

    const [formattedMessages, systemMessage] = this.formatMessagesForAnthropic(messages);
    const availableFunctions = (options?.availableFunctions ?? options?.available_functions ?? null) as Record<string, LLMAvailableFunction> | null;
    const params = this.prepareCompletionParams(
      formattedMessages as LLMMessage[],
      systemMessage,
      (options?.tools ?? null) as readonly Tool[] | null,
      availableFunctions,
    );
    const schema = anthropicResponseSchema(options?.responseModel ?? this.responseFormat);
    if (schema) {
      const tools = Array.isArray(params.tools)
        ? params.tools.filter((tool): tool is Record<string, unknown> => typeof tool === "object" && tool !== null)
        : [];
      tools.push({
        name: STRUCTURED_OUTPUT_TOOL_NAME,
        description: "Use this tool to provide your final structured response in the required JSON shape.",
        input_schema: sanitizeToolParamsForAnthropicStrict(structuredClone(schema)),
        strict: true,
      });
      params.tools = tools;
      params.tool_choice = { type: "tool", name: STRUCTURED_OUTPUT_TOOL_NAME };
    }
    const baseUrl = this.baseUrl ?? "https://api.anthropic.com";
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(params),
      ...(options?.signal ? { signal: options.signal } : {}),
    });
    const body: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = readObject(readObject(body).error);
      throw new Error(scalarToString(error.message) ?? `Anthropic request failed with HTTP ${response.status.toString()}.`);
    }

    const usage = this.extractAnthropicTokenUsage(body);
    if (usage.total_tokens !== 0) {
      this.trackTokenUsageInternal(usage);
    }
    const thinkingBlocks = AnthropicCompletion.extractThinkingBlocksFromResponse(body);
    if (thinkingBlocks.length > 0) {
      this.previousThinkingBlocks = thinkingBlocks;
      this._previous_thinking_blocks = this.previousThinkingBlocks;
    }

    const structuredOutput = AnthropicCompletion.extractStructuredOutputFromResponse(body);
    if (structuredOutput) {
      return structuredOutput as unknown as LLMResponse;
    }

    const toolUses = AnthropicCompletion.extractToolUsesFromResponse(body);
    if (toolUses.length > 0) {
      if (availableFunctions && Object.keys(availableFunctions).length > 0) {
        return await this.executeFirstTool(toolUses, availableFunctions) as LLMResponse;
      }
      return toolUses as unknown as LLMResponse;
    }

    return this.applyStopWords(anthropicResponseText(body));
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


export function registerAnthropicProvider(): void {
  registerLLMProviderFactory("anthropic", (options) => new AnthropicCompletion(options as AnthropicCompletionOptions));
  registerLLMProviderFactory("claude", (options) => new AnthropicCompletion({ ...options, provider: "anthropic" } as AnthropicCompletionOptions));
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

function anthropicResponseSchema(value: unknown): Record<string, unknown> | null {
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

function anthropicResponseText(response: unknown): string {
  return anthropicResponseContent(response)
    .map((block) => scalarToString(readObject(block).text))
    .filter((text): text is string => text !== null)
    .join("");
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

type OpenAIToolSchema = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    strict: boolean;
  };
};

function convertToolsToOpenAISchema(tools: readonly Tool[]): [OpenAIToolSchema[]] {
  const seen = new Set<string>();
  return [tools.map((tool) => {
    const rawName = scalarToString((tool as { name?: unknown }).name) ?? "tool";
    let sanitizedName = sanitizeToolName(rawName);
    if (seen.has(sanitizedName)) {
      let counter = 2;
      let candidate = sanitizeToolName(`${sanitizedName}_${String(counter)}`);
      while (seen.has(candidate)) {
        counter += 1;
        candidate = sanitizeToolName(`${sanitizedName}_${String(counter)}`);
      }
      sanitizedName = candidate;
    }
    seen.add(sanitizedName);
    return {
      type: "function",
      function: {
        name: sanitizedName,
        description: cleanToolDescription(scalarToString((tool as { description?: unknown }).description) ?? ""),
        parameters: toolParameters(tool),
        strict: true,
      },
    };
  })];
}

function cleanToolDescription(description: string): string {
  const marker = "Tool Description:";
  return description.includes(marker) ? description.split(marker).at(-1)?.trim() ?? "" : description;
}

function toolParameters(tool: Tool): JsonSchema {
  const record = readObject(tool);
  const schema = readObject(record.argsSchema ?? record.args_schema ?? record.schema ?? record.parameters);
  if (Object.keys(schema).length === 0) {
    return {};
  }
  if (isJsonSchemaLike(schema)) {
    const description = schema.description;
    const title = schema.title;
    const modelDescription = generateModelDescription("ToolParameters", schema, { stripNullTypes: false });
    const normalized = modelDescription.json_schema.schema;
    if (title !== undefined) {
      Reflect.deleteProperty(normalized, "title");
    }
    if (description !== undefined) {
      Reflect.deleteProperty(normalized, "description");
    }
    return normalized;
  }
  return normalizeToolArgsSchema(schema);
}

function normalizeToolArgsSchema(schema: Record<string, unknown>): JsonSchema {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [name, spec] of Object.entries(schema)) {
    const field = readObject(spec);
    properties[name] = {
      ...(scalarToString(field.type) ? { type: scalarToString(field.type) } : { type: "object" }),
      ...(scalarToString(field.description) ? { description: scalarToString(field.description) } : {}),
      ...(field.default !== undefined ? { default: field.default } : {}),
      ...(field.enum !== undefined ? { enum: field.enum } : {}),
      ...(field.items !== undefined ? { items: field.items } : {}),
    };
    if (field.required !== false) {
      required.push(name);
    }
  }
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required,
  };
}

function isJsonSchemaLike(schema: Record<string, unknown>): boolean {
  return typeof schema.type === "string"
    || "$defs" in schema
    || "properties" in schema
    || "anyOf" in schema
    || "oneOf" in schema;
}

function sanitizeToolName(name: string, maxLength = 64): string {
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-zA-Z0-9_-]/gu, "_")
    .replace(/_+/gu, "_")
    .replace(/^_+|_+$/gu, "");
  const withValidStart = /^[a-zA-Z_]/u.test(normalized) ? normalized : `_${normalized}`;
  return (withValidStart || "_tool").slice(0, maxLength);
}
