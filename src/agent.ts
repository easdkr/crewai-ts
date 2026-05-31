import {
  createHash,
} from "node:crypto";

import {
  PlanningConfig,
  createAgentRefinePlanningPrompt,
  createAgentPlanningPrompt,
  createAgentPlanningSystemPrompt,
  createDefaultPlanningConfigForFlag,
  normalizePlanningConfig,
  parseAgentPlanningOutput,
  type PlanningConfigOptions,
} from "./agent-planning.js";
import {
  buildToolContext,
  AddImageTool,
  CacheHandler,
  normalizeToolCalling,
  renderToolsDescription,
  sanitizeToolName,
  ToolsHandler,
  ToolUsageLimitExceededError,
  ToolValidationError,
} from "./tools.js";
import { RpmController } from "./rpm.js";
import {
  addUsageMetrics,
  callLLM,
  createLLMClient,
  emptyUsageMetrics,
  estimateUsageMetrics,
  getLLMUsageMetrics,
  hasLLMUsageMetrics,
  isEmptyUsageMetrics,
  resolveLLMProvider,
  subtractUsageMetrics,
  type LLMClient,
  type UsageMetrics,
} from "./llm.js";
import {
  AgentExecutionCompletedEvent,
  AgentExecutionErrorEvent,
  AgentExecutionStartedEvent,
  AgentReasoningCompletedEvent,
  AgentReasoningFailedEvent,
  AgentReasoningStartedEvent,
  KnowledgeQueryCompletedEvent,
  KnowledgeQueryFailedEvent,
  KnowledgeQueryStartedEvent,
  KnowledgeRetrievalCompletedEvent,
  KnowledgeRetrievalStartedEvent,
  KnowledgeSearchQueryFailedEvent,
  LLMGuardrailCompletedEvent,
  LLMGuardrailStartedEvent,
  crewaiEventBus,
} from "./events.js";
import { Converter, type StructuredModel } from "./converter.js";
import { Knowledge, extractKnowledgeContext, type KnowledgeSource } from "./knowledge.js";
import { coerceSecurityConfig, type Fingerprint, type SecurityConfig } from "./security.js";
import { coerceCheckpointConfig, RuntimeState, type CheckpointConfig, type CheckpointOption } from "./state.js";
import type { ExecutionContext } from "./context.js";
import type { AgentStep, AgentStepCallback, InputValues, LLM, LLMMessage, Tool } from "./types.js";
import type { Memory, MemoryScope } from "./memory.js";
import { renderInputFiles, withReadFileTool, type InputFiles } from "./input-files.js";
import { Skill, formatSkillContext } from "./skills.js";
import type { EmbedderConfig } from "./rag.js";
import { CREWAI_TRAINED_AGENTS_FILE_ENV, TRAINED_AGENTS_DATA_FILE, TRAINING_DATA_FILE } from "./settings.js";
import { CrewTrainingHandler } from "./training-handler.js";

export type AgentGuardrailResult =
  | readonly [boolean, unknown]
  | { success: boolean; result?: unknown; error?: unknown };

export type AgentGuardrail = (output: string) => AgentGuardrailResult | Promise<AgentGuardrailResult>;

export type CodeExecutionMode = "safe" | "unsafe";

export type AgentOptions = {
  role: string;
  goal: string;
  backstory: string;
  config?: Record<string, unknown> | null;
  llm?: LLM | string | null;
  crew?: unknown;
  functionCallingLlm?: LLM | string | null;
  function_calling_llm?: LLM | string | null;
  memory?: Memory | MemoryScope | null;
  knowledge?: Knowledge | null;
  knowledgeSources?: readonly KnowledgeSource[];
  knowledge_sources?: readonly KnowledgeSource[];
  knowledgeStorage?: unknown;
  knowledge_storage?: unknown;
  knowledgeConfig?: Record<string, unknown> | null;
  knowledge_config?: Record<string, unknown> | null;
  embedder?: EmbedderConfig | null;
  agentKnowledgeContext?: string | null;
  agent_knowledge_context?: string | null;
  crewKnowledgeContext?: string | null;
  crew_knowledge_context?: string | null;
  knowledgeSearchQuery?: string | null;
  knowledge_search_query?: string | null;
  cache?: boolean;
  cacheHandler?: CacheHandler | null;
  cache_handler?: CacheHandler | null;
  toolsHandler?: ToolsHandler | null;
  tools_handler?: ToolsHandler | null;
  toolsResults?: readonly Record<string, unknown>[];
  tools_results?: readonly Record<string, unknown>[];
  callbacks?: readonly ((...args: unknown[]) => unknown)[];
  adaptedAgent?: boolean;
  adapted_agent?: boolean;
  apps?: readonly unknown[] | null;
  mcps?: readonly unknown[] | null;
  a2a?: unknown;
  agentExecutor?: unknown;
  agent_executor?: unknown;
  executorClass?: unknown;
  executor_class?: unknown;
  maxTokens?: number | null;
  max_tokens?: number | null;
  fromRepository?: string | null;
  from_repository?: string | null;
  tools?: readonly Tool[];
  verbose?: boolean;
  allowDelegation?: boolean;
  allow_delegation?: boolean;
  allowCodeExecution?: boolean | null;
  allow_code_execution?: boolean | null;
  codeExecutionMode?: CodeExecutionMode;
  code_execution_mode?: CodeExecutionMode;
  respectContextWindow?: boolean;
  respect_context_window?: boolean;
  multimodal?: boolean;
  maxIter?: number;
  max_iter?: number;
  maxRetryLimit?: number;
  max_retry_limit?: number;
  maxExecutionTime?: number | null;
  max_execution_time?: number | null;
  maxRpm?: number | null;
  max_rpm?: number | null;
  stepCallback?: AgentStepCallback | null;
  step_callback?: AgentStepCallback | null;
  useSystemPrompt?: boolean | null;
  use_system_prompt?: boolean | null;
  systemTemplate?: string | null;
  system_template?: string | null;
  promptTemplate?: string | null;
  prompt_template?: string | null;
  responseTemplate?: string | null;
  response_template?: string | null;
  injectDate?: boolean;
  inject_date?: boolean;
  dateFormat?: string;
  date_format?: string;
  guardrail?: AgentGuardrail | null;
  guardrailMaxRetries?: number;
  guardrail_max_retries?: number;
  planning?: boolean;
  planningConfig?: PlanningConfig | PlanningConfigOptions | null;
  planning_config?: PlanningConfig | PlanningConfigOptions | null;
  reasoning?: boolean;
  maxReasoningAttempts?: number | null;
  max_reasoning_attempts?: number | null;
  skills?: readonly unknown[] | null;
  securityConfig?: SecurityConfig | null;
  security_config?: SecurityConfig | null;
  checkpoint?: CheckpointOption;
  executionContext?: ExecutionContext | null;
  execution_context?: ExecutionContext | null;
  checkpointKickoffEventId?: string | null;
  checkpoint_kickoff_event_id?: string | null;
};

export type AgentExecutionOptions = {
  responseModel?: unknown;
  stepCallbacks?: readonly AgentStepCallback[];
  functionCallingLlm?: LLM | string | null;
  memory?: Memory | MemoryScope | null;
  knowledge?: Knowledge | null;
  inputFiles?: InputFiles;
  input_files?: InputFiles;
  task?: unknown;
};

export type AgentKickoffInput = string | readonly LLMMessage[];

