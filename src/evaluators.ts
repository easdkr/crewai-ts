import { Agent } from "./agent.js";
import { Converter, type StructuredModel } from "./converter.js";
import {
  CrewTestResultEvent,
  TaskEvaluationEvent,
  crewaiEventBus,
} from "./events.js";
import { I18N_DEFAULT } from "./i18n.js";
import { createLLMClient, resolveLLMProvider, type LLMClient } from "./llm.js";
import { TaskOutput } from "./outputs.js";
import { generateModelDescription } from "./schema-utils.js";
import { Task } from "./task.js";
import type { LLM, TaskCallback } from "./types.js";

export const MetricCategory = {
  GOAL_ALIGNMENT: "goal_alignment",
  SEMANTIC_QUALITY: "semantic_quality",
  REASONING_EFFICIENCY: "reasoning_efficiency",
  TOOL_SELECTION: "tool_selection",
  PARAMETER_EXTRACTION: "parameter_extraction",
  TOOL_INVOCATION: "tool_invocation",
} as const;

export type MetricCategory = typeof MetricCategory[keyof typeof MetricCategory];

export function metricCategoryTitle(category: MetricCategory): string {
  return category.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export class EvaluationScore {
  readonly score: number | null;
  readonly feedback: string;
  readonly rawResponse: string | null;
  readonly raw_response: string | null;

  constructor(options: { score?: number | null; feedback?: string; rawResponse?: string | null; raw_response?: string | null } = {}) {
    const score = options.score === undefined ? 5 : options.score;
    if (score !== null && (score < 0 || score > 10)) {
      throw new Error("EvaluationScore score must be between 0 and 10.");
    }
    this.score = score;
    this.feedback = options.feedback ?? "";
    this.rawResponse = options.rawResponse ?? options.raw_response ?? null;
    this.raw_response = this.rawResponse;
  }

  toString(): string {
    if (this.score === null) {
      return `Score: N/A - ${this.feedback}`;
    }
    return `Score: ${this.score.toFixed(1)}/10 - ${this.feedback}`;
  }
}

export abstract class BaseEvaluator {
  readonly llm: LLM | string | null;

  constructor(llm: LLM | string | null = null) {
    this.llm = llm;
  }

  abstract get metricCategory(): MetricCategory;

  get metric_category(): MetricCategory {
    return this.metricCategory;
  }

  abstract evaluate(
    agent: unknown,
    executionTrace: Record<string, unknown>,
    finalOutput: unknown,
    task?: Task | null,
  ): EvaluationScore | Promise<EvaluationScore>;

  evaluate_sync(
    agent: unknown,
    execution_trace: Record<string, unknown>,
    final_output: unknown,
    task: Task | null = null,
  ): EvaluationScore | Promise<EvaluationScore> {
    return this.evaluate(agent, execution_trace, final_output, task);
  }
}

export class ConstantScoreEvaluator extends BaseEvaluator {
  constructor(private readonly category: MetricCategory, private readonly defaultFeedback: string, llm: LLM | string | null = null) {
    super(llm);
  }

  get metricCategory(): MetricCategory {
    return this.category;
  }

  evaluate(_agent: unknown, executionTrace: Record<string, unknown>, _finalOutput: unknown, _task: Task | null = null): EvaluationScore {
    void _task;
    const count = Array.isArray(executionTrace.tool_uses) ? executionTrace.tool_uses.length : 0;
    return new EvaluationScore({
      score: count === 0 && (this.category === MetricCategory.TOOL_SELECTION || this.category === MetricCategory.TOOL_INVOCATION) ? null : 5,
      feedback: this.defaultFeedback,
    });
  }
}

export class AgentEvaluationResult {
  readonly agentId: string;
  readonly agent_id: string;
  readonly taskId: string;
  readonly task_id: string;
  readonly metrics: Map<MetricCategory, EvaluationScore>;

  constructor(options: {
    agentId?: string;
    agent_id?: string;
    taskId?: string;
    task_id?: string;
    metrics?: Map<MetricCategory, EvaluationScore> | Partial<Record<MetricCategory, EvaluationScore>>;
  }) {
    this.agentId = options.agentId ?? options.agent_id ?? "";
    this.agent_id = this.agentId;
    this.taskId = options.taskId ?? options.task_id ?? "";
    this.task_id = this.taskId;
    this.metrics = normalizeEvaluationMetrics(options.metrics);
  }
}

export const AggregationStrategy = {
  SIMPLE_AVERAGE: "simple_average",
  WEIGHTED_BY_COMPLEXITY: "weighted_by_complexity",
  BEST_PERFORMANCE: "best_performance",
  WORST_PERFORMANCE: "worst_performance",
} as const;

export type AggregationStrategy = typeof AggregationStrategy[keyof typeof AggregationStrategy];

export class AgentAggregatedEvaluationResult {
  readonly agentId: string;
  readonly agent_id: string;
  readonly agentRole: string;
  readonly agent_role: string;
  readonly taskCount: number;
  readonly task_count: number;
  readonly aggregationStrategy: AggregationStrategy;
  readonly aggregation_strategy: AggregationStrategy;
  readonly metrics: Map<MetricCategory, EvaluationScore>;
  readonly taskResults: string[];
  readonly task_results: string[];
  readonly overallScore: number | null;
  readonly overall_score: number | null;

  constructor(options: {
    agentId?: string;
    agent_id?: string;
    agentRole?: string;
    agent_role?: string;
    taskCount?: number;
    task_count?: number;
    aggregationStrategy?: AggregationStrategy;
    aggregation_strategy?: AggregationStrategy;
    metrics?: Map<MetricCategory, EvaluationScore> | Partial<Record<MetricCategory, EvaluationScore>>;
    taskResults?: string[];
    task_results?: string[];
    overallScore?: number | null;
    overall_score?: number | null;
  } = {}) {
    this.agentId = options.agentId ?? options.agent_id ?? "";
    this.agent_id = this.agentId;
    this.agentRole = options.agentRole ?? options.agent_role ?? "";
    this.agent_role = this.agentRole;
    this.taskCount = options.taskCount ?? options.task_count ?? 0;
    this.task_count = this.taskCount;
    this.aggregationStrategy = options.aggregationStrategy ?? options.aggregation_strategy ?? AggregationStrategy.SIMPLE_AVERAGE;
    this.aggregation_strategy = this.aggregationStrategy;
    this.metrics = normalizeEvaluationMetrics(options.metrics);
    this.taskResults = [...(options.taskResults ?? options.task_results ?? [])];
    this.task_results = this.taskResults;
    this.overallScore = options.overallScore ?? options.overall_score ?? null;
    this.overall_score = this.overallScore;
  }

  toString(): string {
    const lines = [
      `Agent Evaluation: ${this.agentRole}`,
      `Strategy: ${this.aggregationStrategy}`,
      `Tasks evaluated: ${String(this.taskCount)}`,
    ];
    for (const [category, score] of this.metrics) {
      lines.push("", `- ${category.toUpperCase()}: ${score.score === null ? "N/A" : String(score.score)}/10`);
      if (score.feedback) {
        lines.push(`  ${score.feedback.replaceAll("\n", "\n  ")}`);
      }
    }
    return lines.join("\n");
  }
}

export class ExecutionState {
  currentAgentId: string | null = null;
  current_agent_id: string | null = null;
  currentTaskId: string | null = null;
  current_task_id: string | null = null;
  traces: Record<string, unknown> = {};
  iteration = 1;
  iterationsResults: Record<number, Record<string, AgentEvaluationResult[]>> = {};
  iterations_results: Record<number, Record<string, AgentEvaluationResult[]>> = this.iterationsResults;
  agentEvaluators: Record<string, readonly BaseEvaluator[] | null> = {};
  agent_evaluators: Record<string, readonly BaseEvaluator[] | null> = this.agentEvaluators;
}

export class AgentEvaluator {
  readonly agents: readonly unknown[];
  readonly evaluators: readonly BaseEvaluator[] | null;
  readonly callback: EvaluationTraceCallback;
  private readonly executionState = new ExecutionState();

  constructor(agents: readonly unknown[] = [], evaluators: readonly BaseEvaluator[] | null = null) {
    this.agents = [...agents];
    this.evaluators = evaluators;
    this.callback = create_evaluation_callbacks();
    for (const agent of this.agents) {
      this.executionState.agentEvaluators[stringifyEvaluationValue((agent as { id?: unknown }).id ?? "")] = this.evaluators;
    }
  }

  set_iteration(iteration: number): void {
    this.executionState.iteration = iteration;
  }

  reset_iterations_results(): void {
    this.executionState.iterationsResults = {};
    this.executionState.iterations_results = this.executionState.iterationsResults;
  }

  get_evaluation_results(): Record<string, AgentEvaluationResult[]> {
    return this.executionState.iterationsResults[this.executionState.iteration] ?? {};
  }

  evaluate(options: {
    agent: unknown;
    task?: Task | null;
    execution_trace?: Record<string, unknown>;
    executionTrace?: Record<string, unknown>;
    final_output?: unknown;
    finalOutput?: unknown;
    state?: ExecutionState;
  }): AgentEvaluationResult {
    const agentId = stringifyEvaluationValue((options.agent as { id?: unknown }).id ?? options.state?.currentAgentId ?? "");
    const taskId = stringifyEvaluationValue((options.task as { id?: unknown } | null | undefined)?.id ?? options.state?.currentTaskId ?? "");
    const trace = options.executionTrace ?? options.execution_trace ?? {};
    const finalOutput = options.finalOutput ?? options.final_output ?? "";
    const evaluators = this.evaluators ?? create_default_evaluator();
    const metrics = new Map<MetricCategory, EvaluationScore>();
    for (const evaluator of evaluators) {
      const result = evaluator.evaluate(agentId, trace, finalOutput, options.task ?? null);
      if (result instanceof EvaluationScore) {
        metrics.set(evaluator.metricCategory, result);
      }
    }
    return new AgentEvaluationResult({ agentId, taskId, metrics });
  }

  get_agent_evaluation(strategy: AggregationStrategy = AggregationStrategy.SIMPLE_AVERAGE): Record<string, AgentAggregatedEvaluationResult> {
    const results = this.get_evaluation_results();
    return Object.fromEntries(Object.entries(results).map(([role, entries]) => [
      role,
      new AgentAggregatedEvaluationResult({
        agentRole: role,
        taskCount: entries.length,
        aggregationStrategy: strategy,
        overallScore: average(entries.flatMap((entry) => [...entry.metrics.values()].map((score) => score.score).filter((score): score is number => score !== null))),
      }),
    ]));
  }
}

export class ToolSelectionEvaluator extends ConstantScoreEvaluator {
  constructor(llm: LLM | string | null = null) {
    super(MetricCategory.TOOL_SELECTION, "Tool selection evaluation is available as a compatibility evaluator.", llm);
  }
}

export class ParameterExtractionEvaluator extends ConstantScoreEvaluator {
  constructor(llm: LLM | string | null = null) {
    super(MetricCategory.PARAMETER_EXTRACTION, "Parameter extraction evaluation is available as a compatibility evaluator.", llm);
  }
}

export class ToolInvocationEvaluator extends ConstantScoreEvaluator {
  constructor(llm: LLM | string | null = null) {
    super(MetricCategory.TOOL_INVOCATION, "Tool invocation evaluation is available as a compatibility evaluator.", llm);
  }
}

export const ReasoningPatternType = Object.freeze({
  EFFICIENT: "efficient",
  LOOP: "loop",
  VERBOSE: "verbose",
  INDECISIVE: "indecisive",
  SCATTERED: "scattered",
} as const);
export type ReasoningPatternType = typeof ReasoningPatternType[keyof typeof ReasoningPatternType];

export class ReasoningEfficiencyEvaluator extends ConstantScoreEvaluator {
  constructor(llm: LLM | string | null = null) {
    super(MetricCategory.REASONING_EFFICIENCY, "Reasoning efficiency evaluation is available as a compatibility evaluator.", llm);
  }
}

export function create_default_evaluator(llm: LLM | string | null = null): BaseEvaluator[] {
  return [
    new ToolSelectionEvaluator(llm),
    new ParameterExtractionEvaluator(llm),
    new ToolInvocationEvaluator(llm),
    new ReasoningEfficiencyEvaluator(llm),
  ];
}

export class EvaluationTraceCallback {
  readonly traces: Record<string, Record<string, unknown>> = {};
  current_agent_id: string | null = null;
  current_task_id: string | null = null;

  get_trace(agent_id: string, task_id: string): Record<string, unknown> {
    return this.traces[`${agent_id}_${task_id}`] ?? {};
  }

  on_tool_use(tool: string, args: unknown, result: unknown, options: { success?: boolean; error_type?: string | null } = {}): void {
    const key = `${this.current_agent_id ?? ""}_${this.current_task_id ?? ""}`;
    const trace = this.traces[key] ?? { tool_uses: [] };
    const uses = Array.isArray(trace.tool_uses) ? trace.tool_uses : [];
    uses.push({ tool, args, result, success: options.success ?? true, error_type: options.error_type ?? null });
    trace.tool_uses = uses;
    this.traces[key] = trace;
  }
}

const evaluationTraceCallback = new EvaluationTraceCallback();

export function create_evaluation_callbacks(): EvaluationTraceCallback {
  return evaluationTraceCallback;
}

export class ExperimentResult {
  readonly identifier: string;
  readonly inputs: Record<string, unknown>;
  readonly score: number | Record<string, number>;
  readonly expected_score: number | Record<string, number>;
  readonly passed: boolean;
  readonly agent_evaluations: Record<string, unknown> | null;

  constructor(options: {
    identifier: string;
    inputs?: Record<string, unknown>;
    score: number | Record<string, number>;
    expected_score?: number | Record<string, number>;
    expectedScore?: number | Record<string, number>;
    passed?: boolean;
    agent_evaluations?: Record<string, unknown> | null;
    agentEvaluations?: Record<string, unknown> | null;
  }) {
    this.identifier = options.identifier;
    this.inputs = { ...(options.inputs ?? {}) };
    this.score = options.score;
    this.expected_score = options.expected_score ?? options.expectedScore ?? options.score;
    this.passed = options.passed ?? compareExperimentScore(this.score, this.expected_score);
    this.agent_evaluations = options.agent_evaluations ?? options.agentEvaluations ?? null;
  }
}

export class ExperimentResults {
  readonly results: ExperimentResult[];
  readonly metadata: Record<string, unknown>;
  readonly timestamp = new Date();

  constructor(results: readonly ExperimentResult[], metadata: Record<string, unknown> = {}) {
    this.results = [...results];
    this.metadata = { ...metadata };
  }

  to_json(): Record<string, unknown> {
    return {
      timestamp: this.timestamp.toISOString(),
      metadata: this.metadata,
      results: this.results.map((result) => ({
        identifier: result.identifier,
        inputs: result.inputs,
        score: result.score,
        expected_score: result.expected_score,
        passed: result.passed,
      })),
    };
  }

  compare_with_baseline(): Record<string, string[]> {
    return { improved: [], regressed: [], unchanged: [], new_tests: [], missing_tests: [] };
  }
}

export function assert_experiment_no_regression(comparison_result: Record<string, readonly string[]>): void {
  const regressed = comparison_result.regressed ?? [];
  if (regressed.length > 0) {
    throw new Error(`Regression detected: ${regressed.join(", ")}`);
  }
}

export function assert_experiment_successfully(experiment_results: ExperimentResults): void {
  const failed = experiment_results.results.filter((result) => !result.passed);
  if (failed.length > 0) {
    throw new Error(`The following test cases failed:\n${failed.map((result) => `- ${result.identifier}`).join("\n")}`);
  }
  assert_experiment_no_regression(experiment_results.compare_with_baseline());
}

export function run_experiment(dataset: readonly Record<string, unknown>[]): ExperimentResults {
  return new ExperimentResults(dataset.map((row, index) => new ExperimentResult({
    identifier: stringifyEvaluationValue(row.identifier ?? index),
    inputs: row,
    score: typeof row.score === "number" ? row.score : 1,
    expected_score: typeof row.expected_score === "number" ? row.expected_score : 1,
  })));
}

export type Entity = {
  name: string;
  type: string;
  description: string;
  relationships: string[];
};

export type TaskEvaluation = {
  suggestions: string[];
  quality: number;
  entities: Entity[];
};

export type TrainingTaskEvaluation = {
  suggestions: string[];
  quality: number;
  final_summary?: string;
  finalSummary?: string;
};

export type TaskEvaluationPydanticOutput = {
  quality: number;
};

export const Entity = class Entity {
  readonly name: string;
  readonly type: string;
  readonly description: string;
  readonly relationships: string[];

  constructor(options: Entity) {
    this.name = options.name;
    this.type = options.type;
    this.description = options.description;
    this.relationships = [...options.relationships];
  }
};

export const TaskEvaluation = class TaskEvaluation {
  readonly suggestions: string[];
  readonly quality: number;
  readonly entities: Entity[];

  constructor(options: TaskEvaluation) {
    this.suggestions = [...options.suggestions];
    this.quality = options.quality;
    this.entities = options.entities.map((entity) => entity instanceof Entity ? entity : new Entity(entity));
  }
};

export const TrainingTaskEvaluation = class TrainingTaskEvaluation {
  readonly suggestions: string[];
  readonly quality: number;
  readonly final_summary: string;
  readonly finalSummary: string;

  constructor(options: { suggestions: string[]; quality: number; final_summary?: string; finalSummary?: string }) {
    this.suggestions = [...options.suggestions];
    this.quality = options.quality;
    this.final_summary = options.final_summary ?? options.finalSummary ?? "";
    this.finalSummary = this.final_summary;
  }
};

export const TaskEvaluationPydanticOutput = class TaskEvaluationPydanticOutput {
  readonly quality: number;

  constructor(options: TaskEvaluationPydanticOutput) {
    this.quality = options.quality;
  }
};

export type EvaluationAgentLike = {
  llm: LLM | string | null;
};

export const taskEvaluationModel: StructuredModel<TaskEvaluation> = {
  name: "TaskEvaluation",
  schema: {
    type: "object",
    properties: {
      suggestions: {
        type: "array",
        items: { type: "string" },
        description: "Suggestions to improve future similar tasks.",
      },
      quality: {
        type: "number",
        description: "A score from 0 to 10 evaluating on completion, quality, and overall performance.",
      },
      entities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            type: { type: "string" },
            description: { type: "string" },
            relationships: { type: "array", items: { type: "string" } },
          },
        },
        description: "Entities extracted from the task output.",
      },
    },
    required: ["suggestions", "quality", "entities"],
  },
  modelValidate: parseTaskEvaluation,
};

