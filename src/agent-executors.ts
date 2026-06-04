import { Agent, type AgentExecutionOptions, type AgentOptions } from "./agent.js";
import type { CheckpointConfig } from "./state.js";
import type { Crew } from "./crew.js";
import { AgentReasoning, StepObservation, TodoItem, TodoList, TodoStatus } from "./agent-planning.js";
import { AgentAction, AgentFinish, OutputParserError, parseAgentOutput } from "./agent-parser.js";
import {
  executeSingleNativeToolCall,
  enforceRpmLimit,
  extractTaskSection,
  extractToolCallInfo,
  formatMessageForLLM,
  handleAgentActionCore,
  handleContextLength,
  handleOutputParserException,
  handleUnknownError,
  _executor_stop_words,
  checkNativeToolSupport,
  handleMaxIterationsExceeded,
  isContextLengthExceeded,
  isToolCallList,
  processLlmResponse,
  setupNativeTools,
  summarizeMessages,
  type MaxIterationsLLM,
} from "./agent-utils.js";
import { Converter } from "./converter.js";
import {
  AgentLogsExecutionEvent,
  AgentLogsStartedEvent,
  PlanRefinementEvent,
  PlanReplanTriggeredEvent,
  StepObservationCompletedEvent,
  StepObservationFailedEvent,
  StepObservationStartedEvent,
  crewaiEventBus,
} from "./events.js";
import { get_provider } from "./human-input.js";
import { ToolCallHookContext, runAfterToolCallHooks, runBeforeToolCallHooks } from "./hooks.js";
import { I18N_DEFAULT } from "./i18n.js";
import { BaseLLM, callStopOverrideSync, UsageMetrics, type LLMResponse } from "./llm.js";
import { PRINTER } from "./logger.js";
import { sanitize_scope_name } from "./memory.js";
import { StepExecutionContext, StepResult } from "./step-execution-context.js";
import { sanitizeToolName } from "./tools.js";
import type { InputValues, LLMMessage, MaybePromise, Tool } from "./types.js";

export const ACTION_INPUT_REGEX = /Action\s*\d*\s*:\s*(.*?)\s*Action\s*\d*\s*Input\s*\d*\s*:\s*(.*)/s;
export const ACTION_REGEX = /Action\s*\d*\s*:\s*(.*?)/s;
export const ACTION_INPUT_ONLY_REGEX = /\s*Action\s*\d*\s*Input\s*\d*\s*:\s*(.*)/s;

export type PlatformApp = Record<string, unknown>;
export const PlatformApp = Object.freeze({ kind: "PlatformApp" });

export type PlatformAppOrAction = PlatformApp | string | ((...args: unknown[]) => unknown);
export const PlatformAppOrAction = Object.freeze({ kind: "PlatformAppOrAction" });

export class BaseAgent extends Agent {
  static async fromCheckpoint(config: CheckpointConfig): Promise<BaseAgent> {
    return await Agent.fromCheckpoint(config) as BaseAgent;
  }

  static async from_checkpoint(config: CheckpointConfig): Promise<BaseAgent> {
    return await BaseAgent.fromCheckpoint(config);
  }

  static async fork(config: CheckpointConfig, branch?: string | null): Promise<BaseAgent> {
    return await Agent.fork(config, branch) as BaseAgent;
  }

  static coerceSkillStrings(skills: unknown): unknown {
    return Agent.coerceSkillStrings(skills);
  }

  static coerce_skill_strings(skills: unknown): unknown {
    return BaseAgent.coerceSkillStrings(skills);
  }

  static processModelConfig(values: Record<string, unknown>): Record<string, unknown> {
    return Agent.processModelConfig(values);
  }

  static process_model_config(values: Record<string, unknown>): Record<string, unknown> {
    return BaseAgent.processModelConfig(values);
  }

  get key(): string {
    return super.key;
  }

  getRole(): string {
    return this.role;
  }

  get_role(): string {
    return this.getRole();
  }

  override copy(): BaseAgent {
    const copied = super.copy();
    return new BaseAgent({
      role: copied.role,
      goal: copied.goal,
      backstory: copied.backstory,
      config: copied.config,
      llm: copied.llm,
      crew: copied.crew,
      functionCallingLlm: copied.functionCallingLlm,
      memory: copied.memory,
      knowledge: copied.knowledge,
      knowledgeStorage: copied.knowledgeStorage,
      knowledgeConfig: copied.knowledgeConfig,
      embedder: copied.embedder,
      agentKnowledgeContext: copied.agentKnowledgeContext,
      crewKnowledgeContext: copied.crewKnowledgeContext,
      knowledgeSearchQuery: copied.knowledgeSearchQuery,
      cache: copied.cache,
      cacheHandler: copied.cacheHandler,
      toolsHandler: copied.toolsHandler,
      toolsResults: copied.toolsResults,
      callbacks: copied.callbacks,
      adaptedAgent: copied.adaptedAgent,
      apps: copied.apps,
      mcps: copied.mcps,
      a2a: copied.a2a,
      agentExecutor: copied.agentExecutor,
      executorClass: copied.executorClass,
      maxTokens: copied.maxTokens,
      fromRepository: copied.fromRepository,
      tools: copied.tools,
      verbose: copied.verbose,
      allowDelegation: copied.allowDelegation,
      allowCodeExecution: copied.allowCodeExecution,
      codeExecutionMode: copied.codeExecutionMode,
      respectContextWindow: copied.respectContextWindow,
      multimodal: copied.multimodal,
      maxIter: copied.maxIter,
      maxRetryLimit: copied.maxRetryLimit,
      maxExecutionTime: copied.maxExecutionTime,
      maxRpm: copied.maxRpm,
      stepCallback: copied.stepCallback,
      useSystemPrompt: copied.useSystemPrompt,
      systemTemplate: copied.systemTemplate,
      promptTemplate: copied.promptTemplate,
      responseTemplate: copied.responseTemplate,
      injectDate: copied.injectDate,
      dateFormat: copied.dateFormat,
      guardrail: copied.guardrail,
      guardrailMaxRetries: copied.guardrailMaxRetries,
      planning: copied.planning,
      reasoning: copied.reasoning,
      maxReasoningAttempts: copied.maxReasoningAttempts,
      planningConfig: copied.planningConfig,
      skills: copied.skills,
      securityConfig: copied.securityConfig,
      checkpoint: copied.checkpoint,
      executionContext: copied.executionContext,
      checkpointKickoffEventId: copied.checkpointKickoffEventId,
    } satisfies AgentOptions);
  }

  executeTask(
    prompt: string,
    inputs = {},
    taskTools: readonly Tool[] = [],
    options: AgentExecutionOptions = {},
  ): Promise<string> {
    return super.executeTask(prompt, inputs, taskTools, options);
  }

  execute_task(
    promptOrOptions: Parameters<Agent["execute_task"]>[0],
    context?: string | null,
    tools?: readonly Tool[],
  ): Promise<string> {
    return super.execute_task(promptOrOptions, context, tools);
  }

  aexecuteTask(
    prompt: string,
    inputs?: InputValues,
    tools?: readonly Tool[],
    options?: AgentExecutionOptions,
  ): Promise<string>;
  aexecuteTask(
    promptOrOptions: Parameters<Agent["execute_task"]>[0],
    context?: string | null,
    tools?: readonly Tool[],
  ): Promise<string>;
  aexecuteTask(
    promptOrOptions: Parameters<Agent["execute_task"]>[0],
    contextOrInputs?: string | null | InputValues,
    tools?: readonly Tool[],
    options?: AgentExecutionOptions,
  ): Promise<string> {
    return typeof promptOrOptions === "string" && contextOrInputs && typeof contextOrInputs === "object" && !Array.isArray(contextOrInputs)
      ? super.aexecuteTask(promptOrOptions, contextOrInputs, tools, options)
      : super.aexecuteTask(promptOrOptions, typeof contextOrInputs === "string" ? contextOrInputs : null, tools);
  }

  aexecute_task(
    promptOrOptions: Parameters<Agent["aexecute_task"]>[0],
    context?: string | null,
    tools?: readonly Tool[],
  ): Promise<string> {
    return super.aexecute_task(promptOrOptions, context, tools);
  }

  createAgentExecutor(): unknown {
    return super.createAgentExecutor();
  }

  create_agent_executor(): unknown {
    return this.createAgentExecutor();
  }

  getDelegationTools(): readonly Tool[] {
    return super.getDelegationTools();
  }

  get_delegation_tools(): readonly Tool[] {
    return this.getDelegationTools();
  }

  getPlatformTools(): readonly Tool[] {
    return super.getPlatformTools();
  }

  get_platform_tools(): readonly Tool[] {
    return this.getPlatformTools();
  }

  getMcpTools(): readonly Tool[] {
    return super.getMcpTools();
  }

  get_mcp_tools(): readonly Tool[] {
    return this.getMcpTools();
  }

  interpolateInputs(inputs: Record<string, unknown>): void {
    super.interpolateInputs(inputs);
  }

  interpolate_inputs(inputs: Record<string, unknown>): void {
    this.interpolateInputs(inputs);
  }

  resolveMemory(): ReturnType<Agent["resolveMemory"]> {
    return super.resolveMemory();
  }

  resolve_memory(): ReturnType<Agent["resolveMemory"]> {
    return this.resolveMemory();
  }

  setCacheHandler(cacheHandler: Parameters<Agent["setCacheHandler"]>[0]): void {
    super.setCacheHandler(cacheHandler);
  }

  set_cache_handler(cacheHandler: Parameters<Agent["setCacheHandler"]>[0]): void {
    this.setCacheHandler(cacheHandler);
  }

  setKnowledge(knowledge: Parameters<Agent["setKnowledge"]>[0]): void {
    super.setKnowledge(knowledge);
  }

  set_knowledge(knowledge: Parameters<Agent["setKnowledge"]>[0]): void {
    this.setKnowledge(knowledge);
  }

  setPrivateAttrs(): this {
    return super.setPrivateAttrs();
  }

  set_private_attrs(): this {
    return this.setPrivateAttrs();
  }

  setRpmController(controller: Parameters<Agent["setRpmController"]>[0]): void {
    super.setRpmController(controller);
  }

  set_rpm_controller(controller: Parameters<Agent["setRpmController"]>[0]): void {
    this.setRpmController(controller);
  }

  setSkills(resolvedCrewSkills: readonly unknown[] | null = null): void {
    super.setSkills(resolvedCrewSkills);
  }

  set_skills(resolvedCrewSkills: readonly unknown[] | null = null): void {
    this.setSkills(resolvedCrewSkills);
  }

  validateAndSetAttributes(): this {
    return super.validateAndSetAttributes();
  }

  validate_and_set_attributes(): this {
    return this.validateAndSetAttributes();
  }

  validateApps(): this {
    return super.validateApps();
  }

  validate_apps(): this {
    return this.validateApps();
  }

  validateMcps(): this {
    return super.validateMcps();
  }

  validate_mcps(): this {
    return this.validateMcps();
  }

  validateTools(): this {
    return super.validateTools();
  }

  validate_tools(): this {
    return this.validateTools();
  }
}

export type BaseAgentExecutorOptions = {
  crew?: Crew | null;
  agent?: Agent | null;
  task?: unknown;
  tools?: readonly Tool[];
  originalTools?: readonly Tool[];
  original_tools?: readonly Tool[];
  maxIter?: number;
  max_iter?: number;
  messages?: readonly LLMMessage[];
  llm?: unknown;
  prompt?: Record<string, string> | null;
  toolsNames?: string;
  tools_names?: string;
  toolsDescription?: string;
  tools_description?: string;
  stop?: readonly string[];
  stop_words?: readonly string[];
  requestWithinRpmLimit?: (() => boolean | Promise<boolean>) | null;
  request_within_rpm_limit?: (() => boolean | Promise<boolean>) | null;
  callbacks?: readonly unknown[];
  stepCallback?: ((value: AgentAction | AgentFinish) => unknown) | null;
  step_callback?: ((value: AgentAction | AgentFinish) => unknown) | null;
  responseModel?: unknown;
  response_model?: unknown;
  respectContextWindow?: boolean;
  respect_context_window?: boolean;
};

export class BaseAgentExecutor {
  readonly executorType: string;
  readonly executor_type: string;
  readonly crew: Crew | null;
  readonly agent: Agent | null;
  readonly task: unknown;
  readonly tools: readonly Tool[];
  readonly originalTools: readonly Tool[];
  readonly original_tools: readonly Tool[];
  readonly llm: unknown;
  readonly prompt: Record<string, string> | null;
  readonly stop: readonly string[];
  readonly stop_words: readonly string[];
  readonly requestWithinRpmLimit: (() => boolean | Promise<boolean>) | null;
  readonly request_within_rpm_limit: (() => boolean | Promise<boolean>) | null;
  readonly callbacks: readonly unknown[];
  readonly stepCallback: ((value: AgentAction | AgentFinish) => unknown) | null;
  readonly step_callback: ((value: AgentAction | AgentFinish) => unknown) | null;
  responseModel: unknown;
  response_model: unknown;
  readonly respectContextWindow: boolean;
  readonly respect_context_window: boolean;
  readonly maxIter: number;
  readonly max_iter: number;
  iterations = 0;
  messages: LLMMessage[];

  constructor(options: BaseAgentExecutorOptions = {}) {
    this.executorType = "base";
    this.executor_type = this.executorType;
    this.crew = options.crew ?? null;
    this.agent = options.agent ?? null;
    this.task = options.task ?? null;
    this.tools = options.tools ?? this.agent?.tools ?? [];
    this.originalTools = options.originalTools ?? options.original_tools ?? this.tools;
    this.original_tools = this.originalTools;
    this.llm = options.llm ?? this.agent?.llm ?? null;
    this.prompt = options.prompt ?? null;
    this.stop = options.stop ?? options.stop_words ?? [];
    this.stop_words = this.stop;
    this.requestWithinRpmLimit = options.requestWithinRpmLimit ?? options.request_within_rpm_limit ?? null;
    this.request_within_rpm_limit = this.requestWithinRpmLimit;
    this.callbacks = options.callbacks ?? [];
    this.stepCallback = options.stepCallback ?? options.step_callback ?? null;
    this.step_callback = this.stepCallback;
    this.responseModel = options.responseModel ?? options.response_model ?? null;
    this.response_model = this.responseModel;
    this.respectContextWindow = options.respectContextWindow
      ?? options.respect_context_window
      ?? this.agent?.respectContextWindow
      ?? this.agent?.respect_context_window
      ?? true;
    this.respect_context_window = this.respectContextWindow;
    this.maxIter = options.maxIter ?? options.max_iter ?? this.agent?.maxIter ?? 25;
    this.max_iter = this.maxIter;
    this.messages = [...(options.messages ?? [])];
  }

  invoke(input: string | readonly LLMMessage[] = ""): MaybePromise<unknown> {
    this.iterations += 1;
    if (typeof input === "string") {
      if (!input) {
        return new AgentFinish({ thought: "", output: input, text: input });
      }
      this.messages.push({ role: "user", content: input });
    } else {
      this.messages.push(...input);
    }
    return new AgentFinish({ thought: "", output: input, text: typeof input === "string" ? input : "" });
  }

  ainvoke(input: string | readonly LLMMessage[] = ""): Promise<unknown> {
    return Promise.resolve(this.invoke(input));
  }

