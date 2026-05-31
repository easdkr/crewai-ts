import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import {
  MCPConnectionCompletedEvent,
  MCPConnectionFailedEvent,
  MCPConnectionStartedEvent,
  MCPToolExecutionCompletedEvent,
  MCPToolExecutionFailedEvent,
  MCPToolExecutionStartedEvent,
  crewaiEventBus,
} from "./events.js";
import { sanitizeToolName } from "./string-utils.js";
import { MCPNativeTool, MCPToolWrapper, type BaseTool } from "./tools.js";

export const TransportType = {
  STDIO: "stdio",
  HTTP: "http",
  STREAMABLE_HTTP: "streamable-http",
  SSE: "sse",
} as const;

export type TransportType = typeof TransportType[keyof typeof TransportType];
export type MCPToolDefinition = Record<string, unknown> & { name?: string };
export const MCPReadStream = Object.freeze({ kind: "MCPReadStream" });
export const MCPWriteStream = Object.freeze({ kind: "MCPWriteStream" });
export type ToolFilterContextOptions = {
  agent: unknown;
  serverName?: string;
  server_name?: string;
  runContext?: Record<string, unknown> | null;
  run_context?: Record<string, unknown> | null;
};

export class ToolFilterContext {
  readonly agent: unknown;
  readonly serverName: string;
  readonly server_name: string;
  readonly runContext: Record<string, unknown> | null;
  readonly run_context: Record<string, unknown> | null;

  constructor(options: ToolFilterContextOptions) {
    this.agent = options.agent;
    this.serverName = options.serverName ?? options.server_name ?? "";
    this.server_name = this.serverName;
    this.runContext = options.runContext ?? options.run_context ?? null;
    this.run_context = this.runContext;
  }
}

type MaybePromise<T> = T | Promise<T>;

export type ToolFilter =
  | ((tool: MCPToolDefinition) => MaybePromise<boolean>)
  | ((context: ToolFilterContext, tool: MCPToolDefinition) => MaybePromise<boolean>);
export const ToolFilter = Object.freeze({ kind: "ToolFilter" });

export class StaticToolFilter {
  readonly allowedToolNames: ReadonlySet<string>;
  readonly allowed_tool_names: ReadonlySet<string>;
  readonly blockedToolNames: ReadonlySet<string>;
  readonly blocked_tool_names: ReadonlySet<string>;

  constructor(options: {
    allowedToolNames?: readonly string[] | null;
    allowed_tool_names?: readonly string[] | null;
    blockedToolNames?: readonly string[] | null;
    blocked_tool_names?: readonly string[] | null;
  } = {}) {
    this.allowedToolNames = new Set(options.allowedToolNames ?? options.allowed_tool_names ?? []);
    this.allowed_tool_names = this.allowedToolNames;
    this.blockedToolNames = new Set(options.blockedToolNames ?? options.blocked_tool_names ?? []);
    this.blocked_tool_names = this.blockedToolNames;
  }

  filter(tool: MCPToolDefinition): boolean {
    const toolName = typeof tool.name === "string" ? tool.name : "";
    if (this.blockedToolNames.size > 0 && this.blockedToolNames.has(toolName)) {
      return false;
    }
    if (this.allowedToolNames.size > 0) {
      return this.allowedToolNames.has(toolName);
    }
    return true;
  }

  call(tool: MCPToolDefinition): boolean {
    return this.filter(tool);
  }

  __call__(tool: MCPToolDefinition): boolean {
    return this.filter(tool);
  }
}

export function createStaticToolFilter(
  allowedToolNames: readonly string[] | null = null,
  blockedToolNames: readonly string[] | null = null,
): (tool: MCPToolDefinition) => boolean {
  const filter = new StaticToolFilter({ allowedToolNames, blockedToolNames });
  return (tool) => filter.filter(tool);
}

export const create_static_tool_filter = createStaticToolFilter;

export function createDynamicToolFilter<TFilter extends (context: ToolFilterContext, tool: MCPToolDefinition) => MaybePromise<boolean>>(
  filterFunc: TFilter,
): TFilter {
  return filterFunc;
}

export const create_dynamic_tool_filter = createDynamicToolFilter;

