import { existsSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createHash, randomUUID } from "node:crypto";

import { Agent } from "./agent.js";
import type { ExecutionContext } from "./context.js";
import {
  CrewKickoffCompletedEvent,
  CrewKickoffFailedEvent,
  CrewKickoffStartedEvent,
  CrewTestCompletedEvent,
  CrewTestFailedEvent,
  CrewTestStartedEvent,
  CrewTrainCompletedEvent,
  CrewTrainFailedEvent,
  CrewTrainStartedEvent,
  crewaiEventBus,
} from "./events.js";
import { FileHandler } from "./file-handler.js";
import type { HumanInputProvider } from "./human-input.js";
import { Knowledge, type KnowledgeSource } from "./knowledge.js";
import { addUsageMetrics, emptyUsageMetrics, subtractUsageMetrics, type UsageMetrics } from "./llm.js";
import { Memory, MemoryScope, createMemoryTools } from "./memory.js";
import { CrewOutput, TaskOutput } from "./outputs.js";
import { CrewPlanner } from "./planning.js";
import { CrewEvaluator } from "./evaluators.js";
import { RpmController } from "./rpm.js";
import { coerceSecurityConfig, type Fingerprint, type SecurityConfig } from "./security.js";
import { Skill, activateSkill, discoverSkills, resolveRegistryRef } from "./skills.js";
import { coerceCheckpointConfig, RuntimeState, type CheckpointConfig, type CheckpointOption } from "./state.js";
import { CrewStreamingOutput } from "./streaming.js";
import { ConditionalTask, Task, type TaskInputFiles } from "./task.js";
import { TaskOutputStorageHandler, type StoredTaskOutput } from "./task-output-storage.js";
import { BaseTool, CacheHandler, StructuredTool, sanitizeToolName } from "./tools.js";
import { Process, type AgentStepCallback, type CrewKickoffCallback, type InputValues, type TaskCallback, type Tool } from "./types.js";
import type { LLM } from "./types.js";
import { extractInputFilesFromInputs } from "./input-files.js";
import type { EmbedderConfig } from "./rag.js";

export type KickoffOptions = {
  inputs?: InputValues;
  inputFiles?: TaskInputFiles;
  input_files?: TaskInputFiles;
};

export type KickoffForEachOptions = {
  inputs: readonly InputValues[];
  inputFiles?: TaskInputFiles;
  input_files?: TaskInputFiles;
};

export type TaskExecutionLog = {
  task: {
    id: string;
    name: string | null;
    description: string;
    expectedOutput: string;
  };
  output: {
    description: string;
    summary?: string;
    raw: string;
    pydantic: unknown;
    jsonDict: Record<string, unknown> | null;
    outputFormat: string;
    agent: string;
    messages?: readonly unknown[];
  };
  taskIndex: number;
  inputs: InputValues;
  wasReplayed?: boolean;
};

export type ReplayTaskRef = string | number | Task;

export type ResetMemoriesCommandType =
  | "memory"
  | "knowledge"
  | "agent_knowledge"
  | "kickoff_outputs"
  | "all"
  | "long"
  | "short"
  | "entity"
  | "external";

export type CrewOptions = {
  id?: string;
  name?: string | null;
  config?: Record<string, unknown> | null;
  agents?: readonly Agent[];
  tasks?: readonly Task[];
  process?: Process;
  verbose?: boolean;
  cache?: boolean;
  embedder?: EmbedderConfig | null;
  usageMetrics?: UsageMetrics | null;
  usage_metrics?: UsageMetrics | null;
  tokenUsage?: UsageMetrics | null;
  token_usage?: UsageMetrics | null;
  maxRpm?: number | null;
  max_rpm?: number | null;
  outputLogFile?: boolean | string | null;
  output_log_file?: boolean | string | null;
  taskExecutionOutputJsonFiles?: readonly string[] | null;
  task_execution_output_json_files?: readonly string[] | null;
  promptFile?: string | null;
  prompt_file?: string | null;
  shareCrew?: boolean | null;
  share_crew?: boolean | null;
  memory?: boolean | Memory | MemoryScope;
  knowledge?: Knowledge | null;
  knowledgeSources?: readonly KnowledgeSource[];
  knowledge_sources?: readonly KnowledgeSource[];
  managerAgent?: Agent | null;
  manager_agent?: Agent | null;
  managerLlm?: LLM | string | null;
  manager_llm?: LLM | string | null;
  functionCallingLlm?: LLM | string | null;
  function_calling_llm?: LLM | string | null;
  planning?: boolean | null;
  stream?: boolean;
  planningLlm?: LLM | string | null;
  planning_llm?: LLM | string | null;
  chatLlm?: LLM | string | null;
  chat_llm?: LLM | string | null;
  skills?: readonly unknown[];
  humanInputProvider?: HumanInputProvider | null;
  human_input_provider?: HumanInputProvider | null;
  stepCallback?: AgentStepCallback | null;
  step_callback?: AgentStepCallback | null;
  taskCallback?: TaskCallback | null;
  task_callback?: TaskCallback | null;
  beforeKickoffCallbacks?: readonly CrewKickoffCallback<InputValues>[];
  before_kickoff_callbacks?: readonly CrewKickoffCallback<InputValues>[];
  afterKickoffCallbacks?: readonly CrewKickoffCallback<CrewOutput>[];
  after_kickoff_callbacks?: readonly CrewKickoffCallback<CrewOutput>[];
  securityConfig?: SecurityConfig | null;
  security_config?: SecurityConfig | null;
  checkpoint?: CheckpointOption;
  tracing?: boolean | null;
  executionContext?: ExecutionContext | null;
  execution_context?: ExecutionContext | null;
  checkpointInputs?: InputValues | null;
  checkpoint_inputs?: InputValues | null;
  checkpointTrain?: boolean | null;
  checkpoint_train?: boolean | null;
  checkpointKickoffEventId?: string | null;
  checkpoint_kickoff_event_id?: string | null;
  taskOutputStorageHandler?: TaskOutputStorageHandler | null;
  task_output_storage_handler?: TaskOutputStorageHandler | null;
};

export class Crew {
  readonly entityType = "crew";
  readonly entity_type = "crew";
  readonly id: string;
  name: string | null;
  config: Record<string, unknown> | null;
  agents: Agent[];
  tasks: Task[];
  process: Process;
  verbose: boolean;
  cache: boolean;
  embedder: EmbedderConfig | null;
  maxRpm: number | null;
  outputLogFile: boolean | string | null;
  taskExecutionOutputJsonFiles: readonly string[] | null;
  promptFile: string | null;
  prompt_file: string | null;
  shareCrew: boolean | null;
  share_crew: boolean | null;
  executionLogs: TaskExecutionLog[];
  memory: boolean | Memory | MemoryScope;
  knowledge: Knowledge | null;
  knowledgeSources: readonly KnowledgeSource[];
  managerAgent: Agent | null;
  managerLlm: LLM | string | null;
  functionCallingLlm: LLM | string | null;
  planning: boolean;
  stream: boolean;
  planningLlm: LLM | string | null;
  chatLlm: LLM | string | null;
  chat_llm: LLM | string | null;
  skills: readonly unknown[];
  humanInputProvider: HumanInputProvider | null;
  stepCallback: AgentStepCallback | null;
  taskCallback: TaskCallback | null;
  usageMetrics: UsageMetrics;
  usage_metrics: UsageMetrics;
  tokenUsage: UsageMetrics;
  token_usage: UsageMetrics;
  private planningUsageMetrics: UsageMetrics;
  private readonly rpmController: RpmController | null;
  private readonly cacheHandler: CacheHandler;
  private readonly fileHandler: FileHandler | null;
  private readonly resolvedMemory: Memory | MemoryScope | null;
  beforeKickoffCallbacks: CrewKickoffCallback<InputValues>[];
  afterKickoffCallbacks: CrewKickoffCallback<CrewOutput>[];
  readonly securityConfig: SecurityConfig;
  readonly security_config: SecurityConfig;
  checkpoint: CheckpointConfig | false | null;
  tracing: boolean | null;
  executionContext: ExecutionContext | null;
  execution_context: ExecutionContext | null;
  checkpointInputs: InputValues | null;
  checkpoint_inputs: InputValues | null;
  checkpointTrain: boolean | null;
  checkpoint_train: boolean | null;
  checkpointKickoffEventId: string | null;
  checkpoint_kickoff_event_id: string | null;
  readonly taskOutputStorageHandler: TaskOutputStorageHandler | null;
  readonly task_output_storage_handler: TaskOutputStorageHandler | null;

