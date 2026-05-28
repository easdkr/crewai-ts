import { ConfiguredLLM, type BaseLLMOptions, type LLMCallOptions, type LLMResponse } from "./llm.js";
import type { LLMMessage } from "./types.js";

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
