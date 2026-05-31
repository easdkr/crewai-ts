import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";

import { Agent } from "./agent.js";
import { Converter, type StructuredModel } from "./converter.js";
import {
  AgentEvaluationCompletedEvent,
  AgentEvaluationFailedEvent,
  AgentEvaluationStartedEvent,
  CrewTestResultEvent,
  TaskEvaluationEvent,
  crewaiEventBus,
  type EventBus,
} from "./events.js";
import { I18N_DEFAULT } from "./i18n.js";
import { createLLMClient, resolveLLMProvider, type LLMClient } from "./llm.js";
import { TaskOutput } from "./outputs.js";
import { generateModelDescription } from "./schema-utils.js";
import { Task } from "./task.js";
import type { LLM, LLMMessage, TaskCallback } from "./types.js";

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

  __str__(): string {
    return this.toString();
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

  __str__(): string {
    return this.toString();
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
    const agentRole = stringifyEvaluationValue((options.agent as { role?: unknown }).role ?? "");
    for (const evaluator of evaluators) {
      try {
        this.emit_evaluation_started_event(agentRole, agentId, taskId);
        const result = evaluator.evaluate(options.agent, trace, finalOutput, options.task ?? null);
        if (result instanceof EvaluationScore) {
          metrics.set(evaluator.metricCategory, result);
          this.emit_evaluation_completed_event(agentRole, agentId, taskId, evaluator.metricCategory, result);
        }
      } catch (error) {
        this.emit_evaluation_failed_event(agentRole, agentId, error, taskId);
      }
    }
    return new AgentEvaluationResult({ agentId, taskId, metrics });
  }

  get_agent_evaluation(strategy: AggregationStrategy = AggregationStrategy.SIMPLE_AVERAGE): Record<string, AgentAggregatedEvaluationResult> {
    const results = this.get_evaluation_results();
    const formatter = new EvaluationDisplayFormatter();
    return Object.fromEntries(Object.entries(results).map(([role, entries]) => [
      role,
      formatter.aggregateAgentResults({
        agentId: entries[0]?.agentId ?? "",
        agentRole: role,
        results: entries,
        strategy,
      }),
    ]));
  }

  display_results_with_iterations(): string {
    return new EvaluationDisplayFormatter().display_summary_results(this.executionState.iterationsResults);
  }

  display_evaluation_with_feedback(): string {
    return new EvaluationDisplayFormatter().display_evaluation_with_feedback(this.executionState.iterationsResults);
  }

  emit_evaluation_started_event(agent_role: string, agent_id: string, task_id: string | null = null): void {
    crewaiEventBus.emit(this, new AgentEvaluationStartedEvent({
      agent_role,
      agent_id,
      task_id,
      iteration: this.executionState.iteration,
    }));
  }

  emit_evaluation_completed_event(
    agent_role: string,
    agent_id: string,
    task_id: string | null = null,
    metric_category: MetricCategory | null = null,
    score: EvaluationScore | null = null,
  ): void {
    crewaiEventBus.emit(this, new AgentEvaluationCompletedEvent({
      agent_role,
      agent_id,
      task_id,
      iteration: this.executionState.iteration,
      metric_category,
      score,
    }));
  }

  emit_evaluation_failed_event(agent_role: string, agent_id: string, error: unknown, task_id: string | null = null): void {
    crewaiEventBus.emit(this, new AgentEvaluationFailedEvent({
      agent_role,
      agent_id,
      task_id,
      iteration: this.executionState.iteration,
      error,
    }));
  }
}

export class ToolSelectionEvaluator extends BaseEvaluator {
  constructor(llm: LLM | string | null = null) {
    super(llm);
  }

  get metricCategory(): MetricCategory {
    return MetricCategory.TOOL_SELECTION;
  }

  evaluate(
    agent: unknown,
    executionTrace: Record<string, unknown>,
    _finalOutput: unknown,
    task: Task | null = null,
  ): EvaluationScore | Promise<EvaluationScore> {
    void _finalOutput;
    const agentRecord = asRecord(agent);
    const tools = getEvaluatorAgentTools(agentRecord);
    const toolUses = getTraceArray(executionTrace.tool_uses);
    if (toolUses.length === 0) {
      return new EvaluationScore({
        score: null,
        feedback: tools.length === 0 ? "Agent had no tools available to use." : "Agent had tools available but didn't use any.",
      });
    }

    const availableToolsInfo = tools.length > 0
      ? tools.map((tool) => `- ${sanitizeEvaluatorToolName(tool.name)}: ${tool.description}`).join("\n")
      : "No tools available";
    const selectedTools = [...new Set(toolUses.map((toolUse) => stringifyEvaluationValue(asNullableRecord(toolUse)?.tool ?? "Unknown tool")))].sort();
    const prompt: LLMMessage[] = [
      {
        role: "system",
        content: `You are an expert evaluator assessing if an AI agent selected the most appropriate tools for a given task.

Evaluate based only on tool selection from available tools. Return JSON with fields scores, overall_score, feedback, and improvement_suggestions.`,
      },
      {
        role: "user",
        content: `
Agent role: ${stringifyEvaluationValue(agentRecord.role ?? "")}
${task ? `Task description: ${task.description}` : ""}

Available tools for this agent:
${availableToolsInfo}

Tools selected by the agent:
${selectedTools.map((tool) => `- ${tool}`).join("\n")}

Based only on the task description and available tools, evaluate if the agent selected the appropriate tool types.`,
      },
    ];
    const response = callEvaluatorLLM(this.llm, prompt);
    if (isPromiseLike(response)) {
      return Promise.resolve(response).then((value) => parseDetailedEvaluatorScore(value, {
        title: "Tool Selection Evaluation",
        fields: [
          ["relevance", "Relevance", "Selection of appropriate tool types for the task"],
          ["coverage", "Coverage", "Selection of all necessary tool types"],
        ],
      }));
    }
    return parseDetailedEvaluatorScore(response, {
      title: "Tool Selection Evaluation",
      fields: [
        ["relevance", "Relevance", "Selection of appropriate tool types for the task"],
        ["coverage", "Coverage", "Selection of all necessary tool types"],
      ],
    });
  }
}

export class ParameterExtractionEvaluator extends BaseEvaluator {
  constructor(llm: LLM | string | null = null) {
    super(llm);
  }

  get metricCategory(): MetricCategory {
    return MetricCategory.PARAMETER_EXTRACTION;
  }

