import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { parse } from "yaml";

import { Agent, type AgentGuardrail, type AgentOptions, type CodeExecutionMode } from "./agent.js";
import { Crew } from "./crew.js";
import type { PlanningConfig, PlanningConfigOptions } from "./agent-planning.js";
import { Task, type TaskInputFiles, type TaskOptions, type TaskOutputConverter } from "./task.js";
import type { AgentStepCallback, LLM, TaskCallback, Tool } from "./types.js";
import type { CacheHandler } from "./tools.js";
import type { EmbedderConfig } from "./rag.js";
import { getCrewMetadata } from "./metadata.js";

export type ConfigRecord = Record<string, unknown>;
export type ProjectConfig = Record<string, ConfigRecord>;
export type ConfigSource = string | ProjectConfig | null | undefined;

export type AgentConfig = {
  role?: string;
  goal?: string;
  backstory?: string;
  llm?: string | LLM | null;
  function_calling_llm?: string | LLM | null;
  functionCallingLlm?: string | LLM | null;
  crew?: unknown;
  tools?: readonly string[] | readonly Tool[];
  cache?: boolean;
  cache_handler?: string | CacheHandler;
  cacheHandler?: string | CacheHandler;
  tools_results?: readonly Record<string, unknown>[];
  toolsResults?: readonly Record<string, unknown>[];
  callbacks?: readonly string[] | readonly TaskCallback[];
  step_callback?: string | AgentStepCallback;
  stepCallback?: string | AgentStepCallback;
  verbose?: boolean;
  allow_delegation?: boolean;
  allowDelegation?: boolean;
  allow_code_execution?: boolean | null;
  allowCodeExecution?: boolean | null;
  code_execution_mode?: CodeExecutionMode;
  codeExecutionMode?: CodeExecutionMode;
  respect_context_window?: boolean;
  respectContextWindow?: boolean;
  multimodal?: boolean;
  max_iter?: number;
  maxIter?: number;
  max_retry_limit?: number;
  maxRetryLimit?: number;
  max_execution_time?: number | null;
  maxExecutionTime?: number | null;
  max_rpm?: number | null;
  maxRpm?: number | null;
  max_tokens?: number | null;
  maxTokens?: number | null;
  use_system_prompt?: boolean | null;
  useSystemPrompt?: boolean | null;
  system_template?: string | null;
  systemTemplate?: string | null;
  prompt_template?: string | null;
  promptTemplate?: string | null;
  response_template?: string | null;
  responseTemplate?: string | null;
  inject_date?: boolean;
  injectDate?: boolean;
  date_format?: string;
  dateFormat?: string;
  guardrail?: AgentGuardrail | string | null;
  guardrail_max_retries?: number;
  guardrailMaxRetries?: number;
  knowledge_storage?: unknown;
  knowledgeStorage?: unknown;
  knowledge_config?: Record<string, unknown> | null;
  knowledgeConfig?: Record<string, unknown> | null;
  embedder?: EmbedderConfig | null;
  agent_knowledge_context?: string | null;
  agentKnowledgeContext?: string | null;
  crew_knowledge_context?: string | null;
  crewKnowledgeContext?: string | null;
  knowledge_search_query?: string | null;
  knowledgeSearchQuery?: string | null;
  apps?: readonly unknown[] | null;
  mcps?: readonly unknown[] | null;
  a2a?: unknown;
  adapted_agent?: boolean;
  adaptedAgent?: boolean;
  from_repository?: string | null;
  fromRepository?: string | null;
  agent_executor?: unknown;
  agentExecutor?: unknown;
  executor_class?: unknown;
  executorClass?: unknown;
  planning?: boolean;
  planning_config?: PlanningConfig | PlanningConfigOptions | null;
  planningConfig?: PlanningConfig | PlanningConfigOptions | null;
  reasoning?: boolean;
  max_reasoning_attempts?: number | null;
  maxReasoningAttempts?: number | null;
  [key: string]: unknown;
};

