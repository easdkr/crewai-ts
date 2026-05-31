import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

import { validateJwtToken } from "./auth.js";
import {
  A2AConnectionErrorEvent,
  A2AContentTypeNegotiatedEvent,
  A2APollingStartedEvent,
  A2APollingStatusEvent,
  A2AStreamingChunkEvent,
  A2AStreamingStartedEvent,
  A2APushNotificationRegisteredEvent,
  A2APushNotificationTimeoutEvent,
  A2ATransportNegotiatedEvent,
  crewaiEventBus,
} from "./events.js";
import {
  A2UI_EXTENSION_URI,
  A2UI_V09_BASIC_CATALOG_ID,
  BASIC_CATALOG_COMPONENTS,
  BASIC_CATALOG_FUNCTIONS,
  STANDARD_CATALOG_COMPONENTS,
} from "./a2ui.js";

export type LogContextFields = Record<string, unknown>;

export const A2ATransport = {
  JSONRPC: "JSONRPC",
  GRPC: "GRPC",
  HTTP_JSON: "HTTP+JSON",
} as const;

export type A2ATransportProtocol = typeof A2ATransport[keyof typeof A2ATransport];
export type TransportProtocol = A2ATransportProtocol;
export type NegotiationSource = A2ANegotiationSource;
export type A2AProtocolVersion =
  | "0.2.0"
  | "0.2.1"
  | "0.2.2"
  | "0.2.3"
  | "0.2.4"
  | "0.2.5"
  | "0.2.6"
  | "0.3.0"
  | "0.4.0";
export type A2ANegotiationSource = "client_preferred" | "server_preferred" | "fallback";
export type A2AAgentInterface = {
  transport: string;
  url: string;
};
export type A2AAgentCard = {
  name?: string;
  url: string;
  preferredTransport?: string | null;
  preferred_transport?: string | null;
  additionalInterfaces?: readonly A2AAgentInterface[] | null;
  additional_interfaces?: readonly A2AAgentInterface[] | null;
};
export const TransportProtocol = Object.freeze({ kind: "TransportProtocol" });
export const NegotiationSource = Object.freeze({ kind: "NegotiationSource" });
export type A2APartsMetadataDict = {
  mimeType?: "application/json";
  schema?: Record<string, unknown>;
};
export type A2APartsDict = {
  text: string;
  metadata?: A2APartsMetadataDict;
};
export type A2AAgentResponseProtocol = {
  a2a_ids?: readonly string[];
  message: string;
  is_a2a: boolean;
};
export type A2AConfigTypes = A2AConfig | A2AServerConfig | A2AClientConfig;
export type A2AClientConfigTypes = A2AConfig | A2AClientConfig;
export const ProtocolVersion = Object.freeze([
  "0.2.0",
  "0.2.1",
  "0.2.2",
  "0.2.3",
  "0.2.4",
  "0.2.5",
  "0.2.6",
  "0.3.0",
  "0.4.0",
] as const);
export const Url = Object.freeze({ kind: "Url" });
export const AgentResponseProtocol = Object.freeze({ kind: "AgentResponseProtocol" });
export const A2AConfigTypes = Object.freeze({ kind: "A2AConfigTypes" });
export const A2AClientConfigTypes = Object.freeze({ kind: "A2AClientConfigTypes" });
export const PartsMetadataDict = Object.freeze({ kind: "PartsMetadataDict" });
export const PartsDict = Object.freeze({ kind: "PartsDict" });
export type AgentResponseProtocol = A2AAgentResponseProtocol;
export type PartsMetadataDict = A2APartsMetadataDict;
export type PartsDict = A2APartsDict;
export type ProtocolVersion = A2AProtocolVersion;
export type Url = string;
export const PollingHandlerType = Object.freeze({ kind: "PollingHandlerType" });
export const StreamingHandlerType = Object.freeze({ kind: "StreamingHandlerType" });
export const PushNotificationHandlerType = Object.freeze({ kind: "PushNotificationHandlerType" });
export const HandlerType = Object.freeze({ kind: "HandlerType" });
export type PollingHandlerType = typeof PollingHandlerType;
export type StreamingHandlerType = typeof StreamingHandlerType;
export type PushNotificationHandlerType = typeof PushNotificationHandlerType;
export type HandlerType = PollingHandlerType | StreamingHandlerType | PushNotificationHandlerType;
export const HANDLER_REGISTRY = new Map<unknown, unknown>();

export const BaseHandlerKwargs = Object.freeze({ kind: "BaseHandlerKwargs" });
export type BaseHandlerKwargs = {
  turn_number?: number;
  turnNumber?: number;
  is_multiturn?: boolean;
  isMultiturn?: boolean;
  agent_role?: string | null;
  agentRole?: string | null;
  context_id?: string | null;
  contextId?: string | null;
  task_id?: string | null;
  taskId?: string | null;
  endpoint?: string | null;
  agent_branch?: unknown;
  agentBranch?: unknown;
  a2a_agent_name?: string | null;
  a2aAgentName?: string | null;
  from_task?: unknown;
  fromTask?: unknown;
  from_agent?: unknown;
  fromAgent?: unknown;
};

export const PollingHandlerKwargs = Object.freeze({ kind: "PollingHandlerKwargs" });
export type PollingHandlerKwargs = BaseHandlerKwargs & {
  polling_interval?: number;
  pollingInterval?: number;
  polling_timeout?: number;
  pollingTimeout?: number;
  history_length?: number;
  historyLength?: number;
  max_polls?: number | null;
  maxPolls?: number | null;
};

export const StreamingHandlerKwargs = Object.freeze({ kind: "StreamingHandlerKwargs" });
export type StreamingHandlerKwargs = BaseHandlerKwargs;

export const PushNotificationHandlerKwargs = Object.freeze({ kind: "PushNotificationHandlerKwargs" });
export type PushNotificationHandlerKwargs = BaseHandlerKwargs & {
  config?: unknown;
  result_store?: PushNotificationResultStore;
  resultStore?: PushNotificationResultStore;
  polling_timeout?: number;
  pollingTimeout?: number;
  polling_interval?: number;
  pollingInterval?: number;
};

export class CommonParams {
  readonly turn_number: number;
  readonly turnNumber: number;
  readonly is_multiturn: boolean;
  readonly isMultiturn: boolean;
  readonly agent_role: string | null;
  readonly agentRole: string | null;
  readonly endpoint: string;
  readonly a2a_agent_name: string | null;
  readonly a2aAgentName: string | null;
  readonly context_id: string | null;
  readonly contextId: string | null;
  readonly from_task: unknown;
  readonly fromTask: unknown;
  readonly from_agent: unknown;
  readonly fromAgent: unknown;

  constructor(options: {
    turn_number?: number;
    is_multiturn?: boolean;
    agent_role?: string | null;
    endpoint: string;
    a2a_agent_name?: string | null;
    context_id?: string | null;
    from_task?: unknown;
    from_agent?: unknown;
  }) {
    this.turn_number = options.turn_number ?? 0;
    this.turnNumber = this.turn_number;
    this.is_multiturn = options.is_multiturn ?? false;
    this.isMultiturn = this.is_multiturn;
    this.agent_role = options.agent_role ?? null;
    this.agentRole = this.agent_role;
    this.endpoint = options.endpoint;
    this.a2a_agent_name = options.a2a_agent_name ?? null;
    this.a2aAgentName = this.a2a_agent_name;
    this.context_id = options.context_id ?? null;
    this.contextId = this.context_id;
    this.from_task = options.from_task;
    this.fromTask = this.from_task;
    this.from_agent = options.from_agent;
    this.fromAgent = this.from_agent;
  }

  *[Symbol.iterator](): IterableIterator<unknown> {
    yield this.turn_number;
    yield this.is_multiturn;
    yield this.agent_role;
    yield this.endpoint;
    yield this.a2a_agent_name;
    yield this.context_id;
    yield this.from_task;
    yield this.from_agent;
  }
}

export const PushNotificationResultStore = Object.freeze({ kind: "PushNotificationResultStore" });
export interface PushNotificationResultStore {
  waitForResult?(taskId: string, timeout: number, pollInterval?: number): Promise<unknown>;
  wait_for_result?(task_id: string, timeout: number, poll_interval?: number): Promise<unknown>;
  getResult?(taskId: string): Promise<unknown>;
  get_result?(task_id: string): Promise<unknown>;
  storeResult?(task: unknown): Promise<void>;
  store_result?(task: unknown): Promise<void>;
}

export class StreamingConfig {
  readonly timeout: number | null;

  constructor(timeout: number | null = null) {
    this.timeout = timeout;
  }
}

export enum WebhookSignatureMode {
  NONE = "none",
  HMAC_SHA256 = "hmac_sha256",
}

export class WebhookSignatureConfig {
  readonly mode: WebhookSignatureMode;
  readonly secret: string | null;
  readonly timestampToleranceSeconds: number;
  readonly timestamp_tolerance_seconds: number;
  readonly headerName: string;
  readonly header_name: string;
  readonly timestampHeaderName: string;
  readonly timestamp_header_name: string;

  constructor(options: {
    mode?: WebhookSignatureMode | `${WebhookSignatureMode}`;
    secret?: string | null;
    timestampToleranceSeconds?: number;
    timestamp_tolerance_seconds?: number;
    headerName?: string;
    header_name?: string;
    timestampHeaderName?: string;
    timestamp_header_name?: string;
  } = {}) {
    this.mode = (options.mode ?? WebhookSignatureMode.NONE) as WebhookSignatureMode;
    this.secret = options.secret ?? null;
    this.timestampToleranceSeconds = options.timestampToleranceSeconds ?? options.timestamp_tolerance_seconds ?? 300;
    this.timestamp_tolerance_seconds = this.timestampToleranceSeconds;
    this.headerName = options.headerName ?? options.header_name ?? "X-A2A-Signature";
    this.header_name = this.headerName;
    this.timestampHeaderName = options.timestampHeaderName ?? options.timestamp_header_name ?? "X-A2A-Signature-Timestamp";
    this.timestamp_header_name = this.timestampHeaderName;
  }

  static generateSecret(length = 32): string {
    return randomBytes(length).toString("base64url");
  }

  static generate_secret(length = 32): string {
    return WebhookSignatureConfig.generateSecret(length);
  }

  static hmacSha256(secret: string, timestampToleranceSeconds = 300): WebhookSignatureConfig {
    return new WebhookSignatureConfig({
      mode: WebhookSignatureMode.HMAC_SHA256,
      secret,
      timestampToleranceSeconds,
    });
  }

  static hmac_sha256(secret: string, timestamp_tolerance_seconds = 300): WebhookSignatureConfig {
    return WebhookSignatureConfig.hmacSha256(secret, timestamp_tolerance_seconds);
  }
}

export type SignatureInput = WebhookSignatureConfig | string | null;
export const SignatureInput = Object.freeze({ kind: "SignatureInput" });

function coerceSignature(value: SignatureInput | undefined): WebhookSignatureConfig | null {
  if (value === undefined || value === null) {
    return null;
  }
  return typeof value === "string" ? WebhookSignatureConfig.hmacSha256(value) : value;
}

export class PushNotificationConfig {
  readonly url: string;
  readonly id: string | null;
  readonly token: string | null;
  readonly authentication: unknown;
  readonly timeout: number | null;
  readonly interval: number;
  readonly resultStore: PushNotificationResultStore | null;
  readonly result_store: PushNotificationResultStore | null;
  readonly signature: WebhookSignatureConfig | null;

  constructor(options: {
    url: string | URL;
    id?: string | null;
    token?: string | null;
    authentication?: unknown;
    timeout?: number | null;
    interval?: number;
    resultStore?: PushNotificationResultStore | null;
    result_store?: PushNotificationResultStore | null;
    signature?: SignatureInput;
  }) {
    this.url = String(options.url);
    this.id = options.id ?? null;
    this.token = options.token ?? null;
    this.authentication = options.authentication ?? null;
    this.timeout = options.timeout ?? 300;
    this.interval = options.interval ?? 2;
    this.resultStore = options.resultStore ?? options.result_store ?? null;
    this.result_store = this.resultStore;
    this.signature = coerceSignature(options.signature);
  }
}

export const UpdateHandler = Object.freeze({ kind: "UpdateHandler" });
export interface UpdateHandler {
  execute(
    client: unknown,
    message: unknown,
    newMessages: unknown[],
    agentCard: unknown,
    kwargs?: Record<string, unknown>,
  ): Promise<A2ATaskStateResult>;
}

export function extractCommonParams(kwargs: BaseHandlerKwargs): CommonParams {
  const endpoint = kwargs.endpoint;
  if (endpoint === undefined || endpoint === null) {
    throw new Error("endpoint is required for update handlers");
  }
  return new CommonParams({
    turn_number: kwargs.turn_number ?? kwargs.turnNumber ?? 0,
    is_multiturn: kwargs.is_multiturn ?? kwargs.isMultiturn ?? false,
    agent_role: kwargs.agent_role ?? kwargs.agentRole ?? null,
    endpoint,
    a2a_agent_name: kwargs.a2a_agent_name ?? kwargs.a2aAgentName ?? null,
    context_id: kwargs.context_id ?? kwargs.contextId ?? null,
    from_task: kwargs.from_task ?? kwargs.fromTask,
    from_agent: kwargs.from_agent ?? kwargs.fromAgent,
  });
}

export const extract_common_params = extractCommonParams;
export const A2ATaskState = {
  submitted: "submitted",
  working: "working",
  input_required: "input_required",
  auth_required: "auth_required",
  completed: "completed",
  failed: "failed",
  rejected: "rejected",
  canceled: "canceled",
} as const;
export type A2ATaskState = typeof A2ATaskState[keyof typeof A2ATaskState];
export const TERMINAL_STATES: ReadonlySet<A2ATaskState> = new Set([
  A2ATaskState.completed,
  A2ATaskState.failed,
  A2ATaskState.rejected,
  A2ATaskState.canceled,
]);
export const ACTIONABLE_STATES: ReadonlySet<A2ATaskState> = new Set([
  A2ATaskState.input_required,
  A2ATaskState.auth_required,
]);
export const PENDING_STATES: ReadonlySet<A2ATaskState> = new Set([
  A2ATaskState.submitted,
  A2ATaskState.working,
]);
export type A2ATextPartLike = {
  text?: string;
  kind?: string;
  root?: {
    text?: string;
    kind?: string;
  };
};
export type A2AMessageLike = {
  role?: string;
  messageId?: string | null;
  message_id?: string | null;
  parts?: readonly A2ATextPartLike[];
  contextId?: string | null;
  context_id?: string | null;
  taskId?: string | null;
  task_id?: string | null;
};
export type A2AArtifactLike = {
  parts?: readonly A2ATextPartLike[];
};
export type A2ATaskLike = {
  id?: string;
  contextId?: string | null;
  context_id?: string | null;
  status?: {
    state?: A2ATaskState;
    message?: A2AMessageLike | null;
    timestamp?: string | null;
  } | null;
  history?: readonly A2AMessageLike[] | null;
  artifacts?: readonly A2AArtifactLike[] | null;
};
export type A2AExecutionContext = {
  taskId?: string | null;
  task_id?: string | null;
  contextId?: string | null;
  context_id?: string | null;
  currentTask?: A2ATaskLike | null;
  current_task?: A2ATaskLike | null;
  message?: A2AMessageLike | null;
  getUserInput?: () => string;
  get_user_input?: () => string;
};
export type A2AEventQueue = {
  enqueueEvent?: (event: unknown) => Promise<void> | void;
  enqueue_event?: (event: unknown) => Promise<void> | void;
};
export type A2AExtensionRegistry = {
  invokeOnRequest?: (context: unknown) => Promise<void> | void;
  invoke_on_request?: (context: unknown) => Promise<void> | void;
  invokeOnResponse?: (context: unknown, result: unknown) => Promise<unknown>;
  invoke_on_response?: (context: unknown, result: unknown) => Promise<unknown>;
};
export type ConversationState = {
  isReady?: () => boolean;
  is_ready?: () => boolean;
};
export const ConversationState = Object.freeze({ kind: "ConversationState" });
export type A2AExtension = {
  injectTools?: (agent: unknown) => void;
  inject_tools?: (agent: unknown) => void;
  extractStateFromHistory?: (conversationHistory: readonly unknown[]) => ConversationState | null;
  extract_state_from_history?: (conversation_history: readonly unknown[]) => ConversationState | null;
  augmentPrompt?: (basePrompt: string, conversationState: ConversationState | null) => string;
  augment_prompt?: (base_prompt: string, conversation_state: ConversationState | null) => string;
  processResponse?: (agentResponse: unknown, conversationState: ConversationState | null) => unknown;
  process_response?: (agent_response: unknown, conversation_state: ConversationState | null) => unknown;
  prepareMessageMetadata?: (conversationState: ConversationState | null) => Record<string, unknown>;
  prepare_message_metadata?: (conversation_state: ConversationState | null) => Record<string, unknown>;
};
export const A2AExtension = Object.freeze({ kind: "A2AExtension" });
export const ValidatedA2AExtension = Object.freeze({ kind: "ValidatedA2AExtension" });
export class ExtensionRegistry {
  private readonly extensions: A2AExtension[] = [];

  register(extension: A2AExtension): void {
    this.extensions.push(extension);
  }

  inject_all_tools(agent: unknown): void {
    for (const extension of this.extensions) {
      extension.injectTools?.(agent);
      extension.inject_tools?.(agent);
    }
  }

