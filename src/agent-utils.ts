import { generateModelDescription, sanitizeToolParamsForOpenAIStrict, type JsonSchema } from "./schema-utils.js";
import { sanitizeToolName } from "./string-utils.js";
import { AgentAction, AgentFinish, OutputParserError } from "./agent-parser.js";
import { BaseTool, ToolResult, type ToolArgsSchema, type ToolArgumentSpec } from "./tools.js";
import type { LLMMessage, MaybePromise, Tool, ToolContext } from "./types.js";
import { AgentRepositoryError } from "./errors.js";

export type ToolRunner = (input?: ToolContext | Record<string, unknown> | string) => MaybePromise<unknown>;

export type SummaryContent = { content: string };

export const SummaryContent = class SummaryContent {
  readonly content: string;

  constructor(options: { content?: string } = {}) {
    this.content = options.content ?? "";
  }
};

export type AgentKnowledgeContextLike = {
  agentKnowledgeContext?: string | null;
  agent_knowledge_context?: string | null;
  crewKnowledgeContext?: string | null;
  crew_knowledge_context?: string | null;
};

export const DELEGATION_TOOL_NAMES: readonly string[] = [
  sanitizeToolName("Delegate work to coworker"),
  sanitizeToolName("Ask question to coworker"),
] as const;

export type NativeToolCallResultOptions = {
  text?: string;
  toolCallId?: string | null;
  tool_call_id?: string | null;
  toolName?: string | null;
  tool_name?: string | null;
};

export class NativeToolCallResult {
  readonly text: string;
  readonly toolCallId: string | null;
  readonly tool_call_id: string | null;
  readonly toolName: string | null;
  readonly tool_name: string | null;

  constructor(options: NativeToolCallResultOptions = {}) {
    this.text = options.text ?? "";
    this.toolCallId = options.toolCallId ?? options.tool_call_id ?? null;
    this.tool_call_id = this.toolCallId;
    this.toolName = options.toolName ?? options.tool_name ?? null;
    this.tool_name = this.toolName;
  }
}

export type OpenAIFunctionToolSchema = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
    strict: true;
  };
};

export type OpenAIToolConversionResult = [
  openaiTools: OpenAIFunctionToolSchema[],
  availableFunctions: Record<string, ToolRunner>,
  toolNameMapping: Record<string, Tool>,
];

type ToolWithArgsSchema = Tool & {
  argsSchema?: ToolArgsSchema | JsonSchema | null;
  args_schema?: ToolArgsSchema | JsonSchema | null;
};

export function getToolNames(tools: readonly Tool[]): string {
  return tools.map((tool) => sanitizeToolName(tool.name)).join(", ");
}

export function renderTextDescriptionAndArgs(tools: readonly Tool[]): string {
  return tools.map((tool) => tool.description ?? "").join("\n");
}

export function convertToolsToOpenAISchema(tools: readonly Tool[]): OpenAIToolConversionResult {
  const openaiTools: OpenAIFunctionToolSchema[] = [];
  const availableFunctions: Record<string, ToolRunner> = {};
  const toolNameMapping: Record<string, Tool> = {};

  for (const tool of tools) {
    let sanitizedName = sanitizeToolName(tool.name);
    if (availableFunctions[sanitizedName]) {
      let counter = 2;
      let candidate = sanitizeToolName(`${sanitizedName}_${String(counter)}`);
      while (availableFunctions[candidate]) {
        counter += 1;
        candidate = sanitizeToolName(`${sanitizedName}_${String(counter)}`);
      }
      sanitizedName = candidate;
    }

    const schema = {
      type: "function",
      function: {
        name: sanitizedName,
        description: cleanToolDescription(tool.description ?? ""),
        parameters: toolParameters(tool),
        strict: true,
      },
    } satisfies OpenAIFunctionToolSchema;

    openaiTools.push(schema);
    availableFunctions[sanitizedName] = (input) => tool.run(input);
    toolNameMapping[sanitizedName] = tool;
  }

  return [openaiTools, availableFunctions, toolNameMapping];
}