export type MCPServerStdioOptions = {
  command: string;
  args?: readonly string[];
  env?: Record<string, string> | null;
  toolFilter?: ToolFilter | null;
  tool_filter?: ToolFilter | null;
  cacheToolsList?: boolean;
  cache_tools_list?: boolean;
};

export class MCPServerStdio {
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Record<string, string> | null;
  readonly toolFilter: ToolFilter | null;
  readonly tool_filter: ToolFilter | null;
  readonly cacheToolsList: boolean;
  readonly cache_tools_list: boolean;

  constructor(options: MCPServerStdioOptions) {
    this.command = options.command;
    this.args = options.args ? [...options.args] : [];
    this.env = options.env ? { ...options.env } : null;
    this.toolFilter = options.toolFilter ?? options.tool_filter ?? null;
    this.tool_filter = this.toolFilter;
    this.cacheToolsList = options.cacheToolsList ?? options.cache_tools_list ?? false;
    this.cache_tools_list = this.cacheToolsList;
  }
}

export type MCPServerHTTPOptions = {
  url: string;
  headers?: Record<string, string> | null;
  streamable?: boolean;
  toolFilter?: ToolFilter | null;
  tool_filter?: ToolFilter | null;
  cacheToolsList?: boolean;
  cache_tools_list?: boolean;
};

export class MCPServerHTTP {
  readonly url: string;
  readonly headers: Record<string, string> | null;
  readonly streamable: boolean;
  readonly toolFilter: ToolFilter | null;
  readonly tool_filter: ToolFilter | null;
  readonly cacheToolsList: boolean;
  readonly cache_tools_list: boolean;

  constructor(options: MCPServerHTTPOptions) {
    this.url = options.url;
    this.headers = options.headers ? { ...options.headers } : null;
    this.streamable = options.streamable ?? true;
    this.toolFilter = options.toolFilter ?? options.tool_filter ?? null;
    this.tool_filter = this.toolFilter;
    this.cacheToolsList = options.cacheToolsList ?? options.cache_tools_list ?? false;
    this.cache_tools_list = this.cacheToolsList;
  }
}

export type MCPServerSSEOptions = {
  url: string;
  headers?: Record<string, string> | null;
  toolFilter?: ToolFilter | null;
  tool_filter?: ToolFilter | null;
  cacheToolsList?: boolean;
  cache_tools_list?: boolean;
};

export class MCPServerSSE {
  readonly url: string;
  readonly headers: Record<string, string> | null;
  readonly toolFilter: ToolFilter | null;
  readonly tool_filter: ToolFilter | null;
  readonly cacheToolsList: boolean;
  readonly cache_tools_list: boolean;

  constructor(options: MCPServerSSEOptions) {
    this.url = options.url;
    this.headers = options.headers ? { ...options.headers } : null;
    this.toolFilter = options.toolFilter ?? options.tool_filter ?? null;
    this.tool_filter = this.toolFilter;
    this.cacheToolsList = options.cacheToolsList ?? options.cache_tools_list ?? false;
    this.cache_tools_list = this.cacheToolsList;
  }
}

export type MCPServerConfig = MCPServerStdio | MCPServerHTTP | MCPServerSSE;
export const MCPServerConfig = Object.freeze({ kind: "MCPServerConfig" });

export abstract class BaseTransport {
  protected readStreamValue: unknown = null;
  protected writeStreamValue: unknown = null;
  protected connectedValue = false;
  protected sdkTransportValue: Transport | null = null;

  abstract get transportType(): TransportType;
  protected abstract createSdkTransport(): Transport;

  get transport_type(): TransportType {
    return this.transportType;
  }

  get connected(): boolean {
    return this.connectedValue;
  }

  get readStream(): unknown {
    if (this.readStreamValue === null) {
      throw new Error("Transport not connected. Call connect() first.");
    }
    return this.readStreamValue;
  }

  get read_stream(): unknown {
    return this.readStream;
  }

  get writeStream(): unknown {
    if (this.writeStreamValue === null) {
      throw new Error("Transport not connected. Call connect() first.");
    }
    return this.writeStreamValue;
  }

  get write_stream(): unknown {
    return this.writeStream;
  }

