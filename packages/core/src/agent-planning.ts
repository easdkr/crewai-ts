import { I18N_DEFAULT } from "./i18n.js";
import { sanitizeToolName } from "./string-utils.js";
import type { LLM, LLMMessage, MaybePromise } from "./types.js";
import {
  AgentReasoningCompletedEvent,
  AgentReasoningFailedEvent,
  AgentReasoningStartedEvent,
  crewaiEventBus,
} from "./events.js";

export type ReasoningEffort = "low" | "medium" | "high";

export type PlanningConfigOptions = {
  reasoningEffort?: ReasoningEffort;
  reasoning_effort?: ReasoningEffort;
  observeSteps?: boolean | null;
  observe_steps?: boolean | null;
  maxAttempts?: number | null;
  max_attempts?: number | null;
  maxSteps?: number;
  max_steps?: number;
  systemPrompt?: string | null;
  system_prompt?: string | null;
  planPrompt?: string | null;
  plan_prompt?: string | null;
  refinePrompt?: string | null;
  refine_prompt?: string | null;
  maxReplans?: number;
  max_replans?: number;
  maxStepIterations?: number;
  max_step_iterations?: number;
  stepTimeout?: number | null;
  step_timeout?: number | null;
  llm?: LLM | string | null;
};

export type AgentPlanStep = {
  stepNumber?: number;
  step_number?: number;
  description: string;
  toolToUse?: string | null;
  tool_to_use?: string | null;
  dependsOn?: readonly number[];
  depends_on?: readonly number[];
};

export type AgentReasoningPlan = {
  plan: string;
  steps: readonly AgentPlanStep[];
  ready: boolean;
};

type ReasoningLLM = {
  call?: (messages: readonly LLMMessage[], options?: Record<string, unknown>) => MaybePromise<unknown>;
  supportsFunctionCalling?: () => boolean;
  supports_function_calling?: () => boolean;
};

export const REASONING_READY_MARKER = "READY: I am ready to execute the task.";

export const TodoStatus = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;
export type TodoStatus = typeof TodoStatus[keyof typeof TodoStatus];

export class PlanStep {
  readonly stepNumber: number;
  readonly step_number: number;
  readonly description: string;
  readonly toolToUse: string | null;
  readonly tool_to_use: string | null;
  readonly dependsOn: readonly number[];
  readonly depends_on: readonly number[];

  constructor(options: AgentPlanStep) {
    const stepNumber = options.stepNumber ?? options.step_number ?? 0;
    this.stepNumber = stepNumber;
    this.step_number = this.stepNumber;
    this.description = options.description;
    this.toolToUse = options.toolToUse ?? options.tool_to_use ?? null;
    this.tool_to_use = this.toolToUse;
    this.dependsOn = options.dependsOn ?? options.depends_on ?? [];
    this.depends_on = this.dependsOn;
  }

  modelDump(): AgentPlanStep {
    return {
      step_number: this.step_number,
      description: this.description,
      tool_to_use: this.tool_to_use,
      depends_on: [...this.depends_on],
    };
  }

  model_dump(): AgentPlanStep {
    return this.modelDump();
  }

  toJSON(): AgentPlanStep {
    return this.modelDump();
  }
}

export class TodoItem extends PlanStep {
  readonly id: string;
  status: TodoStatus;
  result: string | null;

  constructor(options: AgentPlanStep & { id?: string; status?: TodoStatus; result?: string | null }) {
    super(options);
    this.id = options.id ?? crypto.randomUUID();
    this.status = options.status ?? TodoStatus.PENDING;
    this.result = options.result ?? null;
  }

  modelDump(): AgentPlanStep & { id: string; status: TodoStatus; result: string | null } {
    return {
      id: this.id,
      ...super.modelDump(),
      status: this.status,
      result: this.result,
    };
  }

  model_dump(): AgentPlanStep & { id: string; status: TodoStatus; result: string | null } {
    return this.modelDump();
  }

  toJSON(): AgentPlanStep & { id: string; status: TodoStatus; result: string | null } {
    return this.modelDump();
  }
}

export class TodoList {
  items: TodoItem[];

  constructor(options: { items?: readonly (TodoItem | (AgentPlanStep & { id?: string; status?: TodoStatus; result?: string | null }))[] } = {}) {
    this.items = (options.items ?? []).map((item) => item instanceof TodoItem ? item : new TodoItem(item));
  }

  get currentTodo(): TodoItem | null {
    return this.items.find((item) => item.status === TodoStatus.RUNNING) ?? null;
  }

  get current_todo(): TodoItem | null {
    return this.currentTodo;
  }