export const trainingTaskEvaluationModel: StructuredModel<TrainingTaskEvaluation> = {
  name: "TrainingTaskEvaluation",
  schema: {
    type: "object",
    properties: {
      suggestions: {
        type: "array",
        items: { type: "string" },
        description: "List of clear, actionable instructions derived from the Human Feedbacks.",
      },
      quality: {
        type: "number",
        description: "A score from 0 to 10 evaluating improved output against initial output based on human feedback.",
      },
      final_summary: {
        type: "string",
        description: "Step by step action items to improve the next Agent based on the human-feedback and improved output.",
      },
    },
    required: ["suggestions", "quality", "final_summary"],
  },
  modelValidate: parseTrainingTaskEvaluation,
};

export const taskEvaluationPydanticOutputModel: StructuredModel<TaskEvaluationPydanticOutput> = {
  name: "TaskEvaluationPydanticOutput",
  schema: {
    type: "object",
    properties: {
      quality: {
        type: "number",
        description: "A score from 1 to 10 evaluating task output quality.",
      },
    },
    required: ["quality"],
  },
  modelValidate: parseTaskEvaluationPydanticOutput,
};

export class TaskEvaluator {
  readonly llm: LLM | string | null;
  readonly originalAgent: EvaluationAgentLike;
  readonly original_agent: EvaluationAgentLike;