  _save_to_memory(output: AgentFinish): void {
    if (!this.agent) {
      return;
    }
    const agentRecord = this.agent as unknown as Record<string, unknown>;
    const crewRecord = this.crew as unknown as Record<string, unknown> | null;
    const memory = agentRecord.memory ?? crewRecord?._memory;
    if (!memory || typeof memory !== "object" || !this.task) {
      return;
    }
    const memoryRecord = memory as Record<string, unknown>;
    if (memoryRecord.readOnly === true || memoryRecord.read_only === true) {
      return;
    }
    if (output.text.includes(`Action: ${sanitizeToolName("Delegate work to coworker")}`)) {
      return;
    }
    const taskRecord = this.task as Record<string, unknown>;
    const agentRole = typeof agentRecord.role === "string" ? agentRecord.role : "";
    const taskDescription = typeof taskRecord.description === "string" ? taskRecord.description : "";
    const expectedOutput = typeof taskRecord.expectedOutput === "string"
      ? taskRecord.expectedOutput
      : typeof taskRecord.expected_output === "string" ? taskRecord.expected_output : "";
    const raw = [
      `Task: ${taskDescription}`,
      `Agent: ${agentRole}`,
      `Expected result: ${expectedOutput}`,
      `Result: ${output.text}`,
    ].join("\n");
    try {
      const extract = (memoryRecord.extractMemories ?? memoryRecord.extract_memories) as ((raw: string) => unknown) | undefined;
      const extracted = typeof extract === "function"
        ? extract.call(memory, raw)
        : [];
      if (!Array.isArray(extracted) || extracted.length === 0) {
        return;
      }
      const options: Record<string, unknown> = {
        agentRole,
        agent_role: agentRole,
      };
      const rootScope = memoryRecord.rootScope ?? memoryRecord.root_scope;
      if (typeof rootScope === "string" && rootScope) {
        const agentRoot = `${rootScope.replace(/\/+$/g, "")}/agent/${sanitize_scope_name(agentRole || "unknown")}`;
        options.rootScope = agentRoot.startsWith("/") ? agentRoot : `/${agentRoot}`;
        options.root_scope = options.rootScope;
        options.scope = options.rootScope;
      }
      const rememberMany = (memoryRecord.rememberMany ?? memoryRecord.remember_many) as ((contents: readonly unknown[], options: Record<string, unknown>) => unknown) | undefined;
      if (typeof rememberMany === "function") {
        rememberMany.call(memory, extracted, options);
      }
    } catch (error) {
      const logger = agentRecord._logger as { log?: (level: string, message: string) => void } | undefined;
      logger?.log?.("error", `Failed to save to memory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export class AgentExecutorState {
  readonly id = crypto.randomUUID();
  messages: LLMMessage[];
  iterations: number;
  current_answer: unknown = null;
  is_finished = false;
  ask_for_human_input = false;
  use_native_tools = false;
  pending_tool_calls: unknown[] = [];
  plan: string | null = null;
  plan_ready = false;
  todos: TodoList = new TodoList();
  replan_count = 0;
  last_replan_reason: string | null = null;
  observations: Record<number, StepObservation> = {};
  execution_log: Array<Record<string, unknown>> = [];

  constructor(options: { messages?: readonly LLMMessage[]; iterations?: number } = {}) {
    this.messages = [...(options.messages ?? [])];
    this.iterations = options.iterations ?? 0;
  }
}

export class AgentExecutor extends BaseAgentExecutor {
  readonly executorType = "experimental";
  readonly executor_type = "experimental";
  readonly state: AgentExecutorState;
  private lastParserError: Error | null = null;
  private lastContextError: Error | null = null;
  private finalizeCalled = false;
  private isExecuting = false;
  private kickoffInput = "";
  private plannerObserver: PlannerObserver | null = null;
  private stepExecutor: StepExecutor | null = null;

  constructor(options: BaseAgentExecutorOptions & { state?: AgentExecutorState } = {}) {
    super(options);
    this.state = options.state ?? new AgentExecutorState({ messages: this.messages });
    this.bindStateBackedCompatibilityProperties();
  }

  private bindStateBackedCompatibilityProperties(): void {
    Object.defineProperty(this, "iterations", {
      configurable: true,
      enumerable: true,
      get: () => this.state.iterations,
      set: (value: unknown) => {
        this.state.iterations = Number(value);
      },
    });
    Object.defineProperty(this, "messages", {
      configurable: true,
      enumerable: true,
      get: () => this.state.messages,
      set: (value: unknown) => {
        this.state.messages = Array.isArray(value) ? value as LLMMessage[] : [];
      },
    });
  }

  get use_stop_words(): boolean {
    const llm = this.llm ?? this.agent?.llm;
    const candidate = typeof llm === "object" && llm !== null
      ? llm as { supportsStopWords?: unknown; supports_stop_words?: unknown }
      : null;
    const supports = candidate?.supportsStopWords ?? candidate?.supports_stop_words;
    if (typeof supports !== "function") {
      return false;
    }
    return Boolean((supports as () => unknown).call(llm));
  }

  generatePlan(): void {
    this.generate_plan();
  }

  generate_plan(): void {
    const planningEnabled = Boolean(this.agent && "planningEnabled" in this.agent && this.agent.planningEnabled);
    if (!planningEnabled) {
      return;
    }
    const description = typeof this.task === "object" && this.task !== null && "description" in this.task
      ? String(this.task.description)
      : this.kickoffInput || "Complete the requested task";
    this.state.plan = description;
    this.state.plan_ready = true;
    if (this.state.todos.items.length === 0) {
      this.state.todos = new TodoList({
        items: [{ stepNumber: 1, description, status: TodoStatus.PENDING }],
      });
    }
  }

  observeStepResult(): "step_observed_low" | "step_observed_medium" | "step_observed_high" {
    const current = this.state.todos.currentTodo;
    const effort = this._getReasoningEffort();
    if (current) {
      const observation = this._observeCompletedStep({
        completedStep: current,
        result: current.result ?? "",
        allCompleted: this.state.todos.getCompletedTodos(),
        remainingTodos: this.state.todos.getPendingTodos(),
      });
      this.state.observations[current.stepNumber] = observation;
      this.state.execution_log.push({
        type: "observation",
        step_number: current.stepNumber,
        step_completed_successfully: observation.stepCompletedSuccessfully,
        key_information_learned: observation.keyInformationLearned,
        remaining_plan_still_valid: observation.remainingPlanStillValid,
        needs_full_replan: observation.needsFullReplan,
        goal_already_achieved: observation.goalAlreadyAchieved,
        reasoning_effort: effort,
        llm_observation: this._shouldObserveSteps(),
      });
    }
    return effort === "high" ? "step_observed_high" : effort === "medium" ? "step_observed_medium" : "step_observed_low";
  }

  observe_step_result(): ReturnType<AgentExecutor["observeStepResult"]> {
    return this.observeStepResult();
  }

  handleStepObservedLow(): "continue_plan" | "replan_now" {
    return this.finishCurrentObservedTodo();
  }

  handle_step_observed_low(): ReturnType<AgentExecutor["handleStepObservedLow"]> {
    return this.handleStepObservedLow();
  }

  handleStepObservedMedium(): "continue_plan" | "replan_now" {
    return this.finishCurrentObservedTodo();
  }

  handle_step_observed_medium(): ReturnType<AgentExecutor["handleStepObservedMedium"]> {
    return this.handleStepObservedMedium();
  }

  decideNextAction(): "goal_achieved" | "replan_now" | "refine_and_continue" | "continue_plan" {
    const current = this.state.todos.currentTodo;
    if (!current) {
      return "continue_plan";
    }
    const observation = this.state.observations[current.stepNumber];
    if (observation?.goalAlreadyAchieved) {
      this.state.todos.markCompleted(current.stepNumber, current.result);
      return "goal_achieved";
    }
    if (observation?.needsFullReplan || observation?.stepCompletedSuccessfully === false) {
      this.state.todos.markFailed(current.stepNumber, current.result);
      this.state.last_replan_reason = observation.replanReason ?? "Step did not complete successfully";
      return "replan_now";
    }
    this.state.todos.markCompleted(current.stepNumber, current.result);
    return observation?.remainingPlanStillValid && observation.suggestedRefinements?.length
      ? "refine_and_continue"
      : "continue_plan";
  }

  decide_next_action(): ReturnType<AgentExecutor["decideNextAction"]> {
    return this.decideNextAction();
  }

  handleRefineAndContinue(): "has_todos" {
    const observationSteps = Object.keys(this.state.observations).map(Number).filter(Number.isFinite);
    const lastStep = observationSteps.length > 0 ? Math.max(...observationSteps) : null;
    const observation = lastStep === null ? null : this.state.observations[lastStep];
    if (observation?.suggestedRefinements && observation.suggestedRefinements.length > 0) {
      const remaining = this.state.todos.getPendingTodos();
      this._ensurePlannerObserver().applyRefinements(observation, remaining);
      crewaiEventBus.emit(this.agent ?? this, new PlanRefinementEvent({
        agent_role: agentRoleLabel(this.agent),
        step_number: lastStep ?? 0,
        step_description: "",
        refined_step_count: remaining.length,
        refinements: observation.suggestedRefinements.map((refinement) => (
          `Step ${String(refinement.stepNumber)}: ${refinement.newDescription}`
        )),
        from_task: this.task,
        from_agent: this.agent,
      }));
    }
    return "has_todos";
  }

  handle_refine_and_continue(): "has_todos" {
    return this.handleRefineAndContinue();
  }

  handleContinuePlan(): "has_todos" | "all_todos_complete" {
    return this.state.todos.isComplete ? "all_todos_complete" : "has_todos";
  }

  handle_continue_plan(): ReturnType<AgentExecutor["handleContinuePlan"]> {
    return this.handleContinuePlan();
  }

  handleGoalAchieved(): "all_todos_complete" {
    return "all_todos_complete";
  }

  handle_goal_achieved(): "all_todos_complete" {
    return this.handleGoalAchieved();
  }

  handleReplanNow(): "has_todos" | "all_todos_complete" {
    if (this.state.replan_count >= this.getMaxReplans()) {
      return "all_todos_complete";
    }
    this.state.replan_count += 1;
    this.state.last_replan_reason ??= "Dynamic replan triggered";
    this.triggerReplan(this.state.last_replan_reason);
    return this.state.todos.getPendingTodos().length > 0 ? "has_todos" : "all_todos_complete";
  }

  handle_replan_now(): ReturnType<AgentExecutor["handleReplanNow"]> {
    return this.handleReplanNow();
  }

  checkTodosAvailable(): "has_todos" | "no_todos" | "planning_disabled" {
    const planningEnabled = Boolean(this.agent && "planningEnabled" in this.agent && this.agent.planningEnabled);
    if (!planningEnabled) {
      return "planning_disabled";
    }
    return this.state.todos.items.length > 0 ? "has_todos" : "no_todos";
  }

  check_todos_available(): ReturnType<AgentExecutor["checkTodosAvailable"]> {
    return this.checkTodosAvailable();
  }

  getReadyTodosMethod(): "single_todo_ready" | "multiple_todos_ready" | "all_todos_complete" | "needs_replan" {
    const ready = this.state.todos.getReadyTodos();
    if (ready.length === 0) {
      return this.state.todos.isComplete ? "all_todos_complete" : "needs_replan";
    }
    if (ready.length === 1) {
      const [todo] = ready;
      if (todo) {
        this.state.todos.markRunning(todo.stepNumber);
      }
      return "single_todo_ready";
    }
    return "multiple_todos_ready";
  }

  get_ready_todos_method(): ReturnType<AgentExecutor["getReadyTodosMethod"]> {
    return this.getReadyTodosMethod();
  }

  executeTodoSequential(): MaybePromise<"step_executed" | "todo_injected"> {
    const current = this.state.todos.currentTodo;
    if (!current) {
      return "todo_injected";
    }
    if (!this.isPlanningEnabled()) {
      this.injectTodoContext(current);
      return "todo_injected";
    }
    return this._executePlanningTodo(current).then((result) => {
      current.result = result.result;
      this.state.execution_log.push({
        type: "step_execution",
        step_number: current.stepNumber,
        success: result.success,
        result_preview: result.result.slice(0, 200),
        error: result.error,
        tool_calls: result.toolCallsMade,
        execution_time: result.executionTime,
      });
      return "step_executed";
    });
  }

  execute_todo_sequential(): ReturnType<AgentExecutor["executeTodoSequential"]> {
    return this.executeTodoSequential();
  }

  executeTodosParallel(): Promise<"parallel_todos_complete"> {
    for (const todo of this.state.todos.getReadyTodos()) {
      this.state.todos.markRunning(todo.stepNumber);
      todo.result ??= todo.description;
      this.state.todos.markCompleted(todo.stepNumber, todo.result);
    }
    return Promise.resolve("parallel_todos_complete");
  }

  execute_todos_parallel(): Promise<"parallel_todos_complete"> {
    return this.executeTodosParallel();
  }

  afterParallelExecution(): "has_todos" | "all_todos_complete" | "needs_replan" {
    const [shouldReplan, reason] = this.shouldReplan();
    if (shouldReplan) {
      this.state.last_replan_reason = reason;
      return "needs_replan";
    }
    return this.state.todos.isComplete ? "all_todos_complete" : "has_todos";
  }

  after_parallel_execution(): ReturnType<AgentExecutor["afterParallelExecution"]> {
    return this.afterParallelExecution();
  }

  initializeReasoning(): "initialized" {
    this._show_start_logs();
    if (this.state.iterations === 0) {
      this.state.use_native_tools = checkNativeToolSupport(this.llm, this.originalTools);
      if (this.state.use_native_tools) {
        const [openaiTools, availableFunctions, toolNameMapping] = setupNativeTools(this.originalTools);
        Object.assign(this, {
          _openai_tools: openaiTools,
          _available_functions: availableFunctions,
          _tool_name_mapping: toolNameMapping,
        });
      }
    }
    return "initialized";
  }

  initialize_reasoning(): "initialized" {
    return this.initializeReasoning();
  }

  ensureForceFinalAnswer(): "agent_finished" {
    if (!this.state.is_finished) {
      const formattedAnswer = handleMaxIterationsExceeded({
        formattedAnswer: null,
        printer: {
          print: ({ content }) => {
            PRINTER.print(content);
          },
        },
        messages: this.state.messages,
        llm: this.llm as MaxIterationsLLM | null,
        callbacks: this.callbacks,
        verbose: Boolean(this.agent?.verbose),
      });
      if (isPromiseLike(formattedAnswer)) {
        throw new Error("AgentExecutor.ensure_force_final_answer received an async LLM result; use an async execution path instead.");
      }
      this.state.current_answer = formattedAnswer;
      this.state.is_finished = true;
    }
    return "agent_finished";
  }

  ensure_force_final_answer(): "agent_finished" {
    return this.ensureForceFinalAnswer();
  }

  callLlmAndParse(): "parsed" | "parser_error" | "context_error" {
    if (this.state.is_finished) {
      return "parsed";
    }
    try {
      enforceRpmLimit(this.requestWithinRpmLimit);
      const effectiveResponseModel = this.hasOriginalTools() ? null : this.activeResponseModel();
      const answer = this.callExecutorLlm({
        callbacks: this.callbacks,
        fromTask: this.task,
        from_task: this.task,
        fromAgent: this.agent,
        from_agent: this.agent,
        responseModel: effectiveResponseModel,
        response_model: effectiveResponseModel,
        executorContext: this,
        executor_context: this,
        verbose: Boolean(this.agent?.verbose),
      });
      if (answer instanceof AgentAction || answer instanceof AgentFinish) {
        this.state.current_answer = answer;
        return "parsed";
      }
      if (typeof answer !== "string") {
        this.state.current_answer = new AgentFinish({
          thought: "",
          output: answer,
          text: stringifyStepResult(answer),
        });
        return "parsed";
      }
      this.state.current_answer = processLlmResponse(answer, this.use_stop_words);
      return "parsed";
    } catch (error) {
      if (error instanceof OutputParserError) {
        this.lastParserError = error;
        return "parser_error";
      }
      if (isContextLengthExceeded(error)) {
        this.lastContextError = error instanceof Error ? error : new Error(String(error));
        return "context_error";
      }
      handleUnknownError(PRINTER, error, Boolean(this.agent?.verbose));
      throw error;
    }
  }

  call_llm_and_parse(): ReturnType<AgentExecutor["callLlmAndParse"]> {
    return this.callLlmAndParse();
  }

  callLlmNativeTools(): "native_tool_calls" | "native_finished" | "context_error" | "todo_satisfied" {
    if (this.state.is_finished) {
      return "native_finished";
    }
    try {
      this.state.pending_tool_calls = [];
      enforceRpmLimit(this.requestWithinRpmLimit);
      const answer = this.callExecutorLlm({
        callbacks: this.callbacks,
        tools: this.openAiToolsForNativeCall(),
        availableFunctions: null,
        available_functions: null,
        fromTask: this.task,
        from_task: this.task,
        fromAgent: this.agent,
        from_agent: this.agent,
        responseModel: null,
        response_model: null,
        executorContext: this,
        executor_context: this,
        verbose: Boolean(this.agent?.verbose),
      });
      if (Array.isArray(answer) && answer.length > 0 && isToolCallList(answer)) {
        this.state.pending_tool_calls = Array.from(answer as readonly unknown[]);
        return "native_tool_calls";
      }
      const text = stringifyStepResult(answer);
      const finish = new AgentFinish({ thought: "", output: answer, text });
      this.state.current_answer = finish;
      this.invokeStepCallback(finish);
      this.state.messages.push({ role: "assistant", content: text });
      return this.routeFinishWithTodos("native_finished");
    } catch (error) {
      if (isContextLengthExceeded(error)) {
        this.lastContextError = error instanceof Error ? error : new Error(String(error));
        return "context_error";
      }
      handleUnknownError(PRINTER, error, Boolean(this.agent?.verbose));
      throw error;
    }
  }

  call_llm_native_tools(): ReturnType<AgentExecutor["callLlmNativeTools"]> {
    return this.callLlmNativeTools();
  }

  routeByAnswerType(): "execute_tool" | "agent_finished" | "todo_satisfied" {
    return this.state.current_answer instanceof AgentFinish ? this.routeFinishWithTodos("agent_finished") : "execute_tool";
  }

  route_by_answer_type(): ReturnType<AgentExecutor["routeByAnswerType"]> {
    return this.routeByAnswerType();
  }

  executeToolAction(): "tool_completed" | "tool_result_is_final" {
    const answer = this.state.current_answer;
    if (answer instanceof AgentFinish) {
      this.state.is_finished = true;
      return "tool_result_is_final";
    }
    if (!(answer instanceof AgentAction)) {
      this.messages.push({ role: "assistant", content: "" });
      return "tool_completed";
    }
    let result: AgentAction | AgentFinish;
    try {
      const toolResult = handleAgentActionCore(answer, this.tools);
      result = handleAgentActionCore(answer, toolResult) as AgentAction | AgentFinish;
    } catch (error) {
      if (this.agent?.verbose) {
        PRINTER.print(`Error in tool execution: ${executorErrorMessage(error)}`, "red");
      }
      this.incrementTaskToolErrors();
      const errorText = `${answer.text}\nObservation: Error executing tool: ${executorErrorMessage(error)}`;
      result = new AgentAction({
        thought: answer.thought,
        tool: answer.tool,
        toolInput: answer.toolInput,
        text: errorText,
        result: executorErrorMessage(error),
      });
    }
    if (result instanceof AgentFinish) {
      this.state.current_answer = result;
      this.invokeStepCallback(result);
      this.messages.push({ role: "assistant", content: result.text });
      this.state.is_finished = true;
      return "tool_result_is_final";
    }
    this.state.current_answer = result;
    this.invokeStepCallback(result);
    this.messages.push({ role: "assistant", content: result.text });
    this.messages.push({ role: "user", content: I18N_DEFAULT.slice("post_tool_reasoning") });
    return "tool_completed";
  }

  execute_tool_action(): ReturnType<AgentExecutor["executeToolAction"]> {
    return this.executeToolAction();
  }

  executeNativeTool(): "native_tool_completed" | "tool_result_is_final" {
    const pendingCalls = [...this.state.pending_tool_calls];
    this.state.pending_tool_calls = [];
    const normalizedCalls = pendingCalls
      .map((toolCall) => normalizeNativeToolCall(toolCall))
      .filter((call): call is NormalizedNativeToolCall & { name: string } => typeof call.name === "string" && call.name.length > 0);
    const executableCalls = normalizedCalls.map((call, index) => ({
      ...call,
      id: call.id ?? `call_${String(index + 1)}`,
    }));
    if (executableCalls.length > 0) {
      const assistantMessage: {
        role: "assistant";
        content: null;
        tool_calls: Array<{
          id: string;
          type: "function";
          function: { name: string; arguments: string };
        }>;
        raw_tool_call_parts?: unknown[];
      } = {
        role: "assistant",
        content: null,
        tool_calls: executableCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: {
            name: call.name,
            arguments: stringifyNativeToolArguments(call.rawArgs),
          },
        })),
      };
      if (pendingCalls.every(isRawNativeToolPart)) {
        assistantMessage.raw_tool_call_parts = pendingCalls;
      }
      this.state.messages.push(assistantMessage as unknown as LLMMessage);
    }
    for (const { name, args, id, argumentParseError } of executableCalls) {
      if (!name) {
        continue;
      }
      let failed = false;
      let result: unknown;
      if (argumentParseError) {
        failed = true;
        result = `Error: Failed to parse tool arguments as JSON: ${argumentParseError}. Please provide valid JSON arguments for the '${name}' tool.`;
      } else {
        try {
          result = this.executeNativeToolCall(name, asNativeArgsRecord(args));
        } catch (error) {
          failed = true;
          result = `Error executing tool: ${executorErrorMessage(error)}`;
          this.incrementTaskToolErrors();
        }
      }
      const text = stringifyStepResult(result);
      this.state.messages.push({
        role: "tool",
        name,
        content: text,
        tool_call_id: id,
      } as unknown as LLMMessage);
      if (!failed && this.nativeToolResultAsAnswer(name)) {
        this.state.current_answer = new AgentFinish({ thought: "", output: text, text });
        this.state.is_finished = true;
        return "tool_result_is_final";
      }
    }
    return "native_tool_completed";
  }

  execute_native_tool(): ReturnType<AgentExecutor["executeNativeTool"]> {
    return this.executeNativeTool();
  }

  checkNativeTodoCompletion(): "todo_satisfied" | "todo_not_satisfied" {
    return this.state.todos.currentTodo ? "todo_satisfied" : "todo_not_satisfied";
  }

  check_native_todo_completion(): ReturnType<AgentExecutor["checkNativeTodoCompletion"]> {
    return this.checkNativeTodoCompletion();
  }

  continueIteration(): "check_iteration" {
    return "check_iteration";
  }

  continue_iteration(): "check_iteration" {
    return this.continueIteration();
  }

  checkMaxIterations(): "force_final_answer" | "continue_reasoning" | "continue_reasoning_native" {
    if (this.state.iterations >= this.maxIter) {
      return "force_final_answer";
    }
    return this.state.use_native_tools ? "continue_reasoning_native" : "continue_reasoning";
  }

  check_max_iterations(): ReturnType<AgentExecutor["checkMaxIterations"]> {
    return this.checkMaxIterations();
  }

  checkTodoCompletion(): "todo_satisfied" | "todo_not_satisfied" {
    const current = this.state.todos.currentTodo;
    if (!current) {
      return "todo_not_satisfied";
    }
    const answer = this.state.current_answer;
    if (answer instanceof AgentAction) {
      const expectedTool = current.toolToUse ?? current.tool_to_use;
      if (!expectedTool) {
        return "todo_satisfied";
      }
      return sanitizeToolName(answer.tool) === sanitizeToolName(expectedTool)
        ? "todo_satisfied"
        : "todo_not_satisfied";
    }
    if (answer instanceof AgentFinish) {
      return "todo_satisfied";
    }
    return "todo_not_satisfied";
  }

  check_todo_completion(): ReturnType<AgentExecutor["checkTodoCompletion"]> {
    return this.checkTodoCompletion();
  }

  markTodoComplete(): "todo_marked" {
    const current = this.state.todos.currentTodo;
    if (current) {
      const answer = this.state.current_answer;
      const result = answer instanceof AgentFinish ? String(answer.output) : current.result ?? "";
      this.state.todos.markCompleted(current.stepNumber, result);
    }
    return "todo_marked";
  }

  mark_todo_complete(): "todo_marked" {
    return this.markTodoComplete();
  }

  checkMoreTodos(): "has_todos" | "all_todos_complete" | "needs_replan" {
    return this.afterParallelExecution();
  }

  check_more_todos(): ReturnType<AgentExecutor["checkMoreTodos"]> {
    return this.checkMoreTodos();
  }

  incrementAndContinue(): "initialized" {
    this.state.iterations += 1;
    this.iterations = this.state.iterations;
    return "initialized";
  }

  increment_and_continue(): "initialized" {
    return this.incrementAndContinue();
  }

  finalize(): "completed" | "skipped" {
    if (this.finalizeCalled) {
      return "completed";
    }
    this.finalizeCalled = true;
    if (this.state.current_answer === null) {
      const completed = this.state.todos.getCompletedTodos().filter((todo) => todo.result);
      const directFinal = this.canUseLastTodoResultAsFinalAnswer(completed);
      const output = directFinal?.result
        ?? (completed.length > 0
          ? completed.map((todo) => `Step ${String(todo.stepNumber)}: ${todo.result ?? ""}`).join("\n\n")
          : "Agent completed execution but produced no final output.");
      const thought = directFinal
        ? "Final answer returned directly from last completed todo"
        : "";
      this.state.current_answer = new AgentFinish({ thought, output, text: output });
    }
    if (!(this.state.current_answer instanceof AgentFinish)) {
      return "skipped";
    }
    this.state.is_finished = true;
    this._show_logs(this.state.current_answer);
    return "completed";
  }

  private canUseLastTodoResultAsFinalAnswer(todosWithResults: readonly TodoItem[]): TodoItem | null {
    if (this.responseModel !== null || this.response_model !== null || todosWithResults.length === 0) {
      return null;
    }
    const lastTodo = [...todosWithResults].sort((left, right) => right.stepNumber - left.stepNumber)[0];
    if (!lastTodo || lastTodo.toolToUse) {
      return null;
    }
    const result = (lastTodo.result ?? "").trim();
    if (!result) {
      return null;
    }
    const lowered = result.toLowerCase();
    if (lowered.startsWith("error:") || lowered.includes("tool execution error")) {
      return null;
    }
    const wordCount = result.split(/\s+/).filter(Boolean).length;
    const hasSentencePunctuation = /[.!?]/.test(result);
    return hasSentencePunctuation && (result.length >= 200 || wordCount >= 30) ? lastTodo : null;
  }

  handleReplan(): "has_todos" | "no_todos" {
    if (this.state.replan_count >= this.getMaxReplans()) {
      return "no_todos";
    }
    this.state.replan_count += 1;
    this.state.last_replan_reason ??= "Dynamic replan triggered";
    this.triggerReplan(this.state.last_replan_reason);
    return this.state.todos.getPendingTodos().length > 0 ? "has_todos" : "no_todos";
  }

  handle_replan(): ReturnType<AgentExecutor["handleReplan"]> {
    return this.handleReplan();
  }

  recoverFromParserError(): "initialized" {
    if (this.lastParserError) {
      const formattedAnswer = handleOutputParserException(
        this.lastParserError,
        this.state.messages,
        this.state.iterations,
      );
      this.state.current_answer = formattedAnswer;
    }
    this.lastParserError = null;
    this.state.iterations += 1;
    return "initialized";
  }

  recover_from_parser_error(): "initialized" {
    return this.recoverFromParserError();
  }

  recoverFromContextLength(): MaybePromise<"initialized"> {
    if (!this.respectContextWindow) {
      throw new Error("Context length exceeded and user opted not to summarize. Consider using smaller text or RAG tools from crewai_tools.");
    }

    const result = summarizeMessages(
      this.state.messages,
      this.llm as Parameters<typeof summarizeMessages>[1],
      this.callbacks,
      Boolean(this.agent?.verbose),
    );
    const finish = (summaryResult?: { content: unknown }): "initialized" => {
      if (summaryResult) {
        const summary = typeof summaryResult.content === "string"
          ? summaryResult.content
          : JSON.stringify(summaryResult.content ?? "");
        this.state.messages.splice(0, this.state.messages.length, ...handleContextLength(this.state.messages, summary));
      }
      this.lastContextError = null;
      this.state.iterations += 1;
      return "initialized";
    };
    return isPromiseLike(result) ? result.then(() => finish()) : finish(result);
  }

  recover_from_context_length(): MaybePromise<"initialized"> {
    return this.recoverFromContextLength();
  }

  override invoke(input: string | readonly LLMMessage[] | Record<string, unknown> = ""): MaybePromise<unknown> {
    if (typeof input === "object" && !Array.isArray(input) && "input" in input) {
      return this.invokeFromInputs(input);
    }
    return super.invoke(input as string | readonly LLMMessage[]);
  }

  invokeAsync(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.invokeFromInputsAsync(inputs);
  }

  invoke_async(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.invokeAsync(inputs);
  }

  override ainvoke(input: string | readonly LLMMessage[] | Record<string, unknown> = ""): Promise<unknown> {
    return typeof input === "object" && !Array.isArray(input) && "input" in input
      ? this.invokeAsync(input)
      : Promise.resolve(this.invoke(input as string | readonly LLMMessage[]));
  }

  private invokeFromInputs(inputs: Record<string, unknown>): Record<string, unknown> {
    if (this.isExecuting) {
      throw new Error("Executor is already running. Cannot invoke the same executor instance concurrently.");
    }
    this.isExecuting = true;
    try {
      this.resetInvocationState(inputs);
      const kickoff = (this as unknown as { kickoff?: () => unknown }).kickoff;
      if (typeof kickoff === "function") {
        const kickoffResult = this.withLlmStopWords(() => kickoff.call(this));
        if (isPromiseLike(kickoffResult)) {
          throw new Error("AgentExecutor.invoke does not support async kickoff results; use ainvoke instead.");
        }
        const currentAnswer = this.state.current_answer;
        if (!(currentAnswer instanceof AgentFinish)) {
          throw new Error("AgentExecutor finished without reaching a final answer.");
        }
        const finalAnswer = this.applyHumanFeedback(currentAnswer);
        this.state.current_answer = finalAnswer;
        this.state.is_finished = true;
        this._save_to_memory(finalAnswer);
        return { output: finalAnswer.output };
      }
      const result = super.invoke(this.kickoffInput);
      const output = result instanceof AgentFinish ? result.output : result;
      const fallbackAnswer = result instanceof AgentFinish ? result : new AgentFinish({ thought: "", output, text: String(output) });
      const finalAnswer = this.applyHumanFeedback(fallbackAnswer);
      this.state.current_answer = finalAnswer;
      this.state.is_finished = true;
      this._save_to_memory(finalAnswer);
      return { output: finalAnswer.output };
    } catch (error) {
      handleUnknownError(PRINTER, error, Boolean(this.agent?.verbose));
      throw error;
    } finally {
      this.isExecuting = false;
    }
  }

  private async invokeFromInputsAsync(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (this.isExecuting) {
      throw new Error("Executor is already running. Cannot invoke the same executor instance concurrently.");
    }
    this.isExecuting = true;
    try {
      this.resetInvocationState(inputs);
      const kickoffAsync = (this as unknown as { kickoff_async?: () => Promise<unknown>; kickoffAsync?: () => Promise<unknown> }).kickoff_async
        ?? (this as unknown as { kickoffAsync?: () => Promise<unknown> }).kickoffAsync;
      if (typeof kickoffAsync === "function") {
        await this.withLlmStopWordsAsync(() => kickoffAsync.call(this));
        const currentAnswer = this.state.current_answer;
        if (!(currentAnswer instanceof AgentFinish)) {
          throw new Error("AgentExecutor finished without reaching a final answer.");
        }
        const finalAnswer = await this.applyHumanFeedbackAsync(currentAnswer);
        this.state.current_answer = finalAnswer;
        this.state.is_finished = true;
        this._save_to_memory(finalAnswer);
        return { output: finalAnswer.output };
      }
      const kickoff = (this as unknown as { kickoff?: () => unknown }).kickoff;
      if (typeof kickoff === "function") {
        await this.withLlmStopWordsAsync(() => Promise.resolve(kickoff.call(this)));
        const currentAnswer = this.state.current_answer;
        if (!(currentAnswer instanceof AgentFinish)) {
          throw new Error("AgentExecutor finished without reaching a final answer.");
        }
        const finalAnswer = await this.applyHumanFeedbackAsync(currentAnswer);
        this.state.current_answer = finalAnswer;
        this.state.is_finished = true;
        this._save_to_memory(finalAnswer);
        return { output: finalAnswer.output };
      }
      const result = super.invoke(this.kickoffInput);
      const output = result instanceof AgentFinish ? result.output : result;
      const fallbackAnswer = result instanceof AgentFinish ? result : new AgentFinish({ thought: "", output, text: String(output) });
      const finalAnswer = await this.applyHumanFeedbackAsync(fallbackAnswer);
      this.state.current_answer = finalAnswer;
      this.state.is_finished = true;
      this._save_to_memory(finalAnswer);
      return { output: finalAnswer.output };
    } catch (error) {
      handleUnknownError(PRINTER, error, Boolean(this.agent?.verbose));
      throw error;
    } finally {
      this.isExecuting = false;
    }
  }

  private resetInvocationState(inputs: Record<string, unknown>): void {
    this.finalizeCalled = false;
    this.state.messages = [];
    this.messages = this.state.messages;
    this.state.iterations = 0;
    this.state.current_answer = null;
    this.state.is_finished = false;
    this.state.ask_for_human_input = Boolean(inputs.ask_for_human_input);
    this.state.pending_tool_calls = [];
    this.state.plan = null;
    this.state.plan_ready = false;
    this.state.todos = new TodoList();
    this.state.replan_count = 0;
    this.state.last_replan_reason = null;
    this.state.observations = {};
    this.state.execution_log = [];
    this.kickoffInput = stringifyInput(inputs.input);
    if (this.prompt && "system" in this.prompt) {
      this.state.messages.push(formatMessageForLLM(formatExecutorPrompt(this.prompt.system, inputs), "system"));
      this.state.messages.push(formatMessageForLLM(formatExecutorPrompt(this.prompt.user ?? "", inputs), "user"));
    } else if (this.prompt) {
      this.state.messages.push(formatMessageForLLM(formatExecutorPrompt(this.prompt.prompt ?? "", inputs), "user"));
    } else if (this.kickoffInput) {
      this.state.messages.push({ role: "user", content: this.kickoffInput });
    }
    this.injectFilesFromInputs(inputs);
  }

  private injectFilesFromInputs(inputs: Record<string, unknown>): void {
    const files = inputs.files;
    if (!files) {
      return;
    }
    for (let index = this.state.messages.length - 1; index >= 0; index -= 1) {
      const message = this.state.messages[index] as Record<string, unknown>;
      if (message.role === "user") {
        message.files = files;
        return;
      }
    }
  }

  private withLlmStopWords<T>(callback: () => T): T {
    if (!(this.llm instanceof BaseLLM)) {
      return callback();
    }
    const extraStops = _executor_stop_words(this);
    if (extraStops.length === 0 || extraStops.every((stop) => this.llm instanceof BaseLLM && this.llm.stop.includes(stop))) {
      return callback();
    }
    return callStopOverrideSync(this.llm, [...new Set([...this.llm.stop, ...extraStops])], callback);
  }

  private async withLlmStopWordsAsync<T>(callback: () => Promise<T>): Promise<T> {
    return await this.withLlmStopWords(callback);
  }

  private isPlanningEnabled(): boolean {
    const agentRecord = this.agent && typeof this.agent === "object"
      ? this.agent as unknown as Record<string, unknown>
      : {};
    return Boolean(agentRecord.planningEnabled ?? agentRecord.planning_enabled);
  }

  private applyHumanFeedback(answer: AgentFinish): AgentFinish {
    if (!this.state.ask_for_human_input) {
      return answer;
    }
    const handler = (this as unknown as { _handle_human_feedback?: (answer: AgentFinish) => AgentFinish })._handle_human_feedback;
    return typeof handler === "function" ? handler.call(this, answer) : answer;
  }

  _append_message_to_state(text: string, role: "user" | "assistant" | "system" = "assistant"): void {
    this.state.messages.push(formatMessageForLLM(text, role));
  }

  _is_training_mode(): boolean {
    const crew = this.crew as { _train?: unknown } | null;
    return Boolean(crew?._train);
  }

  _handle_crew_training_output(result: unknown, humanFeedback: string | null = null): void {
    const crew = this.crew as { trainingOutputs?: unknown[]; training_outputs?: unknown[] } | null;
    const outputs = crew?.trainingOutputs ?? crew?.training_outputs;
    if (Array.isArray(outputs)) {
      outputs.push({ result: result instanceof AgentFinish ? result.output : result, human_feedback: humanFeedback });
    }
  }

  _show_start_logs(): void {
    if (!this.agent) {
      throw new Error("Agent cannot be None");
    }
    if (!this.task) {
      return;
    }
    let taskDescription: string | null = null;
    if (typeof this.task === "object" && "description" in this.task) {
      const description = (this.task as { description?: unknown }).description;
      taskDescription = typeof description === "string" ? description : "";
    }
    crewaiEventBus.emit(this.agent, new AgentLogsStartedEvent({
      agent_role: this.agent.role,
      task_description: taskDescription,
      verbose: Boolean(this.agent.verbose || this.crew?.verbose),
    }));
  }

  _show_logs(formattedAnswer: AgentAction | AgentFinish): void {
    if (!this.agent) {
      return;
    }
    crewaiEventBus.emit(this.agent, new AgentLogsExecutionEvent({
      agent_role: this.agent.role,
      formatted_answer: formattedAnswer,
      verbose: Boolean(this.agent.verbose || this.crew?.verbose),
    }));
  }

  private invokeStepCallback(answer: AgentAction | AgentFinish): void {
    const callback = (this.stepCallback ?? this.step_callback ?? this.agent?.stepCallback ?? this.agent?.step_callback ?? null) as ((value: AgentAction | AgentFinish) => unknown) | null;
    const result = callback?.(answer);
    if (isPromiseLike(result)) {
      void result;
    }
  }

  private injectTodoContext(todo: TodoItem): void {
    this.state.messages.push({
      role: "user",
      content: this.buildTodoPrompt(todo, false),
    });
  }

  private buildTodoPrompt(todo: TodoItem, includeDependencies = true): string {
    const total = this.state.todos.items.length;
    const parts = [`**Current Step ${String(todo.stepNumber)}/${String(total)}**`, `Task: ${todo.description}`];
    const toolToUse = todo.toolToUse ?? todo.tool_to_use;
    if (toolToUse) {
      parts.push(`Suggested tool: ${toolToUse}`);
    }
    if (includeDependencies && todo.dependsOn.length > 0) {
      const dependencyResults = todo.dependsOn
        .map((stepNumber) => {
          const dependency = this.state.todos.getByStepNumber(stepNumber);
          return dependency?.result ? `Step ${String(stepNumber)} result: ${dependency.result}` : null;
        })
        .filter((line): line is string => line !== null);
      if (dependencyResults.length > 0) {
        parts.push("\nContext from previous steps:", ...dependencyResults);
      }
    }
    parts.push("\nComplete this step. Once done, provide your result.");
    return parts.join("\n");
  }

  private async applyHumanFeedbackAsync(answer: AgentFinish): Promise<AgentFinish> {
    if (!this.state.ask_for_human_input) {
      return answer;
    }
    const asyncHandler = (this as unknown as { _ahandle_human_feedback?: (answer: AgentFinish) => Promise<AgentFinish> })._ahandle_human_feedback;
    if (typeof asyncHandler === "function") {
      return await asyncHandler.call(this, answer);
    }
    return this.applyHumanFeedback(answer);
  }

  private hasOriginalTools(): boolean {
    return this.originalTools.length > 0 || this.original_tools.length > 0;
  }

  private activeResponseModel(): unknown {
    return this.responseModel ?? this.response_model ?? null;
  }

  private openAiToolsForNativeCall(): unknown {
    const record = this as unknown as { _openai_tools?: unknown; openAiTools?: unknown; openai_tools?: unknown };
    return record._openai_tools ?? record.openAiTools ?? record.openai_tools ?? [];
  }

  private callExecutorLlm(options: Record<string, unknown>): unknown {
    const llm = this.llm;
    if (typeof llm === "function") {
      const result = (llm as (messages: readonly LLMMessage[], options?: Record<string, unknown>) => unknown)(
        this.state.messages,
        options,
      );
      if (isPromiseLike(result)) {
        throw new Error("AgentExecutor synchronous LLM call returned a Promise.");
      }
      return result;
    }
    const call = llm && typeof llm === "object"
      ? (llm as { call?: (messages: readonly LLMMessage[], options?: Record<string, unknown>) => unknown }).call
      : null;
    if (typeof call !== "function") {
      return this.state.messages.at(-1)?.content ?? "";
    }
    const result = call.call(llm, this.state.messages, options);
    if (isPromiseLike(result)) {
      throw new Error("AgentExecutor synchronous LLM call returned a Promise.");
    }
    return result;
  }

  _getReasoningEffort(): "low" | "medium" | "high" {
    return this.reasoningEffort();
  }

  _get_reasoning_effort(): ReturnType<AgentExecutor["_getReasoningEffort"]> {
    return this._getReasoningEffort();
  }

  _shouldObserveSteps(): boolean {
    const config = this.planningConfigRecord();
    if (config && (config.observeSteps !== undefined || config.observe_steps !== undefined)) {
      const value = config.observeSteps ?? config.observe_steps;
      if (value !== null) {
        return Boolean(value);
      }
    }
    return this._getReasoningEffort() !== "low";
  }

  _should_observe_steps(): boolean {
    return this._shouldObserveSteps();
  }

  private planningConfigRecord(): Record<string, unknown> | null {
    const agentRecord = this.agent && typeof this.agent === "object"
      ? this.agent as unknown as Record<string, unknown>
      : null;
    return asPlannerRecord(agentRecord?.planningConfig ?? agentRecord?.planning_config);
  }

  _stepSuccessFromLog(stepNumber: number): boolean | null {
    for (const entry of [...this.state.execution_log].reverse()) {
      if (entry.type !== "step_execution" || entry.step_number !== stepNumber) {
        continue;
      }
      return entry.success === undefined ? null : Boolean(entry.success);
    }
    return null;
  }

  _step_success_from_log(step_number: number): boolean | null {
    return this._stepSuccessFromLog(step_number);
  }

  _ensurePlannerObserver(): PlannerObserver {
    this.plannerObserver ??= new PlannerObserver(this.agent, this.task, this.kickoffInput);
    return this.plannerObserver;
  }

  _ensure_planner_observer(): PlannerObserver {
    return this._ensurePlannerObserver();
  }

  _observeCompletedStep(options: {
    completedStep?: TodoItem;
    completed_step?: TodoItem;
    result?: unknown;
    allCompleted?: readonly TodoItem[];
    all_completed?: readonly TodoItem[];
    remainingTodos?: readonly TodoItem[];
    remaining_todos?: readonly TodoItem[];
    stepSuccess?: boolean | null;
    step_success?: boolean | null;
  }): StepObservation {
    const completedStep = options.completedStep ?? options.completed_step;
    if (!completedStep) {
      return new StepObservation({ step_completed_successfully: true, remaining_plan_still_valid: true });
    }
    const result = stringifyStepResult(options.result ?? completedStep.result ?? "");
    const allCompleted = options.allCompleted ?? options.all_completed ?? [];
    const remainingTodos = options.remainingTodos ?? options.remaining_todos ?? [];
    if (this._shouldObserveSteps()) {
      return this._ensurePlannerObserver().observe({
        completedStep,
        result,
        allCompleted,
        remainingTodos,
      });
    }
    const stepSuccess = options.stepSuccess ?? options.step_success ?? this._stepSuccessFromLog(completedStep.stepNumber) ?? true;
    return PlannerObserver.heuristicObservation({ stepSuccess, result });
  }

  _observe_completed_step(options: Parameters<AgentExecutor["_observeCompletedStep"]>[0]): StepObservation {
    return this._observeCompletedStep(options);
  }

  _ensureStepExecutor(): StepExecutor {
    this.stepExecutor ??= new StepExecutor({
      agent: this.agent,
      tools: this.tools,
      availableFunctions: this.availableNativeFunctions(),
    });
    return this.stepExecutor;
  }

  _ensure_step_executor(): StepExecutor {
    return this._ensureStepExecutor();
  }

  _buildContextForTodo(todo: TodoItem): StepExecutionContext {
    const dependencyResults: Record<number, string> = {};
    for (const stepNumber of todo.dependsOn) {
      const dependency = this.state.todos.getByStepNumber(stepNumber);
      if (dependency?.result) {
        dependencyResults[stepNumber] = dependency.result;
      }
    }
    const taskRecord = this.task && typeof this.task === "object" ? this.task as Record<string, unknown> : null;
    return new StepExecutionContext({
      taskDescription: typeof taskRecord?.description === "string" ? taskRecord.description : this.kickoffInput,
      taskGoal: typeof taskRecord?.expectedOutput === "string"
        ? taskRecord.expectedOutput
        : typeof taskRecord?.expected_output === "string" ? taskRecord.expected_output : "Complete the task successfully",
      dependencyResults,
    });
  }

  _build_context_for_todo(todo: TodoItem): StepExecutionContext {
    return this._buildContextForTodo(todo);
  }

  private async _executePlanningTodo(todo: TodoItem): Promise<StepResult> {
    const executor = this._ensureStepExecutor();
    const context = this._buildContextForTodo(todo);
    return await executor.execute(todo, context, this.getMaxStepIterations(), this.getStepTimeout());
  }

  private routeFinishWithTodos<T extends string>(defaultRoute: T): T | "todo_satisfied" {
    return this.state.todos.currentTodo ? "todo_satisfied" : defaultRoute;
  }

  private finishCurrentObservedTodo(): "continue_plan" | "replan_now" {
    const current = this.state.todos.currentTodo;
    if (!current) {
      return "continue_plan";
    }
    const observation = this.state.observations[current.stepNumber];
    if (observation?.stepCompletedSuccessfully === false) {
      this.state.todos.markFailed(current.stepNumber, current.result);
      if (observation.needsFullReplan) {
        this.state.last_replan_reason = observation.replanReason ?? "Step did not complete successfully";
        return "replan_now";
      }
      return "continue_plan";
    }
    this.state.todos.markCompleted(current.stepNumber, current.result);
    return "continue_plan";
  }

  private shouldReplan(): readonly [boolean, string] {
    if (this.state.replan_count >= this.getMaxReplans()) {
      return [false, "Max replan attempts reached"];
    }

    const failedTodos = this.state.todos.getFailedTodos();
    if (failedTodos.length >= 2) {
      return [true, `Multiple todos failed (${String(failedTodos.length)} failures)`];
    }

    const errorTodos = this.state.todos.items.filter((todo) => todo.result?.startsWith("Error:"));
    if (errorTodos.length >= 2) {
      return [true, `Multiple todos encountered errors (${String(errorTodos.length)} errors)`];
    }

    const lastMessage = this.state.messages.at(-1);
    const content = typeof lastMessage?.content === "string" ? lastMessage.content.toLowerCase() : "";
    const replanIndicators = [
      "need to reconsider",
      "approach isn't working",
      "try a different approach",
      "replan",
      "revise the plan",
      "plan needs adjustment",
    ];
    const indicator = replanIndicators.find((candidate) => content.includes(candidate));
    if (indicator) {
      return [true, `Agent indicated replanning needed: '${indicator}'`];
    }

    return [false, ""];
  }

  private getMaxReplans(): number {
    const agentRecord = this.agent && typeof this.agent === "object" ? this.agent as unknown as Record<string, unknown> : {};
    const config = (agentRecord.planningConfig ?? agentRecord.planning_config) as Record<string, unknown> | null | undefined;
    const value = config && typeof config === "object"
      ? config.maxReplans ?? config.max_replans
      : null;
    return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 3;
  }

  private getMaxStepIterations(): number {
    const config = this.planningConfigRecord();
    const value = config?.maxStepIterations ?? config?.max_step_iterations;
    return typeof value === "number" && Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : 15;
  }

  private getStepTimeout(): number | null {
    const config = this.planningConfigRecord();
    const value = config?.stepTimeout ?? config?.step_timeout;
    return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : null;
  }

  private executeNativeToolCall(name: string, args: Record<string, unknown>): unknown {
    const tool = this.nativeToolByName(name);
    const maxUsageLimit = this.nativeToolMaxUsageLimit(tool);
    if (maxUsageLimit !== null) {
      return `Tool '${sanitizeToolName(name)}' has reached its usage limit of ${String(maxUsageLimit)} times and cannot be used anymore.`;
    }
    const availableFunctions = this.availableNativeFunctions();
    const fn = availableFunctions[name] ?? availableFunctions[sanitizeToolName(name)];
    if (typeof fn === "function") {
      const result = fn(args);
      if (isPromiseLike(result)) {
        throw new Error(`Native tool '${name}' returned a Promise in synchronous execution.`);
      }
      return result;
    }
    if (tool) {
      const result = tool.run(args);
      if (isPromiseLike(result)) {
        throw new Error(`Native tool '${name}' returned a Promise in synchronous execution.`);
      }
      return result;
    }
    return "Tool not found";
  }

  private availableNativeFunctions(): Record<string, (input?: unknown) => unknown> {
    const record = this as unknown as {
      _available_functions?: Record<string, (input?: unknown) => unknown>;
      availableFunctions?: Record<string, (input?: unknown) => unknown>;
      available_functions?: Record<string, (input?: unknown) => unknown>;
    };
    return record._available_functions ?? record.availableFunctions ?? record.available_functions ?? {};
  }

  private nativeToolByName(name: string): Tool | null {
    const record = this as unknown as { originalTools?: readonly Tool[]; original_tools?: readonly Tool[] };
    const candidates = [...(record.originalTools ?? record.original_tools ?? []), ...this.tools];
    const sanitized = sanitizeToolName(name);
    return candidates.find((tool) => sanitizeToolName(tool.name) === sanitized) ?? null;
  }

  private nativeToolMaxUsageLimit(tool: Tool | null): number | null {
    if (!tool) {
      return null;
    }
    const record = tool as Tool & {
      maxUsageCount?: unknown;
      max_usage_count?: unknown;
      currentUsageCount?: unknown;
      current_usage_count?: unknown;
      hasReachedMaxUsageCount?: () => boolean;
      has_reached_max_usage_count?: () => boolean;
    };
    const maxUsageCount = record.maxUsageCount ?? record.max_usage_count;
    const currentUsageCount = record.currentUsageCount ?? record.current_usage_count;
    const hasReached = typeof record.hasReachedMaxUsageCount === "function"
      ? record.hasReachedMaxUsageCount.call(tool)
      : typeof record.has_reached_max_usage_count === "function"
        ? record.has_reached_max_usage_count.call(tool)
        : typeof maxUsageCount === "number" && typeof currentUsageCount === "number" && currentUsageCount >= maxUsageCount;
    return hasReached && typeof maxUsageCount === "number" ? maxUsageCount : null;
  }

  private nativeToolResultAsAnswer(name: string): boolean {
    const tool = this.nativeToolByName(name);
    if (!tool) {
      return false;
    }
    const record = tool as Tool & { result_as_answer?: unknown };
    return Boolean(tool.resultAsAnswer || record.result_as_answer);
  }

  private incrementTaskToolErrors(): void {
    if (!this.task || typeof this.task !== "object") {
      return;
    }
    const taskRecord = this.task as {
      incrementToolsErrors?: () => unknown;
      increment_tools_errors?: () => unknown;
    };
    const increment = taskRecord.incrementToolsErrors ?? taskRecord.increment_tools_errors;
    if (typeof increment === "function") {
      increment.call(this.task);
    }
  }

  private triggerReplan(reason: string): void {
    this.state.last_replan_reason = reason;
    const completedTodos = this.state.todos.getCompletedTodos();
    const taskRecord = this.task && typeof this.task === "object"
      ? this.task as Record<string, unknown>
      : null;
    const stepDescription = typeof taskRecord?.description === "string"
      ? taskRecord.description
      : this.kickoffInput;
    crewaiEventBus.emit(this.agent ?? this, new PlanReplanTriggeredEvent({
      agent_role: this.agent?.role ?? "",
      step_number: 0,
      step_description: stepDescription,
      replan_reason: reason,
      replan_count: this.state.replan_count,
      completed_steps_preserved: completedTodos.length,
      from_task: this.task,
      from_agent: this.agent,
    }));
    if (!this.agent) {
      return;
    }
    const previousContext = this.buildReplanContext();
    const enhancedDescription = this.enhanceTaskForReplan(previousContext);
    try {
      const originalDescription = taskRecord && typeof taskRecord.description === "string"
        ? taskRecord.description
        : null;
      let output: unknown;
      if (taskRecord) {
        taskRecord.description = enhancedDescription;
        try {
          output = new AgentReasoning({ agent: this.agent, task: taskRecord }).handle_agent_reasoning();
        } finally {
          if (originalDescription !== null) {
            taskRecord.description = originalDescription;
          }
        }
      } else {
        output = new AgentReasoning({
          agent: this.agent,
          description: enhancedDescription || this.kickoffInput || "Complete the requested task",
          expected_output: "Complete the task successfully",
        }).handle_agent_reasoning();
      }
      if (isPromiseLike(output)) {
        throw new Error("Async replanning is not supported in the synchronous AgentExecutor route.");
      }
      this.applyReplanOutput(output);
    } catch (error) {
      this.state.last_replan_reason = `Replan failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private buildReplanContext(): string {
    const contextParts: string[] = [];
    const completed = this.state.todos.items.filter((todo) => todo.status === TodoStatus.COMPLETED);
    if (completed.length > 0) {
      contextParts.push("Successfully completed steps:");
      for (const todo of completed) {
        contextParts.push(`  - Step ${String(todo.stepNumber)}: ${todo.description}`);
        if (todo.result) {
          contextParts.push(`    Result: ${todo.result}`);
        }
      }
    }
    const failed = this.state.todos.items.filter((todo) => todo.status === TodoStatus.FAILED || todo.result?.startsWith("Error:"));
    if (failed.length > 0) {
      contextParts.push("\nFailed or errored steps:");
      for (const todo of failed) {
        contextParts.push(`  - Step ${String(todo.stepNumber)}: ${todo.description}`);
        if (todo.result) {
          contextParts.push(`    Error: ${todo.result}`);
        }
      }
    }
    if (this.state.replan_count > 0) {
      contextParts.push(`\nThis is replan attempt ${String(this.state.replan_count)}.`);
      if (this.state.last_replan_reason) {
        contextParts.push(`Previous replan reason: ${this.state.last_replan_reason}`);
      }
    }
    return contextParts.join("\n");
  }

  private enhanceTaskForReplan(previousContext: string): string {
    const taskRecord = this.task && typeof this.task === "object"
      ? this.task as Record<string, unknown>
      : null;
    const original = typeof taskRecord?.description === "string"
      ? taskRecord.description
      : this.kickoffInput;
    const enhancement = previousContext
      ? `\n\nPrevious execution context for replanning:\n${previousContext}\n\nCreate a revised plan that preserves successful work and addresses the failures above.`
      : "";
    return `${original}${enhancement}`;
  }

  private applyReplanOutput(output: unknown): void {
    const record = output && typeof output === "object" ? output as Record<string, unknown> : {};
    const planRecord = record.plan && typeof record.plan === "object" ? record.plan as Record<string, unknown> : null;
    if (!planRecord) {
      return;
    }
    const plan = typeof planRecord.plan === "string" ? planRecord.plan : null;
    const ready = Boolean(planRecord.ready);
    const rawSteps = Array.isArray(planRecord.steps) ? planRecord.steps : [];
    this.state.plan = plan;
    this.state.plan_ready = ready;
    if (!ready || rawSteps.length === 0) {
      return;
    }
    const newTodos = rawSteps.map((step) => {
      const stepRecord = step && typeof step === "object" ? step as Record<string, unknown> : {};
      return new TodoItem({
        stepNumber: typeof stepRecord.stepNumber === "number" ? stepRecord.stepNumber : typeof stepRecord.step_number === "number" ? stepRecord.step_number : 0,
        description: typeof stepRecord.description === "string" ? stepRecord.description : "",
        toolToUse: typeof stepRecord.toolToUse === "string" ? stepRecord.toolToUse : typeof stepRecord.tool_to_use === "string" ? stepRecord.tool_to_use : null,
        dependsOn: Array.isArray(stepRecord.dependsOn) ? stepRecord.dependsOn as number[] : Array.isArray(stepRecord.depends_on) ? stepRecord.depends_on as number[] : [],
        status: TodoStatus.PENDING,
      });
    });
    this.state.todos.replacePendingTodos(newTodos);
  }

  private reasoningEffort(): "low" | "medium" | "high" {
    const agentRecord = this.agent && typeof this.agent === "object"
      ? this.agent as unknown as Record<string, unknown>
      : {};
    const config = agentRecord.planningConfig ?? agentRecord.planning_config;
    if (config && typeof config === "object") {
      const configRecord = config as Record<string, unknown>;
      const effort = configRecord.reasoningEffort ?? configRecord.reasoning_effort;
      if (effort === "low" || effort === "medium" || effort === "high") {
        return effort;
      }
    }
    return "medium";
  }
}

export class CrewAgentExecutorFlow extends AgentExecutor {}

export class CrewAgentExecutor extends BaseAgentExecutor {
  readonly llm: unknown;
  readonly prompt: Record<string, string> | null;
  readonly originalTools: readonly Tool[];
  readonly original_tools: readonly Tool[];
  readonly toolsNames: string;
  readonly tools_names: string;
  readonly toolsDescription: string;
  readonly tools_description: string;
  readonly stop: readonly string[];
  askForHumanInput = false;
  ask_for_human_input = false;

  constructor(options: BaseAgentExecutorOptions = {}) {
    super(options);
    this.llm = options.llm ?? this.agent?.llm ?? null;
    this.prompt = options.prompt ?? null;
    this.originalTools = options.originalTools ?? options.original_tools ?? this.tools;
    this.original_tools = this.originalTools;
    this.toolsNames = options.toolsNames ?? options.tools_names ?? this.tools.map((tool) => sanitizeToolName(tool.name)).join(", ");
    this.tools_names = this.toolsNames;
    this.toolsDescription = options.toolsDescription ?? options.tools_description ?? this.tools.map((tool) => tool.description ?? "").join("\n");
    this.tools_description = this.toolsDescription;
    this.stop = options.stop ?? options.stop_words ?? [];
    Object.defineProperties(this, {
      executorType: { value: "crew", enumerable: true },
      executor_type: { value: "crew", enumerable: true },
    });
  }

  get use_stop_words(): boolean {
    const llm = this.llm;
    if (!llm || typeof llm !== "object") {
      return false;
    }
    const record = llm as { supportsStopWords?: unknown; supports_stop_words?: unknown };
    const supports = record.supportsStopWords ?? record.supports_stop_words;
    return typeof supports === "function" ? Boolean((supports as () => unknown).call(llm)) : false;
  }

  invoke(input: string | readonly LLMMessage[] | Record<string, unknown> = ""): MaybePromise<unknown> {
    if (typeof input === "object" && !Array.isArray(input) && "input" in input) {
      const resumingRecord = this as unknown as { _resuming?: boolean };
      const resuming = Boolean(resumingRecord._resuming);
      try {
        if (!resuming) {
          this.messages = [];
          this.iterations = 0;
        }
        this._setup_messages(input);
        this._inject_multimodal_files(input);
        const result = this._invoke_loop();
        if (isPromiseLike<AgentFinish>(result)) {
          throw new Error("CrewAgentExecutor.invoke received an async loop result; use ainvoke instead.");
        }
        return { output: result.output };
      } finally {
        if (resuming) {
          resumingRecord._resuming = false;
        }
      }
    }
    if (this.agent && typeof input === "string") {
      return this.agent.kickoff(input, { task: this.task } satisfies AgentExecutionOptions);
    }
    return super.invoke(input as string | readonly LLMMessage[]);
  }

  async ainvoke(input: string | readonly LLMMessage[] | Record<string, unknown> = ""): Promise<unknown> {
    if (typeof input === "object" && !Array.isArray(input) && "input" in input) {
      const resumingRecord = this as unknown as { _resuming?: boolean };
      const resuming = Boolean(resumingRecord._resuming);
      try {
        if (!resuming) {
          this.messages = [];
          this.iterations = 0;
        }
        this._setup_messages(input);
        await this._ainject_multimodal_files(input);
        const result = await this._ainvoke_loop();
        return { output: result.output };
      } finally {
        if (resuming) {
          resumingRecord._resuming = false;
        }
      }
    }
    return await Promise.resolve(this.invoke(input as string | readonly LLMMessage[]));
  }

  _setup_messages(inputs: Record<string, unknown>): void {
    const provider = get_provider();
    const setupMessages = provider.setupMessages ?? provider.setup_messages;
    if (typeof setupMessages === "function" && setupMessages.call(provider, this)) {
      return;
    }

    if (this.prompt && "system" in this.prompt) {
      this.messages.push(formatMessageForLLM(this._format_prompt(this.prompt.system, inputs), "system"));
      this.messages.push(formatMessageForLLM(this._format_prompt(this.prompt.user ?? "", inputs), "user"));
    } else if (this.prompt) {
      this.messages.push(formatMessageForLLM(this._format_prompt(this.prompt.prompt ?? "", inputs), "user"));
    }

    const postSetupMessages = provider.postSetupMessages ?? provider.post_setup_messages;
    if (typeof postSetupMessages === "function") {
      postSetupMessages.call(provider, this);
    }
  }

  static _format_prompt(prompt: string, inputs: Record<string, unknown>): string {
    return prompt
      .replaceAll("{input}", stringifyCrewExecutorValue(inputs.input))
      .replaceAll("{tool_names}", stringifyCrewExecutorValue(inputs.tool_names ?? inputs.tools_names ?? inputs.toolNames ?? ""))
      .replaceAll("{tools}", stringifyCrewExecutorValue(inputs.tools ?? ""));
  }

  _format_prompt(prompt: string, inputs: Record<string, unknown>): string {
    return CrewAgentExecutor._format_prompt(prompt, inputs);
  }

  _invoke_loop(): MaybePromise<AgentFinish> {
    const llm = this.llm as { supportsFunctionCalling?: unknown; supports_function_calling?: unknown } | null;
    const supportsFunctionCalling = llm?.supportsFunctionCalling ?? llm?.supports_function_calling;
    const useNativeTools = typeof supportsFunctionCalling === "function"
      && Boolean((supportsFunctionCalling as () => unknown).call(this.llm))
      && this.originalTools.length > 0;
    return useNativeTools ? this._invoke_loop_native_tools() : this._invoke_loop_react();
  }

  async _ainvoke_loop(): Promise<AgentFinish> {
    const result = await this._invoke_loop();
    return result;
  }

  _invoke_loop_react(): AgentFinish {
    const content = this.messages.at(-1)?.content;
    return new AgentFinish({
      thought: "",
      output: typeof content === "string" ? content : stringifyCrewExecutorValue(content),
      text: typeof content === "string" ? content : stringifyCrewExecutorValue(content),
    });
  }

  async _ainvoke_loop_react(): Promise<AgentFinish> {
    await Promise.resolve();
    return this._invoke_loop_react();
  }

  async _invoke_loop_native_tools(): Promise<AgentFinish> {
    const pendingToolCalls = this.messages
      .flatMap((message) => {
        const record = message as unknown as { tool_calls?: readonly unknown[] };
        return record.tool_calls ?? [];
      });
    if (pendingToolCalls.length > 0) {
      const functions = Object.fromEntries(this.tools.map((tool) => [
        sanitizeToolName(tool.name),
        (input?: unknown) => tool.run(input as Record<string, unknown>),
      ]));
      const finish = await this._handle_native_tool_calls(pendingToolCalls, functions);
      if (finish) {
        return finish;
      }
    }
    return this._invoke_loop_react();
  }

  async _ainvoke_loop_native_tools(): Promise<AgentFinish> {
    return await this._invoke_loop_native_tools();
  }

  _invoke_loop_native_no_tools(): AgentFinish {
    return this._invoke_loop_react();
  }

  async _ainvoke_loop_native_no_tools(): Promise<AgentFinish> {
    await Promise.resolve();
    return this._invoke_loop_native_no_tools();
  }

  _is_tool_call_list(response: readonly unknown[]): boolean {
    return isToolCallList(response);
  }

  _handle_human_feedback(formattedAnswer: AgentFinish): AgentFinish {
    const result = (get_provider().handleFeedback ?? get_provider().handle_feedback)?.call(get_provider(), formattedAnswer, this) ?? formattedAnswer;
    return result instanceof AgentFinish ? result : formattedAnswer;
  }

  async _ahandle_human_feedback(formattedAnswer: AgentFinish): Promise<AgentFinish> {
    const provider = get_provider();
    const handler = provider.handleFeedbackAsync ?? provider.handle_feedback_async;
    if (!handler) {
      return formattedAnswer;
    }
    const result = await handler.call(provider, formattedAnswer, this);
    return result instanceof AgentFinish ? result : formattedAnswer;
  }

  _is_training_mode(): boolean {
    const crew = this.crew as { _train?: unknown } | null;
    return Boolean(crew?._train);
  }

  _format_feedback_message(feedback: string): LLMMessage {
    return formatMessageForLLM(I18N_DEFAULT.slice("feedback_instructions").replace("{feedback}", feedback), "user");
  }

  _inject_multimodal_files(inputs: { files?: Record<string, unknown> } | null = null): void {
    const files = { ...(inputs?.files ?? {}) };
    if (Object.keys(files).length === 0) {
      return;
    }
    for (let index = this.messages.length - 1; index >= 0; index -= 1) {
      const message = this.messages[index] as unknown as { role?: string; files?: Record<string, unknown> };
      if (message.role === "user") {
        message.files = files;
        return;
      }
    }
  }

  async _ainject_multimodal_files(inputs: { files?: Record<string, unknown> } | null = null): Promise<void> {
    await Promise.resolve();
    this._inject_multimodal_files(inputs);
  }

  _parse_native_tool_call(toolCall: unknown): [string, string, string | Record<string, unknown>] | null {
    const info = extractToolCallInfo(toolCall);
    if (!info) {
      return null;
    }
    return [
      info.id ?? `call_${String(Math.abs(JSON.stringify(toolCall).length))}`,
      sanitizeToolName(info.toolName),
      info.arguments ?? {},
    ];
  }

  _append_assistant_tool_calls_message(parsedCalls: readonly [string, string, string | Record<string, unknown>][]): void {
    this.messages.push({
      role: "assistant",
      content: null,
      tool_calls: parsedCalls.map(([callId, funcName, funcArgs]) => ({
        id: callId,
        type: "function",
        function: {
          name: funcName,
          arguments: typeof funcArgs === "string" ? funcArgs : JSON.stringify(funcArgs),
        },
      })),
    } as unknown as LLMMessage);
  }

  async _handle_native_tool_calls(
    toolCalls: readonly unknown[],
    availableFunctions: Record<string, (input?: unknown) => MaybePromise<unknown>>,
  ): Promise<AgentFinish | null> {
    const parsed = toolCalls
      .map((toolCall) => this._parse_native_tool_call(toolCall))
      .filter((item): item is [string, string, string | Record<string, unknown>] => item !== null);
    if (parsed.length === 0) {
      return null;
    }
    this._append_assistant_tool_calls_message(parsed);
    if (this.shouldParallelizeNativeToolCalls(parsed)) {
      const results = await Promise.all(parsed.map(([callId, funcName, funcArgs]) =>
        executeSingleNativeToolCall(
          { id: callId, name: funcName, arguments: typeof funcArgs === "string" ? parseNativeCrewArgs(funcArgs) : funcArgs },
          availableFunctions,
          { originalTools: this.tools },
        )));
      for (let index = 0; index < parsed.length; index += 1) {
        const parsedCall = parsed[index];
        if (!parsedCall) {
          continue;
        }
        const callId: string = parsedCall[0];
        const funcName: string = parsedCall[1];
        const finish = this._append_tool_result_and_check_finality({
          callId,
          funcName,
          result: results[index]?.text,
        });
        if (finish) {
          return finish;
        }
      }
      this.messages.push({ role: "user", content: "Reflect on the tool results and continue." });
      return null;
    }
    for (const [callId, funcName, funcArgs] of parsed) {
      const result = await executeSingleNativeToolCall(
        { id: callId, name: funcName, arguments: typeof funcArgs === "string" ? parseNativeCrewArgs(funcArgs) : funcArgs },
        availableFunctions,
        { originalTools: this.tools },
      );
      const finish = this._append_tool_result_and_check_finality({
        callId,
        funcName,
        result: result.text,
      });
      if (finish) {
        return finish;
      }
    }
    this.messages.push({ role: "user", content: "Reflect on the tool results and continue." });
    return null;
  }

  private shouldParallelizeNativeToolCalls(parsedCalls: readonly [string, string, string | Record<string, unknown>][]): boolean {
    if (parsedCalls.length <= 1) {
      return false;
    }
    for (const [, funcName] of parsedCalls) {
      const originalTool = this.tools.find((tool) => sanitizeToolName(tool.name) === sanitizeToolName(funcName));
      if (!originalTool) {
        continue;
      }
      const record = originalTool as Tool & { result_as_answer?: unknown; maxUsageCount?: unknown; max_usage_count?: unknown };
      if (originalTool.resultAsAnswer || record.result_as_answer) {
        return false;
      }
      if (record.maxUsageCount !== null && record.maxUsageCount !== undefined) {
        return false;
      }
      if (record.max_usage_count !== null && record.max_usage_count !== undefined) {
        return false;
      }
    }
    return true;
  }

  _append_tool_result_and_check_finality(executionResult: {
    callId?: string | null;
    call_id?: string | null;
    funcName?: string | null;
    func_name?: string | null;
    result?: unknown;
  }): AgentFinish | null {
    const callId = executionResult.callId ?? executionResult.call_id ?? null;
    const funcName = executionResult.funcName ?? executionResult.func_name ?? "";
    const content = stringifyCrewExecutorValue(executionResult.result);
    this.messages.push({
      role: "tool",
      content,
      tool_call_id: callId ?? funcName,
    } as unknown as LLMMessage);
    const originalTool = this.tools.find((tool) => sanitizeToolName(tool.name) === sanitizeToolName(funcName));
    if (originalTool?.resultAsAnswer) {
      return new AgentFinish({ thought: "", output: content, text: content });
    }
    return null;
  }

  async _execute_single_native_tool_call(options: {
    callId?: string;
    call_id?: string;
    funcName?: string;
    func_name?: string;
    funcArgs?: string | Record<string, unknown>;
    func_args?: string | Record<string, unknown>;
    availableFunctions?: Record<string, (input?: unknown) => MaybePromise<unknown>>;
    available_functions?: Record<string, (input?: unknown) => MaybePromise<unknown>>;
    originalTool?: Tool | null;
    original_tool?: Tool | null;
    shouldExecute?: boolean;
    should_execute?: boolean;
  }): Promise<Record<string, unknown>> {
    const callId = options.callId ?? options.call_id ?? "call";
    const funcName = options.funcName ?? options.func_name ?? "";
    const funcArgs = options.funcArgs ?? options.func_args ?? {};
    const availableFunctions = options.availableFunctions ?? options.available_functions ?? {};
    const originalTool = options.originalTool ?? options.original_tool ?? this.tools.find((tool) => sanitizeToolName(tool.name) === sanitizeToolName(funcName)) ?? null;
    const shouldExecute = options.shouldExecute ?? options.should_execute ?? true;
    const args = typeof funcArgs === "string" ? parseNativeCrewArgs(funcArgs) : funcArgs;
    const hookTool = originalTool ?? {
      name: funcName,
      description: "",
      run: () => "Tool not found",
    };
    let result: unknown;
    try {
      await runBeforeToolCallHooks(new ToolCallHookContext({
        toolName: funcName,
        toolInput: args,
        tool: hookTool,
        agent: this.agent,
        task: this.task,
        crew: this.crew,
      }));
    } catch (error) {
      if (executorErrorMessage(error).includes("blocked by before_tool_call hook")) {
        result = `Tool execution blocked by hook. Tool: ${funcName}`;
      }
    }
    if (result === undefined && !shouldExecute) {
      result = `Tool '${funcName}' has reached its maximum usage limit and cannot be used anymore.`;
    }
    if (result === undefined) {
      const fn = availableFunctions[funcName] ?? availableFunctions[sanitizeToolName(funcName)];
      const rawResult = typeof fn === "function"
        ? await fn(args)
        : await originalTool?.run(args);
      result = stringifyCrewExecutorValue(rawResult ?? "Tool not found");
    }
    result = await runAfterToolCallHooks(new ToolCallHookContext({
      toolName: funcName,
      toolInput: args,
      tool: hookTool,
      agent: this.agent,
      task: this.task,
      crew: this.crew,
      toolResult: result,
    }));
    return {
      call_id: callId,
      func_name: funcName,
      result: stringifyCrewExecutorValue(result),
      from_cache: false,
      original_tool: originalTool,
    };
  }

  _invoke_step_callback(formattedAnswer: AgentAction | AgentFinish): void {
    const callback = (this.stepCallback ?? this.step_callback ?? this.agent?.stepCallback ?? this.agent?.step_callback ?? null) as ((value: AgentAction | AgentFinish) => unknown) | null;
    const result = callback?.(formattedAnswer);
    if (result && typeof result === "object" && "then" in result) {
      void result;
    }
  }

  async _ainvoke_step_callback(formattedAnswer: AgentAction | AgentFinish): Promise<void> {
    const callback = (this.stepCallback ?? this.step_callback ?? this.agent?.stepCallback ?? this.agent?.step_callback ?? null) as ((value: AgentAction | AgentFinish) => unknown) | null;
    const result = callback?.(formattedAnswer);
    if (result && typeof result === "object" && "then" in result) {
      await (result as PromiseLike<unknown>);
    }
  }

  _append_message(text: string, role: "user" | "assistant" | "system" = "assistant"): void {
    this.messages.push(formatMessageForLLM(text, role));
  }

  _append_message_to_state(text: string, role: "user" | "assistant" | "system" = "assistant"): void {
    this._append_message(text, role);
  }

  _handle_agent_action(formattedAnswer: AgentAction, toolResult: { result?: unknown; result_as_answer?: boolean; resultAsAnswer?: boolean }): AgentAction | AgentFinish {
    const result = stringifyCrewExecutorValue(toolResult.result);
    this.messages.push(formatMessageForLLM(result, "assistant"));
    if (toolResult.result_as_answer || toolResult.resultAsAnswer) {
      return new AgentFinish({ thought: "Tool result is the final answer", output: result, text: result });
    }
    return formattedAnswer;
  }

  _show_logs(_formattedAnswer: AgentAction | AgentFinish): void {
    void _formattedAnswer;
  }

  _handle_crew_training_output(result: unknown, humanFeedback: string | null = null): void {
    const crew = this.crew as { trainingOutputs?: unknown[]; training_outputs?: unknown[] } | null;
    const outputs = crew?.trainingOutputs ?? crew?.training_outputs;
    if (Array.isArray(outputs)) {
      outputs.push({ result: result instanceof AgentFinish ? result.output : result, human_feedback: humanFeedback });
    }
  }

  _show_start_logs(): void {
    this.messages.push({
      role: "system",
      content: `Agent ${this.agent?.role ?? "Agent"} started${this.task && typeof this.task === "object" && "description" in this.task ? `: ${String(this.task.description)}` : ""}`,
    });
  }
}

export type StepExecutorOptions = {
  agent?: Agent | null;
  tools?: readonly Tool[];
  availableFunctions?: Record<string, unknown>;
  available_functions?: Record<string, unknown>;
};

function parseNativeCrewArgs(value: string): Record<string, unknown> {
  if (!value.trim()) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : { input: value };
  } catch {
    return { input: value };
  }
}

function stringifyCrewExecutorValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
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

export class StepExecutor {
  readonly agent: Agent | null;
  readonly tools: readonly Tool[];
  readonly availableFunctions: Record<string, unknown>;
  readonly available_functions: Record<string, unknown>;

  constructor(options: StepExecutorOptions = {}) {
    this.agent = options.agent ?? null;
    this.tools = options.tools ?? this.agent?.tools ?? [];
    this.availableFunctions = options.availableFunctions ?? options.available_functions ?? {};
    this.available_functions = this.availableFunctions;
  }

  _parse_tool_args(toolInput: unknown): Record<string, unknown> {
    if (toolInput && typeof toolInput === "object" && !Array.isArray(toolInput)) {
      return toolInput as Record<string, unknown>;
    }
    if (typeof toolInput === "string") {
      const strippedInput = toolInput.trim();
      if (!strippedInput) {
        return {};
      }
      try {
        const parsed = JSON.parse(strippedInput) as unknown;
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? parsed as Record<string, unknown>
          : { input: parsed };
      } catch {
        return { input: strippedInput };
      }
    }
    return { input: String(toolInput) };
  }

  static _parse_vision_sentinel(raw: string): [string, string] | null {
    const prefix = "VISION_IMAGE:";
    if (!raw.startsWith(prefix)) {
      return null;
    }
    const rest = raw.slice(prefix.length);
    const separator = rest.indexOf(":");
    if (separator <= 0) {
      return null;
    }
    return [rest.slice(0, separator), rest.slice(separator + 1)];
  }

  static _build_observation_message(toolResult: string): LLMMessage {
    const parsed = StepExecutor._parse_vision_sentinel(toolResult);
    if (parsed) {
      const [mediaType, base64Data] = parsed;
      return {
        role: "user",
        content: [
          { type: "text", text: "Observation: Here is the image:" },
          { type: "image_url", image_url: { url: `data:${mediaType};base64,${base64Data}` } },
        ],
      } as unknown as LLMMessage;
    }
    return { role: "user", content: `Observation: ${toolResult}` };
  }

  _build_observation_message(toolResult: string): LLMMessage {
    return StepExecutor._build_observation_message(toolResult);
  }

  _validate_expected_tool_usage(todo: TodoItem, toolCallsMade: readonly string[]): void {
    const expectedTool = todo.toolToUse ?? todo.tool_to_use;
    if (!expectedTool) {
      return;
    }
    const expectedToolName = sanitizeToolName(expectedTool);
    const availableToolNames = new Set([
      ...this.tools.map((tool) => sanitizeToolName(tool.name)),
      ...Object.keys(this.availableFunctions).map((name) => sanitizeToolName(name)),
    ]);
    if (!availableToolNames.has(expectedToolName)) {
      return;
    }
    const calledToolNames = new Set(toolCallsMade.map((name) => sanitizeToolName(name)));
    if (!calledToolNames.has(expectedToolName)) {
      throw new Error(`Expected tool '${expectedToolName}' was not used during step execution`);
    }
  }

  _buildIsolatedMessages(todo: TodoItem, context: StepExecutionContext): LLMMessage[] {
    return [
      formatMessageForLLM(this._buildSystemPrompt(), "system"),
      formatMessageForLLM(this._buildUserPrompt(todo, context), "user"),
    ];
  }

  _build_isolated_messages(todo: TodoItem, context: StepExecutionContext): LLMMessage[] {
    return this._buildIsolatedMessages(todo, context);
  }

  _buildSystemPrompt(): string {
    const role = this.agent?.role ?? "Assistant";
    const goal = this.agent?.goal ?? "Complete tasks efficiently";
    const backstory = this.agent?.backstory ? `\nBackstory: ${this.agent.backstory}` : "";
    const toolNames = this.tools.map((tool) => sanitizeToolName(tool.name));
    const toolsSection = toolNames.length > 0
      ? `\nAvailable tools: ${toolNames.join(", ")}`
      : "";
    return [
      `You are an Executor focused on completing one plan step as ${role}.`,
      `Goal: ${goal}${backstory}`,
      "Return a final answer when the step is complete.",
      toolsSection,
    ].filter(Boolean).join("\n");
  }

  _build_system_prompt(): string {
    return this._buildSystemPrompt();
  }

  _buildUserPrompt(todo: TodoItem, context: StepExecutionContext): string {
    const parts: string[] = [];
    if (context.taskDescription) {
      parts.push(`Task context:\n${extractTaskSection(context.taskDescription)}`);
    }
    if (context.taskGoal) {
      parts.push(`Task goal:\n${context.taskGoal}`);
    }
    parts.push(`Step:\n${todo.description}`);
    const toolToUse = todo.toolToUse ?? todo.tool_to_use;
    if (toolToUse) {
      parts.push(`Suggested tool: ${toolToUse}`);
    }
    const dependencyEntries = Object.entries(context.dependencyResults)
      .sort(([left], [right]) => Number(left) - Number(right));
    if (dependencyEntries.length > 0) {
      parts.push([
        "Dependency results:",
        ...dependencyEntries.map(([stepNumber, result]) => `Step ${stepNumber}: ${result}`),
      ].join("\n"));
    }
    parts.push("Complete this step and provide the result.");
    return parts.join("\n\n");
  }

  _build_user_prompt(todo: TodoItem, context: StepExecutionContext): string {
    return this._buildUserPrompt(todo, context);
  }

  async _executeTextParsed(
    messages: LLMMessage[],
    toolCallsMade: string[],
    maxStepIterations = 15,
    stepTimeout: number | null = null,
    startTime: number | null = null,
  ): Promise<string> {
    let lastToolResult = "";
    for (let index = 0; index < maxStepIterations; index += 1) {
      if (stepTimeout !== null && startTime !== null && Date.now() - startTime >= stepTimeout * 1000) {
        return lastToolResult || `Step timed out after ${String(stepTimeout)}s`;
      }
      const answer = await this.callStepLlm(messages);
      if (!answer) {
        throw new Error("Empty response from LLM");
      }
      const answerText = stringifyStepResult(answer);
      let parsed: AgentAction | AgentFinish;
      try {
        parsed = parseAgentOutput(answerText);
      } catch {
        return answerText;
      }
      if (parsed instanceof AgentFinish) {
        return String(parsed.output);
      }
      toolCallsMade.push(parsed.tool);
      let toolResult: string;
      try {
        toolResult = await this._executeTextToolWithEvents(parsed);
      } catch (error) {
        toolResult = `Error executing tool: ${executorErrorMessage(error)}`;
      }
      lastToolResult = toolResult;
      messages.push({ role: "assistant", content: answerText });
      messages.push(this._buildObservationMessage(toolResult));
    }
    return lastToolResult;
  }

  async _execute_text_parsed(
    messages: LLMMessage[],
    toolCallsMade: string[],
    maxStepIterations = 15,
    stepTimeout: number | null = null,
    startTime: number | null = null,
  ): Promise<string> {
    return await this._executeTextParsed(messages, toolCallsMade, maxStepIterations, stepTimeout, startTime);
  }

  async _executeTextToolWithEvents(formatted: AgentAction): Promise<string> {
    const args = this._parse_tool_args(formatted.toolInput);
    const sanitized = sanitizeToolName(formatted.tool);
    const tool = this.tools.find((candidate) => sanitizeToolName(candidate.name) === sanitized);
    if (!tool) {
      const fn = this.availableFunctions[formatted.tool] ?? this.availableFunctions[sanitized];
      if (typeof fn !== "function") {
        throw new Error(`Tool '${formatted.tool}' is not available`);
      }
      const result = await (fn as (input: unknown) => MaybePromise<unknown>)(args);
      return stringifyStepResult(result);
    }
    const result = await tool.run(args);
    return stringifyStepResult(result);
  }

  async _execute_text_tool_with_events(formatted: AgentAction): Promise<string> {
    return await this._executeTextToolWithEvents(formatted);
  }

  async _executeNativeToolCalls(
    toolCalls: readonly unknown[],
    messages: LLMMessage[],
    toolCallsMade: string[],
  ): Promise<string> {
    const results: string[] = [];
    messages.push({ role: "assistant", content: "", tool_calls: toolCalls } as unknown as LLMMessage);
    for (const toolCall of toolCalls) {
      const { name, args, id } = normalizeNativeToolCall(toolCall);
      if (!name) {
        continue;
      }
      toolCallsMade.push(name);
      const fn = this.availableFunctions[name] ?? this.availableFunctions[sanitizeToolName(name)];
      let result: unknown;
      try {
        result = typeof fn === "function"
          ? await (fn as (input: unknown) => MaybePromise<unknown>)(args)
          : await this.runToolByName(name, args);
      } catch (error) {
        result = `Error executing tool: ${executorErrorMessage(error)}`;
      }
      const text = stringifyStepResult(result);
      results.push(text);
      messages.push({
        role: "tool",
        content: text,
        tool_call_id: id ?? name,
      } as unknown as LLMMessage);
      const originalTool = this.tools.find((tool) => sanitizeToolName(tool.name) === sanitizeToolName(name));
      if (originalTool?.resultAsAnswer) {
        return text;
      }
    }
    return results.join("\n");
  }

  async _execute_native_tool_calls(
    toolCalls: readonly unknown[],
    messages: LLMMessage[],
    toolCallsMade: string[],
  ): Promise<string> {
    return await this._executeNativeToolCalls(toolCalls, messages, toolCallsMade);
  }

  async _executeNative(
    messages: LLMMessage[],
    toolCallsMade: string[],
    maxStepIterations = 15,
    stepTimeout: number | null = null,
    startTime: number | null = null,
  ): Promise<string> {
    const accumulatedResults: string[] = [];
    for (let index = 0; index < maxStepIterations; index += 1) {
      if (stepTimeout !== null && startTime !== null && Date.now() - startTime >= stepTimeout * 1000) {
        return accumulatedResults.length > 0 ? accumulatedResults.join("\n\n") : `Step timed out after ${String(stepTimeout)}s`;
      }
      const answer = await this.callStepLlm(messages);
      if (!answer) {
        throw new Error("Empty response from LLM");
      }
      if (isToolCallList(answer)) {
        const result = await this._executeNativeToolCalls(answer, messages, toolCallsMade);
        accumulatedResults.push(result);
        continue;
      }
      return stringifyStepResult(answer);
    }
    return accumulatedResults.join("\n\n");
  }

  async _execute_native(
    messages: LLMMessage[],
    toolCallsMade: string[],
    maxStepIterations = 15,
    stepTimeout: number | null = null,
    startTime: number | null = null,
  ): Promise<string> {
    return await this._executeNative(messages, toolCallsMade, maxStepIterations, stepTimeout, startTime);
  }

  async executeStep(step: string, context: StepExecutionContext = new StepExecutionContext({})): Promise<StepResult> {
    const started = Date.now();
    try {
      const prompt = [
        context.taskDescription,
        context.taskGoal,
        step,
      ].filter(Boolean).join("\n");
      const result = this.agent ? await this.agent.kickoff(prompt) : step;
      return new StepResult({
        success: true,
        result: typeof result === "string" ? result : JSON.stringify(result),
        executionTime: Date.now() - started,
      });
    } catch (error) {
      return new StepResult({
        success: false,
        result: "",
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - started,
      });
    }
  }

  execute_step(step: string, context?: StepExecutionContext): Promise<StepResult> {
    return this.executeStep(step, context);
  }

  execute(
    todo: string | TodoItem,
    context: StepExecutionContext = new StepExecutionContext({}),
    maxStepIterations = 15,
    stepTimeout: number | null = null,
  ): Promise<StepResult> {
    if (typeof todo === "string") {
      return this.executeStep(todo, context);
    }
    return this.executeTodoItem(todo, context, maxStepIterations, stepTimeout);
  }

  private async executeTodoItem(
    todo: TodoItem,
    context: StepExecutionContext,
    maxStepIterations: number,
    stepTimeout: number | null,
  ): Promise<StepResult> {
    const started = Date.now();
    const toolCallsMade: string[] = [];
    try {
      const messages = this._buildIsolatedMessages(todo, context);
      const result = this.hasNativeStepTools()
        ? await this._executeNative(messages, toolCallsMade, maxStepIterations, stepTimeout, started)
        : await this._executeTextParsed(messages, toolCallsMade, maxStepIterations, stepTimeout, started);
      this._validate_expected_tool_usage(todo, toolCallsMade);
      return new StepResult({
        success: true,
        result,
        toolCallsMade,
        executionTime: Date.now() - started,
      });
    } catch (error) {
      return new StepResult({
        success: false,
        result: "",
        error: error instanceof Error ? error.message : String(error),
        toolCallsMade,
        executionTime: Date.now() - started,
      });
    }
  }

  private hasNativeStepTools(): boolean {
    return Object.keys(this.availableFunctions).length > 0
      || this.tools.some((tool) => Boolean(tool.resultAsAnswer));
  }

  private _buildObservationMessage(toolResult: string): LLMMessage {
    return StepExecutor._build_observation_message(toolResult);
  }

  private async callStepLlm(messages: readonly LLMMessage[]): Promise<LLMResponse> {
    if (!this.agent?.llm) {
      return stringifyStepResult(messages.at(-1)?.content ?? "");
    }
    if (typeof this.agent.llm === "string") {
      return stringifyStepResult(messages.at(-1)?.content ?? "");
    }
    if (typeof this.agent.llm === "function") {
      return await this.agent.llm(messages);
    }
    return await this.agent.llm.call(messages);
  }

  private async runToolByName(name: string, args: unknown): Promise<unknown> {
    const sanitized = sanitizeToolName(name);
    const tool = this.tools.find((candidate) => sanitizeToolName(candidate.name) === sanitized);
    if (!tool) {
      throw new Error(`Tool '${name}' is not available`);
    }
    return await tool.run(args as Record<string, unknown>);
  }
}

function stringifyStepResult(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }
  if (result === null || result === undefined) {
    return "";
  }
  try {
    return JSON.stringify(result);
  } catch {
    return Object.prototype.toString.call(result);
  }
}

function agentRoleLabel(agent: unknown): string {
  if (agent && typeof agent === "object" && "role" in agent) {
    const role = (agent as { role?: unknown }).role;
    return typeof role === "string" || typeof role === "number" || typeof role === "boolean"
      ? String(role)
      : "";
  }
  return "";
}

type NormalizedNativeToolCall = {
  name: string | null;
  args: unknown;
  rawArgs: unknown;
  argumentParseError: string | null;
  id: string | null;
};

function normalizeNativeToolCall(toolCall: unknown): NormalizedNativeToolCall {
  if (!toolCall || typeof toolCall !== "object") {
    return { name: null, args: {}, rawArgs: {}, argumentParseError: null, id: null };
  }
  const record = toolCall as Record<string, unknown>;
  const fn = record.function && typeof record.function === "object"
    ? record.function as Record<string, unknown>
    : null;
  const rawFunctionCall = record.functionCall ?? record.function_call;
  const functionCall = rawFunctionCall && typeof rawFunctionCall === "object"
    ? rawFunctionCall as Record<string, unknown>
    : null;
  const name = typeof fn?.name === "string"
    ? fn.name
    : typeof functionCall?.name === "string"
      ? functionCall.name
      : typeof record.name === "string"
        ? record.name
        : null;
  const rawArgs = fn && "arguments" in fn
    ? fn.arguments
    : functionCall && "args" in functionCall
      ? functionCall.args
      : functionCall && "arguments" in functionCall
        ? functionCall.arguments
        : record.arguments ?? record.input ?? record.args ?? {};
  const parsed = typeof rawArgs === "string"
    ? parseNativeArgs(rawArgs)
    : { args: rawArgs, error: null };
  return {
    name,
    args: parsed.args,
    rawArgs,
    argumentParseError: parsed.error,
    id: typeof record.id === "string"
      ? record.id
      : typeof record.toolUseId === "string"
        ? record.toolUseId
        : null,
  };
}

function stringifyNativeToolArguments(args: unknown): string {
  if (typeof args === "string") {
    return args;
  }
  try {
    return JSON.stringify(args ?? {});
  } catch {
    return "{}";
  }
}

function isRawNativeToolPart(toolCall: unknown): boolean {
  if (!toolCall || typeof toolCall !== "object") {
    return false;
  }
  const record = toolCall as Record<string, unknown>;
  return Boolean(record.functionCall ?? record.function_call);
}

function parseNativeArgs(rawArgs: string): { args: unknown; error: string | null } {
  if (!rawArgs.trim()) {
    return { args: {}, error: null };
  }
  try {
    return { args: JSON.parse(rawArgs) as unknown, error: null };
  } catch (error) {
    return { args: {}, error: executorErrorMessage(error) };
  }
}

export class PlannerObserver {
  readonly agent: unknown;
  readonly task: unknown;
  readonly kickoffInput: string;
  readonly kickoff_input: string;
  readonly llm: unknown;

