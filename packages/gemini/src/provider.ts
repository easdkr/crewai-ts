import {
  ConfiguredLLM,
  CONTEXT_WINDOW_USAGE_RATIO,
  LocalFileUploader,
  registerLLMProviderFactory,
  type BaseLLMOptions,
  type LLMAvailableFunction,
  type LLMCallOptions,
  type LLMMessageInput,
  type LLMResponse,
} from "@crewai-ts/core/llm";
import type { LLMMessage, Tool } from "@crewai-ts/core/types";

export const GEMINI_MODELS = [
  "gemini-3-pro-preview",
  "gemini-3.5-flash",
  "gemini-3.1-pro-preview",
  "gemini-3.1-pro-preview-customtools",
  "gemini-3.1-flash-lite",
  "gemini-3.1-flash-lite-preview",
  "gemini-3.1-flash-image",
  "gemini-3.1-flash-image-preview",
  "gemini-3.1-flash-tts-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-pro",
  "gemini-2.5-pro-preview-03-25",
  "gemini-2.5-pro-preview-05-06",
  "gemini-2.5-pro-preview-06-05",
  "gemini-2.5-flash",
  "gemini-2.5-flash-preview-05-20",
  "gemini-2.5-flash-preview-04-17",
  "gemini-2.5-flash-image",
  "gemini-2.5-flash-image-preview",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash-lite-preview-06-17",
  "gemini-2.5-flash-preview-09-2025",
  "gemini-2.5-flash-lite-preview-09-2025",
  "gemini-2.5-flash-preview-tts",
  "gemini-2.5-pro-preview-tts",
  "gemini-2.5-computer-use-preview-10-2025",
  "gemini-2.5-pro-exp-03-25",
  "gemini-2.0-flash",
  "gemini-2.0-flash-001",
  "gemini-2.0-flash-exp",
  "gemini-2.0-flash-exp-image-generation",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash-lite-001",
  "gemini-2.0-flash-lite-preview",
  "gemini-2.0-flash-lite-preview-02-05",
  "gemini-2.0-flash-preview-image-generation",
  "gemini-2.0-flash-thinking-exp",
  "gemini-2.0-flash-thinking-exp-01-21",
  "gemini-2.0-flash-thinking-exp-1219",
  "gemini-2.0-pro-exp",
  "gemini-2.0-pro-exp-02-05",
  "gemini-exp-1206",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-pro-latest",
  "gemini-2.0-flash-live-001",
  "gemini-live-2.5-flash-preview",
  "gemini-2.5-flash-live-preview",
  "gemini-robotics-er-1.5-preview",
  "gemini-gemma-2-27b-it",
  "gemini-gemma-2-9b-it",
  "gemma-3-1b-it",
  "gemma-3-4b-it",
  "gemma-3-12b-it",
  "gemma-3-27b-it",
  "gemma-3n-e2b-it",
  "gemma-3n-e4b-it",
  "learnlm-2.0-flash-experimental",
] as const;

export type GeminiModels = typeof GEMINI_MODELS[number];
export const GeminiModels = GEMINI_MODELS;

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