  get nextPending(): TodoItem | null {
    return this.items.find((item) => item.status === TodoStatus.PENDING) ?? null;
  }

  get next_pending(): TodoItem | null {
    return this.nextPending;
  }

  get isComplete(): boolean {
    return this.items.length > 0 && this.items.every((item) => item.status === TodoStatus.COMPLETED || item.status === TodoStatus.FAILED);
  }

  get is_complete(): boolean {
    return this.isComplete;
  }

  get pendingCount(): number {
    return this.items.filter((item) => item.status === TodoStatus.PENDING).length;
  }

  get pending_count(): number {
    return this.pendingCount;
  }

  get completedCount(): number {
    return this.items.filter((item) => item.status === TodoStatus.COMPLETED).length;
  }

  get completed_count(): number {
    return this.completedCount;
  }

  get runningCount(): number {
    return this.items.filter((item) => item.status === TodoStatus.RUNNING).length;
  }

  get running_count(): number {
    return this.runningCount;
  }

  get canParallelize(): boolean {
    return this.getReadyTodos().length > 1;
  }

  get can_parallelize(): boolean {
    return this.canParallelize;
  }

  getByStepNumber(stepNumber: number): TodoItem | null {
    return this.items.find((item) => item.stepNumber === stepNumber) ?? null;
  }

  get_by_step_number(stepNumber: number): TodoItem | null {
    return this.getByStepNumber(stepNumber);
  }

  markRunning(stepNumber: number): void {
    const item = this.getByStepNumber(stepNumber);
    if (item) {
      item.status = TodoStatus.RUNNING;
    }
  }

  mark_running(stepNumber: number): void {
    this.markRunning(stepNumber);
  }

  markCompleted(stepNumber: number, result: string | null = null): void {
    const item = this.getByStepNumber(stepNumber);
    if (item) {
      item.status = TodoStatus.COMPLETED;
      item.result = result ?? item.result;
    }
  }

  mark_completed(stepNumber: number, result: string | null = null): void {
    this.markCompleted(stepNumber, result);
  }

  markFailed(stepNumber: number, result: string | null = null): void {
    const item = this.getByStepNumber(stepNumber);
    if (item) {
      item.status = TodoStatus.FAILED;
      item.result = result ?? item.result;
    }
  }

  mark_failed(stepNumber: number, result: string | null = null): void {
    this.markFailed(stepNumber, result);
  }

  getReadyTodos(): TodoItem[] {
    return this.items.filter((item) => item.status === TodoStatus.PENDING && this.dependenciesSatisfied(item));
  }

  get_ready_todos(): TodoItem[] {
    return this.getReadyTodos();
  }

  getCompletedTodos(): TodoItem[] {
    return this.items.filter((item) => item.status === TodoStatus.COMPLETED);
  }

  get_completed_todos(): TodoItem[] {
    return this.getCompletedTodos();
  }

  getFailedTodos(): TodoItem[] {
    return this.items.filter((item) => item.status === TodoStatus.FAILED);
  }

  get_failed_todos(): TodoItem[] {
    return this.getFailedTodos();
  }

  getPendingTodos(): TodoItem[] {
    return this.items.filter((item) => item.status === TodoStatus.PENDING);
  }

  get_pending_todos(): TodoItem[] {
    return this.getPendingTodos();
  }

  replacePendingTodos(newItems: readonly TodoItem[]): void {
    this.items = [...this.items.filter((item) => item.status !== TodoStatus.PENDING), ...newItems];
  }

  replace_pending_todos(newItems: readonly TodoItem[]): void {
    this.replacePendingTodos(newItems);
  }

  private dependenciesSatisfied(item: TodoItem): boolean {
    return item.dependsOn.every((stepNumber) => {
      const dependency = this.getByStepNumber(stepNumber);
      return !!dependency && (dependency.status === TodoStatus.COMPLETED || dependency.status === TodoStatus.FAILED);
    });
  }

  _dependencies_satisfied(item: TodoItem): boolean {
    return this.dependenciesSatisfied(item);
  }

  modelDump(): { items: Array<ReturnType<TodoItem["modelDump"]>> } {
    return { items: this.items.map((item) => item.modelDump()) };
  }

  model_dump(): { items: Array<ReturnType<TodoItem["modelDump"]>> } {
    return this.modelDump();
  }

  toJSON(): { items: Array<ReturnType<TodoItem["modelDump"]>> } {
    return this.modelDump();
  }
}

export class StepRefinement {
  readonly stepNumber: number;
  readonly step_number: number;
  readonly newDescription: string;
  readonly new_description: string;

