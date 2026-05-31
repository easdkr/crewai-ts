import type { LLM } from "./types.js";

export type ReasoningEffort = "low" | "medium" | "high";

export type PlanningConfigOptions = {
  reasoningEffort?: ReasoningEffort;
  observeSteps?: boolean | null;
  maxAttempts?: number | null;
  maxSteps?: number;
  systemPrompt?: string | null;
  planPrompt?: string | null;
  refinePrompt?: string | null;
  maxReplans?: number;
  maxStepIterations?: number;
  stepTimeout?: number | null;
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
  readonly observeSteps: boolean | null;
  readonly maxAttempts: number | null;
  readonly maxSteps: number;
  readonly systemPrompt: string | null;
  readonly planPrompt: string | null;
  readonly refinePrompt: string | null;
  readonly maxReplans: number;
  readonly maxStepIterations: number;
  readonly stepTimeout: number | null;
  readonly llm: LLM | string | null;

  constructor(options: PlanningConfigOptions = {}) {
    this.reasoningEffort = normalizeReasoningEffort(options.reasoningEffort ?? "medium");
    this.observeSteps = options.observeSteps ?? null;
    this.maxAttempts = options.maxAttempts ?? null;
    this.maxSteps = positiveInteger(options.maxSteps ?? 20, "maxSteps");
    this.systemPrompt = options.systemPrompt ?? null;
    this.planPrompt = options.planPrompt ?? null;
    this.refinePrompt = options.refinePrompt ?? null;
    this.maxReplans = nonNegativeInteger(options.maxReplans ?? 3, "maxReplans");
    this.maxStepIterations = positiveInteger(options.maxStepIterations ?? 15, "maxStepIterations");
    this.stepTimeout = options.stepTimeout ?? null;
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
    this.description = normalized.description
      ?? (typeof taskRecord.description === "string" ? taskRecord.description : "Complete the requested task");
    this.expectedOutput = normalized.expectedOutput
      ?? normalized.expected_output
      ?? (typeof taskRecord.expectedOutput === "string" ? taskRecord.expectedOutput : typeof taskRecord.expected_output === "string" ? taskRecord.expected_output : "Complete the task successfully");
    this.expected_output = this.expectedOutput;
  }

  handleAgentReasoning(): AgentReasoningOutput {
    const plan = new ReasoningPlan({
      plan: [
        `Task: ${this.description}`,
        `Expected output: ${this.expectedOutput}`,
      ].join("\n"),
      steps: [],
      ready: true,
    });
    return new AgentReasoningOutput({ plan });
  }

  handle_agent_reasoning(): AgentReasoningOutput {
    return this.handleAgentReasoning();
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