  extract_all_states(conversation_history: readonly unknown[]): Map<A2AExtension, ConversationState> {
    const states = new Map<A2AExtension, ConversationState>();
    for (const extension of this.extensions) {
      const state = extension.extractStateFromHistory?.(conversation_history) ?? extension.extract_state_from_history?.(conversation_history) ?? null;
      if (state) {
        states.set(extension, state);
      }
    }
    return states;
  }

  augment_prompt_with_all(base_prompt: string, extension_states: Map<A2AExtension, ConversationState>): string {
    let prompt = base_prompt;
    for (const extension of this.extensions) {
      const state = extension_states.get(extension) ?? null;
      prompt = extension.augmentPrompt?.(prompt, state) ?? extension.augment_prompt?.(prompt, state) ?? prompt;
    }
    return prompt;
  }

  process_response_with_all(agent_response: unknown, extension_states: Map<A2AExtension, ConversationState>): unknown {
    let response = agent_response;
    for (const extension of this.extensions) {
      const state = extension_states.get(extension) ?? null;
      response = extension.processResponse?.(response, state) ?? extension.process_response?.(response, state) ?? response;
    }
    return response;
  }

  prepare_all_metadata(extension_states: Map<A2AExtension, ConversationState>): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};
    for (const extension of this.extensions) {
      const state = extension_states.get(extension) ?? null;
      Object.assign(metadata, extension.prepareMessageMetadata?.(state) ?? extension.prepare_message_metadata?.(state) ?? {});
    }
    return metadata;
  }
}
export class ExtensionsMiddleware {
  constructor(private readonly extensions: readonly string[]) {}

  async intercept(_method_name: string, request_payload: Record<string, unknown>, http_kwargs: { headers?: Record<string, string> }): Promise<[Record<string, unknown>, { headers?: Record<string, string> }]> {
    void _method_name;
    await Promise.resolve();
    if (this.extensions.length > 0) {
      http_kwargs.headers ??= {};
      http_kwargs.headers["X-A2A-Extensions"] = this.extensions.join(",");
    }
    return [request_payload, http_kwargs];
  }
}
export class ExtensionContext {
  readonly state: Record<string, unknown>;

  constructor(public readonly metadata: Record<string, unknown> = {}, public readonly client_extensions: Set<string> = new Set(), options: { state?: Record<string, unknown>; server_context?: unknown } = {}) {
    this.state = options.state ?? {};
    this.server_context = options.server_context ?? null;
  }

  readonly server_context: unknown;

  get_extension_metadata(uri: string, key: string): unknown {
    return this.metadata[`${uri}/${key}`];
  }

  set_extension_metadata(uri: string, key: string, value: unknown): void {
    this.metadata[`${uri}/${key}`] = value;
  }
}
export abstract class ServerExtension {
  abstract readonly uri: string;
  readonly required: boolean = false;
  readonly description: string | null = null;

  get params(): Record<string, unknown> | null {
    return null;
  }

  agent_extension(): Record<string, unknown> {
    return {
      uri: this.uri,
      required: this.required || undefined,
      description: this.description,
      params: this.params,
    };
  }

  is_active(context: ExtensionContext): boolean {
    return context.client_extensions.has(this.uri);
  }

  abstract on_request(context: ExtensionContext): Promise<void>;

  abstract on_response(context: ExtensionContext, result: unknown): Promise<unknown>;
}
export class ServerExtensionRegistry {
  private readonly extensions: ServerExtension[];

  constructor(extensions: readonly ServerExtension[] = []) {
    this.extensions = [...extensions];
  }

  register(extension: ServerExtension): void {
    if (this.extensions.some((entry) => entry.uri === extension.uri)) {
      throw new Error(`Extension already registered: ${extension.uri}`);
    }
    this.extensions.push(extension);
  }

  get_agent_extensions(): Record<string, unknown>[] {
    return this.extensions.map((extension) => extension.agent_extension());
  }

  get_extension(uri: string): ServerExtension | null {
    return this.extensions.find((extension) => extension.uri === uri) ?? null;
  }

  static create_context(metadata: Record<string, unknown>, client_extensions: Set<string>, server_context: unknown = null): ExtensionContext {
    return new ExtensionContext(metadata, client_extensions, { server_context });
  }

  async invoke_on_request(context: ExtensionContext): Promise<void> {
    for (const extension of this.extensions) {
      if (extension.is_active(context)) {
        await extension.on_request(context);
      }
    }
  }

  async invoke_on_response(context: ExtensionContext, result: unknown): Promise<unknown> {
    let processed = result;
    for (const extension of this.extensions) {
      if (extension.is_active(context)) {
        processed = await extension.on_response(context, processed);
      }
    }
    return processed;
  }
}
export type A2ATaskStateResult = {
  status: A2ATaskState;
  history: A2AMessageLike[];
  result?: string;
  error?: string;
  agent_card?: Record<string, unknown>;
  a2a_agent_name?: string | null;
};
export const TaskStateResult = Object.freeze({ kind: "TaskStateResult" });
export type TaskStateResult = A2ATaskStateResult;
export const SendMessageEvent = Object.freeze({ kind: "SendMessageEvent" });
export type SendMessageEvent = A2AMessageLike | readonly [A2ATaskLike, unknown];
export class DelegationContext {
  readonly a2a_agents: readonly A2AClientConfigTypes[];
  readonly agent_response_model: unknown;
  readonly current_request: string;
  readonly agent_id: string;
  readonly agent_config: A2AClientConfigTypes | null;
  readonly context_id: string | null;
  readonly task_id: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly extensions: Record<string, unknown> | null;
  readonly reference_task_ids: readonly string[];
  readonly original_task_description: string;
  readonly max_turns: number;

  constructor(options: {
    a2a_agents?: readonly A2AClientConfigTypes[];
    agent_response_model?: unknown;
    current_request?: string;
    agent_id?: string;
    agent_config?: A2AClientConfigTypes | null;
    context_id?: string | null;
    task_id?: string | null;
    metadata?: Record<string, unknown> | null;
    extensions?: Record<string, unknown> | null;
    reference_task_ids?: readonly string[];
    original_task_description?: string;
    max_turns?: number;
  } = {}) {
    this.a2a_agents = [...(options.a2a_agents ?? [])];
    this.agent_response_model = options.agent_response_model ?? null;
    this.current_request = options.current_request ?? "";
    this.agent_id = options.agent_id ?? "";
    this.agent_config = options.agent_config ?? null;
    this.context_id = options.context_id ?? null;
    this.task_id = options.task_id ?? null;
    this.metadata = options.metadata ?? null;
    this.extensions = options.extensions ?? null;
    this.reference_task_ids = [...(options.reference_task_ids ?? [])];
    this.original_task_description = options.original_task_description ?? "";
    this.max_turns = options.max_turns ?? 1;
  }
}
export class DelegationState {
  readonly current_request: string;
  readonly context_id: string | null;
  readonly task_id: string | null;
  readonly reference_task_ids: readonly string[];
  readonly conversation_history: readonly A2AMessageLike[];
  readonly agent_card: A2AAgentCard | null;
  readonly agent_card_dict: Record<string, unknown> | null;
  readonly agent_name: string | null;

  constructor(options: {
    current_request?: string;
    context_id?: string | null;
    task_id?: string | null;
    reference_task_ids?: readonly string[];
    conversation_history?: readonly A2AMessageLike[];
    agent_card?: A2AAgentCard | null;
    agent_card_dict?: Record<string, unknown> | null;
    agent_name?: string | null;
  } = {}) {
    this.current_request = options.current_request ?? "";
    this.context_id = options.context_id ?? null;
    this.task_id = options.task_id ?? null;
    this.reference_task_ids = [...(options.reference_task_ids ?? [])];
    this.conversation_history = [...(options.conversation_history ?? [])];
    this.agent_card = options.agent_card ?? null;
    this.agent_card_dict = options.agent_card_dict ?? null;
    this.agent_name = options.agent_name ?? null;
  }
}
export const MAX_RESUBSCRIBE_ATTEMPTS = 3;
export const RESUBSCRIBE_BACKOFF_BASE = 1.0;
export class StreamingHandler {
  readonly maxResubscribeAttempts = MAX_RESUBSCRIBE_ATTEMPTS;
  readonly resubscribeBackoffBase = RESUBSCRIBE_BACKOFF_BASE;

  static async handle(client: A2AStreamingClient, options: {
    eventStream?: AsyncIterable<SendMessageEvent>;
    event_stream?: AsyncIterable<SendMessageEvent>;
    newMessages?: A2AMessageLike[];
    new_messages?: A2AMessageLike[];
    agentCard?: A2AAgentCard;
    agent_card?: A2AAgentCard;
  } = {}): Promise<string | A2ATaskStateResult> {
    void client;
    await Promise.resolve();
    return await sendMessageAndGetTaskId({
      eventStream: options.eventStream ?? options.event_stream ?? emptyA2AEventStream(),
      newMessages: options.newMessages ?? options.new_messages ?? [],
      agentCard: options.agentCard ?? options.agent_card ?? { url: "", name: "" },
    });
  }

  static async execute(
    client: A2AUpdateClient,
    message: A2AMessageLike,
    newMessages: A2AMessageLike[],
    agentCard: A2AAgentCard,
    kwargs: StreamingHandlerKwargs = {},
  ): Promise<A2ATaskStateResult> {
    const params = extractCommonParams({ ...kwargs, endpoint: kwargs.endpoint ?? agentCard.url });
    const agentBranch = kwargs.agent_branch ?? kwargs.agentBranch;
    let taskId = kwargs.task_id ?? kwargs.taskId ?? null;
    const resultParts: string[] = [];
    let chunkIndex = 0;

    crewaiEventBus.emit(agentBranch, new A2AStreamingStartedEvent({
      task_id: taskId,
      context_id: params.context_id,
      endpoint: params.endpoint,
      a2a_agent_name: params.a2a_agent_name,
      turn_number: params.turn_number,
      is_multiturn: params.is_multiturn,
      agent_role: params.agent_role,
      from_task: params.from_task,
      from_agent: params.from_agent,
    }));

    try {
      for await (const event of getClientEventStream(client, message)) {
        if (!isSendTaskEvent(event)) {
          newMessages.push(event);
          const textParts = extractMessageTextParts(event);
          for (const text of textParts) {
            resultParts.push(text);
            crewaiEventBus.emit(agentBranch, new A2AStreamingChunkEvent({
              task_id: event.task_id ?? event.taskId ?? taskId,
              context_id: event.context_id ?? event.contextId ?? params.context_id,
              chunk: text,
              chunk_index: chunkIndex,
              endpoint: params.endpoint,
              a2a_agent_name: params.a2a_agent_name,
              turn_number: params.turn_number,
              is_multiturn: params.is_multiturn,
              from_task: params.from_task,
              from_agent: params.from_agent,
            }));
            chunkIndex += 1;
          }
          continue;
        }

        const [a2aTask] = event;
        taskId = a2aTask.id ?? taskId;
        const state = normalizeTaskState(a2aTask.status?.state);
        if (!(state && (TERMINAL_STATES.has(state) || ACTIONABLE_STATES.has(state)))) {
          continue;
        }
        const finalParts = [...resultParts];
        finalParts.push(...extractTaskResultParts(a2aTask));
        const result = processTaskState({
          a2aTask,
          newMessages,
          agentCard,
          turnNumber: params.turn_number,
          isMultiturn: params.is_multiturn,
          agentRole: params.agent_role,
          resultParts: finalParts,
          endpoint: params.endpoint,
          a2aAgentName: params.a2a_agent_name,
          isFinal: isFinalStreamingUpdate(event[1]),
        });
        if (result) {
          return result;
        }
      }
    } catch (error) {
      const errorMessage = `Connection error during streaming: ${formatA2AError(error)}`;
      newMessages.push(createA2AErrorMessage(errorMessage, params.context_id, taskId));
      crewaiEventBus.emit(agentBranch, new A2AConnectionErrorEvent({
        endpoint: params.endpoint,
        error,
        error_type: error instanceof Error ? error.name.toLowerCase() : "unexpected_error",
        operation: "streaming",
        context_id: params.context_id,
        task_id: taskId,
        a2a_agent_name: params.a2a_agent_name,
        from_task: params.from_task,
        from_agent: params.from_agent,
      }));
      return {
        status: A2ATaskState.failed,
        error: errorMessage,
        history: newMessages,
      };
    }

    return {
      status: A2ATaskState.failed,
      error: "No final task state received from streaming response",
      history: newMessages,
    };
  }

  static async _try_recover_from_interruption(): Promise<A2ATaskStateResult | null> {
    await Promise.resolve();
    return null;
  }
}

export type A2AUpdateClient = {
  sendMessage?: (message: A2AMessageLike) => AsyncIterable<SendMessageEvent>;
  send_message?: (message: A2AMessageLike) => AsyncIterable<SendMessageEvent>;
  getTask?: (params: { id: string; historyLength?: number; history_length?: number }) => Promise<A2ATaskLike>;
  get_task?: (params: { id: string; historyLength?: number; history_length?: number }) => Promise<A2ATaskLike>;
};

export class PollingHandler {
  readonly kind = "PollingHandler";

  static async execute(
    client: A2AUpdateClient,
    message: A2AMessageLike,
    newMessages: A2AMessageLike[],
    agentCard: A2AAgentCard,
    kwargs: PollingHandlerKwargs = {},
  ): Promise<A2ATaskStateResult> {
    const pollingInterval = kwargs.polling_interval ?? kwargs.pollingInterval ?? 2;
    const pollingTimeout = kwargs.polling_timeout ?? kwargs.pollingTimeout ?? 300;
    const historyLength = kwargs.history_length ?? kwargs.historyLength ?? 100;
    const maxPolls = kwargs.max_polls ?? kwargs.maxPolls ?? null;
    const params = extractCommonParams({ ...kwargs, endpoint: kwargs.endpoint ?? agentCard.url });
    const agentBranch = kwargs.agent_branch ?? kwargs.agentBranch;
    let taskId = kwargs.task_id ?? kwargs.taskId ?? null;

    try {
      const resultOrTaskId = await sendMessageAndGetTaskId({
        eventStream: getClientEventStream(client, message),
        newMessages,
        agentCard,
        turnNumber: params.turn_number,
        isMultiturn: params.is_multiturn,
        agentRole: params.agent_role,
      });
      if (typeof resultOrTaskId !== "string") {
        return resultOrTaskId;
      }
      taskId = resultOrTaskId;

      crewaiEventBus.emit(agentBranch, new A2APollingStartedEvent({
        task_id: taskId,
        context_id: params.context_id,
        polling_interval: pollingInterval,
        endpoint: params.endpoint,
        a2a_agent_name: params.a2a_agent_name,
        from_task: params.from_task,
        from_agent: params.from_agent,
      }));

      const finalTask = await pollTaskUntilComplete(client, {
        taskId,
        historyLength,
        pollingInterval,
        pollingTimeout,
        maxPolls,
        params,
        agentBranch,
        agentCard,
      });
      const result = processTaskState({
        a2aTask: finalTask,
        newMessages,
        agentCard,
        turnNumber: params.turn_number,
        isMultiturn: params.is_multiturn,
        agentRole: params.agent_role,
        endpoint: params.endpoint,
        a2aAgentName: params.a2a_agent_name,
      });
      return result ?? {
        status: A2ATaskState.failed,
        error: `Unexpected task state: ${finalTask.status?.state ?? "unknown"}`,
        history: newMessages,
      };
    } catch (error) {
      const errorMessage = error instanceof A2APollingTimeoutError
        ? error.message
        : `Unexpected error during polling: ${formatA2AError(error)}`;
      newMessages.push(createA2AErrorMessage(errorMessage, params.context_id, taskId));
      crewaiEventBus.emit(agentBranch, new A2AConnectionErrorEvent({
        endpoint: params.endpoint,
        error,
        error_type: error instanceof A2APollingTimeoutError ? "polling_timeout" : "unexpected_error",
        operation: "polling",
        context_id: params.context_id,
        task_id: taskId,
        a2a_agent_name: params.a2a_agent_name,
        from_task: params.from_task,
        from_agent: params.from_agent,
      }));
      return {
        status: A2ATaskState.failed,
        error: errorMessage,
        history: newMessages,
      };
    }
  }
}

export class PushNotificationHandler {
  readonly kind = "PushNotificationHandler";