  async connect(): Promise<this> {
    if (this.connectedValue) {
      return this;
    }
    const transport = this.getSdkTransport();
    await transport.start();
    this.setStreams(transport, transport);
    return this;
  }

  async disconnect(): Promise<void> {
    const transport = this.sdkTransportValue;
    this.clearStreams();
    if (transport) {
      await transport.close();
    }
  }

  async aenter(): Promise<this> {
    return await this.connect();
  }

  async __aenter__(): Promise<this> {
    return await this.aenter();
  }

  async aexit(_excType: unknown = null, _excVal: unknown = null, _excTb: unknown = null): Promise<void> {
    void _excType;
    void _excVal;
    void _excTb;
    await this.disconnect();
  }

  async __aexit__(excType: unknown = null, excVal: unknown = null, excTb: unknown = null): Promise<void> {
    await this.aexit(excType, excVal, excTb);
  }

  protected setStreams(read: unknown, write: unknown): void {
    this.readStreamValue = read;
    this.writeStreamValue = write;
    this.connectedValue = true;
  }

  protected clearStreams(): void {
    this.readStreamValue = null;
    this.writeStreamValue = null;
    this.connectedValue = false;
  }

  markConnectedForClient(): void {
    const transport = this.getSdkTransport();
    this.setStreams(transport, transport);
  }

  clearConnectedForClient(): void {
    this.clearStreams();
    this.sdkTransportValue = null;
  }

  getSdkTransport(): Transport {
    this.sdkTransportValue ??= this.createSdkTransport();
    return this.sdkTransportValue;
  }
}

export class HTTPTransport extends BaseTransport {
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly streamable: boolean;

  constructor(options: MCPServerHTTPOptions | string, headers: Record<string, string> | null = null, streamable = true) {
    super();
    if (typeof options === "string") {
      this.url = options;
      this.headers = headers ? { ...headers } : {};
      this.streamable = streamable;
    } else {
      this.url = options.url;
      this.headers = options.headers ? { ...options.headers } : {};
      this.streamable = options.streamable ?? true;
    }
  }

  get transportType(): TransportType {
    return this.streamable ? TransportType.STREAMABLE_HTTP : TransportType.HTTP;
  }

  protected createSdkTransport(): Transport {
    const headers = { ...this.headers };
    const options = Object.keys(headers).length > 0 ? { requestInit: { headers } } : undefined;
    return new StreamableHTTPClientTransport(new URL(this.url), options) as unknown as Transport;
  }
}

export class SSETransport extends BaseTransport {
  readonly url: string;
  readonly headers: Record<string, string>;

  constructor(options: MCPServerSSEOptions | string, headers: Record<string, string> | null = null) {
    super();
    if (typeof options === "string") {
      this.url = options;
      this.headers = headers ? { ...headers } : {};
    } else {
      this.url = options.url;
      this.headers = options.headers ? { ...options.headers } : {};
    }
  }

  get transportType(): TransportType {
    return TransportType.SSE;
  }

  protected createSdkTransport(): Transport {
    const headers = { ...this.headers };
    const options = Object.keys(headers).length > 0
      ? {
          requestInit: { headers },
          eventSourceInit: {
            fetch: (url: string | URL, init: RequestInit | undefined) => fetch(url, { ...init, headers: { ...headers, ...headersFromInit(init?.headers) } }),
          },
        }
      : undefined;
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return new SSEClientTransport(new URL(this.url), options);
  }
}

export class StdioTransport extends BaseTransport {
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Record<string, string>;

  constructor(options: MCPServerStdioOptions | string, args: readonly string[] | null = null, env: Record<string, string> | null = null) {
    super();
    if (typeof options === "string") {
      this.command = options;
      this.args = args ? [...args] : [];
      this.env = env ? { ...env } : {};
    } else {
      this.command = options.command;
      this.args = options.args ? [...options.args] : [];
      this.env = options.env ? { ...options.env } : {};
    }
  }

  get transportType(): TransportType {
    return TransportType.STDIO;
  }

  protected createSdkTransport(): Transport {
    return new StdioClientTransport({
      command: this.command,
      args: [...this.args],
      env: { ...this.env },
    });
  }
}

