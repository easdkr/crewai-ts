import { Agent, type AgentOptions } from "./agent.js";
import { convertToolsToOpenAISchema } from "./agent-utils.js";
import { Converter } from "./converter.js";
import { AgentExecutionCompletedEvent, AgentExecutionErrorEvent, AgentExecutionStartedEvent, crewaiEventBus } from "./events.js";
import { I18N_DEFAULT } from "./i18n.js";
import { generateModelDescription, type ModelDescription } from "./schema-utils.js";
import { sanitizeToolName } from "./string-utils.js";
import { AgentTools } from "./tools.js";
import type { Tool as CrewTool } from "./types.js";

export abstract class BaseToolAdapter {
  readonly originalTools: readonly CrewTool[];
  readonly original_tools: readonly CrewTool[];
  convertedTools: unknown[] = [];
  converted_tools: unknown[] = this.convertedTools;

  constructor(tools: readonly CrewTool[] | null = null) {
    this.originalTools = tools ?? [];
    this.original_tools = this.originalTools;
  }

  abstract configureTools(tools: readonly CrewTool[]): void;

  configure_tools(tools: readonly CrewTool[]): void {
    this.configureTools(tools);
  }

  tools(): unknown[] {
    return this.convertedTools;
  }

  static sanitizeToolName(toolName: string): string {
    return sanitizeToolName(toolName);
  }

  static sanitize_tool_name(toolName: string): string {
    return BaseToolAdapter.sanitizeToolName(toolName);
  }
}

export abstract class BaseConverterAdapter {
  readonly agentAdapter: BaseAgentAdapter;
  readonly agent_adapter: BaseAgentAdapter;
  protected outputFormat: "json" | "pydantic" | null = null;
  protected output_format: "json" | "pydantic" | null = null;
  protected schema: ModelDescription | null = null;

  constructor(agentAdapter: BaseAgentAdapter) {
    this.agentAdapter = agentAdapter;
    this.agent_adapter = agentAdapter;
  }

  abstract configureStructuredOutput(task: unknown): void;

  configure_structured_output(task: unknown): void {
    this.configureStructuredOutput(task);
  }

  abstract enhanceSystemPrompt(basePrompt: string): string;

  enhance_system_prompt(basePrompt: string): string {
    return this.enhanceSystemPrompt(basePrompt);
  }

  postProcessResult(result: unknown): string {
    const text = typeof result === "string" ? result : stringifyAdapterValue(result);
    return this.outputFormat ? extractJsonFromText(text) : text;
  }

  post_process_result(result: unknown): string {
    return this.postProcessResult(result);
  }

  protected configureFormatFromTask(task: unknown): void {
    const record = asRecord(task);
    const outputJson = record?.outputJson ?? record?.output_json;
    const outputPydantic = record?.outputPydantic ?? record?.output_pydantic;
    if (outputJson) {
      this.outputFormat = "json";
      this.output_format = this.outputFormat;
      this.schema = modelDescriptionFromUnknown(outputJson);
      return;
    }
    if (outputPydantic) {
      this.outputFormat = "pydantic";
      this.output_format = this.outputFormat;
      this.schema = modelDescriptionFromUnknown(outputPydantic);
      return;
    }
    this.outputFormat = null;
    this.output_format = null;
    this.schema = null;
  }
}

export abstract class BaseAgentAdapter extends Agent {
  adaptedStructuredOutput = false;
  adapted_structured_output = false;
  protected readonly agentConfig: Record<string, unknown> | null;
  protected readonly agent_config: Record<string, unknown> | null;

  constructor(options: AgentOptions & { agentConfig?: Record<string, unknown> | null; agent_config?: Record<string, unknown> | null }) {
    super(options);
    this.agentConfig = options.agentConfig ?? options.agent_config ?? null;
    this.agent_config = this.agentConfig;
  }

  abstract configureTools(tools?: readonly CrewTool[] | null): void;

  configure_tools(tools?: readonly CrewTool[] | null): void {
    this.configureTools(tools);
  }