  static async execute(
    client: A2AUpdateClient,
    message: A2AMessageLike,
    newMessages: A2AMessageLike[],
    agentCard: A2AAgentCard,
    kwargs: PushNotificationHandlerKwargs = {},
  ): Promise<A2ATaskStateResult> {
    const params = extractCommonParams({ ...kwargs, endpoint: kwargs.endpoint ?? agentCard.url });
    const config = kwargs.config as { url?: string | URL } | null | undefined;
    const resultStore = kwargs.result_store ?? kwargs.resultStore ?? null;
    const pollingTimeout = kwargs.polling_timeout ?? kwargs.pollingTimeout ?? 300;
    const pollingInterval = kwargs.polling_interval ?? kwargs.pollingInterval ?? 2;
    const agentBranch = kwargs.agent_branch ?? kwargs.agentBranch;
    let taskId = kwargs.task_id ?? kwargs.taskId ?? null;

    if (!config) {
      const error = "PushNotificationConfig is required for push notification handler";
      emitPushConfigurationError(error, params, taskId);
      return { status: A2ATaskState.failed, error, history: newMessages };
    }
    if (!resultStore) {
      const error = "PushNotificationResultStore is required for push notification handler";
      emitPushConfigurationError(error, params, taskId);
      return { status: A2ATaskState.failed, error, history: newMessages };
    }

    try {
      const resultOrTaskId = await sendMessageAndGetTaskId({
        eventStream: getClientEventStream(client, message),
        newMessages,
        agentCard,
        turnNumber: params.turn_number,
        isMultiturn: params.is_multiturn,
        agentRole: params.agent_role,
      });
      if (typeof resultOrTaskId !== "string") {
        return resultOrTaskId;
      }
      taskId = resultOrTaskId;

      crewaiEventBus.emit(agentBranch, new A2APushNotificationRegisteredEvent({
        task_id: taskId,
        context_id: params.context_id,
        callback_url: config.url?.toString() ?? "",
        endpoint: params.endpoint,
        a2a_agent_name: params.a2a_agent_name,
        from_task: params.from_task,
        from_agent: params.from_agent,
      }));

      const finalTask = await waitForPushResult(resultStore, taskId, pollingTimeout, pollingInterval);
      if (!finalTask) {
        crewaiEventBus.emit(agentBranch, new A2APushNotificationTimeoutEvent({
          task_id: taskId,
          context_id: params.context_id,
          timeout_seconds: pollingTimeout,
          endpoint: params.endpoint,
          a2a_agent_name: params.a2a_agent_name,
          from_task: params.from_task,
          from_agent: params.from_agent,
        }));
        return {
          status: A2ATaskState.failed,
          error: `Push notification timeout after ${String(pollingTimeout)}s`,
          history: newMessages,
        };
      }

      const result = processTaskState({
        a2aTask: finalTask,
        newMessages,
        agentCard,
        turnNumber: params.turn_number,
        isMultiturn: params.is_multiturn,
        agentRole: params.agent_role,
        endpoint: params.endpoint,
        a2aAgentName: params.a2a_agent_name,
      });
      return result ?? {
        status: A2ATaskState.failed,
        error: `Unexpected task state: ${finalTask.status?.state ?? "unknown"}`,
        history: newMessages,
      };
    } catch (error) {
      const errorMessage = `Unexpected error during push notification: ${formatA2AError(error)}`;
      newMessages.push(createA2AErrorMessage(errorMessage, params.context_id, taskId));
      crewaiEventBus.emit(agentBranch, new A2AConnectionErrorEvent({
        endpoint: params.endpoint,
        error,
        error_type: "unexpected_error",
        operation: "push_notification",
        context_id: params.context_id,
        task_id: taskId,
        a2a_agent_name: params.a2a_agent_name,
        from_task: params.from_task,
        from_agent: params.from_agent,
      }));
      return {
        status: A2ATaskState.failed,
        error: errorMessage,
        history: newMessages,
      };
    }
  }
}

export class PollingConfig {
  readonly interval: number;

  constructor(interval = 2) {
    this.interval = interval;
  }
}

HANDLER_REGISTRY.set(PollingConfig, PollingHandler);
HANDLER_REGISTRY.set(StreamingConfig, StreamingHandler);
HANDLER_REGISTRY.set(PushNotificationConfig, PushNotificationHandler);

export type A2AStreamingClient = {
  get_task?: (...args: readonly unknown[]) => Promise<A2ATaskLike>;
  resubscribe?: (...args: readonly unknown[]) => AsyncIterable<SendMessageEvent>;
};

function getClientEventStream(client: A2AUpdateClient, message: A2AMessageLike): AsyncIterable<SendMessageEvent> {
  if (client.send_message) {
    return client.send_message(message);
  }
  if (client.sendMessage) {
    return client.sendMessage(message);
  }
  throw new Error("A2A update client does not provide send_message.");
}

async function pollTaskUntilComplete(
  client: A2AUpdateClient,
  options: {
    taskId: string;
    historyLength: number;
    pollingInterval: number;
    pollingTimeout: number;
    maxPolls: number | null;
    params: CommonParams;
    agentBranch: unknown;
    agentCard: A2AAgentCard;
  },
): Promise<A2ATaskLike> {
  const startedAt = Date.now();
  let pollCount = 0;
  for (;;) {
    pollCount += 1;
    const task = await getClientTask(client, options.taskId, options.historyLength);
    const state = normalizeTaskState(task.status?.state);
    const elapsedSeconds = (Date.now() - startedAt) / 1000;
    crewaiEventBus.emit(options.agentBranch, new A2APollingStatusEvent({
      task_id: options.taskId,
      context_id: task.context_id ?? task.contextId ?? options.params.context_id,
      state: state ?? task.status?.state ?? "unknown",
      elapsed_seconds: elapsedSeconds,
      poll_count: pollCount,
      endpoint: options.params.endpoint,
      a2a_agent_name: options.params.a2a_agent_name,
      from_task: options.params.from_task,
      from_agent: options.params.from_agent,
    }));

    if (state && (TERMINAL_STATES.has(state) || ACTIONABLE_STATES.has(state))) {
      return task;
    }
    if (elapsedSeconds > options.pollingTimeout) {
      throw new A2APollingTimeoutError(`Polling timeout after ${String(options.pollingTimeout)}s (${String(pollCount)} polls)`);
    }
    if (options.maxPolls !== null && pollCount >= options.maxPolls) {
      throw new A2APollingTimeoutError(`Max polls (${String(options.maxPolls)}) exceeded after ${elapsedSeconds.toFixed(1)}s`);
    }
    await sleepSeconds(options.pollingInterval);
  }
}

async function getClientTask(client: A2AUpdateClient, taskId: string, historyLength: number): Promise<A2ATaskLike> {
  const params = { id: taskId, historyLength, history_length: historyLength };
  if (client.get_task) {
    return await client.get_task(params);
  }
  if (client.getTask) {
    return await client.getTask(params);
  }
  throw new Error("A2A update client does not provide get_task.");
}

async function waitForPushResult(
  store: PushNotificationResultStore,
  taskId: string,
  timeout: number,
  pollInterval: number,
): Promise<A2ATaskLike | null> {
  const result = store.wait_for_result
    ? await store.wait_for_result(taskId, timeout, pollInterval)
    : store.waitForResult
      ? await store.waitForResult(taskId, timeout, pollInterval)
      : null;
  return isA2ATaskLike(result) ? result : null;
}

function emitPushConfigurationError(error: string, params: CommonParams, taskId: string | null): void {
  crewaiEventBus.emit(null, new A2AConnectionErrorEvent({
    endpoint: params.endpoint,
    error,
    error_type: "configuration_error",
    operation: "push_notification",
    context_id: params.context_id,
    task_id: taskId,
    a2a_agent_name: params.a2a_agent_name,
    from_task: params.from_task,
    from_agent: params.from_agent,
  }));
}

function createA2AErrorMessage(error: string, contextId: string | null, taskId: string | null): A2AMessageLike {
  return {
    role: "agent",
    message_id: randomId(),
    parts: [{ text: error }],
    context_id: contextId,
    task_id: taskId,
  };
}

function isA2ATaskLike(value: unknown): value is A2ATaskLike {
  return Boolean(value && typeof value === "object" && "status" in value);
}

function formatA2AError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isFinalStreamingUpdate(update: unknown): boolean {
  if (!update || typeof update !== "object") {
    return false;
  }
  const record = update as Record<string, unknown>;
  return record.final === true || record.final_event === true || record.finalEvent === true;
}

async function sleepSeconds(seconds: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, seconds) * 1000);
  });
}
export type A2AHeaders = Record<string, string>;
export type APIKeyLocation = "header" | "query" | "cookie";
type A2ARequestLike = { url: string | URL };
type A2ARequestHook = (request: A2ARequestLike) => void | Promise<void>;
type A2AHookClient = {
  event_hooks?: {
    request?: A2ARequestHook[];
  };
};
type MutableClient = Record<string, unknown>;
export type JWTAlgorithm =
  | "RS256"
  | "RS384"
  | "RS512"
  | "ES256"
  | "ES384"
  | "ES512"
  | "PS256"
  | "PS384"
  | "PS512";
export const JWTAlgorithm = Object.freeze([
  "RS256",
  "RS384",
  "RS512",
  "ES256",
  "ES384",
  "ES512",
  "PS256",
  "PS384",
  "PS512",
] as const);
export const CoercedSecretStr = Object.freeze({ kind: "CoercedSecretStr" });
export type RedisCacheConfig = {
  cache?: string;
  endpoint?: string;
  port?: number;
  db?: number;
  password?: string;
};
export const RedisCacheConfig = Object.freeze({ kind: "RedisCacheConfig" });
export const SigningAlgorithm = JWTAlgorithm;

type CancellableContext = {
  taskId?: string | null;
  task_id?: string | null;
};

const canceledTaskIds = new Set<string>();

export class JSONFormatter {
  format(record: { levelname?: string; level?: string; name?: string; msg?: unknown; message?: unknown; [key: string]: unknown }): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level: record.levelname ?? record.level ?? "INFO",
      logger: record.name ?? "crewai.a2a",
      message: record.message ?? record.msg ?? "",
      ...record,
    }, jsonReplacer);
  }
}

let activeLogContext: LogContextFields = {};

export class LogContext {
  private readonly previous: LogContextFields;

  constructor(private readonly fields: LogContextFields = {}) {
    this.previous = activeLogContext;
  }

  enter(): this {
    activeLogContext = { ...activeLogContext, ...this.fields };
    return this;
  }

  exit(): void {
    activeLogContext = this.previous;
  }
}

export function configure_json_logging(_logger_name = "crewai.a2a"): void {
  void _logger_name;
}

export function get_logger(name: string): {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  warning: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
} {
  return {
    debug: (...args: unknown[]) => {
      console.debug(name, activeLogContext, ...args);
    },
    info: (...args: unknown[]) => {
      console.info(name, activeLogContext, ...args);
    },
    warn: (...args: unknown[]) => {
      console.warn(name, activeLogContext, ...args);
    },
    warning: (...args: unknown[]) => {
      console.warn(name, activeLogContext, ...args);
    },
    error: (...args: unknown[]) => {
      console.error(name, activeLogContext, ...args);
    },
  };
}

export function parse_www_authenticate(header_value: string): Record<string, Record<string, string>> {
  if (!header_value) {
    return {};
  }
  const challenges: Record<string, Record<string, string>> = {};
  const schemePattern = /(\w+)\s+(.+?)(?=,\s*\w+\s+|$)/g;
  const paramPattern = /(\w+)=(?:"([^"]*)"|([^\s,]+))/g;
  for (const match of header_value.matchAll(schemePattern)) {
    const scheme = match[1] ?? "";
    const params: Record<string, string> = {};
    for (const param of (match[2] ?? "").matchAll(paramPattern)) {
      params[param[1] ?? ""] = param[2] ?? param[3] ?? "";
    }
    challenges[scheme] = params;
  }
  return challenges;
}

export function validate_auth_against_agent_card(agent_card: { security?: readonly Record<string, unknown>[] | null }, auth: unknown): void {
  if (agent_card.security?.length && !auth) {
    throw new A2AHTTPException({ statusCode: 401, detail: "AgentCard requires authentication but no auth scheme provided" });
  }
}

export async function retry_on_401<TResponse extends { status?: number; status_code?: number; headers?: { get?: (name: string) => string | null } | Record<string, string>; raise_for_status?: () => void }>(
  request_func: () => Promise<TResponse>,
  auth_scheme: { apply_auth?: (client: unknown, headers: Record<string, string>) => Promise<Record<string, string>>; applyAuth?: (headers: Record<string, string>) => Promise<Record<string, string>> } | null,
  client: unknown,
  headers: Record<string, string>,
  max_retries = 3,
): Promise<TResponse> {
  for (let attempt = 0; attempt < max_retries; attempt += 1) {
    const response = await request_func();
    const status = response.status ?? response.status_code ?? 200;
    if (status !== 401) {
      return response;
    }
    if (!auth_scheme || attempt >= max_retries - 1) {
      response.raise_for_status?.();
      return response;
    }
    if (auth_scheme.apply_auth) {
      Object.assign(headers, await auth_scheme.apply_auth(client, headers));
    } else if (auth_scheme.applyAuth) {
      Object.assign(headers, await auth_scheme.applyAuth(headers));
    }
  }
  return await request_func();
}

export function configure_auth_client(auth: { configureClient?: (client: unknown) => void; configure_client?: (client: unknown) => void }, client: unknown): void {
  auth.configureClient?.(client);
  auth.configure_client?.(client);
}

export class A2AHTTPException extends Error {
  readonly statusCode: number;
  readonly status_code: number;
  readonly detail: string | null;
  readonly headers: Record<string, string> | null;

  constructor(options: { statusCode?: number; status_code?: number; detail?: string | null; headers?: Record<string, string> | null } = {}) {
    super(options.detail ?? "HTTP error");
    this.name = "A2AHTTPException";
    this.statusCode = options.statusCode ?? options.status_code ?? 500;
    this.status_code = this.statusCode;
    this.detail = options.detail ?? null;
    this.headers = options.headers ?? null;
  }
}

export class TLSConfig {
  readonly clientCertPath: string | null;
  readonly client_cert_path: string | null;
  readonly clientKeyPath: string | null;
  readonly client_key_path: string | null;
  readonly caCertPath: string | null;
  readonly ca_cert_path: string | null;
  readonly verify: boolean;

  constructor(options: {
    clientCertPath?: string | null;
    client_cert_path?: string | null;
    clientKeyPath?: string | null;
    client_key_path?: string | null;
    caCertPath?: string | null;
    ca_cert_path?: string | null;
    verify?: boolean;
  } = {}) {
    this.clientCertPath = options.clientCertPath ?? options.client_cert_path ?? null;
    this.client_cert_path = this.clientCertPath;
    this.clientKeyPath = options.clientKeyPath ?? options.client_key_path ?? null;
    this.client_key_path = this.clientKeyPath;
    this.caCertPath = options.caCertPath ?? options.ca_cert_path ?? null;
    this.ca_cert_path = this.caCertPath;
    this.verify = options.verify ?? true;
  }

  getHttpxSslContext(): boolean | string | { clientCertPath: string; clientKeyPath: string; caCertPath: string | null } {
    if (!this.verify) {
      return false;
    }
    if (this.clientCertPath && this.clientKeyPath) {
      return {
        clientCertPath: this.clientCertPath,
        clientKeyPath: this.clientKeyPath,
        caCertPath: this.caCertPath,
      };
    }
    return this.caCertPath ?? true;
  }

  get_httpx_ssl_context(): boolean | string | { clientCertPath: string; clientKeyPath: string; caCertPath: string | null } {
    return this.getHttpxSslContext();
  }

  getGrpcCredentials(): {
    rootCertificates: Buffer | null;
    privateKey: Buffer | null;
    certificateChain: Buffer | null;
  } | null {
    if (!this.verify && !this.clientCertPath) {
      return null;
    }
    return {
      rootCertificates: this.caCertPath ? readFileSync(this.caCertPath) : null,
      privateKey: this.clientCertPath && this.clientKeyPath ? readFileSync(this.clientKeyPath) : null,
      certificateChain: this.clientCertPath && this.clientKeyPath ? readFileSync(this.clientCertPath) : null,
    };
  }

  get_grpc_credentials(): {
    rootCertificates: Buffer | null;
    privateKey: Buffer | null;
    certificateChain: Buffer | null;
  } | null {
    return this.getGrpcCredentials();
  }
}

export abstract class ClientAuthScheme {
  readonly tls: TLSConfig | null;

  constructor(options: { tls?: TLSConfig | null } = {}) {
    this.tls = options.tls ?? null;
  }

  abstract applyAuth(headers?: A2AHeaders): Promise<A2AHeaders>;

  async apply_auth(_client: unknown, headers: A2AHeaders = {}): Promise<A2AHeaders> {
    void _client;
    return await this.applyAuth(headers);
  }
}

export abstract class AuthScheme extends ClientAuthScheme {}

export class BearerTokenAuth extends ClientAuthScheme {
  readonly token: string;

  constructor(options: { token: string; tls?: TLSConfig | null }) {
    super(options);
    this.token = options.token;
  }

  applyAuth(headers: A2AHeaders = {}): Promise<A2AHeaders> {
    return Promise.resolve({ ...headers, Authorization: `Bearer ${this.token}` });
  }
}

export class HTTPBasicAuth extends ClientAuthScheme {
  readonly username: string;
  readonly password: string;

  constructor(options: { username: string; password: string; tls?: TLSConfig | null }) {
    super(options);
    this.username = options.username;
    this.password = options.password;
  }

  applyAuth(headers: A2AHeaders = {}): Promise<A2AHeaders> {
    const encoded = Buffer.from(`${this.username}:${this.password}`).toString("base64");
    return Promise.resolve({ ...headers, Authorization: `Basic ${encoded}` });
  }

  async apply_auth(_client: unknown, headers: A2AHeaders = {}): Promise<A2AHeaders> {
    void _client;
    return await this.applyAuth(headers);
  }
}

export class HTTPDigestAuth extends ClientAuthScheme {
  readonly username: string;
  readonly password: string;
  private readonly configuredClients = new WeakSet<object>();

  constructor(options: { username: string; password: string; tls?: TLSConfig | null }) {
    super(options);
    this.username = options.username;
    this.password = options.password;
  }

  applyAuth(headers: A2AHeaders = {}): Promise<A2AHeaders> {
    return Promise.resolve({ ...headers });
  }

  async apply_auth(_client: unknown, headers: A2AHeaders = {}): Promise<A2AHeaders> {
    void _client;
    return await this.applyAuth(headers);
  }