export function isMCPServerConfig(value: unknown): value is MCPServerConfig {
  return value instanceof MCPServerStdio
    || value instanceof MCPServerHTTP
    || value instanceof MCPServerSSE;
}

export const is_mcp_server_config = isMCPServerConfig;

export const MCP_CONNECTION_TIMEOUT = 30;
export const MCP_TOOL_EXECUTION_TIMEOUT = 30;
export const MCP_DISCOVERY_TIMEOUT = 30;
export const MCP_MAX_RETRIES = 3;

type SchemaCacheEntry = { tools: MCPToolDefinition[]; createdAt: number };
const MCP_SCHEMA_CACHE_TTL_MS = 300_000;
const mcpSchemaCache = new Map<string, SchemaCacheEntry>();

export type MCPClientOptions = {
  connectTimeout?: number;
  connect_timeout?: number;
  executionTimeout?: number;
  execution_timeout?: number;
  discoveryTimeout?: number;
  discovery_timeout?: number;
  maxRetries?: number;
  max_retries?: number;
  cacheToolsList?: boolean;
  cache_tools_list?: boolean;
};

export class MCPClient {
  readonly transport: BaseTransport;
  readonly connectTimeout: number;
  readonly connect_timeout: number;
  readonly executionTimeout: number;
  readonly execution_timeout: number;
  readonly discoveryTimeout: number;
  readonly discovery_timeout: number;
  readonly maxRetries: number;
  readonly max_retries: number;
  readonly cacheToolsList: boolean;
  readonly cache_tools_list: boolean;
  private client: Client | null = null;
  private initialized = false;
  private wasConnected = false;

  constructor(transport: BaseTransport, options: MCPClientOptions = {}) {
    this.transport = transport;
    this.connectTimeout = options.connectTimeout ?? options.connect_timeout ?? MCP_CONNECTION_TIMEOUT;
    this.connect_timeout = this.connectTimeout;
    this.executionTimeout = options.executionTimeout ?? options.execution_timeout ?? MCP_TOOL_EXECUTION_TIMEOUT;
    this.execution_timeout = this.executionTimeout;
    this.discoveryTimeout = options.discoveryTimeout ?? options.discovery_timeout ?? MCP_DISCOVERY_TIMEOUT;
    this.discovery_timeout = this.discoveryTimeout;
    this.maxRetries = options.maxRetries ?? options.max_retries ?? MCP_MAX_RETRIES;
    this.max_retries = this.maxRetries;
    this.cacheToolsList = options.cacheToolsList ?? options.cache_tools_list ?? false;
    this.cache_tools_list = this.cacheToolsList;
  }

  get connected(): boolean {
    return this.initialized;
  }

  get session(): Client {
    if (!this.client || !this.initialized) {
      throw new Error("Client not connected. Call connect() first.");
    }
    return this.client;
  }

  async connect(): Promise<this> {
    if (this.connected) {
      return this;
    }
    const [serverName, serverUrl, transportType] = this.getServerInfo();
    const startedAt = new Date();
    const isReconnect = this.wasConnected;
    crewaiEventBus.emit(this, new MCPConnectionStartedEvent({
      server_name: serverName,
      server_url: serverUrl,
      transport_type: transportType,
      is_reconnect: isReconnect,
      connect_timeout: this.connectTimeout,
    }));
    try {
      const client = new Client({ name: "@crewai-ts/core", version: "0.0.0" }, { capabilities: {} });
      await withTimeout(client.connect(this.transport.getSdkTransport()), this.connectTimeout, "MCP connection timed out");
      this.client = client;
      this.initialized = true;
      this.wasConnected = true;
      this.transport.markConnectedForClient();
      const completedAt = new Date();
      crewaiEventBus.emit(this, new MCPConnectionCompletedEvent({
        server_name: serverName,
        server_url: serverUrl,
        transport_type: transportType,
        started_at: startedAt,
        completed_at: completedAt,
        connection_duration_ms: completedAt.getTime() - startedAt.getTime(),
        is_reconnect: isReconnect,
      }));
      return this;
    } catch (error) {
      await this.cleanupOnError();
      const failedAt = new Date();
      crewaiEventBus.emit(this, new MCPConnectionFailedEvent({
        server_name: serverName,
        server_url: serverUrl,
        transport_type: transportType,
        error,
        error_type: classifyMCPError(error),
        started_at: startedAt,
        failed_at: failedAt,
      }));
      throw new Error(`Failed to connect to MCP server: ${formatMCPError(error)}`, { cause: error });
    }
  }