  constructor(options: CrewOptions = {}) {
    this.id = options.id ?? randomUUID();
    this.name = options.name ?? "crew";
    this.config = options.config ?? null;
    this.agents = [...(options.agents ?? [])];
    this.tasks = [...(options.tasks ?? [])];
    this.process = options.process ?? Process.sequential;
    this.verbose = options.verbose ?? false;
    this.cache = options.cache ?? true;
    this.embedder = options.embedder ?? null;
    this.maxRpm = options.maxRpm ?? options.max_rpm ?? null;
    this.outputLogFile = options.outputLogFile ?? options.output_log_file ?? null;
    this.taskExecutionOutputJsonFiles = options.taskExecutionOutputJsonFiles ?? options.task_execution_output_json_files ?? null;
    this.promptFile = options.promptFile ?? options.prompt_file ?? null;
    this.prompt_file = this.promptFile;
    this.shareCrew = options.shareCrew ?? options.share_crew ?? false;
    this.share_crew = this.shareCrew;
    this.executionLogs = [];
    this.memory = options.memory ?? false;
    this.knowledgeSources = options.knowledgeSources ?? options.knowledge_sources ?? [];
    this.knowledge = options.knowledge ?? (
      this.knowledgeSources.length > 0 ? new Knowledge({ sources: this.knowledgeSources }) : null
    );
    this.managerAgent = options.managerAgent ?? options.manager_agent ?? null;
    this.managerLlm = options.managerLlm ?? options.manager_llm ?? null;
    this.functionCallingLlm = options.functionCallingLlm ?? options.function_calling_llm ?? null;
    this.planning = options.planning ?? false;
    this.stream = options.stream ?? false;
    this.planningLlm = options.planningLlm ?? options.planning_llm ?? null;
    this.chatLlm = options.chatLlm ?? options.chat_llm ?? null;
    this.chat_llm = this.chatLlm;
    this.skills = resolveCrewSkills(options.skills ?? []);
    for (const agent of this.agents) {
      agent.setSkills(this.skills);
    }
    this.humanInputProvider = options.humanInputProvider ?? options.human_input_provider ?? null;
    this.stepCallback = options.stepCallback ?? options.step_callback ?? null;
    this.taskCallback = options.taskCallback ?? options.task_callback ?? null;
    this.usageMetrics = emptyUsageMetrics();
    this.usage_metrics = this.usageMetrics;
    this.tokenUsage = this.usageMetrics;
    this.token_usage = this.usageMetrics;
    this.setUsageMetrics(options.usageMetrics ?? options.usage_metrics ?? options.tokenUsage ?? options.token_usage ?? emptyUsageMetrics());
    this.planningUsageMetrics = emptyUsageMetrics();
    this.rpmController = this.maxRpm ? new RpmController(this.maxRpm) : null;
    this.cacheHandler = new CacheHandler();
    this.fileHandler = this.outputLogFile ? new FileHandler(this.outputLogFile) : null;
    this.configureAgents();
    this.resolvedMemory = this.resolveMemory(this.memory);
    this.beforeKickoffCallbacks = [...(options.beforeKickoffCallbacks ?? options.before_kickoff_callbacks ?? [])];
    this.afterKickoffCallbacks = [...(options.afterKickoffCallbacks ?? options.after_kickoff_callbacks ?? [])];
    this.securityConfig = coerceSecurityConfig(options.securityConfig ?? options.security_config ?? null);
    this.security_config = this.securityConfig;
    this.checkpoint = coerceCheckpointConfig(options.checkpoint);
    this.tracing = options.tracing ?? null;
    this.executionContext = options.executionContext ?? options.execution_context ?? null;
    this.execution_context = this.executionContext;
    this.checkpointInputs = options.checkpointInputs ?? options.checkpoint_inputs ?? null;
    this.checkpoint_inputs = this.checkpointInputs;
    this.checkpointTrain = options.checkpointTrain ?? options.checkpoint_train ?? null;
    this.checkpoint_train = this.checkpointTrain;
    this.checkpointKickoffEventId = options.checkpointKickoffEventId ?? options.checkpoint_kickoff_event_id ?? null;
    this.checkpoint_kickoff_event_id = this.checkpointKickoffEventId;
    this.taskOutputStorageHandler = options.taskOutputStorageHandler
      ?? options.task_output_storage_handler
      ?? new TaskOutputStorageHandler();
    this.task_output_storage_handler = this.taskOutputStorageHandler;
    this.checkConfig();
  }

  static async fromCheckpoint(config: CheckpointConfig): Promise<Crew> {
    const state = await RuntimeState.fromCheckpoint(config);
    const crew = state.root.find((entity): entity is Crew => entity instanceof Crew);
    if (!crew) {
      throw new Error(`No Crew found in checkpoint: ${config.restoreFrom ?? config.restore_from ?? ""}`);
    }
    crew.executionContext = crew.executionContext ? crew.executionContext.clone() : null;
    crew.execution_context = crew.executionContext;
    return crew;
  }

  static async from_checkpoint(config: CheckpointConfig): Promise<Crew> {
    return await Crew.fromCheckpoint(config);
  }

  static async fork(config: CheckpointConfig, branch?: string | null): Promise<Crew> {
    const crew = await Crew.fromCheckpoint(config);
    const state = new RuntimeState({ entities: [crew], parentId: config.restoreFrom ?? config.restore_from ?? null });
    state.fork(branch ?? undefined);
    return crew;
  }

  static coerceSkillStrings(skills: unknown): unknown {
    if (!Array.isArray(skills)) {
      return skills;
    }
    return (skills as unknown[]).map((skill) => typeof skill === "string" && !skill.startsWith("@") ? skill : skill);
  }

  static coerce_skill_strings(skills: unknown): unknown {
    return Crew.coerceSkillStrings(skills);
  }

  static checkConfigType(value: string | Record<string, unknown> | null): Record<string, unknown> | null {
    return typeof value === "string" ? JSON.parse(value) as Record<string, unknown> : value;
  }

  static check_config_type(value: string | Record<string, unknown> | null): Record<string, unknown> | null {
    return Crew.checkConfigType(value);
  }

  get fingerprint(): Fingerprint {
    return this.securityConfig.fingerprint;
  }

  get key(): string {
    const source = [
      ...this.agents.map((agent) => agentKey(agent)),
      ...this.tasks.map((task) => task.key),
    ];
    return createHash("md5").update(source.join("|")).digest("hex");
  }

  setPrivateAttrs(): this {
    this.configureAgents();
    return this;
  }

  set_private_attrs(): this {
    return this.setPrivateAttrs();
  }

  createCrewMemory(): this {
    return this;
  }

  create_crew_memory(): this {
    return this.createCrewMemory();
  }

  createCrewKnowledge(): this {
    if (!this.knowledge && this.knowledgeSources.length > 0) {
      this.knowledge = new Knowledge({ sources: this.knowledgeSources });
    }
    return this;
  }

  create_crew_knowledge(): this {
    return this.createCrewKnowledge();
  }

  checkManagerLlm(): this {
    if (this.process === Process.hierarchical) {
      this.validateHierarchicalProcess();
    }
    return this;
  }

  check_manager_llm(): this {
    return this.checkManagerLlm();
  }

  checkConfig(): this {
    if (this.config) {
      this.setupFromConfig(this.config);
    }
    this.configureAgents();
    return this;
  }

  check_config(): this {
    return this.checkConfig();
  }

  validateTasks(): this {
    if (this.process === Process.sequential) {
      for (const task of this.tasks) {
        if (task.agent === null && this.agents.length === 0) {
          throw new Error(`Sequential process error: Agent is missing in the task with the following description: ${task.description}`);
        }
      }
    }
    return this;
  }

  validate_tasks(): this {
    return this.validateTasks();
  }

  validateEndWithAtMostOneAsyncTask(): this {
    let finalAsyncTaskCount = 0;
    for (const task of [...this.tasks].reverse()) {
      if (!task.asyncExecution) {
        break;
      }
      finalAsyncTaskCount += 1;
    }
    if (finalAsyncTaskCount > 1) {
      throw new Error("The crew must end with at most one asynchronous task.");
    }
    return this;
  }

  validate_end_with_at_most_one_async_task(): this {
    return this.validateEndWithAtMostOneAsyncTask();
  }

