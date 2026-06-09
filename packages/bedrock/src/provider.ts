import { ConfiguredLLM, LocalFileUploader, registerLLMProviderFactory, type BaseLLMOptions, type LLMAvailableFunction, type LLMCallOptions, type LLMMessageInput, type LLMResponse } from "@crewai-ts/core/llm";
import { generateModelDescription, type JsonSchema } from "@crewai-ts/core/schema-utils";
import type { LLMMessage, Tool } from "@crewai-ts/core/types";

export const STRUCTURED_OUTPUT_TOOL_NAME = "structured_output";
export const ToolInputSchema = Object.freeze({ kind: "ToolInputSchema" });
export const ToolSpec = Object.freeze({ kind: "ToolSpec" });
export const ConverseToolTypeDef = Object.freeze({ kind: "ConverseToolTypeDef" });
export const BedrockConverseRequestBody = Object.freeze({ kind: "BedrockConverseRequestBody" });
export const BedrockConverseStreamRequestBody = Object.freeze({ kind: "BedrockConverseStreamRequestBody" });

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
    this.regionName = options.regionName
      ?? options.region_name
      ?? process.env.AWS_DEFAULT_REGION
      ?? process.env.AWS_REGION_NAME
      ?? process.env.AWS_REGION
      ?? "us-east-1";
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

  override async call(messages: readonly LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse> {
    if (this.stream) {
      throw new Error("Bedrock streaming responses are not supported by the built-in client transport yet.");
    }
    const client = this.getConverseClient();
    const { messages: formattedMessages, body } = this.prepareConverseRequestBody(
      messages,
      (options?.tools ?? null) as readonly Tool[] | null,
    );
    const request = {
      modelId: this.model,
      messages: formattedMessages,
      ...body,
    };
    const response = await client.converse(request);
    this.trackTokenUsageInternal(readObject(readObject(response).usage));
    const toolUses = BedrockCompletion.extractToolUsesFromResponse(response);
    const availableFunctions = (options?.availableFunctions ?? options?.available_functions ?? null) as Record<string, LLMAvailableFunction> | null;
    if (toolUses.length > 0) {
      if (availableFunctions && Object.keys(availableFunctions).length > 0) {
        const executed = await this.executeToolUseAndPrepareMessages(formattedMessages, toolUses[0], availableFunctions);
        return executed.result as LLMResponse;
      }
      return toolUses as unknown as LLMResponse;
    }
    return bedrockResponseText(response);
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
    return {
      ...super.toConfigDict(),
      ...(this.regionName && this.regionName !== "us-east-1" ? { region_name: this.regionName } : {}),
      ...(this.maxTokens === null ? {} : { max_tokens: this.maxTokens }),
      ...(this.topP === null ? {} : { top_p: this.topP }),
      ...(this.topK === null ? {} : { top_k: this.topK }),
      ...(this.guardrailConfig ? { guardrail_config: this.guardrailConfig } : {}),
    };
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

  private getConverseClient(): { converse: (request: Record<string, unknown>) => unknown } {
    const direct = readObject(this.session).converse;
    if (typeof direct === "function") {
      return { converse: (request) => Reflect.apply(direct, this.session, [request]) as unknown };
    }
    const clientFactory = readObject(this.session).client;
    if (typeof clientFactory === "function") {
      const client = Reflect.apply(clientFactory, this.session, [
        "bedrock-runtime",
        this.regionName ? { region: this.regionName } : undefined,
      ]) as unknown;
      const converse = readObject(client).converse;
      if (typeof converse === "function") {
        return { converse: (request) => Reflect.apply(converse, client, [request]) as unknown };
      }
    }
    throw new Error("Bedrock live calls require a session/client with a converse(request) method.");
  }

}


export function registerBedrockProvider(): void {
  registerLLMProviderFactory("bedrock", (options) => new BedrockCompletion(options as BedrockCompletionOptions));
  registerLLMProviderFactory("aws", (options) => new BedrockCompletion({ ...options, provider: "bedrock" } as BedrockCompletionOptions));
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

function bedrockResponseContent(response: unknown): unknown[] {
  const output = readObject(readObject(response).output);
  const message = readObject(output.message);
  return Array.isArray(message.content) ? message.content : [];
}

function bedrockResponseText(response: unknown): string {
  return bedrockResponseContent(response)
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