  constructor(options: { stepNumber?: number; step_number?: number; newDescription?: string; new_description?: string }) {
    this.stepNumber = options.stepNumber ?? options.step_number ?? 0;
    this.step_number = this.stepNumber;
    this.newDescription = options.newDescription ?? options.new_description ?? "";
    this.new_description = this.newDescription;
  }
}

type StepRefinementOptions = ConstructorParameters<typeof StepRefinement>[0];

export class StepObservation {
  readonly stepCompletedSuccessfully: boolean;
  readonly step_completed_successfully: boolean;
  readonly keyInformationLearned: string;
  readonly key_information_learned: string;
  readonly remainingPlanStillValid: boolean;
  readonly remaining_plan_still_valid: boolean;
  readonly suggestedRefinements: readonly StepRefinement[] | null;
  readonly suggested_refinements: readonly StepRefinement[] | null;
  readonly needsFullReplan: boolean;
  readonly needs_full_replan: boolean;
  readonly replanReason: string | null;
  readonly replan_reason: string | null;
  readonly goalAlreadyAchieved: boolean;
  readonly goal_already_achieved: boolean;

  static coerceSingleRefinementToList(value: unknown): unknown {
    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof StepRefinement)) {
      return [value];
    }
    return value;
  }

  static coerce_single_refinement_to_list(value: unknown): unknown {
    return StepObservation.coerceSingleRefinementToList(value);
  }

  constructor(options: {
    stepCompletedSuccessfully?: boolean;
    step_completed_successfully?: boolean;
    keyInformationLearned?: string;
    key_information_learned?: string;
    remainingPlanStillValid?: boolean;
    remaining_plan_still_valid?: boolean;
    suggestedRefinements?: readonly (StepRefinement | StepRefinementOptions)[] | StepRefinement | StepRefinementOptions | null;
    suggested_refinements?: readonly (StepRefinement | StepRefinementOptions)[] | StepRefinement | StepRefinementOptions | null;
    needsFullReplan?: boolean;
    needs_full_replan?: boolean;
    replanReason?: string | null;
    replan_reason?: string | null;
    goalAlreadyAchieved?: boolean;
    goal_already_achieved?: boolean;
  } = {}) {
    this.stepCompletedSuccessfully = options.stepCompletedSuccessfully ?? options.step_completed_successfully ?? false;
    this.step_completed_successfully = this.stepCompletedSuccessfully;
    this.keyInformationLearned = options.keyInformationLearned ?? options.key_information_learned ?? "";
    this.key_information_learned = this.keyInformationLearned;
    this.remainingPlanStillValid = options.remainingPlanStillValid ?? options.remaining_plan_still_valid ?? true;
    this.remaining_plan_still_valid = this.remainingPlanStillValid;
    const refinements = StepObservation.coerceSingleRefinementToList(
      options.suggestedRefinements ?? options.suggested_refinements ?? null,
    ) as readonly (StepRefinement | StepRefinementOptions)[] | StepRefinement | StepRefinementOptions | null;
    this.suggestedRefinements = refinements === null ? null : (Array.isArray(refinements) ? refinements : [refinements]).map((item) => item instanceof StepRefinement ? item : new StepRefinement(item as StepRefinementOptions));
    this.suggested_refinements = this.suggestedRefinements;
    this.needsFullReplan = options.needsFullReplan ?? options.needs_full_replan ?? false;
    this.needs_full_replan = this.needsFullReplan;
    this.replanReason = options.replanReason ?? options.replan_reason ?? null;
    this.replan_reason = this.replanReason;
    this.goalAlreadyAchieved = options.goalAlreadyAchieved ?? options.goal_already_achieved ?? false;
    this.goal_already_achieved = this.goalAlreadyAchieved;
  }
}

export class ReasoningPlan {
  readonly plan: string;
  readonly steps: readonly PlanStep[];
  readonly ready: boolean;

  constructor(options: { plan: string; steps?: readonly (PlanStep | AgentPlanStep)[]; ready: boolean }) {
    this.plan = options.plan;
    this.steps = (options.steps ?? []).map((step) => step instanceof PlanStep ? step : new PlanStep(step));
    this.ready = options.ready;
  }
}

export const PlanningPlan = ReasoningPlan;

export const AgentReasoningOutput = class AgentReasoningOutput {
  readonly plan: ReasoningPlan;

  constructor(options: { plan: ReasoningPlan | { plan: string; steps?: readonly (PlanStep | AgentPlanStep)[]; ready: boolean } }) {
    this.plan = options.plan instanceof ReasoningPlan ? options.plan : new ReasoningPlan(options.plan);
  }
};
export type AgentReasoningOutput = InstanceType<typeof AgentReasoningOutput>;
export const AgentPlanningOutput = AgentReasoningOutput;