  async disconnect(): Promise<void> {
    if (!this.client && !this.transport.connected) {
      return;
    }
    try {
      await this.client?.close();
    } finally {
      this.client = null;
      this.initialized = false;
      this.transport.clearConnectedForClient();
    }
  }

  async aenter(): Promise<this> {
    return await this.connect();
  }

  async __aenter__(): Promise<this> {
    return await this.aenter();
  }

  async aexit(_excType: unknown = null, _excVal: unknown = null, _excTb: unknown = null): Promise<void> {
    void _excType;
    void _excVal;
    void _excTb;
    await this.disconnect();
  }

  async __aexit__(excType: unknown = null, excVal: unknown = null, excTb: unknown = null): Promise<void> {
    await this.aexit(excType, excVal, excTb);
  }

  async listTools(useCache: boolean | null = null): Promise<MCPToolDefinition[]> {
    if (!this.connected) {
      await this.connect();
    }
    const shouldUseCache = useCache ?? this.cacheToolsList;
    const cacheKey = this.getCacheKey("tools");
    if (shouldUseCache) {
      const cached = mcpSchemaCache.get(cacheKey);
      if (cached && Date.now() - cached.createdAt < MCP_SCHEMA_CACHE_TTL_MS) {
        return cached.tools.map((tool) => ({ ...tool }));
      }
    }
    const tools = await this.retryOperation(async () => {
      const result = await withTimeout(this.session.listTools(), this.discoveryTimeout, "MCP tool discovery timed out");
      return result.tools.map((tool) => ({
        name: sanitizeToolName(tool.name),
        original_name: tool.name,
        description: tool.description ?? "",
        inputSchema: tool.inputSchema,
        ...(tool.outputSchema ? { outputSchema: tool.outputSchema } : {}),
        ...(tool.annotations ? { annotations: tool.annotations } : {}),
      }));
    });
    if (shouldUseCache) {
      mcpSchemaCache.set(cacheKey, { tools, createdAt: Date.now() });
    }
    return tools;
  }

  async list_tools(useCache: boolean | null = null): Promise<MCPToolDefinition[]> {
    return await this.listTools(useCache);
  }

  async callTool(toolName: string, args: Record<string, unknown> | null = null): Promise<string> {
    if (!this.connected) {
      await this.connect();
    }
    const cleanedArgs = cleanToolArguments(args ?? {});
    const [serverName, serverUrl, transportType] = this.getServerInfo();
    const startedAt = new Date();
    crewaiEventBus.emit(this, new MCPToolExecutionStartedEvent({
      server_name: serverName,
      server_url: serverUrl,
      transport_type: transportType,
      tool_name: toolName,
      tool_args: cleanedArgs,
    }));
    try {
      const result = await this.retryOperation(async () => {
        return await withTimeout(this.session.callTool({ name: toolName, arguments: cleanedArgs }), this.executionTimeout, "MCP tool execution timed out");
      });
      const content = stringifyMCPToolResult(result);
      const finishedAt = new Date();
      if (isErrorMCPToolResult(result)) {
        crewaiEventBus.emit(this, new MCPToolExecutionFailedEvent({
          server_name: serverName,
          server_url: serverUrl,
          transport_type: transportType,
          tool_name: toolName,
          tool_args: cleanedArgs,
          error: content,
          error_type: "tool_error",
          started_at: startedAt,
          failed_at: finishedAt,
        }));
      } else {
        crewaiEventBus.emit(this, new MCPToolExecutionCompletedEvent({
          server_name: serverName,
          server_url: serverUrl,
          transport_type: transportType,
          tool_name: toolName,
          tool_args: cleanedArgs,
          result: content,
          started_at: startedAt,
          completed_at: finishedAt,
          execution_duration_ms: finishedAt.getTime() - startedAt.getTime(),
        }));
      }
      return content;
    } catch (error) {
      const failedAt = new Date();
      crewaiEventBus.emit(this, new MCPToolExecutionFailedEvent({
        server_name: serverName,
        server_url: serverUrl,
        transport_type: transportType,
        tool_name: toolName,
        tool_args: cleanedArgs,
        error,
        error_type: classifyMCPError(error),
        started_at: startedAt,
        failed_at: failedAt,
      }));
      throw error;
    }
  }

