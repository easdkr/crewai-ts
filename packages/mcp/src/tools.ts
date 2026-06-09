import { BaseTool, type ToolArgumentSpec, type ToolArgumentType, type ToolArgsSchema } from "@crewai-ts/core/tools";

export type MCPNativeToolOptions = {
  clientFactory?: () => unknown;
  client_factory?: () => unknown;
  toolName?: string;
  tool_name?: string;
  toolSchema?: Record<string, unknown>;
  tool_schema?: Record<string, unknown>;
  serverName?: string;
  server_name?: string;
  originalToolName?: string | null;
  original_tool_name?: string | null;
};

export class MCPNativeTool extends BaseTool {
  private readonly clientFactory: () => unknown;
  private readonly originalToolNameValue: string;
  private readonly serverNameValue: string;

  constructor(options: MCPNativeToolOptions);
  constructor(
    clientFactory: () => unknown,
    toolName: string,
    toolSchema: Record<string, unknown>,
    serverName: string,
    originalToolName?: string | null,
  );
  constructor(
    optionsOrClientFactory: MCPNativeToolOptions | (() => unknown),
    toolName?: string,
    toolSchema: Record<string, unknown> = {},
    serverName?: string,
    originalToolName: string | null = null,
  ) {
    const options: MCPNativeToolOptions = typeof optionsOrClientFactory === "function"
      ? ({
          clientFactory: optionsOrClientFactory,
          ...(toolName === undefined ? {} : { toolName }),
          toolSchema,
          ...(serverName === undefined ? {} : { serverName }),
          originalToolName,
        })
      : optionsOrClientFactory;
    const resolvedToolName = options.toolName ?? options.tool_name;
    const resolvedServerName = options.serverName ?? options.server_name;
    const resolvedClientFactory = options.clientFactory ?? options.client_factory;
    if (!resolvedToolName || !resolvedServerName || !resolvedClientFactory) {
      throw new Error("MCPNativeTool requires clientFactory, toolName, and serverName.");
    }
    const schema = options.toolSchema ?? options.tool_schema ?? {};
    super({
      name: `${resolvedServerName}_${resolvedToolName}`,
      description: toolSchemaDescription(schema, resolvedToolName, resolvedServerName),
      argsSchema: toolSchemaArgs(schema),
    });
    this.clientFactory = resolvedClientFactory;
    this.originalToolNameValue = options.originalToolName ?? options.original_tool_name ?? resolvedToolName;
    this.serverNameValue = resolvedServerName;
  }

  get originalToolName(): string {
    return this.originalToolNameValue;
  }

  get original_tool_name(): string {
    return this.originalToolName;
  }

  get serverName(): string {
    return this.serverNameValue;
  }

  get server_name(): string {
    return this.serverName;
  }

  protected _run(args: Record<string, unknown>): Promise<string> {
    return this.runAsync(args);
  }

  protected override async _arun(args: Record<string, unknown>): Promise<string> {
    return await this.runAsync(args);
  }

  async runAsync(args: Record<string, unknown> = {}): Promise<string> {
    const client = this.clientFactory();
    if (!isMCPClientLike(client)) {
      throw new Error("MCPNativeTool clientFactory must return an MCPClient-like object.");
    }
    await client.connect();
    try {
      return stringifyToolOutput(await client.callTool(this.originalToolName, args));
    } finally {
      await client.disconnect();
    }
  }

  async _run_async(args: Record<string, unknown> = {}): Promise<string> {
    return await this.runAsync(args);
  }
}

export type MCPToolWrapperOptions = {
  mcpServerParams?: Record<string, unknown>;
  mcp_server_params?: Record<string, unknown>;
  toolName?: string;
  tool_name?: string;
  toolSchema?: Record<string, unknown>;
  tool_schema?: Record<string, unknown>;
  serverName?: string;
  server_name?: string;
};

const MCP_WRAPPER_MAX_RETRIES = 3;
const MCP_TOOL_EXECUTION_TIMEOUT_SECONDS = 60;
type MCPWrapperOperation = (args?: Record<string, unknown>) => Promise<string>;

export class MCPToolWrapper extends BaseTool {
  private readonly mcpServerParamsValue: Record<string, unknown>;
  private readonly originalToolNameValue: string;
  private readonly serverNameValue: string;