export class Agent {
  readonly entityType = "agent";
  readonly entity_type = "agent";
  role: string;
  goal: string;
  backstory: string;
  readonly config: Record<string, unknown> | null;
  readonly llm: LLM | string | null;
  readonly crew: unknown;
  readonly functionCallingLlm: LLM | string | null;
  readonly function_calling_llm: LLM | string | null;
  memory: Memory | MemoryScope | null;
  knowledge: Knowledge | null;
  readonly knowledgeStorage: unknown;
  readonly knowledge_storage: unknown;
  readonly knowledgeConfig: Record<string, unknown> | null;
  readonly knowledge_config: Record<string, unknown> | null;
  readonly embedder: EmbedderConfig | null;
  agentKnowledgeContext: string | null;
  agent_knowledge_context: string | null;
  crewKnowledgeContext: string | null;
  crew_knowledge_context: string | null;
  knowledgeSearchQuery: string | null;
  knowledge_search_query: string | null;
  readonly cache: boolean;
  cacheHandler: CacheHandler | null;
  cache_handler: CacheHandler | null;
  toolsHandler: ToolsHandler;
  tools_handler: ToolsHandler;
  toolsResults: Record<string, unknown>[];
  tools_results: Record<string, unknown>[];
  callbacks: readonly ((...args: unknown[]) => unknown)[];
  adaptedAgent: boolean;
  adapted_agent: boolean;
  apps: readonly unknown[] | null;
  mcps: readonly unknown[] | null;
  a2a: unknown;
  agentExecutor: unknown;
  agent_executor: unknown;
  executorClass: unknown;
  executor_class: unknown;
  maxTokens: number | null;
  max_tokens: number | null;
  readonly fromRepository: string | null;
  readonly from_repository: string | null;
  readonly tools: readonly Tool[];
  readonly verbose: boolean;
  readonly allowDelegation: boolean;
  readonly allow_delegation: boolean;
  readonly allowCodeExecution: boolean;
  readonly allow_code_execution: boolean;
  readonly codeExecutionMode: CodeExecutionMode;
  readonly code_execution_mode: CodeExecutionMode;
  readonly respectContextWindow: boolean;
  readonly respect_context_window: boolean;
  readonly multimodal: boolean;
  readonly maxIter: number;
  readonly max_iter: number;
  readonly maxRetryLimit: number;
  readonly max_retry_limit: number;
  readonly maxExecutionTime: number | null;
  readonly max_execution_time: number | null;
  readonly maxRpm: number | null;
  readonly max_rpm: number | null;
  readonly stepCallback: AgentStepCallback | null;
  readonly step_callback: AgentStepCallback | null;
  readonly useSystemPrompt: boolean;
  readonly use_system_prompt: boolean;
  readonly systemTemplate: string | null;
  readonly system_template: string | null;
  readonly promptTemplate: string | null;
  readonly prompt_template: string | null;
  readonly responseTemplate: string | null;
  readonly response_template: string | null;
  readonly injectDate: boolean;
  readonly inject_date: boolean;
  readonly dateFormat: string;
  readonly date_format: string;
  readonly guardrail: AgentGuardrail | null;
  readonly guardrailMaxRetries: number;
  readonly guardrail_max_retries: number;
  readonly planning: boolean;
  readonly reasoning: boolean;
  readonly maxReasoningAttempts: number | null;
  readonly max_reasoning_attempts: number | null;
  readonly planningConfig: PlanningConfig | null;
  readonly planning_config: PlanningConfig | null;
  skills: readonly unknown[];
  readonly securityConfig: SecurityConfig;
  readonly security_config: SecurityConfig;
  checkpoint: CheckpointConfig | false | null;
  executionContext: ExecutionContext | null;
  execution_context: ExecutionContext | null;
  checkpointKickoffEventId: string | null;
  checkpoint_kickoff_event_id: string | null;
  private readonly llmClient: LLMClient | null;
  private readonly functionCallingLlmClient: LLMClient | null;
  private rpmController: RpmController | null;
  private usageMetrics: UsageMetrics = emptyUsageMetrics();
  private lastMessagesValue: LLMMessage[] = [];

  constructor(options: AgentOptions) {
    this.role = options.role;
    this.goal = options.goal;
    this.backstory = options.backstory;
    this.config = options.config ?? null;
    this.llm = options.llm ?? null;
    this.crew = options.crew ?? null;
    this.functionCallingLlm = options.functionCallingLlm ?? options.function_calling_llm ?? null;
    this.function_calling_llm = this.functionCallingLlm;
    this.memory = options.memory ?? null;
    this.knowledge = options.knowledge ?? (
      options.knowledgeSources || options.knowledge_sources
        ? new Knowledge({ sources: options.knowledgeSources ?? options.knowledge_sources ?? [] })
        : null
    );
    this.knowledgeStorage = options.knowledgeStorage ?? options.knowledge_storage ?? null;
    this.knowledge_storage = this.knowledgeStorage;
    this.knowledgeConfig = options.knowledgeConfig ?? options.knowledge_config ?? null;
    this.knowledge_config = this.knowledgeConfig;
    this.embedder = options.embedder ?? null;
    this.agentKnowledgeContext = options.agentKnowledgeContext ?? options.agent_knowledge_context ?? null;
    this.agent_knowledge_context = this.agentKnowledgeContext;
    this.crewKnowledgeContext = options.crewKnowledgeContext ?? options.crew_knowledge_context ?? null;
    this.crew_knowledge_context = this.crewKnowledgeContext;
    this.knowledgeSearchQuery = options.knowledgeSearchQuery ?? options.knowledge_search_query ?? null;
    this.knowledge_search_query = this.knowledgeSearchQuery;
    this.cache = options.cache ?? true;
    this.cacheHandler = options.cacheHandler ?? options.cache_handler ?? (this.cache ? new CacheHandler() : null);
    this.cache_handler = this.cacheHandler;
    this.toolsHandler = options.toolsHandler ?? options.tools_handler ?? new ToolsHandler();
    this.tools_handler = this.toolsHandler;
    if (this.cache && this.cacheHandler) {
      this.setCacheHandler(this.cacheHandler);
    }
    this.toolsResults = [...(options.toolsResults ?? options.tools_results ?? [])];
    this.tools_results = this.toolsResults;
    this.callbacks = [...(options.callbacks ?? [])];
    this.adaptedAgent = options.adaptedAgent ?? options.adapted_agent ?? false;
    this.adapted_agent = this.adaptedAgent;
    this.apps = options.apps ? [...options.apps] : null;
    this.mcps = options.mcps ? [...options.mcps] : null;
    this.a2a = options.a2a ?? null;
    this.agentExecutor = options.agentExecutor ?? options.agent_executor ?? null;
    this.agent_executor = this.agentExecutor;
    this.executorClass = options.executorClass ?? options.executor_class ?? null;
    this.executor_class = this.executorClass;
    this.maxTokens = options.maxTokens ?? options.max_tokens ?? null;
    this.max_tokens = this.maxTokens;
    this.fromRepository = options.fromRepository ?? options.from_repository ?? null;
    this.from_repository = this.fromRepository;
    this.tools = options.tools ?? [];
    this.verbose = options.verbose ?? false;
    this.allowDelegation = options.allowDelegation ?? options.allow_delegation ?? false;
    this.allow_delegation = this.allowDelegation;
    this.allowCodeExecution = options.allowCodeExecution ?? options.allow_code_execution ?? false;
    this.allow_code_execution = this.allowCodeExecution;
    this.codeExecutionMode = options.codeExecutionMode ?? options.code_execution_mode ?? "safe";
    this.code_execution_mode = this.codeExecutionMode;
    this.respectContextWindow = options.respectContextWindow ?? options.respect_context_window ?? true;
    this.respect_context_window = this.respectContextWindow;
    this.multimodal = options.multimodal ?? false;
    this.maxIter = options.maxIter ?? options.max_iter ?? 20;
    this.max_iter = this.maxIter;
    this.maxRetryLimit = options.maxRetryLimit ?? options.max_retry_limit ?? 2;
    this.max_retry_limit = this.maxRetryLimit;
    this.maxExecutionTime = validateMaxExecutionTime(options.maxExecutionTime ?? options.max_execution_time ?? null);
    this.max_execution_time = this.maxExecutionTime;
    this.maxRpm = options.maxRpm ?? options.max_rpm ?? null;
    this.max_rpm = this.maxRpm;
    this.rpmController = this.maxRpm ? new RpmController(this.maxRpm) : null;
    this.stepCallback = options.stepCallback ?? options.step_callback ?? null;
    this.step_callback = this.stepCallback;
    this.useSystemPrompt = options.useSystemPrompt ?? options.use_system_prompt ?? true;
    this.use_system_prompt = this.useSystemPrompt;
    this.systemTemplate = options.systemTemplate ?? options.system_template ?? null;
    this.system_template = this.systemTemplate;
    this.promptTemplate = options.promptTemplate ?? options.prompt_template ?? null;
    this.prompt_template = this.promptTemplate;
    this.responseTemplate = options.responseTemplate ?? options.response_template ?? null;
    this.response_template = this.responseTemplate;
    this.injectDate = options.injectDate ?? options.inject_date ?? false;
    this.inject_date = this.injectDate;
    this.dateFormat = options.dateFormat ?? options.date_format ?? "%Y-%m-%d";
    this.date_format = this.dateFormat;
    this.guardrail = options.guardrail ?? null;
    this.guardrailMaxRetries = options.guardrailMaxRetries ?? options.guardrail_max_retries ?? 3;
    this.guardrail_max_retries = this.guardrailMaxRetries;
    this.planning = options.planning ?? false;
    this.reasoning = options.reasoning ?? false;
    this.maxReasoningAttempts = options.maxReasoningAttempts ?? options.max_reasoning_attempts ?? null;
    this.max_reasoning_attempts = this.maxReasoningAttempts;
    this.skills = [...(options.skills ?? [])];
    const explicitPlanningConfig = normalizePlanningConfig(options.planningConfig ?? options.planning_config);
    if (explicitPlanningConfig) {
      this.planningConfig = explicitPlanningConfig;
    } else if (this.planning) {
      this.planningConfig = createDefaultPlanningConfigForFlag();
    } else if (this.reasoning) {
      this.planningConfig = new PlanningConfig({
        ...(this.maxReasoningAttempts === null ? {} : { maxAttempts: this.maxReasoningAttempts }),
      });
    } else {
      this.planningConfig = null;
    }
    this.planning_config = this.planningConfig;
    this.securityConfig = coerceSecurityConfig(options.securityConfig ?? options.security_config ?? null);
    this.security_config = this.securityConfig;
    this.checkpoint = coerceCheckpointConfig(options.checkpoint);
    this.executionContext = options.executionContext ?? options.execution_context ?? null;
    this.execution_context = this.executionContext;
    this.checkpointKickoffEventId = options.checkpointKickoffEventId ?? options.checkpoint_kickoff_event_id ?? null;
    this.checkpoint_kickoff_event_id = this.checkpointKickoffEventId;
    this.llmClient = options.llm && typeof options.llm !== "string"
      ? createLLMClient(options.llm)
      : null;
    this.functionCallingLlmClient = options.functionCallingLlm && typeof options.functionCallingLlm !== "string"
      ? createLLMClient(options.functionCallingLlm)
      : null;
  }