export function extractTaskSection(text: string): string {
  for (const marker of ["\n## Task\n", "\n## Task:", "## Task\n"]) {
    const index = text.indexOf(marker);
    if (index < 0) {
      continue;
    }
    const start = index + marker.length;
    for (const endMarker of ["\n---\n", "\n## "]) {
      const end = text.indexOf(endMarker, start);
      if (end > 0) {
        return text.slice(start, end).trim();
      }
    }
    return text.slice(start, start + 2000).trim();
  }
  return text.length > 2000 ? `${text.slice(0, 2000)}\n... [truncated]` : text;
}

export function hasReachedMaxIterations(iterations: number, maxIterations: number): boolean {
  return iterations >= maxIterations;
}

export function formatMessageForLLM(
  prompt: string,
  role: "user" | "assistant" | "system" = "user",
): LLMMessage {
  return { role, content: prompt.trimEnd() };
}

export function combineKnowledgeContext(agent: AgentKnowledgeContextLike): string {
  const agentContext = agent.agentKnowledgeContext ?? agent.agent_knowledge_context ?? "";
  const crewContext = agent.crewKnowledgeContext ?? agent.crew_knowledge_context ?? "";
  const separator = agentContext && crewContext ? "\n" : "";
  return `${agentContext}${separator}${crewContext}`;
}

export const _combine_knowledge_context = combineKnowledgeContext;

export function isInsideEventLoop(): boolean {
  return false;
}

export const is_inside_event_loop = isInsideEventLoop;

export function parseTools(tools: readonly Tool[]): Tool[] {
  return tools.map((tool) => {
    if (tool instanceof BaseTool) {
      tool.resetUsageCount();
      return tool.toStructuredTool();
    }
    return tool;
  });
}

export const parse_tools = parseTools;

export function handleMaxIterationsExceeded(_executor: unknown, _printer: unknown = null): AgentFinish {
  void _executor;
  void _printer;
  return new AgentFinish({
    thought: "",
    output: "Agent stopped due to max iterations.",
    text: "Agent stopped due to max iterations.",
  });
}

export const handle_max_iterations_exceeded = handleMaxIterationsExceeded;

export function formatAnswer(answer: unknown): string {
  if (answer instanceof AgentFinish) {
    return String(answer.output);
  }
  if (typeof answer === "string") {
    return answer;
  }
  return safeJsonStringify(answer);
}

export const format_answer = formatAnswer;

export function enforceRpmLimit(requestWithinRpmLimit?: (() => boolean | Promise<boolean>) | null): void {
  if (!requestWithinRpmLimit) {
    return;
  }
  void requestWithinRpmLimit();
}

export const enforce_rpm_limit = enforceRpmLimit;

export async function getLlmResponse(llm: { call?: (messages: readonly LLMMessage[], options?: Record<string, unknown>) => MaybePromise<unknown> }, messages: readonly LLMMessage[], options: Record<string, unknown> = {}): Promise<unknown> {
  return await llm.call?.(messages, options);
}

export const get_llm_response = getLlmResponse;
export const aget_llm_response = getLlmResponse;

export function processLlmResponse(response: unknown): unknown {
  if (typeof response !== "string") {
    return response;
  }
  if (response.includes("Final Answer:")) {
    return new AgentFinish({
      thought: "",
      output: response.split("Final Answer:").at(-1)?.trim() ?? "",
      text: response,
    });
  }
  return response;
}

export const process_llm_response = processLlmResponse;

export function handleAgentActionCore(action: AgentAction, tools: readonly Tool[]): ToolResult {
  const tool = tools.find((candidate) => sanitizeToolName(candidate.name) === sanitizeToolName(action.tool));
  if (!tool) {
    return new ToolResult(`Tool '${action.tool}' is not available.`);
  }
  return new ToolResult(tool.run(action.toolInput));
}

export const handle_agent_action_core = handleAgentActionCore;

export function handleUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : safeJsonStringify(error);
}

export const handle_unknown_error = handleUnknownError;