  abstract configureStructuredOutput(task: unknown): void;

  configure_structured_output(task: unknown): void {
    this.configureStructuredOutput(task);
  }
}

export type AgentKwargs = AgentOptions & {
  model?: string;
  agentConfig?: Record<string, unknown> | null;
  agent_config?: Record<string, unknown> | null;
};
export const AgentKwargs = Object.freeze({ kind: "AgentKwargs" });

export class OpenAIAgent {
  tools: unknown[] = [];
  output_type: unknown = null;
  outputType: unknown = null;

  constructor(
    readonly options: { name: string; instructions: string; model: string } & Record<string, unknown>,
  ) {}
}

export class Runner {
  readonly name = "Runner";

  static runSync(_agent: OpenAIAgent, message: string): { final_output: string; finalOutput: string } {
    return { final_output: message, finalOutput: message };
  }

  static run_sync(agent: OpenAIAgent, message: string): { final_output: string; finalOutput: string } {
    return Runner.runSync(agent, message);
  }
}

export const OpenAIRunner = Runner;
export const OpenAIAgentsModule = Object;
export const OpenAITool = Object;
export const OpenAIFunctionTool = Object;

export class OpenAIAgentToolAdapter extends BaseToolAdapter {
  configureTools(tools: readonly CrewTool[]): void {
    const allTools = [...tools, ...this.originalTools];
    const [schemas, availableFunctions, toolNameMapping] = convertToolsToOpenAISchema(allTools);
    this.convertedTools = schemas.map((schema) => {
      const name = schema.function.name;
      return {
        name,
        description: schema.function.description,
        params_json_schema: schema.function.parameters,
        paramsJsonSchema: schema.function.parameters,
        tool: toolNameMapping[name],
        on_invoke_tool: async (_context: unknown, args: unknown) =>
          await availableFunctions[name]?.(normalizeToolArgs(args)),
        onInvokeTool: async (_context: unknown, args: unknown) =>
          await availableFunctions[name]?.(normalizeToolArgs(args)),
      };
    });
    this.converted_tools = this.convertedTools;
  }
}

export class OpenAIConverterAdapter extends BaseConverterAdapter {
  outputModel: unknown = null;
  output_model: unknown = null;

  configureStructuredOutput(task: unknown): void {
    this.configureFormatFromTask(task);
    const record = asRecord(task);
    const outputModel = record?.outputJson ?? record?.output_json ?? record?.outputPydantic ?? record?.output_pydantic ?? null;
    this.outputModel = outputModel;
    this.output_model = outputModel;
    const openaiAgent = asRecord(this.agentAdapter)?.openaiAgent ?? asRecord(this.agentAdapter)?._openai_agent;
    if (openaiAgent && typeof openaiAgent === "object") {
      (openaiAgent as { output_type?: unknown; outputType?: unknown }).output_type = outputModel;
      (openaiAgent as { output_type?: unknown; outputType?: unknown }).outputType = outputModel;
    }
  }

  enhanceSystemPrompt(basePrompt: string): string {
    return appendStructuredOutputPrompt(basePrompt, this.outputFormat, this.schema);
  }
}

export class OpenAIAgentAdapter extends BaseAgentAdapter {
  readonly toolAdapter: OpenAIAgentToolAdapter;
  readonly tool_adapter: OpenAIAgentToolAdapter;
  readonly converterAdapter: OpenAIConverterAdapter;
  readonly converter_adapter: OpenAIConverterAdapter;
  openaiAgent: OpenAIAgent | null = null;
  _openai_agent: OpenAIAgent | null = null;
  agent_executor: typeof Runner | null = null;

  constructor(options: AgentKwargs) {
    const { model, ...agentOptions } = options;
    super({ ...agentOptions, llm: options.llm ?? model ?? "gpt-4o-mini" });
    this.toolAdapter = new OpenAIAgentToolAdapter(options.tools);
    this.tool_adapter = this.toolAdapter;
    this.converterAdapter = new OpenAIConverterAdapter(this);
    this.converter_adapter = this.converterAdapter;
  }