  evaluate(
    agent: unknown,
    executionTrace: Record<string, unknown>,
    _finalOutput: unknown,
    task: Task | null = null,
  ): EvaluationScore | Promise<EvaluationScore> {
    void _finalOutput;
    const agentRecord = asRecord(agent);
    const toolUses = getTraceArray(executionTrace.tool_uses);
    if (toolUses.length === 0) {
      return new EvaluationScore({ score: null, feedback: "No tool usage detected. Cannot evaluate parameter extraction." });
    }
    const validationErrors = toolUses
      .map((toolUse) => asNullableRecord(toolUse) ?? {})
      .filter((toolUse) => toolUse.success === false && toolUse.error_type === "validation_error");
    const samples = toolUses.slice(0, 5).map((toolUse, index) => {
      const record = asNullableRecord(toolUse) ?? {};
      const success = record.success !== false && record.error !== true;
      const isValidationError = !success && record.error_type === "validation_error";
      return [
        `Tool use #${String(index + 1)} - ${stringifyEvaluationValue(record.tool ?? "Unknown tool")}:`,
        `- Parameters: ${formatEvaluatorJson(record.args ?? {})}`,
        `- Success: ${success ? "Yes" : "No"}${isValidationError ? " (PARAMETER VALIDATION ERROR)" : ""}`,
        isValidationError ? `- Error: ${stringifyEvaluationValue(record.result ?? "Unknown error")}` : "",
      ].filter(Boolean).join("\n");
    }).join("\n\n");
    const validationInfo = validationErrors.length > 0
      ? `\nParameter validation errors detected: ${String(validationErrors.length)} (${formatPercent(validationErrors.length / toolUses.length)} of tool uses)`
      : "";
    const prompt: LLMMessage[] = [
      {
        role: "system",
        content: `You are an expert evaluator assessing how well an AI agent extracts and formats parameter values for tool calls.

Return JSON with fields scores, overall_score, feedback, and improvement_suggestions.`,
      },
      {
        role: "user",
        content: `
Agent role: ${stringifyEvaluationValue(agentRecord.role ?? "")}
${task ? `Task description: ${task.description}` : ""}

Parameter extraction examples:
${samples}
${validationInfo}

Evaluate the quality of the agent's parameter extraction for this task.`,
      },
    ];
    const response = callEvaluatorLLM(this.llm, prompt);
    const config = {
      title: "Parameter Extraction Evaluation",
      fields: [
        ["accuracy", "Accuracy", "Correctly identifying required parameters"],
        ["formatting", "Formatting", "Properly formatting parameters for tools"],
        ["completeness", "Completeness", "Including all necessary information"],
      ] as const,
    };
    return isPromiseLike(response) ? Promise.resolve(response).then((value) => parseDetailedEvaluatorScore(value, config)) : parseDetailedEvaluatorScore(response, config);
  }
}

export class ToolInvocationEvaluator extends BaseEvaluator {
  constructor(llm: LLM | string | null = null) {
    super(llm);
  }

  get metricCategory(): MetricCategory {
    return MetricCategory.TOOL_INVOCATION;
  }