  async call_tool(toolName: string, args: Record<string, unknown> | null = null): Promise<string> {
    return await this.callTool(toolName, args);
  }

  async listPrompts(): Promise<Record<string, unknown>[]> {
    if (!this.connected) {
      await this.connect();
    }
    const result = await this.retryOperation(async () => await this.session.listPrompts());
    return result.prompts.map((prompt) => ({
      name: typeof prompt.name === "string" ? prompt.name : "",
      description: typeof prompt.description === "string" ? prompt.description : "",
      arguments: Array.isArray(prompt.arguments) ? prompt.arguments : [],
    }));
  }

  async list_prompts(): Promise<Record<string, unknown>[]> {
    return await this.listPrompts();
  }

  async getPrompt(name: string, args: Record<string, string> | null = null): Promise<unknown> {
    if (!this.connected) {
      await this.connect();
    }
    const argumentsObject = args ?? {};
    const result = await this.retryOperation(async () => await this.session.getPrompt({ name, arguments: argumentsObject }));
    const messages = isPlainRecord(result) && Array.isArray(result.messages)
      ? result.messages.map((message) => normalizePromptMessage(message))
      : [];
    return {
      name,
      messages,
      arguments: argumentsObject,
    };
  }

  async get_prompt(name: string, args: Record<string, string> | null = null): Promise<unknown> {
    return await this.getPrompt(name, args);
  }

  async listResources(): Promise<Record<string, unknown>[]> {
    if (!this.connected) {
      await this.connect();
    }
    const result = await this.retryOperation(async () => await this.session.listResources());
    return result.resources.map((resource) => ({ ...resource }));
  }

  async list_resources(): Promise<Record<string, unknown>[]> {
    return await this.listResources();
  }

  async readResource(uri: string): Promise<unknown> {
    if (!this.connected) {
      await this.connect();
    }
    return await this.retryOperation(async () => await this.session.readResource({ uri }));
  }

  async read_resource(uri: string): Promise<unknown> {
    return await this.readResource(uri);
  }

  private getServerInfo(): [string, string | null, string] {
    if (this.transport instanceof StdioTransport) {
      return [[this.transport.command, ...this.transport.args].join(" "), null, this.transport.transportType];
    }
    if (this.transport instanceof HTTPTransport || this.transport instanceof SSETransport) {
      return [this.transport.url, this.transport.url, this.transport.transportType];
    }
    return ["Unknown MCP Server", null, this.transport.transportType];
  }

  private getCacheKey(kind: string): string {
    const [serverName, serverUrl, transportType] = this.getServerInfo();
    return JSON.stringify([kind, transportType, serverName, serverUrl]);
  }

  private async retryOperation<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < this.maxRetries; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < this.maxRetries - 1) {
          await delay(Math.min(100 * 2 ** attempt, 1000));
        }
      }
    }
    throw lastError;
  }

  private async cleanupOnError(): Promise<void> {
    this.client = null;
    this.initialized = false;
    await this.transport.disconnect();
  }
}

export type MCPToolResolverOptions = {
  agent?: unknown;
  logger?: { log(level: string, message: string): void } | null;
};

export class MCPToolResolver {
  private readonly agent: unknown;
  private readonly logger: { log(level: string, message: string): void } | null;
  private readonly clientsValue: MCPClient[] = [];

  constructor(options?: MCPToolResolverOptions);
  constructor(agent: unknown, logger?: { log(level: string, message: string): void } | null);
  constructor(
    optionsOrAgent: unknown = {},
    logger: { log(level: string, message: string): void } | null = null,
  ) {
    if (isResolverOptions(optionsOrAgent)) {
      this.agent = optionsOrAgent.agent;
      this.logger = optionsOrAgent.logger ?? null;
    } else {
      this.agent = optionsOrAgent;
      this.logger = logger;
    }
  }

  get clients(): MCPClient[] {
    return [...this.clientsValue];
  }