export const FUNCTION_SCHEMA = {
  type: "function",
  function: {
    name: "create_reasoning_plan",
    description: "Create or refine a reasoning plan for a task with structured steps",
    parameters: {
      type: "object",
      properties: {
        plan: { type: "string" },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              step_number: { type: "integer" },
              description: { type: "string" },
              tool_to_use: { type: ["string", "null"] },
              depends_on: { type: "array", items: { type: "integer" } },
            },
            required: ["step_number", "description", "tool_to_use", "depends_on"],
            additionalProperties: false,
          },
        },
        ready: { type: "boolean" },
      },
      required: ["plan", "steps", "ready"],
      additionalProperties: false,
    },
  },
} as const;

export class PlanningConfig {
  readonly reasoningEffort: ReasoningEffort;
  readonly reasoning_effort: ReasoningEffort;
  readonly observeSteps: boolean | null;
  readonly observe_steps: boolean | null;
  readonly maxAttempts: number | null;
  readonly max_attempts: number | null;
  readonly maxSteps: number;
  readonly max_steps: number;
  readonly systemPrompt: string | null;
  readonly system_prompt: string | null;
  readonly planPrompt: string | null;
  readonly plan_prompt: string | null;
  readonly refinePrompt: string | null;
  readonly refine_prompt: string | null;
  readonly maxReplans: number;
  readonly max_replans: number;
  readonly maxStepIterations: number;
  readonly max_step_iterations: number;
  readonly stepTimeout: number | null;
  readonly step_timeout: number | null;
  readonly llm: LLM | string | null;

  constructor(options: PlanningConfigOptions = {}) {
    this.reasoningEffort = normalizeReasoningEffort(options.reasoningEffort ?? options.reasoning_effort ?? "medium");
    this.reasoning_effort = this.reasoningEffort;
    this.observeSteps = options.observeSteps ?? options.observe_steps ?? null;
    this.observe_steps = this.observeSteps;
    this.maxAttempts = options.maxAttempts ?? options.max_attempts ?? null;
    this.max_attempts = this.maxAttempts;
    this.maxSteps = positiveInteger(options.maxSteps ?? options.max_steps ?? 20, "maxSteps");
    this.max_steps = this.maxSteps;
    this.systemPrompt = options.systemPrompt ?? options.system_prompt ?? null;
    this.system_prompt = this.systemPrompt;
    this.planPrompt = options.planPrompt ?? options.plan_prompt ?? null;
    this.plan_prompt = this.planPrompt;
    this.refinePrompt = options.refinePrompt ?? options.refine_prompt ?? null;
    this.refine_prompt = this.refinePrompt;
    this.maxReplans = nonNegativeInteger(options.maxReplans ?? options.max_replans ?? 3, "maxReplans");
    this.max_replans = this.maxReplans;
    this.maxStepIterations = positiveInteger(options.maxStepIterations ?? options.max_step_iterations ?? 15, "maxStepIterations");
    this.max_step_iterations = this.maxStepIterations;
    this.stepTimeout = options.stepTimeout ?? options.step_timeout ?? null;
    this.step_timeout = this.stepTimeout;
    this.llm = options.llm ?? null;
  }
}

export function createDefaultPlanningConfigForFlag(): PlanningConfig {
  return new PlanningConfig({
    reasoningEffort: "low",
    maxAttempts: 1,
  });
}

export function normalizePlanningConfig(
  config: PlanningConfig | PlanningConfigOptions | null | undefined,
): PlanningConfig | null {
  if (!config) {
    return null;
  }
  return config instanceof PlanningConfig ? config : new PlanningConfig(config);
}

export function createAgentPlanningPrompt(options: {
  role: string;
  goal: string;
  backstory: string;
  description: string;
  expectedOutput?: string | null;
  tools: string;
  config: PlanningConfig;
}): string {
  const values = {
    role: options.role,
    goal: options.goal,
    backstory: options.backstory,
    description: options.description,
    expected_output: options.expectedOutput ?? "Complete the task successfully",
    expectedOutput: options.expectedOutput ?? "Complete the task successfully",
    tools: options.tools,
    max_steps: String(options.config.maxSteps),
    maxSteps: String(options.config.maxSteps),
  };
  if (options.config.planPrompt) {
    return formatTemplate(options.config.planPrompt, values);
  }
  try {
    const prompt = I18N_DEFAULT.retrieve("planning", "create_plan_prompt");
    if (typeof prompt === "string") {
      return formatTemplate(prompt, values);
    }
  } catch {
    // Fall back to the compact built-in prompt below.
  }
  return [
    `Create a concise execution plan for this task as ${options.role}.`,
    `Goal: ${options.goal}`,
    `Backstory: ${options.backstory}`,
    `Task: ${options.description}`,
    `Expected output: ${options.expectedOutput ?? "Complete the task successfully"}`,
    `Available tools: ${options.tools}`,
    `Use at most ${String(options.config.maxSteps)} steps.`,
    "Return JSON with plan, optional steps, and ready. If returning text, include the plan directly.",
  ].join("\n");
}