export type TaskConfig = {
  name?: string | null;
  description?: string;
  expected_output?: string;
  expectedOutput?: string;
  config?: Record<string, unknown> | null;
  prompt_context?: string | null;
  promptContext?: string | null;
  agent?: string | Agent | null;
  context?: readonly string[] | readonly Task[] | null;
  tools?: readonly string[] | readonly Tool[];
  callback?: string | TaskCallback | null;
  callbacks?: readonly string[] | readonly TaskCallback[];
  output_json?: boolean | string | TaskOutputConverter | null;
  outputJson?: boolean | string | TaskOutputConverter | null;
  output_pydantic?: string | TaskOutputConverter | null;
  outputPydantic?: string | TaskOutputConverter | null;
  output_converter?: string | TaskOutputConverter | null;
  outputConverter?: string | TaskOutputConverter | null;
  converter_cls?: string | TaskOutputConverter | null;
  converterCls?: string | TaskOutputConverter | null;
  output_file?: string | null;
  outputFile?: string | null;
  input_files?: TaskInputFiles;
  inputFiles?: TaskInputFiles;
  create_directory?: boolean;
  createDirectory?: boolean;
  response_model?: unknown;
  responseModel?: unknown;
  async_execution?: boolean;
  asyncExecution?: boolean;
  human_input?: boolean;
  humanInput?: boolean;
  markdown?: boolean;
  allow_crewai_trigger_context?: boolean | null;
  allowCrewaiTriggerContext?: boolean | null;
  guardrail?: TaskOptions["guardrail"] | string | null;
  guardrails?: TaskOptions["guardrails"] | readonly string[] | string | null;
  guardrail_max_retries?: number;
  guardrailMaxRetries?: number;
  max_retries?: number;
  retry_count?: number;
  retryCount?: number;
  used_tools?: number;
  usedTools?: number;
  tools_errors?: number;
  toolsErrors?: number;
  delegations?: number;
  processed_by_agents?: Iterable<string>;
  processedByAgents?: Iterable<string>;
  start_time?: Date | string | null;
  startTime?: Date | string | null;
  end_time?: Date | string | null;
  endTime?: Date | string | null;
  checkpoint_original_description?: string | null;
  checkpointOriginalDescription?: string | null;
  checkpoint_original_expected_output?: string | null;
  checkpointOriginalExpectedOutput?: string | null;
  checkpoint_original_output_file?: string | null;
  checkpointOriginalOutputFile?: string | null;
  [key: string]: unknown;
};

export type CrewProjectState = {
  baseDirectory: string;
  agentsConfig: Record<string, AgentConfig>;
  tasksConfig: Record<string, TaskConfig>;
};

export type CrewProjectLike = {
  baseDirectory?: string;
  agentsConfig?: ConfigSource;
  tasksConfig?: ConfigSource;
  agents_config?: ConfigSource;
  tasks_config?: ConfigSource;
  __crewProjectState__?: CrewProjectState;
};

export class CrewProject {
  baseDirectory = process.cwd();
  agentsConfig: ConfigSource = "config/agents.yaml";
  tasksConfig: ConfigSource = "config/tasks.yaml";

  agentConfig(name: string): AgentConfig {
    const config = ensureCrewProject(this).agentsConfig[name];
    if (!config) {
      throw new Error(`No agent config named '${name}'.`);
    }
    return config;
  }

  taskConfig(name: string): TaskConfig {
    const config = ensureCrewProject(this).tasksConfig[name];
    if (!config) {
      throw new Error(`No task config named '${name}'.`);
    }
    return config;
  }
}

export function ensureCrewProject(instance: object): CrewProjectState {
  const project = instance as CrewProjectLike;
  if (project.__crewProjectState__) {
    return project.__crewProjectState__;
  }

  const baseDirectory = project.baseDirectory ?? process.cwd();
  const agentsSource = project.agentsConfig ?? project.agents_config ?? "config/agents.yaml";
  const tasksSource = project.tasksConfig ?? project.tasks_config ?? "config/tasks.yaml";
  const state: CrewProjectState = {
    baseDirectory,
    agentsConfig: loadConfig(agentsSource, baseDirectory),
    tasksConfig: loadConfig(tasksSource, baseDirectory),
  };
  project.__crewProjectState__ = state;

  mapAgentVariables(instance, state);
  mapTaskVariables(instance, state);
  project.agentsConfig = state.agentsConfig;
  project.tasksConfig = state.tasksConfig;
  return state;
}

