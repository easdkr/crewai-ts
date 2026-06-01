import { mkdir, writeFile } from "node:fs/promises";
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";

import { Agent } from "./agent.js";
import type { Knowledge } from "./knowledge.js";
import {
  HumanFeedbackReceivedEvent,
  HumanFeedbackRequestedEvent,
  LLMGuardrailCompletedEvent,
  LLMGuardrailStartedEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
  TaskStartedEvent,
  crewaiEventBus,
} from "./events.js";
import { getHumanInputProvider, type HumanInputProvider } from "./human-input.js";
import { TaskOutput } from "./outputs.js";
import type { Memory, MemoryScope } from "./memory.js";
import { coerceSecurityConfig, type Fingerprint, type SecurityConfig } from "./security.js";
import { sanitizeToolName, ToolUsageLimitExceededError, ToolValidationError } from "./tools.js";
import { interpolateOnly } from "./string-utils.js";
import { OutputFormat, type AgentStepCallback, type InputValues, type LLM, type MaybePromise, type TaskCallback, type Tool } from "./types.js";
import type { AgentStep } from "./types.js";
import type { InputFile, InputFiles } from "./input-files.js";
import { storeTaskFiles } from "./file-store.js";
import { serializeModelClass, type JsonSchema } from "./schema-utils.js";

export type GuardrailResult = readonly [boolean, unknown] | { success: boolean; result: unknown };

export type Guardrail = (output: TaskOutput) => GuardrailResult | Promise<GuardrailResult>;

export type ConditionalTaskCondition = (output: TaskOutput) => MaybePromise<boolean>;

export type TaskOutputConverter = (raw: string) => MaybePromise<unknown>;

export type DeserializedModelClass = TaskOutputConverter & {
  readonly schema: Record<string, unknown>;
};

export type TaskInputFile = InputFile;

export type TaskInputFiles = InputFiles;

export type TaskExecutionOptions = {
  stepCallbacks?: readonly AgentStepCallback[];
  humanInputProvider?: HumanInputProvider | null;
  taskCallback?: TaskCallback | null;
  context?: string | null;
  triggerPayload?: unknown;
  inputFiles?: TaskInputFiles;
  functionCallingLlm?: LLM | string | null;
  memory?: Memory | MemoryScope | null;
  knowledge?: Knowledge | null;
};

type RenderedTask = {
  description: string;
  expectedOutput: string;
  prompt: string;
  inputFiles: TaskInputFiles;
};

type ExportedTaskOutput = readonly [unknown, Record<string, unknown> | null];

type TaskAsyncFuture = {
  setResult?: (value: TaskOutput) => void;
  set_result?: (value: TaskOutput) => void;
  resolve?: (value: TaskOutput) => void;
  setException?: (error: unknown) => void;
  set_exception?: (error: unknown) => void;
  reject?: (error: unknown) => void;
};

const AUTO_INJECTED_CONTENT_TYPE_PREFIXES_BY_PROVIDER: Record<string, readonly string[]> = {
  anthropic: ["image/", "application/pdf"],
  claude: ["image/", "application/pdf"],
  gemini: ["image/", "application/pdf", "audio/", "video/"],
  google: ["image/", "application/pdf", "audio/", "video/"],
  openai: ["image/", "application/pdf"],
  vertex: ["image/", "application/pdf", "audio/", "video/"],
};

export function get_supported_content_types(provider: string, api: string | null = null): string[] {
  const normalizedProvider = provider.toLowerCase();
  const normalizedApi = api?.toLowerCase() ?? "";
  const providerTypes = AUTO_INJECTED_CONTENT_TYPE_PREFIXES_BY_PROVIDER[normalizedProvider] ?? [];
  if (normalizedApi.length === 0) {
    return [...providerTypes];
  }
  const apiTypes = AUTO_INJECTED_CONTENT_TYPE_PREFIXES_BY_PROVIDER[normalizedApi] ?? [];
  return [...new Set([...providerTypes, ...apiTypes])];
}

export function is_auto_injected(content_type: string, supported_types: readonly string[]): boolean {
  return supported_types.some((supportedType) => content_type.startsWith(supportedType));
}

export function get_agent_by_role<T extends { role?: string }>(agents: readonly T[], role: string): T | null {
  return agents.find((agent) => agent.role === role) ?? null;
}

export function _serialize_model_class(value: unknown): JsonSchema | null {
  if (value === null || value === undefined) {
    return null;
  }
  if ((typeof value === "function" || isRecord(value)) && "schema" in value) {
    const schema = (value as { schema?: unknown }).schema;
    if (isRecord(schema)) {
      return schema;
    }
  }
  return serializeModelClass(value);
}

export function _deserialize_model_class(value: unknown): TaskOutputConverter | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "function") {
    return value as TaskOutputConverter;
  }
  if (!isRecord(value)) {
    return null;
  }
  const schema = { ...value };
  const converter = ((raw: string): unknown => {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return parsed;
    }
    const properties = isRecord(schema.properties) ? schema.properties : null;
    if (!properties) {
      return parsed;
    }
    const selected: Record<string, unknown> = {};
    for (const key of Object.keys(properties)) {
      if (key in parsed) {
        selected[key] = parsed[key];
      }
    }
    return selected;
  }) as DeserializedModelClass;
  Object.defineProperty(converter, "schema", {
    value: schema,
    enumerable: true,
  });
  return converter;
}

