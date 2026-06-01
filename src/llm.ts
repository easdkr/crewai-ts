import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

import type { ToolCalling } from "./tools.js";
import type { InputFile } from "./input-files.js";
import type { LLMMessage, MaybePromise, Tool } from "./types.js";
import {
  LLMCallCompletedEvent,
  LLMCallFailedEvent,
  LLMCallStartedEvent,
  LLMCallType,
  LLMStreamChunkEvent,
  LLMThinkingChunkEvent,
  ToolUsageErrorEvent,
  ToolUsageFinishedEvent,
  ToolUsageStartedEvent,
  crewaiEventBus,
  type LLMToolCall,
} from "./events.js";
import {
  LLMCallHookContext,
  runAfterLlmCallHooks,
  runBeforeLlmCallHooks,
} from "./hooks.js";

export type LLMResponse = string | ToolCalling;

export type LLMCallOptions = {
  tools?: readonly Tool[];
  availableFunctions?: Record<string, unknown>;
  available_functions?: Record<string, unknown>;
  responseModel?: unknown;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
};

export type JsonResponseFormat = {
  type: "json_object";
};
export const JsonResponseFormat = Object.freeze({ kind: "JsonResponseFormat" });

export const CACHE_BREAKPOINT_KEY = "cache_breakpoint";

export type CacheBreakpointMessage<T extends Record<string, unknown> = LLMMessage> = T & {
  cache_breakpoint: true;
};

export type UsageMetricsOptions = UsageMetricsLike;

export type UsageMetrics = {
  totalTokens: number;
  promptTokens: number;
  cachedPromptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  cacheCreationTokens: number;
  successfulRequests: number;
};

export const UsageMetrics = class UsageMetricsValue {
  totalTokens: number;
  total_tokens: number;
  promptTokens: number;
  prompt_tokens: number;
  cachedPromptTokens: number;
  cached_prompt_tokens: number;
  completionTokens: number;
  completion_tokens: number;
  reasoningTokens: number;
  reasoning_tokens: number;
  cacheCreationTokens: number;
  cache_creation_tokens: number;
  successfulRequests: number;
  successful_requests: number;

  constructor(options: UsageMetricsLike = {}) {
    this.totalTokens = options.totalTokens ?? options.total_tokens ?? 0;
    this.total_tokens = this.totalTokens;
    this.promptTokens = options.promptTokens ?? options.prompt_tokens ?? 0;
    this.prompt_tokens = this.promptTokens;
    this.cachedPromptTokens = options.cachedPromptTokens ?? options.cached_prompt_tokens ?? 0;
    this.cached_prompt_tokens = this.cachedPromptTokens;
    this.completionTokens = options.completionTokens ?? options.completion_tokens ?? 0;
    this.completion_tokens = this.completionTokens;
    this.reasoningTokens = options.reasoningTokens ?? options.reasoning_tokens ?? 0;
    this.reasoning_tokens = this.reasoningTokens;
    this.cacheCreationTokens = options.cacheCreationTokens ?? options.cache_creation_tokens ?? 0;
    this.cache_creation_tokens = this.cacheCreationTokens;
    this.successfulRequests = options.successfulRequests ?? options.successful_requests ?? 0;
    this.successful_requests = this.successfulRequests;
    defineUsageMetricAliases(this);
  }

  addUsageMetrics(usageMetrics: UsageMetricsLike): void {
    const next = addUsageMetrics(this, normalizeUsageMetrics(usageMetrics));
    this.assign(next);
  }

  add_usage_metrics(usageMetrics: UsageMetricsLike): void {
    this.addUsageMetrics(usageMetrics);
  }

  assign(metrics: UsageMetrics): void {
    this.totalTokens = metrics.totalTokens;
    this.total_tokens = metrics.totalTokens;
    this.promptTokens = metrics.promptTokens;
    this.prompt_tokens = metrics.promptTokens;
    this.cachedPromptTokens = metrics.cachedPromptTokens;
    this.cached_prompt_tokens = metrics.cachedPromptTokens;
    this.completionTokens = metrics.completionTokens;
    this.completion_tokens = metrics.completionTokens;
    this.reasoningTokens = metrics.reasoningTokens;
    this.reasoning_tokens = metrics.reasoningTokens;
    this.cacheCreationTokens = metrics.cacheCreationTokens;
    this.cache_creation_tokens = metrics.cacheCreationTokens;
    this.successfulRequests = metrics.successfulRequests;
    this.successful_requests = metrics.successfulRequests;
  }
};

export type UsageMetricsLike = Partial<UsageMetrics> & {
  total_tokens?: number;
  prompt_tokens?: number;
  cached_prompt_tokens?: number;
  completion_tokens?: number;
  reasoning_tokens?: number;
  cache_creation_tokens?: number;
  successful_requests?: number;
};

export type StructuredOutputValidator<T = unknown> = {
  name?: string;
  modelValidate?: (value: unknown) => T;
  model_validate?: (value: unknown) => T;
  parse?: (value: unknown) => T;
  validate?: (value: unknown) => T;
};

export type LLMEmitCallStartedOptions = {
  messages: string | readonly LLMMessage[];
  tools?: readonly Record<string, unknown>[] | null;
  callbacks?: readonly unknown[] | null;
  availableFunctions?: Record<string, unknown> | null;
  available_functions?: Record<string, unknown> | null;
  fromTask?: unknown;
  from_task?: unknown;
  fromAgent?: unknown;
  from_agent?: unknown;
};

export type LLMEmitCallCompletedOptions = {
  response: unknown;
  callType?: LLMCallType;
  call_type?: LLMCallType;
  messages?: string | readonly LLMMessage[] | null;
  usage?: Record<string, unknown> | null;
  fromTask?: unknown;
  from_task?: unknown;
  fromAgent?: unknown;
  from_agent?: unknown;
};

export type LLMHandleEmitCallEventsOptions = LLMEmitCallCompletedOptions;

export type LLMEmitCallFailedOptions = {
  error: unknown;
  fromTask?: unknown;
  from_task?: unknown;
  fromAgent?: unknown;
  from_agent?: unknown;
};

export type LLMEmitStreamChunkOptions = {
  chunk: string;
  toolCall?: LLMToolCall | null;
  tool_call?: LLMToolCall | null;
  callType?: LLMCallType | null;
  call_type?: LLMCallType | null;
  responseId?: string | null;
  response_id?: string | null;
  fromTask?: unknown;
  from_task?: unknown;
  fromAgent?: unknown;
  from_agent?: unknown;
};

export type LLMEmitThinkingChunkOptions = {
  chunk: string;
  responseId?: string | null;
  response_id?: string | null;
  fromTask?: unknown;
  from_task?: unknown;
  fromAgent?: unknown;
  from_agent?: unknown;
};

export type LLMAvailableFunction = ((args: Record<string, unknown>) => MaybePromise<unknown>) | {
  run: (args: Record<string, unknown>) => MaybePromise<unknown>;
};

export type LLMHandleToolExecutionOptions = {
  functionName?: string;
  function_name?: string;
  functionArgs?: Record<string, unknown>;
  function_args?: Record<string, unknown>;
  availableFunctions?: Record<string, LLMAvailableFunction>;
  available_functions?: Record<string, LLMAvailableFunction>;
  fromTask?: unknown;
  from_task?: unknown;
  fromAgent?: unknown;
  from_agent?: unknown;
};

export type LLMCompletionParams = Record<string, unknown> & {
  model: string;
  messages: LLMMessage[];
};

export type LLMStreamingCallback = ((chunk: unknown) => MaybePromise<unknown>) | {
  logSuccessEvent?: (event: {
    kwargs: Record<string, unknown>;
    responseObj: Record<string, unknown>;
    startTime: number;
    endTime: number;
  }) => MaybePromise<unknown>;
  log_success_event?: (kwargs: Record<string, unknown>, response_obj: Record<string, unknown>, start_time: number, end_time: number) => MaybePromise<unknown>;
};

export type LLMMessageInput = string | readonly (Partial<LLMMessage> & Record<string, unknown>)[];

export type NativeLLMProviderName =
  | "openai"
  | "anthropic"
  | "azure"
  | "bedrock"
  | "gemini"
  | "openai_compatible";

export type CreateLLMValue = string | LLM | BaseLLMOptions | (Record<string, unknown> & {
  model?: unknown;
  model_name?: unknown;
  deployment_name?: unknown;
});

export type CreateLLMEnvironment = Partial<Record<string, string | undefined>>;

export type LLMModelSpec = {
  provider: string;
  model: string;
  originalModel: string;
  useNative: boolean;
};

export type LLMFunction = (
  messages: readonly LLMMessage[],
  options?: LLMCallOptions,
) => MaybePromise<LLMResponse>;

export type LLMClient = {
  call(messages: readonly LLMMessage[], options?: LLMCallOptions): MaybePromise<LLMResponse>;
  getUsageMetrics?(): UsageMetricsLike;
  getTokenUsageSummary?(): UsageMetricsLike;
  get_token_usage_summary?(): UsageMetricsLike;
  resetUsageMetrics?(): void;
  reset_usage_metrics?(): void;
};

export type LLM = LLMFunction | LLMClient;

export type LocalFileUpload = {
  id: string;
  provider: string;
  name: string;
  filename: string;
  contentType: string | null;
  content: string;
  size: number;
};

export class LocalFileUploader {
  readonly provider: string;
  readonly options: Record<string, unknown>;
  readonly uploads: LocalFileUpload[] = [];

  constructor(provider: string, options: Record<string, unknown> = {}) {
    this.provider = provider;
    this.options = { ...options };
  }

  upload(name: string, file: InputFile): LocalFileUpload {
    const rendered = renderLLMInputFile(name, file);
    const upload = {
      id: `${this.provider}-file-${String(this.uploads.length + 1)}`,
      provider: this.provider,
      name,
      filename: rendered.filename,
      contentType: rendered.contentType,
      content: rendered.content,
      size: rendered.content.length,
    };
    this.uploads.push(upload);
    return upload;
  }

  upload_file(name: string, file: InputFile): LocalFileUpload {
    return this.upload(name, file);
  }
}