  get planningEnabled(): boolean {
    return this.planningConfig !== null || this.planning;
  }

  get planning_enabled(): boolean {
    return this.planningEnabled;
  }

  get fingerprint(): Fingerprint {
    return this.securityConfig.fingerprint;
  }

  get key(): string {
    return createHash("md5")
      .update([this.role, this.goal, this.backstory].join("|"))
      .digest("hex");
  }

  get lastMessages(): readonly LLMMessage[] {
    return [...this.lastMessagesValue];
  }

  get last_messages(): readonly LLMMessage[] {
    return this.lastMessages;
  }

  toString(): string {
    return `Agent(role=${this.role}, goal=${this.goal}, backstory=${this.backstory})`;
  }

  __repr__(): string {
    return this.toString();
  }

  async getKnowledgeSearchQuery(taskPrompt: string, task: unknown): Promise<string | null> {
    crewaiEventBus.emit(this, new KnowledgeQueryStartedEvent({
      task_prompt: taskPrompt,
      from_task: task,
      from_agent: this,
    }));
    const query = `Generate a concise knowledge search query for the following task:\n${taskPrompt}`;
    const messages: LLMMessage[] = [
      {
        role: "system",
        content: "Rewrite task prompts into concise search queries for a knowledge base.",
      },
      {
        role: "user",
        content: query,
      },
    ];
    try {
      const llmClient = this.resolveLLMClient();
      if (!llmClient) {
        throw new Error("LLM is not compatible with knowledge search queries");
      }
      const rewrittenQuery = await this.callAndTrackLLM(llmClient, messages, [], { task }, 0);
      crewaiEventBus.emit(this, new KnowledgeQueryCompletedEvent({
        query,
        from_task: task,
        from_agent: this,
      }));
      return typeof rewrittenQuery === "string" ? rewrittenQuery : JSON.stringify(rewrittenQuery);
    } catch (error) {
      crewaiEventBus.emit(this, new KnowledgeQueryFailedEvent({
        error,
        from_task: task,
        from_agent: this,
      }));
      return null;
    }
  }

  async _get_knowledge_search_query(task_prompt: string, task: unknown): Promise<string | null> {
    return await this.getKnowledgeSearchQuery(task_prompt, task);
  }

  static async fromCheckpoint(config: CheckpointConfig): Promise<Agent> {
    const state = await RuntimeState.fromCheckpoint(config);
    const agent = state.root.find((entity): entity is Agent => entity instanceof Agent);
    if (!agent) {
      throw new Error(`No Agent found in checkpoint: ${config.restoreFrom ?? config.restore_from ?? ""}`);
    }
    return agent;
  }

  static async from_checkpoint(config: CheckpointConfig): Promise<Agent> {
    return await Agent.fromCheckpoint(config);
  }

  static async fork(config: CheckpointConfig, branch?: string | null): Promise<Agent> {
    const agent = await Agent.fromCheckpoint(config);
    const state = new RuntimeState({ entities: [agent], parentId: config.restoreFrom ?? config.restore_from ?? null });
    state.fork(branch ?? undefined);
    return agent;
  }

  static coerceSkillStrings(skills: unknown): unknown {
    return Array.isArray(skills) ? [...skills as unknown[]] : skills;
  }

  static coerce_skill_strings(skills: unknown): unknown {
    return Agent.coerceSkillStrings(skills);
  }

  static processModelConfig(values: Record<string, unknown>): Record<string, unknown> {
    return { ...values };
  }

  static process_model_config(values: Record<string, unknown>): Record<string, unknown> {
    return Agent.processModelConfig(values);
  }

  static validateFromRepository(values: Record<string, unknown>): Record<string, unknown> {
    return { ...values };
  }

  static validate_from_repository(values: Record<string, unknown>): Record<string, unknown> {
    return Agent.validateFromRepository(values);
  }

  setFingerprint(fingerprint: Fingerprint): void {
    this.securityConfig.fingerprint = fingerprint;
  }

  set_fingerprint(fingerprint: Fingerprint): void {
    this.setFingerprint(fingerprint);
  }

  copy(): Agent {
    return new Agent({
      role: this.role,
      goal: this.goal,
      backstory: this.backstory,
      config: this.config,
      llm: this.llm,
      crew: this.crew,
      functionCallingLlm: this.functionCallingLlm,
      memory: this.memory,
      knowledge: this.knowledge,
      knowledgeStorage: this.knowledgeStorage,
      knowledgeConfig: this.knowledgeConfig,
      embedder: this.embedder,
      agentKnowledgeContext: this.agentKnowledgeContext,
      crewKnowledgeContext: this.crewKnowledgeContext,
      knowledgeSearchQuery: this.knowledgeSearchQuery,
      cache: this.cache,
      cacheHandler: this.cacheHandler,
      toolsHandler: this.toolsHandler,
      toolsResults: this.toolsResults,
      callbacks: this.callbacks,
      adaptedAgent: this.adaptedAgent,
      apps: this.apps,
      mcps: this.mcps,
      a2a: this.a2a,
      agentExecutor: this.agentExecutor,
      executorClass: this.executorClass,
      maxTokens: this.maxTokens,
      fromRepository: this.fromRepository,
      tools: this.tools,
      verbose: this.verbose,
      allowDelegation: this.allowDelegation,
      allowCodeExecution: this.allowCodeExecution,
      codeExecutionMode: this.codeExecutionMode,
      respectContextWindow: this.respectContextWindow,
      multimodal: this.multimodal,
      maxIter: this.maxIter,
      maxRetryLimit: this.maxRetryLimit,
      maxExecutionTime: this.maxExecutionTime,
      maxRpm: this.maxRpm,
      stepCallback: this.stepCallback,
      useSystemPrompt: this.useSystemPrompt,
      systemTemplate: this.systemTemplate,
      promptTemplate: this.promptTemplate,
      responseTemplate: this.responseTemplate,
      injectDate: this.injectDate,
      dateFormat: this.dateFormat,
      guardrail: this.guardrail,
      guardrailMaxRetries: this.guardrailMaxRetries,
      planning: this.planning,
      reasoning: this.reasoning,
      maxReasoningAttempts: this.maxReasoningAttempts,
      planningConfig: this.planningConfig,
      skills: this.skills,
      securityConfig: this.securityConfig.cloneWithNewFingerprint(),
      checkpoint: this.checkpoint,
      executionContext: this.executionContext?.clone() ?? null,
      checkpointKickoffEventId: this.checkpointKickoffEventId,
    });
  }