export function handleOutputParserException(error: unknown): string {
  return error instanceof OutputParserError ? error.message : handleUnknownError(error);
}

export const handle_output_parser_exception = handleOutputParserException;

export function isContextLengthExceeded(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /context|token|length|maximum/i.test(message);
}

export const is_context_length_exceeded = isContextLengthExceeded;

export function handleContextLength(messages: readonly LLMMessage[], summary: string): LLMMessage[] {
  return [
    { role: "system", content: `Previous conversation summary:\n${summary}` },
    ...messages.slice(-4),
  ];
}

export const handle_context_length = handleContextLength;

export function summarizeMessages(messages: readonly LLMMessage[]): SummaryContent {
  return new SummaryContent({
    content: messages.map((message) => `${message.role}: ${message.content}`).join("\n"),
  });
}

export const summarize_messages = summarizeMessages;

export function _estimate_token_count(text: string): number {
  return Math.floor(text.length / 4);
}

export function _format_messages_for_summary(messages: readonly LLMMessage[]): string {
  const lines: string[] = [];
  for (const message of messages) {
    const record = message as unknown as Record<string, unknown>;
    const role = typeof record.role === "string" ? record.role : "user";
    if (role === "system") {
      continue;
    }
    let content = record.content;
    if (content === null || content === undefined) {
      const toolCalls = Array.isArray(record.tool_calls) ? record.tool_calls : null;
      const toolNames = toolCalls?.map((toolCall) => {
        const toolCallRecord = toolCall as Record<string, unknown>;
        const functionRecord = typeof toolCallRecord.function === "object" && toolCallRecord.function !== null
          ? toolCallRecord.function as Record<string, unknown>
          : null;
        return typeof functionRecord?.name === "string" ? functionRecord.name : "unknown";
      }) ?? [];
      content = toolNames.length > 0
        ? `[Called tools: ${toolNames.join(", ")}]`
        : "";
    } else if (Array.isArray(content)) {
      const textParts = content
        .filter((block): block is { type?: unknown; text?: unknown } => Boolean(block) && typeof block === "object")
        .filter((block) => block.type === "text")
        .map((block) => typeof block.text === "string" ? block.text : "")
        .filter(Boolean);
      content = textParts.length > 0 ? textParts.join(" ") : "[multimodal content]";
    }

    const label = role === "assistant"
      ? "[ASSISTANT]:"
      : role === "tool"
        ? `[TOOL_RESULT (${typeof record.name === "string" ? record.name : "unknown"})]:`
        : "[USER]:";
    lines.push(`${label} ${String(content)}`);
  }
  return lines.join("\n\n");
}

export function _split_messages_into_chunks(messages: readonly LLMMessage[], max_tokens: number): LLMMessage[][] {
  const nonSystem = messages.filter((message) => message.role !== "system");
  if (nonSystem.length === 0) {
    return [];
  }
  const chunks: LLMMessage[][] = [];
  let currentChunk: LLMMessage[] = [];
  let currentTokens = 0;
  for (const message of nonSystem) {
    const rawContent = (message as unknown as Record<string, unknown>).content;
    const content = Array.isArray(rawContent)
      ? JSON.stringify(rawContent)
      : typeof rawContent === "string" ? rawContent : "";
    const messageTokens = _estimate_token_count(content);
    if (currentChunk.length > 0 && currentTokens + messageTokens > max_tokens) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentTokens = 0;
    }
    currentChunk.push(message);
    currentTokens += messageTokens;
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  return chunks;
}

export function _extract_summary_tags(text: string): string {
  const match = /<summary>([\s\S]*?)<\/summary>/.exec(text);
  return (match?.[1] ?? text).trim();
}

export function showAgentLogs(_agent: unknown, _message: string): void {
  void _agent;
  void _message;
}

export const show_agent_logs = showAgentLogs;

type AgentRepositoryResponse = {
  status?: number;
  status_code?: number;
  ok?: boolean;
  text?: string | (() => string);
  json?: Record<string, unknown> | (() => Record<string, unknown>);
};