export const DEFAULT_CONTEXT_WINDOW_SIZE = 4096;
export const DEFAULT_SUPPORTS_STOP_WORDS = true;
export const DEFAULT_LLM_MODEL = "gpt-4.1-mini";
export const JSON_URL = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";
export const LITELLM_PARAMS = ["api_key", "api_base", "api_version"] as const;
export const UNACCEPTED_LLM_ENV_ATTRIBUTES = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_DEFAULT_REGION",
] as const;
export type LLMEnvVarSpec = {
  key_name?: string;
  default?: boolean;
  [key: string]: unknown;
};
export const LLM_ENV_VARS: Readonly<Record<string, readonly LLMEnvVarSpec[]>> = {
  openai: [{ key_name: "OPENAI_API_KEY" }],
  anthropic: [{ key_name: "ANTHROPIC_API_KEY" }],
  gemini: [{ key_name: "GEMINI_API_KEY" }],
  nvidia_nim: [{ key_name: "NVIDIA_NIM_API_KEY" }],
  groq: [{ key_name: "GROQ_API_KEY" }],
  huggingface: [{ key_name: "HF_TOKEN" }],
  sambanova: [{ key_name: "SAMBANOVA_API_KEY" }],
  watson: [
    { key_name: "WATSONX_URL" },
    { key_name: "WATSONX_APIKEY" },
    { key_name: "WATSONX_PROJECT_ID" },
  ],
  ollama: [{ default: true, API_BASE: "http://localhost:11434" }],
  azure: [
    { key_name: "model" },
    { key_name: "AZURE_API_KEY" },
    { key_name: "AZURE_API_BASE" },
    { key_name: "AZURE_API_VERSION" },
  ],
  cerebras: [{ key_name: "CEREBRAS_API_KEY" }],
};
export const ENV_VARS = LLM_ENV_VARS;
export const SUPPORTED_NATIVE_PROVIDERS = ["openai", "anthropic", "azure", "bedrock", "gemini"] as const;
export const LLM_PROVIDER_ALIASES: Readonly<Record<string, string>> = {
  openai: "openai",
  anthropic: "anthropic",
  claude: "anthropic",
  azure: "azure",
  azure_openai: "azure",
  google: "gemini",
  gemini: "gemini",
  bedrock: "bedrock",
  aws: "bedrock",
  openrouter: "openrouter",
  deepseek: "deepseek",
  ollama: "ollama",
  ollama_chat: "ollama_chat",
  hosted_vllm: "hosted_vllm",
  cerebras: "cerebras",
  dashscope: "dashscope",
};
export const PROVIDERS = Object.freeze([
  "openai",
  "anthropic",
  "gemini",
  "nvidia_nim",
  "groq",
  "huggingface",
  "ollama",
  "watson",
  "bedrock",
  "azure",
  "cerebras",
  "sambanova",
] as const);
export const OPENAI_MODELS = [
  "gpt-3.5-turbo",
  "gpt-3.5-turbo-0125",
  "gpt-3.5-turbo-0301",
  "gpt-3.5-turbo-0613",
  "gpt-3.5-turbo-1106",
  "gpt-3.5-turbo-16k",
  "gpt-3.5-turbo-16k-0613",
  "gpt-3.5-turbo-instruct",
  "gpt-3.5-turbo-instruct-0914",
  "gpt-4",
  "gpt-4-0125-preview",
  "gpt-4-0314",
  "gpt-4-0613",
  "gpt-4-1106-preview",
  "gpt-4-32k",
  "gpt-4-32k-0314",
  "gpt-4-32k-0613",
  "gpt-4-turbo",
  "gpt-4-turbo-2024-04-09",
  "gpt-4-turbo-preview",
  "gpt-4-vision-preview",
  "gpt-4.1",
  "gpt-4.1-2025-04-14",
  "gpt-4.1-mini",
  "gpt-4.1-mini-2025-04-14",
  "gpt-4.1-nano",
  "gpt-4.1-nano-2025-04-14",
  "gpt-4o",
  "gpt-4o-2024-05-13",
  "gpt-4o-2024-08-06",
  "gpt-4o-2024-11-20",
  "gpt-4o-audio-preview",
  "gpt-4o-audio-preview-2024-10-01",
  "gpt-4o-audio-preview-2024-12-17",
  "gpt-4o-audio-preview-2025-06-03",
  "gpt-4o-mini",
  "gpt-4o-mini-2024-07-18",
  "gpt-4o-mini-audio-preview",
  "gpt-4o-mini-audio-preview-2024-12-17",
  "gpt-4o-mini-realtime-preview",
  "gpt-4o-mini-realtime-preview-2024-12-17",
  "gpt-4o-mini-search-preview",
  "gpt-4o-mini-search-preview-2025-03-11",
  "gpt-4o-mini-transcribe",
  "gpt-4o-mini-tts",
  "gpt-4o-realtime-preview",
  "gpt-4o-realtime-preview-2024-10-01",
  "gpt-4o-realtime-preview-2024-12-17",
  "gpt-4o-realtime-preview-2025-06-03",
  "gpt-4o-search-preview",
  "gpt-4o-search-preview-2025-03-11",
  "gpt-4o-transcribe",
  "gpt-4o-transcribe-diarize",
  "gpt-5",
  "gpt-5-2025-08-07",
  "gpt-5-chat",
  "gpt-5-chat-latest",
  "gpt-5-codex",
  "gpt-5-mini",
  "gpt-5-mini-2025-08-07",
  "gpt-5-nano",
  "gpt-5-nano-2025-08-07",
  "gpt-5-pro",
  "gpt-5-pro-2025-10-06",
  "gpt-5-search-api",
  "gpt-5-search-api-2025-10-14",
  "gpt-audio",
  "gpt-audio-2025-08-28",
  "gpt-audio-mini",
  "gpt-audio-mini-2025-10-06",
  "gpt-image-1",
  "gpt-image-1-mini",
  "gpt-realtime",
  "gpt-realtime-2025-08-28",
  "gpt-realtime-mini",
  "gpt-realtime-mini-2025-10-06",
  "o1",
  "o1-preview",
  "o1-2024-12-17",
  "o1-mini",
  "o1-mini-2024-09-12",
  "o1-pro",
  "o1-pro-2025-03-19",
  "o3-mini",
  "o3",
  "o4-mini",
  "whisper-1",
] as const;
export const ANTHROPIC_MODELS = [
  "claude-opus-4-5-20251101",
  "claude-opus-4-5",
  "claude-3-7-sonnet-latest",
  "claude-3-7-sonnet-20250219",
  "claude-3-5-haiku-latest",
  "claude-3-5-haiku-20241022",
  "claude-haiku-4-5",
  "claude-haiku-4-5-20251001",
  "claude-sonnet-4-20250514",
  "claude-sonnet-4-0",
  "claude-4-sonnet-20250514",
  "claude-sonnet-4-5",
  "claude-sonnet-4-5-20250929",
  "claude-3-5-sonnet-latest",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-sonnet-20240620",
  "claude-opus-4-0",
  "claude-opus-4-20250514",
  "claude-4-opus-20250514",
  "claude-opus-4-1",
  "claude-opus-4-1-20250805",
  "claude-3-opus-latest",
  "claude-3-opus-20240229",
  "claude-3-sonnet-20240229",
  "claude-3-haiku-latest",
  "claude-3-haiku-20240307",
] as const;
export const GEMINI_MODELS = [
  "gemini-3-pro-preview",
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
export const AZURE_MODELS = [
  "gpt-3.5-turbo",
  "gpt-3.5-turbo-0301",
  "gpt-3.5-turbo-0613",
  "gpt-3.5-turbo-16k",
  "gpt-3.5-turbo-16k-0613",
  "gpt-35-turbo",
  "gpt-35-turbo-0125",
  "gpt-35-turbo-1106",
  "gpt-35-turbo-16k-0613",
  "gpt-35-turbo-instruct-0914",
  "gpt-4",
  "gpt-4-0314",
  "gpt-4-0613",
  "gpt-4-1106-preview",
  "gpt-4-0125-preview",
  "gpt-4-32k",
  "gpt-4-32k-0314",
  "gpt-4-32k-0613",
  "gpt-4-turbo",
  "gpt-4-turbo-2024-04-09",
  "gpt-4-vision",
  "gpt-4o",
  "gpt-4o-2024-05-13",
  "gpt-4o-2024-08-06",
  "gpt-4o-2024-11-20",
  "gpt-4o-mini",
  "gpt-5",
  "o1",
  "o1-mini",
  "o1-preview",
  "o3-mini",
  "o3",
  "o4-mini",
] as const;
export const BEDROCK_MODELS = [
  "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
  "us.anthropic.claude-sonnet-4-20250514-v1:0",
  "us.anthropic.claude-opus-4-5-20251101-v1:0",
  "us.anthropic.claude-opus-4-20250514-v1:0",
  "us.anthropic.claude-opus-4-1-20250805-v1:0",
  "us.anthropic.claude-haiku-4-5-20251001-v1:0",
  "us.anthropic.claude-sonnet-4-6",
  "us.anthropic.claude-opus-4-6-v1",
  "us.anthropic.claude-sonnet-4-5-v1:0",
  "us.anthropic.claude-opus-4-5-v1:0",
  "us.anthropic.claude-opus-4-6-v1:0",
  "us.anthropic.claude-haiku-4-5-v1:0",
  "eu.anthropic.claude-sonnet-4-5-v1:0",
  "eu.anthropic.claude-opus-4-5-v1:0",
  "eu.anthropic.claude-haiku-4-5-v1:0",
  "apac.anthropic.claude-sonnet-4-5-v1:0",
  "apac.anthropic.claude-opus-4-5-v1:0",
  "apac.anthropic.claude-haiku-4-5-v1:0",
  "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
  "global.anthropic.claude-sonnet-4-20250514-v1:0",
  "global.anthropic.claude-opus-4-5-20251101-v1:0",
  "global.anthropic.claude-opus-4-6-v1",
  "global.anthropic.claude-haiku-4-5-20251001-v1:0",
  "global.anthropic.claude-sonnet-4-6",
  "ai21.jamba-1-5-large-v1:0",
  "ai21.jamba-1-5-mini-v1:0",
  "amazon.nova-lite-v1:0",
  "amazon.nova-lite-v1:0:24k",
  "amazon.nova-lite-v1:0:300k",
  "amazon.nova-micro-v1:0",
  "amazon.nova-micro-v1:0:128k",
  "amazon.nova-micro-v1:0:24k",
  "amazon.nova-premier-v1:0",
  "amazon.nova-premier-v1:0:1000k",
  "amazon.nova-premier-v1:0:20k",
  "amazon.nova-premier-v1:0:8k",
  "amazon.nova-premier-v1:0:mm",
  "amazon.nova-pro-v1:0",
  "amazon.nova-pro-v1:0:24k",
  "amazon.nova-pro-v1:0:300k",
  "amazon.titan-text-express-v1",
  "amazon.titan-text-express-v1:0:8k",
  "amazon.titan-text-lite-v1",
  "amazon.titan-text-lite-v1:0:4k",
  "amazon.titan-tg1-large",
  "anthropic.claude-3-5-haiku-20241022-v1:0",
  "anthropic.claude-3-5-sonnet-20240620-v1:0",
  "anthropic.claude-3-5-sonnet-20241022-v2:0",
  "anthropic.claude-3-7-sonnet-20250219-v1:0",
  "anthropic.claude-3-haiku-20240307-v1:0",
  "anthropic.claude-3-haiku-20240307-v1:0:200k",
  "anthropic.claude-3-haiku-20240307-v1:0:48k",
  "anthropic.claude-3-opus-20240229-v1:0",
  "anthropic.claude-3-opus-20240229-v1:0:12k",
  "anthropic.claude-3-opus-20240229-v1:0:200k",
  "anthropic.claude-3-opus-20240229-v1:0:28k",
  "anthropic.claude-3-sonnet-20240229-v1:0",
  "anthropic.claude-3-sonnet-20240229-v1:0:200k",
  "anthropic.claude-3-sonnet-20240229-v1:0:28k",
  "anthropic.claude-haiku-4-5-20251001-v1:0",
  "anthropic.claude-instant-v1:2:100k",
  "anthropic.claude-opus-4-5-20251101-v1:0",
  "anthropic.claude-opus-4-1-20250805-v1:0",
  "anthropic.claude-opus-4-20250514-v1:0",
  "anthropic.claude-sonnet-4-20250514-v1:0",
  "anthropic.claude-sonnet-4-5-20250929-v1:0",
  "anthropic.claude-v2:0:100k",
  "anthropic.claude-v2:0:18k",
  "anthropic.claude-v2:1:18k",
  "anthropic.claude-v2:1:200k",
  "cohere.command-r-plus-v1:0",
  "cohere.command-r-v1:0",
  "cohere.rerank-v3-5:0",
  "deepseek.r1-v1:0",
  "meta.llama3-1-70b-instruct-v1:0",
  "meta.llama3-1-8b-instruct-v1:0",
  "meta.llama3-2-11b-instruct-v1:0",
  "meta.llama3-2-1b-instruct-v1:0",
  "meta.llama3-2-3b-instruct-v1:0",
  "meta.llama3-2-90b-instruct-v1:0",
  "meta.llama3-3-70b-instruct-v1:0",
  "meta.llama3-70b-instruct-v1:0",
  "meta.llama3-8b-instruct-v1:0",
  "meta.llama4-maverick-17b-instruct-v1:0",
  "meta.llama4-scout-17b-instruct-v1:0",
  "mistral.mistral-7b-instruct-v0:2",
  "mistral.mistral-large-2402-v1:0",
  "mistral.mistral-small-2402-v1:0",
  "mistral.mixtral-8x7b-instruct-v0:1",
  "mistral.pixtral-large-2502-v1:0",
  "openai.gpt-oss-120b-1:0",
  "openai.gpt-oss-20b-1:0",
  "qwen.qwen3-32b-v1:0",
  "qwen.qwen3-coder-30b-a3b-v1:0",
  "twelvelabs.pegasus-1-2-v1:0",
] as const;
export const NVIDIA_NIM_MODELS = [
  "nvidia_nim/nvidia/mistral-nemo-minitron-8b-8k-instruct",
  "nvidia_nim/nvidia/nemotron-4-mini-hindi-4b-instruct",
  "nvidia_nim/nvidia/llama-3.1-nemotron-70b-instruct",
  "nvidia_nim/nvidia/llama3-chatqa-1.5-8b",
  "nvidia_nim/nvidia/llama3-chatqa-1.5-70b",
  "nvidia_nim/nvidia/vila",
  "nvidia_nim/nvidia/neva-22",
  "nvidia_nim/nvidia/nemotron-mini-4b-instruct",
  "nvidia_nim/nvidia/usdcode-llama3-70b-instruct",
  "nvidia_nim/nvidia/nemotron-4-340b-instruct",
  "nvidia_nim/meta/codellama-70b",
  "nvidia_nim/meta/llama2-70b",
  "nvidia_nim/meta/llama3-8b-instruct",
  "nvidia_nim/meta/llama3-70b-instruct",
  "nvidia_nim/meta/llama-3.1-8b-instruct",
  "nvidia_nim/meta/llama-3.1-70b-instruct",
  "nvidia_nim/meta/llama-3.1-405b-instruct",
  "nvidia_nim/meta/llama-3.2-1b-instruct",
  "nvidia_nim/meta/llama-3.2-3b-instruct",
  "nvidia_nim/meta/llama-3.2-11b-vision-instruct",
  "nvidia_nim/meta/llama-3.2-90b-vision-instruct",
  "nvidia_nim/meta/llama-3.1-70b-instruct",
  "nvidia_nim/google/gemma-7b",
  "nvidia_nim/google/gemma-2b",
  "nvidia_nim/google/codegemma-7b",
  "nvidia_nim/google/codegemma-1.1-7b",
  "nvidia_nim/google/recurrentgemma-2b",
  "nvidia_nim/google/gemma-2-9b-it",
  "nvidia_nim/google/gemma-2-27b-it",
  "nvidia_nim/google/gemma-2-2b-it",
  "nvidia_nim/google/deplot",
  "nvidia_nim/google/paligemma",
  "nvidia_nim/mistralai/mistral-7b-instruct-v0.2",
  "nvidia_nim/mistralai/mixtral-8x7b-instruct-v0.1",
  "nvidia_nim/mistralai/mistral-large",
  "nvidia_nim/mistralai/mixtral-8x22b-instruct-v0.1",
  "nvidia_nim/mistralai/mistral-7b-instruct-v0.3",
  "nvidia_nim/nv-mistralai/mistral-nemo-12b-instruct",
  "nvidia_nim/mistralai/mamba-codestral-7b-v0.1",
  "nvidia_nim/microsoft/phi-3-mini-128k-instruct",
  "nvidia_nim/microsoft/phi-3-mini-4k-instruct",
  "nvidia_nim/microsoft/phi-3-small-8k-instruct",
  "nvidia_nim/microsoft/phi-3-small-128k-instruct",
  "nvidia_nim/microsoft/phi-3-medium-4k-instruct",
  "nvidia_nim/microsoft/phi-3-medium-128k-instruct",
  "nvidia_nim/microsoft/phi-3.5-mini-instruct",
  "nvidia_nim/microsoft/phi-3.5-moe-instruct",
  "nvidia_nim/microsoft/kosmos-2",
  "nvidia_nim/microsoft/phi-3-vision-128k-instruct",
  "nvidia_nim/microsoft/phi-3.5-vision-instruct",
  "nvidia_nim/databricks/dbrx-instruct",
  "nvidia_nim/snowflake/arctic",
  "nvidia_nim/aisingapore/sea-lion-7b-instruct",
  "nvidia_nim/ibm/granite-8b-code-instruct",
  "nvidia_nim/ibm/granite-34b-code-instruct",
  "nvidia_nim/ibm/granite-3.0-8b-instruct",
  "nvidia_nim/ibm/granite-3.0-3b-a800m-instruct",
  "nvidia_nim/mediatek/breeze-7b-instruct",
  "nvidia_nim/upstage/solar-10.7b-instruct",
  "nvidia_nim/writer/palmyra-med-70b-32k",
  "nvidia_nim/writer/palmyra-med-70b",
  "nvidia_nim/writer/palmyra-fin-70b-32k",
  "nvidia_nim/01-ai/yi-large",
  "nvidia_nim/deepseek-ai/deepseek-coder-6.7b-instruct",
  "nvidia_nim/rakuten/rakutenai-7b-instruct",
  "nvidia_nim/rakuten/rakutenai-7b-chat",
  "nvidia_nim/baichuan-inc/baichuan2-13b-chat",
] as const;
export const GROQ_MODELS = [
  "groq/llama-3.1-8b-instant",
  "groq/llama-3.1-70b-versatile",
  "groq/llama-3.1-405b-reasoning",
  "groq/gemma2-9b-it",
  "groq/gemma-7b-it",
] as const;
export const OLLAMA_MODELS = [
  "ollama/llama3.1",
  "ollama/mixtral",
] as const;
export const WATSON_MODELS = [
  "watsonx/meta-llama/llama-3-1-70b-instruct",
  "watsonx/meta-llama/llama-3-1-8b-instruct",
  "watsonx/meta-llama/llama-3-2-11b-vision-instruct",
  "watsonx/meta-llama/llama-3-2-1b-instruct",
  "watsonx/meta-llama/llama-3-2-90b-vision-instruct",
  "watsonx/meta-llama/llama-3-405b-instruct",
  "watsonx/mistral/mistral-large",
  "watsonx/ibm/granite-3-8b-instruct",
] as const;
export const HUGGINGFACE_MODELS = [
  "huggingface/meta-llama/Meta-Llama-3.1-8B-Instruct",
  "huggingface/mistralai/Mixtral-8x7B-Instruct-v0.1",
  "huggingface/tiiuae/falcon-180B-chat",
  "huggingface/google/gemma-7b-it",
] as const;
export const SAMBANOVA_MODELS = [
  "sambanova/Meta-Llama-3.3-70B-Instruct",
  "sambanova/QwQ-32B-Preview",
  "sambanova/Qwen2.5-72B-Instruct",
  "sambanova/Qwen2.5-Coder-32B-Instruct",
  "sambanova/Meta-Llama-3.1-405B-Instruct",
  "sambanova/Meta-Llama-3.1-70B-Instruct",
  "sambanova/Meta-Llama-3.1-8B-Instruct",
  "sambanova/Llama-3.2-90B-Vision-Instruct",
  "sambanova/Llama-3.2-11B-Vision-Instruct",
  "sambanova/Meta-Llama-3.2-3B-Instruct",
  "sambanova/Meta-Llama-3.2-1B-Instruct",
] as const;
export type OpenAIModels = typeof OPENAI_MODELS[number];
export type AnthropicModels = typeof ANTHROPIC_MODELS[number];
export type GeminiModels = typeof GEMINI_MODELS[number];
export type AzureModels = typeof AZURE_MODELS[number];
export type BedrockModels = typeof BEDROCK_MODELS[number];
export type NvidiaNimModels = typeof NVIDIA_NIM_MODELS[number];
export type GroqModels = typeof GROQ_MODELS[number];
export type OllamaModels = typeof OLLAMA_MODELS[number];
export type WatsonModels = typeof WATSON_MODELS[number];
export type HuggingFaceModels = typeof HUGGINGFACE_MODELS[number];
export type SambanovaModels = typeof SAMBANOVA_MODELS[number];
export const OpenAIModels = OPENAI_MODELS;
export const AnthropicModels = ANTHROPIC_MODELS;
export const GeminiModels = GEMINI_MODELS;
export const AzureModels = AZURE_MODELS;
export const BedrockModels = BEDROCK_MODELS;
export const NvidiaNimModels = NVIDIA_NIM_MODELS;
export const GroqModels = GROQ_MODELS;
export const OllamaModels = OLLAMA_MODELS;
export const WatsonModels = WATSON_MODELS;
export const HuggingFaceModels = HUGGINGFACE_MODELS;
export const SambanovaModels = SAMBANOVA_MODELS;
export const MODELS = Object.freeze({
  openai: OPENAI_MODELS,
  anthropic: ANTHROPIC_MODELS,
  gemini: GEMINI_MODELS,
  nvidia_nim: NVIDIA_NIM_MODELS,
  groq: GROQ_MODELS,
  ollama: OLLAMA_MODELS,
  watson: WATSON_MODELS,
  azure: AZURE_MODELS,
  bedrock: BEDROCK_MODELS,
  huggingface: HUGGINGFACE_MODELS,
  sambanova: SAMBANOVA_MODELS,
} as const);
export const CONTEXT_WINDOW_USAGE_RATIO = 0.85;
export const MIN_CONTEXT_WINDOW_SIZE = 1024;
export const MAX_CONTEXT_WINDOW_SIZE = 2097152;
export const MIN_CONTEXT = MIN_CONTEXT_WINDOW_SIZE;
export const MAX_CONTEXT = MAX_CONTEXT_WINDOW_SIZE;
export const ANTHROPIC_PREFIXES = Object.freeze(["anthropic/", "claude-", "claude/"] as const);
export const Delta = Object.freeze({ kind: "Delta" });
export const StreamingChoices = Object.freeze({ kind: "StreamingChoices" });
export class FunctionArgs {
  name: string;
  arguments: string;

  constructor(options: { name?: string; arguments?: string } = {}) {
    this.name = options.name ?? "";
    this.arguments = options.arguments ?? "";
  }
}
export class AccumulatedToolArgs {
  id: string | null;
  index: number;
  type: string;
  function: FunctionArgs;

  constructor(options: { id?: string | null; index?: number; type?: string; function?: FunctionArgs | { name?: string; arguments?: string } } = {}) {
    this.id = options.id ?? null;
    this.index = options.index ?? 0;
    this.type = options.type ?? "function";
    this.function = options.function instanceof FunctionArgs
      ? options.function
      : new FunctionArgs(options.function);
  }

  accumulate(delta: unknown): this {
    const record = readLLMRecord(delta);
    const deltaIndex = numberValue(record.index);
    if (deltaIndex !== null) {
      this.index = deltaIndex;
    }
    if (typeof record.id === "string" && !this.id) {
      this.id = record.id;
    }
    if (typeof record.type === "string") {
      this.type = record.type;
    }
    const functionDelta = readLLMRecord(record.function);
    if (typeof functionDelta.name === "string" && functionDelta.name.length > 0) {
      this.function.name = functionDelta.name;
    }
    if (typeof functionDelta.arguments === "string" && functionDelta.arguments.length > 0) {
      this.function.arguments += functionDelta.arguments;
    }
    return this;
  }

  toToolCall(): Record<string, unknown> {
    return {
      id: this.id,
      type: this.type,
      index: this.index,
      function: {
        name: this.function.name,
        arguments: this.function.arguments,
      },
    };
  }

  to_tool_call(): Record<string, unknown> {
    return this.toToolCall();
  }

  static toToolCalls(toolCalls: Record<string | number, AccumulatedToolArgs | { id?: string | null; index?: number; type?: string; function?: { name?: string; arguments?: string } }>): Record<string, unknown>[] {
    return Object.entries(toolCalls)
      .map(([key, value]) => {
        const accumulator = value instanceof AccumulatedToolArgs ? value : new AccumulatedToolArgs(value);
        if (accumulator.index === 0) {
          const keyIndex = Number(key);
          if (Number.isInteger(keyIndex)) {
            accumulator.index = keyIndex;
          }
        }
        return accumulator;
      })
      .sort((left, right) => left.index - right.index)
      .map((entry) => entry.toToolCall());
  }

  static to_tool_calls(toolCalls: Record<string | number, AccumulatedToolArgs | { id?: string | null; index?: number; type?: string; function?: { name?: string; arguments?: string } }>): Record<string, unknown>[] {
    return AccumulatedToolArgs.toToolCalls(toolCalls);
  }

  static fromStreamingChunks(chunks: readonly unknown[]): Record<string, unknown>[] {
    const accumulators: Record<number, AccumulatedToolArgs> = {};
    for (const chunk of chunks) {
      for (const toolCall of extractStreamingToolCallDeltas(chunk)) {
        const index = numberValue(readLLMRecord(toolCall).index) ?? 0;
        accumulators[index] ??= new AccumulatedToolArgs({ index });
        accumulators[index].accumulate(toolCall);
      }
    }
    return AccumulatedToolArgs.toToolCalls(accumulators);
  }

  static from_streaming_chunks(chunks: readonly unknown[]): Record<string, unknown>[] {
    return AccumulatedToolArgs.fromStreamingChunks(chunks);
  }
}

function extractStreamingToolCallDeltas(chunk: unknown): unknown[] {
  const record = readLLMRecord(chunk);
  const direct = readLLMRecord(record.delta).tool_calls ?? record.tool_calls;
  if (Array.isArray(direct)) {
    return direct;
  }
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const deltas: unknown[] = [];
  for (const choice of choices) {
    const toolCalls = readLLMRecord(readLLMRecord(choice).delta).tool_calls;
    if (Array.isArray(toolCalls)) {
      for (const toolCall of toolCalls as unknown[]) {
        deltas.push(toolCall);
      }
    }
  }
  return deltas;
}

function readLLMRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export const LLM_CONTEXT_WINDOW_SIZES: Readonly<Record<string, number>> = {
  "gpt-4": 8192,
  "gpt-4o": 128000,
  "gpt-4o-mini": 200000,
  "gpt-4-turbo": 128000,
  "gpt-4.1": 1047576,
  "gpt-4.1-mini-2025-04-14": 1047576,
  "gpt-4.1-nano-2025-04-14": 1047576,
  "o1-preview": 128000,
  "o1-mini": 128000,
  "o3-mini": 200000,
  "o4-mini": 200000,
  "gemini-3-pro-preview": 1048576,
  "gemini-2.0-flash": 1048576,
  "gemini-2.0-flash-thinking-exp-01-21": 32768,
  "gemini-2.0-flash-lite-001": 1048576,
  "gemini-2.0-flash-001": 1048576,
  "gemini-2.5-flash-preview-04-17": 1048576,
  "gemini-2.5-pro-exp-03-25": 1048576,
  "gemini-1.5-pro": 2097152,
  "gemini-1.5-flash": 1048576,
  "gemini-1.5-flash-8b": 1048576,
  "deepseek-chat": 128000,
  "llama-3.1-70b-versatile": 131072,
  "llama-3.1-8b-instant": 131072,
  "llama-3.3-70b-versatile": 128000,
  "mixtral-8x7b-32768": 32768,
  "anthropic.claude-v2": 100000,
  "anthropic.claude-v2:1": 200000,
  "anthropic.claude-instant-v1": 100000,
  "anthropic.claude-3-haiku-20240307-v1:0": 200000,
  "anthropic.claude-3-sonnet-20240229-v1:0": 200000,
  "anthropic.claude-3-opus-20240229-v1:0": 200000,
  "anthropic.claude-3-5-sonnet-20240620-v1:0": 200000,
  "anthropic.claude-3-5-haiku-20241022-v1:0": 200000,
  "anthropic.claude-3-7-sonnet-20250219-v1:0": 200000,
  "anthropic.claude-sonnet-4-20250514-v1:0": 200000,
  "anthropic.claude-opus-4-20250514-v1:0": 200000,
  "anthropic.claude-sonnet-4-5-20250929-v1:0": 200000,
  "anthropic.claude-opus-4-5-20251101-v1:0": 200000,
  "anthropic.claude-haiku-4-5-20251001-v1:0": 200000,
  "anthropic.claude-opus-4-7": 1000000,
  "anthropic.claude-sonnet-4-6": 1000000,
  "amazon.nova-pro-v1:0": 300000,
  "amazon.nova-lite-v1:0": 300000,
  "amazon.nova-micro-v1:0": 128000,
  "meta.llama3-1-8b-instruct-v1:0": 128000,
  "meta.llama3-1-70b-instruct-v1:0": 128000,
  "meta.llama3-1-405b-instruct-v1:0": 128000,
  "mistral-tiny": 32768,
  "mistral-small-latest": 32768,
  "mistral-medium-latest": 32768,
  "mistral-large-latest": 32768,
};

export type LLMCallContextCallback<T> = (callId: string) => MaybePromise<T>;

const currentCallIdStore = new AsyncLocalStorage<string>();
const callStopOverrideStore = new AsyncLocalStorage<Map<BaseLLM, readonly string[]>>();
let configuredCallbacks: readonly unknown[] = [];
let configuredSuccessCallbacks: readonly unknown[] = [];
let configuredFailureCallbacks: readonly unknown[] = [];
const registeredProviders = new Map<string, LLMClient>();
const openAIModelSet = new Set<string>(OPENAI_MODELS);
const anthropicModelSet = new Set<string>(ANTHROPIC_MODELS);
const geminiModelSet = new Set<string>(GEMINI_MODELS);
const azureModelSet = new Set<string>(AZURE_MODELS);
const bedrockModelSet = new Set<string>(BEDROCK_MODELS);
const nativeProviderSet = new Set<string>(SUPPORTED_NATIVE_PROVIDERS);

export async function llmCallContext<T>(callback: LLMCallContextCallback<T>): Promise<T> {
  const callId = randomUUID();
  return await currentCallIdStore.run(callId, async () => await callback(callId));
}

export const llm_call_context = llmCallContext;

export function validate_function_name(name: string, provider = "LLM"): string {
  if (!name) {
    throw new Error(`${provider} function name cannot be empty`);
  }
  if (!/^[A-Za-z_]/.test(name)) {
    throw new Error(`${provider} function name '${name}' must start with a letter or underscore`);
  }
  if (name.length > 64) {
    throw new Error(`${provider} function name '${name}' exceeds 64 character limit`);
  }
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`${provider} function name '${name}' contains invalid characters. Only lowercase letters, numbers, and underscores allowed`);
  }
  return name;
}