  validateMustHaveNonConditionalTask(): this {
    if (this.tasks.length > 0 && this.tasks.every((task) => task instanceof ConditionalTask)) {
      throw new Error("Crew must include at least one non-conditional task");
    }
    return this;
  }

  validate_must_have_non_conditional_task(): this {
    return this.validateMustHaveNonConditionalTask();
  }

  validateFirstTask(): this {
    if (this.tasks[0] instanceof ConditionalTask) {
      throw new Error("The first task cannot be a ConditionalTask.");
    }
    return this;
  }

  validate_first_task(): this {
    return this.validateFirstTask();
  }

  validateAsyncTasksNotAsync(): this {
    for (const task of this.tasks) {
      if (task.asyncExecution && task instanceof ConditionalTask) {
        throw new Error(`Conditional Task: ${task.description}, cannot be executed asynchronously.`);
      }
    }
    return this;
  }

  validate_async_tasks_not_async(): this {
    return this.validateAsyncTasksNotAsync();
  }

  validateAsyncTaskCannotIncludeSequentialAsyncTasksInContext(): this {
    const taskIndices = new Map(this.tasks.map((task, index) => [task, index]));
    for (const [taskIndex, task] of this.tasks.entries()) {
      if (!task.asyncExecution || !Array.isArray(task.context)) {
        continue;
      }
      const contextTasks: readonly Task[] = task.context;
      for (const contextTask of contextTasks) {
        const contextIndex = taskIndices.get(contextTask);
        if (contextIndex === undefined || contextIndex >= taskIndex) {
          continue;
        }
        if (contextTask.asyncExecution) {
          const hasSyncBarrier = this.tasks
            .slice(contextIndex + 1, taskIndex)
            .some((candidate) => !candidate.asyncExecution);
          if (!hasSyncBarrier) {
            throw new Error(
              `Task '${task.description}' is asynchronous and cannot include other sequential asynchronous tasks in its context.`,
            );
          }
        }
      }
    }
    return this;
  }

  validate_async_task_cannot_include_sequential_async_tasks_in_context(): this {
    return this.validateAsyncTaskCannotIncludeSequentialAsyncTasksInContext();
  }

  validateContextNoFutureTasks(): this {
    const taskIndices = new Map(this.tasks.map((task, index) => [task, index]));
    for (const [taskIndex, task] of this.tasks.entries()) {
      for (const contextTask of task.context ?? []) {
        const contextIndex = taskIndices.get(contextTask);
        if (contextIndex !== undefined && contextIndex > taskIndex) {
          throw new Error(
            `Task '${task.description}' has a context dependency on a future task '${contextTask.description}', which is not allowed.`,
          );
        }
      }
    }
    return this;
  }

  validate_context_no_future_tasks(): this {
    return this.validateContextNoFutureTasks();
  }

  private setUsageMetrics(metrics: UsageMetrics): void {
    this.usageMetrics = { ...metrics };
    this.usage_metrics = this.usageMetrics;
    this.tokenUsage = this.usageMetrics;
    this.token_usage = this.usageMetrics;
  }

  configureAgents(): void {
    for (const agent of this.agents) {
      if (this.cache) {
        agent.setCacheHandler(this.cacheHandler);
      } else {
        agent.cacheHandler = null;
        agent.cache_handler = null;
        agent.toolsHandler.cache = null;
      }
      if (this.rpmController) {
        agent.setRpmController(this.rpmController);
      }
      agent.setSkills(this.skills);
    }
    if (this.managerAgent) {
      if (this.cache) {
        this.managerAgent.setCacheHandler(this.cacheHandler);
      } else {
        this.managerAgent.cacheHandler = null;
        this.managerAgent.cache_handler = null;
        this.managerAgent.toolsHandler.cache = null;
      }
      if (this.rpmController) {
        this.managerAgent.setRpmController(this.rpmController);
      }
    }
  }

  async kickoff(options: KickoffOptions = {}): Promise<CrewOutput> {
    if (this.stream) {
      return new CrewStreamingOutput(async () => await this.withStreamDisabled(async () => await this.kickoff(options))) as unknown as CrewOutput;
    }
    let inputs = { ...(options.inputs ?? {}) };
    let inputFiles = options.inputFiles ?? options.input_files;
    const beforeUsage = this.calculateUsageMetrics();
    this.executionLogs = [];
    this.taskOutputStorageHandler?.reset();
    crewaiEventBus.emit(this, new CrewKickoffStartedEvent({ crewName: this.name, inputs }));
    try {
      for (const callback of this.beforeKickoffCallbacks) {
        inputs = { ...(await callback(inputs)) };
      }
      const extracted = extractInputFilesFromInputs(inputs);
      inputs = extracted.inputs;
      inputFiles = { ...(inputFiles ?? {}), ...extracted.inputFiles };
      if (this.planning) {
        await this.handleCrewPlanning();
      }

      const output = await this.runProcess(inputs, inputFiles);
      let finalOutput = output;
      for (const callback of this.afterKickoffCallbacks) {
        finalOutput = await callback(finalOutput);
      }
      const usageDelta = subtractUsageMetrics(this.calculateUsageMetrics(), beforeUsage);
      this.setUsageMetrics(addUsageMetrics(this.usageMetrics, usageDelta));
      finalOutput = withTokenUsage(finalOutput, usageDelta);
      crewaiEventBus.emit(this, new CrewKickoffCompletedEvent({ crewName: this.name, output: finalOutput }));
      return finalOutput;
    } catch (error) {
      crewaiEventBus.emit(this, new CrewKickoffFailedEvent({ crewName: this.name, error }));
      throw error;
    }
  }

  async kickoffAsync(options: KickoffOptions = {}): Promise<CrewOutput> {
    return await this.kickoff(options);
  }

  async kickoff_async(options: KickoffOptions = {}): Promise<CrewOutput> {
    return await this.kickoffAsync(options);
  }

  async akickoff(options: KickoffOptions = {}): Promise<CrewOutput> {
    return await this.kickoff(options);
  }

  async kickoffForEach(options: KickoffForEachOptions): Promise<CrewOutput[]> {
    if (this.stream) {
      const output = new CrewStreamingOutput(async () => {
        const results = await this.withStreamDisabled(async () => await this.kickoffForEach(options));
        return results.at(-1) ?? new CrewOutput({ raw: "", tasksOutput: [], tokenUsage: emptyUsageMetrics() });
      });
      return [output as unknown as CrewOutput];
    }
    let totalUsage = emptyUsageMetrics();
    const outputs: CrewOutput[] = [];
    for (const inputs of options.inputs) {
      const crew = this.copy();
      const output = await crew.kickoff({
        inputs,
        ...(options.inputFiles ?? options.input_files
          ? { inputFiles: options.inputFiles ?? options.input_files }
          : {}),
      });
      totalUsage = addUsageMetrics(totalUsage, output.tokenUsage);
      outputs.push(output);
    }
    this.setUsageMetrics(totalUsage);
    return outputs;
  }

  async kickoff_for_each(options: KickoffForEachOptions): Promise<CrewOutput[]> {
    return await this.kickoffForEach(options);
  }

  async kickoffForEachAsync(options: KickoffForEachOptions): Promise<CrewOutput[]> {
    if (this.stream) {
      const output = new CrewStreamingOutput(async () => {
        const results = await this.withStreamDisabled(async () => await this.kickoffForEachAsync(options));
        return results.at(-1) ?? new CrewOutput({ raw: "", tasksOutput: [], tokenUsage: emptyUsageMetrics() });
      });
      return [output as unknown as CrewOutput];
    }
    const outputs = await Promise.all(
      options.inputs.map(async (inputs) => {
        const crew = this.copy();
        return await crew.kickoffAsync({
          inputs,
          ...(options.inputFiles ?? options.input_files
            ? { inputFiles: options.inputFiles ?? options.input_files }
            : {}),
        });
      }),
    );
    this.setUsageMetrics(outputs.reduce(
      (total, output) => addUsageMetrics(total, output.tokenUsage),
      emptyUsageMetrics(),
    ));
    return outputs;
  }

  async kickoff_for_each_async(options: KickoffForEachOptions): Promise<CrewOutput[]> {
    return await this.kickoffForEachAsync(options);
  }

  async akickoffForEach(options: KickoffForEachOptions): Promise<CrewOutput[]> {
    return await this.kickoffForEachAsync(options);
  }

  async akickoff_for_each(options: KickoffForEachOptions): Promise<CrewOutput[]> {
    return await this.akickoffForEach(options);
  }