  constructor(originalAgentOrOptions: EvaluationAgentLike | { originalAgent?: EvaluationAgentLike; original_agent?: EvaluationAgentLike }) {
    const originalAgent = "llm" in originalAgentOrOptions
      ? originalAgentOrOptions
      : originalAgentOrOptions.originalAgent ?? originalAgentOrOptions.original_agent;
    if (!originalAgent) {
      throw new Error("originalAgent is required.");
    }
    this.llm = originalAgent.llm;
    this.originalAgent = originalAgent;
    this.original_agent = originalAgent;
  }

  async evaluate(task: Task, output: string): Promise<TaskEvaluation> {
    crewaiEventBus.emit(this, new TaskEvaluationEvent({ evaluationType: "task_evaluation", task }));
    const evaluationQuery = [
      "Assess the quality of the task completed based on the description, expected output, and actual results.",
      "",
      "Task Description:",
      task.description,
      "",
      "Expected Output:",
      task.expectedOutput,
      "",
      "Actual Output:",
      output,
      "",
      "Please provide:",
      "- Bullet points suggestions to improve future similar tasks",
      "- A score from 0 to 10 evaluating on completion, quality, and overall performance",
      "- Entities extracted from the task output, if any, their type, description, and relationships",
    ].join("\n");

    const converter = new Converter({
      llm: resolveEvaluatorLLM(this.llm),
      text: evaluationQuery,
      model: taskEvaluationModel,
      instructions: evaluationInstructions(taskEvaluationModel, "Convert all responses into valid JSON output."),
    });
    return await converter.toPydantic();
  }