  setPrivateAttrs(): this {
    if (this.cache && this.cacheHandler) {
      this.setCacheHandler(this.cacheHandler);
    }
    if (this.maxRpm && !this.rpmController) {
      this.rpmController = new RpmController(this.maxRpm);
    }
    return this;
  }

  postInitSetup(): this {
    return this.setPrivateAttrs();
  }

  post_init_setup(): this {
    return this.postInitSetup();
  }

  set_private_attrs(): this {
    return this.setPrivateAttrs();
  }

  validateTools(): this {
    return this;
  }

  validate_tools(): this {
    return this.validateTools();
  }

  validateApps(): this {
    return this;
  }

  validate_apps(): this {
    return this.validateApps();
  }

  validateMcps(): this {
    return this;
  }

  validate_mcps(): this {
    return this.validateMcps();
  }

  validateAndSetAttributes(): this {
    return this.setPrivateAttrs();
  }

  validate_and_set_attributes(): this {
    return this.validateAndSetAttributes();
  }

  resolveMemory(): Memory | MemoryScope | null {
    return this.memory;
  }

  resolve_memory(): Memory | MemoryScope | null {
    return this.resolveMemory();
  }

  setKnowledge(knowledge: Knowledge | null): void {
    this.knowledge = knowledge;
  }

  set_knowledge(knowledge: Knowledge | null): void {
    this.setKnowledge(knowledge);
  }

  setRpmController(controller: RpmController | null): void {
    this.rpmController = controller;
  }

  set_rpm_controller(controller: RpmController | null): void {
    this.setRpmController(controller);
  }

  getDelegationTools(): readonly Tool[] {
    return [];
  }

  get_delegation_tools(): readonly Tool[] {
    return this.getDelegationTools();
  }

  getPlatformTools(): readonly Tool[] {
    return [];
  }

  get_platform_tools(): readonly Tool[] {
    return this.getPlatformTools();
  }

  getMcpTools(): readonly Tool[] {
    return [];
  }

  get_mcp_tools(): readonly Tool[] {
    return this.getMcpTools();
  }

  getMultimodalTools(): readonly Tool[] {
    return [new AddImageTool()];
  }

  get_multimodal_tools(): readonly Tool[] {
    return this.getMultimodalTools();
  }

  getCodeExecutionTools(): readonly Tool[] {
    this.emitCodeInterpreterDeprecationWarning();
    return [];
  }

  get_code_execution_tools(): readonly Tool[] {
    return this.getCodeExecutionTools();
  }

  _validateDockerInstallation(): void {
    this.emitCodeInterpreterDeprecationWarning();
  }

  _validate_docker_installation(): void {
    this._validateDockerInstallation();
  }

  private emitCodeInterpreterDeprecationWarning(): void {
    process.emitWarning(
      "CodeInterpreterTool is no longer available. Use dedicated sandbox services like E2B or Modal.",
      "DeprecationWarning",
    );
  }

  static getOutputConverter(
    llm: unknown,
    text: string,
    model: unknown,
    instructions: string,
  ): Converter {
    return new Converter({
      llm: llm as LLMClient,
      text,
      model: model as StructuredModel,
      instructions,
    });
  }

  static get_output_converter(
    llm: unknown,
    text: string,
    model: unknown,
    instructions: string,
  ): Converter {
    return Agent.getOutputConverter(llm, text, model, instructions);
  }

  getOutputConverter(): null;
  getOutputConverter(
    llm: unknown,
    text: string,
    model: unknown,
    instructions: string,
  ): Converter;
  getOutputConverter(
    llm?: unknown,
    text?: string,
    model?: unknown,
    instructions?: string,
  ): Converter | null {
    if (llm === undefined || text === undefined || model === undefined || instructions === undefined) {
      return null;
    }
    return Agent.getOutputConverter(llm, text, model, instructions);
  }

  get_output_converter(): null;
  get_output_converter(
    llm: unknown,
    text: string,
    model: unknown,
    instructions: string,
  ): Converter;
  get_output_converter(
    llm?: unknown,
    text?: string,
    model?: unknown,
    instructions?: string,
  ): Converter | null {
    if (llm === undefined || text === undefined || model === undefined || instructions === undefined) {
      return null;
    }
    return this.getOutputConverter(llm, text, model, instructions);
  }

  _training_handler(taskPrompt: string): string {
    const data = new CrewTrainingHandler(TRAINING_DATA_FILE).load();
    if (!isRecord(data)) {
      return taskPrompt;
    }
    const idValue = readRecordValue(this, "id");
    const agentTraining = data[typeof idValue === "string" || typeof idValue === "number" ? String(idValue) : this.key];
    if (!isRecord(agentTraining)) {
      return taskPrompt;
    }
    const feedbacks = Object.values(agentTraining)
      .map((entry) => isRecord(entry) ? entry.human_feedback : null)
      .filter((feedback): feedback is string => typeof feedback === "string" && feedback.length > 0);
    return feedbacks.length > 0
      ? `${taskPrompt}\n\nYou MUST follow these instructions: \n ${feedbacks.join("\n - ")}`
      : taskPrompt;
  }

  _use_trained_data(taskPrompt: string): string {
    const trainedFile = process.env[CREWAI_TRAINED_AGENTS_FILE_ENV] ?? TRAINED_AGENTS_DATA_FILE;
    const data = new CrewTrainingHandler(trainedFile).load();
    if (!isRecord(data)) {
      return taskPrompt;
    }
    const roleTraining = data[this.role];
    const suggestions = isRecord(roleTraining) && Array.isArray(roleTraining.suggestions)
      ? roleTraining.suggestions.filter((suggestion): suggestion is string => typeof suggestion === "string" && suggestion.length > 0)
      : [];
    return suggestions.length > 0
      ? `${taskPrompt}\n\nYou MUST follow these instructions: \n - ${suggestions.join("\n - ")}`
      : taskPrompt;
  }

