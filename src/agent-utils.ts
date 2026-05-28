import { generateModelDescription, sanitizeToolParamsForOpenAIStrict, type JsonSchema } from "./schema-utils.js";
import { sanitizeToolName } from "./string-utils.js";
import { AgentAction, AgentFinish, OutputParserError } from "./agent-parser.js";
import { BaseTool, ToolResult, type ToolArgsSchema, type ToolArgumentSpec } from "./tools.js";
import type { LLMMessage, MaybePromise, Tool, ToolContext } from "./types.js";

export type ToolRunner = (input?: ToolContext | Record<string, unknown> | string) => MaybePromise<unknown>;

export type SummaryContent = { content: string };

export const SummaryContent = class SummaryContent {
  readonly content: string;

  constructor(options: { content?: string } = {}) {
    this.content = options.content ?? "";
  }
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

export function showAgentLogs(_agent: unknown, _message: string): void {
  void _agent;
  void _message;
}

export const show_agent_logs = showAgentLogs;

export function loadAgentFromRepository(repository: string): never {
  throw new Error(`Agent repository loading is not available in the local TypeScript runtime: ${repository}`);
}

export const load_agent_from_repository = loadAgentFromRepository;

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