export function createAgentRefinePlanningPrompt(options: {
  role: string;
  goal: string;
  backstory: string;
  currentPlan: string;
  current_plan?: string;
  config: PlanningConfig;
}): string {
  const currentPlan = options.currentPlan || options.current_plan || "";
  const values = {
    role: options.role,
    goal: options.goal,
    backstory: options.backstory,
    current_plan: currentPlan,
    currentPlan,
    max_steps: String(options.config.maxSteps),
    maxSteps: String(options.config.maxSteps),
  };
  if (options.config.refinePrompt) {
    return formatTemplate(options.config.refinePrompt, values);
  }
  return [
    "Refine this execution plan so it is ready to run.",
    `Role: ${options.role}`,
    `Goal: ${options.goal}`,
    `Current plan: ${currentPlan}`,
    `Use at most ${String(options.config.maxSteps)} steps.`,
    `End with '${REASONING_READY_MARKER}' when ready.`,
  ].join("\n");
}

export function createAgentPlanningSystemPrompt(options: {
  role: string;
  goal: string;
  backstory: string;
  config: PlanningConfig;
}): string {
  if (options.config.systemPrompt) {
    return formatTemplate(options.config.systemPrompt, {
      role: options.role,
      goal: options.goal,
      backstory: options.backstory,
    });
  }
  return `You are ${options.role}. Create practical plans that help execute the goal: ${options.goal}`;
}

export function parseAgentPlanningOutput(raw: string): AgentReasoningPlan {
  const parsed = tryParseJson(raw);
  if (isRecord(parsed)) {
    const nested = parsed.plan;
    if (isRecord(nested)) {
      return normalizeReasoningPlan(nested, raw);
    }
    if (typeof parsed.plan === "string") {
      return normalizeReasoningPlan(parsed, raw);
    }
  }
  return {
    plan: raw || "No plan was generated.",
    steps: [],
    ready: raw.includes(REASONING_READY_MARKER),
  };
}

export class AgentReasoning {
  readonly agent: unknown;
  readonly task: unknown;
  readonly config: PlanningConfig;
  readonly llm: LLM | string | null;
  readonly description: string;
  readonly expectedOutput: string;
  readonly expected_output: string;

  constructor(agentOrOptions: unknown, task: unknown = null, options: { description?: string | null; expectedOutput?: string | null; expected_output?: string | null } = {}) {
    const normalized: {
      agent: unknown;
      task?: unknown;
      description?: string | null;
      expectedOutput?: string | null;
      expected_output?: string | null;
    } = isRecord(agentOrOptions) && "agent" in agentOrOptions
      ? agentOrOptions as {
          agent: unknown;
          task?: unknown;
          description?: string | null;
          expectedOutput?: string | null;
          expected_output?: string | null;
        }
      : { agent: agentOrOptions, task, ...options };
    this.agent = normalized.agent;
    this.task = normalized.task ?? null;
    const agentRecord = isRecord(this.agent) ? this.agent : {};
    const taskRecord = isRecord(this.task) ? this.task : {};
    this.config = normalizePlanningConfig(agentRecord.planningConfig as PlanningConfig | PlanningConfigOptions | null | undefined)
      ?? normalizePlanningConfig(agentRecord.planning_config as PlanningConfig | PlanningConfigOptions | null | undefined)
      ?? new PlanningConfig({ maxAttempts: typeof agentRecord.max_reasoning_attempts === "number" ? agentRecord.max_reasoning_attempts : null });
    this.llm = this._resolve_llm();
    this.description = normalized.description
      ?? (typeof taskRecord.description === "string" ? taskRecord.description : "Complete the requested task");
    this.expectedOutput = normalized.expectedOutput
      ?? normalized.expected_output
      ?? (typeof taskRecord.expectedOutput === "string" ? taskRecord.expectedOutput : typeof taskRecord.expected_output === "string" ? taskRecord.expected_output : "Complete the task successfully");
    this.expected_output = this.expectedOutput;
  }

  _get_planning_config(): PlanningConfig {
    return this.config;
  }

  _resolve_llm(): LLM | string | null {
    if (this.config.llm !== null) {
      return this.config.llm;
    }
    const agentRecord = isRecord(this.agent) ? this.agent : {};
    return agentRecord.llm as LLM | string | null ?? null;
  }