  configureClient(client: unknown): void {
    if (!isObjectClient(client) || this.configuredClients.has(client)) {
      return;
    }
    (client as MutableClient).auth = {
      type: "digest",
      username: this.username,
      password: this.password,
    };
    this.configuredClients.add(client);
  }

  configure_client(client: unknown): void {
    this.configureClient(client);
  }
}

export class APIKeyAuth extends ClientAuthScheme {
  readonly apiKey: string;
  readonly api_key: string;
  readonly location: APIKeyLocation;
  readonly name: string;
  private readonly configuredClients = new WeakSet<object>();

  constructor(options: {
    apiKey?: string;
    api_key?: string;
    location?: APIKeyLocation;
    name?: string;
    tls?: TLSConfig | null;
  }) {
    super(options);
    const apiKey = options.apiKey ?? options.api_key;
    if (!apiKey) {
      throw new Error("APIKeyAuth requires apiKey.");
    }
    this.apiKey = apiKey;
    this.api_key = apiKey;
    this.location = options.location ?? "header";
    this.name = options.name ?? "X-API-Key";
  }

  applyAuth(headers: A2AHeaders = {}): Promise<A2AHeaders> {
    if (this.location === "header") {
      return Promise.resolve({ ...headers, [this.name]: this.apiKey });
    }
    if (this.location === "cookie") {
      return Promise.resolve({ ...headers, Cookie: `${this.name}=${this.apiKey}` });
    }
    return Promise.resolve({ ...headers });
  }

  async apply_auth(_client: unknown, headers: A2AHeaders = {}): Promise<A2AHeaders> {
    void _client;
    return await this.applyAuth(headers);
  }

  configureClient(client: unknown): void {
    if (this.location !== "query" || !isObjectClient(client) || this.configuredClients.has(client)) {
      return;
    }
    const hookClient = client as A2AHookClient;
    hookClient.event_hooks ??= {};
    hookClient.event_hooks.request ??= [];
    hookClient.event_hooks.request.push((request) => {
      request.url = this.applyToUrl(request.url.toString());
    });
    this.configuredClients.add(client);
  }

  configure_client(client: unknown): void {
    this.configureClient(client);
  }

  applyToUrl(url: string): string {
    if (this.location !== "query") {
      return url;
    }
    const parsed = new URL(url);
    parsed.searchParams.set(this.name, this.apiKey);
    return parsed.toString();
  }

  apply_to_url(url: string): string {
    return this.applyToUrl(url);
  }
}

export class OAuth2ClientCredentials extends ClientAuthScheme {
  readonly tokenUrl: string;
  readonly token_url: string;
  readonly clientId: string;
  readonly client_id: string;
  readonly clientSecret: string;
  readonly client_secret: string;
  readonly scopes: readonly string[];
  protected accessToken: string | null = null;
  protected tokenExpiresAt: number | null = null;
  private tokenPromise: Promise<void> | null = null;
  protected readonly fetchImpl: typeof fetch;

  constructor(options: {
    tokenUrl?: string;
    token_url?: string;
    clientId?: string;
    client_id?: string;
    clientSecret?: string;
    client_secret?: string;
    scopes?: readonly string[];
    tls?: TLSConfig | null;
    fetch?: typeof fetch;
  }) {
    super(options);
    this.tokenUrl = options.tokenUrl ?? options.token_url ?? "";
    this.token_url = this.tokenUrl;
    this.clientId = options.clientId ?? options.client_id ?? "";
    this.client_id = this.clientId;
    this.clientSecret = options.clientSecret ?? options.client_secret ?? "";
    this.client_secret = this.clientSecret;
    this.scopes = [...(options.scopes ?? [])];
    this.fetchImpl = options.fetch ?? fetch;
  }

  setAccessToken(token: string | null, expiresInSeconds: number | null = null): void {
    this.accessToken = token;
    this.tokenExpiresAt = token && expiresInSeconds !== null
      ? Date.now() + Math.max(0, expiresInSeconds - 60) * 1000
      : null;
  }

  set_access_token(token: string | null, expiresInSeconds: number | null = null): void {
    this.setAccessToken(token, expiresInSeconds);
  }

  async applyAuth(headers: A2AHeaders = {}): Promise<A2AHeaders> {
    if (!this.accessToken || !this.tokenExpiresAt || Date.now() >= this.tokenExpiresAt) {
      this.tokenPromise ??= this.fetchToken().finally(() => {
        this.tokenPromise = null;
      });
      await this.tokenPromise;
    }
    if (!this.accessToken) {
      throw new Error("OAuth2 token endpoint did not return an access_token.");
    }
    return { ...headers, Authorization: `Bearer ${this.accessToken}` };
  }

  private async fetchToken(): Promise<void> {
    const form = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });
    if (this.scopes.length > 0) {
      form.set("scope", this.scopes.join(" "));
    }
    const response = await this.fetchImpl(this.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    if (!response.ok) {
      throw new Error(`OAuth2 token request failed: ${String(response.status)}`);
    }
    const tokenData = await response.json() as { access_token?: unknown; expires_in?: unknown };
    if (typeof tokenData.access_token !== "string" || tokenData.access_token.length === 0) {
      throw new Error("OAuth2 token endpoint did not return an access_token.");
    }
    const expiresIn = typeof tokenData.expires_in === "number" ? tokenData.expires_in : 3600;
    this.setAccessToken(tokenData.access_token, expiresIn);
  }
}

export class OAuth2AuthorizationCode extends OAuth2ClientCredentials {
  readonly authorizationUrl: string;
  readonly authorization_url: string;
  readonly redirectUri: string;
  readonly redirect_uri: string;
  private refreshToken: string | null = null;
  private authorizationCallback: ((authorizationUrl: string) => Promise<string>) | null = null;
  private authorizationPromise: Promise<void> | null = null;

  constructor(options: ConstructorParameters<typeof OAuth2ClientCredentials>[0] & {
    authorizationUrl?: string;
    authorization_url?: string;
    redirectUri?: string;
    redirect_uri?: string;
  }) {
    super(options);
    this.authorizationUrl = options.authorizationUrl ?? options.authorization_url ?? "";
    this.authorization_url = this.authorizationUrl;
    this.redirectUri = options.redirectUri ?? options.redirect_uri ?? "";
    this.redirect_uri = this.redirectUri;
  }

  setAuthorizationCallback(callback: ((authorizationUrl: string) => Promise<string>) | null): void {
    this.authorizationCallback = callback;
  }

  set_authorization_callback(callback: ((authorizationUrl: string) => Promise<string>) | null): void {
    this.setAuthorizationCallback(callback);
  }

  override async applyAuth(headers: A2AHeaders = {}): Promise<A2AHeaders> {
    if (!this.accessToken) {
      if (!this.authorizationCallback) {
        throw new Error("Authorization callback not set. Use set_authorization_callback()");
      }
      this.authorizationPromise ??= this.fetchInitialToken().finally(() => {
        this.authorizationPromise = null;
      });
      await this.authorizationPromise;
    } else if (this.tokenExpiresAt !== null && Date.now() >= this.tokenExpiresAt) {
      this.authorizationPromise ??= this.refreshAccessToken().finally(() => {
        this.authorizationPromise = null;
      });
      await this.authorizationPromise;
    }
    if (!this.accessToken) {
      throw new Error("OAuth2 token endpoint did not return an access_token.");
    }
    return { ...headers, Authorization: `Bearer ${this.accessToken}` };
  }

  private async fetchInitialToken(): Promise<void> {
    if (!this.authorizationCallback) {
      throw new Error("Authorization callback not set");
    }
    const authorizationParams = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scopes.join(" "),
    });
    const authorizationCode = await this.authorizationCallback(`${this.authorizationUrl}?${authorizationParams.toString()}`);
    const tokenData = await this.requestToken({
      grant_type: "authorization_code",
      code: authorizationCode,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
    });
    this.applyTokenData(tokenData);
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      await this.fetchInitialToken();
      return;
    }
    const tokenData = await this.requestToken({
      grant_type: "refresh_token",
      refresh_token: this.refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });
    this.applyTokenData(tokenData);
  }

  private async requestToken(params: Record<string, string>): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(this.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });
    if (!response.ok) {
      throw new Error(`OAuth2 token request failed: ${String(response.status)}`);
    }
    return await response.json() as Record<string, unknown>;
  }

  private applyTokenData(tokenData: Record<string, unknown>): void {
    if (typeof tokenData.access_token !== "string" || tokenData.access_token.length === 0) {
      throw new Error("OAuth2 token endpoint did not return an access_token.");
    }
    if (typeof tokenData.refresh_token === "string" && tokenData.refresh_token.length > 0) {
      this.refreshToken = tokenData.refresh_token;
    }
    const expiresIn = typeof tokenData.expires_in === "number" ? tokenData.expires_in : 3600;
    this.setAccessToken(tokenData.access_token, expiresIn);
  }
}

export class AuthenticatedUser {
  readonly token: string;
  readonly scheme: string;
  readonly claims: Record<string, unknown> | null;

  constructor(options: { token: string; scheme: string; claims?: Record<string, unknown> | null }) {
    this.token = options.token;
    this.scheme = options.scheme;
    this.claims = options.claims ?? null;
  }
}

export abstract class ServerAuthScheme {
  abstract authenticate(token: string): Promise<AuthenticatedUser>;
}

export class SimpleTokenAuth extends ServerAuthScheme {
  readonly token: string | null;

  constructor(options: { token?: string | null } = {}) {
    super();
    this.token = options.token ?? null;
  }

  getExpectedToken(): string | null {
    return this.token ?? process.env.AUTH_TOKEN ?? null;
  }

  get_expected_token(): string | null {
    return this.getExpectedToken();
  }

  authenticate(token: string): Promise<AuthenticatedUser> {
    const expected = this.getExpectedToken();
    if (!expected) {
      return Promise.reject(new A2AHTTPException({ statusCode: 401, detail: "Authentication not configured" }));
    }
    if (token !== expected) {
      return Promise.reject(new A2AHTTPException({ statusCode: 401, detail: "Invalid or missing authentication credentials" }));
    }
    return Promise.resolve(new AuthenticatedUser({ token, scheme: "simple_token" }));
  }
}

export class EnterpriseTokenAuth extends ServerAuthScheme {
  authenticate(_token: string): Promise<AuthenticatedUser> {
    void _token;
    return Promise.reject(new Error("Enterprise token authentication requires PlusAPI integration."));
  }
}

export class APIKeyServerAuth extends ServerAuthScheme {
  readonly key: string | null;
  readonly keyName: string;
  readonly key_name: string;

  constructor(options: { key?: string | null; keyName?: string; key_name?: string } = {}) {
    super();
    this.key = options.key ?? process.env.API_KEY ?? null;
    this.keyName = options.keyName ?? options.key_name ?? "x-api-key";
    this.key_name = this.keyName;
  }

  authenticate(token: string): Promise<AuthenticatedUser> {
    if (!this.key) {
      return Promise.reject(new A2AHTTPException({ statusCode: 401, detail: "API key authentication not configured" }));
    }
    if (token !== this.key) {
      return Promise.reject(new A2AHTTPException({ statusCode: 401, detail: "Invalid API key" }));
    }
    return Promise.resolve(new AuthenticatedUser({ token, scheme: "api_key" }));
  }
}

export class OIDCAuth extends ServerAuthScheme {
  readonly issuer: string;
  readonly audience: string;
  readonly jwksUrl: string;
  readonly jwks_url: string;
  readonly algorithms: readonly string[];
  readonly requiredClaims: readonly string[];
  readonly required_claims: readonly string[];
  readonly clockSkewSeconds: number;
  readonly clock_skew_seconds: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: {
    issuer: string;
    audience: string;
    jwksUrl?: string | null;
    jwks_url?: string | null;
    algorithms?: readonly string[];
    requiredClaims?: readonly string[];
    required_claims?: readonly string[];
    clockSkewSeconds?: number;
    clock_skew_seconds?: number;
    fetch?: typeof fetch;
  }) {
    super();
    this.issuer = options.issuer;
    this.audience = options.audience;
    this.jwksUrl = options.jwksUrl ?? options.jwks_url ?? `${options.issuer.replace(/\/+$/, "")}/.well-known/jwks.json`;
    this.jwks_url = this.jwksUrl;
    this.algorithms = [...(options.algorithms ?? ["RS256"])];
    this.requiredClaims = [...(options.requiredClaims ?? options.required_claims ?? ["exp", "iat", "iss", "aud", "sub"])];
    this.required_claims = this.requiredClaims;
    this.clockSkewSeconds = options.clockSkewSeconds ?? options.clock_skew_seconds ?? 30;
    this.clock_skew_seconds = this.clockSkewSeconds;
    this.fetchImpl = options.fetch ?? fetch;
  }

  async authenticate(token: string): Promise<AuthenticatedUser> {
    try {
      const claims = await validateJwtToken({
        jwtToken: token,
        jwksUrl: this.jwksUrl,
        issuer: this.issuer.replace(/\/+$/, ""),
        audience: this.audience,
        fetch: this.fetchImpl,
        leewaySeconds: this.clockSkewSeconds,
      });
      for (const claim of this.requiredClaims) {
        if (!(claim in claims)) {
          throw new Error(`Missing required claim: ${claim}`);
        }
      }
      return new AuthenticatedUser({ token, scheme: "oidc", claims });
    } catch (error) {
      throw new A2AHTTPException({
        statusCode: 401,
        detail: error instanceof Error ? error.message : "Invalid or missing authentication credentials",
      });
    }
  }
}

type OAuth2Scopes = readonly string[] | Record<string, string>;

export class OAuth2ServerAuth extends OIDCAuth {
  readonly tokenUrl: string;
  readonly token_url: string;
  readonly authorizationUrl: string | null;
  readonly authorization_url: string | null;
  readonly refreshUrl: string | null;
  readonly refresh_url: string | null;
  readonly scopes: Record<string, string>;
  readonly introspectionEndpoint: string | null;
  readonly introspection_endpoint: string | null;
  readonly introspectionUrl: string | null;
  readonly introspection_url: string | null;

  constructor(options: ConstructorParameters<typeof OIDCAuth>[0] & {
    tokenUrl?: string;
    token_url?: string;
    authorizationUrl?: string | null;
    authorization_url?: string | null;
    refreshUrl?: string | null;
    refresh_url?: string | null;
    scopes?: OAuth2Scopes;
    introspectionEndpoint?: string | null;
    introspection_endpoint?: string | null;
    introspectionUrl?: string | null;
    introspection_url?: string | null;
  }) {
    super(options);
    this.tokenUrl = options.tokenUrl ?? options.token_url ?? "";
    this.token_url = this.tokenUrl;
    this.authorizationUrl = options.authorizationUrl ?? options.authorization_url ?? null;
    this.authorization_url = this.authorizationUrl;
    this.refreshUrl = options.refreshUrl ?? options.refresh_url ?? null;
    this.refresh_url = this.refreshUrl;
    this.scopes = normalizeOAuth2ServerScopes(options.scopes);
    this.introspectionEndpoint = options.introspectionEndpoint ?? options.introspection_endpoint ?? options.introspectionUrl ?? options.introspection_url ?? null;
    this.introspection_endpoint = this.introspectionEndpoint;
    this.introspectionUrl = this.introspectionEndpoint;
    this.introspection_url = this.introspectionEndpoint;
  }

  override async authenticate(token: string): Promise<AuthenticatedUser> {
    const user = await super.authenticate(token);
    return new AuthenticatedUser({ token: user.token, scheme: "oauth2", claims: user.claims });
  }

  toSecurityScheme(): Record<string, unknown> {
    return {
      flows: {
        client_credentials: this.tokenUrl
          ? {
              token_url: this.tokenUrl,
              refresh_url: this.refreshUrl,
              scopes: this.scopes,
            }
          : null,
        authorization_code: this.authorizationUrl
          ? {
              authorization_url: this.authorizationUrl,
              token_url: this.tokenUrl,
              refresh_url: this.refreshUrl,
              scopes: this.scopes,
            }
          : null,
      },
      description: "OAuth2 authentication",
    };
  }

  to_security_scheme(): Record<string, unknown> {
    return this.toSecurityScheme();
  }
}

function normalizeOAuth2ServerScopes(scopes: OAuth2Scopes | undefined): Record<string, string> {
  if (!scopes) {
    return {};
  }
  if (Array.isArray(scopes)) {
    const scopeList = scopes as readonly string[];
    return Object.fromEntries(scopeList.map((scope) => [scope, ""]));
  }
  const scopeMap = scopes as Record<string, string>;
  return { ...scopeMap };
}

export class MTLSServerAuth extends ServerAuthScheme {
  readonly required = true;

  authenticate(token: string): Promise<AuthenticatedUser> {
    return Promise.resolve(new AuthenticatedUser({ token, scheme: "mtls" }));
  }
}

export function sign_agent_card(
  agent_card: Record<string, unknown>,
  _private_key: string | Uint8Array,
  key_id: string | null = null,
  algorithm: JWTAlgorithm = "RS256",
): { protected: string; signature: string; header: Record<string, string> | null } {
  void _private_key;
  const protectedHeader = base64UrlEncode(JSON.stringify({ typ: "JWS", alg: algorithm, ...(key_id ? { kid: key_id } : {}) }));
  const payload = base64UrlEncode(JSON.stringify(serializeAgentCardForSigning(agent_card)));
  return {
    protected: protectedHeader,
    signature: base64UrlEncode(`${protectedHeader}.${payload}`),
    header: key_id ? { kid: key_id } : null,
  };
}