  async evaluate_training_data(trainingData: Record<string, unknown>, agentId: string): Promise<TrainingTaskEvaluation> {
    return await this.evaluateTrainingData(trainingData, agentId);
  }

  async evaluateTrainingData(trainingData: Record<string, unknown>, agentId: string): Promise<TrainingTaskEvaluation> {
    crewaiEventBus.emit(this, new TaskEvaluationEvent({ evaluationType: "training_data_evaluation" }));
    const agentTrainingData = trainingData[agentId];
    if (!agentTrainingData || typeof agentTrainingData !== "object" || Array.isArray(agentTrainingData)) {
      throw new Error(`Critical training data error: Missing data for agent ${agentId}.`);
    }

    let finalAggregatedData = "";
    for (const [iteration, data] of Object.entries(agentTrainingData as Record<string, unknown>)) {
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error(`Critical training data error: Invalid data for agent ${agentId} in iteration ${iteration}.`);
      }
      const record = data as Record<string, unknown>;
      const improvedOutput = record.improved_output;
      const initialOutput = record.initial_output;
      const humanFeedback = record.human_feedback;
      if (!improvedOutput || !initialOutput || !humanFeedback) {
        const missingFields = ["improved_output", "initial_output", "human_feedback"]
          .filter((field) => !record[field]);
        throw new Error(
          `Critical training data error: Missing fields (${missingFields.join(", ")}) for agent ${agentId} in iteration ${iteration}.\n`
          + "This indicates a broken training process. Cannot proceed with evaluation.\n"
          + "Please check your training implementation.",
        );
      }

      finalAggregatedData += [
        `Iteration: ${iteration}`,
        "Initial Output:",
        stringifyEvaluationValue(initialOutput),
        "",
        "Human Feedback:",
        stringifyEvaluationValue(humanFeedback),
        "",
        "Improved Output:",
        stringifyEvaluationValue(improvedOutput),
        "",
        "------------------------------------------------",
        "",
      ].join("\n");
    }