  constructor(options: MCPToolWrapperOptions);
  constructor(
    mcpServerParams: Record<string, unknown>,
    toolName: string,
    toolSchema: Record<string, unknown>,
    serverName: string,
  );
  constructor(
    optionsOrServerParams: MCPToolWrapperOptions | Record<string, unknown>,
    toolName?: string,
    toolSchema: Record<string, unknown> = {},
    serverName?: string,
  ) {
    const options: MCPToolWrapperOptions = isMCPToolWrapperOptions(optionsOrServerParams)
      ? optionsOrServerParams
      : {
          mcpServerParams: optionsOrServerParams,
          ...(toolName === undefined ? {} : { toolName }),
          toolSchema,
          ...(serverName === undefined ? {} : { serverName }),
        };
    const params = options.mcpServerParams ?? options.mcp_server_params;
    const resolvedToolName = options.toolName ?? options.tool_name;
    const resolvedServerName = options.serverName ?? options.server_name;
    if (!params || !resolvedToolName || !resolvedServerName) {
      throw new Error("MCPToolWrapper requires mcpServerParams, toolName, and serverName.");
    }
    const schema = options.toolSchema ?? options.tool_schema ?? {};
    super({
      name: `${resolvedServerName}_${resolvedToolName}`,
      description: toolSchemaDescription(schema, resolvedToolName, resolvedServerName),
      argsSchema: toolSchemaArgs(schema),
    });
    this.mcpServerParamsValue = { ...params };
    this.originalToolNameValue = resolvedToolName;
    this.serverNameValue = resolvedServerName;
  }

  get mcpServerParams(): Record<string, unknown> {
    return { ...this.mcpServerParamsValue };
  }

  get mcp_server_params(): Record<string, unknown> {
    return this.mcpServerParams;
  }

  get originalToolName(): string {
    return this.originalToolNameValue;
  }

  get original_tool_name(): string {
    return this.originalToolName;
  }

  get serverName(): string {
    return this.serverNameValue;
  }

  get server_name(): string {
    return this.serverName;
  }

  protected _run(args: Record<string, unknown>): Promise<string> {
    return this._run_async(args);
  }

  protected override async _arun(args: Record<string, unknown>): Promise<string> {
    return await this._run_async(args);
  }

  async runAsync(args: Record<string, unknown> = {}): Promise<string> {
    return await this._execute_tool(args);
  }

  async _run_async(args: Record<string, unknown> = {}): Promise<string> {
    return await this._retry_with_exponential_backoff(this._execute_tool_with_timeout.bind(this), args);
  }

  async _retry_with_exponential_backoff(
    operationFunc: MCPWrapperOperation,
    args: Record<string, unknown> = {},
  ): Promise<string> {
    let lastError = "";
    for (let attempt = 0; attempt < MCP_WRAPPER_MAX_RETRIES; attempt += 1) {
      const [result, error, shouldRetry] = await this._execute_single_attempt(operationFunc, args);
      if (result !== null) {
        return result;
      }
      if (!shouldRetry) {
        return error;
      }
      lastError = error;
      if (attempt < MCP_WRAPPER_MAX_RETRIES - 1) {
        await waitForMCPWrapperRetry(2 ** attempt);
      }
    }
    return `MCP tool execution failed after ${String(MCP_WRAPPER_MAX_RETRIES)} attempts: ${lastError}`;
  }

  async _execute_single_attempt(
    operationFunc: MCPWrapperOperation,
    args: Record<string, unknown> = {},
  ): Promise<[string | null, string, boolean]> {
    try {
      return [await operationFunc(args), "", false];
    } catch (error) {
      const classified = classifyMCPWrapperError(error, this.originalToolName);
      return [null, classified.message, classified.retryable];
    }
  }

  async _execute_tool_with_timeout(args: Record<string, unknown> = {}): Promise<string> {
    return await withMCPWrapperTimeout(this._execute_tool(args));
  }

  async _execute_tool(args: Record<string, unknown> = {}): Promise<string> {
    return await this._do_mcp_call(args);
  }