type AgentRepositoryClient = {
  getAgent?: (repository: string) => AgentRepositoryResponse;
  get_agent?: (repository: string) => AgentRepositoryResponse;
};

let createPlusClientHook: (() => AgentRepositoryClient) | null = null;

export function setCreatePlusClientHook(hook: (() => AgentRepositoryClient) | null): void {
  createPlusClientHook = hook;
}

export const set_create_plus_client_hook = setCreatePlusClientHook;

export function loadAgentFromRepository(repository: string): Record<string, unknown> {
  if (!repository) {
    return {};
  }
  if (!createPlusClientHook) {
    return {};
  }
  const client = createPlusClientHook();
  const getAgent = client.getAgent ?? client.get_agent;
  if (!getAgent) {
    throw new AgentRepositoryError("Agent repository client does not provide get_agent.");
  }
  const response = getAgent.call(client, repository);
  const status = response.status_code ?? response.status ?? (response.ok === false ? 500 : 200);
  if (status === 404) {
    throw new AgentRepositoryError(
      `Agent ${repository} does not exist, make sure the name is correct or the agent is available on your organization.`,
    );
  }
  if (status !== 200) {
    throw new AgentRepositoryError(`Agent ${repository} could not be loaded: ${repositoryResponseText(response)}`);
  }
  return normalizeRepositoryAgent(repository, repositoryResponseJson(response));
}

export const load_agent_from_repository = loadAgentFromRepository;

function repositoryResponseText(response: AgentRepositoryResponse): string {
  return typeof response.text === "function" ? response.text() : response.text ?? "";
}

function repositoryResponseJson(response: AgentRepositoryResponse): Record<string, unknown> {
  const payload = typeof response.json === "function" ? response.json() : response.json;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new AgentRepositoryError("Agent repository response did not include agent attributes.");
  }
  return payload;
}

function normalizeRepositoryAgent(repository: string, agent: Record<string, unknown>): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(agent)) {
    if (key === "tools") {
      if (!Array.isArray(value)) {
        attributes.tools = [];
        continue;
      }
      attributes.tools = value.map((tool) => {
        if (isRunnableTool(tool)) {
          return tool;
        }
        throw new AgentRepositoryError(
          `Agent ${repository} includes a repository tool that cannot be synchronously loaded in the TypeScript runtime.`,
        );
      });
      continue;
    }
    attributes[key] = value;
  }
  return attributes;
}

function isRunnableTool(value: unknown): value is Tool {
  return Boolean(value) && typeof value === "object" && typeof (value as { run?: unknown }).run === "function";
}

export function trackDelegationIfNeeded(toolName: string, args: Record<string, unknown>, task: { incrementDelegations?: (coworker?: unknown) => void } | null = null): void {
  if (DELEGATION_TOOL_NAMES.includes(sanitizeToolName(toolName))) {
    task?.incrementDelegations?.(args.coworker);
  }
}

export const track_delegation_if_needed = trackDelegationIfNeeded;

export function extractToolCallInfo(value: unknown): { toolName: string; arguments: Record<string, unknown> | null; id: string | null } | null {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : null;
  if (!record) {
    return null;
  }
  const functionRecord = record.function && typeof record.function === "object" ? record.function as Record<string, unknown> : null;
  const name = record.name ?? record.toolName ?? record.tool_name ?? functionRecord?.name;
  if (typeof name !== "string") {
    return null;
  }
  return {
    toolName: name,
    arguments: parseToolCallArgs(record.arguments ?? functionRecord?.arguments),
    id: typeof record.id === "string" ? record.id : null,
  };
}

export const extract_tool_call_info = extractToolCallInfo;

export function isToolCallList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value) && value.every((item) => extractToolCallInfo(item) !== null);
}

export const is_tool_call_list = isToolCallList;

export function checkNativeToolSupport(llm: unknown, tools: readonly Tool[]): boolean {
  const record = llm && typeof llm === "object" ? llm as Record<string, unknown> : {};
  return tools.length > 0 && (record.supportsNativeToolCalling === true || record.supports_native_tool_calling === true);
}