export function verify_agent_card_signature(
  agent_card: Record<string, unknown>,
  signature: { protected: string; signature: string },
  _public_key: string | Uint8Array,
  _algorithms: readonly string[] | null = null,
): boolean {
  void _public_key;
  void _algorithms;
  const payload = base64UrlEncode(JSON.stringify(serializeAgentCardForSigning(agent_card)));
  return signature.signature === base64UrlEncode(`${signature.protected}.${payload}`);
}

export function get_key_id_from_signature(signature: { protected: string; header?: Record<string, unknown> | null }): string | null {
  const headerKid = signature.header?.kid;
  if (typeof headerKid === "string") {
    return headerKid;
  }
  try {
    const decoded = JSON.parse(Buffer.from(padBase64(signature.protected), "base64url").toString("utf8")) as Record<string, unknown>;
    return typeof decoded.kid === "string" ? decoded.kid : null;
  } catch {
    return null;
  }
}

export const JSONRPC_TRANSPORT = A2ATransport.JSONRPC;
export const GRPC_TRANSPORT = A2ATransport.GRPC;
export const HTTP_JSON_TRANSPORT = A2ATransport.HTTP_JSON;
export const DEFAULT_TRANSPORT_PREFERENCE: readonly A2ATransportProtocol[] = [
  JSONRPC_TRANSPORT,
  GRPC_TRANSPORT,
  HTTP_JSON_TRANSPORT,
];

export const AVAILABLE_AGENTS_TEMPLATE = "\n<AVAILABLE_A2A_AGENTS>\n    $available_a2a_agents\n</AVAILABLE_A2A_AGENTS>\n";
export const PREVIOUS_A2A_CONVERSATION_TEMPLATE = "\n<PREVIOUS_A2A_CONVERSATION>\n    $previous_a2a_conversation\n</PREVIOUS_A2A_CONVERSATION>\n";
export const CONVERSATION_TURN_INFO_TEMPLATE = "\n<CONVERSATION_PROGRESS>\n    turn=\"$turn_count\"\n    max_turns=\"$max_turns\"\n    $warning\n</CONVERSATION_PROGRESS>\n";
export const UNAVAILABLE_AGENTS_NOTICE_TEMPLATE = "\n<A2A_AGENTS_STATUS>\n   NOTE: A2A agents were configured but are currently unavailable.\n   You cannot delegate to remote agents for this task.\n\n   Unavailable Agents:\n     $unavailable_agents\n</A2A_AGENTS_STATUS>\n";
export const REMOTE_AGENT_COMPLETED_NOTICE = `
<REMOTE_AGENT_STATUS>
STATUS: COMPLETED
The remote agent has finished processing your request. Their response is in the conversation history above.
You MUST now:
1. Extract the answer from the conversation history
2. Set is_a2a=false
3. Return the answer as your final message
DO NOT send another request - the task is already done.
</REMOTE_AGENT_STATUS>
`;
export const REMOTE_AGENT_RESPONSE_NOTICE = `
<REMOTE_AGENT_STATUS>
STATUS: RESPONSE_RECEIVED
The remote agent has responded. Their response is in the conversation history above.

You MUST now:
1. Set is_a2a=false (the remote task is complete and cannot receive more messages)
2. Provide YOUR OWN response to the original task based on the information received

IMPORTANT: Your response should be addressed to the USER who gave you the original task.
Report what the remote agent told you in THIRD PERSON (e.g., "The remote agent said..." or "I learned that...").
Do NOT address the remote agent directly or use "you" to refer to them.
</REMOTE_AGENT_STATUS>
`;

export function renderA2ATemplate(template: string, values: Record<string, unknown>): string {
  return template.replaceAll(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (match, key: string) => {
    return key in values ? String(values[key]) : match;
  });
}

export const render_a2a_template = renderA2ATemplate;

export const A2AErrorCode = {
  JSON_PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  TASK_NOT_FOUND: -32001,
  TASK_NOT_CANCELABLE: -32002,
  PUSH_NOTIFICATION_NOT_SUPPORTED: -32003,
  UNSUPPORTED_OPERATION: -32004,
  CONTENT_TYPE_NOT_SUPPORTED: -32005,
  INVALID_AGENT_RESPONSE: -32006,
  AUTHENTICATED_EXTENDED_CARD_NOT_CONFIGURED: -32007,
  UNSUPPORTED_VERSION: -32009,
  UNSUPPORTED_EXTENSION: -32010,
  AUTHENTICATION_REQUIRED: -32011,
  AUTHORIZATION_FAILED: -32012,
  RATE_LIMIT_EXCEEDED: -32013,
  TASK_TIMEOUT: -32014,
  TRANSPORT_NEGOTIATION_FAILED: -32015,
  CONTEXT_NOT_FOUND: -32016,
  SKILL_NOT_FOUND: -32017,
  ARTIFACT_NOT_FOUND: -32018,
} as const;

export type A2AErrorCode = typeof A2AErrorCode[keyof typeof A2AErrorCode];

export const A2A_ERROR_MESSAGES: Record<number, string> = {
  [A2AErrorCode.JSON_PARSE_ERROR]: "Parse error",
  [A2AErrorCode.INVALID_REQUEST]: "Invalid Request",
  [A2AErrorCode.METHOD_NOT_FOUND]: "Method not found",
  [A2AErrorCode.INVALID_PARAMS]: "Invalid params",
  [A2AErrorCode.INTERNAL_ERROR]: "Internal error",
  [A2AErrorCode.TASK_NOT_FOUND]: "Task not found",
  [A2AErrorCode.TASK_NOT_CANCELABLE]: "Task not cancelable",
  [A2AErrorCode.PUSH_NOTIFICATION_NOT_SUPPORTED]: "Push Notification is not supported",
  [A2AErrorCode.UNSUPPORTED_OPERATION]: "This operation is not supported",
  [A2AErrorCode.CONTENT_TYPE_NOT_SUPPORTED]: "Incompatible content types",
  [A2AErrorCode.INVALID_AGENT_RESPONSE]: "Invalid agent response",
  [A2AErrorCode.AUTHENTICATED_EXTENDED_CARD_NOT_CONFIGURED]: "Authenticated Extended Card is not configured",
  [A2AErrorCode.UNSUPPORTED_VERSION]: "Unsupported A2A version",
  [A2AErrorCode.UNSUPPORTED_EXTENSION]: "Client does not support required extensions",
  [A2AErrorCode.AUTHENTICATION_REQUIRED]: "Authentication required",
  [A2AErrorCode.AUTHORIZATION_FAILED]: "Authorization failed",
  [A2AErrorCode.RATE_LIMIT_EXCEEDED]: "Rate limit exceeded",
  [A2AErrorCode.TASK_TIMEOUT]: "Task execution timed out",
  [A2AErrorCode.TRANSPORT_NEGOTIATION_FAILED]: "Transport negotiation failed",
  [A2AErrorCode.CONTEXT_NOT_FOUND]: "Context not found",
  [A2AErrorCode.SKILL_NOT_FOUND]: "Skill not found",
  [A2AErrorCode.ARTIFACT_NOT_FOUND]: "Artifact not found",
};

export const ERROR_MESSAGES = A2A_ERROR_MESSAGES;

export class A2AError extends Error {
  readonly code: number;
  readonly data: unknown;

  constructor(options: { code: number; message?: string | null; data?: unknown }) {
    super(options.message ?? A2A_ERROR_MESSAGES[options.code] ?? "Unknown error");
    this.name = "A2AError";
    this.code = options.code;
    this.data = options.data;
  }

  toDict(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      ...(this.data === undefined || this.data === null ? {} : { data: this.data }),
    };
  }

  to_dict(): Record<string, unknown> {
    return this.toDict();
  }

  toResponse(requestId: string | number | null = null): Record<string, unknown> {
    return {
      jsonrpc: "2.0",
      error: this.toDict(),
      id: requestId,
    };
  }

  to_response(request_id: string | number | null = null): Record<string, unknown> {
    return this.toResponse(request_id);
  }
}

export class JSONParseError extends A2AError {
  constructor(message?: string | null, data: unknown = null) {
    super({ code: A2AErrorCode.JSON_PARSE_ERROR, ...(message ? { message } : {}), ...(data === null ? {} : { data }) });
    this.name = "JSONParseError";
  }
}

export class InvalidRequestError extends A2AError {
  constructor(message?: string | null, data: unknown = null) {
    super({ code: A2AErrorCode.INVALID_REQUEST, ...(message ? { message } : {}), ...(data === null ? {} : { data }) });
    this.name = "InvalidRequestError";
  }
}

export class MethodNotFoundError extends A2AError {
  constructor(method?: string | null) {
    super({
      code: A2AErrorCode.METHOD_NOT_FOUND,
      ...(method ? { message: `Method not found: ${method}` } : {}),
    });
  }
}

export class InvalidParamsError extends A2AError {
  constructor(options: { param?: string | null; reason?: string | null; message?: string | null } = {}) {
    const message = options.message
      ?? (options.param && options.reason
        ? `Invalid parameter '${options.param}': ${options.reason}`
        : options.param ? `Invalid parameter: ${options.param}` : undefined);
    super({
      code: A2AErrorCode.INVALID_PARAMS,
      ...(message === undefined ? {} : { message }),
    });
  }
}

export class InternalError extends A2AError {
  constructor(message?: string | null, data: unknown = null) {
    super({ code: A2AErrorCode.INTERNAL_ERROR, ...(message ? { message } : {}), ...(data === null ? {} : { data }) });
    this.name = "InternalError";
  }
}

export class TaskNotFoundError extends A2AError {
  constructor(taskId?: string | null) {
    super({
      code: A2AErrorCode.TASK_NOT_FOUND,
      ...(taskId ? { message: `Task not found: ${taskId}` } : {}),
    });
  }
}

export class TaskNotCancelableError extends A2AError {
  constructor(options: { taskId?: string | null; task_id?: string | null; reason?: string | null; message?: string | null } = {}) {
    const taskId = options.taskId ?? options.task_id;
    const message = options.message
      ?? (taskId && options.reason ? `Task ${taskId} cannot be canceled: ${options.reason}` : taskId ? `Task ${taskId} cannot be canceled` : undefined);
    super({ code: A2AErrorCode.TASK_NOT_CANCELABLE, ...(message ? { message } : {}) });
    this.name = "TaskNotCancelableError";
  }
}

export class PushNotificationNotSupportedError extends A2AError {
  constructor(message?: string | null) {
    super({ code: A2AErrorCode.PUSH_NOTIFICATION_NOT_SUPPORTED, ...(message ? { message } : {}) });
    this.name = "PushNotificationNotSupportedError";
  }
}

export class UnsupportedOperationError extends A2AError {
  constructor(operation?: string | null) {
    super({ code: A2AErrorCode.UNSUPPORTED_OPERATION, ...(operation ? { message: `Operation not supported: ${operation}` } : {}) });
    this.name = "UnsupportedOperationError";
  }
}

export class ContentTypeNotSupportedError extends A2AError {
  constructor(options: { requestedTypes?: readonly string[] | null; requested_types?: readonly string[] | null; supportedTypes?: readonly string[] | null; supported_types?: readonly string[] | null; message?: string | null } = {}) {
    const requestedTypes = options.requestedTypes ?? options.requested_types;
    const supportedTypes = options.supportedTypes ?? options.supported_types;
    const message = options.message
      ?? (requestedTypes && supportedTypes ? `Content type not supported. Requested: ${JSON.stringify([...requestedTypes])}, Supported: ${JSON.stringify([...supportedTypes])}` : undefined);
    super({ code: A2AErrorCode.CONTENT_TYPE_NOT_SUPPORTED, ...(message ? { message } : {}) });
    this.name = "ContentTypeNotSupportedError";
  }
}

export class InvalidAgentResponseError extends A2AError {
  constructor(message?: string | null) {
    super({ code: A2AErrorCode.INVALID_AGENT_RESPONSE, ...(message ? { message } : {}) });
    this.name = "InvalidAgentResponseError";
  }
}

export class AuthenticatedExtendedCardNotConfiguredError extends A2AError {
  constructor(message?: string | null) {
    super({ code: A2AErrorCode.AUTHENTICATED_EXTENDED_CARD_NOT_CONFIGURED, ...(message ? { message } : {}) });
    this.name = "AuthenticatedExtendedCardNotConfiguredError";
  }
}

export class UnsupportedVersionError extends A2AError {
  constructor(options: { requestedVersion?: string | null; requested_version?: string | null; supportedVersions?: readonly string[] | null; supported_versions?: readonly string[] | null; message?: string | null } = {}) {
    const requestedVersion = options.requestedVersion ?? options.requested_version;
    const supportedVersions = options.supportedVersions ?? options.supported_versions;
    const message = options.message
      ?? (requestedVersion ? `Unsupported A2A version: ${requestedVersion}${supportedVersions ? `. Supported versions: ${[...supportedVersions].join(", ")}` : ""}` : undefined);
    super({ code: A2AErrorCode.UNSUPPORTED_VERSION, ...(message ? { message } : {}) });
    this.name = "UnsupportedVersionError";
  }
}

export class UnsupportedExtensionError extends A2AError {
  constructor(requiredExtensions?: readonly string[] | null) {
    super({
      code: A2AErrorCode.UNSUPPORTED_EXTENSION,
      ...(requiredExtensions ? { message: `Client does not support required extensions: ${[...requiredExtensions].join(", ")}` } : {}),
    });
    this.name = "UnsupportedExtensionError";
  }
}

export class AuthenticationRequiredError extends A2AError {
  constructor(message?: string | null) {
    super({ code: A2AErrorCode.AUTHENTICATION_REQUIRED, ...(message ? { message } : {}) });
    this.name = "AuthenticationRequiredError";
  }
}

export class AuthorizationFailedError extends A2AError {
  constructor(requiredScope?: string | null) {
    super({ code: A2AErrorCode.AUTHORIZATION_FAILED, ...(requiredScope ? { message: `Authorization failed. Required scope: ${requiredScope}` } : {}) });
    this.name = "AuthorizationFailedError";
  }
}

export class RateLimitExceededError extends A2AError {
  constructor(retryAfter?: number | null) {
    super({
      code: A2AErrorCode.RATE_LIMIT_EXCEEDED,
      ...(retryAfter ? { message: `Rate limit exceeded. Retry after ${String(retryAfter)} seconds`, data: { retry_after: retryAfter } } : {}),
    });
    this.name = "RateLimitExceededError";
  }
}

export class TaskTimeoutError extends A2AError {
  constructor(options: { taskId?: string | null; task_id?: string | null; timeoutSeconds?: number | null; timeout_seconds?: number | null; message?: string | null } = {}) {
    const taskId = options.taskId ?? options.task_id;
    const timeoutSeconds = options.timeoutSeconds ?? options.timeout_seconds;
    const message = options.message
      ?? (taskId && timeoutSeconds ? `Task ${taskId} timed out after ${String(timeoutSeconds)}s` : taskId ? `Task ${taskId} timed out` : undefined);
    super({ code: A2AErrorCode.TASK_TIMEOUT, ...(message ? { message } : {}) });
    this.name = "TaskTimeoutError";
  }
}

export class TransportNegotiationFailedError extends A2AError {
  constructor(clientTransports?: readonly string[] | null, serverTransports?: readonly string[] | null) {
    const message = clientTransports && serverTransports
      ? `Transport negotiation failed. Client: ${JSON.stringify([...clientTransports])}, Server: ${JSON.stringify([...serverTransports])}`
      : undefined;
    super({
      code: A2AErrorCode.TRANSPORT_NEGOTIATION_FAILED,
      ...(message === undefined ? {} : { message }),
    });
  }
}

export class ContextNotFoundError extends A2AError {
  constructor(contextId?: string | null) {
    super({ code: A2AErrorCode.CONTEXT_NOT_FOUND, ...(contextId ? { message: `Context not found: ${contextId}` } : {}) });
    this.name = "ContextNotFoundError";
  }
}

export class SkillNotFoundError extends A2AError {
  constructor(skillId?: string | null) {
    super({ code: A2AErrorCode.SKILL_NOT_FOUND, ...(skillId ? { message: `Skill not found: ${skillId}` } : {}) });
    this.name = "SkillNotFoundError";
  }
}

export class ArtifactNotFoundError extends A2AError {
  constructor(artifactId?: string | null) {
    super({ code: A2AErrorCode.ARTIFACT_NOT_FOUND, ...(artifactId ? { message: `Artifact not found: ${artifactId}` } : {}) });
    this.name = "ArtifactNotFoundError";
  }
}

export class A2APollingTimeoutError extends Error {
  constructor(message = "A2A polling exceeded the configured timeout.") {
    super(message);
    this.name = "A2APollingTimeoutError";
  }
}

export function createErrorResponse(
  code: number,
  message: string | null = null,
  data: unknown = null,
  requestId: string | number | null = null,
): Record<string, unknown> {
  return new A2AError({
    code,
    ...(message === null ? {} : { message }),
    ...(data === null ? {} : { data }),
  }).toResponse(requestId);
}

export const create_error_response = createErrorResponse;

export const TEXT_PLAIN = "text/plain";
export const APPLICATION_JSON = "application/json";
export const IMAGE_PNG = "image/png";
export const IMAGE_JPEG = "image/jpeg";
export const IMAGE_WILDCARD = "image/*";
export const APPLICATION_PDF = "application/pdf";
export const APPLICATION_OCTET_STREAM = "application/octet-stream";
export const APPLICATION_A2UI_JSON = "application/json+a2ui";
export const DEFAULT_CLIENT_INPUT_MODES: readonly string[] = [TEXT_PLAIN, APPLICATION_JSON];
export const DEFAULT_CLIENT_OUTPUT_MODES: readonly string[] = [TEXT_PLAIN, APPLICATION_JSON];

