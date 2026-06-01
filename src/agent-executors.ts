import { Agent, type AgentExecutionOptions, type AgentOptions } from "./agent.js";
import type { CheckpointConfig } from "./state.js";
import type { Crew } from "./crew.js";
import { StepObservation, TodoItem, TodoList, TodoStatus } from "./agent-planning.js";
import { AgentAction, AgentFinish, parseAgentOutput } from "./agent-parser.js";
import {
  executeSingleNativeToolCall,
  extractTaskSection,
  extractToolCallInfo,
  formatMessageForLLM,
  isToolCallList,
} from "./agent-utils.js";
import { Converter } from "./converter.js";
import { UsageMetrics, type LLMResponse } from "./llm.js";
import { StepExecutionContext, StepResult } from "./step-execution-context.js";
import { sanitizeToolName } from "./tools.js";
import type { LLMMessage, MaybePromise, Tool } from "./types.js";

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
    promptOrOptions: Parameters<Agent["aexecuteTask"]>[0],
    context?: string | null,
    tools?: readonly Tool[],
  ): Promise<string> {
    return super.aexecuteTask(promptOrOptions, context, tools);
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
  maxIter?: number;
  max_iter?: number;
  messages?: readonly LLMMessage[];
};

export class BaseAgentExecutor {
  readonly executorType: string;
  readonly executor_type: string;
  readonly crew: Crew | null;
  readonly agent: Agent | null;
  readonly task: unknown;
  readonly tools: readonly Tool[];
  readonly maxIter: number;
  readonly max_iter: number;
  iterations = 0;
  messages: LLMMessage[];
  _save_to_memory = false;

  constructor(options: BaseAgentExecutorOptions = {}) {
    this.executorType = "base";
    this.executor_type = this.executorType;
    this.crew = options.crew ?? null;
    this.agent = options.agent ?? null;
    this.task = options.task ?? null;
    this.tools = options.tools ?? this.agent?.tools ?? [];
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
    const llm = this.agent?.llm;
    const candidate = typeof llm === "object" && llm !== null
      ? llm as { supportsStopWords?: unknown }
      : null;
    if (typeof candidate?.supportsStopWords !== "function") {
      return false;
    }
    const supportsStopWords = candidate.supportsStopWords as () => unknown;
    return Boolean(supportsStopWords());
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
    const effort = this.reasoningEffort();
    if (current) {
      this.state.observations[current.stepNumber] = new StepObservation({
        stepCompletedSuccessfully: current.status !== TodoStatus.FAILED,
        keyInformationLearned: current.result ?? "",
        remainingPlanStillValid: true,
      });
      this.state.execution_log.push({
        type: "observation",
        step_number: current.stepNumber,
        reasoning_effort: effort,
      });
    }
    return effort === "high" ? "step_observed_high" : effort === "medium" ? "step_observed_medium" : "step_observed_low";
  }

  observe_step_result(): ReturnType<AgentExecutor["observeStepResult"]> {
    return this.observeStepResult();
  }

  handleStepObservedLow(): "continue_plan" | "replan_now" {
    return this.finishCurrentObservedTodo(false);
  }

  handle_step_observed_low(): ReturnType<AgentExecutor["handleStepObservedLow"]> {
    return this.handleStepObservedLow();
  }

  handleStepObservedMedium(): "continue_plan" | "replan_now" {
    return this.finishCurrentObservedTodo(true);
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
    return observation?.suggestedRefinements?.length ? "refine_and_continue" : "continue_plan";
  }

  decide_next_action(): ReturnType<AgentExecutor["decideNextAction"]> {
    return this.decideNextAction();
  }

  handleRefineAndContinue(): "has_todos" {
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
    for (const todo of this.state.todos.getPendingTodos()) {
      todo.status = TodoStatus.COMPLETED;
    }
    return "all_todos_complete";
  }

  handle_goal_achieved(): "all_todos_complete" {
    return this.handleGoalAchieved();
  }

