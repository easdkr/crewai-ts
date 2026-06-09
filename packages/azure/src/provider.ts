import { ConfiguredLLM, LocalFileUploader, registerLLMProviderFactory, type BaseLLMOptions, type LLMCallOptions, type LLMMessageInput, type LLMResponse } from "@crewai-ts/core/llm";
import { generateModelDescription, type JsonSchema } from "@crewai-ts/core/schema-utils";
import type { LLMMessage, Tool } from "@crewai-ts/core/types";
import { OpenAICompletion } from "@crewai-ts/openai";

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
    return this.callChatCompletions(messages, options);
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
      ...(apiKey ? { api_key: apiKey } : {
        credential: {
          provider: "DefaultAzureCredential",
        },
      }),
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

  private async callChatCompletions(messages: readonly LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse> {
    if (this.stream) {
      throw new Error("Azure streaming responses are not supported by the built-in fetch transport yet.");
    }
    const client = this.getSyncClient();
    const endpoint = scalarToString(client.endpoint);
    const apiKey = scalarToString(client.api_key);
    if (!endpoint) {
      throw new Error("Azure endpoint is required");
    }
    if (!apiKey) {
      throw new Error("Azure API key is required");
    }
    const params = this.prepareCompletionParams(
      this.formatMessages(messages),
      (options?.tools ?? null) as readonly Tool[] | null,
    );
    const url = azureChatCompletionsUrl(endpoint, this.model, this.apiVersion);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(params),
    });
    const payload: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = readObject(readObject(payload).error);
      throw new Error(scalarToString(error.message) ?? `Azure completion request failed with HTTP ${response.status.toString()}.`);
    }
    const usage = this.extractAzureTokenUsage(payload);
    if (usage.total_tokens !== 0) {
      this.trackTokenUsageInternal(usage);
    }
    const choices = readObject(payload).choices;
    const firstChoice = Array.isArray(choices) ? readObject(choices[0]) : {};
    const message = readObject(firstChoice.message);
    const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    if (toolCalls.length > 0) {
      return toolCalls as unknown as LLMResponse;
    }
    return typeof message.content === "string" ? message.content : "";
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

export function registerAzureProvider(): void {
  registerLLMProviderFactory("azure", (options) => new AzureCompletion(options as AzureCompletionOptions));
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

function azureChatCompletionsUrl(endpoint: string, model: string, apiVersion: string | null): string {
  const version = encodeURIComponent(apiVersion ?? "2024-06-01");
  const trimmed = endpoint.replace(/\/+$/, "");
  const deploymentPath = "/openai/deployments/";
  const lower = trimmed.toLowerCase();
  const base = lower.includes(deploymentPath)
    ? trimmed
    : `${trimmed.replace(/\/openai(?:\/v1)?$/i, "")}${deploymentPath}${encodeURIComponent(azureResponsesModelName(model))}`;
  return `${base}/chat/completions?api-version=${version}`;
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