  constructor(agent: unknown = null, task: unknown = null, kickoffInput = "") {
    this.agent = agent;
    this.task = task;
    this.kickoffInput = kickoffInput;
    this.kickoff_input = kickoffInput;
    this.llm = this._resolveLlm();
  }

  _resolveLlm(): unknown {
    const agentRecord = asPlannerRecord(this.agent);
    const planningConfig = asPlannerRecord(agentRecord?.planningConfig ?? agentRecord?.planning_config);
    const planningLlm = planningConfig?.llm ?? null;
    return planningLlm ?? agentRecord?.llm ?? null;
  }

  _resolve_llm(): unknown {
    return this._resolveLlm();
  }

  observe(
    stepOrOptions: string | TodoItem | {
      completedStep?: TodoItem;
      completed_step?: TodoItem;
      result?: unknown;
      allCompleted?: readonly TodoItem[];
      all_completed?: readonly TodoItem[];
      remainingTodos?: readonly TodoItem[];
      remaining_todos?: readonly TodoItem[];
    },
    result?: unknown,
    allCompleted: readonly TodoItem[] = [],
    remainingTodos: readonly TodoItem[] = [],
  ): StepObservation {
    if (typeof stepOrOptions !== "string") {
      const options = stepOrOptions instanceof TodoItem
        ? { completedStep: stepOrOptions, result, allCompleted, remainingTodos }
        : stepOrOptions;
      const completedStep = options.completedStep ?? options.completed_step;
      if (completedStep instanceof TodoItem) {
        const stepResult = options.result;
        const completed = options.allCompleted ?? options.all_completed ?? [];
        const remaining = options.remainingTodos ?? options.remaining_todos ?? [];
        const eventCommon = {
          agent_role: agentRoleLabel(this.agent),
          step_number: completedStep.stepNumber,
          step_description: completedStep.description,
          from_task: this.task,
          from_agent: this.agent,
        };
        crewaiEventBus.emit(this.agent ?? this, new StepObservationStartedEvent(eventCommon));
        const messages = this._buildObservationMessages(completedStep, stringifyStepResult(stepResult), completed, remaining);
        try {
          const response = callPlannerLlm(this.llm, messages);
          if (response !== null) {
            const observation = PlannerObserver._parseObservationResponse(response);
            crewaiEventBus.emit(this.agent ?? this, new StepObservationCompletedEvent({
              ...eventCommon,
              step_completed_successfully: observation.stepCompletedSuccessfully,
              key_information_learned: observation.keyInformationLearned,
              remaining_plan_still_valid: observation.remainingPlanStillValid,
              needs_full_replan: observation.needsFullReplan,
              replan_reason: observation.replanReason,
              goal_already_achieved: observation.goalAlreadyAchieved,
              suggested_refinements: observation.suggestedRefinements?.map((refinement) => (
                `Step ${String(refinement.stepNumber)}: ${refinement.newDescription}`
              )) ?? null,
            }));
            return observation;
          }
        } catch (error) {
          crewaiEventBus.emit(this.agent ?? this, new StepObservationFailedEvent({
            ...eventCommon,
            error,
          }));
          return new StepObservation({
            step_completed_successfully: true,
            key_information_learned: stringifyStepResult(stepResult),
            remaining_plan_still_valid: true,
            needs_full_replan: false,
          });
        }
      }
    }
    const step = typeof stepOrOptions === "string" ? stepOrOptions : stringifyStepResult(stepOrOptions);
    return new StepObservation({
      stepCompletedSuccessfully: true,
      keyInformationLearned: `${step}${result === undefined ? "" : `: ${typeof result === "string" ? result : JSON.stringify(result)}`}`,
      remainingPlanStillValid: true,
    });
  }