export type TaskOptions = {
  id?: string;
  name?: string | null;
  description: string;
  expectedOutput?: string;
  expected_output?: string;
  config?: Record<string, unknown> | null;
  promptContext?: string | null;
  prompt_context?: string | null;
  agent?: Agent | null;
  context?: readonly Task[] | null | undefined;
  tools?: readonly Tool[];
  callback?: TaskCallback | null;
  callbacks?: readonly TaskCallback[];
  outputJson?: boolean | null;
  output_json?: boolean | null;
  outputPydantic?: ((raw: string) => unknown) | null;
  output_pydantic?: ((raw: string) => unknown) | null;
  outputConverter?: TaskOutputConverter | null;
  output_converter?: TaskOutputConverter | null;
  converterCls?: TaskOutputConverter | null;
  converter_cls?: TaskOutputConverter | null;
  responseModel?: unknown;
  response_model?: unknown;
  outputFile?: string | null;
  output_file?: string | null;
  inputFiles?: TaskInputFiles;
  input_files?: TaskInputFiles;
  createDirectory?: boolean;
  create_directory?: boolean;
  asyncExecution?: boolean;
  async_execution?: boolean;
  humanInput?: boolean;
  human_input?: boolean;
  markdown?: boolean;
  allowCrewaiTriggerContext?: boolean | null;
  allow_crewai_trigger_context?: boolean | null;
  guardrail?: Guardrail | null;
  guardrails?: Guardrail | readonly Guardrail[] | null;
  guardrailMaxRetries?: number;
  guardrail_max_retries?: number;
  max_retries?: number | null;
  retryCount?: number;
  retry_count?: number;
  usedTools?: number;
  used_tools?: number;
  toolsErrors?: number;
  tools_errors?: number;
  delegations?: number;
  processedByAgents?: Iterable<string>;
  processed_by_agents?: Iterable<string>;
  startTime?: Date | string | null;
  start_time?: Date | string | null;
  endTime?: Date | string | null;
  end_time?: Date | string | null;
  output?: TaskOutput | null;
  checkpointOriginalDescription?: string | null;
  checkpoint_original_description?: string | null;
  checkpointOriginalExpectedOutput?: string | null;
  checkpoint_original_expected_output?: string | null;
  checkpointOriginalOutputFile?: string | null;
  checkpoint_original_output_file?: string | null;
  securityConfig?: SecurityConfig | null;
  security_config?: SecurityConfig | null;
};

export class Task {
  readonly id: string;
  readonly name: string | null;
  description: string;
  expectedOutput: string;
  expected_output: string;
  readonly config: Record<string, unknown> | null;
  readonly agent: Agent | null;
  readonly context: readonly Task[] | null | undefined;
  readonly tools: readonly Tool[];
  readonly callback: TaskCallback | null;
  readonly callbacks: readonly TaskCallback[];
  readonly outputJson: boolean | null;
  readonly output_json: boolean | null;
  readonly outputPydantic: ((raw: string) => unknown) | null;
  readonly output_pydantic: ((raw: string) => unknown) | null;
  readonly outputConverter: TaskOutputConverter | null;
  readonly output_converter: TaskOutputConverter | null;
  readonly converterCls: TaskOutputConverter | null;
  readonly converter_cls: TaskOutputConverter | null;
  readonly responseModel: unknown;
  readonly response_model: unknown;
  outputFile: string | null;
  output_file: string | null;
  readonly inputFiles: TaskInputFiles;
  readonly input_files: TaskInputFiles;
  readonly createDirectory: boolean;
  readonly create_directory: boolean;
  readonly asyncExecution: boolean;
  readonly async_execution: boolean;
  readonly humanInput: boolean;
  readonly human_input: boolean;
  readonly markdown: boolean;
  allowCrewaiTriggerContext: boolean | null;
  allow_crewai_trigger_context: boolean | null;
  readonly guardrail: Guardrail | null;
  readonly guardrails: readonly Guardrail[];
  guardrailMaxRetries: number;
  guardrail_max_retries: number;
  readonly maxRetries: number | null;
  readonly max_retries: number | null;
  readonly securityConfig: SecurityConfig;
  readonly security_config: SecurityConfig;
  usedTools = 0;
  used_tools = 0;
  toolsErrors = 0;
  tools_errors = 0;
  delegations = 0;
  retryCount = 0;
  retry_count = 0;
  startTime: Date | null = null;
  start_time: Date | null = null;
  endTime: Date | null = null;
  end_time: Date | null = null;
  promptContext: string | null = null;
  prompt_context: string | null = null;
  readonly processedByAgents: Set<string>;
  processed_by_agents: Set<string>;
  output: TaskOutput | null = null;
  checkpointOriginalDescription: string | null;
  checkpoint_original_description: string | null;
  checkpointOriginalExpectedOutput: string | null;
  checkpoint_original_expected_output: string | null;
  checkpointOriginalOutputFile: string | null;
  checkpoint_original_output_file: string | null;
  private executionPlan: string | null = null;
  private readonly guardrailRetryCounts = new Map<number, number>();