  _injectDateToTask(task: Record<string, unknown>): void {
    if (!this.injectDate) {
      return;
    }
    try {
      const currentDate = formatDate(new Date(), this.dateFormat);
      if (!currentDate) {
        throw new Error(`Invalid date format: ${this.dateFormat}`);
      }
      const description = typeof task.description === "string" ? task.description : "";
      task.description = `${description}\n\nCurrent Date: ${currentDate}`;
    } catch (error) {
      const logger = readRecordValue(this, "_logger") ?? readRecordValue(this, "logger");
      const log = isRecord(logger) ? logger.log : null;
      if (typeof log === "function") {
        log.call(logger, "warning", `Failed to inject date: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  _inject_date_to_task(task: Record<string, unknown>): void {
    this._injectDateToTask(task);
  }

  createAgentExecutor(): unknown {
    return this.agentExecutor;
  }

  create_agent_executor(): unknown {
    return this.createAgentExecutor();
  }

  interpolateInputs(inputs: InputValues): void {
    this.role = interpolateAgentText(this.role, inputs);
    this.goal = interpolateAgentText(this.goal, inputs);
    this.backstory = interpolateAgentText(this.backstory, inputs);
  }

  interpolate_inputs(inputs: InputValues): void {
    this.interpolateInputs(inputs);
  }

  async executeTask(
    prompt: string,
    inputs: InputValues = {},
    taskTools: readonly Tool[] = [],
    options: AgentExecutionOptions = {},
  ): Promise<string> {
    const promptWithInputFiles = promptWithRenderedInputFiles(prompt, options.inputFiles ?? options.input_files);
    const task = options.task ?? { prompt: promptWithInputFiles };
    crewaiEventBus.emit(this, new AgentExecutionStartedEvent({
      agent: this,
      task,
      tools: taskTools.length > 0 ? taskTools : this.tools,
      taskPrompt: promptWithInputFiles,
    }));
    try {
      const output = this.maxExecutionTime !== null
        ? await withExecutionTimeout(
          this.executeTaskWithRetries(promptWithInputFiles, inputs, taskTools, { ...options, task }),
          this.maxExecutionTime,
          promptWithInputFiles,
        )
        : await this.executeTaskWithRetries(promptWithInputFiles, inputs, taskTools, { ...options, task });
      crewaiEventBus.emit(this, new AgentExecutionCompletedEvent({ agent: this, task, output }));
      return output;
    } catch (error) {
      crewaiEventBus.emit(this, new AgentExecutionErrorEvent({ agent: this, task, error }));
      throw error;
    }
  }

  async execute_task(
    promptOrOptions: string | { task?: { prompt?: () => string; description?: string } | string; context?: string | null; tools?: readonly Tool[] },
    context?: string | null,
    tools?: readonly Tool[],
  ): Promise<string> {
    if (typeof promptOrOptions === "string") {
      return await this.executeTask(promptOrOptions, {}, tools ?? [], { ...(context === undefined ? {} : { task: { prompt: promptOrOptions, context } }) });
    }
    const taskValue = promptOrOptions.task;
    const prompt = typeof taskValue === "object" && typeof taskValue.prompt === "function"
      ? taskValue.prompt()
      : typeof taskValue === "object" && typeof taskValue.description === "string"
        ? taskValue.description
        : typeof taskValue === "string"
          ? taskValue
          : "";
    return await this.executeTask(prompt, {}, promptOrOptions.tools ?? [], {
      task: promptOrOptions.task,
    });
  }

  async aexecuteTask(
    promptOrOptions: Parameters<Agent["execute_task"]>[0],
    context?: string | null,
    tools?: readonly Tool[],
  ): Promise<string> {
    return await this.execute_task(promptOrOptions, context, tools);
  }

  async aexecute_task(
    promptOrOptions: Parameters<Agent["execute_task"]>[0],
    context?: string | null,
    tools?: readonly Tool[],
  ): Promise<string> {
    return await this.aexecuteTask(promptOrOptions, context, tools);
  }

  private async executeTaskWithRetries(
    prompt: string,
    inputs: InputValues,
    taskTools: readonly Tool[],
    options: AgentExecutionOptions,
  ): Promise<string> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetryLimit; attempt += 1) {
      try {
        return await this.executeTaskOnce(prompt, inputs, taskTools, options);
      } catch (error) {
        lastError = error;
        if (attempt >= this.maxRetryLimit || isNonRetryableExecutionError(error)) {
          throw error;
        }
      }
    }
    throw lastError;
  }

  private async executeTaskOnce(
    prompt: string,
    inputs: InputValues,
    taskTools: readonly Tool[],
    options: AgentExecutionOptions,
  ): Promise<string> {
    const executionInputFiles = options.inputFiles ?? options.input_files;
    const tools = withReadFileTool(taskTools.length > 0 ? taskTools : this.tools, executionInputFiles);
    const executionPrompt = await this.preparePromptWithPlanning(prompt, tools);
    const promptWithMemory = this.promptWithMemoryContext(executionPrompt, options.memory ?? null);
    const promptWithKnowledge = this.promptWithKnowledgeContext(promptWithMemory, options.knowledge ?? null, options.task);
    const llmClient = this.resolveLLMClient();
    if (llmClient) {
      const messages = this.buildMessages(promptWithKnowledge, inputs, tools);
      const functionCallingLlmClient = this.resolveFunctionCallingLLMClient(options);
      for (let iteration = 0; iteration < this.maxIter; iteration += 1) {
        const selectedFunctionCallingLlmClient = (
          functionCallingLlmClient
          && tools.length > 0
          && messages.at(-1)?.role !== "tool"
        ) ? functionCallingLlmClient : null;
        const result = selectedFunctionCallingLlmClient
            ? await this.callAndTrackLLM(selectedFunctionCallingLlmClient, messages, tools, options, iteration)
            : await this.callAndTrackLLM(llmClient, messages, tools, options, iteration);
        const toolCalling = normalizeToolCalling(result);
        if (!toolCalling) {
          if (selectedFunctionCallingLlmClient) {
            const finalResult = await this.callAndTrackLLM(llmClient, messages, [], options, iteration);
            const finalOutput = await this.applyGuardrail(
              typeof finalResult === "string" ? finalResult : JSON.stringify(finalResult),
            );
            this.saveResultToAgentMemory(promptWithKnowledge, finalOutput);
            await this.emitStep({
              type: "final",
              agentRole: this.role,
              iteration,
              output: finalOutput,
            }, options.stepCallbacks);
            return finalOutput;
          }
          const output = typeof result === "string" ? result : JSON.stringify(result);
          const finalOutput = await this.applyGuardrail(output);
          this.saveResultToAgentMemory(promptWithKnowledge, finalOutput);
          await this.emitStep({
            type: "final",
            agentRole: this.role,
            iteration,
            output: finalOutput,
          }, options.stepCallbacks);
          return finalOutput;
        }

        const toolResult = await this.runToolCall(toolCalling.toolName, toolCalling.arguments ?? {}, tools);
        const output = String(toolResult.output);
        if (toolResult.tool.resultAsAnswer) {
          const finalOutput = await this.applyGuardrail(output);
          this.saveResultToAgentMemory(promptWithKnowledge, finalOutput);
          await this.emitStep({
            type: "direct_tool",
            agentRole: this.role,
            iteration,
            toolName: sanitizeToolName(toolResult.tool.name),
            toolArgs: toolCalling.arguments ?? {},
            output: finalOutput,
            resultAsAnswer: true,
          }, options.stepCallbacks);
          return finalOutput;
        }
        await this.emitStep({
          type: "tool",
          agentRole: this.role,
          iteration,
          toolName: sanitizeToolName(toolResult.tool.name),
          toolArgs: toolCalling.arguments ?? {},
          output,
          resultAsAnswer: false,
        }, options.stepCallbacks);

        messages.push({
          role: "assistant",
          content: JSON.stringify({
            toolName: sanitizeToolName(toolResult.tool.name),
            arguments: toolCalling.arguments ?? {},
          }),
        });
        messages.push({
          role: "tool",
          content: `${sanitizeToolName(toolResult.tool.name)} result:\n${output}`,
        });
      }
      throw new Error(`Agent '${this.role}' reached max iterations of ${String(this.maxIter)} without a final answer.`);
    }

    if (tools.length > 0) {
      const toolResults = await Promise.all(
        tools.map(async (tool) => {
          const result = await this.runToolCall(tool.name, buildToolContext(promptWithKnowledge, inputs), tools);
          return `${tool.name}: ${String(result.output)}`;
        }),
      );
      const output = toolResults.join("\n");
      const finalOutput = await this.applyGuardrail(output);
      this.saveResultToAgentMemory(promptWithKnowledge, finalOutput);
      await this.emitStep({
        type: "final",
        agentRole: this.role,
        iteration: 0,
        output: finalOutput,
      }, options.stepCallbacks);
      return finalOutput;
    }

    const output = await this.applyGuardrail(promptWithKnowledge);
    this.saveResultToAgentMemory(promptWithKnowledge, output);
    await this.emitStep({
      type: "final",
      agentRole: this.role,
      iteration: 0,
      output,
    }, options.stepCallbacks);
    return output;
  }

  async kickoff(input: AgentKickoffInput, options: Omit<AgentExecutionOptions, "responseModel"> = {}): Promise<string> {
    const formatted = formatKickoffInput(input, options.inputFiles ?? options.input_files);
    return await this.executeTask(formatted.prompt, {}, [], {
      ...options,
      inputFiles: formatted.inputFiles,
    });
  }

  async kickoffAsync(input: AgentKickoffInput, options: Omit<AgentExecutionOptions, "responseModel"> = {}): Promise<string> {
    return await this.kickoff(input, options);
  }

  async kickoff_async(input: AgentKickoffInput, options: Omit<AgentExecutionOptions, "responseModel"> = {}): Promise<string> {
    return await this.kickoffAsync(input, options);
  }

  async akickoff(input: AgentKickoffInput, options: Omit<AgentExecutionOptions, "responseModel"> = {}): Promise<string> {
    return await this.kickoffAsync(input, options);
  }

  getUsageMetrics(): UsageMetrics {
    return { ...this.usageMetrics };
  }

  resetUsageMetrics(): void {
    this.usageMetrics = emptyUsageMetrics();
    this.llmClient?.resetUsageMetrics?.();
  }

  setCacheHandler(cacheHandler: CacheHandler): void {
    this.toolsHandler = new ToolsHandler();
    this.tools_handler = this.toolsHandler;
    if (this.cache) {
      this.cacheHandler = cacheHandler;
      this.cache_handler = cacheHandler;
      this.toolsHandler.cache = cacheHandler;
    }
  }

  set_cache_handler(cacheHandler: CacheHandler): void {
    this.setCacheHandler(cacheHandler);
  }

  setSkills(resolvedCrewSkills: readonly unknown[] | null = null): void {
    const items = [...this.skills, ...(resolvedCrewSkills ?? [])];
    this.skills = dedupeSkills(items);
  }

  set_skills(resolvedCrewSkills: readonly unknown[] | null = null): void {
    this.setSkills(resolvedCrewSkills);
  }

  private resolveLLMClient(): LLMClient | null {
    return this.resolveLLMReference(this.llm, this.llmClient);
  }

  private resolveFunctionCallingLLMClient(options: AgentExecutionOptions): LLMClient | null {
    if (this.functionCallingLlm) {
      return this.resolveLLMReference(this.functionCallingLlm, this.functionCallingLlmClient);
    }
    return this.resolveLLMReference(options.functionCallingLlm ?? null);
  }

  private resolveLLMReference(llm: LLM | string | null, client: LLMClient | null = null): LLMClient | null {
    if (client) {
      return client;
    }
    if (!llm) {
      return null;
    }
    if (typeof llm !== "string") {
      return createLLMClient(llm);
    }
    const provider = resolveLLMProvider(llm);
    if (!provider) {
      throw new Error(`No LLM provider registered for model '${llm}'.`);
    }
    return provider;
  }

  private resolvePlanningLLMClient(config: PlanningConfig): LLMClient | null {
    if (!config.llm) {
      return this.resolveLLMClient();
    }
    if (typeof config.llm !== "string") {
      return createLLMClient(config.llm);
    }
    return resolveLLMProvider(config.llm) ?? null;
  }

  private async preparePromptWithPlanning(prompt: string, tools: readonly Tool[]): Promise<string> {
    prompt = this.promptWithInjectedDate(prompt);
    if (!this.planningConfig) {
      return prompt;
    }
    const config = this.planningConfig;
    const llmClient = this.resolvePlanningLLMClient(config);
    if (!llmClient) {
      return prompt;
    }
    const toolNames = tools.length > 0
      ? tools.map((tool) => sanitizeToolName(tool.name)).join(", ")
      : "No tools available";
    const planningMessages: LLMMessage[] = [
      {
        role: "system",
        content: createAgentPlanningSystemPrompt({
          role: this.role,
          goal: this.goal,
          backstory: this.backstory,
          config,
        }),
      },
      {
        role: "user",
        content: createAgentPlanningPrompt({
          role: this.role,
          goal: this.goal,
          backstory: this.backstory,
          description: prompt,
          tools: toolNames,
          config,
        }),
      },
    ];
    try {
      this.emitReasoningStarted(1);
      const result = await this.callAndTrackLLM(llmClient, planningMessages, [], {}, 0);
      const rawPlan = typeof result === "string" ? result : JSON.stringify(result);
      const plan = await this.runPlanningLoop(llmClient, config, rawPlan);
      const heading = this.reasoning && !this.planning ? "Reasoning Plan" : "Planning";
      return `${prompt}\n\n${heading}:\n${plan.plan.plan}`;
    } catch (error) {
      this.emitReasoningFailed(error, 1);
      throw error;
    }
  }

  private async runPlanningLoop(
    llmClient: LLMClient,
    config: PlanningConfig,
    initialRawPlan: string,
  ): Promise<{ plan: ReturnType<typeof parseAgentPlanningOutput> }> {
    let attempt = 1;
    let plan = parseAgentPlanningOutput(initialRawPlan);
    this.emitReasoningCompleted(plan.plan, plan.ready, attempt);

    const maxAttempts = config.maxAttempts;
    while (!plan.ready && (maxAttempts === null || attempt < maxAttempts)) {
      attempt += 1;
      this.emitReasoningStarted(attempt);
      const refineMessages: LLMMessage[] = [
        {
          role: "system",
          content: createAgentPlanningSystemPrompt({
            role: this.role,
            goal: this.goal,
            backstory: this.backstory,
            config,
          }),
        },
        {
          role: "user",
          content: createAgentRefinePlanningPrompt({
            role: this.role,
            goal: this.goal,
            backstory: this.backstory,
            currentPlan: plan.plan,
            config,
          }),
        },
      ];
      const result = await this.callAndTrackLLM(llmClient, refineMessages, [], {}, 0);
      const rawPlan = typeof result === "string" ? result : JSON.stringify(result);
      plan = parseAgentPlanningOutput(rawPlan);
      this.emitReasoningCompleted(plan.plan, plan.ready, attempt);
    }

    return { plan };
  }

  private emitReasoningStarted(attempt: number): void {
    if (!this.reasoning && !this.planning) {
      return;
    }
    crewaiEventBus.emit(this, new AgentReasoningStartedEvent({
      agentRole: this.role,
      taskId: "kickoff",
      attempt,
    }));
  }

  private emitReasoningCompleted(plan: string, ready: boolean, attempt: number): void {
    if (!this.reasoning && !this.planning) {
      return;
    }
    crewaiEventBus.emit(this, new AgentReasoningCompletedEvent({
      agentRole: this.role,
      taskId: "kickoff",
      plan,
      ready,
      attempt,
      fromAgent: this,
    }));
  }

  private emitReasoningFailed(error: unknown, attempt: number): void {
    if (!this.reasoning && !this.planning) {
      return;
    }
    crewaiEventBus.emit(this, new AgentReasoningFailedEvent({
      agentRole: this.role,
      taskId: "kickoff",
      error,
      attempt,
      fromAgent: this,
    }));
  }

  private promptWithInjectedDate(prompt: string): string {
    if (!this.injectDate) {
      return prompt;
    }
    const currentDate = formatDate(new Date(), this.dateFormat);
    return currentDate ? `${prompt}\n\nCurrent Date: ${currentDate}` : prompt;
  }

  private promptWithMemoryContext(prompt: string, executionMemory: Memory | MemoryScope | null): string {
    const memory = this.memory ?? executionMemory;
    if (!memory) {
      return prompt;
    }
    const matches = memory.recall(prompt, { limit: 5 });
    if (matches.length === 0) {
      return prompt;
    }
    const memoryBlock = `Relevant memories:\n${matches.map((match) => match.format()).join("\n")}`;
    return [
      prompt,
      "# Memories from past conversations:",
      memoryBlock,
      "IMPORTANT: The memories above are an automatic selection and may be INCOMPLETE. If the task involves counting, listing, or summing items, use the Search memory tool with several different queries before answering.",
    ].join("\n\n");
  }

  private promptWithKnowledgeContext(prompt: string, executionKnowledge: Knowledge | null, task: unknown): string {
    const knowledgeSources = [this.knowledge, executionKnowledge].filter((knowledge): knowledge is Knowledge => knowledge !== null);
    let promptWithStaticContext = prompt;
    const staticContexts = [
      this.crewKnowledgeContext ? `Crew knowledge context:\n${this.crewKnowledgeContext}` : "",
      this.agentKnowledgeContext ? `Agent knowledge context:\n${this.agentKnowledgeContext}` : "",
      this.knowledgeSearchQuery ? `Knowledge search query:\n${this.knowledgeSearchQuery}` : "",
    ].filter(Boolean);
    if (staticContexts.length > 0) {
      promptWithStaticContext = `${promptWithStaticContext}\n\n${staticContexts.join("\n\n")}`;
    }
    if (knowledgeSources.length === 0) {
      return promptWithStaticContext;
    }
    const query = this.knowledgeSearchQuery ?? prompt;
    crewaiEventBus.emit(this, new KnowledgeRetrievalStartedEvent({ from_task: task, from_agent: this }));
    crewaiEventBus.emit(this, new KnowledgeQueryStartedEvent({
      task_prompt: query,
      from_task: task,
      from_agent: this,
    }));
    try {
      const contexts = knowledgeSources
        .map((knowledge) => extractKnowledgeContext(knowledge.query(query)))
        .filter(Boolean);
      crewaiEventBus.emit(this, new KnowledgeQueryCompletedEvent({
        query,
        from_task: task,
        from_agent: this,
      }));
      const retrievedKnowledge = contexts.join("\n");
      crewaiEventBus.emit(this, new KnowledgeRetrievalCompletedEvent({
        query,
        retrieved_knowledge: retrievedKnowledge,
        from_task: task,
        from_agent: this,
      }));
      return retrievedKnowledge ? `${promptWithStaticContext}\n\n${retrievedKnowledge}` : promptWithStaticContext;
    } catch (error) {
      crewaiEventBus.emit(this, new KnowledgeQueryFailedEvent({
        error,
        from_task: task,
        from_agent: this,
      }));
      crewaiEventBus.emit(this, new KnowledgeSearchQueryFailedEvent({
        query,
        error,
        from_task: task,
        from_agent: this,
      }));
      return promptWithStaticContext;
    }
  }

  private saveResultToAgentMemory(prompt: string, output: string): void {
    if (!this.memory) {
      return;
    }
    this.memory.remember(`Input: ${prompt}\nAgent: ${this.role}\nResult: ${output}`, {
      agentRole: this.role,
      source: "agent",
    });
  }

  private async callAndTrackLLM(
    llmClient: LLMClient,
    messages: readonly LLMMessage[],
    tools: readonly Tool[],
    options: AgentExecutionOptions,
    iteration = 0,
  ): Promise<Awaited<ReturnType<typeof callLLM>>> {
    await this.rpmController?.waitForSlot();
    this.lastMessagesValue = messages.map((message) => ({ ...message }));
    const beforeUsage = getLLMUsageMetrics(llmClient);
    const model = this.modelNameForClient(llmClient);
    const result = await callLLM(llmClient, messages, {
      tools,
      ...(options.responseModel === undefined ? {} : { responseModel: options.responseModel }),
      metadata: {
        agent: this,
        ...(options.task === undefined ? {} : { task: options.task }),
        ...(model === null ? {} : { model }),
        iterations: iteration,
      },
    });
    const usageDelta = subtractUsageMetrics(getLLMUsageMetrics(llmClient), beforeUsage);
    this.usageMetrics = addUsageMetrics(
      this.usageMetrics,
      !hasLLMUsageMetrics(llmClient) || isEmptyUsageMetrics(usageDelta)
        ? estimateUsageMetrics(messages, result)
        : usageDelta,
    );
    return result;
  }

  private modelNameForClient(llmClient: LLMClient): string | null {
    if (llmClient === this.llmClient && typeof this.llm === "string") {
      return this.llm;
    }
    if (llmClient === this.functionCallingLlmClient && typeof this.functionCallingLlm === "string") {
      return this.functionCallingLlm;
    }
    if ("model" in llmClient && typeof llmClient.model === "string") {
      return llmClient.model;
    }
    return null;
  }

  private async applyGuardrail(initialOutput: string): Promise<string> {
    if (!this.guardrail) {
      return initialOutput;
    }
    let output = initialOutput;
    let lastError: unknown = "Guardrail validation failed";
    for (let attempt = 0; attempt <= this.guardrailMaxRetries; attempt += 1) {
      crewaiEventBus.emit(this, new LLMGuardrailStartedEvent({
        guardrail: this.guardrail,
        retry_count: attempt,
        from_agent: this,
      }));
      let result: ReturnType<typeof normalizeAgentGuardrailResult>;
      try {
        result = normalizeAgentGuardrailResult(await this.guardrail(output));
      } catch (error) {
        crewaiEventBus.emit(this, new LLMGuardrailCompletedEvent({
          success: false,
          result: null,
          error,
          retry_count: attempt,
          from_agent: this,
        }));
        throw error;
      }
      crewaiEventBus.emit(this, new LLMGuardrailCompletedEvent({
        success: result.success,
        result: result.result ?? null,
        ...(result.success ? {} : { error: result.error ?? result.result }),
        retry_count: attempt,
        from_agent: this,
      }));
      if (result.success) {
        return result.result === undefined || result.result === null ? output : stringifyAgentGuardrailValue(result.result);
      }
      lastError = result.error ?? result.result ?? lastError;
      if (attempt >= this.guardrailMaxRetries) {
        throw new AgentGuardrailError(
          `Agent's guardrail failed validation after ${String(this.guardrailMaxRetries)} retries. Last error: ${String(lastError)}`,
        );
      }
      if (result.result !== undefined && result.result !== null) {
        output = stringifyAgentGuardrailValue(result.result);
      }
    }
    return output;
  }