  buildSystemPrompt(): string {
    return this.converterAdapter.enhanceSystemPrompt([
      `You are ${this.role}.`,
      `Your goal is: ${this.goal}`,
      `Your backstory: ${this.backstory}`,
      "When working on tasks, think step-by-step and use the available tools when necessary.",
    ].join("\n\n"));
  }

  _build_system_prompt(): string {
    return this.buildSystemPrompt();
  }

  createAgentExecutor(tools: readonly CrewTool[] | null = null): void {
    this.openaiAgent = new OpenAIAgent({
      name: this.role,
      instructions: this.buildSystemPrompt(),
      model: adapterString(this.llm) || "gpt-4o-mini",
      ...(this.agentConfig ?? {}),
    });
    this._openai_agent = this.openaiAgent;
    this.configureTools([...this.tools, ...(tools ?? [])]);
    this.agent_executor = Runner;
  }

  create_agent_executor(tools: readonly CrewTool[] | null = null): void {
    this.createAgentExecutor(tools);
  }

  configureTools(tools?: readonly CrewTool[] | null): void {
    this.toolAdapter.configureTools(tools ?? []);
    if (this.openaiAgent) {
      this.openaiAgent.tools = this.toolAdapter.convertedTools;
    }
  }

  configure_tools(tools?: readonly CrewTool[] | null): void {
    this.configureTools(tools);
  }

  configureStructuredOutput(task: unknown): void {
    this.converterAdapter.configureStructuredOutput(task);
  }

  configure_structured_output(task: unknown): void {
    this.configureStructuredOutput(task);
  }

  async execute_task(task: unknown, context: string | null = null, tools: readonly CrewTool[] | null = null): Promise<string> {
    this.configureStructuredOutput(task);
    this.createAgentExecutor(tools);
    const taskPrompt = formatAdapterTaskPrompt(task, context);
    crewaiEventBus.emit(this, new AgentExecutionStartedEvent({
      agent: this,
      tools: this.tools,
      task,
      taskPrompt,
    }));
    try {
      if (!this.openaiAgent || !this.agent_executor) {
        throw new Error("Agent executor is not configured.");
      }
      const result = await Promise.resolve(this.agent_executor.run_sync(this.openaiAgent, taskPrompt));
      const finalAnswer = this.handleExecutionResult(result);
      crewaiEventBus.emit(this, new AgentExecutionCompletedEvent({ agent: this, task, output: finalAnswer }));
      return finalAnswer;
    } catch (error) {
      crewaiEventBus.emit(this, new AgentExecutionErrorEvent({ agent: this, task, error }));
      throw error;
    }
  }

  handleExecutionResult(result: unknown): string {
    const record = asRecord(result);
    return this.converterAdapter.postProcessResult(record?.final_output ?? record?.finalOutput ?? result);
  }

  handle_execution_result(result: unknown): string {
    return this.handleExecutionResult(result);
  }

  get_delegation_tools(agents: readonly Agent[] = []): CrewTool[] {
    return new AgentTools(agents as ConstructorParameters<typeof AgentTools>[0]).tools();
  }
}

export class LangGraphToolAdapter extends BaseToolAdapter {
  configureTools(tools: readonly CrewTool[]): void {
    this.convertedTools = [...tools, ...this.originalTools].map((tool) => ({
      name: sanitizeToolName(tool.name),
      description: tool.description ?? "",
      args_schema: (tool as { argsSchema?: unknown; args_schema?: unknown }).argsSchema ?? (tool as { argsSchema?: unknown; args_schema?: unknown }).args_schema ?? {},
      argsSchema: (tool as { argsSchema?: unknown; args_schema?: unknown }).argsSchema ?? (tool as { argsSchema?: unknown; args_schema?: unknown }).args_schema ?? {},
      func: async (input: unknown) => await tool.run(normalizeToolArgs(input)),
      tool,
    }));
    this.converted_tools = this.convertedTools;
  }
}

export class LangGraphConverterAdapter extends BaseConverterAdapter {
  converter: Converter | null = null;