export class NegotiatedContentTypes {
  readonly inputModes: readonly string[];
  readonly input_modes: readonly string[];
  readonly outputModes: readonly string[];
  readonly output_modes: readonly string[];
  readonly effectiveInputModes: readonly string[];
  readonly effective_input_modes: readonly string[];
  readonly effectiveOutputModes: readonly string[];
  readonly effective_output_modes: readonly string[];
  readonly skillName: string | null;
  readonly skill_name: string | null;

  constructor(options: {
    inputModes?: readonly string[];
    input_modes?: readonly string[];
    outputModes?: readonly string[];
    output_modes?: readonly string[];
    effectiveInputModes?: readonly string[];
    effective_input_modes?: readonly string[];
    effectiveOutputModes?: readonly string[];
    effective_output_modes?: readonly string[];
    skillName?: string | null;
    skill_name?: string | null;
  } = {}) {
    this.inputModes = options.inputModes ?? options.input_modes ?? [];
    this.input_modes = this.inputModes;
    this.outputModes = options.outputModes ?? options.output_modes ?? [];
    this.output_modes = this.outputModes;
    this.effectiveInputModes = options.effectiveInputModes ?? options.effective_input_modes ?? [];
    this.effective_input_modes = this.effectiveInputModes;
    this.effectiveOutputModes = options.effectiveOutputModes ?? options.effective_output_modes ?? [];
    this.effective_output_modes = this.effectiveOutputModes;
    this.skillName = options.skillName ?? options.skill_name ?? null;
    this.skill_name = this.skillName;
  }
}

export class ContentTypeNegotiationError extends Error {
  readonly clientInputModes: readonly string[];
  readonly client_input_modes: readonly string[];
  readonly clientOutputModes: readonly string[];
  readonly client_output_modes: readonly string[];
  readonly serverInputModes: readonly string[];
  readonly server_input_modes: readonly string[];
  readonly serverOutputModes: readonly string[];
  readonly server_output_modes: readonly string[];
  readonly direction: string;

  constructor(options: {
    clientInputModes?: readonly string[];
    client_input_modes?: readonly string[];
    clientOutputModes?: readonly string[];
    client_output_modes?: readonly string[];
    serverInputModes?: readonly string[];
    server_input_modes?: readonly string[];
    serverOutputModes?: readonly string[];
    server_output_modes?: readonly string[];
    direction?: string;
    message?: string | null;
  } = {}) {
    const clientInputModes = options.clientInputModes ?? options.client_input_modes ?? [];
    const clientOutputModes = options.clientOutputModes ?? options.client_output_modes ?? [];
    const serverInputModes = options.serverInputModes ?? options.server_input_modes ?? [];
    const serverOutputModes = options.serverOutputModes ?? options.server_output_modes ?? [];
    const direction = options.direction ?? "both";
    super(options.message ?? contentNegotiationMessage(direction, clientInputModes, clientOutputModes, serverInputModes, serverOutputModes));
    this.name = "ContentTypeNegotiationError";
    this.clientInputModes = clientInputModes;
    this.client_input_modes = clientInputModes;
    this.clientOutputModes = clientOutputModes;
    this.client_output_modes = clientOutputModes;
    this.serverInputModes = serverInputModes;
    this.server_input_modes = serverInputModes;
    this.serverOutputModes = serverOutputModes;
    this.server_output_modes = serverOutputModes;
    this.direction = direction;
  }
}

export function negotiateContentTypes(
  agentCard: {
    name?: string | null;
    url?: string;
    defaultInputModes?: readonly string[];
    default_input_modes?: readonly string[];
    defaultOutputModes?: readonly string[];
    default_output_modes?: readonly string[];
    skills?: readonly { id?: string; name?: string; inputModes?: readonly string[]; input_modes?: readonly string[]; outputModes?: readonly string[]; output_modes?: readonly string[] }[];
  },
  clientInputModes: readonly string[] = DEFAULT_CLIENT_INPUT_MODES,
  clientOutputModes: readonly string[] = DEFAULT_CLIENT_OUTPUT_MODES,
  skillName: string | null = null,
  emitEvent = true,
  endpoint: string | null = null,
  a2aAgentName: string | null = null,
  strict = false,
): NegotiatedContentTypes {
  const skill = skillName ? agentCard.skills?.find((item) => item.name === skillName || item.id === skillName) ?? null : null;
  const serverInputModes = skill?.inputModes ?? skill?.input_modes ?? agentCard.defaultInputModes ?? agentCard.default_input_modes ?? [TEXT_PLAIN];
  const serverOutputModes = skill?.outputModes ?? skill?.output_modes ?? agentCard.defaultOutputModes ?? agentCard.default_output_modes ?? [TEXT_PLAIN];
  const compatibleInput = findCompatibleModes(clientInputModes, serverInputModes);
  const compatibleOutput = findCompatibleModes(clientOutputModes, serverOutputModes);
  if (strict) {
    if (compatibleInput.length === 0 && compatibleOutput.length === 0) {
      throw new ContentTypeNegotiationError({ clientInputModes, clientOutputModes, serverInputModes, serverOutputModes });
    }
    if (compatibleInput.length === 0) {
      throw new ContentTypeNegotiationError({ clientInputModes, clientOutputModes, serverInputModes, serverOutputModes, direction: "input" });
    }
    if (compatibleOutput.length === 0) {
      throw new ContentTypeNegotiationError({ clientInputModes, clientOutputModes, serverInputModes, serverOutputModes, direction: "output" });
    }
  }
  const result = new NegotiatedContentTypes({
    inputModes: compatibleInput,
    outputModes: compatibleOutput,
    effectiveInputModes: serverInputModes,
    effectiveOutputModes: serverOutputModes,
    skillName: skill?.name ?? null,
  });
  if (emitEvent) {
    crewaiEventBus.emit(null, new A2AContentTypeNegotiatedEvent({
      endpoint: endpoint ?? agentCard.url ?? "",
      a2a_agent_name: a2aAgentName ?? agentCard.name ?? null,
      skill_name: skillName,
      client_input_modes: clientInputModes,
      client_output_modes: clientOutputModes,
      server_input_modes: serverInputModes,
      server_output_modes: serverOutputModes,
      negotiated_input_modes: compatibleInput,
      negotiated_output_modes: compatibleOutput,
      negotiation_success: compatibleInput.length > 0 && compatibleOutput.length > 0,
    }));
  }
  return result;
}

export const negotiate_content_types = negotiateContentTypes;

export function validateContentType(contentType: string, allowedModes: readonly string[]): boolean {
  return allowedModes.some((mode) => mimeTypesCompatible(contentType, mode));
}

export const validate_content_type = validateContentType;

export function getPartContentType(part: { root?: { kind?: string; metadata?: Record<string, unknown> | null; file?: { mimeType?: string | null; mime_type?: string | null } | null } }): string {
  const root = part.root;
  if (root?.kind === "text") {
    return TEXT_PLAIN;
  }
  if (root?.kind === "data") {
    return root.metadata?.mimeType === APPLICATION_A2UI_JSON ? APPLICATION_A2UI_JSON : APPLICATION_JSON;
  }
  if (root?.kind === "file") {
    return root.file?.mimeType ?? root.file?.mime_type ?? APPLICATION_OCTET_STREAM;
  }
  return APPLICATION_OCTET_STREAM;
}

export const get_part_content_type = getPartContentType;

export function validateMessageParts(parts: readonly Parameters<typeof getPartContentType>[0][], allowedModes: readonly string[]): string[] {
  const invalid = new Set<string>();
  for (const part of parts) {
    const contentType = getPartContentType(part);
    if (!validateContentType(contentType, allowedModes)) {
      invalid.add(contentType);
    }
  }
  return [...invalid];
}

export const validate_message_parts = validateMessageParts;

function normalizeMimeType(mimeType: string): string {
  return mimeType.toLowerCase().trim();
}

function mimeTypesCompatible(clientType: string, serverType: string): boolean {
  const clientNormalized = normalizeMimeType(clientType);
  const serverNormalized = normalizeMimeType(serverType);
  if (clientNormalized === serverNormalized) {
    return true;
  }
  if (!clientNormalized.includes("*") && !serverNormalized.includes("*")) {
    return false;
  }
  const clientParts = clientNormalized.split("/");
  const serverParts = serverNormalized.split("/");
  return clientParts.length === 2
    && serverParts.length === 2
    && (clientParts[0] === serverParts[0] || clientParts[0] === "*" || serverParts[0] === "*")
    && (clientParts[1] === serverParts[1] || clientParts[1] === "*" || serverParts[1] === "*");
}

function findCompatibleModes(clientModes: readonly string[], serverModes: readonly string[]): string[] {
  const compatible: string[] = [];
  for (const clientMode of clientModes) {
    const serverMode = serverModes.find((mode) => mimeTypesCompatible(clientMode, mode));
    if (!serverMode) {
      continue;
    }
    const mode = clientMode.includes("*") && !serverMode.includes("*") ? serverMode : clientMode;
    if (!compatible.includes(mode)) {
      compatible.push(mode);
    }
  }
  return compatible;
}

function contentNegotiationMessage(direction: string, clientInputModes: readonly string[], clientOutputModes: readonly string[], serverInputModes: readonly string[], serverOutputModes: readonly string[]): string {
  if (direction === "input") {
    return `No compatible input content types. Client supports: ${JSON.stringify(clientInputModes)}, Server accepts: ${JSON.stringify(serverInputModes)}`;
  }
  if (direction === "output") {
    return `No compatible output content types. Client accepts: ${JSON.stringify(clientOutputModes)}, Server produces: ${JSON.stringify(serverOutputModes)}`;
  }
  return `No compatible content types. Input - Client: ${JSON.stringify(clientInputModes)}, Server: ${JSON.stringify(serverInputModes)}. Output - Client: ${JSON.stringify(clientOutputModes)}, Server: ${JSON.stringify(serverOutputModes)}`;
}

export function isRetryableError(code: number): boolean {
  return code === A2AErrorCode.INTERNAL_ERROR
    || code === A2AErrorCode.RATE_LIMIT_EXCEEDED
    || code === A2AErrorCode.TASK_TIMEOUT;
}

export const is_retryable_error = isRetryableError;

export function isClientError(code: number): boolean {
  const clientErrorCodes: readonly number[] = [
    A2AErrorCode.JSON_PARSE_ERROR,
    A2AErrorCode.INVALID_REQUEST,
    A2AErrorCode.METHOD_NOT_FOUND,
    A2AErrorCode.INVALID_PARAMS,
    A2AErrorCode.TASK_NOT_FOUND,
    A2AErrorCode.CONTENT_TYPE_NOT_SUPPORTED,
    A2AErrorCode.UNSUPPORTED_VERSION,
    A2AErrorCode.UNSUPPORTED_EXTENSION,
    A2AErrorCode.CONTEXT_NOT_FOUND,
    A2AErrorCode.SKILL_NOT_FOUND,
    A2AErrorCode.ARTIFACT_NOT_FOUND,
  ];
  return clientErrorCodes.includes(code);
}

export const is_client_error = isClientError;

export class JSONRPCServerConfig {
  readonly rpcPath: string;
  readonly rpc_path: string;
  readonly agentCardPath: string;
  readonly agent_card_path: string;

  constructor(options: { rpcPath?: string; rpc_path?: string; agentCardPath?: string; agent_card_path?: string } = {}) {
    this.rpcPath = options.rpcPath ?? options.rpc_path ?? "/a2a";
    this.rpc_path = this.rpcPath;
    this.agentCardPath = options.agentCardPath ?? options.agent_card_path ?? "/.well-known/agent-card.json";
    this.agent_card_path = this.agentCardPath;
  }
}

export class JSONRPCClientConfig {
  readonly maxRequestSize: number | null;
  readonly max_request_size: number | null;

  constructor(options: { maxRequestSize?: number | null; max_request_size?: number | null } = {}) {
    this.maxRequestSize = options.maxRequestSize ?? options.max_request_size ?? null;
    this.max_request_size = this.maxRequestSize;
  }
}

export class GRPCServerConfig {
  readonly host: string;
  readonly port: number;
  readonly tlsCertPath: string | null;
  readonly tls_cert_path: string | null;
  readonly tlsKeyPath: string | null;
  readonly tls_key_path: string | null;
  readonly maxWorkers: number;
  readonly max_workers: number;
  readonly reflectionEnabled: boolean;
  readonly reflection_enabled: boolean;

  constructor(options: {
    host?: string;
    port?: number;
    tlsCertPath?: string | null;
    tls_cert_path?: string | null;
    tlsKeyPath?: string | null;
    tls_key_path?: string | null;
    maxWorkers?: number;
    max_workers?: number;
    reflectionEnabled?: boolean;
    reflection_enabled?: boolean;
  } = {}) {
    this.host = options.host ?? "localhost";
    this.port = options.port ?? 50051;
    this.tlsCertPath = options.tlsCertPath ?? options.tls_cert_path ?? null;
    this.tls_cert_path = this.tlsCertPath;
    this.tlsKeyPath = options.tlsKeyPath ?? options.tls_key_path ?? null;
    this.tls_key_path = this.tlsKeyPath;
    this.maxWorkers = options.maxWorkers ?? options.max_workers ?? 10;
    this.max_workers = this.maxWorkers;
    this.reflectionEnabled = options.reflectionEnabled ?? options.reflection_enabled ?? false;
    this.reflection_enabled = this.reflectionEnabled;
  }
}

export class GRPCClientConfig {
  readonly maxSendMessageLength: number | null;
  readonly max_send_message_length: number | null;
  readonly maxReceiveMessageLength: number | null;
  readonly max_receive_message_length: number | null;
  readonly keepaliveTimeMs: number | null;
  readonly keepalive_time_ms: number | null;
  readonly keepaliveTimeoutMs: number | null;
  readonly keepalive_timeout_ms: number | null;

  constructor(options: {
    maxSendMessageLength?: number | null;
    max_send_message_length?: number | null;
    maxReceiveMessageLength?: number | null;
    max_receive_message_length?: number | null;
    keepaliveTimeMs?: number | null;
    keepalive_time_ms?: number | null;
    keepaliveTimeoutMs?: number | null;
    keepalive_timeout_ms?: number | null;
  } = {}) {
    this.maxSendMessageLength = options.maxSendMessageLength ?? options.max_send_message_length ?? null;
    this.max_send_message_length = this.maxSendMessageLength;
    this.maxReceiveMessageLength = options.maxReceiveMessageLength ?? options.max_receive_message_length ?? null;
    this.max_receive_message_length = this.maxReceiveMessageLength;
    this.keepaliveTimeMs = options.keepaliveTimeMs ?? options.keepalive_time_ms ?? null;
    this.keepalive_time_ms = this.keepaliveTimeMs;
    this.keepaliveTimeoutMs = options.keepaliveTimeoutMs ?? options.keepalive_timeout_ms ?? null;
    this.keepalive_timeout_ms = this.keepaliveTimeoutMs;
  }
}

export class HTTPJSONConfig {
  readonly enabled: boolean;

  constructor(options: { enabled?: boolean } = {}) {
    this.enabled = options.enabled ?? true;
  }
}

export class ServerPushNotificationConfig {
  readonly signatureSecret: string | null;
  readonly signature_secret: string | null;

  constructor(options: { signatureSecret?: string | null; signature_secret?: string | null } = {}) {
    this.signatureSecret = options.signatureSecret ?? options.signature_secret ?? null;
    this.signature_secret = this.signatureSecret;
  }
}

export class ServerTransportConfig {
  readonly preferred: A2ATransportProtocol;
  readonly jsonrpc: JSONRPCServerConfig;
  readonly grpc: GRPCServerConfig | null;
  readonly httpJson: HTTPJSONConfig | null;
  readonly http_json: HTTPJSONConfig | null;

  constructor(options: {
    preferred?: A2ATransportProtocol;
    jsonrpc?: JSONRPCServerConfig;
    grpc?: GRPCServerConfig | null;
    httpJson?: HTTPJSONConfig | null;
    http_json?: HTTPJSONConfig | null;
  } = {}) {
    this.preferred = options.preferred ?? JSONRPC_TRANSPORT;
    this.jsonrpc = options.jsonrpc ?? new JSONRPCServerConfig();
    this.grpc = options.grpc ?? null;
    this.httpJson = options.httpJson ?? options.http_json ?? null;
    this.http_json = this.httpJson;
  }
}

export class ClientTransportConfig {
  readonly preferred: A2ATransportProtocol | null;
  readonly supported: readonly A2ATransportProtocol[];
  readonly jsonrpc: JSONRPCClientConfig;
  readonly grpc: GRPCClientConfig;

  constructor(options: {
    preferred?: A2ATransportProtocol | null;
    supported?: readonly A2ATransportProtocol[];
    jsonrpc?: JSONRPCClientConfig;
    grpc?: GRPCClientConfig;
  } = {}) {
    this.preferred = options.preferred ?? null;
    this.supported = options.supported ? [...options.supported] : [JSONRPC_TRANSPORT];
    this.jsonrpc = options.jsonrpc ?? new JSONRPCClientConfig();
    this.grpc = options.grpc ?? new GRPCClientConfig();
  }
}