export function sanitize_function_name(name: string): string {
  const normalized = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").slice(0, 64);
  return /^[a-z_]/.test(normalized) ? normalized : `_${normalized}`;
}

export function extract_tool_info(tool: Record<string, unknown>): [string, string, Record<string, unknown>] {
  if (!recordOrNull(tool)) {
    throw new Error("Tool must be a dictionary");
  }
  let source = tool;
  if ("function" in tool) {
    const functionInfo = recordOrNull(tool.function);
    if (!functionInfo) {
      throw new Error("Tool function must be a dictionary");
    }
    source = functionInfo;
  }
  const name = stringOrEmpty(source.name);
  const description = stringOrEmpty(source.description);
  const parameters = recordOrNull(source.parameters) ?? argsSchemaParameters(source.args_schema) ?? {};
  return [name, description, parameters];
}

export function log_tool_conversion(tool: Record<string, unknown>, provider: string): void {
  void extract_tool_info(tool);
  void provider;
}

export function safe_tool_conversion(tool: Record<string, unknown>, provider: string): [string, string, Record<string, unknown>] {
  log_tool_conversion(tool, provider);
  const [name, description, parameters] = extract_tool_info(tool);
  return [validate_function_name(sanitize_function_name(name), provider), description, parameters];
}

export function getCurrentCallId(): string {
  return currentCallIdStore.getStore() ?? randomUUID();
}

export const get_current_call_id = getCurrentCallId;

export async function callStopOverride<T>(
  llm: BaseLLM,
  stop: string | readonly string[] | null,
  callback: () => MaybePromise<T>,
): Promise<T> {
  const current = callStopOverrideStore.getStore();
  const overrides = new Map(current ?? []);
  if (stop === null) {
    overrides.delete(llm);
  } else {
    overrides.set(llm, normalizeStopSequences(stop));
  }
  return await callStopOverrideStore.run(overrides, async () => await callback());
}