  handleReplanNow(): "has_todos" | "all_todos_complete" {
    this.state.replan_count += 1;
    this.state.last_replan_reason ??= "Dynamic replan triggered";
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

  executeTodoSequential(): "step_executed" | "todo_injected" {
    const current = this.state.todos.currentTodo;
    if (!current) {
      return "todo_injected";
    }
    current.result ??= current.description;
    this.state.execution_log.push({ type: "step_execution", step_number: current.stepNumber, success: true });
    return "step_executed";
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
    this.state.use_native_tools = false;
    return "initialized";
  }

  initialize_reasoning(): "initialized" {
    return this.initializeReasoning();
  }

  ensureForceFinalAnswer(): "agent_finished" {
    if (!this.state.is_finished) {
      const output = this.messages.at(-1)?.content ?? "Agent completed execution but produced no final output.";
      this.state.current_answer = new AgentFinish({ thought: "", output, text: output });
      this.state.is_finished = true;
    }
    return "agent_finished";
  }

  ensure_force_final_answer(): "agent_finished" {
    return this.ensureForceFinalAnswer();
  }

  callLlmAndParse(): "parsed" | "parser_error" | "context_error" {
    try {
      const content = this.messages.at(-1)?.content ?? "";
      this.state.current_answer = parseAgentOutput(content);
      return "parsed";
    } catch (error) {
      this.lastParserError = error instanceof Error ? error : new Error(String(error));
      return "parser_error";
    }
  }

  call_llm_and_parse(): ReturnType<AgentExecutor["callLlmAndParse"]> {
    return this.callLlmAndParse();
  }

  callLlmNativeTools(): "native_tool_calls" | "native_finished" | "context_error" | "todo_satisfied" {
    return this.state.pending_tool_calls.length > 0 ? "native_tool_calls" : "native_finished";
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
    this.messages.push({ role: "assistant", content: answer instanceof AgentAction ? answer.text : "" });
    return "tool_completed";
  }

  execute_tool_action(): ReturnType<AgentExecutor["executeToolAction"]> {
    return this.executeToolAction();
  }

  executeNativeTool(): "native_tool_completed" | "tool_result_is_final" {
    this.state.pending_tool_calls = [];
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
    return this.state.todos.currentTodo ? "todo_satisfied" : "todo_not_satisfied";
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
      const output = completed.length > 0
        ? completed.map((todo) => `Step ${String(todo.stepNumber)}: ${todo.result ?? ""}`).join("\n\n")
        : "Agent completed execution but produced no final output.";
      this.state.current_answer = new AgentFinish({ thought: "", output, text: output });
    }
    if (!(this.state.current_answer instanceof AgentFinish)) {
      return "skipped";
    }
    this.state.is_finished = true;
    return "completed";
  }

  handleReplan(): "has_todos" | "no_todos" {
    this.state.replan_count += 1;
    return this.state.todos.getPendingTodos().length > 0 ? "has_todos" : "no_todos";
  }

  handle_replan(): ReturnType<AgentExecutor["handleReplan"]> {
    return this.handleReplan();
  }

  recoverFromParserError(): "initialized" {
    this.lastParserError = null;
    this.state.iterations += 1;
    return "initialized";
  }

  recover_from_parser_error(): "initialized" {
    return this.recoverFromParserError();
  }

  recoverFromContextLength(): "initialized" {
    this.lastContextError = null;
    this.state.iterations += 1;
    return "initialized";
  }

  recover_from_context_length(): "initialized" {
    return this.recoverFromContextLength();
  }

  override invoke(input: string | readonly LLMMessage[] | Record<string, unknown> = ""): MaybePromise<unknown> {
    if (typeof input === "object" && !Array.isArray(input) && "input" in input) {
      return this.invokeFromInputs(input);
    }
    return super.invoke(input as string | readonly LLMMessage[]);
  }

  invokeAsync(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    return Promise.resolve(this.invokeFromInputs(inputs));
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
      this.finalizeCalled = false;
      this.state.messages = [];
      this.messages = this.state.messages;
      this.state.iterations = 0;
      this.state.current_answer = null;
      this.state.is_finished = false;
      this.state.pending_tool_calls = [];
      this.state.todos = new TodoList();
      this.kickoffInput = stringifyInput(inputs.input);
      if (this.kickoffInput) {
        this.state.messages.push({ role: "user", content: this.kickoffInput });
      }
      const result = super.invoke(this.kickoffInput);
      const output = result instanceof AgentFinish ? result.output : result;
      this.state.current_answer = result instanceof AgentFinish ? result : new AgentFinish({ thought: "", output, text: String(output) });
      this.state.is_finished = true;
      return { output };
    } finally {
      this.isExecuting = false;
    }
  }

  private routeFinishWithTodos<T extends string>(defaultRoute: T): T | "todo_satisfied" {
    return this.state.todos.currentTodo ? "todo_satisfied" : defaultRoute;
  }

  private finishCurrentObservedTodo(replanOnFailure: boolean): "continue_plan" | "replan_now" {
    const current = this.state.todos.currentTodo;
    if (!current) {
      return "continue_plan";
    }
    const observation = this.state.observations[current.stepNumber];
    if (observation?.stepCompletedSuccessfully === false) {
      this.state.todos.markFailed(current.stepNumber, current.result);
      if (replanOnFailure || observation.needsFullReplan) {
        this.state.last_replan_reason = observation.replanReason ?? "Step did not complete successfully";
        return "replan_now";
      }
      return "continue_plan";
    }
    this.state.todos.markCompleted(current.stepNumber, current.result);
    return "continue_plan";
  }

  private shouldReplan(): readonly [boolean, string] {
    if (this.state.todos.getFailedTodos().length >= 2) {
      return [true, "Multiple todos failed"];
    }
    return [false, ""];
  }

  private reasoningEffort(): "low" | "medium" | "high" {
    const config = this.agent && "planningConfig" in this.agent
      ? this.agent.planningConfig as unknown
      : null;
    if (config && typeof config === "object" && "reasoningEffort" in config) {
      const effort = (config as { reasoningEffort?: unknown }).reasoningEffort;
      if (effort === "low" || effort === "medium" || effort === "high") {
        return effort;
      }
    }
    return "medium";
  }
}