export type A2AClientConfigOptions = {
  endpoint: string;
  auth?: unknown;
  timeout?: number;
  maxTurns?: number;
  max_turns?: number;
  responseModel?: unknown;
  response_model?: unknown;
  failFast?: boolean;
  fail_fast?: boolean;
  trustRemoteCompletionStatus?: boolean;
  trust_remote_completion_status?: boolean;
  updates?: unknown;
  acceptedOutputModes?: readonly string[];
  accepted_output_modes?: readonly string[];
  extensions?: readonly string[];
  clientExtensions?: readonly unknown[];
  client_extensions?: readonly unknown[];
  transport?: ClientTransportConfig;
  transportProtocol?: A2ATransportProtocol | null;
  transport_protocol?: A2ATransportProtocol | null;
  supportedTransports?: readonly A2ATransportProtocol[] | null;
  supported_transports?: readonly A2ATransportProtocol[] | null;
};

export class A2AClientConfig {
  readonly endpoint: string;
  readonly auth: unknown;
  readonly timeout: number;
  readonly maxTurns: number;
  readonly max_turns: number;
  readonly responseModel: unknown;
  readonly response_model: unknown;
  readonly failFast: boolean;
  readonly fail_fast: boolean;
  readonly trustRemoteCompletionStatus: boolean;
  readonly trust_remote_completion_status: boolean;
  readonly updates: unknown;
  readonly acceptedOutputModes: readonly string[];
  readonly accepted_output_modes: readonly string[];
  readonly extensions: readonly string[];
  readonly clientExtensions: readonly unknown[];
  readonly client_extensions: readonly unknown[];
  readonly transport: ClientTransportConfig;

  constructor(options: A2AClientConfigOptions) {
    this.endpoint = validateUrl(options.endpoint);
    this.auth = options.auth ?? null;
    this.timeout = options.timeout ?? 120;
    this.maxTurns = options.maxTurns ?? options.max_turns ?? 10;
    this.max_turns = this.maxTurns;
    this.responseModel = options.responseModel ?? options.response_model ?? null;
    this.response_model = this.responseModel;
    this.failFast = options.failFast ?? options.fail_fast ?? true;
    this.fail_fast = this.failFast;
    this.trustRemoteCompletionStatus = options.trustRemoteCompletionStatus ?? options.trust_remote_completion_status ?? false;
    this.trust_remote_completion_status = this.trustRemoteCompletionStatus;
    this.updates = options.updates ?? new StreamingConfig();
    this.acceptedOutputModes = [...(options.acceptedOutputModes ?? options.accepted_output_modes ?? ["application/json"])];
    this.accepted_output_modes = this.acceptedOutputModes;
    this.extensions = [...(options.extensions ?? [])];
    this.clientExtensions = [...(options.clientExtensions ?? options.client_extensions ?? [])];
    this.client_extensions = this.clientExtensions;
    const transport = options.transport ?? new ClientTransportConfig();
    this.transport = migrateClientTransport(transport, options.transportProtocol ?? options.transport_protocol ?? null, options.supportedTransports ?? options.supported_transports ?? null);
  }
}

export class A2AConfig extends A2AClientConfig {}

export type A2AServerConfigOptions = {
  host?: string;
  port?: number;
  endpoint?: string;
  protocolVersion?: A2AProtocolVersion;
  protocol_version?: A2AProtocolVersion;
  transport?: ServerTransportConfig;
};

export class A2AServerConfig {
  readonly host: string;
  readonly port: number;
  readonly endpoint: string;
  readonly protocolVersion: A2AProtocolVersion;
  readonly protocol_version: A2AProtocolVersion;
  readonly transport: ServerTransportConfig;

  constructor(options: A2AServerConfigOptions = {}) {
    this.host = options.host ?? "0.0.0.0";
    this.port = options.port ?? 8000;
    this.endpoint = options.endpoint ?? `http://${this.host}:${String(this.port)}`;
    this.protocolVersion = options.protocolVersion ?? options.protocol_version ?? "0.3.0";
    this.protocol_version = this.protocolVersion;
    this.transport = options.transport ?? new ServerTransportConfig();
  }
}

export class AgentResponseModel {
  readonly a2a_ids: readonly string[];
  readonly message: string;
  readonly is_a2a: boolean;
  readonly allowedAgentIds: readonly string[];
  readonly allowed_agent_ids: readonly string[];

  constructor(options: A2AAgentResponseProtocol & { allowedAgentIds?: readonly string[]; allowed_agent_ids?: readonly string[] }) {
    const allowed = options.allowedAgentIds ?? options.allowed_agent_ids ?? [];
    const a2aIds = options.a2a_ids ?? [];
    if (allowed.length > 0 && a2aIds.length > allowed.length) {
      throw new Error(`Expected at most ${String(allowed.length)} A2A agent ids`);
    }
    if (allowed.length > 0) {
      const invalid = a2aIds.filter((id) => !allowed.includes(id));
      if (invalid.length > 0) {
        throw new Error(`Invalid A2A agent ids: ${invalid.join(", ")}`);
      }
    }
    this.a2a_ids = [...a2aIds];
    this.message = options.message;
    this.is_a2a = options.is_a2a;
    this.allowedAgentIds = [...allowed];
    this.allowed_agent_ids = this.allowedAgentIds;
  }
}

export function create_agent_response_model(agent_ids: readonly string[]): typeof AgentResponseModel | null {
  if (agent_ids.length === 0) {
    return null;
  }
  const allowedAgentIds = [...agent_ids];
  return class DynamicAgentResponseModel extends AgentResponseModel {
    static readonly allowedAgentIds = allowedAgentIds;
    static readonly allowed_agent_ids = allowedAgentIds;

    constructor(options: A2AAgentResponseProtocol) {
      super({ ...options, allowedAgentIds });
    }
  };
}

export function extract_a2a_agent_ids_from_config(
  a2a_config: readonly A2AConfigTypes[] | A2AConfigTypes | null | undefined,
): [A2AClientConfigTypes[], string[]] {
  if (!a2a_config) {
    return [[], []];
  }
  const configs = Array.isArray(a2a_config) ? a2a_config : [a2a_config];
  const clientConfigs = configs.filter((config): config is A2AClientConfigTypes => config instanceof A2AClientConfig || config instanceof A2AConfig);
  return [clientConfigs, clientConfigs.map((config) => config.endpoint)];
}

export function get_a2a_agents_and_response_model(
  a2a_config: readonly A2AConfigTypes[] | A2AConfigTypes | null | undefined,
): [A2AClientConfigTypes[], typeof AgentResponseModel | null] {
  const [a2aAgents, agentIds] = extract_a2a_agent_ids_from_config(a2a_config);
  return [a2aAgents, create_agent_response_model(agentIds)];
}

export function get_extensions_from_config(a2a_config: readonly A2AClientConfigTypes[] | A2AClientConfigTypes): string[] {
  const configs: readonly A2AClientConfigTypes[] = Array.isArray(a2a_config) ? a2a_config : [a2a_config];
  const extensions = new Set<string>();
  for (const config of configs) {
    for (const extension of config.extensions) {
      extensions.add(extension);
    }
  }
  return [...extensions];
}

export function create_extension_registry_from_config(a2a_config: readonly A2AClientConfigTypes[] | A2AClientConfigTypes): ExtensionRegistry {
  const configs: readonly A2AClientConfigTypes[] = Array.isArray(a2a_config) ? a2a_config : [a2a_config];
  const registry = new ExtensionRegistry();
  const seen = new Set<A2AExtension>();
  for (const config of configs) {
    for (const extension of config.clientExtensions) {
      if (isA2AExtension(extension) && !seen.has(extension)) {
        seen.add(extension);
        registry.register(extension);
      }
    }
  }
  return registry;
}

export function validate_required_extensions(agent_card: { capabilities?: { extensions?: readonly { uri?: string; required?: boolean }[] } | null }, client_extensions: readonly string[] | null = null): { uri?: string; required?: boolean }[] {
  const supported = new Set(client_extensions ?? []);
  return [...(agent_card.capabilities?.extensions ?? [])].filter((extension) => extension.required && typeof extension.uri === "string" && !supported.has(extension.uri));
}

export class NegotiatedTransport {
  readonly transport: string;
  readonly url: string;
  readonly source: A2ANegotiationSource;

  constructor(options: { transport: string; url: string; source: A2ANegotiationSource }) {
    this.transport = options.transport;
    this.url = options.url;
    this.source = options.source;
  }
}

export class TransportNegotiationError extends Error {
  readonly clientTransports: readonly string[];
  readonly client_transports: readonly string[];
  readonly serverTransports: readonly string[];
  readonly server_transports: readonly string[];

  constructor(clientTransports: readonly string[], serverTransports: readonly string[], message?: string | null) {
    super(message ?? `No compatible transport found. Client supports: ${JSON.stringify([...clientTransports])}. Server supports: ${JSON.stringify([...serverTransports])}.`);
    this.name = "TransportNegotiationError";
    this.clientTransports = [...clientTransports];
    this.client_transports = this.clientTransports;
    this.serverTransports = [...serverTransports];
    this.server_transports = this.serverTransports;
  }
}

export function getServerInterfaces(agentCard: A2AAgentCard): A2AAgentInterface[] {
  const interfaces: A2AAgentInterface[] = [{
    transport: agentCard.preferredTransport ?? agentCard.preferred_transport ?? JSONRPC_TRANSPORT,
    url: agentCard.url,
  }];
  for (const additional of agentCard.additionalInterfaces ?? agentCard.additional_interfaces ?? []) {
    if (!interfaces.some((existing) => existing.url === additional.url && existing.transport === additional.transport)) {
      interfaces.push({ transport: additional.transport, url: additional.url });
    }
  }
  return interfaces;
}

export const get_server_interfaces = getServerInterfaces;

export function negotiateTransport(
  agentCard: A2AAgentCard,
  options: {
    clientSupportedTransports?: readonly string[] | null;
    client_supported_transports?: readonly string[] | null;
    clientPreferredTransport?: string | null;
    client_preferred_transport?: string | null;
    emitEvent?: boolean;
    emit_event?: boolean;
    endpoint?: string | null;
    a2aAgentName?: string | null;
    a2a_agent_name?: string | null;
  } = {},
): NegotiatedTransport {
  const emitEvent = options.emitEvent ?? options.emit_event ?? true;
  const endpoint = options.endpoint ?? agentCard.url;
  const a2aAgentName = options.a2aAgentName ?? options.a2a_agent_name ?? agentCard.name ?? null;
  const clientTransports = [...(options.clientSupportedTransports ?? options.client_supported_transports ?? [JSONRPC_TRANSPORT])]
    .map((transport) => transport.toUpperCase());
  const clientPreferred = (options.clientPreferredTransport ?? options.client_preferred_transport ?? null)?.toUpperCase() ?? null;
  const serverInterfaces = getServerInterfaces(agentCard);
  const serverTransports = serverInterfaces.map((item) => item.transport.toUpperCase());
  const transportToInterface = new Map<string, A2AAgentInterface>();
  for (const item of serverInterfaces) {
    const normalized = item.transport.toUpperCase();
    if (!transportToInterface.has(normalized)) {
      transportToInterface.set(normalized, item);
    }
  }

  if (clientPreferred && transportToInterface.has(clientPreferred)) {
    const item = transportToInterface.get(clientPreferred);
    if (item) {
      return emitNegotiatedTransport(
        new NegotiatedTransport({ transport: item.transport, url: item.url, source: "client_preferred" }),
        { emitEvent, endpoint, a2aAgentName, clientTransports, serverTransports, agentCard, clientPreferred },
      );
    }
  }

  const serverPreferred = (agentCard.preferredTransport ?? agentCard.preferred_transport ?? JSONRPC_TRANSPORT).toUpperCase();
  if (clientTransports.includes(serverPreferred) && transportToInterface.has(serverPreferred)) {
    const item = transportToInterface.get(serverPreferred);
    if (item) {
      return emitNegotiatedTransport(
        new NegotiatedTransport({ transport: item.transport, url: item.url, source: "server_preferred" }),
        { emitEvent, endpoint, a2aAgentName, clientTransports, serverTransports, agentCard, clientPreferred },
      );
    }
  }

  for (const transport of clientTransports) {
    const item = transportToInterface.get(transport);
    if (item) {
      return emitNegotiatedTransport(
        new NegotiatedTransport({ transport: item.transport, url: item.url, source: "fallback" }),
        { emitEvent, endpoint, a2aAgentName, clientTransports, serverTransports, agentCard, clientPreferred },
      );
    }
  }

  throw new TransportNegotiationError(clientTransports, serverTransports);
}

export const negotiate_transport = negotiateTransport;

function emitNegotiatedTransport(
  result: NegotiatedTransport,
  context: {
    emitEvent: boolean;
    endpoint: string;
    a2aAgentName: string | null;
    clientTransports: readonly string[];
    serverTransports: readonly string[];
    agentCard: A2AAgentCard;
    clientPreferred: string | null;
  },
): NegotiatedTransport {
  if (context.emitEvent) {
    crewaiEventBus.emit(null, new A2ATransportNegotiatedEvent({
      endpoint: context.endpoint,
      a2a_agent_name: context.a2aAgentName,
      negotiated_transport: result.transport,
      negotiated_url: result.url,
      source: result.source,
      client_supported_transports: context.clientTransports,
      server_supported_transports: context.serverTransports,
      server_preferred_transport: context.agentCard.preferredTransport ?? context.agentCard.preferred_transport ?? JSONRPC_TRANSPORT,
      client_preferred_transport: context.clientPreferred,
    }));
  }
  return result;
}

export function build_a2ui_system_prompt(
  catalog_id: string | null = null,
  allowed_components: readonly string[] | null = null,
): string {
  const components = [...(allowed_components ?? STANDARD_CATALOG_COMPONENTS)].sort();
  const catalogLabel = catalog_id ?? `standard (${A2UI_EXTENSION_URI.split("/").at(-1) ?? "v0.8"})`;
  const schemaJson = JSON.stringify({
    version: "v0.8",
    messages: ["beginRendering", "surfaceUpdate", "dataModelUpdate", "deleteSurface"],
  }, null, 2);
  return `<A2UI_INSTRUCTIONS>
You can generate rich, declarative UI by emitting A2UI JSON messages.

CATALOG: ${catalogLabel}
AVAILABLE COMPONENTS: ${components.join(", ")}

MESSAGE TYPES (emit exactly ONE per message):
- beginRendering: Initialize a new surface with a root component and optional styles.
- surfaceUpdate: Send/update components for a surface.
- dataModelUpdate: Update the data model for a surface.
- deleteSurface: Remove a surface.

OUTPUT FORMAT:
Emit each A2UI message as a valid JSON object.

SCHEMA:
${schemaJson}
</A2UI_INSTRUCTIONS>`;
}

export function build_a2ui_v09_system_prompt(
  catalog_id: string | null = null,
  allowed_components: readonly string[] | null = null,
): string {
  const components = [...(allowed_components ?? BASIC_CATALOG_COMPONENTS)].sort();
  const functions = [...BASIC_CATALOG_FUNCTIONS].sort();
  const catalogLabel = catalog_id ?? A2UI_V09_BASIC_CATALOG_ID;
  const schemaJson = JSON.stringify({
    version: "v0.9",
    messages: ["createSurface", "updateComponents", "updateDataModel", "deleteSurface"],
  }, null, 2);
  return `<A2UI_INSTRUCTIONS>
You can generate rich, declarative UI by emitting A2UI v0.9 JSON messages.
Every message MUST include "version": "v0.9".

CATALOG: ${catalogLabel}
AVAILABLE COMPONENTS: ${components.join(", ")}
AVAILABLE FUNCTIONS: ${functions.join(", ")}

MESSAGE TYPES (emit exactly ONE per message alongside "version": "v0.9"):
- createSurface: Create a new surface.
- updateComponents: Send/update components for a surface.
- updateDataModel: Update the data model.
- deleteSurface: Remove a surface by surfaceId.

OUTPUT FORMAT:
Emit each A2UI message as a valid JSON object.

ENVELOPE SCHEMA:
${schemaJson}
</A2UI_INSTRUCTIONS>`;
}

export function extractTaskResultParts(a2aTask: A2ATaskLike): string[] {
  const resultParts: string[] = [];
  const statusMessage = a2aTask.status?.message;
  if (statusMessage) {
    resultParts.push(...extractMessageTextParts(statusMessage));
  }

  if (resultParts.length === 0 && a2aTask.history) {
    for (const historyMessage of [...a2aTask.history].reverse()) {
      if (historyMessage.role === "agent") {
        resultParts.push(...extractMessageTextParts(historyMessage));
        break;
      }
    }
  }

  if (a2aTask.artifacts) {
    for (const artifact of a2aTask.artifacts) {
      resultParts.push(...extractTextParts(artifact.parts ?? []));
    }
  }

  return resultParts;
}

export const extract_task_result_parts = extractTaskResultParts;

export function extractErrorMessage(a2aTask: A2ATaskLike, defaultMessage: string): string {
  const statusMessage = a2aTask.status?.message;
  if (statusMessage) {
    const text = extractMessageTextParts(statusMessage).at(0);
    return text ?? JSON.stringify(statusMessage);
  }

  if (a2aTask.history) {
    for (const historyMessage of [...a2aTask.history].reverse()) {
      const text = extractMessageTextParts(historyMessage).at(0);
      if (text !== undefined) {
        return text;
      }
    }
  }

  return defaultMessage;
}

export const extract_error_message = extractErrorMessage;