export const call_stop_override = callStopOverride;

export class FunctionLLM implements LLMClient {
  private usageMetrics: UsageMetrics = emptyUsageMetrics();

  constructor(private readonly fn: LLMFunction) {}

  async call(messages: readonly LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse> {
    const response = await this.fn(messages, options);
    this.usageMetrics = addUsageMetrics(
      this.usageMetrics,
      estimateUsageMetrics(messages, response),
    );
    return response;
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
}

export function createLLM(
  llmValue: CreateLLMValue | null | undefined = null,
  env: CreateLLMEnvironment = process.env,
): LLMClient | null {
  if (llmValue == null) {
    return llmViaEnvironmentOrFallback(env);
  }
  if (typeof llmValue === "string") {
    const spec = resolveLLMModelSpec(llmValue);
    return new ConfiguredLLM({
      model: llmValue,
      provider: spec.provider,
      is_litellm: !spec.useNative,
    });
  }
  if (typeof llmValue === "function" || isLLMClient(llmValue)) {
    return createLLMClient(llmValue);
  }
  const model = stringProperty(llmValue, "model")
    ?? stringProperty(llmValue, "model_name")
    ?? stringProperty(llmValue, "deployment_name")
    ?? "unknown";
  const options: ConstructorParameters<typeof ConfiguredLLM>[0] = {
    model,
    provider: resolveLLMModelSpec(model, stringProperty(llmValue, "provider")).provider,
    temperature: numberProperty(llmValue, "temperature"),
    max_tokens: numberProperty(llmValue, "max_tokens"),
    max_completion_tokens: numberProperty(llmValue, "max_completion_tokens"),
    logprobs: numberProperty(llmValue, "logprobs"),
    timeout: numberProperty(llmValue, "timeout"),
  };
  const apiKey = stringProperty(llmValue, "api_key");
  const baseUrl = stringProperty(llmValue, "base_url");
  const apiBase = stringProperty(llmValue, "api_base");
  if (apiKey !== undefined) {
    options.api_key = apiKey;
  }
  if (baseUrl !== undefined) {
    options.base_url = baseUrl;
  }
  if (apiBase !== undefined) {
    options.api_base = apiBase;
  }
  return new ConfiguredLLM(options);
}

export const create_llm = createLLM;

export function llmViaEnvironmentOrFallback(env: CreateLLMEnvironment = process.env): LLMClient {
  const model = env.MODEL ?? env.MODEL_NAME ?? env.OPENAI_MODEL_NAME ?? DEFAULT_LLM_MODEL;
  const baseUrl = env.BASE_URL ?? env.OPENAI_API_BASE ?? env.OPENAI_BASE_URL;
  const apiBase = env.API_BASE ?? env.AZURE_API_BASE ?? baseUrl;
  const spec = resolveLLMModelSpec(model);
  const options: ConstructorParameters<typeof ConfiguredLLM>[0] = {
    model,
    provider: spec.provider,
    is_litellm: !spec.useNative,
    ...(baseUrl === undefined ? {} : { base_url: baseUrl }),
    ...(apiBase === undefined ? {} : { api_base: apiBase }),
  };
  applyLLMEnvVars(options, spec.provider, env);
  return new ConfiguredLLM(options);
}

export const llm_via_environment_or_fallback = llmViaEnvironmentOrFallback;

export function normalizeLLMEnvKeyName(keyName: string): string {
  for (const pattern of LITELLM_PARAMS) {
    if (keyName.includes(pattern)) {
      return pattern;
    }
  }
  return keyName;
}

export const normalize_llm_env_key_name = normalizeLLMEnvKeyName;

export type BaseLLMOptions = {
  model: string;
  temperature?: number | null;
  apiKey?: string | null;
  api_key?: string | null;
  baseUrl?: string | null;
  base_url?: string | null;
  provider?: string | null;
  preferUpload?: boolean;
  prefer_upload?: boolean;
  isLitellm?: boolean;
  is_litellm?: boolean;
  stop?: string | readonly string[] | null;
  stopSequences?: string | readonly string[] | null;
  stop_sequences?: string | readonly string[] | null;
  additionalParams?: Record<string, unknown>;
  additional_params?: Record<string, unknown>;
  responseFormat?: JsonResponseFormat | StructuredOutputValidator | null;
  response_format?: JsonResponseFormat | StructuredOutputValidator | null;
  contextWindowSize?: number;
  context_window_size?: number;
};

const BASE_LLM_OPTION_FIELDS = new Set([
  "model",
  "temperature",
  "apiKey",
  "api_key",
  "baseUrl",
  "base_url",
  "provider",
  "preferUpload",
  "prefer_upload",
  "isLitellm",
  "is_litellm",
  "stop",
  "stopSequences",
  "stop_sequences",
  "additionalParams",
  "additional_params",
  "responseFormat",
  "response_format",
  "contextWindowSize",
  "context_window_size",
]);

export abstract class BaseLLM implements LLMClient {
  readonly llmType = "base";
  readonly llm_type = "base";
  readonly model: string;
  readonly temperature: number | null;
  readonly apiKey: string | null;
  readonly api_key: string | null;
  readonly baseUrl: string | null;
  readonly base_url: string | null;
  readonly provider: string;
  readonly preferUpload: boolean;
  readonly prefer_upload: boolean;
  readonly isLitellm: boolean;
  readonly is_litellm: boolean;
  readonly additionalParams: Record<string, unknown>;
  readonly additional_params: Record<string, unknown>;
  readonly responseFormat: JsonResponseFormat | StructuredOutputValidator | null;
  readonly response_format: JsonResponseFormat | StructuredOutputValidator | null;
  private contextWindowSize: number;
  stop: string[];
  private tokenUsage: UsageMetrics = emptyUsageMetrics();

  constructor(options: BaseLLMOptions) {
    if (!options.model) {
      throw new Error("Model name is required and cannot be empty.");
    }
    this.model = options.model;
    this.temperature = options.temperature ?? null;
    this.apiKey = options.apiKey ?? options.api_key ?? null;
    this.api_key = this.apiKey;
    this.baseUrl = options.baseUrl ?? options.base_url ?? null;
    this.base_url = this.baseUrl;
    this.provider = options.provider || "openai";
    this.preferUpload = options.preferUpload ?? options.prefer_upload ?? false;
    this.prefer_upload = this.preferUpload;
    this.isLitellm = options.isLitellm ?? options.is_litellm ?? false;
    this.is_litellm = this.isLitellm;
    this.stop = normalizeStopSequences(options.stopSequences ?? options.stop_sequences ?? options.stop ?? []);
    this.additionalParams = { ...(options.additionalParams ?? {}), ...(options.additional_params ?? {}) };
    this.additional_params = this.additionalParams;
    this.responseFormat = options.responseFormat ?? options.response_format ?? null;
    this.response_format = this.responseFormat;
    this.contextWindowSize = options.contextWindowSize ?? options.context_window_size ?? 0;
  }

  abstract call(messages: readonly LLMMessage[], options?: LLMCallOptions): MaybePromise<LLMResponse>;

  async acall(messages: LLMMessageInput, options?: LLMCallOptions): Promise<LLMResponse> {
    return await this.call(this.formatMessages(messages), options);
  }

  get stopSequences(): readonly string[] {
    const override = callStopOverrideStore.getStore()?.get(this);
    if (override) {
      return override;
    }
    return this.stop;
  }

  get stop_sequences(): readonly string[] {
    return this.stopSequences;
  }

  setStopSequences(stop: string | readonly string[] | null): void {
    this.stop = normalizeStopSequences(stop);
  }

  set_stop_sequences(stop: string | readonly string[] | null): void {
    this.setStopSequences(stop);
  }

  supportsStopWords(): boolean {
    if (this.model.toLowerCase().includes("gpt-5")) {
      return false;
    }
    return DEFAULT_SUPPORTS_STOP_WORDS;
  }

  supports_stop_words(): boolean {
    return this.supportsStopWords();
  }

  supportsFunctionCalling(): boolean {
    return true;
  }

  supports_function_calling(): boolean {
    return this.supportsFunctionCalling();
  }

  protected supportsStopWordsImplementation(): boolean {
    return this.stopSequences.length > 0;
  }

  protected _supports_stop_words_implementation(): boolean {
    return this.supportsStopWordsImplementation();
  }

  applyStopWords(content: string): string {
    if (this.stopSequences.length === 0 || content.length === 0) {
      return content;
    }
    let earliest = content.length;
    for (const stop of this.stopSequences) {
      const index = content.indexOf(stop);
      if (index !== -1 && index < earliest) {
        earliest = index;
      }
    }
    return earliest === content.length ? content : content.slice(0, earliest).trim();
  }

  _apply_stop_words(content: string): string {
    return this.applyStopWords(content);
  }

  getContextWindowSize(): number {
    if (this.contextWindowSize !== 0) {
      return this.contextWindowSize;
    }
    this.contextWindowSize = knownContextWindowSizeForModel(this.model) ?? DEFAULT_CONTEXT_WINDOW_SIZE;
    return this.contextWindowSize;
  }

  get_context_window_size(): number {
    return this.getContextWindowSize();
  }

  supportsMultimodal(): boolean {
    return false;
  }

  supports_multimodal(): boolean {
    return this.supportsMultimodal();
  }

  formatTextContent(text: string): Record<string, string> {
    return { type: "text", text };
  }

  format_text_content(text: string): Record<string, string> {
    return this.formatTextContent(text);
  }

  getFileUploader(): LocalFileUploader | null {
    return null;
  }

  get_file_uploader(): LocalFileUploader | null {
    return this.getFileUploader();
  }

  get lastResponseId(): string | null {
    return null;
  }

  get last_response_id(): string | null {
    return this.lastResponseId;
  }

  get lastReasoningItems(): readonly unknown[] | null {
    return null;
  }

  get last_reasoning_items(): readonly unknown[] | null {
    return this.lastReasoningItems;
  }

  resetChain(): void {}

  reset_chain(): void {
    this.resetChain();
  }

  resetReasoningChain(): void {}

  reset_reasoning_chain(): void {
    this.resetReasoningChain();
  }

  emitCallStartedEvent(options: LLMEmitCallStartedOptions): void {
    crewaiEventBus.emit(this, new LLMCallStartedEvent({
      call_id: getCurrentCallId(),
      from_task: options.fromTask ?? options.from_task,
      from_agent: options.fromAgent ?? options.from_agent,
      model: this.model,
      messages: serializeLLMEventMessages(options.messages),
      tools: options.tools ?? null,
      callbacks: options.callbacks ?? null,
      available_functions: options.availableFunctions ?? options.available_functions ?? null,
    }));
  }

  _emit_call_started_event(options: LLMEmitCallStartedOptions): void {
    this.emitCallStartedEvent(options);
  }

  emitCallCompletedEvent(options: LLMEmitCallCompletedOptions): void {
    crewaiEventBus.emit(this, new LLMCallCompletedEvent({
      call_id: getCurrentCallId(),
      from_task: options.fromTask ?? options.from_task,
      from_agent: options.fromAgent ?? options.from_agent,
      model: this.model,
      messages: options.messages === undefined || options.messages === null
        ? null
        : serializeLLMEventMessages(options.messages),
      response: options.response,
      call_type: options.callType ?? options.call_type ?? LLMCallType.LLM_CALL,
      usage: options.usage ?? null,
    }));
  }

  _emit_call_completed_event(options: LLMEmitCallCompletedOptions): void {
    this.emitCallCompletedEvent(options);
  }

  handleEmitCallEvents(
    responseOrOptions: unknown,
    callType: LLMCallType = LLMCallType.LLM_CALL,
    fromTask: unknown = null,
    fromAgent: unknown = null,
    messages: string | readonly LLMMessage[] | null = null,
    usage: Record<string, unknown> | null = null,
  ): void {
    const options = isRecord(responseOrOptions) && ("response" in responseOrOptions || "call_type" in responseOrOptions || "callType" in responseOrOptions)
      ? responseOrOptions as LLMHandleEmitCallEventsOptions
      : {
          response: responseOrOptions,
          callType,
          fromTask,
          fromAgent,
          messages,
          usage,
        };
    this.emitCallCompletedEvent(options);
  }

  _handle_emit_call_events(
    responseOrOptions: unknown,
    callType: LLMCallType = LLMCallType.LLM_CALL,
    fromTask: unknown = null,
    fromAgent: unknown = null,
    messages: string | readonly LLMMessage[] | null = null,
    usage: Record<string, unknown> | null = null,
  ): void {
    this.handleEmitCallEvents(responseOrOptions, callType, fromTask, fromAgent, messages, usage);
  }

  emitCallFailedEvent(options: LLMEmitCallFailedOptions): void {
    crewaiEventBus.emit(this, new LLMCallFailedEvent({
      call_id: getCurrentCallId(),
      from_task: options.fromTask ?? options.from_task,
      from_agent: options.fromAgent ?? options.from_agent,
      model: this.model,
      error: options.error,
    }));
  }

  _emit_call_failed_event(options: LLMEmitCallFailedOptions): void {
    this.emitCallFailedEvent(options);
  }

  emitStreamChunkEvent(options: LLMEmitStreamChunkOptions): void {
    crewaiEventBus.emit(this, new LLMStreamChunkEvent({
      call_id: getCurrentCallId(),
      from_task: options.fromTask ?? options.from_task,
      from_agent: options.fromAgent ?? options.from_agent,
      model: this.model,
      chunk: options.chunk,
      tool_call: options.toolCall ?? options.tool_call ?? null,
      call_type: options.callType ?? options.call_type ?? null,
      response_id: options.responseId ?? options.response_id ?? null,
    }));
  }

  _emit_stream_chunk_event(options: LLMEmitStreamChunkOptions): void {
    this.emitStreamChunkEvent(options);
  }

  emitThinkingChunkEvent(options: LLMEmitThinkingChunkOptions): void {
    crewaiEventBus.emit(this, new LLMThinkingChunkEvent({
      call_id: getCurrentCallId(),
      from_task: options.fromTask ?? options.from_task,
      from_agent: options.fromAgent ?? options.from_agent,
      model: this.model,
      chunk: options.chunk,
      response_id: options.responseId ?? options.response_id ?? null,
    }));
  }

  _emit_thinking_chunk_event(options: LLMEmitThinkingChunkOptions): void {
    this.emitThinkingChunkEvent(options);
  }

  async handleToolExecution(options: LLMHandleToolExecutionOptions): Promise<string | null> {
    const functionName = options.functionName ?? options.function_name;
    const functionArgs = options.functionArgs ?? options.function_args ?? {};
    const availableFunctions = options.availableFunctions ?? options.available_functions ?? {};
    if (!functionName) {
      return null;
    }
    const fn = availableFunctions[functionName];
    if (!fn) {
      return null;
    }

    const startedAt = new Date();
    try {
      crewaiEventBus.emit(this, new ToolUsageStartedEvent({
        toolName: functionName,
        toolArgs: functionArgs,
        toolClass: "BaseLLM",
      }));
      const result = await invokeAvailableFunction(fn, functionArgs);
      crewaiEventBus.emit(this, new ToolUsageFinishedEvent({
        toolName: functionName,
        toolArgs: functionArgs,
        toolClass: "BaseLLM",
        startedAt,
        output: result,
      }));
      this.emitCallCompletedEvent({
        response: result,
        callType: LLMCallType.TOOL_CALL,
        from_task: options.fromTask ?? options.from_task,
        from_agent: options.fromAgent ?? options.from_agent,
      });
      return stringifyToolExecutionResult(result);
    } catch (error) {
      const errorMessage = `Error executing function '${functionName}': ${error instanceof Error ? error.message : String(error)}`;
      crewaiEventBus.emit(this, new ToolUsageErrorEvent({
        toolName: functionName,
        toolArgs: functionArgs,
        toolClass: "BaseLLM",
        error: errorMessage,
      }));
      this.emitCallFailedEvent({
        error: errorMessage,
        from_task: options.fromTask ?? options.from_task,
        from_agent: options.fromAgent ?? options.from_agent,
      });
      return null;
    }
  }

  async _handle_tool_execution(options: LLMHandleToolExecutionOptions): Promise<string | null> {
    return await this.handleToolExecution(options);
  }

  async handleToolCall(
    toolCalls: unknown,
    availableFunctions: Record<string, LLMAvailableFunction> | null = null,
    fromTask: unknown = null,
    fromAgent: unknown = null,
  ): Promise<string | null> {
    const calls = Array.isArray(toolCalls) ? toolCalls : [toolCalls];
    const available = availableFunctions ?? {};
    if (calls.length === 0 || Object.keys(available).length === 0) {
      return null;
    }
    const parsed = parseLLMToolCall(calls[0]);
    if (!parsed) {
      return null;
    }
    return await this.handleToolExecution({
      functionName: parsed.name,
      functionArgs: parsed.args,
      availableFunctions: available,
      fromTask,
      fromAgent,
    });
  }

  async _handle_tool_call(
    toolCalls: unknown,
    availableFunctions: Record<string, LLMAvailableFunction> | null = null,
    fromTask: unknown = null,
    fromAgent: unknown = null,
  ): Promise<string | null> {
    return await this.handleToolCall(toolCalls, availableFunctions, fromTask, fromAgent);
  }

  convertToolsForInterference(tools: readonly Tool[]): readonly unknown[] {
    return tools;
  }

  _convert_tools_for_interference(tools: readonly Tool[]): readonly unknown[] {
    return this.convertToolsForInterference(tools);
  }

  formatMessages(messages: LLMMessageInput): LLMMessage[] {
    if (typeof messages === "string") {
      return [{ role: "user", content: messages }];
    }
    const cleaned = messages.map((message, index) => {
      if (Array.isArray(message)) {
        throw new Error(`Message at index ${String(index)} must be a dictionary.`);
      }
      if (!isLLMRole(message.role) || typeof message.content !== "string") {
        throw new Error(`Message at index ${String(index)} must have 'role' and 'content' keys.`);
      }
      const copy = { ...message };
      stripCacheBreakpoint(copy);
      return copy as LLMMessage;
    });
    return this.processMessageFiles(cleaned);
  }

  _format_messages(messages: LLMMessageInput): LLMMessage[] {
    return this.formatMessages(messages);
  }

  formatMessagesForProvider(messages: readonly LLMMessage[]): LLMMessage[] {
    for (const message of messages) {
      if (!isLLMRole(message.role) || typeof message.content !== "string") {
        throw new TypeError("Invalid message format. Each message must be a dict with 'role' and 'content' keys");
      }
    }

    const model = this.model.toLowerCase();
    if (model.includes("o1")) {
      return messages.map((message) => message.role === "system"
        ? { ...message, role: "assistant" }
        : { ...message });
    }
    if ((model.includes("mistral") || model.includes("ollama")) && messages.at(-1)?.role === "assistant") {
      return [...messages.map((message) => ({ ...message })), { role: "user", content: model.includes("mistral") ? "Please continue." : "" }];
    }
    if (!BaseLLM.isAnthropicModel(this.model)) {
      return messages.map((message) => ({ ...message }));
    }
    if (messages.length === 0 || messages[0]?.role === "system") {
      return [{ role: "user", content: "." }, ...messages.map((message) => ({ ...message }))];
    }
    return messages.map((message) => ({ ...message }));
  }

  _format_messages_for_provider(messages: readonly LLMMessage[]): LLMMessage[] {
    return this.formatMessagesForProvider(messages);
  }

  prepareCompletionParams(
    messages: LLMMessageInput,
    ...args: unknown[]
  ): Record<string, unknown> {
    const tools = Array.isArray(args[0]) ? args[0] as readonly Record<string, unknown>[] : null;
    const skipFileProcessing = typeof args[1] === "boolean" ? args[1] : false;
    const normalizedMessages = typeof messages === "string"
      ? [{ role: "user" as const, content: messages }]
      : messages.map((message, index) => {
          if (Array.isArray(message)) {
            throw new Error(`Message at index ${String(index)} must be a dictionary.`);
          }
          if (!isLLMRole(message.role) || typeof message.content !== "string") {
            throw new Error(`Message at index ${String(index)} must have 'role' and 'content' keys.`);
          }
          const copy = { ...message };
          stripCacheBreakpoint(copy);
          return copy as LLMMessage;
        });
    const processedMessages = skipFileProcessing ? normalizedMessages : this.processMessageFiles(normalizedMessages);
    const params = removeUndefinedValues({
      model: this.model,
      messages: this.formatMessagesForProvider(processedMessages),
      temperature: this.temperature,
      stop: this.supportsStopWords() && this.stopSequences.length > 0 ? [...this.stopSequences] : null,
      response_format: this.responseFormat === null ? null : this.serializeResponseFormat(this.responseFormat),
      api_key: this.apiKey,
      base_url: this.baseUrl,
      provider: this.provider,
      stream: booleanOrNull(this.additionalParams.stream),
      tools,
      ...this.additionalParams,
    });
    return params;
  }

  _prepare_completion_params(
    messages: LLMMessageInput,
    ...args: unknown[]
  ): Record<string, unknown> {
    return this.prepareCompletionParams(messages, ...args);
  }

  processMessageFiles(messages: readonly LLMMessage[]): LLMMessage[] {
    if (!this.supportsMultimodal() && messages.some((message) => message.files && Object.keys(message.files).length > 0)) {
      throw new Error(`Model '${this.model}' does not support multimodal input, but files were provided via 'input_files'.`);
    }
    if (!this.supportsMultimodal()) {
      return messages.map((message) => ({ ...message }));
    }
    const uploader = this.preferUpload ? this.getFileUploader() : null;
    return messages.map((message) => {
      if (!message.files || Object.keys(message.files).length === 0) {
        return { ...message };
      }
      const contentBlocks: Record<string, unknown>[] = [];
      if (typeof message.content === "string" && message.content.length > 0) {
        contentBlocks.push(this.formatTextContent(message.content));
      }
      for (const [name, file] of Object.entries(message.files)) {
        contentBlocks.push(uploader
          ? formatUploadedFileContentBlock(name, uploader.upload(name, file))
          : formatInlineFileContentBlock(name, file));
      }
      const { files: _files, ...rest } = message;
      void _files;
      const formattedMessage = {
        ...rest,
        content: contentBlocks as unknown as string,
      };
      return formattedMessage;
    });
  }

  _process_message_files(messages: readonly LLMMessage[]): LLMMessage[] {
    return this.processMessageFiles(messages);
  }

  async aprocessMessageFiles(messages: readonly LLMMessage[]): Promise<LLMMessage[]> {
    return await Promise.resolve(this.processMessageFiles(messages));
  }

  async _aprocess_message_files(messages: readonly LLMMessage[]): Promise<LLMMessage[]> {
    return await this.aprocessMessageFiles(messages);
  }

  async handleStreamingResponse(
    params: Record<string, unknown>,
    callbacks: readonly LLMStreamingCallback[] | null = null,
    availableFunctions: Record<string, LLMAvailableFunction> | null = null,
    fromTask: unknown = null,
    fromAgent: unknown = null,
    responseModel: unknown = null,
  ): Promise<unknown> {
    void responseModel;
    const chunks = streamingChunksFromParams(params);
    let fullResponse = "";
    let lastChunk: unknown = null;
    let usageInfo: Record<string, unknown> | null = null;
    const collectedChunks: unknown[] = [];

    for await (const chunk of chunks) {
      lastChunk = chunk;
      collectedChunks.push(chunk);
      usageInfo = usageRecordFromChunk(chunk) ?? usageInfo;
      const content = streamingChunkContent(chunk);
      if (content !== null) {
        fullResponse += content;
        this.emitStreamChunkEvent({
          chunk: content,
          callType: LLMCallType.LLM_CALL,
          responseId: stringPropertyFromRecord(chunk, "id"),
          fromTask,
          fromAgent,
        });
      }
      await this.invokeStreamingCallbacks(callbacks, chunk);
    }

    if (usageInfo) {
      this.trackTokenUsageInternal(usageInfo);
    }
    this.handleStreamingCallbacks(callbacks, usageInfo, lastChunk);

    const toolCalls = AccumulatedToolArgs.fromStreamingChunks(collectedChunks);
    if (toolCalls.length > 0) {
      if (availableFunctions && Object.keys(availableFunctions).length > 0) {
        const toolResult = await this.handleToolCall(toolCalls, availableFunctions, fromTask, fromAgent);
        if (toolResult !== null) {
          return toolResult;
        }
      } else if (fullResponse.length === 0) {
        return toolCalls;
      }
    }

    if (!fullResponse.trim() && collectedChunks.length === 0) {
      return await this.handleNonStreamingResponse({ ...params, stream: false }, callbacks, availableFunctions, fromTask, fromAgent, responseModel);
    }

    this.handleEmitCallEvents({
      response: fullResponse,
      callType: LLMCallType.LLM_CALL,
      fromTask,
      fromAgent,
      messages: messagesFromParams(params),
      usage: usageInfo ? BaseLLM.usageToDict(usageInfo) : null,
    });
    return fullResponse;
  }

  async _handle_streaming_response(
    params: Record<string, unknown>,
    callbacks: readonly LLMStreamingCallback[] | null = null,
    availableFunctions: Record<string, LLMAvailableFunction> | null = null,
    fromTask: unknown = null,
    fromAgent: unknown = null,
    responseModel: unknown = null,
  ): Promise<unknown> {
    return await this.handleStreamingResponse(params, callbacks, availableFunctions, fromTask, fromAgent, responseModel);
  }

  async handleStreamingToolCalls(
    toolCalls: unknown,
    accumulatedToolArgs: Record<string | number, AccumulatedToolArgs> | null = null,
    availableFunctions: Record<string, LLMAvailableFunction> | null = null,
    fromTask: unknown = null,
    fromAgent: unknown = null,
    responseId: string | null = null,
  ): Promise<unknown> {
    const deltas = Array.isArray(toolCalls) ? toolCalls : [toolCalls];
    const accumulators = accumulatedToolArgs ?? {};
    for (const toolCall of deltas) {
      const record = readLLMRecord(toolCall);
      const index = numberValue(record.index) ?? 0;
      accumulators[index] ??= new AccumulatedToolArgs({ index });
      accumulators[index].accumulate(toolCall);
      this.emitStreamChunkEvent({
        chunk: stringPropertyFromRecord(readLLMRecord(record.function), "arguments") ?? "",
        toolCall: accumulators[index].toToolCall() as LLMToolCall,
        callType: LLMCallType.TOOL_CALL,
        responseId,
        fromTask,
        fromAgent,
      });
    }
    const completeToolCalls = AccumulatedToolArgs.toToolCalls(accumulators);
    if (!availableFunctions || Object.keys(availableFunctions).length === 0) {
      return null;
    }
    return await this.handleToolCall(completeToolCalls, availableFunctions, fromTask, fromAgent);
  }

  async _handle_streaming_tool_calls(
    toolCalls: unknown,
    accumulatedToolArgs: Record<string | number, AccumulatedToolArgs> | null = null,
    availableFunctions: Record<string, LLMAvailableFunction> | null = null,
    fromTask: unknown = null,
    fromAgent: unknown = null,
    responseId: string | null = null,
  ): Promise<unknown> {
    return await this.handleStreamingToolCalls(toolCalls, accumulatedToolArgs, availableFunctions, fromTask, fromAgent, responseId);
  }

  handleStreamingCallbacks(
    callbacks: readonly LLMStreamingCallback[] | null = null,
    usageInfo: Record<string, unknown> | null = null,
    lastChunk: unknown = null,
  ): void {
    if (!callbacks || callbacks.length === 0) {
      return;
    }
    const usage = usageInfo ?? usageRecordFromChunk(lastChunk);
    if (!usage) {
      return;
    }
    for (const callback of callbacks) {
      invokeUsageCallback(callback, usage);
    }
  }

  _handle_streaming_callbacks(
    callbacks: readonly LLMStreamingCallback[] | null = null,
    usageInfo: Record<string, unknown> | null = null,
    lastChunk: unknown = null,
  ): void {
    this.handleStreamingCallbacks(callbacks, usageInfo, lastChunk);
  }

  async invokeStreamingCallbacks(callbacks: readonly LLMStreamingCallback[] | null, chunk: unknown): Promise<void> {
    if (!callbacks) {
      return;
    }
    for (const callback of callbacks) {
      if (typeof callback === "function") {
        await callback(chunk);
      }
    }
  }

  handleNonStreamingResponse(
    params: Record<string, unknown>,
    callbacks: readonly LLMStreamingCallback[] | null = null,
    availableFunctions: Record<string, LLMAvailableFunction> | null = null,
    fromTask: unknown = null,
    fromAgent: unknown = null,
    responseModel: unknown = null,
  ): unknown {
    void responseModel;
    const response = params.response ?? params.rawResponse ?? params.raw_response ?? params;
    const usage = usageRecordFromChunk(response) ?? usageRecordFromChunk(params);
    if (usage) {
      this.trackTokenUsageInternal(usage);
      this.handleStreamingCallbacks(callbacks, usage, response);
    }

    const toolCalls = extractToolCallsFromResponse(response);
    if (toolCalls.length > 0) {
      if (!availableFunctions || Object.keys(availableFunctions).length === 0) {
        return toolCalls;
      }
      return this.handleToolCall(toolCalls, availableFunctions, fromTask, fromAgent);
    }

    const textResponse = extractResponseText(response);
    this.handleEmitCallEvents({
      response: textResponse,
      callType: LLMCallType.LLM_CALL,
      fromTask,
      fromAgent,
      messages: messagesFromParams(params),
      usage: usage ? BaseLLM.usageToDict(usage) : null,
    });
    return textResponse;
  }

  _handle_non_streaming_response(
    params: Record<string, unknown>,
    callbacks: readonly LLMStreamingCallback[] | null = null,
    availableFunctions: Record<string, LLMAvailableFunction> | null = null,
    fromTask: unknown = null,
    fromAgent: unknown = null,
    responseModel: unknown = null,
  ): unknown {
    return this.handleNonStreamingResponse(params, callbacks, availableFunctions, fromTask, fromAgent, responseModel);
  }

  async ahandleNonStreamingResponse(
    params: Record<string, unknown>,
    callbacks: readonly LLMStreamingCallback[] | null = null,
    availableFunctions: Record<string, LLMAvailableFunction> | null = null,
    fromTask: unknown = null,
    fromAgent: unknown = null,
    responseModel: unknown = null,
  ): Promise<unknown> {
    return await Promise.resolve(this.handleNonStreamingResponse(params, callbacks, availableFunctions, fromTask, fromAgent, responseModel));
  }

  async _ahandle_non_streaming_response(
    params: Record<string, unknown>,
    callbacks: readonly LLMStreamingCallback[] | null = null,
    availableFunctions: Record<string, LLMAvailableFunction> | null = null,
    fromTask: unknown = null,
    fromAgent: unknown = null,
    responseModel: unknown = null,
  ): Promise<unknown> {
    return await this.ahandleNonStreamingResponse(params, callbacks, availableFunctions, fromTask, fromAgent, responseModel);
  }

  async ahandleStreamingResponse(
    params: Record<string, unknown>,
    callbacks: readonly LLMStreamingCallback[] | null = null,
    availableFunctions: Record<string, LLMAvailableFunction> | null = null,
    fromTask: unknown = null,
    fromAgent: unknown = null,
    responseModel: unknown = null,
  ): Promise<unknown> {
    return await this.handleStreamingResponse(params, callbacks, availableFunctions, fromTask, fromAgent, responseModel);
  }

  async _ahandle_streaming_response(
    params: Record<string, unknown>,
    callbacks: readonly LLMStreamingCallback[] | null = null,
    availableFunctions: Record<string, LLMAvailableFunction> | null = null,
    fromTask: unknown = null,
    fromAgent: unknown = null,
    responseModel: unknown = null,
  ): Promise<unknown> {
    return await this.ahandleStreamingResponse(params, callbacks, availableFunctions, fromTask, fromAgent, responseModel);
  }

  getCustomLlmProvider(): string | null {
    const index = this.model.indexOf("/");
    return index === -1 ? null : this.model.slice(0, index);
  }

  _get_custom_llm_provider(): string | null {
    return this.getCustomLlmProvider();
  }

  validateCallParams(): void {
    if (this.responseFormat === null) {
      return;
    }
    if (!isJsonResponseFormat(this.responseFormat) && !isStructuredOutputValidator(this.responseFormat)) {
      throw new Error(`The model ${this.model} received an unsupported response_format value.`);
    }
  }

  _validate_call_params(): void {
    this.validateCallParams();
  }

  toConfigDict(): Record<string, unknown> {
    return {
      model: this.model,
      temperature: this.temperature,
      api_key: this.apiKey,
      base_url: this.baseUrl,
      provider: this.provider,
      prefer_upload: this.preferUpload,
      is_litellm: this.isLitellm,
      stop: [...this.stop],
      additional_params: { ...this.additionalParams },
      ...(this.responseFormat === null ? {} : { response_format: serializeResponseFormat(this.responseFormat) }),
    };
  }

  to_config_dict(): Record<string, unknown> {
    return this.toConfigDict();
  }

  serializeResponseFormat(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }
    if (isJsonResponseFormat(value) || isStructuredOutputValidator(value)) {
      return serializeResponseFormat(value);
    }
    return value;
  }

  _serialize_response_format(value: unknown): unknown {
    return this.serializeResponseFormat(value);
  }

  async invokeBeforeLlmCallHooks(
    messages: LLMMessage[],
    fromAgent: unknown = null,
  ): Promise<boolean> {
    if (fromAgent !== null && fromAgent !== undefined) {
      return true;
    }
    const context = new LLMCallHookContext({
      messages,
      llm: this,
      agent: null,
      task: null,
      crew: null,
    });
    try {
      await runBeforeLlmCallHooks(context);
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes("blocked by before_llm_call hook")) {
        return false;
      }
      return true;
    }
  }

