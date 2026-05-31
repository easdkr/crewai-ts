import { ConfiguredLLM, type BaseLLMOptions, type LLMCallOptions, type LLMResponse } from "./llm.js";
import type { LLMMessage } from "./types.js";

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

  override supportsFunctionCalling(): boolean {
    return !this.isO1Model;
  }

  override supportsStopWords(): boolean {
    const model = this.model.toLowerCase();
    if (model.includes("gpt-5")) {
      return false;
    }
    return !this.isO1Model;
  }

  override supportsMultimodal(): boolean {
    const model = this.model.toLowerCase();
    return ["gpt-4o", "gpt-4.1", "gpt-4-turbo", "gpt-4-vision", "gpt-5", "o1", "o3", "o4"]
      .some((prefix) => model.startsWith(prefix));
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
    const provider = options.provider ?? "";
    const config = OPENAI_COMPATIBLE_PROVIDERS[provider];
    if (!config) {
      throw new Error(`Unknown OpenAI-compatible provider: ${provider}. Supported providers: ${Object.keys(OPENAI_COMPATIBLE_PROVIDERS).sort().join(", ")}`);
    }
    const baseUrlFromEnv = config.base_url_env ? process.env[config.base_url_env] : undefined;
    const baseUrl = normalizeOpenAICompatibleBaseUrl(options.base_url ?? options.baseUrl ?? baseUrlFromEnv ?? config.base_url, provider);
    const apiKey = options.api_key ?? options.apiKey ?? process.env[config.api_key_env] ?? config.default_api_key;
    if (config.api_key_required && !apiKey) {
      throw new Error(`API key required for ${provider}. Set ${config.api_key_env} environment variable or pass api_key parameter.`);
    }
    super({
      ...options,
      provider,
      api_key: apiKey,
      base_url: baseUrl,
      default_headers: {
        ...config.default_headers,
        ...(options.default_headers ?? options.defaultHeaders ?? {}),
      },
    });
  }
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

function normalizeOpenAICompatibleBaseUrl(baseUrl: string, provider: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if ((provider === "ollama" || provider === "ollama_chat") && !trimmed.endsWith("/v1")) {
    return `${trimmed}/v1`;
  }
  return trimmed;
}