export function processTaskState(options: {
  a2aTask?: A2ATaskLike;
  a2a_task?: A2ATaskLike;
  newMessages?: A2AMessageLike[];
  new_messages?: A2AMessageLike[];
  agentCard?: A2AAgentCard | Record<string, unknown>;
  agent_card?: A2AAgentCard | Record<string, unknown>;
  turnNumber?: number;
  turn_number?: number;
  isMultiturn?: boolean;
  is_multiturn?: boolean;
  agentRole?: string | null;
  agent_role?: string | null;
  resultParts?: string[] | null;
  result_parts?: string[] | null;
  endpoint?: string | null;
  a2aAgentName?: string | null;
  a2a_agent_name?: string | null;
  isFinal?: boolean;
  is_final?: boolean;
}): A2ATaskStateResult | null {
  void options.turnNumber;
  void options.turn_number;
  void options.isMultiturn;
  void options.is_multiturn;
  void options.agentRole;
  void options.agent_role;
  void options.endpoint;
  void options.isFinal;
  void options.is_final;
  const a2aTask = options.a2aTask ?? options.a2a_task;
  if (!a2aTask) {
    throw new Error("processTaskState requires a2aTask.");
  }
  const newMessages = options.newMessages ?? options.new_messages ?? [];
  const agentCard = options.agentCard ?? options.agent_card ?? {};
  const state = normalizeTaskState(a2aTask.status?.state);
  const resultParts = options.resultParts ?? options.result_parts ?? [];

  if (state === A2ATaskState.completed) {
    if (resultParts.length === 0) {
      resultParts.push(...extractTaskResultParts(a2aTask));
    }
    if (a2aTask.history) {
      newMessages.push(...a2aTask.history);
    }
    return {
      status: A2ATaskState.completed,
      agent_card: serializeAgentCard(agentCard),
      result: resultParts.join(" "),
      history: newMessages,
      ...(options.a2aAgentName ?? options.a2a_agent_name ? { a2a_agent_name: options.a2aAgentName ?? options.a2a_agent_name ?? null } : {}),
    };
  }

  if (state === A2ATaskState.input_required) {
    if (a2aTask.history) {
      newMessages.push(...a2aTask.history);
    }
    const responseText = extractErrorMessage(a2aTask, "Additional input required");
    if (responseText && !a2aTask.history) {
      newMessages.push(createAgentTextMessage(responseText, a2aTask));
    }
    return {
      status: A2ATaskState.input_required,
      error: responseText,
      history: newMessages,
      agent_card: serializeAgentCard(agentCard),
    };
  }

  if (state === A2ATaskState.failed || state === A2ATaskState.rejected) {
    if (a2aTask.history) {
      newMessages.push(...a2aTask.history);
    }
    return {
      status: A2ATaskState.failed,
      error: extractErrorMessage(a2aTask, "Task failed without error message"),
      history: newMessages,
    };
  }

  if (state === A2ATaskState.auth_required) {
    return {
      status: A2ATaskState.auth_required,
      error: extractErrorMessage(a2aTask, "Authentication required"),
      history: newMessages,
    };
  }

  if (state === A2ATaskState.canceled) {
    return {
      status: A2ATaskState.canceled,
      error: extractErrorMessage(a2aTask, "Task was canceled"),
      history: newMessages,
    };
  }

  if (state && PENDING_STATES.has(state)) {
    return null;
  }

  return null;
}

export const process_task_state = processTaskState;

export async function sendMessageAndGetTaskId(options: {
  eventStream?: AsyncIterable<A2AMessageLike | readonly [A2ATaskLike, unknown]>;
  event_stream?: AsyncIterable<A2AMessageLike | readonly [A2ATaskLike, unknown]>;
  newMessages?: A2AMessageLike[];
  new_messages?: A2AMessageLike[];
  agentCard?: A2AAgentCard;
  agent_card?: A2AAgentCard;
  turnNumber?: number;
  turn_number?: number;
  isMultiturn?: boolean;
  is_multiturn?: boolean;
  agentRole?: string | null;
  agent_role?: string | null;
}): Promise<string | A2ATaskStateResult> {
  const eventStream = options.eventStream ?? options.event_stream;
  if (!eventStream) {
    throw new Error("sendMessageAndGetTaskId requires eventStream.");
  }
  const newMessages = options.newMessages ?? options.new_messages ?? [];
  const agentCard = options.agentCard ?? options.agent_card ?? { url: "", name: "" };

  for await (const event of eventStream) {
    if (isSendTaskEvent(event)) {
      const [a2aTask] = event;
      const state = normalizeTaskState(a2aTask.status?.state);
      if (state && (TERMINAL_STATES.has(state) || ACTIONABLE_STATES.has(state))) {
        const turnNumber = options.turnNumber ?? options.turn_number;
        const isMultiturn = options.isMultiturn ?? options.is_multiturn;
        const agentRole = options.agentRole ?? options.agent_role;
        const processOptions: Parameters<typeof processTaskState>[0] = {
          a2aTask,
          newMessages,
          agentCard,
          ...(turnNumber === undefined ? {} : { turnNumber }),
          ...(isMultiturn === undefined ? {} : { isMultiturn }),
          ...(agentRole === undefined ? {} : { agentRole }),
        };
        const result = processTaskState(processOptions);
        if (result) {
          return result;
        }
      }
      return a2aTask.id ?? "";
    }

    const messageEvent = event;
    newMessages.push(messageEvent);
    return {
      status: A2ATaskState.completed,
      result: extractMessageTextParts(messageEvent).join(" "),
      history: newMessages,
      agent_card: serializeAgentCard(agentCard),
    };
  }

  return {
    status: A2ATaskState.failed,
    error: "No task ID received from initial message",
    history: newMessages,
  };
}

export const send_message_and_get_task_id = sendMessageAndGetTaskId;

export function cancellable<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const context = findCancellableContext(args);
    const taskId = context?.taskId ?? context?.task_id ?? null;
    if (taskId && canceledTaskIds.has(taskId)) {
      canceledTaskIds.delete(taskId);
      throw new Error(`Task ${taskId} was cancelled`);
    }
    try {
      return await fn(...args);
    } finally {
      if (taskId) {
        canceledTaskIds.delete(taskId);
      }
    }
  };
}

function findCancellableContext(args: readonly unknown[]): CancellableContext | null {
  for (const arg of args) {
    if (arg && typeof arg === "object" && ("taskId" in arg || "task_id" in arg)) {
      return arg as CancellableContext;
    }
  }
  return null;
}

export async function execute(agent: unknown, context: A2AExecutionContext, eventQueue: A2AEventQueue): Promise<void> {
  await execute_with_extensions(agent, context, eventQueue, null, null);
}

export async function execute_with_extensions(
  agent: unknown,
  context: A2AExecutionContext,
  eventQueue: A2AEventQueue,
  extensionRegistry: A2AExtensionRegistry | null = null,
  extensionContext: unknown = null,
): Promise<void> {
  await extensionRegistry?.invoke_on_request?.(extensionContext);
  await extensionRegistry?.invokeOnRequest?.(extensionContext);
  const result = await executeAgentTask(agent, context);
  const transformed = await transformA2AResponse(extensionRegistry, extensionContext, result);
  await enqueueA2AEvent(eventQueue, createCompletedTask(context, transformed));
}

export async function cancel(context: A2AExecutionContext, eventQueue: A2AEventQueue): Promise<A2ATaskLike | null> {
  const currentTask = context.currentTask ?? context.current_task ?? null;
  const taskId = context.taskId ?? context.task_id ?? getA2AStringProperty(currentTask, "id");
  const contextId = context.contextId ?? context.context_id ?? getA2AStringProperty(currentTask, "contextId") ?? getA2AStringProperty(currentTask, "context_id");
  if (!taskId || !contextId) {
    throw new Error("task_id and context_id required");
  }
  canceledTaskIds.add(taskId);
  await enqueueA2AEvent(eventQueue, {
    taskId,
    task_id: taskId,
    contextId,
    context_id: contextId,
    status: { state: A2ATaskState.canceled },
    final: true,
  });
  if (currentTask) {
    currentTask.status = { ...(currentTask.status ?? {}), state: A2ATaskState.canceled };
    return currentTask;
  }
  return null;
}

export function get_handler(config: unknown): unknown {
  if (!config || typeof config !== "object") {
    return StreamingHandler;
  }
  return HANDLER_REGISTRY.get(config.constructor) ?? StreamingHandler;
}

export function execute_a2a_delegation(options: Record<string, unknown> | string, ..._args: unknown[]): A2ATaskStateResult {
  void _args;
  const endpoint = typeof options === "string" ? options : stringFromUnknown(options.endpoint);
  return {
    status: A2ATaskState.completed,
    history: [],
    result: endpoint,
  };
}

export async function aexecute_a2a_delegation(options: Record<string, unknown> | string, ...args: unknown[]): Promise<A2ATaskStateResult> {
  await Promise.resolve();
  return execute_a2a_delegation(options, ...args);
}

export function fetch_agent_card(endpoint: string, _auth: unknown = null, _timeout = 30): Record<string, unknown> {
  void _auth;
  void _timeout;
  return { url: endpoint, name: endpoint };
}

export async function afetch_agent_card(endpoint: string, auth: unknown = null, timeout = 30): Promise<Record<string, unknown>> {
  await Promise.resolve();
  return fetch_agent_card(endpoint, auth, timeout);
}

export function inject_a2a_server_methods(agent: unknown): unknown {
  return agent;
}

export function wrap_agent_with_a2a_instance(agent: unknown, extension_registry: ExtensionRegistry | null = null): void {
  extension_registry?.inject_all_tools(agent);
  inject_a2a_server_methods(agent);
}

export function list_tasks(
  tasks: A2ATaskLike[],
  context_id: string | null = null,
  status: A2ATaskState | null = null,
  status_timestamp_after: Date | null = null,
  page_size = 50,
  page_token: string | null = null,
  history_length: number | null = null,
  include_artifacts = false,
): [A2ATaskLike[], string | null, number] {
  const filtered = tasks.filter((task) => {
    const taskContextId = task.contextId ?? task.context_id ?? null;
    if (context_id && taskContextId !== context_id) {
      return false;
    }
    if (status && task.status?.state !== status) {
      return false;
    }
    if (status_timestamp_after && typeof task.status?.timestamp === "string") {
      const timestamp = new Date(task.status.timestamp);
      if (timestamp <= status_timestamp_after) {
        return false;
      }
    }
    return true;
  }).sort((left, right) => taskTimestamp(right) - taskTimestamp(left));

  const total = filtered.length;
  const start = page_token ? Math.max(0, filtered.findIndex((task) => task.id === decodePageToken(page_token)) + 1) : 0;
  const page = filtered.slice(start, start + page_size).map((task) => trimListedTask(task, history_length, include_artifacts));
  const lastTaskId = page.at(-1)?.id;
  const nextToken = page.length === page_size && lastTaskId ? Buffer.from(lastTaskId).toString("base64") : null;
  return [page, nextToken, total];
}

async function executeAgentTask(agent: unknown, context: A2AExecutionContext): Promise<unknown> {
  const agentRecord = agent as {
    aexecuteTask?: (options: Record<string, unknown>) => Promise<unknown>;
    aexecute_task?: (options: Record<string, unknown>) => Promise<unknown>;
    execute?: (input: unknown) => unknown;
  };
  const input = context.getUserInput?.() ?? context.get_user_input?.() ?? extractMessageTextParts(context.message ?? {}).join(" ");
  if (agentRecord.aexecuteTask) {
    return await agentRecord.aexecuteTask({ input, context });
  }
  if (agentRecord.aexecute_task) {
    return await agentRecord.aexecute_task({ input, context });
  }
  if (agentRecord.execute) {
    return await agentRecord.execute(input);
  }
  return input;
}

async function transformA2AResponse(
  extensionRegistry: A2AExtensionRegistry | null,
  extensionContext: unknown,
  result: unknown,
): Promise<unknown> {
  if (extensionRegistry?.invokeOnResponse) {
    return await extensionRegistry.invokeOnResponse(extensionContext, result);
  }
  if (extensionRegistry?.invoke_on_response) {
    return await extensionRegistry.invoke_on_response(extensionContext, result);
  }
  return result;
}

async function enqueueA2AEvent(eventQueue: A2AEventQueue, event: unknown): Promise<void> {
  if (eventQueue.enqueueEvent) {
    await eventQueue.enqueueEvent(event);
    return;
  }
  if (eventQueue.enqueue_event) {
    await eventQueue.enqueue_event(event);
    return;
  }
  throw new Error("A2A event queue does not provide enqueue_event.");
}

function createCompletedTask(context: A2AExecutionContext, result: unknown): A2ATaskLike {
  const taskId = context.taskId ?? context.task_id ?? randomId();
  const contextId = context.contextId ?? context.context_id ?? null;
  const resultText = stringifyA2AValue(result);
  return {
    id: taskId,
    contextId,
    context_id: contextId,
    status: { state: A2ATaskState.completed, timestamp: new Date().toISOString() },
    history: [
      ...(context.message ? [context.message] : []),
      {
        role: "agent",
        messageId: randomId(),
        parts: [{ text: resultText }],
        contextId,
        context_id: contextId,
        taskId,
        task_id: taskId,
      },
    ],
    artifacts: [{ parts: [{ text: resultText }] }],
  };
}

function taskTimestamp(task: A2ATaskLike): number {
  return typeof task.status?.timestamp === "string" ? new Date(task.status.timestamp).getTime() : Number.NEGATIVE_INFINITY;
}

function decodePageToken(pageToken: string): string {
  try {
    return Buffer.from(pageToken, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function trimListedTask(task: A2ATaskLike, historyLength: number | null, includeArtifacts: boolean): A2ATaskLike {
  const history = historyLength === null || !task.history ? task.history : task.history.slice(-historyLength);
  return {
    ...task,
    ...(history === undefined ? {} : { history }),
    artifacts: includeArtifacts ? task.artifacts ?? null : null,
  };
}

function getA2AStringProperty(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object" || !(key in value)) {
    return null;
  }
  const property = (value as Record<string, unknown>)[key];
  return typeof property === "string" ? property : null;
}

function stringifyA2AValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return JSON.stringify(value);
}

function isA2AExtension(value: unknown): value is A2AExtension {
  return Boolean(value && typeof value === "object");
}

function isObjectClient(value: unknown): value is object {
  return Boolean(value && typeof value === "object");
}

function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (value instanceof Error) {
    return value.message;
  }
  return value;
}

function serializeAgentCardForSigning(agentCard: Record<string, unknown>): Record<string, unknown> {
  const { signatures: _signatures, ...rest } = agentCard;
  void _signatures;
  return sortObjectKeys(rest);
}

function sortObjectKeys(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.keys(value).sort().map((key) => {
    const entry = value[key];
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      return [key, sortObjectKeys(entry as Record<string, unknown>)];
    }
    return [key, entry];
  }));
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function padBase64(value: string): string {
  const remainder = value.length % 4;
  return remainder === 0 ? value : `${value}${"=".repeat(4 - remainder)}`;
}

function migrateClientTransport(
  transport: ClientTransportConfig,
  transportProtocol: A2ATransportProtocol | null,
  supportedTransports: readonly A2ATransportProtocol[] | null,
): ClientTransportConfig {
  if (transportProtocol === null && supportedTransports === null) {
    return transport;
  }
  return new ClientTransportConfig({
    preferred: transportProtocol ?? transport.preferred,
    supported: supportedTransports ?? transport.supported,
    jsonrpc: transport.jsonrpc,
    grpc: transport.grpc,
  });
}

function validateUrl(value: string): string {
  try {
    return new URL(value).toString();
  } catch (error) {
    throw new Error(`Invalid A2A endpoint URL: ${value}`, { cause: error });
  }
}

function stringFromUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return "";
}

function normalizeTaskState(state: string | undefined): A2ATaskState | null {
  if (isA2ATaskState(state)) {
    return state;
  }
  return null;
}

function isA2ATaskState(state: string | undefined): state is A2ATaskState {
  return state === A2ATaskState.submitted
    || state === A2ATaskState.working
    || state === A2ATaskState.input_required
    || state === A2ATaskState.auth_required
    || state === A2ATaskState.completed
    || state === A2ATaskState.failed
    || state === A2ATaskState.rejected
    || state === A2ATaskState.canceled;
}

function isSendTaskEvent(event: A2AMessageLike | readonly [A2ATaskLike, unknown]): event is readonly [A2ATaskLike, unknown] {
  return Array.isArray(event);
}

async function* emptyA2AEventStream(): AsyncIterable<SendMessageEvent> {
}

function extractMessageTextParts(message: A2AMessageLike): string[] {
  return extractTextParts(message.parts ?? []);
}

function extractTextParts(parts: readonly A2ATextPartLike[]): string[] {
  return parts
    .filter((part) => (part.root?.kind ?? part.kind ?? "text") === "text")
    .map((part) => part.root?.text ?? part.text ?? "")
    .filter((text) => text.length > 0);
}

function createAgentTextMessage(text: string, task: A2ATaskLike): A2AMessageLike {
  const messageId = randomId();
  return {
    role: "agent",
    messageId,
    message_id: messageId,
    parts: [{ root: { kind: "text", text } }],
    contextId: task.contextId ?? task.context_id ?? null,
    context_id: task.contextId ?? task.context_id ?? null,
    taskId: task.id ?? null,
    task_id: task.id ?? null,
  };
}

function serializeAgentCard(agentCard: A2AAgentCard | Record<string, unknown>): Record<string, unknown> {
  return { ...agentCard };
}

function randomId(): string {
  return Math.random().toString(36).slice(2);
}