  async _invoke_before_llm_call_hooks(
    messages: LLMMessage[],
    from_agent: unknown = null,
  ): Promise<boolean> {
    return await this.invokeBeforeLlmCallHooks(messages, from_agent);
  }

  async invokeAfterLlmCallHooks(
    messages: LLMMessage[],
    response: string,
    fromAgent: unknown = null,
  ): Promise<string> {
    if (fromAgent !== null && fromAgent !== undefined || typeof response !== "string") {
      return response;
    }
    const context = new LLMCallHookContext({
      messages,
      llm: this,
      agent: null,
      task: null,
      crew: null,
      response,
    });
    try {
      const result = await runAfterLlmCallHooks(context);
      return typeof result === "string" ? result : response;
    } catch {
      return response;
    }
  }

  async _invoke_after_llm_call_hooks(
    messages: LLMMessage[],
    response: string,
    from_agent: unknown = null,
  ): Promise<string> {
    return await this.invokeAfterLlmCallHooks(messages, response, from_agent);
  }

  trackTokenUsageInternal(usageData: Record<string, unknown>): void {
    const promptTokens = numberFromUsage(usageData, "prompt_tokens", "prompt_token_count", "input_tokens");
    const completionTokens = numberFromUsage(usageData, "completion_tokens", "candidates_token_count", "output_tokens");
    const cachedTokens = numberFromUsage(usageData, "cached_tokens", "cached_prompt_tokens", "cache_read_input_tokens")
      || nestedNumberFromUsage(usageData, "prompt_tokens_details", "cached_tokens");
    this.tokenUsage = addUsageMetrics(this.tokenUsage, {
      ...emptyUsageMetrics(),
      totalTokens: promptTokens + completionTokens,
      promptTokens,
      completionTokens,
      cachedPromptTokens: cachedTokens,
      reasoningTokens: numberFromUsage(usageData, "reasoning_tokens"),
      cacheCreationTokens: numberFromUsage(usageData, "cache_creation_tokens"),
      successfulRequests: 1,
    });
  }