  async train(nIterations: number, filename: string, inputs: InputValues = {}): Promise<void> {
    crewaiEventBus.emit(this, new CrewTrainStartedEvent({
      crewName: this.name,
      crew: this,
      n_iterations: nIterations,
      filename,
      inputs,
    }));
    try {
      const trainingCrew = this.copy();
      for (let iteration = 0; iteration < nIterations; iteration += 1) {
        await trainingCrew.kickoff({ inputs });
      }
      await mkdir(dirname(filename), { recursive: true });
      await writeFile(filename, `${JSON.stringify({
        crew: this.name,
        iterations: nIterations,
        generated_at: new Date().toISOString(),
      }, null, 2)}\n`, "utf8");
      crewaiEventBus.emit(this, new CrewTrainCompletedEvent({
        crewName: this.name,
        crew: this,
        n_iterations: nIterations,
        filename,
      }));
    } catch (error) {
      crewaiEventBus.emit(this, new CrewTrainFailedEvent({ crewName: this.name, crew: this, error }));
      throw error;
    }
  }

  async test(nIterations: number, evalLlm: LLM | string | null, inputs: InputValues = {}): Promise<string> {
    crewaiEventBus.emit(this, new CrewTestStartedEvent({
      crewName: this.name,
      crew: this,
      n_iterations: nIterations,
      eval_llm: evalLlm,
      inputs,
    }));
    try {
      const testCrew = this.copy();
      for (const task of testCrew.tasks) {
        task.interpolateInputsAndAddConversationHistory(inputs);
      }
      for (const agent of testCrew.agents) {
        const interpolateInputs = (agent as unknown as { interpolateInputs?: (inputValues: InputValues) => void }).interpolateInputs;
        interpolateInputs?.call(agent, inputs);
      }
      const evaluator = new CrewEvaluator(testCrew, evalLlm);
      for (let iteration = 1; iteration <= nIterations; iteration += 1) {
        evaluator.setIteration(iteration);
        await testCrew.kickoff({ inputs });
      }
      const result = evaluator.printCrewEvaluationResult();
      crewaiEventBus.emit(this, new CrewTestCompletedEvent({ crewName: this.name, crew: this }));
      return result;
    } catch (error) {
      crewaiEventBus.emit(this, new CrewTestFailedEvent({ crewName: this.name, crew: this, error }));
      throw error;
    }
  }

  async replay(taskRef: ReplayTaskRef, inputs?: InputValues): Promise<CrewOutput> {
    const startIndex = this.findReplayStartIndex(taskRef);
    const replayInputs = { ...(inputs ?? this.executionLogs[startIndex]?.inputs ?? {}) };
    const previousOutputs = this.tasks
      .slice(0, startIndex)
      .map((task) => task.output)
      .filter((output): output is TaskOutput => output !== null);
    for (const task of this.tasks.slice(startIndex)) {
      task.output = null;
    }
    const beforeUsage = this.calculateUsageMetrics();
    crewaiEventBus.emit(this, new CrewKickoffStartedEvent({ crewName: this.name, inputs: replayInputs }));
    try {
      const output = this.process === Process.hierarchical
        ? await this.replayHierarchicalProcess(startIndex, replayInputs, previousOutputs)
        : await this.replaySequentialProcess(startIndex, replayInputs, previousOutputs);
      const usageDelta = subtractUsageMetrics(this.calculateUsageMetrics(), beforeUsage);
      this.setUsageMetrics(addUsageMetrics(this.usageMetrics, usageDelta));
      const finalOutput = withTokenUsage(output, usageDelta);
      crewaiEventBus.emit(this, new CrewKickoffCompletedEvent({ crewName: this.name, output: finalOutput }));
      return finalOutput;
    } catch (error) {
      crewaiEventBus.emit(this, new CrewKickoffFailedEvent({ crewName: this.name, error }));
      throw error;
    }
  }

  copy(): Crew {
    const agents = this.agents.map((agent) => copyAgent(agent));
    const agentByRole = new Map(agents.map((agent) => [agent.role, agent]));
    const taskPairs = this.tasks.map((task) => ({ original: task, copy: copyTask(task, agentByRole) }));
    const taskByOriginal = new Map(taskPairs.map(({ original, copy }) => [original, copy]));
    for (const { original, copy } of taskPairs) {
      Object.assign(copy, {
        context: original.context?.map((contextTask) => taskByOriginal.get(contextTask) ?? contextTask) ?? original.context,
      });
    }
    const managerAgent = this.managerAgent ? copyAgent(this.managerAgent) : null;
    return new Crew({
      name: this.name,
      config: this.config,
      agents,
      tasks: taskPairs.map(({ copy }) => copy),
      process: this.process,
      verbose: this.verbose,
      cache: this.cache,
      embedder: this.embedder,
      usageMetrics: this.usageMetrics,
      maxRpm: this.maxRpm,
      outputLogFile: this.outputLogFile,
      taskExecutionOutputJsonFiles: this.taskExecutionOutputJsonFiles,
      promptFile: this.promptFile,
      shareCrew: this.shareCrew,
      memory: this.memory,
      knowledge: this.knowledge,
      knowledgeSources: this.knowledgeSources,
      managerAgent,
      managerLlm: this.managerLlm,
      functionCallingLlm: this.functionCallingLlm,
      planning: this.planning,
      stream: this.stream,
      planningLlm: this.planningLlm,
      chatLlm: this.chatLlm,
      skills: this.skills,
      humanInputProvider: this.humanInputProvider,
      stepCallback: this.stepCallback,
      taskCallback: this.taskCallback,
      beforeKickoffCallbacks: this.beforeKickoffCallbacks,
      afterKickoffCallbacks: this.afterKickoffCallbacks,
      securityConfig: this.securityConfig.cloneWithNewFingerprint(),
      checkpoint: this.checkpoint,
      tracing: this.tracing,
      executionContext: this.executionContext?.clone() ?? null,
      checkpointInputs: this.checkpointInputs ? { ...this.checkpointInputs } : null,
      checkpointTrain: this.checkpointTrain,
      checkpointKickoffEventId: this.checkpointKickoffEventId,
      taskOutputStorageHandler: this.taskOutputStorageHandler,
    });
  }

  private async runProcess(inputs: InputValues, inputFiles?: TaskInputFiles): Promise<CrewOutput> {
    switch (this.process) {
      case Process.sequential:
        return this.runSequentialProcess(inputs, inputFiles);
      case Process.hierarchical:
        return this.runHierarchicalProcess(inputs, inputFiles);
      default:
        throw new Error(`Unsupported crew process: ${String(this.process)}`);
    }
  }

  private setupFromConfig(config: Record<string, unknown>): void {
    const agents = config.agents;
    const tasks = config.tasks;
    if (!Array.isArray(agents) || !Array.isArray(tasks)) {
      throw new Error("Config should have 'agents' and 'tasks'.");
    }
    this.process = parseProcess(config.process, this.process);
    this.agents = agents.map((agentConfig) => createAgentFromConfig(asRecord(agentConfig)));
    const agentByRole = new Map(this.agents.map((agent) => [agent.role, agent]));
    this.tasks = tasks.map((taskConfig) => {
      const taskRecord = asRecord(taskConfig);
      const agentName = typeof taskRecord.agent === "string" ? taskRecord.agent : null;
      const agent = agentName ? agentByRole.get(agentName) ?? null : null;
      const { agent: _agent, ...taskOptions } = taskRecord;
      void _agent;
      return new Task({
        ...taskOptions,
        description: stringifyConfigValue(taskOptions.description),
        expectedOutput: stringifyConfigValue(taskOptions.expectedOutput ?? taskOptions.expected_output),
        agent,
      });
    });
  }

  private async withStreamDisabled<T>(run: () => Promise<T>): Promise<T> {
    const previous = this.stream;
    this.stream = false;
    try {
      return await run();
    } finally {
      this.stream = previous;
    }
  }

  private async handleCrewPlanning(): Promise<void> {
    const planner = new CrewPlanner({
      tasks: this.tasks,
      planningAgentLlm: this.planningLlm,
    });
    const result = await planner.handleCrewPlanning();
    const planByTaskNumber = new Map<number, string>();
    for (const taskPlan of result.listOfPlansPerTask) {
      if (!planByTaskNumber.has(taskPlan.taskNumber)) {
        planByTaskNumber.set(taskPlan.taskNumber, taskPlan.plan);
      }
    }
    for (const [index, task] of this.tasks.entries()) {
      task.setExecutionPlan(planByTaskNumber.get(index + 1) ?? null);
    }
    const plannerUsage = planner.getUsageMetrics();
    if (plannerUsage) {
      this.planningUsageMetrics = addUsageMetrics(this.planningUsageMetrics, plannerUsage);
    }
  }