export function loadConfig(source: ConfigSource, baseDirectory = process.cwd()): ProjectConfig {
  if (!source) {
    return {};
  }
  if (typeof source !== "string") {
    return normalizeProjectConfig(source);
  }

  const fullPath = isAbsolute(source) ? source : join(baseDirectory, source);
  if (!existsSync(fullPath)) {
    return {};
  }

  const parsed: unknown = parse(readFileSync(fullPath, "utf8"));
  return isProjectConfig(parsed) ? normalizeProjectConfig(parsed) : {};
}

export function mapAgentVariables(instance: object, state: CrewProjectState): void {
  const llms = getMethodsByKind(instance, "llm");
  const tools = getMethodsByKind(instance, "tool");
  const callbacks = getMethodsByKind(instance, "callback");
  const cacheHandlers = getMethodsByKind(instance, "cacheHandler");

  for (const [agentName, config] of Object.entries(state.agentsConfig)) {
    const mapped: AgentConfig = { ...config };
    if (typeof mapped.llm === "string" && llms.has(mapped.llm)) {
      mapped.llm = llms.get(mapped.llm)?.() as LLM;
    }
    const functionCallingLlm = mapped.functionCallingLlm ?? mapped.function_calling_llm;
    if (typeof functionCallingLlm === "string" && llms.has(functionCallingLlm)) {
      mapped.functionCallingLlm = llms.get(functionCallingLlm)?.() as LLM;
      mapped.function_calling_llm = mapped.functionCallingLlm;
    }
    if (isStringArray(mapped.tools)) {
      mapped.tools = mapped.tools.map((toolName) => callMapped(tools, toolName) as Tool);
    }
    const cacheHandler = mapped.cacheHandler ?? mapped.cache_handler;
    if (typeof cacheHandler === "string" && cacheHandlers.has(cacheHandler)) {
      mapped.cacheHandler = callMapped(cacheHandlers, cacheHandler) as CacheHandler;
      mapped.cache_handler = mapped.cacheHandler;
    }
    const stepCallback = mapped.stepCallback ?? mapped.step_callback;
    if (typeof stepCallback === "string" && callbacks.has(stepCallback)) {
      mapped.stepCallback = callbacks.get(stepCallback)?.() as AgentStepCallback;
      mapped.step_callback = mapped.stepCallback;
    }
    if (isStringArray(mapped.callbacks)) {
      mapped.callbacks = mapped.callbacks.map((callbackName) =>
        callMapped(callbacks, callbackName) as TaskCallback,
      );
    }
    if (typeof mapped.guardrail === "string") {
      mapped.guardrail = callMapped(callbacks, mapped.guardrail) as AgentGuardrail;
    }
    state.agentsConfig[agentName] = mapped;
  }
}