  _track_token_usage_internal(usageData: Record<string, unknown>): void {
    this.trackTokenUsageInternal(usageData);
  }

  getUsageMetrics(): UsageMetrics {
    return { ...this.tokenUsage };
  }

  getTokenUsageSummary(): UsageMetrics {
    return this.getUsageMetrics();
  }

  get_token_usage_summary(): UsageMetrics {
    return this.getTokenUsageSummary();
  }

  resetUsageMetrics(): void {
    this.tokenUsage = emptyUsageMetrics();
  }

  reset_usage_metrics(): void {
    this.resetUsageMetrics();
  }

  validateStructuredOutput<T = unknown>(
    response: string,
    responseFormat: StructuredOutputValidator<T> | null = null,
  ): string | T {
    return validateStructuredOutput(response, responseFormat);
  }

  _validate_structured_output<T = unknown>(
    response: string,
    responseFormat: StructuredOutputValidator<T> | null = null,
  ): string | T {
    return this.validateStructuredOutput(response, responseFormat);
  }

  static validateStructuredOutput<T = unknown>(
    response: string,
    responseFormat: StructuredOutputValidator<T> | null = null,
  ): string | T {
    return validateStructuredOutput(response, responseFormat);
  }

  static _validate_structured_output<T = unknown>(
    response: string,
    responseFormat: StructuredOutputValidator<T> | null = null,
  ): string | T {
    return validateStructuredOutput(response, responseFormat);
  }

  static validateInitFields<T>(data: T): T;
  static validateInitFields(data: Record<string, unknown>): Record<string, unknown>;
  static validateInitFields(data: unknown): unknown {
    if (!isRecord(data)) {
      return data;
    }
    const normalized: Record<string, unknown> = {};
    const extras: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (BASE_LLM_OPTION_FIELDS.has(key)) {
        normalized[key] = value;
      } else {
        extras[key] = value;
      }
    }
    if (!normalized.model) {
      throw new Error("Model name is required and cannot be empty.");
    }
    const stopSequences = normalized.stop_sequences ?? normalized.stopSequences;
    const stop = stopSequences ?? normalized.stop;
    if (stop === null || stop === undefined) {
      normalized.stop = [];
    } else if (typeof stop === "string") {
      normalized.stop = [stop];
    } else if (Array.isArray(stop)) {
      normalized.stop = stop;
    } else if (isIterable(stop)) {
      normalized.stop = [...stop];
    }
    if (!normalized.provider) {
      normalized.provider = "openai";
    }
    normalized.additional_params = {
      ...(isRecord(normalized.additionalParams) ? normalized.additionalParams : {}),
      ...(isRecord(normalized.additional_params) ? normalized.additional_params : {}),
      ...extras,
    };
    return normalized;
  }

  static _validate_init_fields(data: unknown): unknown {
    return this.validateInitFields(data);
  }

  static validateLLMFields<T>(data: T): T | (T & { is_anthropic: boolean }) {
    if (!isRecord(data)) {
      return data;
    }
    const model = typeof data.model === "string" ? data.model : "";
    return { ...data, is_anthropic: this.isAnthropicModel(model) };
  }

  static _validate_llm_fields<T>(data: T): T | (T & { is_anthropic: boolean }) {
    return this.validateLLMFields(data);
  }

  initLitellm(): this {
    (this as { isLitellm: boolean; is_litellm: boolean }).isLitellm = true;
    (this as { isLitellm: boolean; is_litellm: boolean }).is_litellm = true;
    return this;
  }

  _init_litellm(): this {
    return this.initLitellm();
  }

  static isAnthropicModel(model: string): boolean {
    const normalized = model.toLowerCase();
    return ANTHROPIC_PREFIXES.some((prefix) => normalized.includes(prefix));
  }

  static _is_anthropic_model(model: string): boolean {
    return this.isAnthropicModel(model);
  }

  isAnthropicModel(model: string = this.model): boolean {
    return BaseLLM.isAnthropicModel(model);
  }

  _is_anthropic_model(model: string = this.model): boolean {
    return this.isAnthropicModel(model);
  }

  static getNativeProvider(provider: string): NativeLLMProviderName | null {
    const normalized = canonicalLLMProvider(provider);
    if (normalized === "openai" || normalized === "anthropic" || normalized === "azure" || normalized === "bedrock" || normalized === "gemini") {
      return normalized;
    }
    if (["openrouter", "deepseek", "ollama", "ollama_chat", "hosted_vllm", "cerebras", "dashscope"].includes(normalized)) {
      return "openai_compatible";
    }
    return null;
  }

  static _get_native_provider(provider: string): NativeLLMProviderName | null {
    return this.getNativeProvider(provider);
  }

  static usageToDict(usage: unknown): Record<string, unknown> | null {
    if (usage === null || usage === undefined) {
      return null;
    }
    if (isRecord(usage)) {
      const modelDump = usage.model_dump;
      if (typeof modelDump === "function") {
        const dumped = (modelDump as () => unknown)();
        return isRecord(dumped) ? dumped : null;
      }
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(usage)) {
        if (!key.startsWith("_")) {
          result[key] = value;
        }
      }
      return result;
    }
    return null;
  }

  static _usage_to_dict(usage: unknown): Record<string, unknown> | null {
    return this.usageToDict(usage);
  }

  usageToDict(usage: unknown): Record<string, unknown> | null {
    return BaseLLM.usageToDict(usage);
  }

  _usage_to_dict(usage: unknown): Record<string, unknown> | null {
    return this.usageToDict(usage);
  }

  static extractProvider(model: string): string {
    return extractProvider(model);
  }

  static _extract_provider(model: string): string {
    return extractProvider(model);
  }

  static canonicalLLMProvider(provider: string): string {
    return canonicalLLMProvider(provider);
  }

  static canonical_llm_provider(provider: string): string {
    return canonicalLLMProvider(provider);
  }

  static matchesProviderPattern(model: string, provider: string): boolean {
    return matchesProviderPattern(model, provider);
  }

  static _matches_provider_pattern(model: string, provider: string): boolean {
    return matchesProviderPattern(model, provider);
  }

  static validateModelInConstants(model: string, provider: string): boolean {
    return validateModelInConstants(model, provider);
  }

  static _validate_model_in_constants(model: string, provider: string): boolean {
    return validateModelInConstants(model, provider);
  }

  static inferProviderFromModel(model: string): string {
    return inferProviderFromModel(model);
  }

  static _infer_provider_from_model(model: string): string {
    return inferProviderFromModel(model);
  }

  static resolveLLMModelSpec(model: string, explicitProvider?: string): LLMModelSpec {
    return resolveLLMModelSpec(model, explicitProvider);
  }

  static resolve_llm_model_spec(model: string, explicitProvider?: string): LLMModelSpec {
    return resolveLLMModelSpec(model, explicitProvider);
  }

  static setCallbacks(callbacks: readonly unknown[]): void {
    const callbackTypes = new Set(
      callbacks
        .filter((callback) => typeof callback === "object" || typeof callback === "function")
        .map((callback) => callback?.constructor),
    );
    configuredSuccessCallbacks = configuredSuccessCallbacks.filter((callback) => !callbackTypes.has(callback?.constructor));
    configuredCallbacks = [...callbacks];
  }

  static set_callbacks(callbacks: readonly unknown[]): void {
    this.setCallbacks(callbacks);
  }

  static setEnvCallbacks(env: CreateLLMEnvironment = process.env): void {
    const successCallbacks = parseCallbackNames(env.LITELLM_SUCCESS_CALLBACKS);
    const failureCallbacks = parseCallbackNames(env.LITELLM_FAILURE_CALLBACKS);
    if (successCallbacks.length > 0 || failureCallbacks.length > 0) {
      configuredSuccessCallbacks = successCallbacks;
      configuredFailureCallbacks = failureCallbacks;
    }
  }

  static set_env_callbacks(env: CreateLLMEnvironment = process.env): void {
    this.setEnvCallbacks(env);
  }

  static get callbacks(): readonly unknown[] {
    return configuredCallbacks;
  }

  static get successCallbacks(): readonly unknown[] {
    return configuredSuccessCallbacks;
  }

  static get success_callbacks(): readonly unknown[] {
    return configuredSuccessCallbacks;
  }

  static get failureCallbacks(): readonly unknown[] {
    return configuredFailureCallbacks;
  }

  static get failure_callbacks(): readonly unknown[] {
    return configuredFailureCallbacks;
  }
}