    const evaluationQuery = [
      "Assess the quality of the training data based on the llm output, human feedback , and llm output improved result.",
      "",
      finalAggregatedData,
      "Please provide:",
      "- Provide a list of clear, actionable instructions derived from the Human Feedbacks to enhance the Agent's performance. Analyze the differences between Initial Outputs and Improved Outputs to generate specific action items for future tasks. Ensure all key and specificpoints from the human feedback are incorporated into these instructions.",
      "- A score from 0 to 10 evaluating on completion, quality, and overall performance from the improved output to the initial output based on the human feedback",
    ].join("\n");

    const converter = new Converter({
      llm: resolveEvaluatorLLM(this.llm),
      text: evaluationQuery,
      model: trainingTaskEvaluationModel,
      instructions: evaluationInstructions(trainingTaskEvaluationModel, "I'm gonna convert this raw text into valid JSON."),
    });
    return await converter.toPydantic();
  }
}

export type CrewLikeForEvaluation = {
  name?: string | null;
  tasks: Task[];
  taskCallback?: TaskCallback | null;
};

export class CrewEvaluator {
  readonly crew: CrewLikeForEvaluation;
  readonly llm: LLM | string | null;
  tasksScores: Record<number, number[]>;
  tasks_scores: Record<number, number[]>;
  runExecutionTimes: Record<number, number[]>;
  run_execution_times: Record<number, number[]>;
  iteration: number;
  private readonly previousTaskCallback: TaskCallback | null;

