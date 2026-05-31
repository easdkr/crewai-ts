import { CrewKickoffStartedEvent, crewaiEventBus } from "./events.js";
import { storeFiles, type FileInputMap } from "./file-store.js";
import { extractInputFilesFromInputs, type InputFiles } from "./input-files.js";
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
  const crewSkills = readArray(crew.skills);
  for (const agent of agents) {
    agent.crew = crew;
    agent.embedder ??= embedder;
    if ((agent.knowledge === null || agent.knowledge === undefined) && (crew.knowledge !== null && crew.knowledge !== undefined)) {
      const setKnowledge = agent.setKnowledge ?? agent.set_knowledge;
      if (typeof setKnowledge === "function") {
        callUnknown(setKnowledge, agent, crew.knowledge);
      } else {
        agent.knowledge = crew.knowledge;
      }
    }
    const setSkills = agent.setSkills ?? agent.set_skills;
    if (typeof setSkills === "function") {
      callUnknown(setSkills, agent, crewSkills);
    } else if (crewSkills.length > 0) {
      const agentSkills = readArray(agent.skills);
      agent.skills = dedupeByIdentity([...agentSkills, ...crewSkills]);
    }
    agent.functionCallingLlm ??= functionCallingLlm;
    agent.function_calling_llm ??= functionCallingLlm;
    agent.stepCallback ??= stepCallback;
    agent.step_callback ??= stepCallback;
    const executor = agent.agentExecutor ?? agent.agent_executor;
    const isResuming = Boolean(isPlainRecord(executor) && executor._resuming);
    if (!isResuming) {
      callNamed(agent, ["createAgentExecutor", "create_agent_executor"], agent);
    }
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

export function prepareKickoff(
  crew: Record<string, unknown>,
  inputs: Record<string, unknown> | null = {},
  inputFiles: InputFiles | null = null,
): Record<string, unknown> | null {
  let normalizedInputs = normalizeKickoffInputs(inputs);
  for (const callback of readArray(crew.beforeKickoffCallbacks ?? crew.before_kickoff_callbacks)) {
    if (typeof callback !== "function") {
      continue;
    }
    normalizedInputs ??= {};
    normalizedInputs = normalizeKickoffInputs(callUnknown(callback, crew, normalizedInputs));
  }

  const isResumingFromCheckpoint = crew.checkpointKickoffEventId !== undefined
    || crew.checkpoint_kickoff_event_id !== undefined;
  if (!isResumingFromCheckpoint) {
    const started = new CrewKickoffStartedEvent({
      crewName: typeof crew.name === "string" ? crew.name : null,
      crew,
      inputs: normalizedInputs ?? {},
    });
    crew._kickoff_event_id = started.eventId;
    crew.kickoffEventId = started.eventId;
    crew.kickoff_event_id = started.eventId;
    crewaiEventBus.emit(crew, started);
  }

  const taskOutputHandler = crew._task_output_handler ?? crew.taskOutputStorageHandler ?? crew.task_output_storage_handler;
  callNamed(taskOutputHandler, ["reset"], taskOutputHandler);
  crew._logging_color = "bold_purple";
  crew.loggingColor = "bold_purple";
  crew.logging_color = "bold_purple";

  let filesToStore: FileInputMap = { ...(inputFiles ?? {}) };
  if (normalizedInputs !== null) {
    const extracted = extractInputFilesFromInputs(normalizedInputs);
    normalizedInputs = extracted.inputs;
    filesToStore = { ...filesToStore, ...extracted.inputFiles };
    crew._inputs = normalizedInputs;
    crew.inputs = normalizedInputs;
  }
  const crewId = stringValue(crew.id ?? crew._execution_id ?? crew.executionId ?? crew.execution_id);
  if (crewId && Object.keys(filesToStore).length > 0) {
    storeFiles(crewId, filesToStore);
  }

  callNamed(crew, ["_interpolate_inputs", "_interpolateInputs", "interpolateInputs", "interpolate_inputs"], crew, normalizedInputs ?? {});
  callNamed(crew, ["_set_tasks_callbacks", "_setTasksCallbacks", "setTasksCallbacks", "set_tasks_callbacks"], crew);
  callNamed(crew, [
    "_set_allow_crewai_trigger_context_for_first_task",
    "_setAllowCrewaiTriggerContextForFirstTask",
    "setAllowCrewaiTriggerContextForFirstTask",
    "set_allow_crewai_trigger_context_for_first_task",
  ], crew);

  setupAgents(
    crew,
    kickoffAgents(crew),
    crew.embedder,
    crew.functionCallingLlm ?? crew.function_calling_llm,
    crew.stepCallback ?? crew.step_callback,
  );

  if (crew.planning) {
    callNamed(crew, ["_handle_crew_planning", "_handleCrewPlanning", "handleCrewPlanning", "handle_crew_planning"], crew);
  }

  return normalizedInputs;
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

function normalizeKickoffInputs(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!isPlainRecord(value)) {
    throw new TypeError("Crew kickoff inputs must be a mapping/object or null.");
  }
  return { ...value };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function callUnknown(callback: unknown, receiver: unknown, ...args: unknown[]): unknown {
  return (callback as (this: unknown, ...args: unknown[]) => unknown).call(receiver, ...args);
}

function callNamed(target: unknown, names: readonly string[], receiver: unknown, ...args: unknown[]): unknown {
  if (!isPlainRecord(target)) {
    return undefined;
  }
  for (const name of names) {
    const callback = target[name];
    if (typeof callback === "function") {
      return callUnknown(callback, receiver, ...args);
    }
  }
  return undefined;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function kickoffAgents(crew: Record<string, unknown>): Record<string, unknown>[] {
  const agents: Record<string, unknown>[] = [];
  for (const agent of readArray(crew.agents)) {
    if (isPlainRecord(agent) && !agents.includes(agent)) {
      agents.push(agent);
    }
  }
  for (const task of readArray(crew.tasks)) {
    if (!isPlainRecord(task) || !isPlainRecord(task.agent) || agents.includes(task.agent)) {
      continue;
    }
    agents.push(task.agent);
  }
  return agents;
}

function dedupeByIdentity(values: readonly unknown[]): unknown[] {
  const deduped: unknown[] = [];
  for (const value of values) {
    if (!deduped.includes(value)) {
      deduped.push(value);
    }
  }
  return deduped;
}