  static heuristicObservation(options: { stepSuccess?: boolean; step_success?: boolean; result?: unknown }): StepObservation {
    return new StepObservation({
      stepCompletedSuccessfully: options.stepSuccess ?? options.step_success ?? true,
      keyInformationLearned: "",
      remainingPlanStillValid: true,
      needsFullReplan: false,
    });
  }

  static heuristic_observation(options: { step_success?: boolean; stepSuccess?: boolean; result?: unknown }): StepObservation {
    return PlannerObserver.heuristicObservation(options);
  }

  heuristicObservation(step: string, result: unknown): StepObservation {
    return this.observe(step, result);
  }

  heuristic_observation(step: string, result: unknown): StepObservation {
    return this.heuristicObservation(step, result);
  }

  applyRefinements(observation: StepObservation, remainingTodos: TodoItem[]): TodoItem[] {
    if (!observation.suggestedRefinements || observation.suggestedRefinements.length === 0) {
      return remainingTodos;
    }
    const todoByStep = new Map(remainingTodos.map((todo) => [todo.stepNumber, todo]));
    for (const refinement of observation.suggestedRefinements) {
      const todo = todoByStep.get(refinement.stepNumber);
      if (todo && refinement.newDescription) {
        Object.defineProperty(todo, "description", {
          value: refinement.newDescription,
          writable: false,
          enumerable: true,
          configurable: true,
        });
      }
    }
    return remainingTodos;
  }