  configureStructuredOutput(task: unknown): void {
    this.configureFormatFromTask(task);
  }

  enhanceSystemPrompt(basePrompt: string): string {
    return appendStructuredOutputPrompt(basePrompt, this.outputFormat, this.schema);
  }
}

export class LangGraphAgentAdapter extends BaseAgentAdapter {
  readonly toolAdapter: LangGraphToolAdapter;
  readonly tool_adapter: LangGraphToolAdapter;
  readonly converterAdapter: LangGraphConverterAdapter;
  readonly converter_adapter: LangGraphConverterAdapter;
  graph: unknown = null;
  _graph: unknown = null;
  graphMemory: unknown = null;
  _memory: unknown = null;

  constructor(options: AgentOptions & { model?: string; maxIterations?: number; max_iterations?: number; agentConfig?: Record<string, unknown> | null; agent_config?: Record<string, unknown> | null }) {
    const { model, maxIterations, max_iterations, ...agentOptions } = options;
    super({ ...agentOptions, llm: options.llm ?? model ?? "gpt-4o" });
    void maxIterations;
    void max_iterations;
    this.toolAdapter = new LangGraphToolAdapter(options.tools);
    this.tool_adapter = this.toolAdapter;
    this.converterAdapter = new LangGraphConverterAdapter(this);
    this.converter_adapter = this.converterAdapter;
  }

  configureTools(tools?: readonly CrewTool[] | null): void {
    this.toolAdapter.configureTools(tools ?? []);
    const graph = asRecord(this.graph);
    if (graph) {
      graph.tools = this.toolAdapter.tools();
    }
  }

  configure_tools(tools?: readonly CrewTool[] | null): void {
    this.configureTools(tools);
  }

  configureStructuredOutput(task: unknown): void {
    this.converterAdapter.configureStructuredOutput(task);
  }

  configure_structured_output(task: unknown): void {
    this.configureStructuredOutput(task);
  }

  createAgentExecutor(tools: readonly CrewTool[] | null = null): void {
    this.configureTools([...this.tools, ...(tools ?? [])]);
    this.graph = {
      tools: this.toolAdapter.tools(),
      invoke: (input: unknown) => ({ messages: [{ content: stringifyAdapterValue(input) }] }),
    };
    this._graph = this.graph;
  }

  create_agent_executor(tools: readonly CrewTool[] | null = null): void {
    this.createAgentExecutor(tools);
  }

  buildSystemPrompt(): string {
    return this.converterAdapter.enhanceSystemPrompt([
      `You are ${this.role}.`,
      `Your goal is: ${this.goal}`,
      `Your backstory: ${this.backstory}`,
      "When working on tasks, think step-by-step and use the available tools when necessary.",
    ].join("\n\n"));
  }

  _build_system_prompt(): string {
    return this.buildSystemPrompt();
  }

  async execute_task(task: unknown, context: string | null = null, tools: readonly CrewTool[] | null = null): Promise<string> {
    this.createAgentExecutor(tools);
    this.configureStructuredOutput(task);
    const taskPrompt = formatAdapterTaskPrompt(task, context);
    crewaiEventBus.emit(this, new AgentExecutionStartedEvent({
      agent: this,
      tools: this.tools,
      task,
      taskPrompt,
    }));
    try {
      const graph = asRecord(this.graph);
      if (!graph || typeof graph.invoke !== "function") {
        throw new Error("LangGraph agent graph is not configured.");
      }
      const invoke = graph.invoke as (input: unknown, config: unknown) => unknown;
      const result = await Promise.resolve(invoke({
        messages: [
          ["system", this.buildSystemPrompt()],
          ["user", taskPrompt],
        ],
      }, { configurable: { thread_id: `task_${adapterTaskId(task)}` } }));
      const messages = Array.isArray(asRecord(result)?.messages) ? asRecord(result)?.messages as unknown[] : [];
      const lastMessage = messages.at(-1);
      const finalAnswer = this.converterAdapter.postProcessResult(asRecord(lastMessage)?.content ?? lastMessage ?? "")
        || "Task execution completed but no clear answer was provided.";
      crewaiEventBus.emit(this, new AgentExecutionCompletedEvent({ agent: this, task, output: finalAnswer }));
      return finalAnswer;
    } catch (error) {
      crewaiEventBus.emit(this, new AgentExecutionErrorEvent({ agent: this, task, error }));
      throw error;
    }
  }