export class ConfiguredLLM extends BaseLLM {
  readonly timeout: number | null;
  readonly maxTokens: number | null;
  readonly max_tokens: number | null;
  readonly maxCompletionTokens: number | null;
  readonly max_completion_tokens: number | null;
  readonly logprobs: number | null;
  readonly apiBase: string | null;
  readonly api_base: string | null;

  constructor(options: BaseLLMOptions & {
    timeout?: number | null;
    maxTokens?: number | null;
    max_tokens?: number | null;
    maxCompletionTokens?: number | null;
    max_completion_tokens?: number | null;
    logprobs?: number | null;
    apiBase?: string | null;
    api_base?: string | null;
  }) {
    super(options);
    this.timeout = options.timeout ?? null;
    this.maxTokens = options.maxTokens ?? options.max_tokens ?? null;
    this.max_tokens = this.maxTokens;
    this.maxCompletionTokens = options.maxCompletionTokens ?? options.max_completion_tokens ?? null;
    this.max_completion_tokens = this.maxCompletionTokens;
    this.logprobs = options.logprobs ?? null;
    this.apiBase = options.apiBase ?? options.api_base ?? this.baseUrl;
    this.api_base = this.apiBase;
  }

  async call(messages: readonly LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse> {
    const provider = resolveLLMProvider(this.model);
    if (!provider || provider === this) {
      throw new Error(`No LLM provider registered for model '${this.model}'.`);
    }
    return await provider.call(messages, options);
  }

  override toConfigDict(): Record<string, unknown> {
    return {
      ...super.toConfigDict(),
      ...(this.timeout === null ? {} : { timeout: this.timeout }),
      ...(this.maxTokens === null ? {} : { max_tokens: this.maxTokens }),
      ...(this.maxCompletionTokens === null ? {} : { max_completion_tokens: this.maxCompletionTokens }),
      ...(this.logprobs === null ? {} : { logprobs: this.logprobs }),
      ...(this.apiBase === null ? {} : { api_base: this.apiBase }),
    };
  }
}

export function createLLMClient(provider: LLM): LLMClient {
  return typeof provider === "function" ? new FunctionLLM(provider) : provider;
}

export function registerLLMProvider(model: string, provider: LLM): void {
  registeredProviders.set(model, createLLMClient(provider));
}

export function unregisterLLMProvider(model: string): void {
  registeredProviders.delete(model);
}

export function clearLLMProviders(): void {
  registeredProviders.clear();
}

export function resolveLLMProvider(model: string): LLMClient | null {
  return registeredProviders.get(model) ?? null;
}

export async function callLLM(
  client: LLMClient,
  messages: readonly LLMMessage[],
  options: LLMCallOptions = {},
): Promise<LLMResponse> {
  return await llmCallContext(async (callId) => {
    const mutableMessages = messages as LLMMessage[];
    const model = typeof options.metadata?.model === "string" ? options.metadata.model : null;
    crewaiEventBus.emit(client, new LLMCallStartedEvent({
      call_id: callId,
      from_agent: options.metadata?.agent,
      from_task: options.metadata?.task,
      model,
      messages: serializeLLMMessages(mutableMessages),
      tools: serializeLLMTools(options.tools),
      available_functions: options.availableFunctions ?? options.available_functions ?? null,
    }));
    const context = new LLMCallHookContext({
      messages: mutableMessages,
      llm: client,
      agent: options.metadata?.agent,
      task: options.metadata?.task,
      crew: options.metadata?.crew,
      iterations: typeof options.metadata?.iterations === "number" ? options.metadata.iterations : 0,
    });
    try {
      await runBeforeLlmCallHooks(context);
      const response = await client.call(mutableMessages, options);
      context.response = response;
      const finalResponse = await runAfterLlmCallHooks(context);
      crewaiEventBus.emit(client, new LLMCallCompletedEvent({
        call_id: callId,
        from_agent: options.metadata?.agent,
        from_task: options.metadata?.task,
        model,
        messages: serializeLLMMessages(mutableMessages),
        response: finalResponse,
        call_type: isToolCallingResponse(finalResponse) ? LLMCallType.TOOL_CALL : LLMCallType.LLM_CALL,
        usage: client.getUsageMetrics?.() ?? client.getTokenUsageSummary?.() ?? client.get_token_usage_summary?.() ?? null,
      }));
      return finalResponse;
    } catch (error) {
      crewaiEventBus.emit(client, new LLMCallFailedEvent({
        call_id: callId,
        from_agent: options.metadata?.agent,
        from_task: options.metadata?.task,
        model,
        error,
      }));
      throw error;
    }
  });
}

export function getLLMUsageMetrics(client: LLMClient): UsageMetrics {
  if (client.getUsageMetrics) {
    return normalizeUsageMetrics(client.getUsageMetrics());
  }
  if (client.getTokenUsageSummary) {
    return normalizeUsageMetrics(client.getTokenUsageSummary());
  }
  if (client.get_token_usage_summary) {
    return normalizeUsageMetrics(client.get_token_usage_summary());
  }
  return emptyUsageMetrics();
}

export function hasLLMUsageMetrics(client: LLMClient): boolean {
  return "getUsageMetrics" in client || "getTokenUsageSummary" in client || "get_token_usage_summary" in client;
}

export function markCacheBreakpoint<T extends Record<string, unknown>>(message: T): CacheBreakpointMessage<T> {
  return { ...message, cache_breakpoint: true };
}

export const mark_cache_breakpoint = markCacheBreakpoint;

export function stripCacheBreakpoint(message: Record<string, unknown>): void {
  delete message.cache_breakpoint;
}

export const strip_cache_breakpoint = stripCacheBreakpoint;

export function emptyUsageMetrics(): UsageMetrics {
  return new UsageMetrics();
}

export function addUsageMetrics(left: UsageMetrics, right: UsageMetrics): UsageMetrics {
  return new UsageMetrics({
    totalTokens: left.totalTokens + right.totalTokens,
    promptTokens: left.promptTokens + right.promptTokens,
    cachedPromptTokens: left.cachedPromptTokens + right.cachedPromptTokens,
    completionTokens: left.completionTokens + right.completionTokens,
    reasoningTokens: left.reasoningTokens + right.reasoningTokens,
    cacheCreationTokens: left.cacheCreationTokens + right.cacheCreationTokens,
    successfulRequests: left.successfulRequests + right.successfulRequests,
  });
}

export function subtractUsageMetrics(left: UsageMetrics, right: UsageMetrics): UsageMetrics {
  return new UsageMetrics({
    totalTokens: Math.max(0, left.totalTokens - right.totalTokens),
    promptTokens: Math.max(0, left.promptTokens - right.promptTokens),
    cachedPromptTokens: Math.max(0, left.cachedPromptTokens - right.cachedPromptTokens),
    completionTokens: Math.max(0, left.completionTokens - right.completionTokens),
    reasoningTokens: Math.max(0, left.reasoningTokens - right.reasoningTokens),
    cacheCreationTokens: Math.max(0, left.cacheCreationTokens - right.cacheCreationTokens),
    successfulRequests: Math.max(0, left.successfulRequests - right.successfulRequests),
  });
}

export function isEmptyUsageMetrics(metrics: UsageMetrics): boolean {
  return Object.values(metrics).every((value) => value === 0);
}

export function estimateUsageMetrics(
  messages: readonly LLMMessage[],
  response: LLMResponse,
): UsageMetrics {
  const promptTokens = messages.reduce(
    (total, message) => total + estimateTokens(message.content),
    0,
  );
  const completionText = typeof response === "string" ? response : JSON.stringify(response);
  const completionTokens = estimateTokens(completionText);
  return {
    ...emptyUsageMetrics(),
    totalTokens: promptTokens + completionTokens,
    promptTokens,
    completionTokens,
    successfulRequests: 1,
  };
}

export function estimateTokens(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }
  return Math.max(1, Math.ceil(trimmed.length / 4));
}

export function validateStructuredOutput<T = unknown>(
  response: string,
  responseFormat: StructuredOutputValidator<T> | null = null,
): string | T {
  if (responseFormat === null) {
    return response;
  }
  const data = parseStructuredOutputJson(response, validatorName(responseFormat));
  if (typeof responseFormat.modelValidate === "function") {
    return responseFormat.modelValidate(data);
  }
  if (typeof responseFormat.model_validate === "function") {
    return responseFormat.model_validate(data);
  }
  if (typeof responseFormat.parse === "function") {
    return responseFormat.parse(data);
  }
  if (typeof responseFormat.validate === "function") {
    return responseFormat.validate(data);
  }
  return data as T;
}

export const validate_structured_output = validateStructuredOutput;

export function extractProvider(model: string): string {
  const index = model.indexOf("/");
  return index === -1 ? "openai" : model.slice(0, index);
}

export const extract_provider = extractProvider;

export function canonicalLLMProvider(provider: string): string {
  return LLM_PROVIDER_ALIASES[provider.toLowerCase()] ?? provider.toLowerCase();
}

export const canonical_llm_provider = canonicalLLMProvider;

export function matchesProviderPattern(model: string, provider: string): boolean {
  const modelLower = model.toLowerCase();
  const canonicalProvider = canonicalLLMProvider(provider);

  if (canonicalProvider === "openai") {
    return ["gpt-", "o1", "o3", "o4", "whisper-"].some((prefix) => modelLower.startsWith(prefix));
  }
  if (canonicalProvider === "anthropic") {
    return ["claude-", "anthropic."].some((prefix) => modelLower.startsWith(prefix));
  }
  if (canonicalProvider === "gemini") {
    return ["gemini-", "gemma-", "learnlm-"].some((prefix) => modelLower.startsWith(prefix));
  }
  if (canonicalProvider === "bedrock") {
    return modelLower.includes(".");
  }
  if (canonicalProvider === "azure") {
    return ["gpt-", "gpt-35-", "o1", "o3", "o4", "azure-"].some((prefix) => modelLower.startsWith(prefix));
  }
  if (canonicalProvider === "deepseek") {
    return modelLower.startsWith("deepseek");
  }
  if (canonicalProvider === "dashscope") {
    return modelLower.startsWith("qwen");
  }
  return ["ollama", "ollama_chat", "hosted_vllm", "cerebras", "openrouter"].includes(canonicalProvider);
}

export const matches_provider_pattern = matchesProviderPattern;

export function validateModelInConstants(model: string, provider: string): boolean {
  const canonicalProvider = canonicalLLMProvider(provider);
  if (canonicalProvider === "openai" && openAIModelSet.has(model)) {
    return true;
  }
  if (canonicalProvider === "anthropic" && anthropicModelSet.has(model)) {
    return true;
  }
  if (canonicalProvider === "gemini" && geminiModelSet.has(model)) {
    return true;
  }
  if (canonicalProvider === "bedrock" && bedrockModelSet.has(model)) {
    return true;
  }
  if (canonicalProvider === "azure") {
    return true;
  }
  return matchesProviderPattern(model, canonicalProvider);
}

export const validate_model_in_constants = validateModelInConstants;

export function inferProviderFromModel(model: string): string {
  if (openAIModelSet.has(model)) {
    return "openai";
  }
  if (anthropicModelSet.has(model)) {
    return "anthropic";
  }
  if (geminiModelSet.has(model)) {
    return "gemini";
  }
  if (bedrockModelSet.has(model)) {
    return "bedrock";
  }
  if (azureModelSet.has(model)) {
    return "azure";
  }
  return "openai";
}

export const infer_provider_from_model = inferProviderFromModel;

export function resolveLLMModelSpec(model: string, explicitProvider?: string): LLMModelSpec {
  if (!model) {
    throw new Error("Model must be a non-empty string.");
  }
  if (explicitProvider) {
    return {
      provider: canonicalLLMProvider(explicitProvider),
      model,
      originalModel: model,
      useNative: true,
    };
  }
  const separatorIndex = model.indexOf("/");
  if (separatorIndex !== -1) {
    const prefix = model.slice(0, separatorIndex);
    const modelPart = model.slice(separatorIndex + 1);
    const canonicalProvider = canonicalLLMProvider(prefix);
    const hasNativeProvider = nativeProviderSet.has(canonicalProvider);
    const useNative = hasNativeProvider && validateModelInConstants(modelPart, canonicalProvider);
    return {
      provider: useNative ? canonicalProvider : prefix,
      model: modelPart,
      originalModel: model,
      useNative,
    };
  }
  return {
    provider: inferProviderFromModel(model),
    model,
    originalModel: model,
    useNative: true,
  };
}

export const resolve_llm_model_spec = resolveLLMModelSpec;

export function contextWindowSizeForModel(model: string): number {
  validateContextWindowSizes(LLM_CONTEXT_WINDOW_SIZES);
  return knownContextWindowSizeForModel(model) ?? Math.trunc(DEFAULT_CONTEXT_WINDOW_SIZE * CONTEXT_WINDOW_USAGE_RATIO);
}

export const context_window_size_for_model = contextWindowSizeForModel;

export function validateContextWindowSizes(sizes: Readonly<Record<string, number>>): void {
  for (const [model, size] of Object.entries(sizes)) {
    if (size < MIN_CONTEXT_WINDOW_SIZE || size > MAX_CONTEXT_WINDOW_SIZE) {
      throw new Error(`Context window for ${model} must be between ${String(MIN_CONTEXT_WINDOW_SIZE)} and ${String(MAX_CONTEXT_WINDOW_SIZE)}.`);
    }
  }
}

export const validate_context_window_sizes = validateContextWindowSizes;

function knownContextWindowSizeForModel(model: string): number | null {
  const match = Object.entries(LLM_CONTEXT_WINDOW_SIZES)
    .sort(([left], [right]) => right.length - left.length)
    .find(([prefix]) => model.startsWith(prefix));
  return match ? Math.trunc(match[1] * CONTEXT_WINDOW_USAGE_RATIO) : null;
}