  constructor(options: TaskOptions) {
    this.id = options.id ?? randomUUID();
    this.name = options.name ?? null;
    this.description = options.description;
    this.expectedOutput = options.expectedOutput ?? options.expected_output ?? "";
    this.expected_output = this.expectedOutput;
    this.config = options.config ?? null;
    this.agent = options.agent ?? null;
    this.context = options.context;
    this.tools = options.tools ?? [];
    this.callback = options.callback ?? null;
    this.callbacks = options.callbacks ?? [];
    this.outputJson = options.outputJson ?? options.output_json ?? null;
    this.output_json = this.outputJson;
    this.outputPydantic = options.outputPydantic ?? options.output_pydantic ?? null;
    this.output_pydantic = this.outputPydantic;
    this.outputConverter = options.outputConverter ?? options.output_converter ?? options.converterCls ?? options.converter_cls ?? null;
    this.output_converter = this.outputConverter;
    this.converterCls = this.outputConverter;
    this.converter_cls = this.outputConverter;
    this.responseModel = options.responseModel ?? options.response_model;
    this.response_model = this.responseModel;
    this.outputFile = validateOutputFile(options.outputFile ?? options.output_file ?? null);
    this.output_file = this.outputFile;
    this.inputFiles = options.inputFiles ?? options.input_files ?? {};
    this.input_files = this.inputFiles;
    this.createDirectory = options.createDirectory ?? options.create_directory ?? true;
    this.create_directory = this.createDirectory;
    this.asyncExecution = options.asyncExecution ?? options.async_execution ?? false;
    this.async_execution = this.asyncExecution;
    this.humanInput = options.humanInput ?? options.human_input ?? false;
    this.human_input = this.humanInput;
    this.markdown = options.markdown ?? false;
    this.allowCrewaiTriggerContext = options.allowCrewaiTriggerContext ?? options.allow_crewai_trigger_context ?? null;
    this.allow_crewai_trigger_context = this.allowCrewaiTriggerContext;
    this.guardrails = normalizeGuardrails(options.guardrails);
    this.guardrail = this.guardrails.length > 0 ? null : options.guardrail ?? null;
    this.guardrailMaxRetries = options.guardrailMaxRetries ?? options.guardrail_max_retries ?? options.max_retries ?? 3;
    this.guardrail_max_retries = this.guardrailMaxRetries;
    this.maxRetries = options.max_retries ?? null;
    this.max_retries = this.maxRetries;
    this.retryCount = options.retryCount ?? options.retry_count ?? 0;
    this.retry_count = this.retryCount;
    this.usedTools = options.usedTools ?? options.used_tools ?? 0;
    this.used_tools = this.usedTools;
    this.toolsErrors = options.toolsErrors ?? options.tools_errors ?? 0;
    this.tools_errors = this.toolsErrors;
    this.delegations = options.delegations ?? 0;
    this.startTime = normalizeTaskDate(options.startTime ?? options.start_time ?? null);
    this.start_time = this.startTime;
    this.endTime = normalizeTaskDate(options.endTime ?? options.end_time ?? null);
    this.end_time = this.endTime;
    this.promptContext = options.promptContext ?? options.prompt_context ?? null;
    this.prompt_context = this.promptContext;
    this.processedByAgents = new Set(options.processedByAgents ?? options.processed_by_agents ?? []);
    this.processed_by_agents = this.processedByAgents;
    this.output = options.output ?? null;
    this.checkpointOriginalDescription = options.checkpointOriginalDescription ?? options.checkpoint_original_description ?? null;
    this.checkpoint_original_description = this.checkpointOriginalDescription;
    this.checkpointOriginalExpectedOutput = options.checkpointOriginalExpectedOutput ?? options.checkpoint_original_expected_output ?? null;
    this.checkpoint_original_expected_output = this.checkpointOriginalExpectedOutput;
    this.checkpointOriginalOutputFile = options.checkpointOriginalOutputFile ?? options.checkpoint_original_output_file ?? null;
    this.checkpoint_original_output_file = this.checkpointOriginalOutputFile;
    this.securityConfig = coerceSecurityConfig(options.securityConfig ?? options.security_config ?? null);
    this.security_config = this.securityConfig;
    this.checkOutput();
    this.handleMaxRetriesDeprecation();
  }

  get fingerprint(): Fingerprint {
    return this.securityConfig.fingerprint;
  }

  get key(): string {
    const description = this.checkpointOriginalDescription ?? this.description;
    const expectedOutput = this.checkpointOriginalExpectedOutput ?? this.expectedOutput;
    return createHash("md5").update(`${description}|${expectedOutput}`).digest("hex");
  }

  get executionDuration(): number | null {
    if (!this.startTime || !this.endTime) {
      return null;
    }
    return (this.endTime.getTime() - this.startTime.getTime()) / 1000;
  }

  get execution_duration(): number | null {
    return this.executionDuration;
  }

  validateGuardrailFunction(value: Guardrail | string | null = this.guardrail): Guardrail | string | null {
    if (typeof value === "function" && value.length !== 1) {
      throw new Error("Guardrail function must accept exactly one parameter");
    }
    return value;
  }

  validate_guardrail_function(value?: Guardrail | string | null): Guardrail | string | null {
    return this.validateGuardrailFunction(value ?? this.guardrail);
  }

  processModelConfig(values: Record<string, unknown>): Record<string, unknown> {
    return { ...values };
  }

  process_model_config(values: Record<string, unknown>): Record<string, unknown> {
    return this.processModelConfig(values);
  }

  validateRequiredFields(): this {
    if (!this.description) {
      throw new Error("description must be provided either directly or through config");
    }
    if (!this.expectedOutput) {
      throw new Error("expected_output must be provided either directly or through config");
    }
    return this;
  }

  validate_required_fields(): this {
    return this.validateRequiredFields();
  }

  ensureGuardrailIsCallable(): this {
    if (this.guardrail) {
      this.validateGuardrailFunction(this.guardrail);
    }
    return this;
  }

  ensure_guardrail_is_callable(): this {
    return this.ensureGuardrailIsCallable();
  }

  ensureGuardrailsIsListOfCallables(): this {
    for (const guardrail of this.guardrails) {
      this.validateGuardrailFunction(guardrail);
    }
    return this;
  }

  ensure_guardrails_is_list_of_callables(): this {
    return this.ensureGuardrailsIsListOfCallables();
  }

  outputFileValidation(value: string | null): string | null {
    return validateOutputFile(value);
  }

  output_file_validation(value: string | null): string | null {
    return this.outputFileValidation(value);
  }

  static denyUserSetId(value: string | null | undefined, context: { fromCheckpoint?: boolean; from_checkpoint?: boolean } | null = null): string | null | undefined {
    if (value && !(context?.fromCheckpoint ?? context?.from_checkpoint ?? false)) {
      throw new Error("The 'id' field cannot be set by the user.");
    }
    return value;
  }

  static _deny_user_set_id(value: string | null | undefined, context: { fromCheckpoint?: boolean; from_checkpoint?: boolean } | null = null): string | null | undefined {
    return Task.denyUserSetId(value, context);
  }

  static normalizeInputFiles<T extends TaskInputFiles | null | undefined>(value: T): T {
    return value;
  }

  static _normalize_input_files<T extends TaskInputFiles | null | undefined>(value: T): T {
    return Task.normalizeInputFiles(value);
  }

  setAttributesBasedOnConfig(): this {
    if (!this.config) {
      return this;
    }
    for (const [key, value] of Object.entries(this.config)) {
      (this as unknown as Record<string, unknown>)[key] = value;
    }
    return this;
  }

  set_attributes_based_on_config(): this {
    return this.setAttributesBasedOnConfig();
  }

  checkTools(): this {
    if (this.tools.length === 0 && this.agent?.tools) {
      (this as unknown as { tools: readonly Tool[] }).tools = this.agent.tools;
    }
    return this;
  }

  check_tools(): this {
    return this.checkTools();
  }

  checkOutput(): this {
    const configuredOutputs = [this.outputJson, this.outputPydantic].filter(Boolean);
    if (configuredOutputs.length > 1) {
      throw new Error("Only one output type can be set, either output_pydantic or output_json.");
    }
    return this;
  }

  check_output(): this {
    return this.checkOutput();
  }