export const check_native_tool_support = checkNativeToolSupport;

export function setupNativeTools(tools: readonly Tool[]): OpenAIToolConversionResult {
  return convertToolsToOpenAISchema(tools);
}

export const setup_native_tools = setupNativeTools;

export function buildToolCallsAssistantMessage(results: readonly NativeToolCallResult[]): LLMMessage {
  return {
    role: "assistant",
    content: results.map((result) => result.text).join("\n"),
  };
}

export const build_tool_calls_assistant_message = buildToolCallsAssistantMessage;

export async function executeSingleNativeToolCall(toolCall: unknown, availableFunctions: Record<string, ToolRunner>): Promise<NativeToolCallResult> {
  const info = extractToolCallInfo(toolCall);
  if (!info) {
    return new NativeToolCallResult({ text: "Invalid tool call." });
  }
  const runner = availableFunctions[sanitizeToolName(info.toolName)] ?? availableFunctions[info.toolName];
  if (!runner) {
    return new NativeToolCallResult({ text: `Tool '${info.toolName}' is not available.`, toolCallId: info.id, toolName: info.toolName });
  }
  const output = await runner(info.arguments ?? {});
  return new NativeToolCallResult({ text: formatAnswer(output), toolCallId: info.id, toolName: info.toolName });
}

export const execute_single_native_tool_call = executeSingleNativeToolCall;

export function parseToolCallArgs(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : { input: value };
    } catch {
      return { input: value };
    }
  }
  return null;
}

export const parse_tool_call_args = parseToolCallArgs;

function cleanToolDescription(description: string): string {
  const marker = "Tool Description:";
  return description.includes(marker) ? description.split(marker).at(-1)?.trim() ?? "" : description;
}

function toolParameters(tool: Tool): JsonSchema {
  const toolWithSchema = tool as ToolWithArgsSchema;
  const argsSchema = toolWithSchema.argsSchema ?? toolWithSchema.args_schema;
  if (!argsSchema) {
    return {};
  }

  if (isJsonSchema(argsSchema)) {
    const description = argsSchema.description;
    const title = argsSchema.title;
    const modelDescription = generateModelDescription("ToolParameters", argsSchema, { stripNullTypes: false });
    const schema = modelDescription.json_schema.schema;
    if (title !== undefined) {
      Reflect.deleteProperty(schema, "title");
    }
    if (description !== undefined) {
      Reflect.deleteProperty(schema, "description");
    }
    return schema;
  }

  return sanitizeToolParamsForOpenAIStrict(toolArgsSchemaToJsonSchema(argsSchema));
}

function isJsonSchema(schema: ToolArgsSchema | JsonSchema): schema is JsonSchema {
  return typeof schema.type === "string"
    || "$defs" in schema
    || "properties" in schema
    || "anyOf" in schema
    || "oneOf" in schema;
}

function toolArgsSchemaToJsonSchema(argsSchema: ToolArgsSchema): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const [name, spec] of Object.entries(argsSchema)) {
    properties[name] = toolArgumentSpecToJsonSchema(spec);
    if (spec.required) {
      required.push(name);
    }
  }

  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

function toolArgumentSpecToJsonSchema(spec: ToolArgumentSpec): JsonSchema {
  const schema: JsonSchema = {};
  if (spec.type && spec.type !== "unknown") {
    schema.type = spec.type === "number" ? "number" : spec.type;
  }
  if (spec.description) {
    schema.description = spec.description;
  }
  if (spec.default !== undefined) {
    schema.default = spec.default;
  }
  if (!schema.type) {
    schema.type = "object";
  }
  return schema;
}

export const get_tool_names = getToolNames;
export const render_text_description_and_args = renderTextDescriptionAndArgs;
export const convert_tools_to_openai_schema = convertToolsToOpenAISchema;
export const extract_task_section = extractTaskSection;
export const has_reached_max_iterations = hasReachedMaxIterations;
export const format_message_for_llm = formatMessageForLLM;

export type { BaseTool };

function safeJsonStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value.toString();
  }
  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}