export function mapTaskVariables(instance: object, state: CrewProjectState): void {
  const agents = getMethodsByKind(instance, "agent");
  const tasks = getMethodsByKind(instance, "task");
  const tools = getMethodsByKind(instance, "tool");
  const callbacks = getMethodsByKind(instance, "callback");
  const outputJsons = getMethodsByKind(instance, "outputJson");
  const outputPydantics = getMethodsByKind(instance, "outputPydantic");

  for (const [taskName, config] of Object.entries(state.tasksConfig)) {
    const mapped: TaskConfig = { ...config };
    if (typeof mapped.agent === "string") {
      mapped.agent = callMapped(agents, mapped.agent) as Agent;
    }
    if (isStringArray(mapped.context)) {
      mapped.context = mapped.context.map((contextName) => callMapped(tasks, contextName) as Task);
    }
    if (isStringArray(mapped.tools)) {
      mapped.tools = mapped.tools.map((toolName) => callMapped(tools, toolName) as Tool);
    }
    if (typeof mapped.callback === "string") {
      mapped.callback = callMapped(callbacks, mapped.callback) as TaskCallback;
    }
    if (typeof mapped.outputJson === "string") {
      mapped.outputJson = callMapped(outputJsons, mapped.outputJson) as TaskOutputConverter;
      mapped.output_json = mapped.outputJson;
    } else if (typeof mapped.output_json === "string") {
      mapped.outputJson = callMapped(outputJsons, mapped.output_json) as TaskOutputConverter;
      mapped.output_json = mapped.outputJson;
    }
    if (typeof mapped.outputPydantic === "string") {
      mapped.outputPydantic = callMapped(outputPydantics, mapped.outputPydantic) as TaskOutputConverter;
      mapped.output_pydantic = mapped.outputPydantic;
    } else if (typeof mapped.output_pydantic === "string") {
      mapped.outputPydantic = callMapped(outputPydantics, mapped.output_pydantic) as TaskOutputConverter;
      mapped.output_pydantic = mapped.outputPydantic;
    }
    const outputConverter = mapped.outputConverter ?? mapped.output_converter ?? mapped.converterCls ?? mapped.converter_cls;
    if (typeof outputConverter === "string") {
      mapped.outputConverter = callMapped(callbacks, outputConverter) as TaskOutputConverter;
      mapped.output_converter = mapped.outputConverter;
      mapped.converterCls = mapped.outputConverter;
      mapped.converter_cls = mapped.outputConverter;
    }
    if (isStringArray(mapped.callbacks)) {
      mapped.callbacks = mapped.callbacks.map((callbackName) =>
        callMapped(callbacks, callbackName) as TaskCallback,
      );
    }
    if (typeof mapped.guardrail === "string") {
      mapped.guardrail = callMapped(callbacks, mapped.guardrail) as TaskOptions["guardrail"];
    }
    if (isStringArray(mapped.guardrails)) {
      mapped.guardrails = mapped.guardrails.map((guardrailName) =>
        callMapped(callbacks, guardrailName) as NonNullable<TaskOptions["guardrail"]>,
      );
    } else if (typeof mapped.guardrails === "string") {
      mapped.guardrails = callMapped(callbacks, mapped.guardrails) as TaskOptions["guardrail"];
    }
    state.tasksConfig[taskName] = mapped;
  }
}