  handleAgentReasoning(): AgentReasoningOutput | Promise<AgentReasoningOutput> {
    const taskId = this.taskId();
    this.emitReasoningStarted(1, taskId);
    try {
      const output = this._execute_planning();
      if (isPromiseLike(output)) {
        return Promise.resolve(output)
          .then((resolvedOutput) => {
            this.emitReasoningCompleted(resolvedOutput.plan.plan, resolvedOutput.plan.ready, 1, taskId);
            return resolvedOutput;
          })
          .catch((error: unknown) => {
            this.emitReasoningFailed(error, 1, taskId);
            throw error;
          });
      }
      this.emitReasoningCompleted(output.plan.plan, output.plan.ready, 1, taskId);
      return output;
    } catch (error) {
      this.emitReasoningFailed(error, 1, taskId);
      throw error;
    }
  }

  handle_agent_reasoning(): AgentReasoningOutput | Promise<AgentReasoningOutput> {
    return this.handleAgentReasoning();
  }

  _execute_planning(): AgentReasoningOutput | Promise<AgentReasoningOutput> {
    const created = this._create_initial_plan();
    if (isPromiseLike(created)) {
      return Promise.resolve(created).then(([plan, steps, ready]) => this.resolvePlanningOutput(plan, steps, ready));
    }
    return this.resolvePlanningOutput(created[0], created[1], created[2]);
  }

  _create_initial_plan(): [string, PlanStep[], boolean] | Promise<[string, PlanStep[], boolean]> {
    const planningPrompt = this._create_planning_prompt();
    if (this.llmSupportsFunctionCalling()) {
      return this._call_with_function(planningPrompt, "create_plan");
    }
    const response = this._call_llm_with_prompt(planningPrompt, "create_plan");
    if (isPromiseLike(response)) {
      return Promise.resolve(response).then((value) => {
        const [plan, ready] = AgentReasoning._parse_planning_response(value);
        return [plan, [], ready];
      });
    }
    const [plan, ready] = AgentReasoning._parse_planning_response(response);
    return [plan, [], ready];
  }

  _refine_plan_if_needed(
    plan: string,
    steps: PlanStep[],
    ready: boolean,
  ): [string, PlanStep[], boolean] | Promise<[string, PlanStep[], boolean]> {
    const maxAttempts = this.config.maxAttempts;
    if (ready || maxAttempts === 1) {
      return [plan, steps, ready];
    }
    return this.refinePlanLoop(plan, steps, ready, 1);
  }

  _call_with_function(
    prompt: string,
    planType: "create_plan" | "refine_plan",
  ): [string, PlanStep[], boolean] | Promise<[string, PlanStep[], boolean]> {
    void planType;
    const response = this.callPlanningLlm([
      { role: "system", content: this._get_system_prompt() },
      { role: "user", content: prompt },
    ], {
      tools: [FUNCTION_SCHEMA],
      available_functions: {
        create_reasoning_plan: (args: Record<string, unknown>) => JSON.stringify({
          plan: args.plan,
          steps: args.steps ?? [],
          ready: args.ready ?? true,
        }),
      },
      from_task: this.task,
      from_agent: this.agent,
    });
    if (isPromiseLike(response)) {
      return Promise.resolve(response).then((value) => this.parseFunctionPlanResponse(value));
    }
    return this.parseFunctionPlanResponse(response);
  }

  _call_llm_with_prompt(
    prompt: string,
    planType: "create_plan" | "refine_plan",
  ): MaybePromise<string> {
    void planType;
    const response = this.callPlanningLlm([
      { role: "system", content: this._get_system_prompt() },
      { role: "user", content: prompt },
    ], {
      from_task: this.task,
      from_agent: this.agent,
    });
    if (isPromiseLike(response)) {
      return Promise.resolve(response).then(String);
    }
    return String(response);
  }

  _get_system_prompt(): string {
    if (this.config.systemPrompt !== null) {
      return this.config.systemPrompt;
    }
    try {
      const prompt = I18N_DEFAULT.retrieve("planning", "system_prompt");
      if (typeof prompt === "string") {
        return prompt;
      }
    } catch {
      // Fall back to the legacy reasoning prompt below.
    }
    const fallbackPrompt = I18N_DEFAULT.retrieve("reasoning", "initial_plan");
    const fallback = typeof fallbackPrompt === "string" ? fallbackPrompt : "";
    return fallback
      .replaceAll("{role}", this.agentRole())
      .replaceAll("{goal}", this.agentGoal())
      .replaceAll("{backstory}", this._get_agent_backstory());
  }

