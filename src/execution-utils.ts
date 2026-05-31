import { FlowStreamingOutput, CrewStreamingOutput } from "./streaming.js";
import type { LLMMessage, Tool } from "./types.js";

export function handleReasoning(agent: Record<string, unknown>, task: Record<string, unknown>): void {
  if (!agent.planning_enabled && !agent.planning) {
    return;
  }
  const description = typeof task.description === "string" ? task.description : "";
  task.description = `${description}\n\nPlanning:\n${safeString(agent.reasoning_plan)}`.trim();
}

export const handle_reasoning = handleReasoning;

export function buildTaskPromptWithSchema(task: Record<string, unknown>, taskPrompt: string): string {
  const model = task.output_json ?? task.outputJson ?? task.output_pydantic ?? task.outputPydantic;
  if (!model || task.response_model || task.responseModel) {
    return taskPrompt;
  }
  const schema = safeString(model);
  return `${taskPrompt}\n\nReturn a valid JSON object matching this schema:\n${schema}`;
}

export const build_task_prompt_with_schema = buildTaskPromptWithSchema;

export function formatTaskWithContext(taskPrompt: string, context: string | null = null): string {
  return context ? `${taskPrompt}\n\nContext:\n${context}` : taskPrompt;
}

export const format_task_with_context = formatTaskWithContext;

export function getKnowledgeConfig(agent: Record<string, unknown>): Record<string, unknown> {
  const config = agent.knowledgeConfig ?? agent.knowledge_config;
  if (hasModelDump(config)) {
    return config.model_dump();
  }
  return config && typeof config === "object" && !Array.isArray(config) ? config as Record<string, unknown> : {};
}

export const get_knowledge_config = getKnowledgeConfig;

export function handleKnowledgeRetrieval(
  agent: Record<string, unknown>,
  _task: unknown,
  taskPrompt: string,
  knowledgeConfig: Record<string, unknown>,
  queryFunc: (queries: readonly string[], config?: Record<string, unknown>) => unknown,
  crewQueryFunc: (queries: readonly string[], config?: Record<string, unknown>) => unknown,
): string {
  const query = typeof agent.knowledgeSearchQuery === "string"
    ? agent.knowledgeSearchQuery
    : typeof agent.knowledge_search_query === "string"
      ? agent.knowledge_search_query
      : taskPrompt;
  const snippets: unknown[] = [];
  for (const value of [queryFunc([query], knowledgeConfig), crewQueryFunc([query], knowledgeConfig)]) {
    if (Array.isArray(value)) {
      for (const item of value as readonly unknown[]) {
        snippets.push(item);
      }
    } else if (value) {
      snippets.push(value);
    }
  }
  return snippets.length ? `${taskPrompt}\n${snippets.map(safeString).join("\n")}` : taskPrompt;
}

export const handle_knowledge_retrieval = handleKnowledgeRetrieval;
export const ahandle_knowledge_retrieval = (...args: Parameters<typeof handleKnowledgeRetrieval>): Promise<string> => Promise.resolve(handleKnowledgeRetrieval(...args));

export function applyTrainingData(agent: Record<string, unknown>, taskPrompt: string): string {
  const handler = agent._training_handler ?? agent._use_trained_data;
  return typeof handler === "function" ? safeString(handler.call(agent, { task_prompt: taskPrompt, taskPrompt })) : taskPrompt;
}

export const apply_training_data = applyTrainingData;

export function processToolResults(agent: { toolsResults?: readonly Record<string, unknown>[]; tools_results?: readonly Record<string, unknown>[] }, result: unknown): unknown {
  let next = result;
  for (const toolResult of agent.toolsResults ?? agent.tools_results ?? []) {
    if (toolResult.result_as_answer || toolResult.resultAsAnswer) {
      next = toolResult.result;
    }
  }
  return next;
}

export const process_tool_results = processToolResults;

export function saveLastMessages(agent: Record<string, unknown>): void {
  const executor = agent.agentExecutor ?? agent.agent_executor;
  const messages = executor && typeof executor === "object" && "messages" in executor ? (executor as { messages?: unknown }).messages : [];
  agent._last_messages = Array.isArray(messages) ? messages.filter(isLlmMessage) : [];
}

export const save_last_messages = saveLastMessages;

export function validateMaxExecutionTime(agent: { maxExecutionTime?: number | null; max_execution_time?: number | null; startTime?: Date | null; start_time?: Date | null }): void {
  const max = agent.maxExecutionTime ?? agent.max_execution_time;
  const start = agent.startTime ?? agent.start_time;
  if (max && start && Date.now() - start.getTime() > max * 1000) {
    throw new Error(`Agent exceeded max execution time of ${String(max)} seconds.`);
  }
}

export const validate_max_execution_time = validateMaxExecutionTime;

export function prepareTools(agent: { tools?: readonly Tool[] }, task: { tools?: readonly Tool[] } | null = null): readonly Tool[] {
  return task?.tools?.length ? task.tools : agent.tools ?? [];
}