export function agentOptionsFromConfig(config: AgentConfig): AgentOptions {
  const options: AgentOptions = {
    role: requireString(config.role, "agent.role"),
    goal: requireString(config.goal, "agent.goal"),
    backstory: requireString(config.backstory, "agent.backstory"),
  };
  assignIfDefined(options, "llm", config.llm);
  assignIfDefined(options, "crew", config.crew);
  assignIfDefined(options, "functionCallingLlm", config.functionCallingLlm ?? config.function_calling_llm);
  assignIfDefined(options, "tools", isToolArray(config.tools) ? config.tools : undefined);
  assignIfDefined(options, "cache", config.cache);
  const cacheHandler = config.cacheHandler ?? config.cache_handler;
  assignIfDefined(options, "cacheHandler", typeof cacheHandler === "string" ? undefined : cacheHandler);
  assignIfDefined(options, "toolsResults", config.toolsResults ?? config.tools_results);
  assignIfDefined(options, "verbose", config.verbose);
  assignIfDefined(options, "allowDelegation", config.allowDelegation ?? config.allow_delegation);
  assignIfDefined(options, "allowCodeExecution", config.allowCodeExecution ?? config.allow_code_execution);
  assignIfDefined(options, "codeExecutionMode", config.codeExecutionMode ?? config.code_execution_mode);
  assignIfDefined(options, "respectContextWindow", config.respectContextWindow ?? config.respect_context_window);
  assignIfDefined(options, "multimodal", config.multimodal);
  assignIfDefined(options, "maxIter", config.maxIter ?? config.max_iter);
  assignIfDefined(options, "maxRetryLimit", config.maxRetryLimit ?? config.max_retry_limit);
  assignIfDefined(options, "maxExecutionTime", config.maxExecutionTime ?? config.max_execution_time);
  assignIfDefined(options, "maxRpm", config.maxRpm ?? config.max_rpm);
  assignIfDefined(options, "maxTokens", config.maxTokens ?? config.max_tokens);
  assignIfDefined(options, "useSystemPrompt", config.useSystemPrompt ?? config.use_system_prompt);
  assignIfDefined(options, "systemTemplate", config.systemTemplate ?? config.system_template);
  assignIfDefined(options, "promptTemplate", config.promptTemplate ?? config.prompt_template);
  assignIfDefined(options, "responseTemplate", config.responseTemplate ?? config.response_template);
  assignIfDefined(options, "injectDate", config.injectDate ?? config.inject_date);
  assignIfDefined(options, "dateFormat", config.dateFormat ?? config.date_format);
  assignIfDefined(options, "guardrail", typeof config.guardrail === "function" ? config.guardrail : undefined);
  assignIfDefined(options, "guardrailMaxRetries", config.guardrailMaxRetries ?? config.guardrail_max_retries);
  assignIfDefined(options, "knowledgeStorage", config.knowledgeStorage ?? config.knowledge_storage);
  assignIfDefined(options, "knowledgeConfig", config.knowledgeConfig ?? config.knowledge_config);
  assignIfDefined(options, "embedder", config.embedder);
  assignIfDefined(options, "agentKnowledgeContext", config.agentKnowledgeContext ?? config.agent_knowledge_context);
  assignIfDefined(options, "crewKnowledgeContext", config.crewKnowledgeContext ?? config.crew_knowledge_context);
  assignIfDefined(options, "knowledgeSearchQuery", config.knowledgeSearchQuery ?? config.knowledge_search_query);
  assignIfDefined(options, "apps", config.apps);
  assignIfDefined(options, "mcps", config.mcps);
  assignIfDefined(options, "a2a", config.a2a);
  assignIfDefined(options, "adaptedAgent", config.adaptedAgent ?? config.adapted_agent);
  assignIfDefined(options, "fromRepository", config.fromRepository ?? config.from_repository);
  assignIfDefined(options, "agentExecutor", config.agentExecutor ?? config.agent_executor);
  assignIfDefined(options, "executorClass", config.executorClass ?? config.executor_class);
  assignIfDefined(options, "planning", config.planning);
  assignIfDefined(options, "planningConfig", config.planningConfig ?? config.planning_config);
  assignIfDefined(options, "reasoning", config.reasoning);
  assignIfDefined(options, "maxReasoningAttempts", config.maxReasoningAttempts ?? config.max_reasoning_attempts);
  const stepCallback = config.stepCallback ?? config.step_callback;
  assignIfDefined(options, "stepCallback", typeof stepCallback === "function" ? stepCallback : undefined);
  return options;
}