export class CrewAgentExecutorFlow extends AgentExecutor {}

export class CrewAgentExecutor extends BaseAgentExecutor {
  constructor(options: BaseAgentExecutorOptions = {}) {
    super(options);
    Object.defineProperties(this, {
      executorType: { value: "crew", enumerable: true },
      executor_type: { value: "crew", enumerable: true },
    });
  }

  invoke(input: string | readonly LLMMessage[] = ""): MaybePromise<unknown> {
    if (this.agent && typeof input === "string") {
      return this.agent.kickoff(input, { task: this.task } satisfies AgentExecutionOptions);
    }
    return super.invoke(input);
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

  async _ahandle_human_feedback(formattedAnswer: AgentFinish): Promise<AgentFinish> {
    await Promise.resolve();
    return formattedAnswer;
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
    for (const [callId, funcName, funcArgs] of parsed) {
      const result = await executeSingleNativeToolCall(
        { id: callId, name: funcName, arguments: typeof funcArgs === "string" ? parseNativeCrewArgs(funcArgs) : funcArgs },
        availableFunctions,
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

  _invoke_step_callback(formattedAnswer: AgentAction | AgentFinish): void {
    const callback = (this.agent?.stepCallback ?? this.agent?.step_callback ?? null) as ((value: AgentAction | AgentFinish) => unknown) | null;
    const result = callback?.(formattedAnswer);
    if (result && typeof result === "object" && "then" in result) {
      void result;
    }
  }

  async _ainvoke_step_callback(formattedAnswer: AgentAction | AgentFinish): Promise<void> {
    const callback = (this.agent?.stepCallback ?? this.agent?.step_callback ?? null) as ((value: AgentAction | AgentFinish) => unknown) | null;
    const result = callback?.(formattedAnswer);
    if (result && typeof result === "object" && "then" in result) {
      await (result as PromiseLike<unknown>);
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
      const toolResult = await this._executeTextToolWithEvents(parsed);
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
      throw new Error(`Tool '${formatted.tool}' is not available`);
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
      const result = typeof fn === "function"
        ? await (fn as (input: unknown) => MaybePromise<unknown>)(args)
        : await this.runToolByName(name, args);
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
    _maxStepIterations = 15,
    _stepTimeout: number | null = null,
  ): Promise<StepResult> {
    void _maxStepIterations;
    void _stepTimeout;
    return this.executeStep(typeof todo === "string" ? todo : todo.description, context);
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

function normalizeNativeToolCall(toolCall: unknown): { name: string | null; args: unknown; id: string | null } {
  if (!toolCall || typeof toolCall !== "object") {
    return { name: null, args: {}, id: null };
  }
  const record = toolCall as Record<string, unknown>;
  const fn = record.function && typeof record.function === "object"
    ? record.function as Record<string, unknown>
    : null;
  const name = typeof fn?.name === "string"
    ? fn.name
    : typeof record.name === "string"
      ? record.name
      : null;
  const rawArgs = fn && "arguments" in fn ? fn.arguments : record.arguments ?? record.args ?? {};
  const args = typeof rawArgs === "string"
    ? parseNativeArgs(rawArgs)
    : rawArgs;
  return {
    name,
    args,
    id: typeof record.id === "string" ? record.id : null,
  };
}

function parseNativeArgs(rawArgs: string): unknown {
  if (!rawArgs.trim()) {
    return {};
  }
  try {
    return JSON.parse(rawArgs) as unknown;
  } catch {
    return { input: rawArgs };
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

  observe(step: string, result: unknown): StepObservation {
    return new StepObservation({
      stepCompletedSuccessfully: true,
      keyInformationLearned: `${step}${result === undefined ? "" : `: ${typeof result === "string" ? result : JSON.stringify(result)}`}`,
      remainingPlanStillValid: true,
    });
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