  private async emitStep(step: AgentStep, callbacks: readonly AgentStepCallback[] = []): Promise<void> {
    if (this.stepCallback) {
      await this.stepCallback(step);
    }
    for (const callback of callbacks) {
      if (callback !== this.stepCallback) {
        await callback(step);
      }
    }
  }

  private buildMessages(prompt: string, inputs: InputValues, tools: readonly Tool[]): LLMMessage[] {
    const renderedInputs = Object.entries(inputs)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join("\n");
    const renderedTools = tools.length > 0
      ? `\n\nAvailable tools:\n${renderToolsDescription(tools)}`
      : "";
    const renderedSkills = renderAgentSkills(this.skills);
    const systemContent = this.renderSystemPrompt(
      `Role: ${this.role}\nGoal: ${this.goal}\nBackstory: ${this.backstory}${renderedSkills}${renderedTools}`,
    );
    const userContent = this.renderUserPrompt(renderedInputs ? `${prompt}\n\nInputs:\n${renderedInputs}` : prompt);

    if (!this.useSystemPrompt) {
      return [
        {
          role: "user",
          content: `${systemContent}\n\n${userContent}`,
        },
      ];
    }

    return [
      {
        role: "system",
        content: systemContent,
      },
      {
        role: "user",
        content: userContent,
      },
    ];
  }