export function taskOptionsFromConfig(config: TaskConfig): TaskOptions {
  const options: TaskOptions = {
    description: requireString(config.description, "task.description"),
    expectedOutput: requireString(config.expectedOutput ?? config.expected_output, "task.expectedOutput"),
  };
  assignIfDefined(options, "name", config.name);
  assignIfDefined(options, "config", config.config);
  assignIfDefined(options, "promptContext", config.promptContext ?? config.prompt_context);
  assignIfDefined(options, "agent", config.agent && typeof config.agent !== "string" ? config.agent : null);
  assignIfDefined(options, "context", config.context === null ? null : isTaskArray(config.context) ? config.context : undefined);
  assignIfDefined(options, "tools", isToolArray(config.tools) ? config.tools : undefined);
  assignIfDefined(options, "callback", typeof config.callback === "function" ? config.callback : undefined);
  assignIfDefined(options, "callbacks", isCallbackArray(config.callbacks) ? config.callbacks : undefined);
  const outputJson = config.outputJson ?? config.output_json;
  const outputPydantic = config.outputPydantic ?? config.output_pydantic;
  assignIfDefined(options, "outputJson", typeof outputJson === "function" ? true : normalizeOutputJson(outputJson));
  assignIfDefined(options, "outputPydantic", typeof outputPydantic === "function" ? outputPydantic : undefined);
  assignIfDefined(options, "outputConverter", typeof outputJson === "function" ? outputJson : undefined);
  const outputConverter = config.outputConverter ?? config.output_converter ?? config.converterCls ?? config.converter_cls;
  assignIfDefined(options, "outputConverter", typeof outputConverter === "function" ? outputConverter : undefined);
  assignIfDefined(options, "outputFile", config.outputFile ?? config.output_file);
  assignIfDefined(options, "inputFiles", config.inputFiles ?? config.input_files);
  assignIfDefined(options, "createDirectory", config.createDirectory ?? config.create_directory);
  assignIfDefined(options, "responseModel", config.responseModel ?? config.response_model);
  assignIfDefined(options, "asyncExecution", config.asyncExecution ?? config.async_execution);
  assignIfDefined(options, "humanInput", config.humanInput ?? config.human_input);
  assignIfDefined(options, "markdown", config.markdown);
  assignIfDefined(options, "allowCrewaiTriggerContext", config.allowCrewaiTriggerContext ?? config.allow_crewai_trigger_context);
  assignIfDefined(options, "guardrail", typeof config.guardrail === "function" ? config.guardrail : undefined);
  assignIfDefined(options, "guardrails", isGuardrailArray(config.guardrails) || typeof config.guardrails === "function"
    ? config.guardrails
    : undefined);
  assignIfDefined(options, "guardrailMaxRetries", config.guardrailMaxRetries ?? config.guardrail_max_retries);
  assignIfDefined(options, "max_retries", config.max_retries);
  assignIfDefined(options, "retryCount", config.retryCount ?? config.retry_count);
  assignIfDefined(options, "usedTools", config.usedTools ?? config.used_tools);
  assignIfDefined(options, "toolsErrors", config.toolsErrors ?? config.tools_errors);
  assignIfDefined(options, "delegations", config.delegations);
  assignIfDefined(options, "processedByAgents", config.processedByAgents ?? config.processed_by_agents);
  assignIfDefined(options, "startTime", config.startTime ?? config.start_time);
  assignIfDefined(options, "endTime", config.endTime ?? config.end_time);
  assignIfDefined(options, "checkpointOriginalDescription", config.checkpointOriginalDescription ?? config.checkpoint_original_description);
  assignIfDefined(options, "checkpointOriginalExpectedOutput", config.checkpointOriginalExpectedOutput ?? config.checkpoint_original_expected_output);
  assignIfDefined(options, "checkpointOriginalOutputFile", config.checkpointOriginalOutputFile ?? config.checkpoint_original_output_file);
  return options;
}

export type ProjectModuleLike = object | Record<string, unknown>;

export function getCrewInstance(value: unknown): Crew | null {
  const instance = instantiateIfClass(value);
  if (instance instanceof Crew) {
    return instance;
  }
  if (!isRecord(instance)) {
    return null;
  }
  for (const entry of getCrewMetadata(instance).filter((metadata) => metadata.kind === "crew")) {
    const crewInstance = callInstanceMethod(instance, entry.name);
    if (crewInstance instanceof Crew) {
      return crewInstance;
    }
  }
  for (const candidate of Object.values(instance)) {
    if (candidate instanceof Crew) {
      return candidate;
    }
  }
  return null;
}

export const get_crew_instance = getCrewInstance;

export function fetchCrews(moduleLike: ProjectModuleLike): Crew[] {
  return extractValues(moduleLike)
    .map((value) => getCrewInstance(value))
    .filter((value): value is Crew => value instanceof Crew);
}

export const fetch_crews = fetchCrews;

export const getCrews = fetchCrews;
export const get_crews = getCrews;

export function getFlowInstance(value: unknown): unknown {
  const instance = instantiateIfClass(value);
  return isFlowLike(instance) ? instance : null;
}

export const get_flow_instance = getFlowInstance;

export function getFlows(moduleLike: ProjectModuleLike): unknown[] {
  return extractValues(moduleLike)
    .map((value) => getFlowInstance(value))
    .filter((value) => value !== null);
}

export const get_flows = getFlows;