  private async runSequentialProcess(inputs: InputValues, inputFiles?: TaskInputFiles): Promise<CrewOutput> {
    this.validateSequentialTasks();
    const tasksOutput: TaskOutput[] = [];
    const pendingTasks: Array<{ task: Task; taskIndex: number; inputs: InputValues; promise: Promise<TaskOutput> }> = [];
    for (const [index, task] of this.tasks.entries()) {
      const fallbackAgent = this.agents[index] ?? this.agents.at(-1) ?? null;
      const tools = this.toolsForTask(task, fallbackAgent);
      if (task instanceof ConditionalTask) {
        if (pendingTasks.length > 0) {
          tasksOutput.push(...await this.processAsyncTasks(pendingTasks));
          pendingTasks.length = 0;
        }
        const skippedOutput = await this.handleConditionalTask(task, tasksOutput);
        if (skippedOutput) {
          tasksOutput.push(skippedOutput);
          continue;
        }
      }
      if (task.asyncExecution) {
        await this.logTaskStart(task, fallbackAgent);
        const context = this.contextForTask(task, tasksOutput);
        pendingTasks.push({
          task,
          taskIndex: index,
          inputs,
          promise: task.execute(inputs, fallbackAgent, tools, false, {
            stepCallbacks: this.stepCallbacksFor(fallbackAgent),
            humanInputProvider: this.humanInputProvider,
            taskCallback: this.taskCallback,
            functionCallingLlm: this.functionCallingLlm,
            memory: this.resolvedMemory,
            knowledge: this.knowledge,
            ...(inputFiles === undefined ? {} : { inputFiles }),
            ...(this.triggerPayloadForTask(task, index, inputs) === undefined
              ? {}
              : { triggerPayload: this.triggerPayloadForTask(task, index, inputs) }),
            ...(context === undefined ? {} : { context }),
          }),
        });
        continue;
      }
      if (pendingTasks.length > 0) {
        tasksOutput.push(...await this.processAsyncTasks(pendingTasks));
        pendingTasks.length = 0;
      }
      await this.logTaskStart(task, fallbackAgent);
      const context = this.contextForTask(task, tasksOutput);
      const output = await task.execute(inputs, fallbackAgent, tools, false, {
        stepCallbacks: this.stepCallbacksFor(fallbackAgent),
        humanInputProvider: this.humanInputProvider,
        taskCallback: this.taskCallback,
        functionCallingLlm: this.functionCallingLlm,
        memory: this.resolvedMemory,
        knowledge: this.knowledge,
        ...(inputFiles === undefined ? {} : { inputFiles }),
        ...(this.triggerPayloadForTask(task, index, inputs) === undefined
          ? {}
          : { triggerPayload: this.triggerPayloadForTask(task, index, inputs) }),
        ...(context === undefined ? {} : { context }),
      });
      await this.logTaskResult(task, output);
      await this.storeExecutionLog(task, output, index, inputs);
      tasksOutput.push(output);
    }

    if (pendingTasks.length > 0) {
      tasksOutput.push(...await this.processAsyncTasks(pendingTasks));
    }
    const lastOutput = tasksOutput.at(-1);

    return new CrewOutput({
      raw: lastOutput?.raw ?? "",
      pydantic: lastOutput?.pydantic ?? null,
      jsonDict: lastOutput?.jsonDict ?? null,
      tasksOutput,
    });
  }

  private async runHierarchicalProcess(inputs: InputValues, inputFiles?: TaskInputFiles): Promise<CrewOutput> {
    this.validateHierarchicalProcess();
    const manager = this.getManagerAgent();
    const tasksOutput: TaskOutput[] = [];
    for (const [index, task] of this.tasks.entries()) {
      if (task instanceof ConditionalTask) {
        const skippedOutput = await this.handleConditionalTask(task, tasksOutput);
        if (skippedOutput) {
          tasksOutput.push(skippedOutput);
          continue;
        }
      }
      const tools = this.toolsForHierarchicalTask(task);
      await this.logTaskStart(task, manager);
      const context = this.contextForTask(task, tasksOutput);
      const output = await task.execute(inputs, manager, tools, true, {
        stepCallbacks: this.stepCallbacksFor(manager),
        humanInputProvider: this.humanInputProvider,
        taskCallback: this.taskCallback,
        functionCallingLlm: this.functionCallingLlm,
        memory: this.resolvedMemory,
        knowledge: this.knowledge,
        ...(inputFiles === undefined ? {} : { inputFiles }),
        ...(this.triggerPayloadForTask(task, index, inputs) === undefined
          ? {}
          : { triggerPayload: this.triggerPayloadForTask(task, index, inputs) }),
        ...(context === undefined ? {} : { context }),
      });
      await this.logTaskResult(task, output);
      await this.storeExecutionLog(task, output, index, inputs);
      tasksOutput.push(output);
    }
    const lastOutput = tasksOutput.at(-1);

    return new CrewOutput({
      raw: lastOutput?.raw ?? "",
      pydantic: lastOutput?.pydantic ?? null,
      jsonDict: lastOutput?.jsonDict ?? null,
      tasksOutput,
    });
  }

  private async processAsyncTasks(
    pendingTasks: Array<{ task: Task; taskIndex: number; inputs: InputValues; promise: Promise<TaskOutput> }>,
  ): Promise<TaskOutput[]> {
    const outputs: TaskOutput[] = [];
    for (const pendingTask of pendingTasks) {
      const output = await pendingTask.promise;
      await this.logTaskResult(pendingTask.task, output);
      await this.storeExecutionLog(pendingTask.task, output, pendingTask.taskIndex, pendingTask.inputs);
      outputs.push(output);
    }
    return outputs;
  }

  private async logTaskStart(task: Task, agent: Agent | null): Promise<void> {
    await this.fileHandler?.log({
      taskName: task.name,
      task: task.description,
      agent: agent?.role ?? "None",
      status: "started",
    });
  }

  private async logTaskResult(task: Task, output: TaskOutput): Promise<void> {
    await this.fileHandler?.log({
      taskName: task.name,
      task: task.description,
      agent: task.agent?.role ?? output.agent,
      status: "completed",
      output: output.raw,
    });
  }

  private async storeExecutionLog(
    task: Task,
    output: TaskOutput,
    taskIndex: number,
    inputs: InputValues,
    wasReplayed = false,
  ): Promise<void> {
    const storedOutput: StoredTaskOutput = {
      description: output.description,
      summary: output.summary,
      raw: output.raw,
      pydantic: output.pydantic,
      jsonDict: output.jsonDict,
      json_dict: output.jsonDict,
      outputFormat: output.outputFormat,
      output_format: output.outputFormat,
      agent: output.agent,
      messages: output.messages,
    };
    const log: TaskExecutionLog = {
      task: {
        id: task.id,
        name: task.name,
        description: task.description,
        expectedOutput: task.expectedOutput,
      },
      output: storedOutput,
      taskIndex,
      inputs: { ...inputs },
      wasReplayed,
    };
    this.executionLogs[taskIndex] = log;
    this.taskOutputStorageHandler?.update(taskIndex, {
      task,
      output: storedOutput,
      taskIndex,
      inputs: { ...inputs },
      wasReplayed,
    });
    const outputFile = this.taskExecutionOutputJsonFiles?.[taskIndex];
    if (outputFile) {
      await mkdir(dirname(outputFile), { recursive: true });
      await writeFile(outputFile, `${JSON.stringify(log, null, 2)}\n`, "utf8");
    }
  }

  private validateSequentialTasks(): void {
    this.validateConditionalTasks();
    let finalAsyncTaskCount = 0;
    for (const task of [...this.tasks].reverse()) {
      if (!task.asyncExecution) {
        break;
      }
      finalAsyncTaskCount += 1;
    }
    if (finalAsyncTaskCount > 1) {
      throw new Error("The crew must end with at most one asynchronous task.");
    }

    const taskIndices = new Map(this.tasks.map((task, index) => [task, index]));
    for (const [taskIndex, task] of this.tasks.entries()) {
      for (const contextTask of task.context ?? []) {
        const contextIndex = taskIndices.get(contextTask);
        if (contextIndex === undefined) {
          continue;
        }
        if (contextIndex > taskIndex) {
          throw new Error(
            `Task '${task.description}' has a context dependency on a future task '${contextTask.description}'.`,
          );
        }
        if (task.asyncExecution && contextTask.asyncExecution) {
          const hasSyncBarrier = this.tasks
            .slice(contextIndex + 1, taskIndex)
            .some((candidate) => !candidate.asyncExecution);
          if (!hasSyncBarrier) {
            throw new Error(
              `Task '${task.description}' is asynchronous and cannot include another sequential asynchronous task in its context.`,
            );
          }
        }
      }
    }
  }