  _get_agent_backstory(): string {
    const agentRecord = isRecord(this.agent) ? this.agent : {};
    return typeof agentRecord.backstory === "string" ? agentRecord.backstory : "No backstory provided";
  }

  _create_planning_prompt(): string {
    return createAgentPlanningPrompt({
      role: this.agentRole(),
      goal: this.agentGoal(),
      backstory: this._get_agent_backstory(),
      description: this.description,
      expectedOutput: this.expectedOutput,
      tools: this._format_available_tools(),
      config: this.config,
    });
  }

  _format_available_tools(): string {
    const taskRecord = isRecord(this.task) ? this.task : {};
    const agentRecord = isRecord(this.agent) ? this.agent : {};
    const taskTools = Array.isArray(taskRecord.tools) ? taskRecord.tools : [];
    const agentTools = Array.isArray(agentRecord.tools) ? agentRecord.tools : [];
    const tools = taskTools.length > 0 ? taskTools : agentTools;
    if (tools.length === 0) {
      return "No tools available";
    }
    return tools
      .map((tool) => isRecord(tool) && typeof tool.name === "string" ? sanitizeToolName(tool.name) : "")
      .filter(Boolean)
      .join(", ") || "No tools available";
  }

  _create_refine_prompt(currentPlan: string): string {
    return createAgentRefinePlanningPrompt({
      role: this.agentRole(),
      goal: this.agentGoal(),
      backstory: this._get_agent_backstory(),
      currentPlan,
      config: this.config,
    });
  }

  static _parse_planning_response(response: string): [string, boolean] {
    if (!response) {
      return ["No plan was generated.", false];
    }
    return [response, response.includes(REASONING_READY_MARKER)];
  }

  _parse_planning_response(response: string): [string, boolean] {
    return AgentReasoning._parse_planning_response(response);
  }

  private resolvePlanningOutput(
    plan: string,
    steps: PlanStep[],
    ready: boolean,
  ): AgentReasoningOutput | Promise<AgentReasoningOutput> {
    const refined = this._refine_plan_if_needed(plan, steps, ready);
    if (isPromiseLike(refined)) {
      return Promise.resolve(refined).then(([refinedPlan, refinedSteps, refinedReady]) => new AgentReasoningOutput({
        plan: new ReasoningPlan({ plan: refinedPlan, steps: refinedSteps, ready: refinedReady }),
      }));
    }
    return new AgentReasoningOutput({
      plan: new ReasoningPlan({ plan: refined[0], steps: refined[1], ready: refined[2] }),
    });
  }

  private refinePlanLoop(
    plan: string,
    steps: PlanStep[],
    ready: boolean,
    attempt: number,
  ): [string, PlanStep[], boolean] | Promise<[string, PlanStep[], boolean]> {
    const maxAttempts = this.config.maxAttempts;
    if (ready || (maxAttempts !== null && attempt >= maxAttempts)) {
      return [plan, steps, ready];
    }
    const nextAttempt = attempt + 1;
    const taskId = this.taskId();
    this.emitReasoningStarted(nextAttempt, taskId);
    const refinePrompt = this._create_refine_prompt(plan);
    const next = this.llmSupportsFunctionCalling()
      ? this._call_with_function(refinePrompt, "refine_plan")
      : this.textRefinePlan(refinePrompt);
    if (isPromiseLike(next)) {
      return Promise.resolve(next).then(([nextPlan, nextSteps, nextReady]) => {
        this.emitReasoningCompleted(nextPlan, nextReady, nextAttempt, taskId);
        return this.refinePlanLoop(nextPlan, nextSteps, nextReady, nextAttempt);
      });
    }
    this.emitReasoningCompleted(next[0], next[2], nextAttempt, taskId);
    return this.refinePlanLoop(next[0], next[1], next[2], nextAttempt);
  }

  private textRefinePlan(refinePrompt: string): [string, PlanStep[], boolean] | Promise<[string, PlanStep[], boolean]> {
    const response = this._call_llm_with_prompt(refinePrompt, "refine_plan");
    if (isPromiseLike(response)) {
      return Promise.resolve(response).then((value) => {
        const [plan, ready] = AgentReasoning._parse_planning_response(value);
        return [plan, [], ready];
      });
    }
    const [plan, ready] = AgentReasoning._parse_planning_response(response);
    return [plan, [], ready];
  }

  private parseFunctionPlanResponse(response: unknown): [string, PlanStep[], boolean] {
    const raw = typeof response === "string" ? response : JSON.stringify(response);
    const parsed = tryParseJson(raw);
    if (isRecord(parsed) && typeof parsed.plan === "string") {
      const rawSteps = Array.isArray(parsed.steps) ? parsed.steps : [];
      return [
        parsed.plan,
        rawSteps.map((step) => new PlanStep(normalizePlanStep(step))),
        typeof parsed.ready === "boolean" ? parsed.ready : raw.includes(REASONING_READY_MARKER),
      ];
    }
    return [raw, [], raw.includes(REASONING_READY_MARKER)];
  }