  handleMaxRetriesDeprecation(): this {
    if (this.max_retries !== null) {
      process.emitWarning(
        "The 'max_retries' parameter is deprecated and will be removed in CrewAI v1.0.0. Please use 'guardrail_max_retries' instead.",
        "DeprecationWarning",
      );
      this.guardrailMaxRetries = this.max_retries;
      this.guardrail_max_retries = this.max_retries;
    }
    return this;
  }

  handle_max_retries_deprecation(): this {
    return this.handleMaxRetriesDeprecation();
  }

  executeSync(agent: Agent | null = null, context: string | null = null, tools?: readonly Tool[]): Promise<TaskOutput> {
    return this.execute({}, agent, tools, false, { context });
  }

  execute_sync(agent: Agent | null = null, context: string | null = null, tools?: readonly Tool[]): Promise<TaskOutput> {
    return this.executeSync(agent, context, tools);
  }

  executeAsync(agent: Agent | null = null, context: string | null = null, tools?: readonly Tool[]): Promise<TaskOutput> {
    return this.executeSync(agent, context, tools);
  }

  execute_async(agent: Agent | null = null, context: string | null = null, tools?: readonly Tool[]): Promise<TaskOutput> {
    return this.executeAsync(agent, context, tools);
  }

  async executeCore(agent: Agent | null = null, context: string | null = null, tools?: readonly Tool[] | null): Promise<TaskOutput> {
    return await this.execute({}, agent, tools ?? undefined, false, { context });
  }

  async _execute_core(agent: Agent | null = null, context: string | null = null, tools?: readonly Tool[] | null): Promise<TaskOutput> {
    return await this.executeCore(agent, context, tools);
  }

  async aexecuteCore(agent: Agent | null = null, context: string | null = null, tools?: readonly Tool[] | null): Promise<TaskOutput> {
    return await this.executeCore(agent, context, tools);
  }

  async _aexecute_core(agent: Agent | null = null, context: string | null = null, tools?: readonly Tool[] | null): Promise<TaskOutput> {
    return await this.aexecuteCore(agent, context, tools);
  }

  executeTaskAsync(
    agent: Agent | null,
    context: string | null,
    tools: readonly Tool[] | null,
    future: TaskAsyncFuture,
  ): void {
    this.startTime = new Date();
    this.start_time = this.startTime;
    void this.executeCore(agent, context, tools).then(
      (result) => {
        future.setResult?.(result);
        future.set_result?.(result);
        future.resolve?.(result);
      },
      (error: unknown) => {
        future.setException?.(error);
        future.set_exception?.(error);
        future.reject?.(error);
      },
    );
  }

  _execute_task_async(
    agent: Agent | null,
    context: string | null,
    tools: readonly Tool[] | null,
    future: TaskAsyncFuture,
  ): void {
    this.executeTaskAsync(agent, context, tools, future);
  }

  aexecuteSync(agent: Agent | null = null, context: string | null = null, tools?: readonly Tool[]): Promise<TaskOutput> {
    return this.executeSync(agent, context, tools);
  }

  aexecute_sync(agent: Agent | null = null, context: string | null = null, tools?: readonly Tool[]): Promise<TaskOutput> {
    return this.aexecuteSync(agent, context, tools);
  }

  postAgentExecution(agent: Agent): void {
    void agent;
  }

  _post_agent_execution(agent: Agent): void {
    this.postAgentExecution(agent);
  }

  prompt(): string {
    const parts = [
      this.description,
      `Expected output: ${this.expectedOutput}`,
      this.markdown
        ? [
            "Your final answer MUST be formatted in Markdown syntax.",
            "Use # for headers, **bold**, *italic*, bullet points, inline code, and fenced code blocks when useful.",
          ].join("\n")
        : null,
    ];
    return parts.filter((part): part is string => Boolean(part)).join("\n");
  }