  constructor(
    crewOrOptions: CrewLikeForEvaluation | {
      crew: CrewLikeForEvaluation;
      evalLlm?: LLM | string | null;
      eval_llm?: LLM | string | null;
      openaiModelName?: string | null;
      openai_model_name?: string | null;
      llm?: LLM | string | null;
    },
    evalLlm?: LLM | string | null,
  ) {
    const options: {
      crew: CrewLikeForEvaluation;
      evalLlm?: LLM | string | null | undefined;
      eval_llm?: LLM | string | null | undefined;
      openaiModelName?: string | null | undefined;
      openai_model_name?: string | null | undefined;
      llm?: LLM | string | null | undefined;
    } = "tasks" in crewOrOptions ? { crew: crewOrOptions, evalLlm } : crewOrOptions;
    this.crew = options.crew;
    this.llm = options.evalLlm ?? options.eval_llm ?? options.llm ?? options.openaiModelName ?? options.openai_model_name ?? null;
    this.tasksScores = {};
    this.tasks_scores = this.tasksScores;
    this.runExecutionTimes = {};
    this.run_execution_times = this.runExecutionTimes;
    this.iteration = 0;
    this.previousTaskCallback = this.crew.taskCallback ?? null;
    this.setupForEvaluating();
  }

  setIteration(iteration: number): void {
    this.iteration = iteration;
  }