  evaluate(
    agent: unknown,
    executionTrace: Record<string, unknown>,
    _finalOutput: unknown,
    task: Task | null = null,
  ): EvaluationScore | Promise<EvaluationScore> {
    void _finalOutput;
    const agentRecord = asRecord(agent);
    const toolUses = getTraceArray(executionTrace.tool_uses);
    if (toolUses.length === 0) {
      return new EvaluationScore({ score: null, feedback: "No tool usage detected. Cannot evaluate tool invocation." });
    }
    const toolErrors = toolUses.map((toolUse) => asNullableRecord(toolUse) ?? {}).filter((toolUse) => toolUse.success === false || toolUse.error === true);
    const errorTypes = new Map<string, number>();
    for (const error of toolErrors) {
      const type = stringifyEvaluationValue(error.error_type ?? "unknown_error");
      errorTypes.set(type, (errorTypes.get(type) ?? 0) + 1);
    }
    const samples = toolUses.slice(0, 5).map((toolUse, index) => {
      const record = asNullableRecord(toolUse) ?? {};
      const success = record.success !== false && record.error !== true;
      return [
        `Tool invocation #${String(index + 1)}:`,
        `- Tool: ${stringifyEvaluationValue(record.tool ?? "Unknown tool")}`,
        `- Parameters: ${formatEvaluatorJson(record.args ?? {})}`,
        `- Success: ${success ? "Yes" : "No"}`,
        success ? "" : `- Error type: ${stringifyEvaluationValue(record.error_type ?? "")}`,
        success ? "" : `- Error: ${stringifyEvaluationValue(record.result ?? "No error")}`,
      ].filter(Boolean).join("\n");
    }).join("\n\n");
    const errorSummary = [...errorTypes.entries()].map(([type, count]) => `- ${type}: ${String(count)} occurrences (${formatPercent(count / toolUses.length)})`).join("\n");
    const prompt: LLMMessage[] = [
      {
        role: "system",
        content: `You are an expert evaluator assessing how correctly an AI agent's tool invocations are structured.

Return JSON with fields scores, overall_score, feedback, and improvement_suggestions.`,
      },
      {
        role: "user",
        content: `
Agent role: ${stringifyEvaluationValue(agentRecord.role ?? "")}
${task ? `Task description: ${task.description}` : ""}

Tool invocation examples:
${samples}

Tool error rate: ${formatPercent(toolErrors.length / toolUses.length)} (${String(toolErrors.length)} errors out of ${String(toolUses.length)} invocations)
${errorSummary ? `Error type breakdown:\n${errorSummary}` : ""}

Evaluate the quality of the agent's tool invocation structure during this task.`,
      },
    ];
    const response = callEvaluatorLLM(this.llm, prompt);
    const config = {
      title: "Tool Invocation Evaluation",
      fields: [
        ["structure", "Structure", "Following proper syntax and format"],
        ["error_handling", "Error Handling", "Appropriately handling tool errors"],
        ["invocation_patterns", "Invocation Patterns", "Proper sequencing and management of calls"],
      ] as const,
    };
    return isPromiseLike(response) ? Promise.resolve(response).then((value) => parseDetailedEvaluatorScore(value, config)) : parseDetailedEvaluatorScore(response, config);
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

export class ReasoningEfficiencyEvaluator extends BaseEvaluator {
  constructor(llm: LLM | string | null = null) {
    super(llm);
  }

  get metricCategory(): MetricCategory {
    return MetricCategory.REASONING_EFFICIENCY;
  }

  evaluate(
    agent: unknown,
    executionTrace: Record<string, unknown>,
    finalOutput: unknown,
    task: Task | null = null,
  ): EvaluationScore | Promise<EvaluationScore> {
    const agentRecord = asRecord(agent);
    const llmCalls = getTraceArray(executionTrace.llm_calls);
    if (llmCalls.length < 2) {
      return new EvaluationScore({ score: null, feedback: "Insufficient LLM calls to evaluate reasoning efficiency." });
    }
    const totalTokens = llmCalls.reduce<number>((total, call) => total + toNumberOrZero((asNullableRecord(call) ?? {}).total_tokens), 0);
    const loopDetected = detectReasoningLoops(llmCalls);
    const pattern = analyzeReasoningPattern(llmCalls);
    const prompt: LLMMessage[] = [
      {
        role: "system",
        content: `You are an expert evaluator assessing the reasoning efficiency of an AI agent's thought process.

Return JSON with overall_score, scores, feedback, optimization_suggestions, and detected_patterns.`,
      },
      {
        role: "user",
        content: `
Agent role: ${stringifyEvaluationValue(agentRecord.role ?? "")}
${task ? `Task description: ${task.description}\nExpected output: ${task.expectedOutput}` : ""}

Reasoning efficiency metrics:
- Total LLM calls: ${String(llmCalls.length)}
- Average tokens per call: ${(totalTokens / llmCalls.length).toFixed(1)}
- Primary reasoning pattern: ${pattern}
- ${loopDetected ? "Detected potential reasoning loops." : "No significant reasoning loops detected."}

Sample of agent reasoning flow (chronological sequence):
${getReasoningCallSamples(llmCalls)}

Agent's final output:
${stringifyEvaluationValue(finalOutput).slice(0, 500)}... (truncated)

Evaluate the reasoning efficiency of this agent based on these interaction patterns.`,
      },
    ];
    const response = callEvaluatorLLM(this.llm, prompt);
    const config = {
      title: "Reasoning Efficiency Evaluation",
      fields: [
        ["focus", "Focus", "Staying on topic without tangents"],
        ["progression", "Progression", "Building on previous thinking"],
        ["decision_quality", "Decision Quality", "Making appropriate decisions"],
        ["conciseness", "Conciseness", "Communicating efficiently"],
        ["loop_avoidance", "Loop Avoidance", "Avoiding repetitive patterns"],
      ] as const,
      fallbackTextKey: "optimization_suggestions",
      feedbackPrefix: "Feedback",
    };
    return isPromiseLike(response) ? Promise.resolve(response).then((value) => parseDetailedEvaluatorScore(value, config)) : parseDetailedEvaluatorScore(response, config);
  }
}

export class GoalAlignmentEvaluator extends BaseEvaluator {
  get metricCategory(): MetricCategory {
    return MetricCategory.GOAL_ALIGNMENT;
  }

  evaluate(
    agent: unknown,
    _executionTrace: Record<string, unknown>,
    finalOutput: unknown,
    task: Task | null = null,
  ): EvaluationScore | Promise<EvaluationScore> {
    const agentRecord = asRecord(agent);
    const taskContext = task
      ? `Task description: ${task.description}\nExpected output: ${task.expectedOutput}\n`
      : "";
    const prompt: LLMMessage[] = [
      {
        role: "system",
        content: `You are an expert evaluator assessing how well an AI agent's output aligns with its assigned task goal.

Score the agent's goal alignment on a scale from 0-10 where:
- 0: Complete misalignment, agent did not understand or attempt the task goal
- 5: Partial alignment, agent attempted the task but missed key requirements
- 10: Perfect alignment, agent fully satisfied all task requirements

Consider:
1. Did the agent correctly interpret the task goal?
2. Did the final output directly address the requirements?
3. Did the agent focus on relevant aspects of the task?
4. Did the agent provide all requested information or deliverables?

Return your evaluation as JSON with fields 'score' (number) and 'feedback' (string).`,
      },
      {
        role: "user",
        content: `
Agent role: ${stringifyEvaluationValue(agentRecord.role ?? "")}
Agent goal: ${stringifyEvaluationValue(agentRecord.goal ?? "")}
${taskContext}

Agent's final output:
${stringifyEvaluationValue(finalOutput)}

Evaluate how well the agent's output aligns with the assigned task goal.`,
      },
    ];
    const response = callEvaluatorLLM(this.llm, prompt);
    if (isPromiseLike(response)) {
      return Promise.resolve(response).then((value) => parseEvaluatorScore(value));
    }
    return parseEvaluatorScore(response);
  }
}

export class SemanticQualityEvaluator extends BaseEvaluator {
  get metricCategory(): MetricCategory {
    return MetricCategory.SEMANTIC_QUALITY;
  }

  evaluate(
    agent: unknown,
    _executionTrace: Record<string, unknown>,
    finalOutput: unknown,
    task: Task | null = null,
  ): EvaluationScore | Promise<EvaluationScore> {
    const agentRecord = asRecord(agent);
    const taskContext = task ? `Task description: ${task.description}` : "";
    const prompt: LLMMessage[] = [
      {
        role: "system",
        content: `You are an expert evaluator assessing the semantic quality of an AI agent's output.

Score the semantic quality on a scale from 0-10 where:
- 0: Completely incoherent, confusing, or logically flawed output
- 5: Moderately clear and logical output with some issues
- 10: Exceptionally clear, coherent, and logically sound output

Consider:
1. Is the output well-structured and organized?
2. Is the reasoning logical and well-supported?
3. Is the language clear, precise, and appropriate for the task?
4. Are claims supported by evidence when appropriate?
5. Is the output free from contradictions and logical fallacies?

Return your evaluation as JSON with fields 'score' (number) and 'feedback' (string).`,
      },
      {
        role: "user",
        content: `
Agent role: ${stringifyEvaluationValue(agentRecord.role ?? "")}
${taskContext}

Agent's final output:
${stringifyEvaluationValue(finalOutput)}

Evaluate the semantic quality and reasoning of this output.`,
      },
    ];
    const response = callEvaluatorLLM(this.llm, prompt);
    if (isPromiseLike(response)) {
      return Promise.resolve(response).then((value) => parseEvaluatorScore(value));
    }
    return parseEvaluatorScore(response);
  }
}

export function create_default_evaluator(llm: LLM | string | null = null): BaseEvaluator[] {
  return [
    new GoalAlignmentEvaluator(llm),
    new SemanticQualityEvaluator(llm),
    new ToolSelectionEvaluator(llm),
    new ParameterExtractionEvaluator(llm),
    new ToolInvocationEvaluator(llm),
    new ReasoningEfficiencyEvaluator(llm),
  ];
}

export class EvaluationDisplayFormatter {
  aggregateAgentResults(options: {
    agentId?: string;
    agent_id?: string;
    agentRole?: string;
    agent_role?: string;
    results: readonly AgentEvaluationResult[];
    strategy?: AggregationStrategy;
  }): AgentAggregatedEvaluationResult {
    return this._aggregate_agent_results(
      options.agentId ?? options.agent_id ?? "",
      options.agentRole ?? options.agent_role ?? "",
      options.results,
      options.strategy ?? AggregationStrategy.SIMPLE_AVERAGE,
    );
  }

  _aggregate_agent_results(
    agentId: string,
    agentRole: string,
    results: readonly AgentEvaluationResult[],
    strategy: AggregationStrategy = AggregationStrategy.SIMPLE_AVERAGE,
  ): AgentAggregatedEvaluationResult {
    const metricsByCategory = new Map<MetricCategory, EvaluationScore[]>();
    for (const result of results) {
      for (const [category, score] of result.metrics) {
        const scores = metricsByCategory.get(category) ?? [];
        scores.push(score);
        metricsByCategory.set(category, scores);
      }
    }

    const aggregatedMetrics = new Map<MetricCategory, EvaluationScore>();
    for (const [category, scores] of metricsByCategory) {
      const validScores = scores.map((score) => score.score).filter((score): score is number => score !== null);
      const feedbacks = scores.map((score) => score.feedback).filter((feedback) => feedback.length > 0);
      aggregatedMetrics.set(category, new EvaluationScore({
        score: averageOrNull(validScores),
        feedback: this.summarizeFeedbacks(feedbacks),
      }));
    }

    return new AgentAggregatedEvaluationResult({
      agentId,
      agentRole,
      taskCount: results.length,
      aggregationStrategy: strategy,
      metrics: aggregatedMetrics,
      taskResults: results.map((result) => result.taskId),
      overallScore: averageOrNull([...aggregatedMetrics.values()]
        .map((score) => score.score)
        .filter((score): score is number => score !== null)),
    });
  }

  display_evaluation_with_feedback(iterationsResults: Record<number, Record<string, AgentEvaluationResult[]>>): string {
    if (Object.keys(iterationsResults).length === 0) {
      return "No evaluation results to display";
    }
    return this.formatIterations(iterationsResults, true);
  }

  display_summary_results(iterationsResults: Record<number, Record<string, AgentEvaluationResult[]>>): string {
    if (Object.keys(iterationsResults).length === 0) {
      return "No evaluation results to display";
    }
    return this.formatIterations(iterationsResults, false);
  }

  private summarizeFeedbacks(feedbacks: readonly string[]): string {
    if (feedbacks.length === 0) {
      return "";
    }
    if (feedbacks.length === 1) {
      return feedbacks[0] ?? "";
    }
    if (feedbacks.length <= 2 && feedbacks.every((feedback) => feedback.length < 200)) {
      return feedbacks.map((feedback, index) => `Feedback ${String(index + 1)}: ${feedback}`).join("\n\n");
    }
    return `Synthesized from multiple tasks: ${feedbacks.map((feedback) => `\n\n- ${feedback.slice(0, 500)}${feedback.length > 500 ? "..." : ""}`).join("")}`;
  }

  private formatIterations(iterationsResults: Record<number, Record<string, AgentEvaluationResult[]>>, includeFeedback: boolean): string {
    const lines: string[] = [];
    const roles = new Set<string>();
    for (const result of Object.values(iterationsResults)) {
      for (const role of Object.keys(result)) {
        roles.add(role);
      }
    }
    for (const role of [...roles].sort()) {
      lines.push(`Agent: ${role}`);
      for (const [iteration, result] of Object.entries(iterationsResults).sort(([left], [right]) => Number(left) - Number(right))) {
        const entries = result[role] ?? [];
        if (entries.length === 0) {
          continue;
        }
        const aggregated = this.aggregateAgentResults({
          agentId: entries[0]?.agentId ?? "",
          agentRole: role,
          results: entries,
        });
        lines.push(`Iteration ${iteration}`, `Overall Score: ${aggregated.overallScore === null ? "N/A" : aggregated.overallScore.toFixed(1)}`);
        for (const [metric, score] of aggregated.metrics) {
          lines.push(`${metricCategoryTitle(metric)}: ${score.score === null ? "N/A" : score.score.toFixed(1)}`);
          if (includeFeedback && score.feedback) {
            lines.push(score.feedback);
          }
        }
      }
    }
    return lines.join("\n");
  }
}

export class EvaluationTraceCallback {
  readonly traces: Record<string, Record<string, unknown>> = {};
  current_agent_id: string | null = null;
  current_task_id: string | null = null;
  current_llm_call: Record<string, unknown> = {};
  private unsubscribeHandlers: Array<() => void> = [];

  setupListeners(eventBus: EventBus = crewaiEventBus): void {
    this.disposeListeners();
    this.unsubscribeHandlers = [
      eventBus.on("agent_execution_started", (_source, event) => {
        this.on_agent_start(event.agent, event.task);
      }),
      eventBus.on("lite_agent_execution_started", (_source, event) => {
        this.on_lite_agent_start(event.agentInfo);
      }),
      eventBus.on("agent_execution_completed", (_source, event) => {
        this.on_agent_finish(event.agent, event.task, event.output);
      }),
      eventBus.on("lite_agent_execution_completed", (_source, event) => {
        this.on_lite_agent_finish(event.output);
      }),
      eventBus.on("tool_usage_finished", (_source, event) => {
        this.on_tool_use(event.toolName, event.toolArgs, event.output, { success: true });
      }),
      eventBus.on("tool_usage_error", (_source, event) => {
        this.on_tool_use(event.toolName, event.toolArgs, event.error, { success: false, error_type: "usage_error" });
      }),
      eventBus.on("tool_execution_error", (_source, event) => {
        this.on_tool_use(event.tool_name, event.tool_args, event.error, { success: false, error_type: "execution_error" });
      }),
      eventBus.on("tool_selection_error", (_source, event) => {
        this.on_tool_use(event.toolName, event.toolArgs, event.error, { success: false, error_type: "selection_error" });
      }),
      eventBus.on("tool_validate_input_error", (_source, event) => {
        this.on_tool_use(event.toolName, event.toolArgs, event.error, { success: false, error_type: "validation_error" });
      }),
      eventBus.on("llm_call_started", (_source, event) => {
        this.on_llm_call_start(event.messages, event.tools);
      }),
      eventBus.on("llm_call_completed", (_source, event) => {
        this.on_llm_call_end(event.messages, event.response, event.usage);
      }),
    ];
  }

  setup_listeners(eventBus: EventBus = crewaiEventBus): void {
    this.setupListeners(eventBus);
  }

  disposeListeners(): void {
    for (const unsubscribe of this.unsubscribeHandlers) {
      unsubscribe();
    }
    this.unsubscribeHandlers = [];
  }

  dispose_listeners(): void {
    this.disposeListeners();
  }

  on_agent_start(agent: unknown, task: unknown): void {
    const agentId = stringifyEvaluationValue((agent as { id?: unknown }).id ?? "");
    const taskId = stringifyEvaluationValue((task as { id?: unknown }).id ?? "");
    this.current_agent_id = agentId;
    this.current_task_id = taskId;
    this.initTrace(`${agentId}_${taskId}`, {
      agent_id: agentId,
      task_id: taskId,
      tool_uses: [],
      llm_calls: [],
      start_time: new Date(),
      final_output: null,
    });
  }

  on_lite_agent_start(agentInfo: Record<string, unknown>): void {
    const agentId = stringifyEvaluationValue(agentInfo.id ?? "");
    this.current_agent_id = agentId;
    this.current_task_id = "lite_task";
    this.initTrace(`${agentId}_lite_task`, {
      agent_id: agentId,
      task_id: "lite_task",
      tool_uses: [],
      llm_calls: [],
      start_time: new Date(),
      final_output: null,
    });
  }

  on_agent_finish(agent: unknown, task: unknown, output: unknown): void {
    const agentId = stringifyEvaluationValue((agent as { id?: unknown }).id ?? this.current_agent_id ?? "");
    const taskId = stringifyEvaluationValue((task as { id?: unknown }).id ?? this.current_task_id ?? "");
    const trace = this.traces[`${agentId}_${taskId}`];
    if (trace) {
      trace.final_output = output;
      trace.end_time = new Date();
    }
    this.resetCurrent();
  }

  on_lite_agent_finish(output: unknown): void {
    const key = `${this.current_agent_id ?? ""}_lite_task`;
    const trace = this.traces[key];
    if (trace) {
      trace.final_output = output;
      trace.end_time = new Date();
    }
    this.resetCurrent();
  }

  get_trace(agent_id: string, task_id: string): Record<string, unknown> {
    return this.traces[`${agent_id}_${task_id}`] ?? {};
  }

  on_tool_use(tool: string, args: unknown, result: unknown, options: { success?: boolean; error_type?: string | null } = {}): void {
    const key = `${this.current_agent_id ?? ""}_${this.current_task_id ?? ""}`;
    const trace = this.traces[key] ?? { tool_uses: [] };
    const uses = Array.isArray(trace.tool_uses) ? trace.tool_uses : [];
    uses.push({
      tool,
      args,
      result,
      success: options.success ?? true,
      ...(options.success === false && options.error_type ? { error: true, error_type: options.error_type } : { error_type: options.error_type ?? null }),
    });
    trace.tool_uses = uses;
    this.traces[key] = trace;
  }

  on_llm_call_start(messages: unknown, tools: readonly Record<string, unknown>[] | null = null): void {
    if (!this.current_agent_id || !this.current_task_id) {
      return;
    }
    const key = `${this.current_agent_id}_${this.current_task_id}`;
    if (!this.traces[key]) {
      return;
    }
    this.current_llm_call = {
      messages,
      tools,
      start_time: new Date(),
      response: null,
      end_time: null,
    };
  }

  on_llm_call_end(messages: unknown, response: unknown, usage: Record<string, unknown> | null = null): void {
    if (!this.current_agent_id || !this.current_task_id) {
      return;
    }
    const key = `${this.current_agent_id}_${this.current_task_id}`;
    const trace = this.traces[key];
    if (!trace) {
      return;
    }
    const calls = Array.isArray(trace.llm_calls) ? trace.llm_calls : [];
    const now = new Date();
    const responseUsage = response && typeof response === "object" && "usage" in response
      ? (response as { usage?: unknown }).usage
      : null;
    const usageRecord = asNullableRecord(usage) ?? asNullableRecord(responseUsage);
    calls.push({
      messages,
      response,
      start_time: this.current_llm_call.start_time ?? now,
      end_time: now,
      total_tokens: toNumberOrZero(usageRecord?.total_tokens ?? usageRecord?.totalTokens),
    });
    trace.llm_calls = calls;
    this.current_llm_call = {};
  }

  private initTrace(key: string, trace: Record<string, unknown>): void {
    this.traces[key] = trace;
  }

  private resetCurrent(): void {
    this.current_agent_id = null;
    this.current_task_id = null;
  }
}

const evaluationTraceCallback = new EvaluationTraceCallback();

export function create_evaluation_callbacks(): EvaluationTraceCallback {
  evaluationTraceCallback.setupListeners(crewaiEventBus);
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
  readonly display: ExperimentResultsDisplay;

  constructor(results: readonly ExperimentResult[], metadata: Record<string, unknown> = {}) {
    this.results = [...results];
    this.metadata = { ...metadata };
    this.display = new ExperimentResultsDisplay();
  }

  to_json(filepath: string | null = null): Record<string, unknown> {
    const data = {
      timestamp: this.timestamp.toISOString(),
      metadata: this.metadata,
      results: this.results.map((result) => serializeExperimentResult(result)),
    };
    if (filepath) {
      writeFileSync(filepath, JSON.stringify(data, null, 2), "utf8");
      this.display.console.print?.(`Results saved to ${filepath}`);
    }
    return data;
  }

  compare_with_baseline(
    baseline_filepath: string,
    save_current = true,
    print_summary = false,
  ): Record<string, unknown> {
    let baselineRuns: Record<string, unknown>[] = [];
    if (existsSync(baseline_filepath) && statSync(baseline_filepath).size > 0) {
      try {
        const baselineData = JSON.parse(readFileSync(baseline_filepath, "utf8")) as unknown;
        if (isRecord(baselineData) && "timestamp" in baselineData) {
          baselineRuns = [baselineData];
        } else if (Array.isArray(baselineData)) {
          baselineRuns = baselineData.filter(isRecord);
        }
      } catch (error) {
        this.display.console.print?.(`Warning: Could not load baseline file: ${String(error)}`);
      }
    }

    if (baselineRuns.length === 0) {
      if (save_current) {
        writeFileSync(baseline_filepath, JSON.stringify([this.to_json()], null, 2), "utf8");
        this.display.console.print?.(`Saved current results as new baseline to ${baseline_filepath}`);
      }
      return { is_baseline: true, changes: {} };
    }

    baselineRuns.sort((left, right) => stringFromJsonScalar(right.timestamp).localeCompare(stringFromJsonScalar(left.timestamp)));
    const latestRun = baselineRuns[0] ?? {};
    const comparison = this.compareWithRun(latestRun);

    if (print_summary) {
      this.display.comparison_summary(comparison, stringFromJsonScalar(latestRun.timestamp, "unknown"));
    }
    if (save_current) {
      baselineRuns.push(this.to_json());
      writeFileSync(baseline_filepath, JSON.stringify(baselineRuns, null, 2), "utf8");
      this.display.console.print?.(`Added current results to baseline file ${baseline_filepath}`);
    }
    return comparison;
  }

  compareWithBaseline(
    baselineFilepath: string,
    saveCurrent = true,
    printSummary = false,
  ): Record<string, unknown> {
    return this.compare_with_baseline(baselineFilepath, saveCurrent, printSummary);
  }

  private compareWithRun(baselineRun: Record<string, unknown>): Record<string, unknown> {
    const baselineResults = Array.isArray(baselineRun.results) ? baselineRun.results.filter(isRecord) : [];
    const baselineLookup = new Map<string, Record<string, unknown>>();
    for (const result of baselineResults) {
      const identifier = result.identifier;
      const identifierText = stringFromJsonScalar(identifier);
      if (identifierText.length > 0) {
        baselineLookup.set(identifierText, result);
      }
    }

    const improved: string[] = [];
    const regressed: string[] = [];
    const unchanged: string[] = [];
    const newTests: string[] = [];

    for (const result of this.results) {
      const identifier = result.identifier;
      const baselineResult = baselineLookup.get(identifier);
      if (!baselineResult) {
        newTests.push(identifier);
        continue;
      }
      const baselinePassed = baselineResult.passed === true;
      if (result.passed && !baselinePassed) {
        improved.push(identifier);
      } else if (!result.passed && baselinePassed) {
        regressed.push(identifier);
      } else {
        unchanged.push(identifier);
      }
    }

    const currentIdentifiers = new Set(this.results.map((result) => result.identifier));
    const missingTests = [...baselineLookup.keys()].filter((identifier) => !currentIdentifiers.has(identifier));
    return {
      improved,
      regressed,
      unchanged,
      new_tests: newTests,
      missing_tests: missingTests,
      total_compared: improved.length + regressed.length + unchanged.length,
      baseline_timestamp: stringFromJsonScalar(baselineRun.timestamp, "unknown"),
    };
  }
}

export type ExperimentScore = number | Record<string, number>;

export class ExperimentRunner {
  readonly dataset: Record<string, unknown>[];
  evaluator: AgentEvaluator | null = null;
  readonly display: ExperimentResultsDisplay;

  constructor(dataset: readonly Record<string, unknown>[] = []) {
    this.dataset = dataset.map((row) => ({ ...row }));
    this.display = new ExperimentResultsDisplay();
  }

  run(
    crewOrOptions: {
      crew?: { agents?: readonly unknown[]; kickoff?: (options: { inputs: Record<string, unknown> }) => unknown } | null;
      agents?: readonly unknown[] | null;
      print_summary?: boolean;
      printSummary?: boolean;
    } | { agents?: readonly unknown[]; kickoff?: (options: { inputs: Record<string, unknown> }) => unknown } | null = {},
    agentsArg: readonly unknown[] | null = null,
    print_summary = false,
  ): ExperimentResults {
    const options = isExperimentRunOptions(crewOrOptions)
      ? crewOrOptions
      : { crew: crewOrOptions, agents: agentsArg, print_summary };
    const crew = options.crew ?? null;
    const agents = options.agents ?? (crew?.agents ? [...crew.agents] : null);
    if (!agents) {
      throw new Error("Agents must be provided either directly or via a crew");
    }

    this.evaluator = new AgentEvaluator(agents, create_default_evaluator());
    const results = this.dataset.map((testCase) => {
      this.evaluator?.reset_iterations_results();
      return this._run_test_case(testCase, agents, crew);
    });
    const experimentResults = new ExperimentResults(results);
    if (options.printSummary ?? options.print_summary ?? false) {
      this.display.summary(experimentResults);
    }
    return experimentResults;
  }

  _run_test_case(
    test_case: Record<string, unknown>,
    agents: readonly unknown[],
    crew: { kickoff?: (options: { inputs: Record<string, unknown> }) => unknown } | null = null,
  ): ExperimentResult {
    const inputs = isRecord(test_case.inputs) ? test_case.inputs : {};
    const expectedScore = normalizeExperimentExpectedScore(test_case.expected_score);
    const identifier = stringFromJsonScalar(test_case.identifier) || hashExperimentIdentifier(test_case);

    try {
      this.display.console.print?.(`Running crew with input: ${JSON.stringify(inputs).slice(0, 50)}...`);
      if (crew?.kickoff) {
        void crew.kickoff({ inputs });
      } else {
        for (const agent of agents) {
          if (agent instanceof Agent) {
            void agent.kickoff(JSON.stringify(inputs));
          } else {
            throw new TypeError(`Agent ${stringifyEvaluationValue(agent)} is not an instance of Agent and cannot be kicked off directly`);
          }
        }
      }

      if (!this.evaluator) {
        throw new Error("Evaluator must be initialized");
      }
      const agentEvaluations = this.evaluator.get_agent_evaluation();
      const actualScore = this._extract_scores(agentEvaluations);
      return new ExperimentResult({
        identifier,
        inputs,
        score: actualScore,
        expected_score: expectedScore,
        passed: this._assert_scores(expectedScore, actualScore),
        agent_evaluations: agentEvaluations,
      });
    } catch (error) {
      this.display.console.print?.(`Error running test case: ${error instanceof Error ? error.message : stringifyEvaluationValue(error)}`);
      return new ExperimentResult({
        identifier,
        inputs,
        score: 0,
        expected_score: expectedScore,
        passed: false,
      });
    }
  }

  _extract_scores(agent_evaluations: Record<string, AgentAggregatedEvaluationResult>): ExperimentScore {
    const scoresByMetric = new Map<string, number[]>();
    for (const evaluation of Object.values(agent_evaluations)) {
      for (const [metricName, score] of evaluation.metrics) {
        if (score.score !== null) {
          const bucket = scoresByMetric.get(metricName) ?? [];
          bucket.push(score.score);
          scoresByMetric.set(metricName, bucket);
        }
      }
    }
    const averageScores = Object.fromEntries([...scoresByMetric.entries()].map(([metricName, scores]) => [
      metricName,
      scores.reduce((sum, score) => sum + score, 0) / scores.length,
    ]));
    const entries = Object.entries(averageScores);
    return entries.length === 1 ? entries[0]?.[1] ?? 0 : averageScores;
  }

  _assert_scores(expected: ExperimentScore, actual: ExperimentScore): boolean {
    if (typeof expected === "number" && typeof actual === "number") {
      return actual >= expected;
    }
    if (isNumericRecord(expected) && typeof actual === "number") {
      return Object.values(expected).every((expectedScore) => actual >= expectedScore);
    }
    if (typeof expected === "number" && isNumericRecord(actual)) {
      const actualScores = Object.values(actual);
      if (actualScores.length === 0) {
        return false;
      }
      return actualScores.reduce((sum, score) => sum + score, 0) / actualScores.length >= expected;
    }
    if (isNumericRecord(expected) && isNumericRecord(actual)) {
      const matchingKeys = Object.keys(expected).filter((key) => key in actual);
      if (matchingKeys.length === 0) {
        return false;
      }
      return matchingKeys.every((key) => {
        const actualScore = actual[key];
        const expectedScore = expected[key];
        return actualScore !== undefined && expectedScore !== undefined && actualScore >= expectedScore;
      });
    }
    return false;
  }
}

export type ExperimentResultsDisplayConsole = {
  print?: (value: string) => void;
  log?: (value: string) => void;
};

export class ExperimentResultsDisplay {
  readonly console: ExperimentResultsDisplayConsole;

  constructor(options: { console?: ExperimentResultsDisplayConsole } = {}) {
    this.console = options.console ?? globalThis.console;
  }

  summary(experiment_results: ExperimentResults): string {
    const total = experiment_results.results.length;
    const passed = experiment_results.results.filter((result) => result.passed).length;
    const failed = total - passed;
    const successRate = total > 0 ? `${(passed / total * 100).toFixed(1)}%` : "N/A";
    const output = [
      "Experiment Summary",
      `Total Test Cases: ${String(total)}`,
      `Passed: ${String(passed)}`,
      `Failed: ${String(failed)}`,
      `Success Rate: ${successRate}`,
    ].join("\n");
    this.print(output);
    return output;
  }

  comparison_summary(comparison: Record<string, unknown>, baseline_timestamp: string): string {
    const lines = [
      `Comparison with baseline run from ${baseline_timestamp}`,
      "Results Comparison",
      this.formatComparisonRow("Improved", comparison.improved),
      this.formatComparisonRow("Regressed", comparison.regressed),
      this.formatComparisonRow("Unchanged", comparison.unchanged),
    ];
    if (asStringArray(comparison.new_tests).length > 0) {
      lines.push(this.formatComparisonRow("New Tests", comparison.new_tests));
    }
    if (asStringArray(comparison.missing_tests).length > 0) {
      lines.push(this.formatComparisonRow("Missing Tests", comparison.missing_tests));
    }
    const output = lines.join("\n");
    this.print(output);
    return output;
  }

  comparisonSummary(comparison: Record<string, unknown>, baselineTimestamp: string): string {
    return this.comparison_summary(comparison, baselineTimestamp);
  }

  private formatComparisonRow(label: string, values: unknown): string {
    const items = asStringArray(values);
    const details = summarizeExperimentIdentifiers(items);
    return details ? `${label}: ${String(items.length)} - ${details}` : `${label}: ${String(items.length)}`;
  }

  private print(value: string): void {
    if (typeof this.console.print === "function") {
      this.console.print(value);
      return;
    }
    this.console.log?.(value);
  }
}

export function assert_experiment_no_regression(comparison_result: Record<string, unknown>): void {
  const regressed = asStringArray(comparison_result.regressed);
  if (regressed.length > 0) {
    throw new Error(`Regression detected! The following tests that previously passed now fail: ${regressed.join(", ")}`);
  }
}

export function assert_experiment_successfully(
  experiment_results: ExperimentResults,
  baseline_filepath = "experiment_fallback_results.json",
): void {
  const failed = experiment_results.results.filter((result) => !result.passed);
  if (failed.length > 0) {
    throw new Error(`The following test cases failed:\n${failed.map((result) => `- ${result.identifier}: expected ${stringifyEvaluationValue(result.expected_score)}, got ${stringifyEvaluationValue(result.score)}`).join("\n")}`);
  }
  assert_experiment_no_regression(experiment_results.compare_with_baseline(baseline_filepath));
}

export function run_experiment(
  dataset: readonly Record<string, unknown>[],
  crew: { agents?: readonly unknown[]; kickoff?: (options: { inputs: Record<string, unknown> }) => unknown } | null = null,
  agents: readonly unknown[] | null = null,
  verbose = false,
): ExperimentResults {
  return new ExperimentRunner(dataset).run({ agents, crew, print_summary: verbose });
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function stringFromJsonScalar(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value.toString();
  }
  return fallback;
}

function serializeExperimentResult(result: ExperimentResult): Record<string, unknown> {
  return {
    identifier: result.identifier,
    inputs: result.inputs,
    score: result.score,
    expected_score: result.expected_score,
    passed: result.passed,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumericRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "number");
}

function normalizeExperimentExpectedScore(value: unknown): ExperimentScore {
  if (typeof value === "number" || isNumericRecord(value)) {
    return value;
  }
  return 1;
}

function isExperimentRunOptions(value: unknown): value is {
  crew?: { agents?: readonly unknown[]; kickoff?: (options: { inputs: Record<string, unknown> }) => unknown } | null;
  agents?: readonly unknown[] | null;
  print_summary?: boolean;
  printSummary?: boolean;
} {
  return isRecord(value) && ("crew" in value || "print_summary" in value || "printSummary" in value);
}

function hashExperimentIdentifier(testCase: Record<string, unknown>): string {
  return createHash("md5").update(JSON.stringify(testCase)).digest("hex");
}

function summarizeExperimentIdentifiers(items: readonly string[]): string {
  if (items.length === 0) {
    return "";
  }
  const details = items.slice(0, 3).join(", ");
  return items.length > 3 ? `${details} and ${String(items.length - 3)} more` : details;
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

function parseEvaluatorScore(response: unknown): EvaluationScore {
  const rawResponse = stringifyEvaluationValue(response);
  try {
    const record = asRecord(extractJsonFromLLMResponse(rawResponse));
    return new EvaluationScore({
      score: record.score === null || record.score === undefined ? null : toNumber(record.score),
      feedback: stringifyEvaluationValue(record.feedback ?? rawResponse),
      rawResponse,
    });
  } catch {
    return new EvaluationScore({
      score: null,
      feedback: `Failed to parse evaluation. Raw response: ${rawResponse}`,
      rawResponse,
    });
  }
}

function parseDetailedEvaluatorScore(response: unknown, config: {
  title: string;
  fields: readonly (readonly [key: string, label: string, description: string])[];
  fallbackTextKey?: string;
  feedbackPrefix?: string;
}): EvaluationScore {
  const rawResponse = stringifyEvaluationValue(response);
  try {
    const record = asRecord(extractJsonFromLLMResponse(rawResponse));
    const scores = asNullableRecord(record.scores) ?? {};
    const feedbackLines = [`${config.title}:`];
    for (const [key, label, description] of config.fields) {
      const score = scores[key] ?? 5;
      feedbackLines.push(`${label}: ${stringifyEvaluationValue(score)}/10 - ${description}`);
    }
    const feedback = stringifyEvaluationValue(record.feedback ?? "");
    const fallback = stringifyEvaluationValue(record[config.fallbackTextKey ?? "improvement_suggestions"] ?? "");
    if (config.feedbackPrefix && feedback) {
      feedbackLines.push("", `${config.feedbackPrefix}:`, feedback);
    }
    if (fallback) {
      feedbackLines.push("", config.fallbackTextKey === "optimization_suggestions" ? "Optimization Suggestions:" : "Improvement Suggestions:", fallback);
    } else if (!config.feedbackPrefix && feedback) {
      feedbackLines.push(feedback);
    }
    return new EvaluationScore({
      score: toNumber(record.overall_score ?? record.overallScore ?? record.score ?? 5),
      feedback: feedbackLines.join("\n"),
      rawResponse,
    });
  } catch (error) {
    return new EvaluationScore({
      score: null,
      feedback: `Error evaluating ${config.title.toLowerCase()}: ${stringifyEvaluationValue(error)}`,
      rawResponse,
    });
  }
}

function callEvaluatorLLM(llm: LLM | string | null, messages: readonly LLMMessage[]): unknown {
  if (!llm) {
    throw new Error("Evaluator requires an LLM.");
  }
  if (typeof llm === "function") {
    return llm(messages);
  }
  if (typeof llm !== "string") {
    return llm.call(messages);
  }
  const provider = resolveLLMProvider(llm);
  if (!provider) {
    throw new Error(`No LLM provider registered for model '${llm}'.`);
  }
  return provider.call(messages);
}

function extractJsonFromLLMResponse(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("Failed to extract evaluation data from LLM response.");
  }
  return JSON.parse(text.slice(start, end + 1));
}

function getTraceArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getEvaluatorAgentTools(agentRecord: Record<string, unknown>): Array<{ name: string; description: string }> {
  const tools = Array.isArray(agentRecord.tools) ? agentRecord.tools : [];
  return tools.map((tool) => {
    const record = asNullableRecord(tool) ?? {};
    return {
      name: stringifyEvaluationValue(record.name ?? "Unknown tool"),
      description: stringifyEvaluationValue(record.description ?? ""),
    };
  });
}

function sanitizeEvaluatorToolName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "tool";
}

function formatEvaluatorJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return stringifyEvaluationValue(value);
  }
}