  interpolateInputsAndAddConversationHistory(inputs: InputValues): void {
    if (this.checkpointOriginalDescription === null) {
      this.checkpointOriginalDescription = this.description;
      this.checkpoint_original_description = this.checkpointOriginalDescription;
    }
    if (this.checkpointOriginalExpectedOutput === null) {
      this.checkpointOriginalExpectedOutput = this.expectedOutput;
      this.checkpoint_original_expected_output = this.checkpointOriginalExpectedOutput;
    }
    if (this.outputFile !== null && this.checkpointOriginalOutputFile === null) {
      this.checkpointOriginalOutputFile = this.outputFile;
      this.checkpoint_original_output_file = this.checkpointOriginalOutputFile;
    }
    if (Object.keys(inputs).length === 0) {
      return;
    }
    try {
      this.description = interpolateOnly(this.checkpointOriginalDescription, inputs, { strictMissing: true });
    } catch (error) {
      throw new Error(`Error interpolating description: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
    try {
      this.expectedOutput = interpolateOnly(this.checkpointOriginalExpectedOutput, inputs, { strictMissing: true });
      this.expected_output = this.expectedOutput;
    } catch (error) {
      throw new Error(`Error interpolating expected_output: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
    if (this.outputFile !== null && this.checkpointOriginalOutputFile !== null) {
      try {
        this.outputFile = interpolateOnly(this.checkpointOriginalOutputFile, inputs, { strictMissing: true });
        this.output_file = this.outputFile;
      } catch (error) {
        throw new Error(`Error interpolating output_file path: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      }
    }
    const chatMessages = inputs.crew_chat_messages;
    if (chatMessages === undefined || chatMessages === null) {
      return;
    }
    const messages = typeof chatMessages === "string" ? JSON.parse(chatMessages) as unknown : chatMessages;
    if (!Array.isArray(messages)) {
      return;
    }
    const conversationHistory = messages
      .filter((message): message is { role: string; content: string } => (
        typeof message === "object"
        && message !== null
        && typeof (message as { role?: unknown }).role === "string"
        && typeof (message as { content?: unknown }).content === "string"
      ))
      .map((message) => `${capitalize(message.role)}: ${message.content}`)
      .join("\n");
    if (conversationHistory) {
      this.description += `\n\nConversation history:\n\n${conversationHistory}`;
    }
  }

  interpolate_inputs_and_add_conversation_history(inputs: InputValues): void {
    this.interpolateInputsAndAddConversationHistory(inputs);
  }

  incrementToolsErrors(): void {
    this.toolsErrors += 1;
    this.tools_errors = this.toolsErrors;
  }

  increment_tools_errors(): void {
    this.incrementToolsErrors();
  }

  incrementDelegations(agentName?: string | null): void {
    if (agentName) {
      this.processedByAgents.add(agentName);
    }
    this.delegations += 1;
    this.processed_by_agents = this.processedByAgents;
  }

  increment_delegations(agentName?: string | null): void {
    this.incrementDelegations(agentName);
  }

  storeInputFiles(): void {
    if (Object.keys(this.inputFiles).length === 0) {
      return;
    }
    storeTaskFiles(this.id, this.inputFiles);
  }

  _store_input_files(): void {
    this.storeInputFiles();
  }

  async exportOutput(result: unknown): Promise<ExportedTaskOutput> {
    if (!this.outputPydantic && !this.outputJson) {
      return [null, null];
    }
    const raw = stringifyGuardrailValue(result);
    const converted = this.outputConverter ? await this.outputConverter(raw) : undefined;
    if (this.outputPydantic) {
      return [converted ?? this.outputPydantic(raw), null];
    }
    return [null, parseConvertedJsonObject(converted, raw)];
  }

  _export_output(result: unknown): ExportedTaskOutput | Promise<ExportedTaskOutput> {
    const raw = stringifyGuardrailValue(result);
    if (!this.outputPydantic && !this.outputJson) {
      return [null, null];
    }
    if (!this.outputConverter) {
      if (this.outputPydantic) {
        return [this.outputPydantic(raw), null];
      }
      return [null, parseConvertedJsonObject(undefined, raw)];
    }
    return this.exportOutput(raw);
  }

  async aexportOutput(result: unknown): Promise<ExportedTaskOutput> {
    return await this.exportOutput(result);
  }

  async _aexport_output(result: unknown): Promise<ExportedTaskOutput> {
    return await this.aexportOutput(result);
  }

  static unpackModelOutput(modelOutput: unknown): ExportedTaskOutput {
    if (typeof modelOutput === "string") {
      try {
        return [null, parseJsonObject(modelOutput)];
      } catch {
        return [null, null];
      }
    }
    if (modelOutput && typeof modelOutput === "object" && !Array.isArray(modelOutput)) {
      return [null, modelOutput as Record<string, unknown>];
    }
    return [null, null];
  }

  static _unpack_model_output(modelOutput: unknown): ExportedTaskOutput {
    return Task.unpackModelOutput(modelOutput);
  }

  getOutputFormat(): OutputFormat {
    if (this.outputJson) {
      return OutputFormat.JSON;
    }
    if (this.outputPydantic) {
      return OutputFormat.PYDANTIC;
    }
    return OutputFormat.RAW;
  }

  _get_output_format(): OutputFormat {
    return this.getOutputFormat();
  }

  saveFile(result: unknown): void {
    if (this.outputFile === null) {
      throw new Error("output_file is not set.");
    }
    const outputPath = resolve(this.outputFile);
    const directory = dirname(outputPath);
    if (this.createDirectory) {
      mkdirSync(directory, { recursive: true });
    }
    const content = result && typeof result === "object" && !Array.isArray(result)
      ? JSON.stringify(result, null, 2)
      : String(result);
    writeFileSync(outputPath, content, "utf8");
  }

  _save_file(result: unknown): void {
    this.saveFile(result);
  }

  toString(): string {
    return `Task(description=${this.description}, expected_output=${this.expectedOutput})`;
  }

  __repr__(): string {
    return this.toString();
  }

  async invokeGuardrailFunction(
    taskOutput: TaskOutput,
    agent: Agent,
    tools: readonly Tool[],
    guardrail: Guardrail | null,
    guardrailIndex?: number | null,
  ): Promise<TaskOutput> {
    if (!guardrail) {
      return taskOutput;
    }
    let output = taskOutput;
    let currentRetryCount = guardrailIndex === undefined || guardrailIndex === null
      ? this.retryCount
      : this.guardrailRetryCounts.get(guardrailIndex) ?? 0;
    for (let attempt = 0; attempt <= this.guardrailMaxRetries; attempt += 1) {
      crewaiEventBus.emit(this, new LLMGuardrailStartedEvent({
        guardrail,
        retry_count: currentRetryCount,
        from_task: this,
        from_agent: agent,
      }));
      const result = await guardrail(output);
      const [success, nextValue] = isGuardrailTuple(result)
        ? result
        : [result.success, result.result];
      crewaiEventBus.emit(this, new LLMGuardrailCompletedEvent({
        success,
        result: nextValue,
        ...(success ? {} : { error: nextValue }),
        retry_count: currentRetryCount,
        from_task: this,
        from_agent: agent,
      }));
      if (success) {
        if (nextValue === null || nextValue === undefined) {
          throw new Error("Task guardrail returned None as result. This is not allowed.");
        }
        return await this.normalizeGuardrailOutput(nextValue, output, agent);
      }
      if (attempt >= this.guardrailMaxRetries) {
        const guardrailName = guardrailIndex === undefined || guardrailIndex === null
          ? "guardrail"
          : `guardrail ${String(guardrailIndex)}`;
        throw new Error(`Task failed ${guardrailName} validation after ${String(this.guardrailMaxRetries)} retries. Last error: ${String(nextValue)}`);
      }
      if (guardrailIndex === undefined || guardrailIndex === null) {
        this.retryCount += 1;
        this.retry_count = this.retryCount;
        currentRetryCount = this.retryCount;
      } else {
        currentRetryCount += 1;
        this.guardrailRetryCounts.set(guardrailIndex, currentRetryCount);
      }
      const context = [
        `Validation error: ${String(nextValue)}`,
        `Task output: ${output.raw}`,
      ].join("\n");
      const raw = await agent.executeTask(context, {}, tools, { task: this });
      output = await this.createOutput(raw, agent, {
        description: output.description,
        expectedOutput: output.expectedOutput ?? this.expectedOutput,
        prompt: "",
        inputFiles: {},
      });
    }
    return output;
  }

  async _invoke_guardrail_function(
    task_output: TaskOutput,
    agent: Agent,
    tools: readonly Tool[],
    guardrail: Guardrail | null,
    guardrail_index?: number | null,
  ): Promise<TaskOutput> {
    return await this.invokeGuardrailFunction(task_output, agent, tools, guardrail, guardrail_index);
  }

  async ainvokeGuardrailFunction(
    taskOutput: TaskOutput,
    agent: Agent,
    tools: readonly Tool[],
    guardrail: Guardrail | null,
    guardrailIndex?: number | null,
  ): Promise<TaskOutput> {
    return await this.invokeGuardrailFunction(taskOutput, agent, tools, guardrail, guardrailIndex);
  }

  async _ainvoke_guardrail_function(
    task_output: TaskOutput,
    agent: Agent,
    tools: readonly Tool[],
    guardrail: Guardrail | null,
    guardrail_index?: number | null,
  ): Promise<TaskOutput> {
    return await this.ainvokeGuardrailFunction(task_output, agent, tools, guardrail, guardrail_index);
  }

  copy(agents: readonly Agent[] = [], taskMapping: Record<string, Task> = {}): Task {
    const clonedContext = Array.isArray(this.context)
      ? this.context.map((contextTask: Task) => taskMapping[contextTask.key] ?? contextTask)
      : this.context;
    const clonedAgent = this.agent ? get_agent_by_role(agents, this.agent.role) ?? this.agent : null;
    return new (this.constructor as new (options: TaskOptions) => Task)({
      name: this.name,
      description: this.checkpointOriginalDescription ?? this.description,
      expectedOutput: this.checkpointOriginalExpectedOutput ?? this.expectedOutput,
      config: this.config ? { ...this.config } : null,
      agent: clonedAgent,
      context: clonedContext,
      tools: [...this.tools],
      callback: this.callback,
      callbacks: [...this.callbacks],
      outputJson: this.outputJson,
      outputPydantic: this.outputPydantic,
      outputConverter: this.outputConverter,
      responseModel: this.responseModel,
      outputFile: this.checkpointOriginalOutputFile ?? this.outputFile,
      inputFiles: { ...this.inputFiles },
      createDirectory: this.createDirectory,
      asyncExecution: this.asyncExecution,
      humanInput: this.humanInput,
      markdown: this.markdown,
      allowCrewaiTriggerContext: this.allowCrewaiTriggerContext,
      guardrail: this.guardrail,
      guardrails: this.guardrails,
      guardrailMaxRetries: this.guardrailMaxRetries,
      securityConfig: this.securityConfig,
    });
  }

  setExecutionPlan(plan: string | null): void {
    const normalized = plan?.trim() ?? "";
    this.executionPlan = normalized || null;
  }

  clearExecutionPlan(): void {
    this.executionPlan = null;
  }

  async execute(
    inputs: InputValues = {},
    fallbackAgent?: Agent | null,
    overrideTools?: readonly Tool[],
    forceFallbackAgent = false,
    stepCallbacksOrOptions: readonly AgentStepCallback[] | TaskExecutionOptions = [],
  ): Promise<TaskOutput> {
    const executionOptions = normalizeTaskExecutionOptions(stepCallbacksOrOptions);
    const agent = forceFallbackAgent ? fallbackAgent ?? this.agent : this.agent ?? fallbackAgent;
    if (!agent) {
      throw new Error(`Task '${this.name ?? this.description}' has no agent.`);
    }
    this.startTime = new Date();
    this.start_time = this.startTime;
    this.endTime = null;
    this.end_time = null;

    const renderedTask = this.buildPrompt(
      inputs,
      executionOptions.context,
      executionOptions.triggerPayload,
      executionOptions.inputFiles,
    );
    this.storeInputFiles();
    this.promptContext = this.renderContext(executionOptions.context) || null;
    this.prompt_context = this.promptContext;
    crewaiEventBus.emit(this, new TaskStartedEvent({
      taskName: this.name,
      taskDescription: renderedTask.description,
      context: this.promptContext,
    }));
    try {
      const tools = overrideTools ?? (this.tools.length > 0 ? this.tools : agent.tools);
      const raw = await agent.executeTask(renderedTask.prompt, inputs, tools, {
        ...(this.responseModel === undefined ? {} : { responseModel: this.responseModel }),
        stepCallbacks: [
          this.createTrackingStepCallback(agent),
          ...(executionOptions.stepCallbacks ?? []),
        ],
        inputFiles: renderedTask.inputFiles,
        ...(executionOptions.functionCallingLlm === undefined
          ? {}
          : { functionCallingLlm: executionOptions.functionCallingLlm }),
        ...(executionOptions.memory === undefined ? {} : { memory: executionOptions.memory }),
        ...(executionOptions.knowledge === undefined ? {} : { knowledge: executionOptions.knowledge }),
        task: this,
      });
      let output = await this.createOutput(raw, agent, renderedTask);

      for (const [guardrail, index] of this.effectiveGuardrailEntries()) {
        output = await this.runGuardrail(guardrail, output, agent, index, inputs, tools, renderedTask);
      }
      output = await this.handleHumanInput(output, agent, inputs, tools, renderedTask, executionOptions);

      this.processedByAgents.add(agent.role);
      this.output = output;
      await this.callback?.(output);
      for (const callback of this.callbacks) {
        await callback(output);
      }
      if (
        executionOptions.taskCallback
        && executionOptions.taskCallback !== this.callback
        && !this.callbacks.includes(executionOptions.taskCallback)
      ) {
        await executionOptions.taskCallback(output);
      }
      await this.saveOutputFile(output, inputs);
      this.endTime = new Date();
      this.end_time = this.endTime;
      crewaiEventBus.emit(this, new TaskCompletedEvent({
        taskName: this.name,
        taskDescription: renderedTask.description,
        output,
      }));
      return output;
    } catch (error) {
      if (isToolExecutionError(error)) {
        this.incrementToolsErrors();
      }
      this.endTime = new Date();
      this.end_time = this.endTime;
      crewaiEventBus.emit(this, new TaskFailedEvent({
        taskName: this.name,
        taskDescription: renderedTask.description,
        error,
      }));
      throw error;
    }
  }

  private buildPrompt(
    inputs: InputValues,
    contextOverride?: string | null,
    triggerPayload?: unknown,
    inputFilesOverride?: TaskInputFiles,
  ): RenderedTask {
    const description = this.descriptionWithTriggerPayload(interpolateOnly(this.description, inputs, { strictMissing: false }), triggerPayload);
    const expectedOutput = interpolateOnly(this.expectedOutput, inputs, { strictMissing: false });
    const context = this.renderContext(contextOverride);
    const inputFiles = { ...(inputFilesOverride ?? {}), ...this.inputFiles };
    const parts = [
      `Task: ${description}`,
      `Expected output: ${expectedOutput}`,
      this.executionPlan ? `Planning:\n${this.executionPlan}` : null,
      context ? `Context:\n${context}` : null,
      this.markdown ? "Return the final answer formatted as Markdown." : null,
    ];
    return {
      description,
      expectedOutput,
      prompt: parts.filter((part): part is string => part !== null).join("\n\n"),
      inputFiles,
    };
  }

  private descriptionWithTriggerPayload(description: string, triggerPayload: unknown): string {
    if (triggerPayload === undefined || triggerPayload === null) {
      return description;
    }
    return `${description}\n\nTrigger Payload: ${formatTriggerPayload(triggerPayload)}`;
  }

  private renderContext(contextOverride?: string | null): string {
    if (contextOverride !== undefined) {
      return contextOverride ?? "";
    }
    if (!this.context) {
      return "";
    }
    return this.context
      .map((task) => task.output?.toString())
      .filter((value): value is string => Boolean(value))
      .join("\n\n");
  }

  private async createOutput(raw: string, agent: Agent, renderedTask?: RenderedTask): Promise<TaskOutput> {
    const converted = this.outputConverter ? await this.outputConverter(raw) : undefined;
    const pydantic = this.outputPydantic ? converted ?? this.outputPydantic(raw) : null;
    const jsonDict = this.outputJson ? parseConvertedJsonObject(converted, raw) : null;
    const outputFormat = this.outputJson
      ? OutputFormat.JSON
      : this.outputPydantic
        ? OutputFormat.PYDANTIC
        : OutputFormat.RAW;

    return new TaskOutput({
      description: renderedTask?.description ?? this.description,
      name: this.name,
      expectedOutput: renderedTask?.expectedOutput ?? this.expectedOutput,
      raw,
      jsonDict,
      pydantic,
      agent: agent.role,
      outputFormat,
    });
  }

  private effectiveGuardrailEntries(): readonly (readonly [Guardrail, number | null])[] {
    if (this.guardrails.length > 0) {
      return this.guardrails.map((guardrail, index) => [guardrail, index] as const);
    }
    return this.guardrail ? [[this.guardrail, null] as const] : [];
  }

  private async runGuardrail(
    guardrail: Guardrail,
    initialOutput: TaskOutput,
    agent: Agent,
    index: number | null,
    inputs: InputValues = {},
    tools: readonly Tool[] = [],
    renderedTask?: RenderedTask,
  ): Promise<TaskOutput> {
    let output = initialOutput;
    let currentRetryCount = index === null
      ? this.retryCount
      : this.guardrailRetryCounts.get(index) ?? 0;
    for (let attempt = 0; attempt <= this.guardrailMaxRetries; attempt += 1) {
      crewaiEventBus.emit(this, new LLMGuardrailStartedEvent({
        guardrail,
        retry_count: currentRetryCount,
        from_task: this,
        from_agent: agent,
      }));
      const result = await guardrail(output);
      const [success, nextValue] = isGuardrailTuple(result)
        ? result
        : [result.success, result.result];
      crewaiEventBus.emit(this, new LLMGuardrailCompletedEvent({
        success,
        result: nextValue,
        ...(success ? {} : { error: nextValue }),
        retry_count: currentRetryCount,
        from_task: this,
        from_agent: agent,
      }));
      if (success) {
        return await this.normalizeGuardrailOutput(nextValue, output, agent);
      }
      if (attempt === this.guardrailMaxRetries) {
        const guardrailName = index === null ? "guardrail" : `guardrail ${String(index)}`;
        throw new Error(`Task failed ${guardrailName} validation after ${String(this.guardrailMaxRetries)} retries. Last error: ${String(nextValue)}`);
      }
      if (index === null) {
        this.retryCount += 1;
        this.retry_count = this.retryCount;
        currentRetryCount = this.retryCount;
      } else {
        currentRetryCount += 1;
        this.guardrailRetryCounts.set(index, currentRetryCount);
      }
      const context = [
        `Validation error: ${String(nextValue)}`,
        `Task output: ${output.raw}`,
      ].join("\n");
      const raw = await agent.executeTask(context, inputs, tools, {
        task: this,
        ...(renderedTask === undefined ? {} : { inputFiles: renderedTask.inputFiles }),
      });
      output = await this.createOutput(raw, agent, {
        description: output.description,
        expectedOutput: output.expectedOutput ?? this.expectedOutput,
        prompt: "",
        inputFiles: renderedTask?.inputFiles ?? {},
      });
    }
    return output;
  }

  private async normalizeGuardrailOutput(value: unknown, previousOutput: TaskOutput, agent: Agent): Promise<TaskOutput> {
    if (value instanceof TaskOutput) {
      return value;
    }
    const raw = value === undefined || value === null ? previousOutput.raw : stringifyGuardrailValue(value);
    return this.createOutput(raw, agent, {
      description: previousOutput.description,
      expectedOutput: previousOutput.expectedOutput ?? this.expectedOutput,
      prompt: "",
      inputFiles: {},
    });
  }

  private async handleHumanInput(
    initialOutput: TaskOutput,
    agent: Agent,
    inputs: InputValues,
    tools: readonly Tool[],
    renderedTask: RenderedTask,
    options: TaskExecutionOptions,
  ): Promise<TaskOutput> {
    if (!this.humanInput) {
      return initialOutput;
    }

    let output = initialOutput;
    const provider = options.humanInputProvider ?? getHumanInputProvider();
    let accepted = false;
    while (!accepted) {
      crewaiEventBus.emit(this, new HumanFeedbackRequestedEvent({
        taskName: this.name,
        taskDescription: renderedTask.description,
        output,
      }));
      const feedback = (await provider.requestFeedback({
        taskName: this.name,
        taskDescription: renderedTask.description,
        expectedOutput: renderedTask.expectedOutput,
        output,
      })).trim();
      crewaiEventBus.emit(this, new HumanFeedbackReceivedEvent({
        taskName: this.name,
        taskDescription: renderedTask.description,
        feedback,
        accepted: feedback.length === 0,
      }));
      if (feedback.length === 0) {
        accepted = true;
        continue;
      }
      const prompt = [
        renderedTask.prompt,
        `Current output:\n${output.raw}`,
        `Human feedback:\n${feedback}`,
        "Revise the answer using the human feedback.",
      ].join("\n\n");
      const raw = await agent.executeTask(prompt, inputs, tools, {
        ...(this.responseModel === undefined ? {} : { responseModel: this.responseModel }),
        stepCallbacks: [
          this.createTrackingStepCallback(agent),
          ...(options.stepCallbacks ?? []),
        ],
        inputFiles: renderedTask.inputFiles,
        ...(options.functionCallingLlm === undefined ? {} : { functionCallingLlm: options.functionCallingLlm }),
        ...(options.memory === undefined ? {} : { memory: options.memory }),
        ...(options.knowledge === undefined ? {} : { knowledge: options.knowledge }),
        task: this,
      });
      output = await this.createOutput(raw, agent, renderedTask);
      for (const [guardrail, index] of this.effectiveGuardrailEntries()) {
        output = await this.runGuardrail(guardrail, output, agent, index, inputs, tools, renderedTask);
      }
    }
    return output;
  }

  private createTrackingStepCallback(agent: Agent): AgentStepCallback {
    return (step: AgentStep) => {
      if (step.type !== "tool" && step.type !== "direct_tool") {
        return;
      }
      this.usedTools += 1;
      this.used_tools = this.usedTools;
      if (isDelegationToolName(step.toolName)) {
        const coworker = typeof step.toolArgs.coworker === "string" ? step.toolArgs.coworker : null;
        this.incrementDelegations(coworker);
      }
      this.processedByAgents.add(agent.role);
    };
  }

  private async saveOutputFile(output: TaskOutput, inputs: InputValues): Promise<void> {
    if (!this.outputFile) {
      return;
    }
    const outputPath = interpolateOnly(this.outputFile, inputs, { strictMissing: false });
    const directory = dirname(resolve(outputPath));
    if (this.createDirectory) {
      await mkdir(directory, { recursive: true });
    }
    const content = output.jsonDict
      ? JSON.stringify(output.jsonDict, null, 2)
      : output.pydantic !== null && output.pydantic !== undefined
        ? stringifyOutputForFile(output.pydantic)
        : output.raw;
    await writeFile(outputPath, content, "utf8");
  }
}

export type ConditionalTaskOptions = TaskOptions & {
  condition?: ConditionalTaskCondition | null;
};

export class ConditionalTask extends Task {
  readonly condition: ConditionalTaskCondition | null;

  constructor(options: ConditionalTaskOptions) {
    super(options);
    this.condition = options.condition ?? null;
  }

  async shouldExecute(context: TaskOutput): Promise<boolean> {
    if (!this.condition) {
      throw new Error("No condition function set for conditional task.");
    }
    return await this.condition(context);
  }

  async should_execute(context: TaskOutput): Promise<boolean> {
    return await this.shouldExecute(context);
  }

  getSkippedTaskOutput(): TaskOutput {
    return new TaskOutput({
      description: this.description,
      name: this.name,
      expectedOutput: this.expectedOutput,
      raw: "",
      agent: this.agent?.role ?? "",
      outputFormat: OutputFormat.RAW,
    });
  }

  get_skipped_task_output(): TaskOutput {
    return this.getSkippedTaskOutput();
  }
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) {
    throw new Error("Task outputJson requires the raw output to be a JSON object.");
  }
  return parsed;
}

function parseConvertedJsonObject(converted: unknown, raw: string): Record<string, unknown> {
  const value: unknown = converted === undefined ? JSON.parse(raw) : converted;
  if (typeof value === "string") {
    return parseJsonObject(value);
  }
  if (!isRecord(value)) {
    throw new Error("Task outputJson requires the converted output to be a JSON object.");
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isGuardrailTuple(value: GuardrailResult): value is readonly [boolean, unknown] {
  return Array.isArray(value);
}

function normalizeGuardrails(guardrails: TaskOptions["guardrails"]): readonly Guardrail[] {
  if (!guardrails) {
    return [];
  }
  return typeof guardrails === "function" ? [guardrails] : guardrails;
}

function normalizeTaskExecutionOptions(
  value: readonly AgentStepCallback[] | TaskExecutionOptions,
): TaskExecutionOptions {
  return Array.isArray(value)
    ? { stepCallbacks: value as readonly AgentStepCallback[] }
    : value as TaskExecutionOptions;
}

export { interpolateOnly };

function formatTriggerPayload(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value.toString();
  }
  if (value === null) {
    return "null";
  }
  return JSON.stringify(value);
}

function stringifyGuardrailValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value.toString();
  }
  return JSON.stringify(value);
}

function normalizeTaskDate(value: Date | string | null): Date | null {
  if (value === null) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid task datetime: ${value}`);
  }
  return date;
}

function capitalize(value: string): string {
  return value.length === 0 ? value : `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}`;
}

function validateOutputFile(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  if (value.includes("..")) {
    throw new Error("Path traversal attempts are not allowed in outputFile paths.");
  }
  if (value.startsWith("~") || value.startsWith("$")) {
    throw new Error("Shell expansion characters are not allowed in outputFile paths.");
  }
  if (/[|><&;]/.test(value)) {
    throw new Error("Shell special characters are not allowed in outputFile paths.");
  }
  for (const templateName of value.matchAll(/\{([^}]+)\}/g)) {
    const key = templateName[1] ?? "";
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`Invalid template variable name: ${key}`);
    }
  }
  return value;
}

function stringifyOutputForFile(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === undefined) {
    return "undefined";
  }
  return JSON.stringify(value, null, 2);
}

function isToolExecutionError(error: unknown): boolean {
  return error instanceof ToolValidationError || error instanceof ToolUsageLimitExceededError;
}

function isDelegationToolName(toolName: string): boolean {
  const normalized = sanitizeToolName(toolName);
  return normalized === "delegate_work_to_coworker" || normalized === "ask_question_to_coworker";
}