export const prepare_tools = prepareTools;

export function enableAgentStreaming(agents: Iterable<Record<string, unknown>>): void {
  for (const agent of agents) {
    const llm = agent.llm;
    if (llm && typeof llm === "object") {
      (llm as { stream?: boolean }).stream = true;
    }
  }
}

export const enable_agent_streaming = enableAgentStreaming;

export class TaskExecutionData {
  readonly agent: unknown;
  readonly tools: readonly unknown[];
  readonly shouldSkip: boolean;
  readonly should_skip: boolean;

  constructor(agent: unknown = null, tools: readonly unknown[] = [], shouldSkip = false) {
    this.agent = agent;
    this.tools = tools;
    this.shouldSkip = shouldSkip;
    this.should_skip = shouldSkip;
  }
}

export function setupAgents(crew: Record<string, unknown>, agents: Iterable<Record<string, unknown>>, embedder: unknown = null, functionCallingLlm: unknown = null, stepCallback: unknown = null): void {
  for (const agent of agents) {
    agent.crew = crew;
    agent.embedder ??= embedder;
    agent.functionCallingLlm ??= functionCallingLlm;
    agent.function_calling_llm ??= functionCallingLlm;
    agent.stepCallback ??= stepCallback;
    agent.step_callback ??= stepCallback;
  }
}

export const setup_agents = setupAgents;

export function prepareTaskExecution(crew: Record<string, unknown>, task: Record<string, unknown>, taskIndex: number, startIndex: number | null, taskOutputs: unknown[], lastSyncOutput: unknown = null): [TaskExecutionData, unknown[], unknown] {
  if (startIndex !== null && taskIndex < startIndex) {
    if (task.output) {
      taskOutputs.push(task.output);
      if (!task.async_execution && !task.asyncExecution) {
        lastSyncOutput = task.output;
      }
    }
    return [new TaskExecutionData(null, [], true), taskOutputs, lastSyncOutput];
  }
  const getAgent = crew._get_agent_to_use;
  const agent: unknown = typeof getAgent === "function" ? getAgent.call(crew, task) : task.agent ?? null;
  if (!agent) {
    throw new Error([
      `No agent available for task: ${safeString(task.description)}.`,
      "Ensure that either the task has an assigned agent or a manager agent is provided.",
    ].join(" "));
  }
  const agentRecord = typeof agent === "object" ? agent as Record<string, unknown> : {};
  const taskTools = Array.isArray(task.tools) && task.tools.length > 0
    ? task.tools as readonly unknown[]
    : Array.isArray(agentRecord.tools)
      ? agentRecord.tools as readonly unknown[]
      : [];
  const prepareTools = crew._prepare_tools;
  const preparedTools = typeof prepareTools === "function"
    ? (prepareTools as (this: unknown, agent: unknown, task: unknown, tools: readonly unknown[]) => unknown)
      .call(crew, agent, task, taskTools)
    : taskTools;
  const tools = Array.isArray(preparedTools) ? preparedTools as readonly unknown[] : taskTools;
  const executor = agentRecord.agent_executor ?? agentRecord.agentExecutor;
  const isResuming = Boolean(executor && typeof executor === "object" && (executor as { _resuming?: unknown })._resuming);
  const logTaskStart = crew._log_task_start;
  if (!isResuming && typeof logTaskStart === "function") {
    logTaskStart.call(crew, task, agentRecord.role);
  }
  return [new TaskExecutionData(agent, tools), taskOutputs, lastSyncOutput];
}

export const prepare_task_execution = prepareTaskExecution;

export function checkConditionalSkip(_crew: unknown, task: { should_execute?: (output: unknown) => boolean; get_skipped_task_output?: () => unknown }, taskOutputs: readonly unknown[]): unknown {
  const previous = taskOutputs.at(-1);
  return previous !== undefined && task.should_execute && !task.should_execute(previous)
    ? task.get_skipped_task_output?.() ?? null
    : null;
}

export const check_conditional_skip = checkConditionalSkip;

export function prepareKickoff(_crew: unknown, inputs: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...inputs };
}

export const prepare_kickoff = prepareKickoff;

export async function runForEachAsync<TInput, TResult>(items: readonly TInput[], runner: (item: TInput, index: number) => Promise<TResult>): Promise<TResult[]> {
  return await Promise.all(items.map((item, index) => runner(item, index)));
}

export const run_for_each_async = runForEachAsync;

export class StreamingContext {
  constructor(readonly output: CrewStreamingOutput | FlowStreamingOutput | null = null) {}
}

export class ForEachStreamingContext extends StreamingContext {}

function isLlmMessage(value: unknown): value is LLMMessage {
  return value !== null && typeof value === "object" && "role" in value && "content" in value;
}

function safeString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return "";
}

function hasModelDump(value: unknown): value is { model_dump: () => Record<string, unknown> } {
  return value !== null
    && typeof value === "object"
    && "model_dump" in value
    && typeof value.model_dump === "function";
}