function normalizeUsageMetrics(metrics: UsageMetricsLike): UsageMetrics {
  return new UsageMetrics({
    totalTokens: metrics.totalTokens ?? metrics.total_tokens ?? 0,
    promptTokens: metrics.promptTokens ?? metrics.prompt_tokens ?? 0,
    cachedPromptTokens: metrics.cachedPromptTokens ?? metrics.cached_prompt_tokens ?? 0,
    completionTokens: metrics.completionTokens ?? metrics.completion_tokens ?? 0,
    reasoningTokens: metrics.reasoningTokens ?? metrics.reasoning_tokens ?? 0,
    cacheCreationTokens: metrics.cacheCreationTokens ?? metrics.cache_creation_tokens ?? 0,
    successfulRequests: metrics.successfulRequests ?? metrics.successful_requests ?? 0,
  });
}

function defineUsageMetricAliases(metrics: UsageMetrics): void {
  Object.defineProperties(metrics, {
    total_tokens: { value: metrics.totalTokens, writable: true, enumerable: false, configurable: true },
    prompt_tokens: { value: metrics.promptTokens, writable: true, enumerable: false, configurable: true },
    cached_prompt_tokens: { value: metrics.cachedPromptTokens, writable: true, enumerable: false, configurable: true },
    completion_tokens: { value: metrics.completionTokens, writable: true, enumerable: false, configurable: true },
    reasoning_tokens: { value: metrics.reasoningTokens, writable: true, enumerable: false, configurable: true },
    cache_creation_tokens: { value: metrics.cacheCreationTokens, writable: true, enumerable: false, configurable: true },
    successful_requests: { value: metrics.successfulRequests, writable: true, enumerable: false, configurable: true },
  });
}

function parseStructuredOutputJson(response: string, responseFormatName: string): unknown {
  const trimmed = response.trim();
  try {
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      return JSON.parse(trimmed);
    }
    const match = /\{.*\}/s.exec(response);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error("No JSON found in response");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse response into ${responseFormatName}: ${detail}`, { cause: error });
  }
}

function validatorName(validator: StructuredOutputValidator): string {
  return validator.name ?? "response_format";
}

function removeUndefinedValues(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== null && value !== undefined));
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

async function* streamingChunksFromParams(params: Record<string, unknown>): AsyncIterable<unknown> {
  const source = params.chunks ?? params.stream ?? params.response;
  if (isAsyncIterable(source)) {
    for await (const chunk of source) {
      yield chunk;
    }
    return;
  }
  if (isIterable(source) && typeof source !== "string") {
    for (const chunk of source) {
      yield chunk;
    }
    return;
  }
  if (source !== undefined && source !== null && source !== true && source !== false) {
    yield source;
  }
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return value !== null
    && value !== undefined
    && typeof (value as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === "function";
}

function streamingChunkContent(chunk: unknown): string | null {
  const direct = stringPropertyFromRecord(chunk, "content") ?? stringPropertyFromRecord(chunk, "text");
  if (direct !== null) {
    return direct;
  }
  const record = readLLMRecord(chunk);
  const deltaContent = stringPropertyFromRecord(record.delta, "content");
  if (deltaContent !== null) {
    return deltaContent;
  }
  const choices = Array.isArray(record.choices) ? record.choices : [];
  for (const choice of choices) {
    const choiceRecord = readLLMRecord(choice);
    const content = stringPropertyFromRecord(choiceRecord.delta, "content")
      ?? stringPropertyFromRecord(choiceRecord.message, "content");
    if (content !== null) {
      return content;
    }
  }
  return null;
}

function extractResponseText(response: unknown): string {
  if (typeof response === "string") {
    return response;
  }
  const direct = stringPropertyFromRecord(response, "content") ?? stringPropertyFromRecord(response, "text");
  if (direct !== null) {
    return direct;
  }
  const record = readLLMRecord(response);
  const choices = Array.isArray(record.choices) ? record.choices : [];
  for (const choice of choices) {
    const content = stringPropertyFromRecord(readLLMRecord(choice).message, "content")
      ?? stringPropertyFromRecord(readLLMRecord(choice).delta, "content")
      ?? stringPropertyFromRecord(choice, "text");
    if (content !== null) {
      return content;
    }
  }
  return "";
}

function extractToolCallsFromResponse(response: unknown): unknown[] {
  const record = readLLMRecord(response);
  const direct = record.tool_calls ?? readLLMRecord(record.message).tool_calls;
  if (Array.isArray(direct)) {
    return direct;
  }
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const calls: unknown[] = [];
  for (const choice of choices) {
    const messageCalls = readLLMRecord(readLLMRecord(choice).message).tool_calls;
    const deltaCalls = readLLMRecord(readLLMRecord(choice).delta).tool_calls;
    for (const candidate of [messageCalls, deltaCalls]) {
      if (Array.isArray(candidate)) {
        calls.push(...candidate as unknown[]);
      }
    }
  }
  return calls;
}

function parseLLMToolCall(toolCall: unknown): { name: string; args: Record<string, unknown> } | null {
  const record = readLLMRecord(toolCall);
  const functionRecord = readLLMRecord(record.function);
  const name = stringPropertyFromRecord(functionRecord, "name") ?? stringPropertyFromRecord(record, "name");
  if (name === null || name.length === 0) {
    return null;
  }
  return {
    name,
    args: parseToolArguments(functionRecord.arguments ?? record.arguments ?? record.args),
  };
}

function parseToolArguments(value: unknown): Record<string, unknown> {
  if (isRecord(value)) {
    return value;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    return {};
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function usageRecordFromChunk(chunk: unknown): Record<string, unknown> | null {
  const record = readLLMRecord(chunk);
  const usage = record.usage ?? readLLMRecord(record.model_extra).usage;
  return isRecord(usage) ? usage : null;
}

function messagesFromParams(params: Record<string, unknown>): readonly LLMMessage[] | null {
  const messages = params.messages;
  if (!Array.isArray(messages)) {
    return null;
  }
  const normalized: LLMMessage[] = [];
  for (const message of messages) {
    const record = readLLMRecord(message);
    if (isLLMRole(record.role) && typeof record.content === "string") {
      normalized.push({ role: record.role, content: record.content });
    }
  }
  return normalized;
}

function stringPropertyFromRecord(value: unknown, key: string): string | null {
  const record = readLLMRecord(value);
  const property = record[key];
  return typeof property === "string" ? property : null;
}

function invokeUsageCallback(callback: LLMStreamingCallback, usage: Record<string, unknown>): void {
  if (typeof callback === "function") {
    return;
  }
  if (typeof callback.logSuccessEvent === "function") {
    void Promise.resolve(callback.logSuccessEvent({
      kwargs: {},
      responseObj: { usage },
      startTime: 0,
      endTime: 0,
    }));
  }
  if (typeof callback.log_success_event === "function") {
    void Promise.resolve(callback.log_success_event({}, { usage }, 0, 0));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIterable(value: unknown): value is Iterable<unknown> {
  return typeof (value as { [Symbol.iterator]?: unknown })[Symbol.iterator] === "function";
}

function isJsonResponseFormat(value: unknown): value is JsonResponseFormat {
  return isRecord(value) && value.type === "json_object";
}

function isStructuredOutputValidator(value: unknown): value is StructuredOutputValidator {
  return isRecord(value) && (
    typeof value.name === "string"
    || typeof value.modelValidate === "function"
    || typeof value.model_validate === "function"
    || typeof value.parse === "function"
    || typeof value.validate === "function"
  );
}

function serializeResponseFormat(responseFormat: JsonResponseFormat | StructuredOutputValidator): unknown {
  if ("type" in responseFormat) {
    return { type: "json_object" };
  }
  return responseFormat.name ?? "response_format";
}

function normalizeStopSequences(value: string | readonly string[] | null | undefined): string[] {
  if (value === null || value === undefined) {
    return [];
  }
  return typeof value === "string" ? [value] : [...value];
}

function numberFromUsage(data: Record<string, unknown>, ...keys: readonly string[]): number {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "number") {
      return value;
    }
  }
  return 0;
}

function nestedNumberFromUsage(data: Record<string, unknown>, objectKey: string, valueKey: string): number {
  const nested = data[objectKey];
  if (!nested || typeof nested !== "object" || Array.isArray(nested)) {
    return 0;
  }
  const value = (nested as Record<string, unknown>)[valueKey];
  return typeof value === "number" ? value : 0;
}

function serializeLLMMessages(messages: readonly LLMMessage[]): readonly Record<string, unknown>[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
    ...(message.files === undefined ? {} : { files: message.files }),
    ...(message.cache_breakpoint === undefined ? {} : { cache_breakpoint: message.cache_breakpoint }),
  }));
}

function formatInlineFileContentBlock(name: string, file: InputFile): Record<string, unknown> {
  const rendered = renderLLMInputFile(name, file);
  return {
    type: "file",
    source: "inline",
    name,
    filename: rendered.filename,
    content_type: rendered.contentType,
    content: rendered.content,
  };
}

function formatUploadedFileContentBlock(name: string, upload: LocalFileUpload): Record<string, unknown> {
  return {
    type: "file",
    source: "upload",
    name,
    filename: upload.filename,
    file_id: upload.id,
    content_type: upload.contentType,
  };
}

function renderLLMInputFile(name: string, file: InputFile): { filename: string; contentType: string | null; content: string } {
  if (typeof file === "string") {
    return {
      filename: basename(file) || name,
      contentType: guessLLMFileContentType(file),
      content: readFileSync(file, "utf8"),
    };
  }
  if (typeof file.content === "string") {
    return {
      filename: file.filename ?? (file.path ? basename(file.path) : name),
      contentType: file.contentType ?? guessLLMFileContentType(file.filename ?? file.path ?? name),
      content: file.content,
    };
  }
  if (file.path) {
    return {
      filename: file.filename ?? (basename(file.path) || name),
      contentType: file.contentType ?? guessLLMFileContentType(file.path),
      content: readFileSync(file.path, "utf8"),
    };
  }
  throw new Error(`Input file '${name}' requires either a path or text content.`);
}

function guessLLMFileContentType(path: string): string | null {
  const lower = path.toLowerCase();
  if (lower.endsWith(".json")) {
    return "application/json";
  }
  if (lower.endsWith(".csv")) {
    return "text/csv";
  }
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
    return "text/markdown";
  }
  if (lower.endsWith(".txt") || lower.endsWith(".log")) {
    return "text/plain";
  }
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".webp")) {
    return "image/webp";
  }
  return null;
}

function serializeLLMEventMessages(messages: string | readonly LLMMessage[]): string | readonly Record<string, unknown>[] {
  return typeof messages === "string" ? messages : serializeLLMMessages(messages);
}

function isLLMRole(value: unknown): value is LLMMessage["role"] {
  return value === "system" || value === "user" || value === "assistant" || value === "tool";
}

function isLLMClient(value: unknown): value is LLMClient {
  if (!value || typeof value !== "object" || !("call" in value)) {
    return false;
  }
  return typeof value.call === "function";
}

function parseCallbackNames(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value.split(",").map((callback) => callback.trim()).filter((callback) => callback.length > 0);
}

function stringProperty(value: Record<string, unknown>, key: string): string | undefined {
  const property = value[key];
  return typeof property === "string" ? property : undefined;
}

function numberProperty(value: Record<string, unknown>, key: string): number | null {
  const property = value[key];
  return typeof property === "number" ? property : null;
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function argsSchemaParameters(value: unknown): Record<string, unknown> | null {
  const schemaProvider = value as { model_json_schema?: () => unknown; modelJsonSchema?: () => unknown } | null;
  const schema = schemaProvider?.model_json_schema?.() ?? schemaProvider?.modelJsonSchema?.();
  return recordOrNull(schema);
}

function applyLLMEnvVars(
  options: ConstructorParameters<typeof ConfiguredLLM>[0],
  provider: string,
  env: CreateLLMEnvironment,
): void {
  for (const spec of LLM_ENV_VARS[provider] ?? []) {
    const keyName = spec.key_name;
    if (typeof keyName === "string" && !UNACCEPTED_LLM_ENV_ATTRIBUTES.includes(keyName as typeof UNACCEPTED_LLM_ENV_ATTRIBUTES[number])) {
      const value = env[keyName];
      if (value) {
        const paramKey = normalizeLLMEnvKeyName(keyName.toLowerCase());
        assignLLMConfigParam(options, paramKey, value);
      }
      continue;
    }
    if (spec.default === true) {
      for (const [key, value] of Object.entries(spec)) {
        if (key !== "prompt" && key !== "key_name" && key !== "default" && typeof value === "string") {
          assignLLMConfigParam(options, key.toLowerCase(), value);
        }
      }
    }
  }
}

function assignLLMConfigParam(
  options: ConstructorParameters<typeof ConfiguredLLM>[0],
  key: string,
  value: string,
): void {
  if (key === "model") {
    options.model = value;
  } else if (key === "api_key") {
    options.api_key = value;
  } else if (key === "api_base") {
    options.api_base = value;
    options.base_url ??= value;
  } else if (key === "api_version") {
    options.additional_params = { ...(options.additional_params ?? {}), api_version: value };
  } else if (key === "watsonx_url") {
    options.base_url = value;
  } else {
    options.additional_params = { ...(options.additional_params ?? {}), [key]: value };
  }
}

async function invokeAvailableFunction(fn: LLMAvailableFunction, args: Record<string, unknown>): Promise<unknown> {
  return typeof fn === "function" ? await fn(args) : await fn.run(args);
}

function stringifyToolExecutionResult(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === undefined) {
    return "undefined";
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "symbol") {
    return value.description ?? "Symbol()";
  }
  if (typeof value === "function") {
    return `[function ${value.name || "anonymous"}]`;
  }
  return JSON.stringify(value);
}

function serializeLLMTools(tools: readonly unknown[] | undefined): readonly Record<string, unknown>[] | null {
  if (!tools || tools.length === 0) {
    return null;
  }
  return tools.map((tool) => {
    if (isToolLike(tool)) {
      return {
        name: tool.name,
        description: tool.description ?? null,
        resultAsAnswer: tool.resultAsAnswer ?? false,
      };
    }
    return recordOrNull(tool) ?? { value: String(tool) };
  });
}

function isToolLike(value: unknown): value is Tool {
  const record = recordOrNull(value);
  return record !== null && typeof record.name === "string" && "run" in record;
}

function isToolCallingResponse(response: LLMResponse): response is ToolCalling {
  return typeof response === "object" && "toolName" in response;
}