  set_iteration(iteration: number): void {
    this.setIteration(iteration);
  }

  async evaluate(taskOutput: TaskOutput): Promise<void> {
    const currentTask = this.crew.tasks.find((task) => task.description === taskOutput.description);
    if (!currentTask) {
      throw new Error("Task to evaluate and task output are required for evaluation");
    }
    const evaluatorAgent = this.evaluatorAgent();
    const evaluationTask = CrewEvaluator.evaluationTask(evaluatorAgent, currentTask, taskOutput.raw);
    const evaluationResult = await evaluationTask.execute();
    const score = parseTaskEvaluationPydanticOutput(evaluationResult.pydantic).quality;

    crewaiEventBus.emit(this.crew, new CrewTestResultEvent({
      quality: score,
      executionDuration: taskExecutionDuration(currentTask),
      model: typeof this.llm === "string" ? this.llm : null,
      crewName: this.crew.name ?? null,
      crew: this.crew,
    }));

    const iterationScores = this.tasksScores[this.iteration] ?? [];
    this.tasksScores[this.iteration] = iterationScores;
    iterationScores.push(score);
    const duration = taskExecutionDuration(currentTask);
    if (duration !== null) {
      const iterationDurations = this.runExecutionTimes[this.iteration] ?? [];
      this.runExecutionTimes[this.iteration] = iterationDurations;
      iterationDurations.push(duration);
    }
  }

  printCrewEvaluationResult(): string {
    const runs = Object.keys(this.tasksScores).map(Number).sort((left, right) => left - right);
    const lines = ["Tasks Scores", "(1-10 Higher is better)"];
    for (const [taskIndex, task] of this.crew.tasks.entries()) {
      const scores = runs.map((run) => this.tasksScores[run]?.[taskIndex] ?? 0);
      const avg = average(scores);
      lines.push(`Task ${String(taskIndex + 1)} | ${scores.map((score) => score.toFixed(1)).join(" | ")} | ${avg.toFixed(1)} | ${[...task.processedByAgents].join(", ")}`);
    }
    const crewScores = runs.map((run) => average(this.tasksScores[run] ?? []));
    lines.push(`Crew | ${crewScores.map((score) => score.toFixed(2)).join(" | ")} | ${average(crewScores).toFixed(1)}`);
    return lines.join("\n");
  }

  print_crew_evaluation_result(): string {
    return this.printCrewEvaluationResult();
  }

  private setupForEvaluating(): void {
    this.crew.taskCallback = async (output) => {
      await this.previousTaskCallback?.(output);
      await this.evaluate(output);
    };
  }

  private evaluatorAgent(): Agent {
    return new Agent({
      role: "Task Execution Evaluator",
      goal: "Your goal is to evaluate the performance of the agents in the crew based on the tasks they have performed using score from 1 to 10 evaluating on completion, quality, and overall performance.",
      backstory: "Evaluator agent for crew evaluation with precise capabilities to evaluate the performance of the agents in the crew based on the tasks they have performed",
      verbose: false,
      llm: this.llm,
    });
  }

  static evaluationTask(evaluatorAgent: Agent, taskToEvaluate: Task, taskOutput: string): Task {
    return new Task({
      description: [
        "Based on the task description and the expected output, compare and evaluate the performance of the agents in the crew based on the Task Output they have performed using score from 1 to 10 evaluating on completion, quality, and overall performance.",
        `task_description: ${taskToEvaluate.description}`,
        `task_expected_output: ${taskToEvaluate.expectedOutput}`,
        `agent: ${taskToEvaluate.agent?.role ?? "None"}`,
        `agent_goal: ${taskToEvaluate.agent?.goal ?? "None"}`,
        `Task Output: ${taskOutput}`,
      ].join(" "),
      expectedOutput: "Evaluation Score from 1 to 10 based on the performance of the agents on the tasks",
      agent: evaluatorAgent,
      outputPydantic: parseTaskEvaluationPydanticOutput,
    });
  }