  private validateConditionalTasks(): void {
    if (this.tasks.length > 0 && this.tasks.every((task) => task instanceof ConditionalTask)) {
      throw new Error("Crew must include at least one non-conditional task.");
    }
    if (this.tasks[0] instanceof ConditionalTask) {
      throw new Error("The first task cannot be a ConditionalTask.");
    }
    for (const task of this.tasks) {
      if (task instanceof ConditionalTask && task.asyncExecution) {
        throw new Error("ConditionalTask cannot be executed asynchronously.");
      }
    }
  }

  private async handleConditionalTask(
    task: ConditionalTask,
    tasksOutput: readonly TaskOutput[],
  ): Promise<TaskOutput | null> {
    const previousOutput = tasksOutput.at(-1);
    if (previousOutput && !await task.shouldExecute(previousOutput)) {
      return task.getSkippedTaskOutput();
    }
    return null;
  }

  private contextForTask(task: Task, previousOutputs: readonly TaskOutput[]): string | undefined {
    if (task.context === undefined) {
      const context = previousOutputs
        .map((output) => output.toString())
        .filter(Boolean)
        .join("\n\n");
      return context || undefined;
    }
    return undefined;
  }

  private triggerPayloadForTask(task: Task, taskIndex: number, inputs: InputValues): unknown {
    if (!("crewai_trigger_payload" in inputs)) {
      return undefined;
    }
    if (task.allowCrewaiTriggerContext === true) {
      return inputs.crewai_trigger_payload;
    }
    if (task.allowCrewaiTriggerContext === false) {
      return undefined;
    }
    return this.process === Process.sequential && taskIndex === 0
      ? inputs.crewai_trigger_payload
      : undefined;
  }

  private async replaySequentialProcess(
    startIndex: number,
    inputs: InputValues,
    initialOutputs: readonly TaskOutput[],
  ): Promise<CrewOutput> {
    this.validateSequentialTasks();
    const tasksOutput = [...initialOutputs];
    for (let index = startIndex; index < this.tasks.length; index += 1) {
      const task = this.tasks[index];
      if (!task) {
        continue;
      }
      const fallbackAgent = this.agents[index] ?? this.agents.at(-1) ?? null;
      const tools = this.toolsForTask(task, fallbackAgent);
      if (task instanceof ConditionalTask) {
        const skippedOutput = await this.handleConditionalTask(task, tasksOutput);
        if (skippedOutput) {
          tasksOutput.push(skippedOutput);
          continue;
        }
      }
      await this.logTaskStart(task, fallbackAgent);
      const context = this.contextForTask(task, tasksOutput);
      const output = await task.execute(inputs, fallbackAgent, tools, false, {
        stepCallbacks: this.stepCallbacksFor(fallbackAgent),
        humanInputProvider: this.humanInputProvider,
        taskCallback: this.taskCallback,
        functionCallingLlm: this.functionCallingLlm,
        memory: this.resolvedMemory,
        knowledge: this.knowledge,
        ...(this.triggerPayloadForTask(task, index, inputs) === undefined
          ? {}
          : { triggerPayload: this.triggerPayloadForTask(task, index, inputs) }),
        ...(context === undefined ? {} : { context }),
      });
      await this.logTaskResult(task, output);
      await this.storeExecutionLog(task, output, index, inputs, true);
      tasksOutput.push(output);
    }
    return crewOutputFromTasks(tasksOutput);
  }

  private async replayHierarchicalProcess(
    startIndex: number,
    inputs: InputValues,
    initialOutputs: readonly TaskOutput[],
  ): Promise<CrewOutput> {
    this.validateHierarchicalProcess();
    const manager = this.getManagerAgent();
    const tasksOutput = [...initialOutputs];
    for (let index = startIndex; index < this.tasks.length; index += 1) {
      const task = this.tasks[index];
      if (!task) {
        continue;
      }
      if (task instanceof ConditionalTask) {
        const skippedOutput = await this.handleConditionalTask(task, tasksOutput);
        if (skippedOutput) {
          tasksOutput.push(skippedOutput);
          continue;
        }
      }
      const tools = this.toolsForHierarchicalTask(task);
      await this.logTaskStart(task, manager);
      const context = this.contextForTask(task, tasksOutput);
      const output = await task.execute(inputs, manager, tools, true, {
        stepCallbacks: this.stepCallbacksFor(manager),
        humanInputProvider: this.humanInputProvider,
        taskCallback: this.taskCallback,
        functionCallingLlm: this.functionCallingLlm,
        memory: this.resolvedMemory,
        knowledge: this.knowledge,
        ...(this.triggerPayloadForTask(task, index, inputs) === undefined
          ? {}
          : { triggerPayload: this.triggerPayloadForTask(task, index, inputs) }),
        ...(context === undefined ? {} : { context }),
      });
      await this.logTaskResult(task, output);
      await this.storeExecutionLog(task, output, index, inputs, true);
      tasksOutput.push(output);
    }
    return crewOutputFromTasks(tasksOutput);
  }

  private findReplayStartIndex(taskRef: ReplayTaskRef): number {
    const index = typeof taskRef === "number"
      ? taskRef
      : this.tasks.findIndex((task) =>
        task === taskRef
        || task.id === taskRef
        || task.name === taskRef,
      );
    if (index < 0 || index >= this.tasks.length) {
      throw new Error(`Task '${formatReplayTaskRef(taskRef)}' not found in the crew's tasks.`);
    }
    return index;
  }

  private validateHierarchicalProcess(): void {
    this.validateConditionalTasks();
    if (!this.managerAgent && !this.managerLlm) {
      throw new Error("Attribute `managerLlm` or `managerAgent` is required when using hierarchical process.");
    }
    if (this.managerAgent && this.agents.includes(this.managerAgent)) {
      throw new Error("Manager agent should not be included in agents list.");
    }
    if (this.managerAgent && this.managerAgent.tools.length > 0) {
      throw new Error("Manager agent should not have tools.");
    }
  }

  private getManagerAgent(): Agent {
    if (this.managerAgent) {
      return this.managerAgent;
    }
    if (!this.managerLlm) {
      throw new Error("Attribute `managerLlm` or `managerAgent` is required when using hierarchical process.");
    }
    this.managerAgent = new Agent({
      role: "Crew Manager",
      goal: "Coordinate coworkers and ensure tasks are completed.",
      backstory: "A manager agent responsible for delegating work and collecting final answers.",
      allowDelegation: true,
      llm: this.managerLlm,
      functionCallingLlm: this.functionCallingLlm,
      verbose: this.verbose,
    });
    if (this.rpmController) {
      this.managerAgent.setRpmController(this.rpmController);
    }
    return this.managerAgent;
  }

  private resolveMemory(memory: boolean | Memory | MemoryScope): Memory | MemoryScope | null {
    if (memory === true) {
      return new Memory({ rootScope: `/crew/${sanitizeScopeName(this.name ?? "crew")}` });
    }
    if (memory instanceof Memory) {
      return memory;
    }
    if (memory && typeof memory === "object" && "recall" in memory && "remember" in memory) {
      return memory;
    }
    return null;
  }

  queryKnowledge(query: string | readonly string[], resultsLimit = 3, scoreThreshold = 0.35) {
    return this.knowledge?.query(query, { resultsLimit, scoreThreshold }) ?? null;
  }

  query_knowledge(query: string | readonly string[], results_limit = 3, score_threshold = 0.35) {
    return this.queryKnowledge(query, results_limit, score_threshold);
  }

  async aqueryKnowledge(query: string | readonly string[], resultsLimit = 3, scoreThreshold = 0.35) {
    if (!this.knowledge) {
      return null;
    }
    return await Promise.resolve(this.knowledge.query(query, { resultsLimit, scoreThreshold }));
  }

  async aquery_knowledge(query: string | readonly string[], results_limit = 3, score_threshold = 0.35) {
    return await this.aqueryKnowledge(query, results_limit, score_threshold);
  }