  private callPlanningLlm(messages: readonly LLMMessage[], options: Record<string, unknown>): MaybePromise<unknown> {
    const llm = this.llm;
    if (typeof llm === "function") {
      return llm(messages, options);
    }
    if (isRecord(llm) && typeof llm.call === "function") {
      return (llm as ReasoningLLM).call?.(messages, options);
    }
    throw new Error("Agent reasoning requires an LLM with a call method.");
  }

  private llmSupportsFunctionCalling(): boolean {
    const llm = this.llm;
    if (!isRecord(llm)) {
      return false;
    }
    const supports = (llm as ReasoningLLM).supportsFunctionCalling ?? (llm as ReasoningLLM).supports_function_calling;
    return typeof supports === "function" ? supports.call(llm) : false;
  }

  private agentRole(): string {
    const agentRecord = isRecord(this.agent) ? this.agent : {};
    return typeof agentRecord.role === "string" ? agentRecord.role : "";
  }

  private agentGoal(): string {
    const agentRecord = isRecord(this.agent) ? this.agent : {};
    return typeof agentRecord.goal === "string" ? agentRecord.goal : "";
  }

  private taskId(): string {
    const taskRecord = isRecord(this.task) ? this.task : {};
    const rawId = taskRecord.id;
    return typeof rawId === "string" || typeof rawId === "number" || typeof rawId === "boolean"
      ? String(rawId)
      : "kickoff";
  }

  private emitReasoningStarted(attempt: number, taskId: string): void {
    crewaiEventBus.emit(this.agent, new AgentReasoningStartedEvent({
      agentRole: this.agentRole(),
      taskId,
      attempt,
      fromTask: this.task,
    }));
  }

  private emitReasoningCompleted(plan: string, ready: boolean, attempt: number, taskId: string): void {
    crewaiEventBus.emit(this.agent, new AgentReasoningCompletedEvent({
      agentRole: this.agentRole(),
      taskId,
      plan,
      ready,
      attempt,
      fromTask: this.task,
      fromAgent: this.agent,
    }));
  }

  private emitReasoningFailed(error: unknown, attempt: number, taskId: string): void {
    crewaiEventBus.emit(this.agent, new AgentReasoningFailedEvent({
      agentRole: this.agentRole(),
      taskId,
      error,
      attempt,
      fromTask: this.task,
      fromAgent: this.agent,
    }));
  }
}

export const AgentPlanning = AgentReasoning;

function normalizeReasoningPlan(value: Record<string, unknown>, fallback: string): AgentReasoningPlan {
  const plan = typeof value.plan === "string" ? value.plan : fallback;
  const steps = Array.isArray(value.steps)
    ? value.steps.map((step) => normalizePlanStep(step))
    : [];
  return {
    plan,
    steps,
    ready: typeof value.ready === "boolean"
      ? value.ready
      : plan.includes(REASONING_READY_MARKER),
  };
}

function normalizePlanStep(value: unknown): AgentPlanStep {
  if (!isRecord(value)) {
    return { stepNumber: 0, description: String(value) };
  }
  const stepNumber = value.stepNumber ?? value.step_number ?? 0;
  const toolToUse = value.toolToUse ?? value.tool_to_use;
  const dependsOn = value.dependsOn ?? value.depends_on;
  return {
    stepNumber: typeof stepNumber === "number" ? stepNumber : Number(stepNumber) || 0,
    description: typeof value.description === "string" ? value.description : "",
    ...(typeof toolToUse === "string" || toolToUse === null ? { toolToUse } : {}),
    ...(Array.isArray(dependsOn) ? { dependsOn: dependsOn.map((item) => Number(item)).filter(Number.isFinite) } : {}),
  };
}

function formatTemplate(template: string, values: Record<string, string>): string {
  return template.replaceAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, key: string) => values[key] ?? match);
}

function normalizeReasoningEffort(value: string): ReasoningEffort {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  throw new Error("PlanningConfig reasoningEffort must be 'low', 'medium', or 'high'.");
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`PlanningConfig ${name} must be a positive integer.`);
  }
  return value;
}

function nonNegativeInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`PlanningConfig ${name} must be a non-negative integer.`);
  }
  return value;
}

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return Boolean(value)
    && (typeof value === "object" || typeof value === "function")
    && typeof (value as { then?: unknown }).then === "function";
}