  private renderSystemPrompt(content: string): string {
    return renderAgentTemplate(this.systemTemplate, {
      role: this.role,
      goal: this.goal,
      backstory: this.backstory,
      system: content,
      prompt: content,
      response: "",
    }) ?? content;
  }

  private renderUserPrompt(content: string): string {
    const renderedPrompt = renderAgentTemplate(this.promptTemplate, {
      role: this.role,
      goal: this.goal,
      backstory: this.backstory,
      system: "",
      prompt: content,
      response: "",
    }) ?? content;
    const responsePrefix = renderResponsePrefix(this.responseTemplate, {
      role: this.role,
      goal: this.goal,
      backstory: this.backstory,
      system: "",
      prompt: renderedPrompt,
      response: "",
    });
    return responsePrefix ? `${renderedPrompt}\n${responsePrefix}` : renderedPrompt;
  }

  private async runToolCall(
    toolName: string,
    args: Record<string, unknown>,
    tools: readonly Tool[],
  ): Promise<{ tool: Tool; output: unknown }> {
    const tool = tools.find((candidate) => sanitizeToolName(candidate.name) === sanitizeToolName(toolName));
    if (!tool) {
      throw new Error(`Tool '${toolName}' is not available to agent '${this.role}'.`);
    }
    const sanitizedName = sanitizeToolName(tool.name);
    const cacheInput = JSON.stringify(args);
    const cached = this.toolsHandler.cache?.read(sanitizedName, cacheInput);
    if (cached !== null && cached !== undefined) {
      return { tool, output: cached };
    }
    const output = await tool.run(args);
    this.toolsHandler.onToolUse(
      { toolName: sanitizedName, arguments: args },
      typeof output === "string" ? output : JSON.stringify(output),
      shouldCacheToolResult(tool, args, output),
    );
    return { tool, output };
  }
}