  apply_refinements(observation: StepObservation, remaining_todos: TodoItem[]): TodoItem[] {
    return this.applyRefinements(observation, remaining_todos);
  }

  _buildObservationMessages(
    completedStep: TodoItem,
    result: string,
    allCompleted: readonly TodoItem[],
    remainingTodos: readonly TodoItem[],
  ): LLMMessage[] {
    const taskRecord = asPlannerRecord(this.task);
    const taskDescription = typeof taskRecord?.description === "string"
      ? taskRecord.description
      : this.kickoffInput
        ? extractTaskSection(this.kickoffInput)
        : "";
    const taskGoal = typeof taskRecord?.expectedOutput === "string"
      ? taskRecord.expectedOutput
      : typeof taskRecord?.expected_output === "string"
        ? taskRecord.expected_output
        : this.kickoffInput
          ? "Complete the task successfully"
          : "";
    const completedSummary = allCompleted.length > 0
      ? [
        "## Previously completed steps:",
        ...allCompleted.map((todo) => [
          `  Step ${String(todo.stepNumber)}: ${todo.description}`,
          `    Result: ${(todo.result ?? "").slice(0, 200)}`,
        ].join("\n")),
      ].join("\n")
      : "";
    const remainingSummary = remainingTodos.length > 0
      ? [
        "## Remaining plan steps:",
        ...remainingTodos.map((todo) => `  Step ${String(todo.stepNumber)}: ${todo.description}`),
      ].join("\n")
      : "";
    return [
      {
        role: "system",
        content: "Observe the completed plan step and decide whether the remaining plan is still valid.",
      },
      {
        role: "user",
        content: [
          taskDescription ? `Task description:\n${taskDescription}` : "",
          taskGoal ? `Task goal:\n${taskGoal}` : "",
          completedSummary,
          `Completed step ${String(completedStep.stepNumber)}:\n${completedStep.description}`,
          `Step result:\n${result}`,
          remainingSummary,
        ].filter(Boolean).join("\n\n"),
      },
    ];
  }