const STRUCTURED_OUTPUT_TOOL_NAME = "structured_output";
const DEFAULT_GEMINI_MAX_TOOL_ROUNDS = 8;

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
    this.location = options.location ?? process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";
    this.useVertexai = options.useVertexai ?? options.use_vertexai ?? process.env.GOOGLE_GENAI_USE_VERTEXAI?.toLowerCase() === "true";
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
      return this.callVertexAI(messages, options);
    }

    const apiKey = this.apiKey ?? process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? null;
    if (!apiKey) {
      throw new Error("Gemini API key required. Set GEMINI_API_KEY or GOOGLE_API_KEY, or pass api_key.");
    }

    const [contents, systemInstruction] = this.formatMessagesForGemini(messages);
    const tools = (options?.tools ?? null) as readonly Tool[] | null;
    const generationConfig = this.prepareGenerationConfig(systemInstruction, tools, options?.responseModel ?? null);
    const requestBody = readObject(generationConfig);
    const generationConfigBody = { ...generationConfig };
    delete generationConfigBody.system_instruction;
    delete generationConfigBody.tools;
    delete generationConfigBody.safety_settings;
    const model = this.model.replace(/^(?:gemini|google)\//u, "");
    const baseUrl = this.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
    const buildRequestInit = (currentContents: readonly unknown[]): RequestInit => ({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: currentContents,
        ...(Object.keys(generationConfigBody).length > 0 ? { generationConfig: generationConfigBody } : {}),
        ...("system_instruction" in requestBody ? { system_instruction: requestBody.system_instruction } : {}),
        ...("tools" in requestBody ? { tools: requestBody.tools } : {}),
        ...("safety_settings" in requestBody ? { safety_settings: requestBody.safety_settings } : {}),
      }),
      ...(options?.signal ? { signal: options.signal } : {}),
    });
    const generateContent = async (currentContents: readonly unknown[]): Promise<unknown> => {
      const response = await fetch(
        `${baseUrl.replace(/\/$/u, "")}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        buildRequestInit(currentContents),
      );
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = readObject(readObject(body).error);
        throw new Error(scalarToString(error.message) ?? `Gemini request failed with HTTP ${response.status.toString()}.`);
      }
      return body;
    };

    return generateContent(contents).then(async (body) => {
      return await this.processResponseWithTools(
        body,
        contents,
        (options?.availableFunctions ?? options?.available_functions ?? null) as Record<string, LLMAvailableFunction> | null,
        generateContent,
        geminiMaxToolRounds(options),
      ) as LLMResponse;
    });
  }

  private async callVertexAI(messages: readonly LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse> {
    if (!this.project) {
      throw new Error("Vertex AI Gemini calls require a project.");
    }
    const clientParams = readObject(this.clientParams);
    const accessToken = scalarToString(clientParams.access_token ?? clientParams.accessToken ?? this.apiKey);
    if (!accessToken) {
      throw new Error("Vertex AI Gemini calls require client_params.access_token or api_key.");
    }
    const [contents, systemInstruction] = this.formatMessagesForGemini(messages);
    const tools = (options?.tools ?? null) as readonly Tool[] | null;
    const generationConfig = this.prepareGenerationConfig(systemInstruction, tools, options?.responseModel ?? null);
    const requestBody = readObject(generationConfig);
    const generationConfigBody = { ...generationConfig };
    delete generationConfigBody.system_instruction;
    delete generationConfigBody.tools;
    delete generationConfigBody.safety_settings;
    const model = this.model.replace(/^(?:gemini|google)\//u, "");
    const baseUrl = this.baseUrl ?? `https://${this.location}-aiplatform.googleapis.com/v1`;
    const url = `${baseUrl.replace(/\/$/u, "")}/projects/${encodeURIComponent(this.project)}/locations/${encodeURIComponent(this.location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents,
        ...(Object.keys(generationConfigBody).length > 0 ? { generationConfig: generationConfigBody } : {}),
        ...("system_instruction" in requestBody ? { systemInstruction: requestBody.system_instruction } : {}),
        ...("tools" in requestBody ? { tools: requestBody.tools } : {}),
        ...("safety_settings" in requestBody ? { safetySettings: requestBody.safety_settings } : {}),
      }),
      ...(options?.signal ? { signal: options.signal } : {}),
    });
    const body: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = readObject(readObject(body).error);
      throw new Error(scalarToString(error.message) ?? `Vertex AI Gemini request failed with HTTP ${response.status.toString()}.`);
    }
    return await this.processResponseWithTools(
      body,
      contents,
      (options?.availableFunctions ?? options?.available_functions ?? null) as Record<string, LLMAvailableFunction> | null,
      null,
      geminiMaxToolRounds(options),
    ) as LLMResponse;
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

    const schema = geminiResponseSchema(responseModel);
    if (tools && tools.length > 0 && this.supportsTools) {
      const geminiTools = this.convertToolsForInterference(tools);
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
    } else if (schema) {
      config.response_mime_type = "application/json";
      if (this.isGemini20) {
        config.response_json_schema = GeminiCompletion.addPropertyOrdering(structuredClone(schema));
      } else {
        config.response_schema = responseModel;
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
    generateContent: ((contents: readonly unknown[]) => Promise<unknown>) | null = null,
    maxToolRounds = DEFAULT_GEMINI_MAX_TOOL_ROUNDS,
  ): Promise<unknown> {
    let currentResponse = response;
    let currentContents = [...contents];

    for (let round = 0; round <= maxToolRounds; round += 1) {
      const candidates = readObject(currentResponse).candidates;
      if (!Array.isArray(candidates)) {
        return GeminiCompletion.extractTextFromResponse(currentResponse);
      }
      const first = readObject(candidates[0]);
      const rawParts = Array.isArray(readObject(first.content).parts)
        ? readObject(first.content).parts as unknown[]
        : [];
      const functionCallParts = rawParts.filter((part) => Object.keys(readObject(readObject(part).functionCall ?? readObject(part).function_call)).length > 0);
      const structuredOutput = GeminiCompletion.extractStructuredOutputFromResponse(currentResponse);
      const nonStructuredParts = functionCallParts.filter((part) => {
        const partRecord = readObject(part);
        const functionCall = readObject(partRecord.functionCall ?? partRecord.function_call);
        return (scalarToString(functionCall.name) ?? "") !== STRUCTURED_OUTPUT_TOOL_NAME;
      });

      if (nonStructuredParts.length === 0) {
        return structuredOutput ?? GeminiCompletion.extractTextFromResponse(currentResponse);
      }
      if (!availableFunctions) {
        return nonStructuredParts;
      }
      if (round >= maxToolRounds) {
        throw new Error(`Gemini tool loop exceeded max tool rounds (${String(maxToolRounds)}).`);
      }

      const functionResponseParts: Record<string, unknown>[] = [];
      let firstToolResult: string | null = null;
      for (const part of nonStructuredParts) {
        const partRecord = readObject(part);
        const functionCall = readObject(partRecord.functionCall ?? partRecord.function_call);
        const rawFunctionName = scalarToString(functionCall.name) ?? "";
        const functionName = resolveGeminiFunctionName(rawFunctionName, availableFunctions);
        if (!functionName) {
          throw new Error(`Gemini requested unknown function '${rawFunctionName}'.`);
        }
        const result = await this.handleToolExecution({
          functionName,
          functionArgs: readObject(functionCall.args),
          availableFunctions,
        });
        if (result === null) {
          throw new Error(`Gemini failed to execute function '${rawFunctionName}'.`);
        }
        firstToolResult ??= result;
        functionResponseParts.push({
          functionResponse: {
            name: rawFunctionName,
            response: { result },
          },
        });
      }

      if (!generateContent) {
        return firstToolResult;
      }

      currentContents = [
        ...currentContents,
        { role: "model", parts: rawParts },
        { role: "user", parts: functionResponseParts },
      ];
      currentResponse = await generateContent(currentContents);
    }

    throw new Error(`Gemini tool loop exceeded max tool rounds (${String(maxToolRounds)}).`);
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

export function registerGeminiProvider(): void {
  registerLLMProviderFactory("gemini", (options) => new GeminiCompletion(options));
  registerLLMProviderFactory("google", (options) => new GeminiCompletion({ ...options, provider: "gemini" }));
}

function geminiVersion(model: string): number {
  const match = /gemini-(\d+(?:\.\d+)?)/iu.exec(model.toLowerCase());
  return match ? Number.parseFloat(match[1] ?? "0") : 0;
}

function geminiMaxToolRounds(options: LLMCallOptions | undefined): number {
  const record = readObject(options);
  const configured = record.maxToolRounds ?? record.max_tool_rounds;
  return typeof configured === "number" && Number.isInteger(configured) && configured > 0
    ? configured
    : DEFAULT_GEMINI_MAX_TOOL_ROUNDS;
}

function resolveGeminiFunctionName(
  functionName: string,
  availableFunctions: Record<string, LLMAvailableFunction>,
): string | null {
  if (functionName in availableFunctions) {
    return functionName;
  }
  const sanitizedName = sanitizeToolName(functionName);
  return sanitizedName in availableFunctions ? sanitizedName : null;
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
    const name = scalarToString(toolRecord.name) ?? "tool";
    const schema = readObject(toolRecord.argsSchema ?? toolRecord.args_schema ?? toolRecord.schema ?? toolRecord.parameters);
    return {
      function: {
        name: sanitizeToolName(name),
        description: scalarToString(toolRecord.description) ?? "",
        parameters: Object.keys(schema).length > 0 ? normalizeGeminiToolParameters(schema) : { type: "object", properties: {} },
      },
    };
  });
}

function normalizeGeminiToolParameters(schema: Record<string, unknown>): Record<string, unknown> {
  if (isJsonSchemaLike(schema)) {
    return schema;
  }

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