function formatPercent(value: number): string {
  return `${(Number.isFinite(value) ? value * 100 : 0).toFixed(1)}%`;
}

function getReasoningText(call: unknown): string {
  const content = (asNullableRecord(call) ?? {}).response ?? "";
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map((entry) => stringifyEvaluationValue((asNullableRecord(entry) ?? {}).content ?? "")).filter(Boolean).join("\n");
  }
  return stringifyEvaluationValue(content);
}

function detectReasoningLoops(llmCalls: readonly unknown[]): boolean {
  const messages = llmCalls.map(getReasoningText).filter((message) => message.length > 0);
  for (let i = 0; i < messages.length - 2; i += 1) {
    for (let j = i + 1; j < messages.length - 1; j += 1) {
      if (calculateTextSimilarity(messages[i] ?? "", messages[j] ?? "") > 0.7) {
        return true;
      }
    }
  }
  return false;
}

function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().replace(/\s+/g, " ").trim().split(" ").filter(Boolean));
  const words2 = new Set(text2.toLowerCase().replace(/\s+/g, " ").trim().split(" ").filter(Boolean));
  const union = new Set([...words1, ...words2]);
  if (union.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const word of words1) {
    if (words2.has(word)) {
      intersection += 1;
    }
  }
  return intersection / union.size;
}

