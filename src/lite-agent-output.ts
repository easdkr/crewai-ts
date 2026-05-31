import type { UsageMetrics } from "./llm.js";
import type { LLMMessage } from "./types.js";

export type TodoExecutionResultOptions = {
  stepNumber?: number;
  step_number?: number;
  description: string;
  toolUsed?: string | null;
  tool_used?: string | null;
  status: string;
  result?: string | null;
  dependsOn?: readonly number[];
  depends_on?: readonly number[];
};

export class TodoExecutionResult {
  readonly stepNumber: number;
  readonly step_number: number;
  readonly description: string;
  readonly toolUsed: string | null;
  readonly tool_used: string | null;
  readonly status: string;
  readonly result: string | null;
  readonly dependsOn: readonly number[];
  readonly depends_on: readonly number[];

  constructor(options: TodoExecutionResultOptions) {
    this.stepNumber = options.stepNumber ?? options.step_number ?? 0;
    this.step_number = this.stepNumber;
    this.description = options.description;
    this.toolUsed = options.toolUsed ?? options.tool_used ?? null;
    this.tool_used = this.toolUsed;
    this.status = options.status;
    this.result = options.result ?? null;
    this.dependsOn = [...(options.dependsOn ?? options.depends_on ?? [])];
    this.depends_on = this.dependsOn;
  }
}

export type LiteAgentOutputOptions = {
  raw?: string;
  pydantic?: unknown;
  agentRole?: string;
  agent_role?: string;
  usageMetrics?: UsageMetrics | null;
  usage_metrics?: UsageMetrics | null;
  messages?: readonly LLMMessage[];
  plan?: string | null;
  todos?: readonly (TodoExecutionResult | TodoExecutionResultOptions)[];
  replanCount?: number;
  replan_count?: number;
  lastReplanReason?: string | null;
  last_replan_reason?: string | null;
};

export class LiteAgentOutput {
  readonly raw: string;
  readonly pydantic: unknown;
  readonly agentRole: string;
  readonly agent_role: string;
  readonly usageMetrics: UsageMetrics | null;
  readonly usage_metrics: UsageMetrics | null;
  readonly messages: readonly LLMMessage[];
  readonly plan: string | null;
  readonly todos: readonly TodoExecutionResult[];
  readonly replanCount: number;
  readonly replan_count: number;
  readonly lastReplanReason: string | null;
  readonly last_replan_reason: string | null;

  constructor(options: LiteAgentOutputOptions) {
    this.raw = options.raw ?? "";
    this.pydantic = options.pydantic ?? null;
    this.agentRole = options.agentRole ?? options.agent_role ?? "";
    this.agent_role = this.agentRole;
    this.usageMetrics = options.usageMetrics ?? options.usage_metrics ?? null;
    this.usage_metrics = this.usageMetrics;
    this.messages = [...(options.messages ?? [])];
    this.plan = options.plan ?? null;
    this.todos = (options.todos ?? []).map((todo) => todo instanceof TodoExecutionResult
      ? todo
      : new TodoExecutionResult(todo));
    this.replanCount = options.replanCount ?? options.replan_count ?? 0;
    this.replan_count = this.replanCount;
    this.lastReplanReason = options.lastReplanReason ?? options.last_replan_reason ?? null;
    this.last_replan_reason = this.lastReplanReason;
  }

  static fromTodoItems(items: readonly TodoExecutionResultOptions[]): TodoExecutionResult[] {
    return items.map((item) => new TodoExecutionResult(item));
  }

  static from_todo_items(items: readonly TodoExecutionResultOptions[]): TodoExecutionResult[] {
    return LiteAgentOutput.fromTodoItems(items);
  }

  toDict(): Record<string, unknown> {
    if (this.pydantic && typeof this.pydantic === "object") {
      return { ...(this.pydantic as Record<string, unknown>) };
    }
    return {};
  }

  to_dict(): Record<string, unknown> {
    return this.toDict();
  }

  get completedTodos(): readonly TodoExecutionResult[] {
    return this.todos.filter((todo) => todo.status === "completed");
  }

  get completed_todos(): readonly TodoExecutionResult[] {
    return this.completedTodos;
  }

  get failedTodos(): readonly TodoExecutionResult[] {
    return this.todos.filter((todo) => todo.status === "failed");
  }

  get failed_todos(): readonly TodoExecutionResult[] {
    return this.failedTodos;
  }

  get hadPlan(): boolean {
    return this.plan !== null || this.todos.length > 0;
  }

  get had_plan(): boolean {
    return this.hadPlan;
  }

  toString(): string {
    return this.raw;
  }

  __str__(): string {
    return this.toString();
  }
}