  async resolve(mcps: readonly (string | MCPServerConfig)[] | null | undefined): Promise<BaseTool[]> {
    if (!mcps) {
      return [];
    }
    const tools: BaseTool[] = [];
    for (const config of mcps) {
      if (typeof config === "string") {
        if (config.startsWith("https://")) {
          tools.push(...await this.resolveExternal(config));
        } else {
          this.log("debug", `AMP MCP reference '${config}' is not available in the local TypeScript runtime.`);
        }
        continue;
      }
      tools.push(...await this.resolveNative(config));
    }
    return tools;
  }

  async cleanup(): Promise<void> {
    const clients = this.clientsValue.splice(0);
    for (const client of clients) {
      try {
        await client.disconnect();
      } catch (error) {
        this.log("error", `Error during MCP client cleanup: ${formatMCPError(error)}`);
      }
    }
  }

  private async resolveNative(config: MCPServerConfig): Promise<BaseTool[]> {
    const serverName = serverNameForConfig(config);
    const clientOptions = {
      cacheToolsList: config.cacheToolsList,
      cache_tools_list: config.cache_tools_list,
    };
    const discoveryClient = new MCPClient(transportForConfig(config), clientOptions);
    try {
      await discoveryClient.connect();
      const definitions = await discoveryClient.listTools();
      const tools: BaseTool[] = [];
      for (const definition of definitions) {
        if (!await passesToolFilter(config, definition, this.agent)) {
          continue;
        }
        const originalName = typeof definition.original_name === "string"
          ? definition.original_name
          : typeof definition.name === "string" ? definition.name : "";
        const sanitizedName = sanitizeToolName(originalName);
        tools.push(new MCPNativeTool({
          clientFactory: () => new MCPClient(transportForConfig(config), clientOptions),
          toolName: sanitizedName,
          originalToolName: originalName,
          toolSchema: definition,
          serverName,
        }));
      }
      return tools;
    } finally {
      await discoveryClient.disconnect();
    }
  }

  private async resolveExternal(mcpRef: string): Promise<BaseTool[]> {
    const [serverUrl, specificTool] = splitMCPRef(mcpRef);
    const serverName = extractServerName(serverUrl);
    const client = new MCPClient(new HTTPTransport({ url: serverUrl }));
    try {
      await client.connect();
      const definitions = await client.listTools();
      const sanitizedSpecificTool = specificTool ? sanitizeToolName(specificTool) : null;
      return definitions
        .filter((definition) => {
          const toolName = typeof definition.name === "string" ? definition.name : "";
          return !sanitizedSpecificTool || sanitizeToolName(toolName) === sanitizedSpecificTool;
        })
        .map((definition) => {
          const originalName = typeof definition.original_name === "string"
            ? definition.original_name
            : typeof definition.name === "string" ? definition.name : "";
          return new MCPToolWrapper({
            mcpServerParams: { url: serverUrl },
            toolName: sanitizeToolName(originalName),
            toolSchema: definition,
            serverName,
          });
        });
    } finally {
      await client.disconnect();
    }
  }

  private log(level: string, message: string): void {
    this.logger?.log(level, message);
  }
}

export const mcp_schema_cache = mcpSchemaCache;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutSeconds: number, message: string): Promise<T> {
  const timeoutRef: { current?: ReturnType<typeof setTimeout> } = {};
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeoutRef.current = setTimeout(() => {
          reject(new Error(`${message} after ${String(timeoutSeconds)} seconds.`));
        }, timeoutSeconds * 1000);
      }),
    ]);
  } finally {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }
}