  _build_observation_messages(
    completed_step: TodoItem,
    result: string,
    all_completed: readonly TodoItem[],
    remaining_todos: readonly TodoItem[],
  ): LLMMessage[] {
    return this._buildObservationMessages(completed_step, result, all_completed, remaining_todos);
  }

  static _parseObservationResponse(response: unknown): StepObservation {
    if (response instanceof StepObservation) {
      return response;
    }
    const parsed = parseObservationPayload(response);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return new StepObservation(parsed);
    }
    return new StepObservation({
      step_completed_successfully: false,
      key_information_learned: stringifyInput(response),
      remaining_plan_still_valid: false,
    });
  }

  _parseObservationResponse(response: unknown): StepObservation {
    return PlannerObserver._parseObservationResponse(response);
  }

  static _parse_observation_response(response: unknown): StepObservation {
    return PlannerObserver._parseObservationResponse(response);
  }

  _parse_observation_response(response: unknown): StepObservation {
    return PlannerObserver._parseObservationResponse(response);
  }
}

export class OutputConverter<T = unknown> extends Converter<T> {
  override to_pydantic(currentAttempt = 1): Promise<T> {
    return super.to_pydantic(currentAttempt);
  }

  override to_json(currentAttempt = 1): Promise<string | import("./converter.js").ConverterError> {
    return super.to_json(currentAttempt);
  }
}