  resetMemories(commandType: ResetMemoriesCommandType): void {
    const normalizedCommandType = normalizeResetMemoriesCommandType(commandType);
    if (normalizedCommandType === "all") {
      this.resetAvailableMemorySystems();
      return;
    }
    this.resetSpecificMemorySystem(normalizedCommandType);
  }

  reset_memories(commandType: ResetMemoriesCommandType): void {
    this.resetMemories(commandType);
  }

  fetchInputs(): Set<string> {
    const requiredInputs = new Set<string>();
    for (const task of this.tasks) {
      collectPlaceholders(`${task.description} ${task.expectedOutput}`, requiredInputs);
    }
    for (const agent of this.agents) {
      collectPlaceholders(`${agent.role} ${agent.goal} ${agent.backstory}`, requiredInputs);
    }
    return requiredInputs;
  }

  fetch_inputs(): Set<string> {
    return this.fetchInputs();
  }

  resetKnowledge(knowledges: readonly Knowledge[]): void {
    for (const knowledge of knowledges) {
      knowledge.reset();
    }
  }

  reset_knowledge(knowledges: readonly Knowledge[]): void {
    this.resetKnowledge(knowledges);
  }

  getAgentToUse(task: Task): Agent | null {
    return this.process === Process.hierarchical
      ? this.getManagerAgent()
      : task.agent;
  }

  _get_agent_to_use(task: Task): Agent | null {
    return this.getAgentToUse(task);
  }

  static mergeTools(existingTools: readonly Tool[], newTools: readonly Tool[]): Tool[] {
    return mergeTools(existingTools, newTools);
  }

  static _merge_tools(existing_tools: readonly Tool[], new_tools: readonly Tool[]): Tool[] {
    return Crew.mergeTools(existing_tools, new_tools);
  }

  getContext(task: Task, taskOutputs: readonly TaskOutput[]): string {
    return this.contextForTask(task, taskOutputs) ?? "";
  }

  _get_context(task: Task, task_outputs: readonly TaskOutput[]): string {
    return this.getContext(task, task_outputs);
  }

  async processTaskResult(task: Task, output: TaskOutput): Promise<void> {
    await this.logTaskResult(task, output);
  }

  async _process_task_result(task: Task, output: TaskOutput): Promise<void> {
    await this.processTaskResult(task, output);
  }

  createCrewOutput(taskOutputs: readonly TaskOutput[]): CrewOutput {
    if (taskOutputs.length === 0) {
      throw new Error("No task outputs available to create crew output.");
    }
    const finalTaskOutput = [...taskOutputs].reverse().find((output) => output.raw.length > 0);
    if (!finalTaskOutput) {
      throw new Error("No valid task outputs available to create crew output.");
    }
    return new CrewOutput({
      raw: finalTaskOutput.raw,
      pydantic: finalTaskOutput.pydantic,
      jsonDict: finalTaskOutput.jsonDict,
      tasksOutput: taskOutputs,
      tokenUsage: this.calculateUsageMetrics(),
    });
  }

  _create_crew_output(task_outputs: readonly TaskOutput[]): CrewOutput {
    return this.createCrewOutput(task_outputs);
  }

  static findTaskIndex(taskId: string, storedOutputs: readonly unknown[]): number | null {
    const index = storedOutputs.findIndex((storedOutput) => {
      if (!storedOutput || typeof storedOutput !== "object") {
        return false;
      }
      const record = storedOutput as { task_id?: unknown; taskId?: unknown; task?: { id?: unknown } };
      return record.task_id === taskId
        || record.taskId === taskId
        || record.task?.id === taskId;
    });
    return index === -1 ? null : index;
  }

  static _find_task_index(task_id: string, stored_outputs: readonly unknown[]): number | null {
    return Crew.findTaskIndex(task_id, stored_outputs);
  }

  private toolsForTask(task: Task, agent: Agent | null): readonly Tool[] | undefined {
    const baseTools = task.tools.length > 0 ? [...task.tools] : [...(agent?.tools ?? [])];
    const withDelegation = agent?.allowDelegation
      ? mergeTools(baseTools, createDelegationTools(this.coworkersFor(agent)))
      : baseTools;
    const tools = this.resolvedMemory
      ? mergeTools(withDelegation, createMemoryTools(this.resolvedMemory))
      : withDelegation;
    return tools.length > 0 ? this.applyCrewCache(tools) : undefined;
  }

  private toolsForHierarchicalTask(task: Task): readonly Tool[] {
    const baseTools = task.tools.length > 0 ? [...task.tools] : [];
    const coworkers = task.agent ? [task.agent] : this.agents;
    const delegationTools = createDelegationTools(coworkers);
    const withDelegation = mergeTools(baseTools, delegationTools);
    const tools = this.resolvedMemory
      ? mergeTools(withDelegation, createMemoryTools(this.resolvedMemory))
      : withDelegation;
    return this.applyCrewCache(tools);
  }

  private applyCrewCache(tools: readonly Tool[]): readonly Tool[] {
    if (this.cache) {
      return tools;
    }
    return tools.map((tool) => tool instanceof BaseTool ? tool.withCache(false) : tool);
  }

  private stepCallbacksFor(agent: Agent | null): readonly AgentStepCallback[] {
    if (!this.stepCallback || this.stepCallback === agent?.stepCallback) {
      return [];
    }
    return [this.stepCallback];
  }

  private coworkersFor(agent: Agent): readonly Agent[] {
    return this.agents.filter((candidate) => candidate !== agent && candidate.role !== agent.role);
  }

  private resetAvailableMemorySystems(): void {
    for (const config of Object.values(this.getMemorySystems())) {
      if (config.system) {
        config.reset(config.system);
      }
    }
  }

  private resetSpecificMemorySystem(memoryType: Exclude<ReturnType<typeof normalizeResetMemoriesCommandType>, "all">): void {
    const config = this.getMemorySystems()[memoryType];
    if (!config.system) {
      throw new Error(`${config.name} memory system is not initialized`);
    }
    config.reset(config.system);
  }

  private getMemorySystems(): Record<Exclude<ReturnType<typeof normalizeResetMemoriesCommandType>, "all">, {
    system: Memory | MemoryScope | readonly Knowledge[] | Crew | null;
    name: string;
    reset: (system: Memory | MemoryScope | readonly Knowledge[] | Crew) => void;
  }> {
    const agentKnowledges = this.agents
      .map((agent) => agent.knowledge)
      .filter((knowledge): knowledge is Knowledge => knowledge !== null);
    const crewAndAgentKnowledges = [
      ...(this.knowledge ? [this.knowledge] : []),
      ...agentKnowledges,
    ];
    return {
      memory: {
        system: this.resolvedMemory,
        name: "Memory",
        reset: (system) => {
          if (system instanceof Memory) {
            system.reset();
            return;
          }
          if (system instanceof MemoryScope) {
            system.memory.reset(system.rootPath);
          }
        },
      },
      kickoff_outputs: {
        system: this,
        name: "Task Output",
        reset: (system) => {
          if (system instanceof Crew) {
            system.executionLogs = [];
            system.taskOutputStorageHandler?.reset();
            for (const task of system.tasks) {
              task.output = null;
            }
          }
        },
      },
      knowledge: {
        system: crewAndAgentKnowledges.length > 0 ? crewAndAgentKnowledges : null,
        name: "Crew Knowledge and Agent Knowledge",
        reset: (system) => {
          if (Array.isArray(system)) {
            this.resetKnowledge(system);
          }
        },
      },
      agent_knowledge: {
        system: agentKnowledges.length > 0 ? agentKnowledges : null,
        name: "Agent Knowledge",
        reset: (system) => {
          if (Array.isArray(system)) {
            this.resetKnowledge(system);
          }
        },
      },
    };
  }

  calculateUsageMetrics(): UsageMetrics {
    let total = emptyUsageMetrics();
    for (const agent of this.agents) {
      total = addUsageMetrics(total, agent.getUsageMetrics());
    }
    if (this.managerAgent && !this.agents.includes(this.managerAgent)) {
      total = addUsageMetrics(total, this.managerAgent.getUsageMetrics());
    }
    total = addUsageMetrics(total, this.planningUsageMetrics);
    return total;
  }

  calculate_usage_metrics(): UsageMetrics {
    return this.calculateUsageMetrics();
  }

  toString(): string {
    return `Crew(id=${this.id}, process=${this.process}, number_of_agents=${String(this.agents.length)}, number_of_tasks=${String(this.tasks.length)})`;
  }

  __repr__(): string {
    return this.toString();
  }
}

