export class StepExecutionContext {
  readonly taskDescription: string;
  readonly task_description: string;
  readonly taskGoal: string;
  readonly task_goal: string;
  readonly dependencyResults: Readonly<Record<number, string>>;
  readonly dependency_results: Readonly<Record<number, string>>;

  constructor(options: {
    taskDescription?: string;
    task_description?: string;
    taskGoal?: string;
    task_goal?: string;
    dependencyResults?: Readonly<Record<number, string>>;
    dependency_results?: Readonly<Record<number, string>>;
  }) {
    this.taskDescription = options.taskDescription ?? options.task_description ?? "";
    this.task_description = this.taskDescription;
    this.taskGoal = options.taskGoal ?? options.task_goal ?? "";
    this.task_goal = this.taskGoal;
    this.dependencyResults = { ...(options.dependencyResults ?? options.dependency_results ?? {}) };
    this.dependency_results = this.dependencyResults;
  }

  getDependencyResult(stepNumber: number): string | null {
    return this.dependencyResults[stepNumber] ?? null;
  }

  get_dependency_result(stepNumber: number): string | null {
    return this.getDependencyResult(stepNumber);
  }
}

export class StepResult {
  readonly success: boolean;
  readonly result: string;
  readonly error: string | null;
  readonly toolCallsMade: readonly string[];
  readonly tool_calls_made: readonly string[];
  readonly executionTime: number;
  readonly execution_time: number;

  constructor(options: {
    success: boolean;
    result: string;
    error?: string | null;
    toolCallsMade?: readonly string[];
    tool_calls_made?: readonly string[];
    executionTime?: number;
    execution_time?: number;
  }) {
    this.success = options.success;
    this.result = options.result;
    this.error = options.error ?? null;
    this.toolCallsMade = options.toolCallsMade ?? options.tool_calls_made ?? [];
    this.tool_calls_made = this.toolCallsMade;
    this.executionTime = options.executionTime ?? options.execution_time ?? 0;
    this.execution_time = this.executionTime;
  }
}