export class TokenProcess {
  readonly summary: UsageMetrics;

  constructor(summary: UsageMetrics = new UsageMetrics()) {
    this.summary = summary;
  }

  get totalTokens(): number {
    return this.summary.totalTokens;
  }

  get total_tokens(): number {
    return this.summary.totalTokens;
  }

  get promptTokens(): number {
    return this.summary.promptTokens;
  }

  get prompt_tokens(): number {
    return this.summary.promptTokens;
  }

  get cachedPromptTokens(): number {
    return this.summary.cachedPromptTokens;
  }

  get cached_prompt_tokens(): number {
    return this.summary.cachedPromptTokens;
  }

  get completionTokens(): number {
    return this.summary.completionTokens;
  }

  get completion_tokens(): number {
    return this.summary.completionTokens;
  }

  get successfulRequests(): number {
    return this.summary.successfulRequests;
  }

  get successful_requests(): number {
    return this.summary.successfulRequests;
  }

  sumPromptTokens(tokensOrMessages: number | readonly LLMMessage[]): number {
    const tokens = typeof tokensOrMessages === "number"
      ? tokensOrMessages
      : tokensOrMessages.reduce((sum, message) => sum + estimateTokens(message.content), 0);
    this.summary.promptTokens += tokens;
    this.summary.totalTokens += tokens;
    syncUsageMetricAliases(this.summary);
    return tokens;
  }