function analyzeReasoningPattern(llmCalls: readonly unknown[]): ReasoningPatternType {
  const lengths = llmCalls.map((call) => getReasoningText(call).length);
  const avgLength = average(lengths);
  const stdLength = standardDeviation(lengths);
  const trend = calculateTrend(lengths);
  if (calculateLoopLikelihood(lengths) > 0.7) {
    return ReasoningPatternType.LOOP;
  }
  if (avgLength > 1000 && avgLength > 0 && stdLength / avgLength < 0.3) {
    return ReasoningPatternType.VERBOSE;
  }
  if (llmCalls.length > 10 && trend > 0.5) {
    return ReasoningPatternType.INDECISIVE;
  }
  if (avgLength > 0 && stdLength / avgLength > 0.8) {
    return ReasoningPatternType.SCATTERED;
  }
  return ReasoningPatternType.EFFICIENT;
}

function standardDeviation(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

function calculateTrend(values: readonly number[]): number {
  if (values.length < 2) {
    return 0;
  }
  const meanX = (values.length - 1) / 2;
  const meanY = average(values);
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < values.length; index += 1) {
    numerator += (index - meanX) * ((values[index] ?? 0) - meanY);
    denominator += (index - meanX) ** 2;
  }
  const slope = denominator === 0 ? 0 : numerator / denominator;
  const range = Math.max(...values) - Math.min(...values);
  return range > 0 ? Math.max(-1, Math.min(1, slope / range)) : 0;
}