function normalizeAgentGuardrailResult(result: AgentGuardrailResult): { success: boolean; result?: unknown; error?: unknown } {
  if (isAgentGuardrailTuple(result)) {
    return { success: result[0], result: result[1] };
  }
  return result;
}

function formatKickoffInput(input: AgentKickoffInput, explicitInputFiles?: InputFiles): { prompt: string; inputFiles: InputFiles } {
  if (typeof input === "string") {
    return {
      prompt: input,
      inputFiles: explicitInputFiles ?? {},
    };
  }

  const messageInputFiles: InputFiles = {};
  const prompt = input
    .map((message) => {
      if (message.files) {
        Object.assign(messageInputFiles, message.files);
      }
      return message.content;
    })
    .filter(Boolean)
    .join("\n");

  return {
    prompt,
    inputFiles: { ...messageInputFiles, ...(explicitInputFiles ?? {}) },
  };
}

function promptWithRenderedInputFiles(prompt: string, inputFiles?: InputFiles): string {
  const renderedInputFiles = renderInputFiles(inputFiles ?? {});
  return renderedInputFiles ? `${prompt}\n\n${renderedInputFiles}` : prompt;
}

function interpolateAgentText(value: string, inputs: InputValues): string {
  return value.replaceAll(/\{([^}]+)\}/g, (placeholder, key: string) => {
    const trimmed = key.trim();
    if (!(trimmed in inputs)) {
      return placeholder;
    }
    const inputValue = inputs[trimmed];
    if (typeof inputValue === "string") {
      return inputValue;
    }
    if (inputValue === undefined || inputValue === null) {
      return "";
    }
    if (typeof inputValue === "number" || typeof inputValue === "boolean" || typeof inputValue === "bigint") {
      return inputValue.toString();
    }
    return JSON.stringify(inputValue);
  });
}

function isAgentGuardrailTuple(result: AgentGuardrailResult): result is readonly [boolean, unknown] {
  return Array.isArray(result);
}

function stringifyAgentGuardrailValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function shouldCacheToolResult(tool: Tool, args: Record<string, unknown>, output: unknown): boolean {
  const cacheFunction = (tool as { cacheFunction?: unknown; cache_function?: unknown }).cacheFunction
    ?? (tool as { cache_function?: unknown }).cache_function;
  return typeof cacheFunction === "function"
    ? (cacheFunction as (args: Record<string, unknown>, result: unknown) => boolean)(args, output)
    : true;
}

function dedupeSkills(skills: readonly unknown[]): unknown[] {
  const seen = new Set<string>();
  const resolved: unknown[] = [];
  for (const skill of skills) {
    const key = skillDedupeKey(skill);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    resolved.push(skill);
  }
  return resolved;
}

function skillDedupeKey(skill: unknown): string {
  if (skill instanceof Skill) {
    return `skill:${skill.name}`;
  }
  if (typeof skill === "string") {
    return `string:${skill}`;
  }
  if (skill && typeof skill === "object") {
    const name = (skill as { name?: unknown }).name;
    if (typeof name === "string") {
      return `object:${name}`;
    }
  }
  return `value:${JSON.stringify(skill)}`;
}

function renderAgentSkills(skills: readonly unknown[]): string {
  if (skills.length === 0) {
    return "";
  }
  const rendered = skills
    .map((skill) => renderAgentSkill(skill))
    .filter((section) => section.length > 0);
  return rendered.length > 0 ? `\n\n<skills>\n${rendered.join("\n\n")}\n</skills>` : "";
}

function renderAgentSkill(skill: unknown): string {
  if (skill instanceof Skill) {
    return formatSkillContext(skill);
  }
  if (typeof skill === "string") {
    return skill;
  }
  if (!skill || typeof skill !== "object") {
    return "";
  }
  const name = (skill as { name?: unknown }).name;
  const description = (skill as { description?: unknown }).description;
  if (typeof name !== "string" && typeof description !== "string") {
    return "";
  }
  return [
    typeof name === "string" ? `<skill name="${escapeXmlAttribute(name)}">` : "<skill>",
    typeof description === "string" ? description : "",
    "</skill>",
  ].join("\n");
}

function escapeXmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

type AgentTemplateValues = {
  role: string;
  goal: string;
  backstory: string;
  system: string;
  prompt: string;
  response: string;
};

function renderAgentTemplate(template: string | null, values: AgentTemplateValues): string | null {
  if (!template) {
    return null;
  }
  return template
    .replaceAll("{{ .System }}", values.system)
    .replaceAll("{{ .Prompt }}", values.prompt)
    .replaceAll("{{ .Response }}", values.response)
    .replaceAll("{role}", values.role)
    .replaceAll("{goal}", values.goal)
    .replaceAll("{backstory}", values.backstory);
}

function renderResponsePrefix(template: string | null, values: AgentTemplateValues): string | null {
  if (!template) {
    return null;
  }
  const prefix = template.split("{{ .Response }}")[0] ?? template;
  return renderAgentTemplate(prefix, values);
}

function isNonRetryableExecutionError(error: unknown): boolean {
  return error instanceof ToolValidationError
    || error instanceof ToolUsageLimitExceededError
    || error instanceof AgentGuardrailError
    || error instanceof AgentExecutionTimeoutError;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readRecordValue(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

export class AgentGuardrailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentGuardrailError";
  }
}

export class AgentExecutionTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentExecutionTimeoutError";
  }
}

function validateMaxExecutionTime(value: number | null): number | null {
  if (value === null) {
    return null;
  }
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("maxExecutionTime must be a positive number of seconds.");
  }
  return value;
}

async function withExecutionTimeout<T>(promise: Promise<T>, timeoutSeconds: number, prompt: string): Promise<T> {
  let timeoutId!: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new AgentExecutionTimeoutError(
        `Task '${prompt}' execution timed out after ${String(timeoutSeconds)} seconds. Consider increasing maxExecutionTime or optimizing the task.`,
      ));
    }, timeoutSeconds * 1000);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function formatDate(date: Date, format: string): string | null {
  if (!/%[YymdHMSBbAa]/.test(format)) {
    return null;
  }
  const replacements: Record<string, string> = {
    "%Y": String(date.getFullYear()),
    "%y": String(date.getFullYear()).slice(-2),
    "%m": String(date.getMonth() + 1).padStart(2, "0"),
    "%d": String(date.getDate()).padStart(2, "0"),
    "%H": String(date.getHours()).padStart(2, "0"),
    "%M": String(date.getMinutes()).padStart(2, "0"),
    "%S": String(date.getSeconds()).padStart(2, "0"),
    "%B": MONTH_NAMES[date.getMonth()] ?? "",
    "%b": SHORT_MONTH_NAMES[date.getMonth()] ?? "",
    "%A": WEEKDAY_NAMES[date.getDay()] ?? "",
    "%a": SHORT_WEEKDAY_NAMES[date.getDay()] ?? "",
  };
  return Object.entries(replacements).reduce(
    (formatted, [token, value]) => formatted.replaceAll(token, value),
    format,
  );
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SHORT_MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const SHORT_WEEKDAY_NAMES = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];