  sum_prompt_tokens(tokensOrMessages: number | readonly LLMMessage[]): number {
    return this.sumPromptTokens(tokensOrMessages);
  }

  sumCompletionTokens(tokens: number): void {
    this.summary.completionTokens += tokens;
    this.summary.totalTokens += tokens;
    syncUsageMetricAliases(this.summary);
  }

  sum_completion_tokens(tokens: number): void {
    this.sumCompletionTokens(tokens);
  }

  sumCachedPromptTokens(tokens: number): void {
    this.summary.cachedPromptTokens += tokens;
    syncUsageMetricAliases(this.summary);
  }

  sum_cached_prompt_tokens(tokens: number): void {
    this.sumCachedPromptTokens(tokens);
  }

  sumSuccessfulRequests(requests: number): void {
    this.summary.successfulRequests += requests;
    syncUsageMetricAliases(this.summary);
  }

  sum_successful_requests(requests: number): void {
    this.sumSuccessfulRequests(requests);
  }

  process(text: string): UsageMetrics {
    return new UsageMetrics({
      totalTokens: estimateTokens(text),
      promptTokens: estimateTokens(text),
      successfulRequests: 1,
    });
  }

  getSummary(): UsageMetrics {
    return this.summary;
  }

  get_summary(): UsageMetrics {
    return this.getSummary();
  }
}

export function parseAgentStep(text: string): ReturnType<typeof parseAgentOutput> {
  return parseAgentOutput(text);
}

export const parse_agent_step = parseAgentStep;

function asPlannerRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function callPlannerLlm(llm: unknown, messages: readonly LLMMessage[]): unknown {
  const record = asPlannerRecord(llm);
  const call = record?.call;
  if (typeof call === "function") {
    return call.call(llm, messages);
  }
  return null;
}

function parseObservationPayload(response: unknown): unknown {
  if (typeof response !== "string") {
    return response;
  }
  const text = response.trim();
  if (!text) {
    return null;
  }
  for (const candidate of [text, stripJsonFence(text)]) {
    if (!candidate) {
      continue;
    }
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // Try the next normalized representation.
    }
  }
  return null;
}

function stripJsonFence(text: string): string | null {
  if (!text.startsWith("```")) {
    return null;
  }
  const lines = text.split("\n");
  if (lines.length <= 2) {
    return null;
  }
  const body = lines.at(-1)?.trim() === "```" ? lines.slice(1, -1) : lines.slice(1);
  return body.join("\n").trim();
}

function estimateTokens(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function syncUsageMetricAliases(metrics: UsageMetrics): void {
  const aliases = metrics as UsageMetrics & {
    total_tokens: number;
    prompt_tokens: number;
    cached_prompt_tokens: number;
    completion_tokens: number;
    successful_requests: number;
  };
  aliases.total_tokens = metrics.totalTokens;
  aliases.prompt_tokens = metrics.promptTokens;
  aliases.cached_prompt_tokens = metrics.cachedPromptTokens;
  aliases.completion_tokens = metrics.completionTokens;
  aliases.successful_requests = metrics.successfulRequests;
}

function isPromiseLike<T = unknown>(value: unknown): value is PromiseLike<T> {
  return !!value && typeof value === "object" && "then" in value && typeof (value as { then?: unknown }).then === "function";
}

function executorErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function stringifyInput(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value.toString();
  }
  return JSON.stringify(value);
}

function asNativeArgsRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : { input: value };
}

function formatExecutorPrompt(prompt: string, inputs: Record<string, unknown>): string {
  return prompt.replaceAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, key: string) => {
    const value = inputs[key];
    return value === undefined || value === null ? "" : stringifyInput(value);
  });
}