  async _do_mcp_call(args: Record<string, unknown> = {}): Promise<string> {
    const { MCPClient, HTTPTransport } = await import("./index.js");
    const url = this.mcpServerParamsValue.url;
    if (typeof url !== "string") {
      throw new Error("MCPToolWrapper requires an mcpServerParams.url string.");
    }
    const client = new MCPClient(new HTTPTransport({ url }), {
      connectTimeout: 15,
      executionTimeout: 60,
      discoveryTimeout: 15,
      maxRetries: 3,
    });
    await client.connect();
    try {
      return await client.callTool(this.originalToolName, args);
    } finally {
      await client.disconnect();
    }
  }
}

function classifyMCPWrapperError(error: unknown, toolName: string): { message: string; retryable: boolean } {
  const message = error instanceof Error ? error.message : stringifyToolOutput(error);
  const lower = message.toLowerCase();
  if (lower.includes("authentication") || lower.includes("unauthorized")) {
    return { message: `Authentication failed for MCP server: ${message}`, retryable: false };
  }
  if (lower.includes("not found")) {
    return { message: `Tool '${toolName}' not found on MCP server`, retryable: false };
  }
  if (lower.includes("connection") || lower.includes("network")) {
    return { message: `Network connection failed: ${message}`, retryable: true };
  }
  if (lower.includes("json") || lower.includes("parsing")) {
    return { message: `Server response parsing error: ${message}`, retryable: true };
  }
  return { message: `MCP execution error: ${message}`, retryable: false };
}

async function waitForMCPWrapperRetry(seconds: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
}

async function withMCPWrapperTimeout(operation: Promise<string>): Promise<string> {
  let timeout!: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      operation,
      new Promise<string>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`Connection timed out after ${String(MCP_TOOL_EXECUTION_TIMEOUT_SECONDS)} seconds`));
        }, MCP_TOOL_EXECUTION_TIMEOUT_SECONDS * 1000);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}



function stringifyToolOutput(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}


function isMCPClientLike(value: unknown): value is {
  connect(): Promise<unknown>;
  disconnect(): Promise<unknown>;
  callTool(toolName: string, args: Record<string, unknown>): Promise<unknown>;
} {
  return !!value
    && typeof value === "object"
    && typeof (value as { connect?: unknown }).connect === "function"
    && typeof (value as { disconnect?: unknown }).disconnect === "function"
    && typeof (value as { callTool?: unknown }).callTool === "function";
}


function isMCPToolWrapperOptions(value: MCPToolWrapperOptions | Record<string, unknown>): value is MCPToolWrapperOptions {
  return "mcpServerParams" in value
    || "mcp_server_params" in value
    || "toolName" in value
    || "tool_name" in value
    || "toolSchema" in value
    || "tool_schema" in value
    || "serverName" in value
    || "server_name" in value;
}


function toolSchemaDescription(schema: Record<string, unknown>, toolName: string, serverName: string): string {
  return typeof schema.description === "string" && schema.description.trim()
    ? schema.description
    : `Tool ${toolName} from ${serverName}`;
}


function toolSchemaArgs(schema: Record<string, unknown>): ToolArgsSchema {
  const argsSchema = schema.argsSchema ?? schema.args_schema;
  if (argsSchema && typeof argsSchema === "object" && !Array.isArray(argsSchema)) {
    return argsSchema as ToolArgsSchema;
  }
  const inputSchema = schema.inputSchema ?? schema.input_schema;
  if (!inputSchema || typeof inputSchema !== "object" || Array.isArray(inputSchema)) {
    return {};
  }
  const record = inputSchema as Record<string, unknown>;
  const properties = record.properties;
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return {};
  }
  const required = new Set(Array.isArray(record.required) ? record.required.filter((item): item is string => typeof item === "string") : []);
  return Object.fromEntries(
    Object.entries(properties as Record<string, unknown>).map(([name, value]) => {
      const property = value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
      const spec: ToolArgumentSpec = {
        type: normalizeJsonSchemaType(property.type),
        required: required.has(name),
      };
      if (typeof property.description === "string") {
        spec.description = property.description;
      }
      if ("default" in property) {
        spec.default = property.default;
      }
      return [name, spec];
    }),
  );
}


function normalizeJsonSchemaType(value: unknown): ToolArgumentType {
  if (value === "string" || value === "number" || value === "boolean" || value === "object" || value === "array") {
    return value;
  }
  if (value === "integer") {
    return "number";
  }
  return "unknown";
}