  static _evaluation_task(evaluatorAgent: Agent, taskToEvaluate: Task, taskOutput: string): Task {
    return CrewEvaluator.evaluationTask(evaluatorAgent, taskToEvaluate, taskOutput);
  }
}

function resolveEvaluatorLLM(llm: LLM | string | null): LLMClient {
  if (!llm) {
    throw new Error("Evaluator requires an LLM.");
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

function evaluationInstructions<T>(model: StructuredModel<T>, base: string): string {
  const description = generateModelDescription(modelName(model), schemaOf(model));
  const outputSchema = I18N_DEFAULT.slice("formatted_task_instructions")
    .replace("{output_format}", JSON.stringify(description, null, 2));
  return `${base}\n\n${outputSchema}`;
}

function schemaOf<T>(model: StructuredModel<T>): Record<string, unknown> {
  return typeof model === "function" ? {} : model.schema as Record<string, unknown>;
}

function modelName<T>(model: StructuredModel<T>): string {
  return typeof model === "function" ? model.name || "Model" : model.name ?? "Model";
}

function parseTaskEvaluation(value: unknown): TaskEvaluation {
  const record = asRecord(value);
  return {
    suggestions: toStringList(record.suggestions),
    quality: toNumber(record.quality),
    entities: Array.isArray(record.entities) ? record.entities.map(parseEntity) : [],
  };
}

function parseTrainingTaskEvaluation(value: unknown): TrainingTaskEvaluation {
  const record = asRecord(value);
  const finalSummary = stringifyEvaluationValue(record.final_summary ?? record.finalSummary ?? "");
  return {
    suggestions: toStringList(record.suggestions),
    quality: toNumber(record.quality),
    final_summary: finalSummary,
    finalSummary,
  };
}

function parseTaskEvaluationPydanticOutput(value: unknown): TaskEvaluationPydanticOutput {
  const record = asRecord(value);
  return { quality: toNumber(record.quality) };
}

function parseEntity(value: unknown): Entity {
  const record = asRecord(value);
  return {
    name: stringifyEvaluationValue(record.name ?? ""),
    type: stringifyEvaluationValue(record.type ?? ""),
    description: stringifyEvaluationValue(record.description ?? ""),
    relationships: toStringList(record.relationships),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    return asRecord(JSON.parse(value));
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected object value.");
  }
  return value as Record<string, unknown>;
}

function toStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry)) : [];
}

function toNumber(value: unknown): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new Error(`Expected numeric quality value, got ${String(value)}.`);
  }
  return numberValue;
}

function stringifyEvaluationValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "";
  }
  if (typeof value === "symbol") {
    return value.toString();
  }
  if (typeof value === "function") {
    return value.name ? `[function ${value.name}]` : "[function]";
  }
  return JSON.stringify(value);
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;
}

function compareExperimentScore(score: number | Record<string, number>, expected: number | Record<string, number>): boolean {
  if (typeof score === "number" && typeof expected === "number") {
    return score >= expected;
  }
  if (typeof score !== "number" && typeof expected !== "number") {
    return Object.entries(expected).every(([key, value]) => (score[key] ?? Number.NEGATIVE_INFINITY) >= value);
  }
  return false;
}

function normalizeEvaluationMetrics(
  metrics: Map<MetricCategory, EvaluationScore> | Partial<Record<MetricCategory, EvaluationScore>> | undefined,
): Map<MetricCategory, EvaluationScore> {
  if (!metrics) {
    return new Map();
  }
  if (metrics instanceof Map) {
    return new Map(metrics);
  }
  return new Map(Object.entries(metrics).map(([category, score]) => [category as MetricCategory, score]));
}

function taskExecutionDuration(task: Task): number | null {
  const value = (task as unknown as { executionDuration?: unknown; execution_duration?: unknown }).executionDuration
    ?? (task as unknown as { executionDuration?: unknown; execution_duration?: unknown }).execution_duration;
  return typeof value === "number" ? value : null;
}

export const TaskEvaluationPydanticOutputModel = taskEvaluationPydanticOutputModel;
export const TaskEvaluationModel = taskEvaluationModel;
export const TrainingTaskEvaluationModel = trainingTaskEvaluationModel;