function cleanToolArguments(argumentsObject: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(argumentsObject)) {
    if (value === null || value === undefined) {
      continue;
    }
    if (key === "sources" && Array.isArray(value)) {
      const sourceValues: unknown[] = value;
      const sources = sourceValues
        .filter((item) => item !== null && item !== undefined)
        .map((item) => typeof item === "string" ? { type: item } : item);
      if (sources.length > 0) {
        cleaned[key] = sources;
      }
      continue;
    }
    if (Array.isArray(value)) {
      const listValues: unknown[] = value;
      const values = listValues
        .filter((item) => item !== null && item !== undefined)
        .map((item) => isPlainRecord(item) ? cleanToolArguments(item) : item)
        .filter((item) => !isPlainRecord(item) || Object.keys(item).length > 0);
      if (values.length > 0) {
        cleaned[key] = values;
      }
      continue;
    }
    if (isPlainRecord(value)) {
      const nested = cleanToolArguments(value);
      if (Object.keys(nested).length > 0) {
        cleaned[key] = nested;
      }
      continue;
    }
    cleaned[key] = value;
  }
  return cleaned;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringifyMCPToolResult(result: unknown): string {
  if (isPlainRecord(result) && Array.isArray(result.content) && result.content.length > 0) {
    const content = result.content as unknown[];
    const first = content[0];
    if (isPlainRecord(first) && typeof first.text === "string") {
      return first.text;
    }
    return stringifyUnknown(first);
  }
  if (isPlainRecord(result) && "toolResult" in result) {
    return stringifyUnknown(result.toolResult);
  }
  return stringifyUnknown(result);
}

function normalizePromptMessage(message: unknown): Record<string, unknown> {
  if (!isPlainRecord(message)) {
    return { role: "", content: message };
  }
  return {
    role: typeof message.role === "string" ? message.role : "",
    content: message.content,
  };
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value.toString();
  }
  if (value === null || value === undefined) {
    return "";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

function isErrorMCPToolResult(result: unknown): boolean {
  return isPlainRecord(result) && result.isError === true;
}

function classifyMCPError(error: unknown): string {
  const message = formatMCPError(error).toLowerCase();
  if (message.includes("timeout") || message.includes("timed out")) {
    return "timeout";
  }
  if (message.includes("401") || message.includes("unauthorized") || message.includes("auth")) {
    return "authentication";
  }
  return "network";
}

function formatMCPError(error: unknown): string {
  return error instanceof Error ? error.message : stringifyUnknown(error);
}

function isResolverOptions(value: unknown): value is MCPToolResolverOptions {
  return !!value
    && typeof value === "object"
    && ("agent" in value || "logger" in value);
}

function transportForConfig(config: MCPServerConfig): BaseTransport {
  if (config instanceof MCPServerStdio) {
    return new StdioTransport(config);
  }
  if (config instanceof MCPServerSSE) {
    return new SSETransport(config);
  }
  return new HTTPTransport(config);
}

function serverNameForConfig(config: MCPServerConfig): string {
  if (config instanceof MCPServerStdio) {
    return sanitizeToolName([config.command, ...config.args].join("_"));
  }
  if (config instanceof MCPServerHTTP || config instanceof MCPServerSSE) {
    return extractServerName(config.url);
  }
  return "mcp_server";
}

function extractServerName(url: string): string {
  try {
    const parsed = new URL(url);
    return sanitizeToolName(parsed.hostname.replace(/^www\./, "").split(".")[0] ?? "mcp_server");
  } catch {
    return sanitizeToolName(url.split("/").filter(Boolean).at(-1) ?? "mcp_server");
  }
}

function splitMCPRef(ref: string): [string, string | null] {
  const markerIndex = ref.indexOf("#");
  if (markerIndex === -1) {
    return [ref, null];
  }
  return [ref.slice(0, markerIndex), ref.slice(markerIndex + 1) || null];
}

async function passesToolFilter(config: MCPServerConfig, definition: MCPToolDefinition, agent: unknown): Promise<boolean> {
  const filter = config.toolFilter ?? config.tool_filter;
  if (!filter) {
    return true;
  }
  if (filter.length >= 2) {
    return await (filter as (context: ToolFilterContext, tool: MCPToolDefinition) => MaybePromise<boolean>)(
      new ToolFilterContext({ agent, serverName: serverNameForConfig(config) }),
      definition,
    );
  }
  return await (filter as (tool: MCPToolDefinition) => MaybePromise<boolean>)(definition);
}

function headersFromInit(headers: unknown): Record<string, string> {
  if (!headers) {
    return {};
  }
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers as Iterable<readonly [string, string]>);
  }
  if (typeof headers === "object") {
    return Object.fromEntries(
      Object.entries(headers as Record<string, unknown>)
        .filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  }
  return {};
}