export function isValidTool(value: unknown): value is Tool {
  return isRecord(value) && typeof value.name === "string" && typeof value.run === "function";
}

export const is_valid_tool = isValidTool;

export function extractAvailableExports(moduleLike: ProjectModuleLike): string[] {
  return Object.entries(moduleLike)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([name]) => name)
    .sort();
}

export const extract_available_exports = extractAvailableExports;

export type ToolMetadata = {
  name: string;
  description: string;
  argsSchema?: unknown;
  args_schema?: unknown;
};

export function extractToolsMetadata(tools: readonly unknown[]): ToolMetadata[] {
  return tools.filter(isValidTool).map((tool) => {
    const argsSchema = (tool as { argsSchema?: unknown; args_schema?: unknown }).argsSchema
      ?? (tool as { args_schema?: unknown }).args_schema;
    return {
      name: tool.name,
      description: tool.description ?? "",
      argsSchema,
      args_schema: argsSchema,
    };
  });
}

export const extract_tools_metadata = extractToolsMetadata;

function getMethodsByKind(instance: object, kind: Parameters<typeof filterEntries>[1]): Map<string, () => unknown> {
  const entries = filterEntries(instance, kind);
  return new Map(
    entries.map((entry) => [
      String(entry.name),
      () => {
        const method = (instance as Record<string | symbol, unknown>)[entry.name];
        if (typeof method !== "function") {
          throw new Error(`Crew project method '${String(entry.name)}' is not callable.`);
        }
        return (method as (this: object) => unknown).call(instance);
      },
    ]),
  );
}

function filterEntries(instance: object, kind: ReturnType<typeof getCrewMetadata>[number]["kind"]) {
  return getCrewMetadata(instance).filter((entry) => entry.kind === kind);
}

function callMapped(methods: Map<string, () => unknown>, name: string): unknown {
  const factory = methods.get(name);
  if (!factory) {
    throw new Error(`No decorated method named '${name}' found for config reference.`);
  }
  return factory();
}

function normalizeProjectConfig(config: ProjectConfig): ProjectConfig {
  return Object.fromEntries(
    Object.entries(config).map(([key, value]) => [key, isRecord(value) ? { ...value } : {}]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isProjectConfig(value: unknown): value is ProjectConfig {
  return isRecord(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isToolArray(value: unknown): value is readonly Tool[] {
  return Array.isArray(value) && value.every((item) => isRecord(item) && typeof item.run === "function");
}

function isTaskArray(value: unknown): value is readonly Task[] {
  return Array.isArray(value) && value.every((item) => isRecord(item) && "description" in item);
}

function isCallbackArray(value: unknown): value is readonly TaskCallback[] {
  return Array.isArray(value) && value.every((item) => typeof item === "function");
}

function isGuardrailArray(value: unknown): value is readonly NonNullable<TaskOptions["guardrail"]>[] {
  return Array.isArray(value) && value.every((item) => typeof item === "function");
}

function normalizeOutputJson(value: TaskConfig["outputJson"]): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return true;
  }
  return null;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`Missing required ${field} config value.`);
  }
  return value;
}

function assignIfDefined<T extends object, K extends keyof T>(target: T, key: K, value: T[K] | undefined): void {
  if (value !== undefined) {
    target[key] = value;
  }
}

function extractValues(moduleLike: ProjectModuleLike): unknown[] {
  return Object.values(moduleLike as Record<string, unknown>);
}

function instantiateIfClass(value: unknown): unknown {
  if (typeof value !== "function") {
    return value;
  }
  try {
    return new (value as new () => unknown)();
  } catch {
    return value;
  }
}

function callInstanceMethod(instance: object, name: string | symbol): unknown {
  const method = (instance as Record<string | symbol, unknown>)[name];
  return typeof method === "function" ? method.call(instance) : undefined;
}

function isFlowLike(value: unknown): boolean {
  return isRecord(value)
    && (
      typeof value.kickoff === "function"
      || typeof value.kickoff_async === "function"
      || typeof value.kickoffAsync === "function"
      || typeof value.plot === "function"
    );
}