function mergeTools(baseTools: readonly Tool[], additionalTools: readonly Tool[]): Tool[] {
  const byName = new Map<string, Tool>();
  for (const tool of baseTools) {
    byName.set(sanitizeToolName(tool.name), tool);
  }
  for (const tool of additionalTools) {
    const normalizedName = sanitizeToolName(tool.name);
    if (!byName.has(normalizedName)) {
      byName.set(normalizedName, tool);
    }
  }
  return [...byName.values()];
}

function sanitizeScopeName(value: string): string {
  return value.trim().toLowerCase().replaceAll(/[^a-z0-9가-힣]+/g, "-").replaceAll(/^-|-$/g, "") || "crew";
}

function normalizeResetMemoriesCommandType(commandType: ResetMemoriesCommandType) {
  if (commandType === "long" || commandType === "short" || commandType === "entity" || commandType === "external") {
    return "memory" as const;
  }
  return commandType;
}

function parseProcess(value: unknown, fallback: Process): Process {
  return value === Process.hierarchical || value === "hierarchical"
    ? Process.hierarchical
    : value === Process.sequential || value === "sequential"
      ? Process.sequential
      : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected object configuration.");
  }
  return value as Record<string, unknown>;
}

function stringifyConfigValue(value: unknown): string {
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

function createAgentFromConfig(config: Record<string, unknown>): Agent {
  return new Agent({
    ...config,
    role: stringifyConfigValue(config.role),
    goal: stringifyConfigValue(config.goal),
    backstory: stringifyConfigValue(config.backstory),
  });
}

function agentKey(agent: Agent): string {
  const maybeKey = (agent as unknown as { key?: unknown }).key;
  if (typeof maybeKey === "string") {
    return maybeKey;
  }
  return createHash("md5")
    .update([agent.role, agent.goal, agent.backstory].join("|"))
    .digest("hex");
}

function formatReplayTaskRef(taskRef: ReplayTaskRef): string {
  if (typeof taskRef === "number" || typeof taskRef === "string") {
    return String(taskRef);
  }
  return taskRef.name ?? taskRef.id;
}

function createDelegationTools(agents: readonly Agent[]): Tool[] {
  if (agents.length === 0) {
    return [];
  }
  const coworkers = agents.map((agent) => agent.role).join(", ");
  return [
    new StructuredTool({
      name: "Delegate work to coworker",
      description: `Delegate a task to one of these coworkers: ${coworkers}`,
      argsSchema: {
        task: { type: "string", required: true },
        context: { type: "string", required: false, default: "" },
        coworker: { type: "string", required: true },
      },
      func: async ({ task, context, coworker }) => {
        const agent = findCoworker(agents, String(coworker));
        if (!agent) {
          return missingCoworkerMessage(agents, String(coworker));
        }
        const contextText = typeof context === "string" ? context : "";
        return agent.executeTask(
          [String(task), contextText ? `Context:\n${contextText}` : null]
            .filter((part): part is string => part !== null)
            .join("\n\n"),
        );
      },
    }),
    new StructuredTool({
      name: "Ask question to coworker",
      description: `Ask a question to one of these coworkers: ${coworkers}`,
      argsSchema: {
        question: { type: "string", required: true },
        context: { type: "string", required: false, default: "" },
        coworker: { type: "string", required: true },
      },
      func: async ({ question, context, coworker }) => {
        const agent = findCoworker(agents, String(coworker));
        if (!agent) {
          return missingCoworkerMessage(agents, String(coworker));
        }
        const contextText = typeof context === "string" ? context : "";
        return agent.executeTask(
          [String(question), contextText ? `Context:\n${contextText}` : null]
            .filter((part): part is string => part !== null)
            .join("\n\n"),
        );
      },
    }),
  ];
}

function findCoworker(agents: readonly Agent[], coworker: string): Agent | null {
  const sanitized = sanitizeCoworker(coworker);
  return agents.find((agent) => sanitizeCoworker(agent.role) === sanitized) ?? null;
}

function sanitizeCoworker(value: string): string {
  const withoutList = value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1).split(",")[0] ?? "" : value;
  return sanitizeToolName(withoutList).replaceAll("_", " ").replaceAll("\"", "").trim().toLowerCase();
}

function missingCoworkerMessage(agents: readonly Agent[], coworker: string): string {
  return `No agent found with role '${sanitizeCoworker(coworker)}'. Available coworkers: ${agents.map((agent) => agent.role).join(", ")}`;
}

function copyAgent(agent: Agent): Agent {
  return agent.copy();
}

function resolveCrewSkills(skills: readonly unknown[]): unknown[] {
  const seen = new Set<string>();
  const resolved: unknown[] = [];
  for (const item of skills) {
    for (const candidate of resolveCrewSkillItem(item)) {
      const key = crewSkillDedupeKey(candidate);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      resolved.push(candidate);
    }
  }
  return resolved;
}

function resolveCrewSkillItem(item: unknown): unknown[] {
  if (item instanceof Skill) {
    return [activateSkill(item)];
  }
  if (typeof item !== "string") {
    return [item];
  }
  if (item.startsWith("@")) {
    return [resolveRegistryRef(item, null, { cwd: process.cwd() })];
  }
  if (existsSync(item) && statSync(item).isDirectory()) {
    return discoverSkills(item).map((skill) => activateSkill(skill));
  }
  return [item];
}

function crewSkillDedupeKey(skill: unknown): string {
  if (skill instanceof Skill) {
    return `skill:${skill.name}`;
  }
  if (typeof skill === "string") {
    return `string:${skill}`;
  }
  if (skill && typeof skill === "object") {
    const name = (skill as { name?: unknown }).name;
    if (typeof name === "string") {
      return `object:${name}`;
    }
  }
  return `value:${JSON.stringify(skill)}`;
}

function copyTask(task: Task, agentByRole: ReadonlyMap<string, Agent>): Task {
  const options = {
    id: task.id,
    name: task.name,
    description: task.description,
    expectedOutput: task.expectedOutput,
    config: task.config,
    promptContext: task.promptContext,
    agent: task.agent ? agentByRole.get(task.agent.role) ?? task.agent : null,
    context: task.context,
    tools: task.tools,
    callback: task.callback,
    callbacks: task.callbacks,
    outputJson: task.outputJson,
    outputPydantic: task.outputPydantic,
    outputConverter: task.outputConverter,
    responseModel: task.responseModel,
    outputFile: task.outputFile,
    inputFiles: task.inputFiles,
    createDirectory: task.createDirectory,
    asyncExecution: task.asyncExecution,
    humanInput: task.humanInput,
    markdown: task.markdown,
    allowCrewaiTriggerContext: task.allowCrewaiTriggerContext,
    guardrail: task.guardrail,
    guardrails: task.guardrails,
    guardrailMaxRetries: task.guardrailMaxRetries,
    max_retries: task.max_retries,
    retryCount: task.retryCount,
    usedTools: task.usedTools,
    toolsErrors: task.toolsErrors,
    delegations: task.delegations,
    processedByAgents: task.processedByAgents,
    startTime: task.startTime,
    endTime: task.endTime,
    output: task.output,
    checkpointOriginalDescription: task.checkpointOriginalDescription,
    checkpointOriginalExpectedOutput: task.checkpointOriginalExpectedOutput,
    checkpointOriginalOutputFile: task.checkpointOriginalOutputFile,
    securityConfig: task.securityConfig.cloneWithNewFingerprint(),
  };
  if (task instanceof ConditionalTask) {
    return new ConditionalTask({
      ...options,
      condition: task.condition,
    });
  }
  return new Task(options);
}

function withTokenUsage(output: CrewOutput, tokenUsage: UsageMetrics): CrewOutput {
  return new CrewOutput({
    raw: output.raw,
    pydantic: output.pydantic,
    jsonDict: output.jsonDict,
    tasksOutput: output.tasksOutput,
    tokenUsage,
  });
}

function crewOutputFromTasks(tasksOutput: readonly TaskOutput[]): CrewOutput {
  const lastOutput = tasksOutput.at(-1);
  return new CrewOutput({
    raw: lastOutput?.raw ?? "",
    pydantic: lastOutput?.pydantic ?? null,
    jsonDict: lastOutput?.jsonDict ?? null,
    tasksOutput,
  });
}

function collectPlaceholders(text: string, target: Set<string>): void {
  for (const match of text.matchAll(/\{(.+?)\}/g)) {
    const name = match[1]?.trim();
    if (name) {
      target.add(name);
    }
  }
}