  get_delegation_tools(agents: readonly Agent[] = []): CrewTool[] {
    return new AgentTools(agents as ConstructorParameters<typeof AgentTools>[0]).tools();
  }

  static get_output_converter(llm: unknown, text: string, model: unknown, instructions: string): Converter {
    return new Converter({ llm: llm as ConstructorParameters<typeof Converter>[0]["llm"], text, model: model as ConstructorParameters<typeof Converter>[0]["model"], instructions });
  }
}

export const LangGraphMemorySaver = Object;
export const LangGraphCheckPointMemoryModule = Object;
export const LangGraphPrebuiltModule = Object;

export class LangGraphConverterAdapterAlias extends LangGraphConverterAdapter {}
export class OpenAIConverterAdapterAlias extends OpenAIConverterAdapter {}

export const FunctionTool = OpenAIFunctionTool;
export const Tool = OpenAITool;

function appendStructuredOutputPrompt(basePrompt: string, outputFormat: "json" | "pydantic" | null, schema: ModelDescription | null): string {
  if (!outputFormat || !schema) {
    return basePrompt;
  }
  const template = I18N_DEFAULT.slice("formatted_task_instructions");
  const instruction = template.replace("{output_format}", JSON.stringify(schema, null, 2));
  return `${basePrompt}\n\n${instruction}`;
}

function formatAdapterTaskPrompt(task: unknown, context: string | null): string {
  const taskPrompt = taskPromptFromUnknown(task);
  if (!context) {
    return taskPrompt;
  }
  return I18N_DEFAULT.slice("task_with_context")
    .replace("{task}", taskPrompt)
    .replace("{context}", context);
}

function taskPromptFromUnknown(task: unknown): string {
  const record = asRecord(task);
  if (record && typeof record.prompt === "function") {
    const prompt = record.prompt as (this: unknown) => unknown;
    return stringifyAdapterValue(prompt.call(task));
  }
  if (record && typeof record.description === "string") {
    return record.description;
  }
  return stringifyAdapterValue(task);
}

function adapterTaskId(task: unknown): string {
  const record = asRecord(task);
  return typeof record?.id === "string" || typeof record?.id === "number" ? String(record.id) : String(Date.now());
}

function modelDescriptionFromUnknown(model: unknown): ModelDescription {
  if (model && typeof model === "object" && "schema" in model) {
    return generateModelDescription(adapterString((model as { name?: unknown }).name) || "Output", (model as { schema?: Record<string, unknown> }).schema ?? {});
  }
  if (typeof model === "function") {
    return generateModelDescription(model.name || "Output", {});
  }
  return generateModelDescription("Output", {});
}

function normalizeToolArgs(args: unknown): Record<string, unknown> {
  if (typeof args === "string") {
    try {
      const parsed: unknown = JSON.parse(args);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : { input: args };
    } catch {
      return { input: args };
    }
  }
  return args && typeof args === "object" && !Array.isArray(args) ? args as Record<string, unknown> : {};
}

function extractJsonFromText(result: string): string {
  try {
    JSON.parse(result);
    return result;
  } catch {
    // Continue with extraction.
  }
  for (const pattern of [/```(?:json)?\s*([\s\S]*?)```/g, /\{[\s\S]*}/g]) {
    for (const match of result.matchAll(pattern)) {
      const candidate = (match[1] ?? match[0]).trim();
      try {
        JSON.parse(candidate);
        return candidate;
      } catch {
        // Try next candidate.
      }
    }
  }
  return result;
}

function stringifyAdapterValue(value: unknown): string {
  return adapterString(value) || "";
}

function adapterString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value.toString();
  }
  return JSON.stringify(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}