function calculateLoopLikelihood(lengths: readonly number[]): number {
  if (lengths.length < 4) {
    return 0;
  }
  let repeatedLengths = 0;
  for (let index = 0; index < lengths.length - 2; index += 1) {
    const current = lengths[index] ?? 0;
    const next = lengths[index + 2] ?? 0;
    const ratio = next > 0 ? current / next : 0;
    if (ratio >= 0.85 && ratio <= 1.15) {
      repeatedLengths += 1;
    }
  }
  return repeatedLengths / (lengths.length - 2);
}

function getReasoningCallSamples(llmCalls: readonly unknown[]): string {
  const indices = llmCalls.length <= 6
    ? llmCalls.map((_call, index) => index)
    : [0, 1, Math.floor(llmCalls.length / 2) - 1, Math.floor(llmCalls.length / 2), llmCalls.length - 2, llmCalls.length - 1];
  return indices.map((index) => {
    const sample = getReasoningText(llmCalls[index]);
    const truncated = sample.length > 200 ? `${sample.slice(0, 200)}...` : sample;
    return `Call ${String(index + 1)}:\n${truncated}\n`;
  }).join("\n");
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

function asNullableRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
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

function toNumberOrZero(value: unknown): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
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

function averageOrNull(values: readonly number[]): number | null {
  return values.length === 0 ? null : average(values);
}

function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return typeof value === "object" && value !== null && "then" in value && typeof (value as { then?: unknown }).then === "function";
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
