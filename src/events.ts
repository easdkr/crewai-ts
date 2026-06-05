import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

import {
  SCOPE_ENDING_EVENTS,
  SCOPE_STARTING_EVENTS,
  VALID_EVENT_PAIRS,
  getEmissionSequence,
  getCurrentFlowId,
  getCurrentFlowName,
  getEnclosingParentId,
  getCurrentParentId,
  getLastEventId,
  getNextEmissionSequence,
  getTriggeringEventId,
  handleEmptyPop,
  handleMismatch,
  popEventScope,
  pushEventScope,
  resetEmissionCounter,
  setEmissionCounter,
  setEventRuntimeStateProvider,
  setLastEventId,
} from "./context.js";
import type { LiteAgentOutput } from "./lite-agent-output.js";
import {
  getAfterLlmCallHooks,
  getAfterToolCallHooks,
  getBeforeLlmCallHooks,
  getBeforeToolCallHooks,
} from "./hooks.js";
import type { CrewOutput, TaskOutput } from "./outputs.js";
import { PlusAPI, type TraceEventsPayload, type TraceFinalizePayload } from "./plus-api.js";
import { RuntimeState } from "./state.js";
import { Telemetry } from "./telemetry.js";
import {
  markFirstExecutionCompleted,
  promptUserForTraceViewing,
  shouldAutoCollectFirstTimeTraces,
} from "./tracing-utils.js";
import type { InputValues, MaybePromise } from "./types.js";
import { __version__ } from "./version.js";

export type EventType =
  | "crew_kickoff_started"
  | "crew_kickoff_completed"
  | "crew_kickoff_failed"
  | "crew_train_started"
  | "crew_train_completed"
  | "crew_train_failed"
  | "crew_test_started"
  | "crew_test_completed"
  | "crew_test_failed"
  | "task_started"
  | "task_completed"
  | "task_failed"
  | "task_evaluation"
  | "crew_test_result"
  | "agent_execution_started"
  | "agent_execution_completed"
  | "agent_execution_error"
  | "agent_evaluation_started"
  | "agent_evaluation_completed"
  | "agent_evaluation_failed"
  | "agent_reasoning_started"
  | "agent_reasoning_completed"
  | "agent_reasoning_failed"
  | "a2a_delegation_started"
  | "a2a_delegation_completed"
  | "a2a_conversation_started"
  | "a2a_message_sent"
  | "a2a_response_received"
  | "a2a_conversation_completed"
  | "a2a_polling_started"
  | "a2a_polling_status"
  | "a2a_push_notification_registered"
  | "a2a_push_notification_received"
  | "a2a_push_notification_sent"
  | "a2a_push_notification_timeout"
  | "a2a_streaming_started"
  | "a2a_streaming_chunk"
  | "a2a_agent_card_fetched"
  | "a2a_authentication_failed"
  | "a2a_artifact_received"
  | "a2a_connection_error"
  | "a2a_server_task_started"
  | "a2a_server_task_completed"
  | "a2a_server_task_canceled"
  | "a2a_server_task_failed"
  | "a2a_parallel_delegation_started"
  | "a2a_parallel_delegation_completed"
  | "a2a_transport_negotiated"
  | "a2a_content_type_negotiated"
  | "a2a_context_created"
  | "a2a_context_expired"
  | "a2a_context_idle"
  | "a2a_context_completed"
  | "a2a_context_pruned"
  | "mcp_connection_started"
  | "mcp_connection_completed"
  | "mcp_connection_failed"
  | "mcp_tool_execution_started"
  | "mcp_tool_execution_completed"
  | "mcp_tool_execution_failed"
  | "mcp_config_fetch_failed"
  | "skill_discovery_started"
  | "skill_discovery_completed"
  | "skill_loaded"
  | "skill_activated"
  | "skill_load_failed"
  | "skill_download_started"
  | "skill_download_completed"
  | "llm_call_started"
  | "llm_call_completed"
  | "llm_call_failed"
  | "llm_stream_chunk"
  | "llm_thinking_chunk"
  | "llm_guardrail_started"
  | "llm_guardrail_completed"
  | "knowledge_search_query_started"
  | "knowledge_search_query_completed"
  | "knowledge_query_started"
  | "knowledge_query_failed"
  | "knowledge_query_completed"
  | "knowledge_search_query_failed"
  | "tool_usage_started"
  | "tool_usage_finished"
  | "tool_usage_error"
  | "tool_validate_input_error"
  | "tool_selection_error"
  | "tool_execution_error"
  | "lite_agent_execution_started"
  | "lite_agent_execution_completed"
  | "lite_agent_execution_error"
  | "human_feedback_requested"
  | "human_feedback_received"
  | "memory_save_started"
  | "memory_save_completed"
  | "memory_save_failed"
  | "memory_query_started"
  | "memory_query_completed"
  | "memory_query_failed"
  | "memory_retrieval_started"
  | "memory_retrieval_completed"
  | "memory_retrieval_failed"
  | "flow_started"
  | "flow_created"
  | "flow_finished"
  | "flow_failed"
  | "flow_paused"
  | "flow_plot"
  | "flow_input_requested"
  | "flow_input_received"
  | "method_execution_started"
  | "method_execution_finished"
  | "method_execution_failed"
  | "method_execution_paused"
  | "checkpoint_started"
  | "checkpoint_completed"
  | "checkpoint_failed"
  | "checkpoint_pruned"
  | "checkpoint_fork_started"
  | "checkpoint_fork_completed"
  | "checkpoint_restore_started"
  | "checkpoint_restore_completed"
  | "checkpoint_restore_failed"
  | "step_observation_started"
  | "step_observation_completed"
  | "step_observation_failed"
  | "plan_refinement"
  | "plan_replan_triggered"
  | "goal_achieved_early"
  | "SIGTERM"
  | "SIGINT"
  | "SIGHUP"
  | "SIGTSTP"
  | "SIGCONT"
  | "agent_logs_started"
  | "agent_logs_execution"
  | "cc_env"
  | "codex_env"
  | "cursor_env"
  | "default_env";

type EventClass<TEvent extends CrewAIEvent = CrewAIEvent> = abstract new (...args: unknown[]) => TEvent;
type EventRegistrationKey = EventType | EventClass;

export type BaseEventOptions = {
  type: EventType;
  sourceType?: string | null;
  sourceFingerprint?: string | null;
  parentEventId?: string | null;
  previousEventId?: string | null;
  triggeredByEventId?: string | null;
  startedEventId?: string | null;
};

export class BaseEvent {
  readonly timestamp: Date;
  readonly type: EventType;
  readonly eventId: string;
  readonly emissionSequence: number;
  sourceType: string | null;
  sourceFingerprint: string | null;
  fingerprintMetadata: Record<string, unknown> | null;
  fingerprint_metadata: Record<string, unknown> | null;
  taskId: string | null;
  task_id: string | null;
  taskName: string | null;
  task_name: string | null;
  agentId: string | null;
  agent_id: string | null;
  agentRole: string | null;
  agent_role: string | null;
  parentEventId: string | null;
  previousEventId: string | null;
  triggeredByEventId: string | null;
  startedEventId: string | null;

  constructor(options: BaseEventOptions) {
    this.timestamp = new Date();
    this.type = options.type;
    this.eventId = randomUUID();
    this.emissionSequence = getNextEmissionSequence();
    this.sourceType = options.sourceType ?? null;
    this.sourceFingerprint = options.sourceFingerprint ?? null;
    this.fingerprintMetadata = null;
    this.fingerprint_metadata = null;
    this.taskId = null;
    this.task_id = null;
    this.taskName = null;
    this.task_name = null;
    this.agentId = null;
    this.agent_id = null;
    this.agentRole = null;
    this.agent_role = null;
    this.parentEventId = options.parentEventId ?? null;
    this.previousEventId = options.previousEventId ?? null;
    this.triggeredByEventId = options.triggeredByEventId ?? null;
    this.startedEventId = options.startedEventId ?? null;
  }

  toJSON(): Record<string, unknown> {
    return {
      timestamp: this.timestamp.toISOString(),
      type: this.type,
      eventId: this.eventId,
      emissionSequence: this.emissionSequence,
      sourceType: this.sourceType,
      sourceFingerprint: this.sourceFingerprint,
      fingerprintMetadata: this.fingerprintMetadata,
      taskId: this.taskId,
      taskName: this.taskName,
      agentId: this.agentId,
      agentRole: this.agentRole,
      parentEventId: this.parentEventId,
      previousEventId: this.previousEventId,
      triggeredByEventId: this.triggeredByEventId,
      startedEventId: this.startedEventId,
    };
  }

  to_json(exclude: Set<string> | readonly string[] | null = null): Record<string, unknown> {
    const excluded = new Set(exclude ?? []);
    const json = this.toJSON();
    const result: Record<string, unknown> = {
      ...json,
      event_id: this.eventId,
      emission_sequence: this.emissionSequence,
      source_type: this.sourceType,
      source_fingerprint: this.sourceFingerprint,
      fingerprint_metadata: this.fingerprintMetadata,
      task_id: this.taskId,
      task_name: this.taskName,
      agent_id: this.agentId,
      agent_role: this.agentRole,
      parent_event_id: this.parentEventId,
      previous_event_id: this.previousEventId,
      triggered_by_event_id: this.triggeredByEventId,
      started_event_id: this.startedEventId,
    };
    return Object.fromEntries(Object.entries(result).filter(([key]) => !excluded.has(key)));
  }

  _set_task_params(data: Record<string, unknown>): void {
    const task = data.from_task ?? data.fromTask;
    if (!task) {
      return;
    }
    this.taskId = getStringProperty(task, "id");
    this.task_id = this.taskId;
    this.taskName = getNonEmptyStringProperty(task, "name") ?? getStringProperty(task, "description");
    this.task_name = this.taskName;
    (this as unknown as { from_task?: unknown; fromTask?: unknown }).from_task = null;
    (this as unknown as { from_task?: unknown; fromTask?: unknown }).fromTask = null;
  }

  _set_agent_params(data: Record<string, unknown>): void {
    const task = data.from_task ?? data.fromTask;
    const agent = getObjectProperty(task, "agent") ?? data.from_agent ?? data.fromAgent;
    if (!agent) {
      return;
    }
    this.agentId = getStringProperty(agent, "id");
    this.agent_id = this.agentId;
    this.agentRole = getStringProperty(agent, "role");
    this.agent_role = this.agentRole;
    (this as unknown as { from_agent?: unknown; fromAgent?: unknown }).from_agent = null;
    (this as unknown as { from_agent?: unknown; fromAgent?: unknown }).fromAgent = null;
  }
}

export abstract class FlowEvent extends BaseEvent {}

export abstract class ReasoningEvent extends BaseEvent {}

export abstract class ToolUsageEvent extends BaseEvent {}

export type CrewBaseEventOptions = Omit<BaseEventOptions, "sourceType" | "sourceFingerprint"> & {
  sourceType?: string | null | undefined;
  sourceFingerprint?: string | null | undefined;
  crewName?: string | null | undefined;
  crew_name?: string | null | undefined;
  crew?: unknown;
  fingerprintMetadata?: Record<string, unknown> | null | undefined;
  fingerprint_metadata?: Record<string, unknown> | null | undefined;
};

export abstract class CrewBaseEvent extends BaseEvent {
  readonly crewName: string | null;
  readonly crew_name: string | null;
  readonly crew: unknown;
  fingerprintMetadata: Record<string, unknown> | null;
  fingerprint_metadata: Record<string, unknown> | null;

  constructor(options: CrewBaseEventOptions) {
    const crewFingerprint = getCrewSourceFingerprint(options.crew);
    const crewMetadata = getCrewFingerprintMetadata(options.crew);
    super({
      ...options,
      sourceType: crewFingerprint ? "crew" : (options.sourceType ?? "crew"),
      sourceFingerprint: options.sourceFingerprint ?? crewFingerprint,
    });
    this.crewName = options.crewName ?? options.crew_name ?? null;
    this.crew_name = this.crewName;
    this.crew = options.crew ?? null;
    this.fingerprintMetadata = options.fingerprintMetadata ?? options.fingerprint_metadata ?? crewMetadata;
    this.fingerprint_metadata = this.fingerprintMetadata;
    this._set_crew_fingerprint();
  }

  _set_crew_fingerprint(): void {
    const crewFingerprint = getCrewSourceFingerprint(this.crew);
    if (!this.crew || !crewFingerprint) {
      return;
    }
    this.sourceFingerprint = crewFingerprint;
    this.sourceType = "crew";
    const metadata = getCrewFingerprintMetadata(this.crew);
    if (metadata) {
      this.fingerprintMetadata = metadata;
      this.fingerprint_metadata = metadata;
    }
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      crewName: this.crewName,
      fingerprintMetadata: this.fingerprintMetadata,
    };
  }

  override to_json(exclude: Set<string> | readonly string[] | null = null): Record<string, unknown> {
    const excluded = new Set([...(exclude ?? []), "crew"]);
    const result = super.to_json(excluded);
    const baseFields = new Set([
      "timestamp",
      "type",
      "eventId",
      "emissionSequence",
      "sourceType",
      "sourceFingerprint",
      "parentEventId",
      "previousEventId",
      "triggeredByEventId",
      "startedEventId",
      "crew",
    ]);
    for (const [key, value] of Object.entries(this)) {
      if (!baseFields.has(key) && !excluded.has(key)) {
        result[key] = value;
      }
    }
    if (!excluded.has("crew_name")) {
      result.crew_name = this.crewName;
    }
    if (!excluded.has("fingerprint_metadata")) {
      result.fingerprint_metadata = this.fingerprintMetadata;
    }
    if ("totalTokens" in this && !excluded.has("total_tokens")) {
      result.total_tokens = (this as { totalTokens?: unknown }).totalTokens;
    }
    return Object.fromEntries(Object.entries(result).filter(([key]) => !excluded.has(key)));
  }
}

export abstract class MemoryBaseEvent extends BaseEvent {}

export class CrewKickoffStartedEvent extends CrewBaseEvent {
  readonly inputs: InputValues | null;

  constructor(options: { crewName?: string | null; crew_name?: string | null; crew?: unknown; inputs?: InputValues | null; startedEventId?: string | null; started_event_id?: string | null } = {}) {
    super({
      type: "crew_kickoff_started",
      crewName: options.crewName,
      crew_name: options.crew_name,
      crew: options.crew,
      startedEventId: options.startedEventId ?? options.started_event_id ?? null,
    });
    this.inputs = options.inputs ?? null;
  }
}

export class CrewKickoffCompletedEvent extends CrewBaseEvent {
  readonly output: CrewOutput;
  readonly totalTokens: number;
  readonly total_tokens: number;

  constructor(options: { crewName?: string | null; crew_name?: string | null; crew?: unknown; output: CrewOutput; totalTokens?: number; total_tokens?: number; startedEventId?: string | null; started_event_id?: string | null }) {
    super({
      type: "crew_kickoff_completed",
      crewName: options.crewName,
      crew_name: options.crew_name,
      crew: options.crew,
      startedEventId: options.startedEventId ?? options.started_event_id ?? null,
    });
    this.output = options.output;
    this.totalTokens = options.totalTokens ?? options.total_tokens ?? 0;
    this.total_tokens = this.totalTokens;
  }
}

export class CrewKickoffFailedEvent extends CrewBaseEvent {
  readonly error: string;

  constructor(options: { crewName?: string | null; crew_name?: string | null; crew?: unknown; error: unknown; startedEventId?: string | null; started_event_id?: string | null }) {
    super({
      type: "crew_kickoff_failed",
      crewName: options.crewName,
      crew_name: options.crew_name,
      crew: options.crew,
      startedEventId: options.startedEventId ?? options.started_event_id ?? null,
    });
    this.error = formatError(options.error);
  }
}

export class CrewTrainStartedEvent extends CrewBaseEvent {
  readonly n_iterations: number;
  readonly filename: string;
  readonly inputs: InputValues | null;

  constructor(options: {
    crewName?: string | null;
    crew_name?: string | null;
    crew?: unknown;
    n_iterations: number;
    filename: string;
    inputs?: InputValues | null;
  }) {
    super({ type: "crew_train_started", crewName: options.crewName, crew_name: options.crew_name, crew: options.crew });
    this.n_iterations = options.n_iterations;
    this.filename = options.filename;
    this.inputs = options.inputs ?? null;
  }
}

export class CrewTrainCompletedEvent extends CrewBaseEvent {
  readonly n_iterations: number;
  readonly filename: string;

  constructor(options: {
    crewName?: string | null;
    crew_name?: string | null;
    crew?: unknown;
    n_iterations: number;
    filename: string;
  }) {
    super({ type: "crew_train_completed", crewName: options.crewName, crew_name: options.crew_name, crew: options.crew });
    this.n_iterations = options.n_iterations;
    this.filename = options.filename;
  }
}

export class CrewTrainFailedEvent extends CrewBaseEvent {
  readonly error: string;

  constructor(options: { crewName?: string | null; crew_name?: string | null; crew?: unknown; error: unknown }) {
    super({ type: "crew_train_failed", crewName: options.crewName, crew_name: options.crew_name, crew: options.crew });
    this.error = formatError(options.error);
  }
}

export class CrewTestStartedEvent extends CrewBaseEvent {
  readonly n_iterations: number;
  readonly eval_llm: unknown;
  readonly inputs: InputValues | null;

  constructor(options: {
    crewName?: string | null;
    crew_name?: string | null;
    crew?: unknown;
    n_iterations: number;
    eval_llm?: unknown;
    inputs?: InputValues | null;
  }) {
    super({ type: "crew_test_started", crewName: options.crewName, crew_name: options.crew_name, crew: options.crew });
    this.n_iterations = options.n_iterations;
    this.eval_llm = options.eval_llm ?? null;
    this.inputs = options.inputs ?? null;
  }
}

export class CrewTestCompletedEvent extends CrewBaseEvent {
  constructor(options: { crewName?: string | null; crew_name?: string | null; crew?: unknown } = {}) {
    super({ type: "crew_test_completed", crewName: options.crewName, crew_name: options.crew_name, crew: options.crew });
  }
}

export class CrewTestFailedEvent extends CrewBaseEvent {
  readonly error: string;

  constructor(options: { crewName?: string | null; crew_name?: string | null; crew?: unknown; error: unknown }) {
    super({ type: "crew_test_failed", crewName: options.crewName, crew_name: options.crew_name, crew: options.crew });
    this.error = formatError(options.error);
  }
}

export class TaskStartedEvent extends BaseEvent {
  readonly taskName: string | null;
  readonly taskDescription: string;
  readonly context: string | null;

  constructor(options: { taskName?: string | null; taskDescription: string; context?: string | null }) {
    super({ type: "task_started", sourceType: "task" });
    this.taskName = options.taskName ?? null;
    this.taskDescription = options.taskDescription;
    this.context = options.context ?? null;
  }
}

export class TaskCompletedEvent extends BaseEvent {
  readonly taskName: string | null;
  readonly taskDescription: string;
  readonly output: TaskOutput;

  constructor(options: { taskName?: string | null; taskDescription: string; output: TaskOutput }) {
    super({ type: "task_completed", sourceType: "task" });
    this.taskName = options.taskName ?? null;
    this.taskDescription = options.taskDescription;
    this.output = options.output;
  }
}

export class TaskFailedEvent extends BaseEvent {
  readonly taskName: string | null;
  readonly taskDescription: string;
  readonly error: string;

  constructor(options: { taskName?: string | null; taskDescription: string; error: unknown }) {
    super({ type: "task_failed", sourceType: "task" });
    this.taskName = options.taskName ?? null;
    this.taskDescription = options.taskDescription;
    this.error = formatError(options.error);
  }
}

export class TaskEvaluationEvent extends BaseEvent {
  readonly evaluationType: string;
  readonly evaluation_type: string;
  readonly task: unknown;

  constructor(options: { evaluationType?: string; evaluation_type?: string; task?: unknown } = {}) {
    super({ type: "task_evaluation", sourceType: "task" });
    this.evaluationType = options.evaluationType ?? options.evaluation_type ?? "task_evaluation";
    this.evaluation_type = this.evaluationType;
    this.task = options.task ?? null;
  }
}

export class CrewTestResultEvent extends CrewBaseEvent {
  readonly quality: number;
  readonly executionDuration: number | null;
  readonly execution_duration: number | null;
  readonly model: string | null;

  constructor(options: {
    quality: number;
    executionDuration?: number | null;
    execution_duration?: number | null;
    model?: string | null;
    crewName?: string | null;
    crew_name?: string | null;
    crew?: unknown;
  }) {
    super({ type: "crew_test_result", crewName: options.crewName, crew_name: options.crew_name, crew: options.crew });
    this.quality = options.quality;
    this.executionDuration = options.executionDuration ?? options.execution_duration ?? null;
    this.execution_duration = this.executionDuration;
    this.model = options.model ?? null;
  }
}

type AgentFingerprintAssignable = {
  sourceFingerprint: string | null;
  fingerprintMetadata?: Record<string, unknown> | null;
  fingerprint_metadata?: Record<string, unknown> | null;
};

function setAgentExecutionFingerprintData<TEvent extends AgentFingerprintAssignable & { agent: unknown }>(event: TEvent): TEvent {
  event.sourceFingerprint = getAgentSourceFingerprint(event.agent);
  event.fingerprintMetadata = getAgentFingerprintMetadata(event.agent);
  event.fingerprint_metadata = event.fingerprintMetadata;
  return event;
}

export function _set_agent_fingerprint(event: BaseEvent, agent: unknown): void {
  const fingerprint = getAgentFingerprint(agent);
  const uuid = getStringProperty(fingerprint, "uuid_str") ?? getStringProperty(fingerprint, "uuidStr");
  if (uuid === null) {
    return;
  }
  event.sourceFingerprint = uuid;
  (event as unknown as { source_fingerprint?: string | null }).source_fingerprint = uuid;
  event.sourceType = "agent";
  (event as unknown as { source_type?: string | null }).source_type = "agent";
  const metadata = getRecordMetadata(fingerprint);
  if (metadata !== null) {
    event.fingerprintMetadata = metadata;
    event.fingerprint_metadata = metadata;
  }
}

export function _set_task_fingerprint(event: BaseEvent, task: unknown): void {
  if (task === null || task === undefined) {
    return;
  }
  const taskId = getStringProperty(task, "id");
  if (taskId !== null) {
    event.taskId = taskId;
    event.task_id = taskId;
  }
  const taskName = getStringProperty(task, "name") ?? getStringProperty(task, "description");
  if (taskName !== null) {
    event.taskName = taskName;
    event.task_name = taskName;
  }
  const fingerprint = getObjectProperty(task, "fingerprint");
  const uuid = getStringProperty(fingerprint, "uuid_str") ?? getStringProperty(fingerprint, "uuidStr");
  if (uuid !== null) {
    event.sourceFingerprint = uuid;
    (event as unknown as { source_fingerprint?: string | null }).source_fingerprint = uuid;
    event.sourceType = "task";
    (event as unknown as { source_type?: string | null }).source_type = "task";
    const metadata = getRecordMetadata(fingerprint);
    if (metadata !== null) {
      event.fingerprintMetadata = metadata;
      event.fingerprint_metadata = metadata;
    }
  }
}

export class AgentExecutionStartedEvent extends BaseEvent {
  readonly agent: unknown;
  readonly task: unknown;
  readonly tools: readonly unknown[] | null;
  readonly taskPrompt: string;
  readonly task_prompt: string;
  readonly fingerprintMetadata: Record<string, unknown> | null;
  readonly fingerprint_metadata: Record<string, unknown> | null;

  constructor(options: { agent: unknown; task: unknown; tools?: readonly unknown[] | null; taskPrompt?: string; task_prompt?: string }) {
    super({
      type: "agent_execution_started",
      sourceType: "agent",
      sourceFingerprint: getAgentSourceFingerprint(options.agent),
    });
    this.agent = options.agent;
    this.task = options.task;
    this.tools = options.tools ?? null;
    this.taskPrompt = options.taskPrompt ?? options.task_prompt ?? "";
    this.task_prompt = this.taskPrompt;
    this.fingerprintMetadata = getAgentFingerprintMetadata(options.agent);
    this.fingerprint_metadata = this.fingerprintMetadata;
  }

  setFingerprintData(): this {
    return setAgentExecutionFingerprintData(this);
  }

  set_fingerprint_data(): this {
    return this.setFingerprintData();
  }
}

export class AgentExecutionCompletedEvent extends BaseEvent {
  readonly agent: unknown;
  readonly task: unknown;
  readonly output: string;
  readonly fingerprintMetadata: Record<string, unknown> | null;
  readonly fingerprint_metadata: Record<string, unknown> | null;

  constructor(options: { agent: unknown; task: unknown; output: string }) {
    super({
      type: "agent_execution_completed",
      sourceType: "agent",
      sourceFingerprint: getAgentSourceFingerprint(options.agent),
    });
    this.agent = options.agent;
    this.task = options.task;
    this.output = options.output;
    this.fingerprintMetadata = getAgentFingerprintMetadata(options.agent);
    this.fingerprint_metadata = this.fingerprintMetadata;
  }

  setFingerprintData(): this {
    return setAgentExecutionFingerprintData(this);
  }

  set_fingerprint_data(): this {
    return this.setFingerprintData();
  }
}

export class AgentExecutionErrorEvent extends BaseEvent {
  readonly agent: unknown;
  readonly task: unknown;
  readonly error: string;
  readonly fingerprintMetadata: Record<string, unknown> | null;
  readonly fingerprint_metadata: Record<string, unknown> | null;

  constructor(options: { agent: unknown; task: unknown; error: unknown }) {
    super({
      type: "agent_execution_error",
      sourceType: "agent",
      sourceFingerprint: getAgentSourceFingerprint(options.agent),
    });
    this.agent = options.agent;
    this.task = options.task;
    this.error = formatError(options.error);
    this.fingerprintMetadata = getAgentFingerprintMetadata(options.agent);
    this.fingerprint_metadata = this.fingerprintMetadata;
  }

  setFingerprintData(): this {
    return setAgentExecutionFingerprintData(this);
  }

  set_fingerprint_data(): this {
    return this.setFingerprintData();
  }
}

export class AgentEvaluationStartedEvent extends BaseEvent {
  readonly agent_id: string;
  readonly agent_role: string;
  readonly task_id: string | null;
  readonly iteration: number;

  constructor(options: { agent_id: string; agent_role: string; task_id?: string | null; iteration: number }) {
    super({ type: "agent_evaluation_started", sourceType: "agent", sourceFingerprint: options.agent_id });
    this.agent_id = options.agent_id;
    this.agent_role = options.agent_role;
    this.task_id = options.task_id ?? null;
    this.iteration = options.iteration;
  }
}

export class AgentEvaluationCompletedEvent extends BaseEvent {
  readonly agent_id: string;
  readonly agent_role: string;
  readonly task_id: string | null;
  readonly iteration: number;
  readonly metric_category: unknown;
  readonly score: unknown;

  constructor(options: {
    agent_id: string;
    agent_role: string;
    task_id?: string | null;
    iteration: number;
    metric_category: unknown;
    score: unknown;
  }) {
    super({ type: "agent_evaluation_completed", sourceType: "agent", sourceFingerprint: options.agent_id });
    this.agent_id = options.agent_id;
    this.agent_role = options.agent_role;
    this.task_id = options.task_id ?? null;
    this.iteration = options.iteration;
    this.metric_category = options.metric_category;
    this.score = options.score;
  }
}

export class AgentEvaluationFailedEvent extends BaseEvent {
  readonly agent_id: string;
  readonly agent_role: string;
  readonly task_id: string | null;
  readonly iteration: number;
  readonly error: string;

  constructor(options: { agent_id: string; agent_role: string; task_id?: string | null; iteration: number; error: unknown }) {
    super({ type: "agent_evaluation_failed", sourceType: "agent", sourceFingerprint: options.agent_id });
    this.agent_id = options.agent_id;
    this.agent_role = options.agent_role;
    this.task_id = options.task_id ?? null;
    this.iteration = options.iteration;
    this.error = formatError(options.error);
  }
}

export class AgentReasoningStartedEvent extends BaseEvent {
  readonly agentRole: string;
  readonly agent_role: string;
  readonly taskId: string;
  readonly task_id: string;
  readonly attempt: number;
  readonly fromTask: unknown;
  readonly from_task: unknown;

  constructor(options: {
    agentRole?: string;
    agent_role?: string;
    taskId?: string;
    task_id?: string;
    attempt?: number;
    fromTask?: unknown;
    from_task?: unknown;
  } = {}) {
    super({ type: "agent_reasoning_started", sourceType: "agent" });
    this.agentRole = options.agentRole ?? options.agent_role ?? "";
    this.agent_role = this.agentRole;
    this.taskId = options.taskId ?? options.task_id ?? "kickoff";
    this.task_id = this.taskId;
    this.attempt = options.attempt ?? 1;
    this.fromTask = options.fromTask ?? options.from_task ?? null;
    this.from_task = this.fromTask;
  }
}

export class AgentReasoningCompletedEvent extends BaseEvent {
  readonly agentRole: string;
  readonly agent_role: string;
  readonly taskId: string;
  readonly task_id: string;
  readonly plan: string;
  readonly ready: boolean;
  readonly attempt: number;
  readonly fromTask: unknown;
  readonly from_task: unknown;
  readonly fromAgent: unknown;
  readonly from_agent: unknown;

  constructor(options: {
    agentRole?: string;
    agent_role?: string;
    taskId?: string;
    task_id?: string;
    plan: string;
    ready: boolean;
    attempt?: number;
    fromTask?: unknown;
    from_task?: unknown;
    fromAgent?: unknown;
    from_agent?: unknown;
  }) {
    super({ type: "agent_reasoning_completed", sourceType: "agent" });
    this.agentRole = options.agentRole ?? options.agent_role ?? "";
    this.agent_role = this.agentRole;
    this.taskId = options.taskId ?? options.task_id ?? "kickoff";
    this.task_id = this.taskId;
    this.plan = options.plan;
    this.ready = options.ready;
    this.attempt = options.attempt ?? 1;
    this.fromTask = options.fromTask ?? options.from_task ?? null;
    this.from_task = this.fromTask;
    this.fromAgent = options.fromAgent ?? options.from_agent ?? null;
    this.from_agent = this.fromAgent;
  }
}

export class AgentReasoningFailedEvent extends BaseEvent {
  readonly agentRole: string;
  readonly agent_role: string;
  readonly taskId: string;
  readonly task_id: string;
  readonly error: string;
  readonly attempt: number;
  readonly fromTask: unknown;
  readonly from_task: unknown;
  readonly fromAgent: unknown;
  readonly from_agent: unknown;

  constructor(options: {
    agentRole?: string;
    agent_role?: string;
    taskId?: string;
    task_id?: string;
    error: unknown;
    attempt?: number;
    fromTask?: unknown;
    from_task?: unknown;
    fromAgent?: unknown;
    from_agent?: unknown;
  }) {
    super({ type: "agent_reasoning_failed", sourceType: "agent" });
    this.agentRole = options.agentRole ?? options.agent_role ?? "";
    this.agent_role = this.agentRole;
    this.taskId = options.taskId ?? options.task_id ?? "kickoff";
    this.task_id = this.taskId;
    this.error = formatError(options.error);
    this.attempt = options.attempt ?? 1;
    this.fromTask = options.fromTask ?? options.from_task ?? null;
    this.from_task = this.fromTask;
    this.fromAgent = options.fromAgent ?? options.from_agent ?? null;
    this.from_agent = this.fromAgent;
  }
}

export class HumanFeedbackRequestedEvent extends BaseEvent {
  readonly taskName: string | null;
  readonly task_name: string | null;
  readonly taskDescription: string | null;
  readonly task_description: string | null;
  readonly output: unknown;
  readonly flowName: string | null;
  readonly flow_name: string | null;
  readonly methodName: string | null;
  readonly method_name: string | null;
  readonly message: string | null;
  readonly emit: readonly string[] | null;
  readonly request_id: string | null;

  constructor(options: {
    taskName?: string | null;
    task_name?: string | null;
    taskDescription?: string | null;
    task_description?: string | null;
    output: unknown;
    flowName?: string | null;
    flow_name?: string | null;
    methodName?: string | null;
    method_name?: string | null;
    message?: string | null;
    emit?: readonly string[] | null;
    request_id?: string | null;
  }) {
    const flowName = options.flowName ?? options.flow_name ?? null;
    super({ type: "human_feedback_requested", sourceType: flowName ? "flow" : "task" });
    this.taskName = options.taskName ?? options.task_name ?? null;
    this.task_name = this.taskName;
    this.taskDescription = options.taskDescription ?? options.task_description ?? null;
    this.task_description = this.taskDescription;
    this.output = options.output;
    this.flowName = flowName;
    this.flow_name = this.flowName;
    this.methodName = options.methodName ?? options.method_name ?? null;
    this.method_name = this.methodName;
    this.message = options.message ?? null;
    this.emit = options.emit ?? null;
    this.request_id = options.request_id ?? null;
  }
}

export class HumanFeedbackReceivedEvent extends BaseEvent {
  readonly taskName: string | null;
  readonly task_name: string | null;
  readonly taskDescription: string | null;
  readonly task_description: string | null;
  readonly feedback: string;
  readonly accepted: boolean;
  readonly flowName: string | null;
  readonly flow_name: string | null;
  readonly methodName: string | null;
  readonly method_name: string | null;
  readonly outcome: string | null;
  readonly request_id: string | null;

  constructor(options: {
    taskName?: string | null;
    task_name?: string | null;
    taskDescription?: string | null;
    task_description?: string | null;
    feedback: string;
    accepted?: boolean;
    flowName?: string | null;
    flow_name?: string | null;
    methodName?: string | null;
    method_name?: string | null;
    outcome?: string | null;
    request_id?: string | null;
  }) {
    const flowName = options.flowName ?? options.flow_name ?? null;
    super({ type: "human_feedback_received", sourceType: flowName ? "flow" : "task" });
    this.taskName = options.taskName ?? options.task_name ?? null;
    this.task_name = this.taskName;
    this.taskDescription = options.taskDescription ?? options.task_description ?? null;
    this.task_description = this.taskDescription;
    this.feedback = options.feedback;
    this.accepted = options.accepted ?? true;
    this.flowName = flowName;
    this.flow_name = this.flowName;
    this.methodName = options.methodName ?? options.method_name ?? null;
    this.method_name = this.methodName;
    this.outcome = options.outcome ?? null;
    this.request_id = options.request_id ?? null;
  }
}

export class ToolUsageStartedEvent extends BaseEvent {
  readonly toolName: string;
  readonly tool_name: string;
  readonly toolArgs: Record<string, unknown> | string;
  readonly tool_args: Record<string, unknown> | string;
  readonly toolClass: string | null;
  readonly tool_class: string | null;

  constructor(options: {
    toolName?: string;
    tool_name?: string;
    toolArgs?: Record<string, unknown> | string;
    tool_args?: Record<string, unknown> | string;
    toolClass?: string | null;
    tool_class?: string | null;
  } & Record<string, unknown>) {
    super({ type: "tool_usage_started", sourceType: "tool" });
    this.toolName = options.toolName ?? options.tool_name ?? "";
    this.tool_name = this.toolName;
    this.toolArgs = options.toolArgs ?? options.tool_args ?? {};
    this.tool_args = this.toolArgs;
    this.toolClass = options.toolClass ?? options.tool_class ?? null;
    this.tool_class = this.toolClass;
    Object.assign(this, extraEventOptions(options, [
      "toolName",
      "tool_name",
      "toolArgs",
      "tool_args",
      "toolClass",
      "tool_class",
    ]));
  }
}

export class ToolUsageFinishedEvent extends BaseEvent {
  readonly toolName: string;
  readonly tool_name: string;
  readonly toolArgs: Record<string, unknown> | string;
  readonly tool_args: Record<string, unknown> | string;
  readonly toolClass: string | null;
  readonly tool_class: string | null;
  readonly startedAt: Date;
  readonly started_at: Date;
  readonly finishedAt: Date;
  readonly finished_at: Date;
  readonly fromCache: boolean;
  readonly from_cache: boolean;
  readonly output: unknown;

  constructor(options: {
    toolName?: string;
    tool_name?: string;
    toolArgs?: Record<string, unknown> | string;
    tool_args?: Record<string, unknown> | string;
    toolClass?: string | null;
    tool_class?: string | null;
    startedAt?: Date;
    started_at?: Date;
    finishedAt?: Date;
    finished_at?: Date;
    fromCache?: boolean;
    from_cache?: boolean;
    output: unknown;
  } & Record<string, unknown>) {
    super({ type: "tool_usage_finished", sourceType: "tool" });
    this.toolName = options.toolName ?? options.tool_name ?? "";
    this.tool_name = this.toolName;
    this.toolArgs = options.toolArgs ?? options.tool_args ?? {};
    this.tool_args = this.toolArgs;
    this.toolClass = options.toolClass ?? options.tool_class ?? null;
    this.tool_class = this.toolClass;
    this.startedAt = options.startedAt ?? options.started_at ?? new Date();
    this.started_at = this.startedAt;
    this.finishedAt = options.finishedAt ?? options.finished_at ?? new Date();
    this.finished_at = this.finishedAt;
    this.fromCache = options.fromCache ?? options.from_cache ?? false;
    this.from_cache = this.fromCache;
    this.output = options.output;
    Object.assign(this, extraEventOptions(options, [
      "toolName",
      "tool_name",
      "toolArgs",
      "tool_args",
      "toolClass",
      "tool_class",
      "startedAt",
      "started_at",
      "finishedAt",
      "finished_at",
      "fromCache",
      "from_cache",
      "output",
    ]));
  }
}

export class ToolUsageErrorEvent extends BaseEvent {
  readonly toolName: string;
  readonly tool_name: string;
  readonly toolArgs: Record<string, unknown> | string;
  readonly tool_args: Record<string, unknown> | string;
  readonly toolClass: string | null;
  readonly tool_class: string | null;
  readonly error: string;

  constructor(options: {
    toolName?: string;
    tool_name?: string;
    toolArgs?: Record<string, unknown> | string;
    tool_args?: Record<string, unknown> | string;
    toolClass?: string | null;
    tool_class?: string | null;
    error: unknown;
  } & Record<string, unknown>) {
    super({ type: "tool_usage_error", sourceType: "tool" });
    this.toolName = options.toolName ?? options.tool_name ?? "";
    this.tool_name = this.toolName;
    this.toolArgs = options.toolArgs ?? options.tool_args ?? {};
    this.tool_args = this.toolArgs;
    this.toolClass = options.toolClass ?? options.tool_class ?? null;
    this.tool_class = this.toolClass;
    this.error = formatError(options.error);
    Object.assign(this, extraEventOptions(options, [
      "toolName",
      "tool_name",
      "toolArgs",
      "tool_args",
      "toolClass",
      "tool_class",
      "error",
    ]));
  }
}

export class ToolValidateInputErrorEvent extends BaseEvent {
  readonly toolName: string;
  readonly tool_name: string;
  readonly toolArgs: Record<string, unknown> | string;
  readonly tool_args: Record<string, unknown> | string;
  readonly toolClass: string | null;
  readonly tool_class: string | null;
  readonly error: string;

  constructor(options: {
    toolName?: string;
    tool_name?: string;
    toolArgs?: Record<string, unknown> | string;
    tool_args?: Record<string, unknown> | string;
    toolClass?: string | null;
    tool_class?: string | null;
    error: unknown;
  } & Record<string, unknown>) {
    super({ type: "tool_validate_input_error", sourceType: "tool" });
    this.toolName = options.toolName ?? options.tool_name ?? "";
    this.tool_name = this.toolName;
    this.toolArgs = options.toolArgs ?? options.tool_args ?? {};
    this.tool_args = this.toolArgs;
    this.toolClass = options.toolClass ?? options.tool_class ?? null;
    this.tool_class = this.toolClass;
    this.error = formatError(options.error);
    Object.assign(this, extraEventOptions(options, [
      "toolName",
      "tool_name",
      "toolArgs",
      "tool_args",
      "toolClass",
      "tool_class",
      "error",
    ]));
  }
}

export class ToolSelectionErrorEvent extends BaseEvent {
  readonly toolName: string;
  readonly tool_name: string;
  readonly toolArgs: Record<string, unknown> | string;
  readonly tool_args: Record<string, unknown> | string;
  readonly toolClass: string | null;
  readonly tool_class: string | null;
  readonly error: string;

  constructor(options: {
    toolName?: string;
    tool_name?: string;
    toolArgs?: Record<string, unknown> | string;
    tool_args?: Record<string, unknown> | string;
    toolClass?: string | null;
    tool_class?: string | null;
    error: unknown;
  } & Record<string, unknown>) {
    super({ type: "tool_selection_error", sourceType: "tool" });
    this.toolName = options.toolName ?? options.tool_name ?? "";
    this.tool_name = this.toolName;
    this.toolArgs = options.toolArgs ?? options.tool_args ?? {};
    this.tool_args = this.toolArgs;
    this.toolClass = options.toolClass ?? options.tool_class ?? null;
    this.tool_class = this.toolClass;
    this.error = formatError(options.error);
    Object.assign(this, extraEventOptions(options, [
      "toolName",
      "tool_name",
      "toolArgs",
      "tool_args",
      "toolClass",
      "tool_class",
      "error",
    ]));
  }
}

export class ToolExecutionErrorEvent extends BaseEvent {
  readonly error: string;
  readonly tool_name: string;
  readonly tool_args: Record<string, unknown>;
  readonly tool_class: unknown;
  readonly agent: unknown;
  readonly fingerprintMetadata: Record<string, unknown> | null;
  readonly fingerprint_metadata: Record<string, unknown> | null;

  constructor(options: {
    error: unknown;
    tool_name: string;
    tool_args: Record<string, unknown>;
    tool_class: unknown;
    agent?: unknown;
  }) {
    super({
      type: "tool_execution_error",
      sourceType: options.agent ? "agent" : "tool",
      sourceFingerprint: getAgentDirectSourceFingerprint(options.agent),
    });
    this.error = formatError(options.error);
    this.tool_name = options.tool_name;
    this.tool_args = options.tool_args;
    this.tool_class = options.tool_class;
    this.agent = options.agent ?? null;
    this.fingerprintMetadata = getAgentDirectFingerprintMetadata(options.agent);
    this.fingerprint_metadata = this.fingerprintMetadata;
  }
}

export class LiteAgentExecutionStartedEvent extends BaseEvent {
  readonly agentInfo: Record<string, unknown>;
  readonly agent_info: Record<string, unknown>;
  readonly messages: readonly unknown[];

  constructor(options: { agentInfo?: Record<string, unknown>; agent_info?: Record<string, unknown>; messages?: readonly unknown[] } = {}) {
    super({ type: "lite_agent_execution_started", sourceType: "lite_agent" });
    this.agentInfo = options.agentInfo ?? options.agent_info ?? {};
    this.agent_info = this.agentInfo;
    this.messages = options.messages ?? [];
  }
}

export class LiteAgentExecutionCompletedEvent extends BaseEvent {
  readonly agentInfo: Record<string, unknown>;
  readonly agent_info: Record<string, unknown>;
  readonly output: LiteAgentOutput;

  constructor(options: { agentInfo?: Record<string, unknown>; agent_info?: Record<string, unknown>; output: LiteAgentOutput }) {
    super({ type: "lite_agent_execution_completed", sourceType: "lite_agent" });
    this.agentInfo = options.agentInfo ?? options.agent_info ?? {};
    this.agent_info = this.agentInfo;
    this.output = options.output;
  }
}

export class LiteAgentExecutionErrorEvent extends BaseEvent {
  readonly agentInfo: Record<string, unknown>;
  readonly agent_info: Record<string, unknown>;
  readonly error: string;

  constructor(options: { agentInfo?: Record<string, unknown>; agent_info?: Record<string, unknown>; error: unknown }) {
    super({ type: "lite_agent_execution_error", sourceType: "lite_agent" });
    this.agentInfo = options.agentInfo ?? options.agent_info ?? {};
    this.agent_info = this.agentInfo;
    this.error = formatError(options.error);
  }
}

export class MemorySaveStartedEvent extends BaseEvent {
  readonly value: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly agentRole: string | null;

  constructor(options: { value?: string | null; metadata?: Record<string, unknown> | null; agentRole?: string | null } = {}) {
    super({ type: "memory_save_started", sourceType: "memory" });
    this.value = options.value ?? null;
    this.metadata = options.metadata ?? null;
    this.agentRole = options.agentRole ?? null;
  }
}

export class MemorySaveCompletedEvent extends BaseEvent {
  readonly value: string;
  readonly metadata: Record<string, unknown> | null;
  readonly agentRole: string | null;
  readonly saveTimeMs: number;

  constructor(options: { value: string; metadata?: Record<string, unknown> | null; agentRole?: string | null; saveTimeMs: number }) {
    super({ type: "memory_save_completed", sourceType: "memory" });
    this.value = options.value;
    this.metadata = options.metadata ?? null;
    this.agentRole = options.agentRole ?? null;
    this.saveTimeMs = options.saveTimeMs;
  }
}

export class MemorySaveFailedEvent extends BaseEvent {
  readonly value: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly agentRole: string | null;
  readonly error: string;

  constructor(options: { value?: string | null; metadata?: Record<string, unknown> | null; agentRole?: string | null; error: unknown }) {
    super({ type: "memory_save_failed", sourceType: "memory" });
    this.value = options.value ?? null;
    this.metadata = options.metadata ?? null;
    this.agentRole = options.agentRole ?? null;
    this.error = formatError(options.error);
  }
}

export class MemoryQueryStartedEvent extends BaseEvent {
  readonly query: string;
  readonly limit: number;
  readonly scoreThreshold: number | null;

  constructor(options: { query: string; limit: number; scoreThreshold?: number | null }) {
    super({ type: "memory_query_started", sourceType: "memory" });
    this.query = options.query;
    this.limit = options.limit;
    this.scoreThreshold = options.scoreThreshold ?? null;
  }
}

export class MemoryQueryCompletedEvent extends BaseEvent {
  readonly query: string;
  readonly results: unknown;
  readonly limit: number;
  readonly scoreThreshold: number | null;
  readonly queryTimeMs: number;

  constructor(options: { query: string; results: unknown; limit: number; scoreThreshold?: number | null; queryTimeMs: number }) {
    super({ type: "memory_query_completed", sourceType: "memory" });
    this.query = options.query;
    this.results = options.results;
    this.limit = options.limit;
    this.scoreThreshold = options.scoreThreshold ?? null;
    this.queryTimeMs = options.queryTimeMs;
  }
}

export class MemoryQueryFailedEvent extends BaseEvent {
  readonly query: string;
  readonly limit: number;
  readonly scoreThreshold: number | null;
  readonly error: string;

  constructor(options: { query: string; limit: number; scoreThreshold?: number | null; error: unknown }) {
    super({ type: "memory_query_failed", sourceType: "memory" });
    this.query = options.query;
    this.limit = options.limit;
    this.scoreThreshold = options.scoreThreshold ?? null;
    this.error = formatError(options.error);
  }
}

export class MemoryRetrievalStartedEvent extends BaseEvent {
  readonly task_id: string | null;

  constructor(options: { task_id?: string | null } = {}) {
    super({ type: "memory_retrieval_started", sourceType: "memory" });
    this.task_id = options.task_id ?? null;
  }
}

export class MemoryRetrievalCompletedEvent extends BaseEvent {
  readonly task_id: string | null;
  readonly memory_content: string;
  readonly retrieval_time_ms: number;

  constructor(options: { task_id?: string | null; memory_content: string; retrieval_time_ms: number }) {
    super({ type: "memory_retrieval_completed", sourceType: "memory" });
    this.task_id = options.task_id ?? null;
    this.memory_content = options.memory_content;
    this.retrieval_time_ms = options.retrieval_time_ms;
  }
}

export class MemoryRetrievalFailedEvent extends BaseEvent {
  readonly task_id: string | null;
  readonly error: string;

  constructor(options: { task_id?: string | null; error: unknown }) {
    super({ type: "memory_retrieval_failed", sourceType: "memory" });
    this.task_id = options.task_id ?? null;
    this.error = formatError(options.error);
  }
}

export class FlowStartedEvent extends BaseEvent {
  readonly flowName: string;
  readonly flow_name: string;
  readonly inputs: InputValues;

  constructor(options: { flowName?: string; flow_name?: string; inputs?: InputValues }) {
    super({ type: "flow_started", sourceType: "flow" });
    this.flowName = options.flowName ?? options.flow_name ?? "";
    this.flow_name = this.flowName;
    this.inputs = options.inputs ?? {};
  }
}

export class FlowCreatedEvent extends BaseEvent {
  readonly flowName: string;
  readonly flow_name: string;

  constructor(options: { flowName?: string; flow_name?: string }) {
    super({ type: "flow_created", sourceType: "flow" });
    this.flowName = options.flowName ?? options.flow_name ?? "";
    this.flow_name = this.flowName;
  }
}

export class FlowFinishedEvent extends BaseEvent {
  readonly flowName: string;
  readonly flow_name: string;
  readonly result: unknown;
  readonly state: unknown;

  constructor(options: { flowName?: string; flow_name?: string; result: unknown; state: unknown }) {
    super({ type: "flow_finished", sourceType: "flow" });
    this.flowName = options.flowName ?? options.flow_name ?? "";
    this.flow_name = this.flowName;
    this.result = options.result;
    this.state = options.state;
  }
}

export class FlowFailedEvent extends BaseEvent {
  readonly flowName: string;
  readonly flow_name: string;
  readonly error: string;
  readonly state: unknown;

  constructor(options: { flowName?: string; flow_name?: string; error: unknown; state: unknown }) {
    super({ type: "flow_failed", sourceType: "flow" });
    this.flowName = options.flowName ?? options.flow_name ?? "";
    this.flow_name = this.flowName;
    this.error = formatError(options.error);
    this.state = options.state;
  }
}

export class FlowPausedEvent extends BaseEvent {
  readonly flowName: string;
  readonly flow_name: string;
  readonly flowId: string | null;
  readonly flow_id: string | null;
  readonly methodName: string | null;
  readonly method_name: string | null;
  readonly pending: unknown;
  readonly state: unknown;
  readonly message: string | null;
  readonly emit: readonly string[] | null;

  constructor(options: {
    flowName?: string;
    flow_name?: string;
    flowId?: string | null;
    flow_id?: string | null;
    methodName?: string | null;
    method_name?: string | null;
    pending?: unknown;
    state: unknown;
    message?: string | null;
    emit?: readonly string[] | null;
  }) {
    super({ type: "flow_paused", sourceType: "flow" });
    this.flowName = options.flowName ?? options.flow_name ?? "";
    this.flow_name = this.flowName;
    this.flowId = options.flowId ?? options.flow_id ?? null;
    this.flow_id = this.flowId;
    this.methodName = options.methodName ?? options.method_name ?? null;
    this.method_name = this.methodName;
    this.pending = options.pending ?? null;
    this.state = options.state;
    this.message = options.message ?? null;
    this.emit = options.emit ?? null;
  }
}

export class FlowPlotEvent extends BaseEvent {
  readonly flowName: string;
  readonly flow_name: string;

  constructor(options: { flowName?: string; flow_name?: string }) {
    super({ type: "flow_plot", sourceType: "flow" });
    this.flowName = options.flowName ?? options.flow_name ?? "";
    this.flow_name = this.flowName;
  }
}

export class FlowInputRequestedEvent extends BaseEvent {
  readonly flowName: string;
  readonly flow_name: string;
  readonly methodName: string | null;
  readonly method_name: string | null;
  readonly message: string;
  readonly metadata: Record<string, unknown> | null;

  constructor(options: {
    flowName?: string;
    flow_name?: string;
    methodName?: string | null;
    method_name?: string | null;
    message: string;
    metadata?: Record<string, unknown> | null;
  }) {
    super({ type: "flow_input_requested", sourceType: "flow" });
    this.flowName = options.flowName ?? options.flow_name ?? "";
    this.flow_name = this.flowName;
    this.methodName = options.methodName ?? options.method_name ?? null;
    this.method_name = this.methodName;
    this.message = options.message;
    this.metadata = options.metadata ?? null;
  }
}

export class FlowInputReceivedEvent extends BaseEvent {
  readonly flowName: string;
  readonly flow_name: string;
  readonly methodName: string | null;
  readonly method_name: string | null;
  readonly message: string;
  readonly response: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly responseMetadata: Record<string, unknown> | null;
  readonly response_metadata: Record<string, unknown> | null;

  constructor(options: {
    flowName?: string;
    flow_name?: string;
    methodName?: string | null;
    method_name?: string | null;
    message: string;
    response: string | null;
    metadata?: Record<string, unknown> | null;
    responseMetadata?: Record<string, unknown> | null;
    response_metadata?: Record<string, unknown> | null;
  }) {
    super({ type: "flow_input_received", sourceType: "flow" });
    this.flowName = options.flowName ?? options.flow_name ?? "";
    this.flow_name = this.flowName;
    this.methodName = options.methodName ?? options.method_name ?? null;
    this.method_name = this.methodName;
    this.message = options.message;
    this.response = options.response;
    this.metadata = options.metadata ?? null;
    this.responseMetadata = options.responseMetadata ?? options.response_metadata ?? null;
    this.response_metadata = this.responseMetadata;
  }
}

export class MethodExecutionStartedEvent extends BaseEvent {
  readonly flowName: string;
  readonly flow_name: string;
  readonly methodName: string;
  readonly method_name: string;
  readonly state: unknown;
  readonly params: Record<string, unknown> | null;

  constructor(options: { flowName?: string; flow_name?: string; methodName?: string; method_name?: string; state: unknown; params?: Record<string, unknown> | null }) {
    super({ type: "method_execution_started", sourceType: "flow" });
    this.flowName = options.flowName ?? options.flow_name ?? "";
    this.flow_name = this.flowName;
    this.methodName = options.methodName ?? options.method_name ?? "";
    this.method_name = this.methodName;
    this.state = options.state;
    this.params = options.params ?? null;
  }
}

export class MethodExecutionFinishedEvent extends BaseEvent {
  readonly flowName: string;
  readonly flow_name: string;
  readonly methodName: string;
  readonly method_name: string;
  readonly result: unknown;
  readonly state: unknown;

  constructor(options: { flowName?: string; flow_name?: string; methodName?: string; method_name?: string; result: unknown; state: unknown }) {
    super({ type: "method_execution_finished", sourceType: "flow" });
    this.flowName = options.flowName ?? options.flow_name ?? "";
    this.flow_name = this.flowName;
    this.methodName = options.methodName ?? options.method_name ?? "";
    this.method_name = this.methodName;
    this.result = options.result;
    this.state = options.state;
  }
}

export class MethodExecutionFailedEvent extends BaseEvent {
  readonly flowName: string;
  readonly flow_name: string;
  readonly methodName: string;
  readonly method_name: string;
  readonly error: string;
  readonly state: unknown;

  constructor(options: { flowName?: string; flow_name?: string; methodName?: string; method_name?: string; error: unknown; state: unknown }) {
    super({ type: "method_execution_failed", sourceType: "flow" });
    this.flowName = options.flowName ?? options.flow_name ?? "";
    this.flow_name = this.flowName;
    this.methodName = options.methodName ?? options.method_name ?? "";
    this.method_name = this.methodName;
    this.error = formatError(options.error);
    this.state = options.state;
  }
}

export class MethodExecutionPausedEvent extends BaseEvent {
  readonly flowName: string;
  readonly flow_name: string;
  readonly methodName: string;
  readonly method_name: string;
  readonly flowId: string | null;
  readonly flow_id: string | null;
  readonly pending: unknown;
  readonly state: unknown;
  readonly message: string | null;
  readonly emit: readonly string[] | null;

  constructor(options: {
    flowName?: string;
    flow_name?: string;
    methodName?: string;
    method_name?: string;
    flowId?: string | null;
    flow_id?: string | null;
    pending?: unknown;
    state: unknown;
    message?: string | null;
    emit?: readonly string[] | null;
  }) {
    super({ type: "method_execution_paused", sourceType: "flow" });
    this.flowName = options.flowName ?? options.flow_name ?? "";
    this.flow_name = this.flowName;
    this.methodName = options.methodName ?? options.method_name ?? "";
    this.method_name = this.methodName;
    this.flowId = options.flowId ?? options.flow_id ?? null;
    this.flow_id = this.flowId;
    this.pending = options.pending ?? null;
    this.state = options.state;
    this.message = options.message ?? null;
    this.emit = options.emit ?? null;
  }
}

export abstract class CheckpointBaseEvent extends BaseEvent {
  readonly location: string;
  readonly provider: string;
  readonly trigger: string | null;
  readonly branch: string | null;
  readonly parent_id: string | null;

  constructor(type: EventType, options: { location: string; provider: string; trigger?: string | null; branch?: string | null; parent_id?: string | null }) {
    super({ type, sourceType: "checkpoint" });
    this.location = options.location;
    this.provider = options.provider;
    this.trigger = options.trigger ?? null;
    this.branch = options.branch ?? null;
    this.parent_id = options.parent_id ?? null;
  }
}

export class CheckpointStartedEvent extends CheckpointBaseEvent {
  constructor(options: { location: string; provider: string; trigger?: string | null; branch?: string | null; parent_id?: string | null }) {
    super("checkpoint_started", options);
  }
}

export class CheckpointCompletedEvent extends CheckpointBaseEvent {
  readonly checkpoint_id: string;
  readonly duration_ms: number;

  constructor(options: { location: string; provider: string; checkpoint_id: string; duration_ms: number; trigger?: string | null; branch?: string | null; parent_id?: string | null }) {
    super("checkpoint_completed", options);
    this.checkpoint_id = options.checkpoint_id;
    this.duration_ms = options.duration_ms;
  }
}

export class CheckpointFailedEvent extends CheckpointBaseEvent {
  readonly error: string;

  constructor(options: { location: string; provider: string; error: unknown; trigger?: string | null; branch?: string | null; parent_id?: string | null }) {
    super("checkpoint_failed", options);
    this.error = formatError(options.error);
  }
}

export class CheckpointPrunedEvent extends CheckpointBaseEvent {
  readonly removed_count: number;
  readonly max_checkpoints: number;

  constructor(options: { location: string; provider: string; removed_count: number; max_checkpoints: number; trigger?: string | null; branch?: string | null; parent_id?: string | null }) {
    super("checkpoint_pruned", options);
    this.removed_count = options.removed_count;
    this.max_checkpoints = options.max_checkpoints;
  }
}

export abstract class CheckpointForkBaseEvent extends BaseEvent {
  readonly branch: string;
  readonly parent_branch: string | null;
  readonly parent_checkpoint_id: string | null;

  constructor(type: EventType, options: { branch: string; parent_branch?: string | null; parent_checkpoint_id?: string | null }) {
    super({ type, sourceType: "checkpoint" });
    this.branch = options.branch;
    this.parent_branch = options.parent_branch ?? null;
    this.parent_checkpoint_id = options.parent_checkpoint_id ?? null;
  }
}

export class CheckpointForkStartedEvent extends CheckpointForkBaseEvent {
  constructor(options: { branch: string; parent_branch?: string | null; parent_checkpoint_id?: string | null }) {
    super("checkpoint_fork_started", options);
  }
}

export class CheckpointForkCompletedEvent extends CheckpointForkBaseEvent {
  constructor(options: { branch: string; parent_branch?: string | null; parent_checkpoint_id?: string | null }) {
    super("checkpoint_fork_completed", options);
  }
}

export abstract class CheckpointRestoreBaseEvent extends BaseEvent {
  readonly location: string;
  readonly provider: string | null;

  constructor(type: EventType, options: { location: string; provider?: string | null }) {
    super({ type, sourceType: "checkpoint" });
    this.location = options.location;
    this.provider = options.provider ?? null;
  }
}

export class CheckpointRestoreStartedEvent extends CheckpointRestoreBaseEvent {
  constructor(options: { location: string; provider?: string | null }) {
    super("checkpoint_restore_started", options);
  }
}

export class CheckpointRestoreCompletedEvent extends CheckpointRestoreBaseEvent {
  readonly checkpoint_id: string;
  readonly branch: string | null;
  readonly parent_id: string | null;
  readonly duration_ms: number;

  constructor(options: { location: string; checkpoint_id: string; duration_ms: number; provider?: string | null; branch?: string | null; parent_id?: string | null }) {
    super("checkpoint_restore_completed", options);
    this.checkpoint_id = options.checkpoint_id;
    this.branch = options.branch ?? null;
    this.parent_id = options.parent_id ?? null;
    this.duration_ms = options.duration_ms;
  }
}

export class CheckpointRestoreFailedEvent extends CheckpointRestoreBaseEvent {
  readonly error: string;

  constructor(options: { location: string; error: unknown; provider?: string | null }) {
    super("checkpoint_restore_failed", options);
    this.error = formatError(options.error);
  }
}

export type ObservationCommonEventOptions = {
  agent_role: string;
  step_number: number;
  step_description?: string;
  from_task?: unknown;
  from_agent?: unknown;
};

export abstract class ObservationEvent extends BaseEvent {
  readonly agent_role: string;
  readonly step_number: number;
  readonly step_description: string;
  readonly from_task: unknown;
  readonly from_agent: unknown;
  readonly task_id: string | null;
  readonly task_name: string | null;
  readonly agent_id: string | null;

  constructor(type: EventType, options: ObservationCommonEventOptions) {
    super({
      type,
      sourceType: options.from_agent ? "agent" : options.from_task ? "task" : "observation",
      sourceFingerprint: getStringProperty(options.from_agent, "id") ?? getStringProperty(options.from_task, "id"),
    });
    this.agent_role = options.agent_role;
    this.step_number = options.step_number;
    this.step_description = options.step_description ?? "";
    this.from_task = options.from_task ?? null;
    this.from_agent = options.from_agent ?? null;
    this.task_id = getStringProperty(options.from_task, "id");
    this.task_name = getStringProperty(options.from_task, "name") ?? getStringProperty(options.from_task, "description");
    this.agent_id = getStringProperty(options.from_agent, "id");
  }
}

export class StepObservationStartedEvent extends ObservationEvent {
  constructor(options: ObservationCommonEventOptions) {
    super("step_observation_started", options);
  }
}

export class StepObservationCompletedEvent extends ObservationEvent {
  readonly step_completed_successfully: boolean;
  readonly key_information_learned: string;
  readonly remaining_plan_still_valid: boolean;
  readonly needs_full_replan: boolean;
  readonly replan_reason: string | null;
  readonly goal_already_achieved: boolean;
  readonly suggested_refinements: readonly string[] | null;

  constructor(options: ObservationCommonEventOptions & {
    step_completed_successfully?: boolean;
    key_information_learned?: string;
    remaining_plan_still_valid?: boolean;
    needs_full_replan?: boolean;
    replan_reason?: string | null;
    goal_already_achieved?: boolean;
    suggested_refinements?: readonly string[] | null;
  }) {
    super("step_observation_completed", options);
    this.step_completed_successfully = options.step_completed_successfully ?? true;
    this.key_information_learned = options.key_information_learned ?? "";
    this.remaining_plan_still_valid = options.remaining_plan_still_valid ?? true;
    this.needs_full_replan = options.needs_full_replan ?? false;
    this.replan_reason = options.replan_reason ?? null;
    this.goal_already_achieved = options.goal_already_achieved ?? false;
    this.suggested_refinements = options.suggested_refinements ?? null;
  }
}

export class StepObservationFailedEvent extends ObservationEvent {
  readonly error: string;

  constructor(options: ObservationCommonEventOptions & { error?: unknown }) {
    super("step_observation_failed", options);
    this.error = options.error === undefined ? "" : formatError(options.error);
  }
}

export class PlanRefinementEvent extends ObservationEvent {
  readonly refined_step_count: number;
  readonly refinements: readonly string[] | null;

  constructor(options: ObservationCommonEventOptions & { refined_step_count?: number; refinements?: readonly string[] | null }) {
    super("plan_refinement", options);
    this.refined_step_count = options.refined_step_count ?? 0;
    this.refinements = options.refinements ?? null;
  }
}

export class PlanReplanTriggeredEvent extends ObservationEvent {
  readonly replan_reason: string;
  readonly replan_count: number;
  readonly completed_steps_preserved: number;

  constructor(options: ObservationCommonEventOptions & { replan_reason?: string; replan_count?: number; completed_steps_preserved?: number }) {
    super("plan_replan_triggered", options);
    this.replan_reason = options.replan_reason ?? "";
    this.replan_count = options.replan_count ?? 0;
    this.completed_steps_preserved = options.completed_steps_preserved ?? 0;
  }
}

export class GoalAchievedEarlyEvent extends ObservationEvent {
  readonly steps_remaining: number;
  readonly steps_completed: number;

  constructor(options: ObservationCommonEventOptions & { steps_remaining?: number; steps_completed?: number }) {
    super("goal_achieved_early", options);
    this.steps_remaining = options.steps_remaining ?? 0;
    this.steps_completed = options.steps_completed ?? 0;
  }
}

export const SignalType = {
  SIGTERM: 15,
  SIGINT: 2,
  SIGHUP: 1,
  SIGTSTP: 20,
  SIGCONT: 18,
} as const;

export type SignalType = typeof SignalType[keyof typeof SignalType];

export abstract class SignalEventBase extends BaseEvent {
  readonly signal_number: SignalType;
  readonly reason: string | null;

  constructor(type: EventType, signalNumber: SignalType, reason?: string | null) {
    super({ type, sourceType: "system" });
    this.signal_number = signalNumber;
    this.reason = reason ?? null;
  }

  modelDump(): Record<string, unknown> {
    return {
      ...this.to_json(),
      signal_number: this.signal_number,
      reason: this.reason,
    };
  }

  model_dump(): Record<string, unknown> {
    return this.modelDump();
  }
}

export class SigTermEvent extends SignalEventBase {
  constructor(options: { reason?: string | null } = {}) {
    super("SIGTERM", SignalType.SIGTERM, options.reason);
  }
}

export class SigIntEvent extends SignalEventBase {
  constructor(options: { reason?: string | null } = {}) {
    super("SIGINT", SignalType.SIGINT, options.reason);
  }
}

export class SigHupEvent extends SignalEventBase {
  constructor(options: { reason?: string | null } = {}) {
    super("SIGHUP", SignalType.SIGHUP, options.reason);
  }
}

export class SigTStpEvent extends SignalEventBase {
  constructor(options: { reason?: string | null } = {}) {
    super("SIGTSTP", SignalType.SIGTSTP, options.reason);
  }
}

export class SigContEvent extends SignalEventBase {
  constructor(options: { reason?: string | null } = {}) {
    super("SIGCONT", SignalType.SIGCONT, options.reason);
  }
}

export type SignalEvent = SigTermEvent | SigIntEvent | SigHupEvent | SigTStpEvent | SigContEvent;
export const SignalEvent = Object.freeze({ kind: "SignalEvent" });
export const SIGNAL_EVENT_TYPES = Object.freeze([SigTermEvent, SigIntEvent, SigHupEvent, SigTStpEvent, SigContEvent] as const);

function validateSignalEventPayload(data: unknown): SignalEvent {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Signal event payload must be an object.");
  }
  const payload = data as Record<string, unknown>;
  const reason = typeof payload.reason === "string" || payload.reason === null ? payload.reason : undefined;
  const options = reason === undefined ? {} : { reason };
  switch (payload.type) {
    case "SIGTERM":
      return new SigTermEvent(options);
    case "SIGINT":
      return new SigIntEvent(options);
    case "SIGHUP":
      return new SigHupEvent(options);
    case "SIGTSTP":
      return new SigTStpEvent(options);
    case "SIGCONT":
      return new SigContEvent(options);
    default:
      throw new Error(`Unsupported signal event type: ${String(payload.type)}`);
  }
}

export const signal_event_adapter = Object.freeze({
  validatePython: validateSignalEventPayload,
  validate_python: validateSignalEventPayload,
});

export function on_signal<THandler extends EventHandler<SignalEvent>>(handler: THandler): THandler {
  crewaiEventBus.on("SIGTERM", handler);
  crewaiEventBus.on("SIGINT", handler);
  crewaiEventBus.on("SIGHUP", handler);
  crewaiEventBus.on("SIGTSTP", handler);
  crewaiEventBus.on("SIGCONT", handler);
  return handler;
}

export class AgentLogsStartedEvent extends BaseEvent {
  readonly agent_role: string;
  readonly task_description: string | null;
  readonly verbose: boolean;

  constructor(options: { agent_role: string; task_description?: string | null; verbose?: boolean }) {
    super({ type: "agent_logs_started", sourceType: "agent" });
    this.agent_role = options.agent_role;
    this.task_description = options.task_description ?? null;
    this.verbose = options.verbose ?? false;
  }
}

export class AgentLogsExecutionEvent extends BaseEvent {
  readonly agent_role: string;
  readonly formatted_answer: unknown;
  readonly verbose: boolean;

  constructor(options: { agent_role: string; formatted_answer: unknown; verbose?: boolean }) {
    super({ type: "agent_logs_execution", sourceType: "agent" });
    this.agent_role = options.agent_role;
    this.formatted_answer = options.formatted_answer;
    this.verbose = options.verbose ?? false;
  }
}

export type A2AEventMetadata = Record<string, unknown>;
export type A2AAgentCardMetadata = Record<string, unknown>;

export type A2ACommonEventOptions = {
  fromTask?: unknown;
  from_task?: unknown;
  fromAgent?: unknown;
  from_agent?: unknown;
  sourceType?: string | null;
  source_type?: string | null;
  sourceFingerprint?: string | null;
  source_fingerprint?: string | null;
};

export abstract class A2AEventBase extends BaseEvent {
  readonly fromTask: unknown;
  readonly from_task: unknown;
  readonly fromAgent: unknown;
  readonly from_agent: unknown;
  readonly taskId: string | null;
  readonly task_id: string | null;
  readonly taskName: string | null;
  readonly task_name: string | null;
  readonly agentId: string | null;
  readonly agent_id: string | null;
  readonly agentRole: string | null;
  readonly agent_role: string | null;
  readonly fingerprintMetadata: A2AEventMetadata | null;
  readonly fingerprint_metadata: A2AEventMetadata | null;

  static extractTaskAndAgentMetadata<T extends Record<string, unknown>>(data: T): T & Record<string, unknown> {
    const extracted: Record<string, unknown> = { ...data };
    const task = extracted.from_task ?? extracted.fromTask;
    const agent = extracted.from_agent ?? extracted.fromAgent;

    if (task) {
      const taskId = getStringProperty(task, "id");
      const taskName = getNonEmptyStringProperty(task, "name") ?? getStringProperty(task, "description");
      extracted.task_id = taskId;
      extracted.task_name = taskName;
      setA2ADefault(extracted, "source_fingerprint", "sourceFingerprint", taskId);
      setA2ADefault(extracted, "source_type", "sourceType", "task");
      setA2ADefault(extracted, "fingerprint_metadata", "fingerprintMetadata", {
        task_id: taskId,
        task_name: taskName,
      });
      if ("fromTask" in extracted && !("from_task" in extracted)) {
        extracted.fromTask = null;
      } else {
        extracted.from_task = null;
      }
    }

    if (agent) {
      const agentId = getStringProperty(agent, "id");
      const agentRole = getStringProperty(agent, "role");
      extracted.agent_id = agentId;
      extracted.agent_role = agentRole;
      setA2ADefault(extracted, "source_fingerprint", "sourceFingerprint", agentId);
      setA2ADefault(extracted, "source_type", "sourceType", "agent");
      setA2ADefault(extracted, "fingerprint_metadata", "fingerprintMetadata", {
        agent_id: agentId,
        agent_role: agentRole,
      });
      if ("fromAgent" in extracted && !("from_agent" in extracted)) {
        extracted.fromAgent = null;
      } else {
        extracted.from_agent = null;
      }
    }

    return extracted as T & Record<string, unknown>;
  }

  static extract_task_and_agent_metadata(data: Record<string, unknown>): Record<string, unknown> {
    return this.extractTaskAndAgentMetadata(data);
  }

  constructor(type: EventType, options: A2ACommonEventOptions = {}) {
    const sourceType = options.sourceType ?? options.source_type ?? inferA2ASourceType(options);
    const sourceFingerprint = options.sourceFingerprint ?? options.source_fingerprint ?? inferA2ASourceFingerprint(options);
    super({ type, sourceType, sourceFingerprint });
    this.fromTask = options.fromTask ?? options.from_task ?? null;
    this.from_task = this.fromTask;
    this.fromAgent = options.fromAgent ?? options.from_agent ?? null;
    this.from_agent = this.fromAgent;
    this.taskId = getStringProperty(this.fromTask, "id");
    this.task_id = this.taskId;
    this.taskName = getStringProperty(this.fromTask, "name") ?? getStringProperty(this.fromTask, "description");
    this.task_name = this.taskName;
    this.agentId = getStringProperty(this.fromAgent, "id");
    this.agent_id = this.agentId;
    this.agentRole = getStringProperty(this.fromAgent, "role");
    this.agent_role = this.agentRole;
    this.fingerprintMetadata = createA2AFingerprintMetadata(this);
    this.fingerprint_metadata = this.fingerprintMetadata;
  }
}

export class A2ADelegationStartedEvent extends A2AEventBase {
  readonly endpoint: string;
  readonly task_description: string;
  readonly agent_id: string;
  readonly context_id: string | null;
  readonly is_multiturn: boolean;
  readonly turn_number: number;
  readonly a2a_agent_name: string | null;
  readonly agent_card: A2AAgentCardMetadata | null;
  readonly protocol_version: string | null;
  readonly provider: A2AEventMetadata | null;
  readonly skill_id: string | null;
  readonly metadata: A2AEventMetadata | null;
  readonly extensions: readonly string[] | null;

  constructor(options: A2ACommonEventOptions & {
    endpoint: string;
    task_description: string;
    agent_id?: string;
    context_id?: string | null;
    is_multiturn?: boolean;
    turn_number?: number;
    a2a_agent_name?: string | null;
    agent_card?: A2AAgentCardMetadata | null;
    protocol_version?: string | null;
    provider?: A2AEventMetadata | null;
    skill_id?: string | null;
    metadata?: A2AEventMetadata | null;
    extensions?: readonly string[] | null;
  }) {
    super("a2a_delegation_started", options);
    this.endpoint = options.endpoint;
    this.task_description = options.task_description;
    this.agent_id = options.agent_id ?? this.agentId ?? "";
    this.context_id = options.context_id ?? null;
    this.is_multiturn = options.is_multiturn ?? false;
    this.turn_number = options.turn_number ?? 1;
    this.a2a_agent_name = options.a2a_agent_name ?? null;
    this.agent_card = options.agent_card ?? null;
    this.protocol_version = options.protocol_version ?? null;
    this.provider = options.provider ?? null;
    this.skill_id = options.skill_id ?? null;
    this.metadata = options.metadata ?? null;
    this.extensions = options.extensions ?? null;
  }
}

export class A2ADelegationCompletedEvent extends A2AEventBase {
  readonly status: string;
  readonly result: string | null;
  readonly error: string | null;
  readonly context_id: string | null;
  readonly is_multiturn: boolean;
  readonly endpoint: string | null;
  readonly a2a_agent_name: string | null;
  readonly agent_card: A2AAgentCardMetadata | null;
  readonly provider: A2AEventMetadata | null;
  readonly metadata: A2AEventMetadata | null;
  readonly extensions: readonly string[] | null;

  constructor(options: A2ACommonEventOptions & {
    status: string;
    result?: string | null;
    error?: string | null;
    context_id?: string | null;
    is_multiturn?: boolean;
    endpoint?: string | null;
    a2a_agent_name?: string | null;
    agent_card?: A2AAgentCardMetadata | null;
    provider?: A2AEventMetadata | null;
    metadata?: A2AEventMetadata | null;
    extensions?: readonly string[] | null;
  }) {
    super("a2a_delegation_completed", options);
    this.status = options.status;
    this.result = options.result ?? null;
    this.error = options.error ?? null;
    this.context_id = options.context_id ?? null;
    this.is_multiturn = options.is_multiturn ?? false;
    this.endpoint = options.endpoint ?? null;
    this.a2a_agent_name = options.a2a_agent_name ?? null;
    this.agent_card = options.agent_card ?? null;
    this.provider = options.provider ?? null;
    this.metadata = options.metadata ?? null;
    this.extensions = options.extensions ?? null;
  }
}

export class A2AConversationStartedEvent extends A2AEventBase {
  readonly agent_id: string;
  readonly endpoint: string;
  readonly context_id: string | null;
  readonly a2a_agent_name: string | null;
  readonly agent_card: A2AAgentCardMetadata | null;
  readonly protocol_version: string | null;
  readonly provider: A2AEventMetadata | null;
  readonly skill_id: string | null;
  readonly reference_task_ids: readonly string[] | null;
  readonly metadata: A2AEventMetadata | null;
  readonly extensions: readonly string[] | null;

  constructor(options: A2ACommonEventOptions & {
    agent_id?: string;
    endpoint: string;
    context_id?: string | null;
    a2a_agent_name?: string | null;
    agent_card?: A2AAgentCardMetadata | null;
    protocol_version?: string | null;
    provider?: A2AEventMetadata | null;
    skill_id?: string | null;
    reference_task_ids?: readonly string[] | null;
    metadata?: A2AEventMetadata | null;
    extensions?: readonly string[] | null;
  }) {
    super("a2a_conversation_started", options);
    this.agent_id = options.agent_id ?? this.agentId ?? "";
    this.endpoint = options.endpoint;
    this.context_id = options.context_id ?? null;
    this.a2a_agent_name = options.a2a_agent_name ?? null;
    this.agent_card = options.agent_card ?? null;
    this.protocol_version = options.protocol_version ?? null;
    this.provider = options.provider ?? null;
    this.skill_id = options.skill_id ?? null;
    this.reference_task_ids = options.reference_task_ids ?? null;
    this.metadata = options.metadata ?? null;
    this.extensions = options.extensions ?? null;
  }
}

export class A2AMessageSentEvent extends A2AEventBase {
  readonly message: string;
  readonly turn_number: number;
  readonly context_id: string | null;
  readonly message_id: string | null;
  readonly is_multiturn: boolean;
  readonly agent_role: string | null;
  readonly endpoint: string | null;
  readonly a2a_agent_name: string | null;
  readonly skill_id: string | null;
  readonly metadata: A2AEventMetadata | null;
  readonly extensions: readonly string[] | null;

  constructor(options: A2ACommonEventOptions & {
    message: string;
    turn_number: number;
    context_id?: string | null;
    message_id?: string | null;
    is_multiturn?: boolean;
    agent_role?: string | null;
    endpoint?: string | null;
    a2a_agent_name?: string | null;
    skill_id?: string | null;
    metadata?: A2AEventMetadata | null;
    extensions?: readonly string[] | null;
  }) {
    super("a2a_message_sent", options);
    this.message = options.message;
    this.turn_number = options.turn_number;
    this.context_id = options.context_id ?? null;
    this.message_id = options.message_id ?? null;
    this.is_multiturn = options.is_multiturn ?? false;
    this.agent_role = options.agent_role ?? this.agentRole;
    this.endpoint = options.endpoint ?? null;
    this.a2a_agent_name = options.a2a_agent_name ?? null;
    this.skill_id = options.skill_id ?? null;
    this.metadata = options.metadata ?? null;
    this.extensions = options.extensions ?? null;
  }
}

export class A2AResponseReceivedEvent extends A2AEventBase {
  readonly response: string;
  readonly turn_number: number;
  readonly context_id: string | null;
  readonly message_id: string | null;
  readonly is_multiturn: boolean;
  readonly status: string;
  readonly final: boolean;
  readonly agent_role: string | null;
  readonly endpoint: string | null;
  readonly a2a_agent_name: string | null;
  readonly metadata: A2AEventMetadata | null;
  readonly extensions: readonly string[] | null;

  constructor(options: A2ACommonEventOptions & {
    response: string;
    turn_number: number;
    status: string;
    context_id?: string | null;
    message_id?: string | null;
    is_multiturn?: boolean;
    final?: boolean;
    agent_role?: string | null;
    endpoint?: string | null;
    a2a_agent_name?: string | null;
    metadata?: A2AEventMetadata | null;
    extensions?: readonly string[] | null;
  }) {
    super("a2a_response_received", options);
    this.response = options.response;
    this.turn_number = options.turn_number;
    this.context_id = options.context_id ?? null;
    this.message_id = options.message_id ?? null;
    this.is_multiturn = options.is_multiturn ?? false;
    this.status = options.status;
    this.final = options.final ?? false;
    this.agent_role = options.agent_role ?? this.agentRole;
    this.endpoint = options.endpoint ?? null;
    this.a2a_agent_name = options.a2a_agent_name ?? null;
    this.metadata = options.metadata ?? null;
    this.extensions = options.extensions ?? null;
  }
}

export class A2AConversationCompletedEvent extends A2AEventBase {
  readonly status: "completed" | "failed";
  readonly final_result: string | null;
  readonly error: string | null;
  readonly context_id: string | null;
  readonly total_turns: number;
  readonly endpoint: string | null;
  readonly a2a_agent_name: string | null;
  readonly agent_card: A2AAgentCardMetadata | null;
  readonly reference_task_ids: readonly string[] | null;
  readonly metadata: A2AEventMetadata | null;
  readonly extensions: readonly string[] | null;

  constructor(options: A2ACommonEventOptions & {
    status: "completed" | "failed";
    total_turns: number;
    final_result?: string | null;
    error?: string | null;
    context_id?: string | null;
    endpoint?: string | null;
    a2a_agent_name?: string | null;
    agent_card?: A2AAgentCardMetadata | null;
    reference_task_ids?: readonly string[] | null;
    metadata?: A2AEventMetadata | null;
    extensions?: readonly string[] | null;
  }) {
    super("a2a_conversation_completed", options);
    this.status = options.status;
    this.final_result = options.final_result ?? null;
    this.error = options.error ?? null;
    this.context_id = options.context_id ?? null;
    this.total_turns = options.total_turns;
    this.endpoint = options.endpoint ?? null;
    this.a2a_agent_name = options.a2a_agent_name ?? null;
    this.agent_card = options.agent_card ?? null;
    this.reference_task_ids = options.reference_task_ids ?? null;
    this.metadata = options.metadata ?? null;
    this.extensions = options.extensions ?? null;
  }
}

export class A2APollingStartedEvent extends A2AEventBase {
  readonly task_id: string;
  readonly context_id: string | null;
  readonly polling_interval: number;
  readonly endpoint: string;
  readonly a2a_agent_name: string | null;
  readonly metadata: A2AEventMetadata | null;

  constructor(options: A2ACommonEventOptions & {
    task_id?: string;
    context_id?: string | null;
    polling_interval: number;
    endpoint: string;
    a2a_agent_name?: string | null;
    metadata?: A2AEventMetadata | null;
  }) {
    super("a2a_polling_started", options);
    this.task_id = options.task_id ?? this.taskId ?? "";
    this.context_id = options.context_id ?? null;
    this.polling_interval = options.polling_interval;
    this.endpoint = options.endpoint;
    this.a2a_agent_name = options.a2a_agent_name ?? null;
    this.metadata = options.metadata ?? null;
  }
}

export class A2APollingStatusEvent extends A2AEventBase {
  readonly task_id: string;
  readonly context_id: string | null;
  readonly state: string;
  readonly elapsed_seconds: number;
  readonly poll_count: number;
  readonly endpoint: string | null;
  readonly a2a_agent_name: string | null;
  readonly metadata: A2AEventMetadata | null;

  constructor(options: A2ACommonEventOptions & {
    task_id?: string;
    state: string;
    elapsed_seconds: number;
    poll_count: number;
    context_id?: string | null;
    endpoint?: string | null;
    a2a_agent_name?: string | null;
    metadata?: A2AEventMetadata | null;
  }) {
    super("a2a_polling_status", options);
    this.task_id = options.task_id ?? this.taskId ?? "";
    this.context_id = options.context_id ?? null;
    this.state = options.state;
    this.elapsed_seconds = options.elapsed_seconds;
    this.poll_count = options.poll_count;
    this.endpoint = options.endpoint ?? null;
    this.a2a_agent_name = options.a2a_agent_name ?? null;
    this.metadata = options.metadata ?? null;
  }
}

export class A2APushNotificationRegisteredEvent extends A2AEventBase {
  readonly task_id: string;
  readonly context_id: string | null;
  readonly callback_url: string;
  readonly endpoint: string | null;
  readonly a2a_agent_name: string | null;
  readonly metadata: A2AEventMetadata | null;

  constructor(options: A2ACommonEventOptions & {
    task_id?: string;
    callback_url: string;
    context_id?: string | null;
    endpoint?: string | null;
    a2a_agent_name?: string | null;
    metadata?: A2AEventMetadata | null;
  }) {
    super("a2a_push_notification_registered", options);
    this.task_id = options.task_id ?? this.taskId ?? "";
    this.context_id = options.context_id ?? null;
    this.callback_url = options.callback_url;
    this.endpoint = options.endpoint ?? null;
    this.a2a_agent_name = options.a2a_agent_name ?? null;
    this.metadata = options.metadata ?? null;
  }
}

export class A2APushNotificationReceivedEvent extends A2AEventBase {
  readonly task_id: string;
  readonly context_id: string | null;
  readonly state: string;
  readonly endpoint: string | null;
  readonly a2a_agent_name: string | null;
  readonly metadata: A2AEventMetadata | null;

  constructor(options: A2ACommonEventOptions & {
    task_id?: string;
    state: string;
    context_id?: string | null;
    endpoint?: string | null;
    a2a_agent_name?: string | null;
    metadata?: A2AEventMetadata | null;
  }) {
    super("a2a_push_notification_received", options);
    this.task_id = options.task_id ?? this.taskId ?? "";
    this.context_id = options.context_id ?? null;
    this.state = options.state;
    this.endpoint = options.endpoint ?? null;
    this.a2a_agent_name = options.a2a_agent_name ?? null;
    this.metadata = options.metadata ?? null;
  }
}

export class A2APushNotificationSentEvent extends A2AEventBase {
  readonly task_id: string;
  readonly context_id: string | null;
  readonly callback_url: string;
  readonly state: string;
  readonly success: boolean;
  readonly error: string | null;
  readonly metadata: A2AEventMetadata | null;

  constructor(options: A2ACommonEventOptions & {
    task_id?: string;
    callback_url: string;
    state: string;
    context_id?: string | null;
    success?: boolean;
    error?: string | null;
    metadata?: A2AEventMetadata | null;
  }) {
    super("a2a_push_notification_sent", options);
    this.task_id = options.task_id ?? this.taskId ?? "";
    this.context_id = options.context_id ?? null;
    this.callback_url = options.callback_url;
    this.state = options.state;
    this.success = options.success ?? true;
    this.error = options.error ?? null;
    this.metadata = options.metadata ?? null;
  }
}

export class A2APushNotificationTimeoutEvent extends A2AEventBase {
  readonly task_id: string;
  readonly context_id: string | null;
  readonly timeout_seconds: number;
  readonly endpoint: string | null;
  readonly a2a_agent_name: string | null;
  readonly metadata: A2AEventMetadata | null;

  constructor(options: A2ACommonEventOptions & {
    task_id?: string;
    timeout_seconds: number;
    context_id?: string | null;
    endpoint?: string | null;
    a2a_agent_name?: string | null;
    metadata?: A2AEventMetadata | null;
  }) {
    super("a2a_push_notification_timeout", options);
    this.task_id = options.task_id ?? this.taskId ?? "";
    this.context_id = options.context_id ?? null;
    this.timeout_seconds = options.timeout_seconds;
    this.endpoint = options.endpoint ?? null;
    this.a2a_agent_name = options.a2a_agent_name ?? null;
    this.metadata = options.metadata ?? null;
  }
}

export class A2AStreamingStartedEvent extends A2AEventBase {
  readonly task_id: string | null;
  readonly context_id: string | null;
  readonly endpoint: string;
  readonly a2a_agent_name: string | null;
  readonly turn_number: number;
  readonly is_multiturn: boolean;
  readonly agent_role: string | null;
  readonly metadata: A2AEventMetadata | null;
  readonly extensions: readonly string[] | null;

  constructor(options: A2ACommonEventOptions & {
    endpoint: string;
    task_id?: string | null;
    context_id?: string | null;
    a2a_agent_name?: string | null;
    turn_number?: number;
    is_multiturn?: boolean;
    agent_role?: string | null;
    metadata?: A2AEventMetadata | null;
    extensions?: readonly string[] | null;
  }) {
    super("a2a_streaming_started", options);
    this.task_id = options.task_id ?? this.taskId;
    this.context_id = options.context_id ?? null;
    this.endpoint = options.endpoint;
    this.a2a_agent_name = options.a2a_agent_name ?? null;
    this.turn_number = options.turn_number ?? 1;
    this.is_multiturn = options.is_multiturn ?? false;
    this.agent_role = options.agent_role ?? this.agentRole;
    this.metadata = options.metadata ?? null;
    this.extensions = options.extensions ?? null;
  }
}

export class A2AStreamingChunkEvent extends A2AEventBase {
  readonly task_id: string | null;
  readonly context_id: string | null;
  readonly chunk: string;
  readonly chunk_index: number;
  readonly final: boolean;
  readonly endpoint: string | null;
  readonly a2a_agent_name: string | null;
  readonly turn_number: number;
  readonly is_multiturn: boolean;
  readonly metadata: A2AEventMetadata | null;
  readonly extensions: readonly string[] | null;

  constructor(options: A2ACommonEventOptions & {
    chunk: string;
    chunk_index: number;
    task_id?: string | null;
    context_id?: string | null;
    final?: boolean;
    endpoint?: string | null;
    a2a_agent_name?: string | null;
    turn_number?: number;
    is_multiturn?: boolean;
    metadata?: A2AEventMetadata | null;
    extensions?: readonly string[] | null;
  }) {
    super("a2a_streaming_chunk", options);
    this.task_id = options.task_id ?? this.taskId;
    this.context_id = options.context_id ?? null;
    this.chunk = options.chunk;
    this.chunk_index = options.chunk_index;
    this.final = options.final ?? false;
    this.endpoint = options.endpoint ?? null;
    this.a2a_agent_name = options.a2a_agent_name ?? null;
    this.turn_number = options.turn_number ?? 1;
    this.is_multiturn = options.is_multiturn ?? false;
    this.metadata = options.metadata ?? null;
    this.extensions = options.extensions ?? null;
  }
}

export class A2AAgentCardFetchedEvent extends A2AEventBase {
  readonly endpoint: string;
  readonly a2a_agent_name: string | null;
  readonly agent_card: A2AAgentCardMetadata | null;
  readonly protocol_version: string | null;
  readonly provider: A2AEventMetadata | null;
  readonly cached: boolean;
  readonly fetch_time_ms: number | null;
  readonly metadata: A2AEventMetadata | null;

  constructor(options: A2ACommonEventOptions & {
    endpoint: string;
    a2a_agent_name?: string | null;
    agent_card?: A2AAgentCardMetadata | null;
    protocol_version?: string | null;
    provider?: A2AEventMetadata | null;
    cached?: boolean;
    fetch_time_ms?: number | null;
    metadata?: A2AEventMetadata | null;
  }) {
    super("a2a_agent_card_fetched", options);
    this.endpoint = options.endpoint;
    this.a2a_agent_name = options.a2a_agent_name ?? null;
    this.agent_card = options.agent_card ?? null;
    this.protocol_version = options.protocol_version ?? null;
    this.provider = options.provider ?? null;
    this.cached = options.cached ?? false;
    this.fetch_time_ms = options.fetch_time_ms ?? null;
    this.metadata = options.metadata ?? null;
  }
}

export class A2AAuthenticationFailedEvent extends A2AEventBase {
  readonly endpoint: string;
  readonly auth_type: string | null;
  readonly error: string;
  readonly status_code: number | null;
  readonly a2a_agent_name: string | null;
  readonly protocol_version: string | null;
  readonly metadata: A2AEventMetadata | null;

  constructor(options: A2ACommonEventOptions & {
    endpoint: string;
    error: unknown;
    auth_type?: string | null;
    status_code?: number | null;
    a2a_agent_name?: string | null;
    protocol_version?: string | null;
    metadata?: A2AEventMetadata | null;
  }) {
    super("a2a_authentication_failed", options);
    this.endpoint = options.endpoint;
    this.auth_type = options.auth_type ?? null;
    this.error = formatError(options.error);
    this.status_code = options.status_code ?? null;
    this.a2a_agent_name = options.a2a_agent_name ?? null;
    this.protocol_version = options.protocol_version ?? null;
    this.metadata = options.metadata ?? null;
  }
}

export class A2AArtifactReceivedEvent extends A2AEventBase {
  readonly task_id: string;
  readonly artifact_id: string;
  readonly artifact_name: string | null;
  readonly artifact_description: string | null;
  readonly mime_type: string | null;
  readonly size_bytes: number | null;
  readonly append: boolean;
  readonly last_chunk: boolean;
  readonly endpoint: string | null;
  readonly a2a_agent_name: string | null;
  readonly context_id: string | null;
  readonly turn_number: number;
  readonly is_multiturn: boolean;
  readonly metadata: A2AEventMetadata | null;
  readonly extensions: readonly string[] | null;

  constructor(options: A2ACommonEventOptions & {
    task_id?: string;
    artifact_id: string;
    artifact_name?: string | null;
    artifact_description?: string | null;
    mime_type?: string | null;
    size_bytes?: number | null;
    append?: boolean;
    last_chunk?: boolean;
    endpoint?: string | null;
    a2a_agent_name?: string | null;
    context_id?: string | null;
    turn_number?: number;
    is_multiturn?: boolean;
    metadata?: A2AEventMetadata | null;
    extensions?: readonly string[] | null;
  }) {
    super("a2a_artifact_received", options);
    this.task_id = options.task_id ?? this.taskId ?? "";
    this.artifact_id = options.artifact_id;
    this.artifact_name = options.artifact_name ?? null;
    this.artifact_description = options.artifact_description ?? null;
    this.mime_type = options.mime_type ?? null;
    this.size_bytes = options.size_bytes ?? null;
    this.append = options.append ?? false;
    this.last_chunk = options.last_chunk ?? false;
    this.endpoint = options.endpoint ?? null;
    this.a2a_agent_name = options.a2a_agent_name ?? null;
    this.context_id = options.context_id ?? null;
    this.turn_number = options.turn_number ?? 1;
    this.is_multiturn = options.is_multiturn ?? false;
    this.metadata = options.metadata ?? null;
    this.extensions = options.extensions ?? null;
  }
}

export class A2AConnectionErrorEvent extends A2AEventBase {
  readonly endpoint: string;
  readonly error: string;
  readonly error_type: string | null;
  readonly status_code: number | null;
  readonly a2a_agent_name: string | null;
  readonly operation: string | null;
  readonly context_id: string | null;
  readonly task_id: string | null;
  readonly metadata: A2AEventMetadata | null;

  constructor(options: A2ACommonEventOptions & {
    endpoint: string;
    error: unknown;
    error_type?: string | null;
    status_code?: number | null;
    a2a_agent_name?: string | null;
    operation?: string | null;
    context_id?: string | null;
    task_id?: string | null;
    metadata?: A2AEventMetadata | null;
  }) {
    super("a2a_connection_error", options);
    this.endpoint = options.endpoint;
    this.error = formatError(options.error);
    this.error_type = options.error_type ?? null;
    this.status_code = options.status_code ?? null;
    this.a2a_agent_name = options.a2a_agent_name ?? null;
    this.operation = options.operation ?? null;
    this.context_id = options.context_id ?? null;
    this.task_id = options.task_id ?? this.taskId;
    this.metadata = options.metadata ?? null;
  }
}

export class A2AServerTaskStartedEvent extends A2AEventBase {
  readonly task_id: string;
  readonly context_id: string;
  readonly metadata: A2AEventMetadata | null;

  constructor(options: A2ACommonEventOptions & { task_id?: string; context_id: string; metadata?: A2AEventMetadata | null }) {
    super("a2a_server_task_started", options);
    this.task_id = options.task_id ?? this.taskId ?? "";
    this.context_id = options.context_id;
    this.metadata = options.metadata ?? null;
  }
}

export class A2AServerTaskCompletedEvent extends A2AEventBase {
  readonly task_id: string;
  readonly context_id: string;
  readonly result: string;
  readonly metadata: A2AEventMetadata | null;

  constructor(options: A2ACommonEventOptions & { task_id?: string; context_id: string; result: string; metadata?: A2AEventMetadata | null }) {
    super("a2a_server_task_completed", options);
    this.task_id = options.task_id ?? this.taskId ?? "";
    this.context_id = options.context_id;
    this.result = options.result;
    this.metadata = options.metadata ?? null;
  }
}

export class A2AServerTaskCanceledEvent extends A2AEventBase {
  readonly task_id: string;
  readonly context_id: string;
  readonly metadata: A2AEventMetadata | null;

  constructor(options: A2ACommonEventOptions & { task_id?: string; context_id: string; metadata?: A2AEventMetadata | null }) {
    super("a2a_server_task_canceled", options);
    this.task_id = options.task_id ?? this.taskId ?? "";
    this.context_id = options.context_id;
    this.metadata = options.metadata ?? null;
  }
}

export class A2AServerTaskFailedEvent extends A2AEventBase {
  readonly task_id: string;
  readonly context_id: string;
  readonly error: string;
  readonly metadata: A2AEventMetadata | null;

  constructor(options: A2ACommonEventOptions & { task_id?: string; context_id: string; error: unknown; metadata?: A2AEventMetadata | null }) {
    super("a2a_server_task_failed", options);
    this.task_id = options.task_id ?? this.taskId ?? "";
    this.context_id = options.context_id;
    this.error = formatError(options.error);
    this.metadata = options.metadata ?? null;
  }
}

export class A2AParallelDelegationStartedEvent extends A2AEventBase {
  readonly endpoints: readonly string[];
  readonly task_description: string;

  constructor(options: A2ACommonEventOptions & { endpoints: readonly string[]; task_description: string }) {
    super("a2a_parallel_delegation_started", options);
    this.endpoints = options.endpoints;
    this.task_description = options.task_description;
  }
}

export class A2AParallelDelegationCompletedEvent extends A2AEventBase {
  readonly endpoints: readonly string[];
  readonly success_count: number;
  readonly failure_count: number;
  readonly results: Record<string, string> | null;

  constructor(options: A2ACommonEventOptions & {
    endpoints: readonly string[];
    success_count: number;
    failure_count: number;
    results?: Record<string, string> | null;
  }) {
    super("a2a_parallel_delegation_completed", options);
    this.endpoints = options.endpoints;
    this.success_count = options.success_count;
    this.failure_count = options.failure_count;
    this.results = options.results ?? null;
  }
}

export class A2ATransportNegotiatedEvent extends A2AEventBase {
  readonly endpoint: string;
  readonly a2a_agent_name: string | null;
  readonly negotiated_transport: string;
  readonly negotiated_url: string;
  readonly source: string;
  readonly client_supported_transports: readonly string[];
  readonly server_supported_transports: readonly string[];
  readonly server_preferred_transport: string;
  readonly client_preferred_transport: string | null;
  readonly metadata: A2AEventMetadata | null;

  constructor(options: A2ACommonEventOptions & {
    endpoint: string;
    negotiated_transport: string;
    negotiated_url: string;
    source: string;
    client_supported_transports: readonly string[];
    server_supported_transports: readonly string[];
    server_preferred_transport: string;
    a2a_agent_name?: string | null;
    client_preferred_transport?: string | null;
    metadata?: A2AEventMetadata | null;
  }) {
    super("a2a_transport_negotiated", options);
    this.endpoint = options.endpoint;
    this.a2a_agent_name = options.a2a_agent_name ?? null;
    this.negotiated_transport = options.negotiated_transport;
    this.negotiated_url = options.negotiated_url;
    this.source = options.source;
    this.client_supported_transports = options.client_supported_transports;
    this.server_supported_transports = options.server_supported_transports;
    this.server_preferred_transport = options.server_preferred_transport;
    this.client_preferred_transport = options.client_preferred_transport ?? null;
    this.metadata = options.metadata ?? null;
  }
}

export class A2AContentTypeNegotiatedEvent extends A2AEventBase {
  readonly endpoint: string;
  readonly a2a_agent_name: string | null;
  readonly skill_name: string | null;
  readonly client_input_modes: readonly string[];
  readonly client_output_modes: readonly string[];
  readonly server_input_modes: readonly string[];
  readonly server_output_modes: readonly string[];
  readonly negotiated_input_modes: readonly string[];
  readonly negotiated_output_modes: readonly string[];
  readonly negotiation_success: boolean;
  readonly metadata: A2AEventMetadata | null;

  constructor(options: A2ACommonEventOptions & {
    endpoint: string;
    client_input_modes: readonly string[];
    client_output_modes: readonly string[];
    server_input_modes: readonly string[];
    server_output_modes: readonly string[];
    negotiated_input_modes: readonly string[];
    negotiated_output_modes: readonly string[];
    a2a_agent_name?: string | null;
    skill_name?: string | null;
    negotiation_success?: boolean;
    metadata?: A2AEventMetadata | null;
  }) {
    super("a2a_content_type_negotiated", options);
    this.endpoint = options.endpoint;
    this.a2a_agent_name = options.a2a_agent_name ?? null;
    this.skill_name = options.skill_name ?? null;
    this.client_input_modes = options.client_input_modes;
    this.client_output_modes = options.client_output_modes;
    this.server_input_modes = options.server_input_modes;
    this.server_output_modes = options.server_output_modes;
    this.negotiated_input_modes = options.negotiated_input_modes;
    this.negotiated_output_modes = options.negotiated_output_modes;
    this.negotiation_success = options.negotiation_success ?? true;
    this.metadata = options.metadata ?? null;
  }
}

export class A2AContextCreatedEvent extends A2AEventBase {
  readonly context_id: string;
  readonly created_at: number;
  readonly metadata: A2AEventMetadata | null;

  constructor(options: A2ACommonEventOptions & { context_id: string; created_at: number; metadata?: A2AEventMetadata | null }) {
    super("a2a_context_created", options);
    this.context_id = options.context_id;
    this.created_at = options.created_at;
    this.metadata = options.metadata ?? null;
  }
}

export class A2AContextExpiredEvent extends A2AEventBase {
  readonly context_id: string;
  readonly created_at: number;
  readonly age_seconds: number;
  readonly task_count: number;
  readonly metadata: A2AEventMetadata | null;

  constructor(options: A2ACommonEventOptions & {
    context_id: string;
    created_at: number;
    age_seconds: number;
    task_count: number;
    metadata?: A2AEventMetadata | null;
  }) {
    super("a2a_context_expired", options);
    this.context_id = options.context_id;
    this.created_at = options.created_at;
    this.age_seconds = options.age_seconds;
    this.task_count = options.task_count;
    this.metadata = options.metadata ?? null;
  }
}

export class A2AContextIdleEvent extends A2AEventBase {
  readonly context_id: string;
  readonly idle_seconds: number;
  readonly task_count: number;
  readonly metadata: A2AEventMetadata | null;

  constructor(options: A2ACommonEventOptions & { context_id: string; idle_seconds: number; task_count: number; metadata?: A2AEventMetadata | null }) {
    super("a2a_context_idle", options);
    this.context_id = options.context_id;
    this.idle_seconds = options.idle_seconds;
    this.task_count = options.task_count;
    this.metadata = options.metadata ?? null;
  }
}

export class A2AContextCompletedEvent extends A2AEventBase {
  readonly context_id: string;
  readonly total_tasks: number;
  readonly duration_seconds: number;
  readonly metadata: A2AEventMetadata | null;

  constructor(options: A2ACommonEventOptions & {
    context_id: string;
    total_tasks: number;
    duration_seconds: number;
    metadata?: A2AEventMetadata | null;
  }) {
    super("a2a_context_completed", options);
    this.context_id = options.context_id;
    this.total_tasks = options.total_tasks;
    this.duration_seconds = options.duration_seconds;
    this.metadata = options.metadata ?? null;
  }
}

export class A2AContextPrunedEvent extends A2AEventBase {
  readonly context_id: string;
  readonly task_count: number;
  readonly age_seconds: number;
  readonly metadata: A2AEventMetadata | null;

  constructor(options: A2ACommonEventOptions & { context_id: string; task_count: number; age_seconds: number; metadata?: A2AEventMetadata | null }) {
    super("a2a_context_pruned", options);
    this.context_id = options.context_id;
    this.task_count = options.task_count;
    this.age_seconds = options.age_seconds;
    this.metadata = options.metadata ?? null;
  }
}

export type MCPCommonEventOptions = {
  server_name: string;
  server_url?: string | null;
  transport_type?: string | null;
  agent_id?: string | null;
  agent_role?: string | null;
  from_agent?: unknown;
  from_task?: unknown;
};

export abstract class MCPEvent extends BaseEvent {
  readonly server_name: string;
  readonly server_url: string | null;
  readonly transport_type: string | null;
  readonly agent_id: string | null;
  readonly agent_role: string | null;
  readonly from_agent: unknown;
  readonly from_task: unknown;

  constructor(type: EventType, options: MCPCommonEventOptions) {
    super({ type, sourceType: "mcp" });
    this.server_name = options.server_name;
    this.server_url = options.server_url ?? null;
    this.transport_type = options.transport_type ?? null;
    this.agent_id = options.agent_id ?? getStringProperty(options.from_agent, "id");
    this.agent_role = options.agent_role ?? getStringProperty(options.from_agent, "role");
    this.from_agent = options.from_agent ?? null;
    this.from_task = options.from_task ?? null;
  }
}

export class MCPConnectionStartedEvent extends MCPEvent {
  readonly connect_timeout: number | null;
  readonly is_reconnect: boolean;

  constructor(options: MCPCommonEventOptions & { connect_timeout?: number | null; is_reconnect?: boolean }) {
    super("mcp_connection_started", options);
    this.connect_timeout = options.connect_timeout ?? null;
    this.is_reconnect = options.is_reconnect ?? false;
  }
}

export class MCPConnectionCompletedEvent extends MCPEvent {
  readonly started_at: Date | null;
  readonly completed_at: Date | null;
  readonly connection_duration_ms: number | null;
  readonly is_reconnect: boolean;

  constructor(options: MCPCommonEventOptions & {
    started_at?: Date | null;
    completed_at?: Date | null;
    connection_duration_ms?: number | null;
    is_reconnect?: boolean;
  }) {
    super("mcp_connection_completed", options);
    this.started_at = options.started_at ?? null;
    this.completed_at = options.completed_at ?? null;
    this.connection_duration_ms = options.connection_duration_ms ?? null;
    this.is_reconnect = options.is_reconnect ?? false;
  }
}

export class MCPConnectionFailedEvent extends MCPEvent {
  readonly error: string;
  readonly error_type: string | null;
  readonly started_at: Date | null;
  readonly failed_at: Date | null;

  constructor(options: MCPCommonEventOptions & {
    error: unknown;
    error_type?: string | null;
    started_at?: Date | null;
    failed_at?: Date | null;
  }) {
    super("mcp_connection_failed", options);
    this.error = formatError(options.error);
    this.error_type = options.error_type ?? null;
    this.started_at = options.started_at ?? null;
    this.failed_at = options.failed_at ?? null;
  }
}

export class MCPToolExecutionStartedEvent extends MCPEvent {
  readonly tool_name: string;
  readonly tool_args: Record<string, unknown> | null;

  constructor(options: MCPCommonEventOptions & { tool_name: string; tool_args?: Record<string, unknown> | null }) {
    super("mcp_tool_execution_started", options);
    this.tool_name = options.tool_name;
    this.tool_args = options.tool_args ?? null;
  }
}

export class MCPToolExecutionCompletedEvent extends MCPEvent {
  readonly tool_name: string;
  readonly tool_args: Record<string, unknown> | null;
  readonly result: unknown;
  readonly started_at: Date | null;
  readonly completed_at: Date | null;
  readonly execution_duration_ms: number | null;

  constructor(options: MCPCommonEventOptions & {
    tool_name: string;
    tool_args?: Record<string, unknown> | null;
    result?: unknown;
    started_at?: Date | null;
    completed_at?: Date | null;
    execution_duration_ms?: number | null;
  }) {
    super("mcp_tool_execution_completed", options);
    this.tool_name = options.tool_name;
    this.tool_args = options.tool_args ?? null;
    this.result = options.result ?? null;
    this.started_at = options.started_at ?? null;
    this.completed_at = options.completed_at ?? null;
    this.execution_duration_ms = options.execution_duration_ms ?? null;
  }
}

export class MCPToolExecutionFailedEvent extends MCPEvent {
  readonly tool_name: string;
  readonly tool_args: Record<string, unknown> | null;
  readonly error: string;
  readonly error_type: string | null;
  readonly started_at: Date | null;
  readonly failed_at: Date | null;

  constructor(options: MCPCommonEventOptions & {
    tool_name: string;
    tool_args?: Record<string, unknown> | null;
    error: unknown;
    error_type?: string | null;
    started_at?: Date | null;
    failed_at?: Date | null;
  }) {
    super("mcp_tool_execution_failed", options);
    this.tool_name = options.tool_name;
    this.tool_args = options.tool_args ?? null;
    this.error = formatError(options.error);
    this.error_type = options.error_type ?? null;
    this.started_at = options.started_at ?? null;
    this.failed_at = options.failed_at ?? null;
  }
}

export class MCPConfigFetchFailedEvent extends BaseEvent {
  readonly slug: string;
  readonly error: string;
  readonly error_type: string | null;

  constructor(options: { slug: string; error: unknown; error_type?: string | null }) {
    super({ type: "mcp_config_fetch_failed", sourceType: "mcp" });
    this.slug = options.slug;
    this.error = formatError(options.error);
    this.error_type = options.error_type ?? null;
  }
}

export type SkillCommonEventOptions = {
  skill_name?: string;
  skill_path?: string | null;
  from_agent?: unknown;
  from_task?: unknown;
};

export abstract class SkillEvent extends BaseEvent {
  readonly skill_name: string;
  readonly skill_path: string | null;
  readonly from_agent: unknown;
  readonly from_task: unknown;

  constructor(type: EventType, options: SkillCommonEventOptions = {}) {
    super({ type, sourceType: "skill" });
    this.skill_name = options.skill_name ?? "";
    this.skill_path = options.skill_path ?? null;
    this.from_agent = options.from_agent ?? null;
    this.from_task = options.from_task ?? null;
  }
}

export class SkillDiscoveryStartedEvent extends SkillEvent {
  readonly search_path: string;

  constructor(options: SkillCommonEventOptions & { search_path: string }) {
    super("skill_discovery_started", options);
    this.search_path = options.search_path;
  }
}

export class SkillDiscoveryCompletedEvent extends SkillEvent {
  readonly search_path: string;
  readonly skills_found: number;
  readonly skill_names: readonly string[];

  constructor(options: SkillCommonEventOptions & { search_path: string; skills_found: number; skill_names: readonly string[] }) {
    super("skill_discovery_completed", options);
    this.search_path = options.search_path;
    this.skills_found = options.skills_found;
    this.skill_names = options.skill_names;
  }
}

export class SkillLoadedEvent extends SkillEvent {
  readonly disclosure_level: number;

  constructor(options: SkillCommonEventOptions & { disclosure_level?: number } = {}) {
    super("skill_loaded", options);
    this.disclosure_level = options.disclosure_level ?? 1;
  }
}

export class SkillActivatedEvent extends SkillEvent {
  readonly disclosure_level: number;

  constructor(options: SkillCommonEventOptions & { disclosure_level?: number } = {}) {
    super("skill_activated", options);
    this.disclosure_level = options.disclosure_level ?? 2;
  }
}

export class SkillLoadFailedEvent extends SkillEvent {
  readonly error: string;

  constructor(options: SkillCommonEventOptions & { error: unknown }) {
    super("skill_load_failed", options);
    this.error = formatError(options.error);
  }
}

export class SkillDownloadStartedEvent extends SkillEvent {
  readonly registry_ref: string;
  readonly version: string | null;

  constructor(options: SkillCommonEventOptions & { registry_ref: string; version?: string | null }) {
    super("skill_download_started", options);
    this.registry_ref = options.registry_ref;
    this.version = options.version ?? null;
  }
}

export class SkillDownloadCompletedEvent extends SkillEvent {
  readonly registry_ref: string;
  readonly version: string | null;
  readonly cache_path: string | null;

  constructor(options: SkillCommonEventOptions & { registry_ref: string; version?: string | null; cache_path?: string | null }) {
    super("skill_download_completed", options);
    this.registry_ref = options.registry_ref;
    this.version = options.version ?? null;
    this.cache_path = options.cache_path ?? null;
  }
}

export const LLMCallType = {
  TOOL_CALL: "tool_call",
  LLM_CALL: "llm_call",
} as const;

export type LLMCallType = typeof LLMCallType[keyof typeof LLMCallType];

export type LLMEventMessage = string | readonly Record<string, unknown>[];
export type LLMFunctionCall = {
  arguments: string;
  name?: string | null;
};
export class ToolCall {
  readonly id: string | null;
  readonly function: LLMFunctionCall;
  readonly type: string | null;
  readonly index: number;

  constructor(options: LLMToolCall) {
    this.id = options.id ?? null;
    this.function = options.function;
    this.type = options.type ?? null;
    this.index = options.index;
  }
}
export type LLMToolCall = {
  id?: string | null;
  function: LLMFunctionCall;
  type?: string | null;
  index: number;
};

export type LLMCommonEventOptions = {
  from_task?: unknown;
  from_agent?: unknown;
  model?: string | null;
  call_id: string;
};

export abstract class LLMEventBase extends BaseEvent {
  readonly from_task: unknown;
  readonly from_agent: unknown;
  readonly model: string | null;
  readonly call_id: string;
  readonly task_id: string | null;
  readonly task_name: string | null;
  readonly agent_id: string | null;
  readonly agent_role: string | null;

  constructor(type: EventType, options: LLMCommonEventOptions) {
    super({
      type,
      sourceType: options.from_agent ? "agent" : options.from_task ? "task" : "llm",
      sourceFingerprint: getStringProperty(options.from_agent, "id") ?? getStringProperty(options.from_task, "id"),
    });
    this.from_task = options.from_task ?? null;
    this.from_agent = options.from_agent ?? null;
    this.model = options.model ?? null;
    this.call_id = options.call_id;
    this.task_id = getStringProperty(options.from_task, "id");
    this.task_name = getStringProperty(options.from_task, "name") ?? getStringProperty(options.from_task, "description");
    this.agent_id = getStringProperty(options.from_agent, "id");
    this.agent_role = getStringProperty(options.from_agent, "role");
  }
}

export class LLMCallStartedEvent extends LLMEventBase {
  readonly messages: LLMEventMessage | null;
  readonly tools: readonly Record<string, unknown>[] | null;
  readonly callbacks: readonly unknown[] | null;
  readonly available_functions: Record<string, unknown> | null;

  constructor(options: LLMCommonEventOptions & {
    messages?: LLMEventMessage | null;
    tools?: readonly Record<string, unknown>[] | null;
    callbacks?: readonly unknown[] | null;
    available_functions?: Record<string, unknown> | null;
  }) {
    super("llm_call_started", options);
    this.messages = options.messages ?? null;
    this.tools = options.tools ?? null;
    this.callbacks = options.callbacks ?? null;
    this.available_functions = options.available_functions ?? null;
  }
}

export class LLMCallCompletedEvent extends LLMEventBase {
  readonly messages: LLMEventMessage | null;
  readonly response: unknown;
  readonly call_type: LLMCallType;
  readonly usage: Record<string, unknown> | null;

  constructor(options: LLMCommonEventOptions & {
    response: unknown;
    call_type: LLMCallType;
    messages?: LLMEventMessage | null;
    usage?: Record<string, unknown> | null;
  }) {
    super("llm_call_completed", options);
    this.messages = options.messages ?? null;
    this.response = options.response;
    this.call_type = options.call_type;
    this.usage = options.usage ?? null;
  }
}

export class LLMCallFailedEvent extends LLMEventBase {
  readonly error: string;

  constructor(options: LLMCommonEventOptions & { error: unknown }) {
    super("llm_call_failed", options);
    this.error = formatError(options.error);
  }
}

export class LLMStreamChunkEvent extends LLMEventBase {
  readonly chunk: string;
  readonly tool_call: LLMToolCall | null;
  readonly call_type: LLMCallType | null;
  readonly response_id: string | null;

  constructor(options: LLMCommonEventOptions & {
    chunk: string;
    tool_call?: LLMToolCall | null;
    call_type?: LLMCallType | null;
    response_id?: string | null;
  }) {
    super("llm_stream_chunk", options);
    this.chunk = options.chunk;
    this.tool_call = options.tool_call ?? null;
    this.call_type = options.call_type ?? null;
    this.response_id = options.response_id ?? null;
  }
}

export class LLMThinkingChunkEvent extends LLMEventBase {
  readonly chunk: string;
  readonly response_id: string | null;

  constructor(options: LLMCommonEventOptions & { chunk: string; response_id?: string | null }) {
    super("llm_thinking_chunk", options);
    this.chunk = options.chunk;
    this.response_id = options.response_id ?? null;
  }
}

export type LLMGuardrailCommonEventOptions = {
  task_id?: string | null;
  task_name?: string | null;
  from_task?: unknown;
  from_agent?: unknown;
  agent_role?: string | null;
  agent_id?: string | null;
  guardrail_type?: string | null;
  guardrail_name?: string | null;
};

export abstract class LLMGuardrailBaseEvent extends BaseEvent {
  readonly task_id: string | null;
  readonly task_name: string | null;
  readonly from_task: unknown;
  readonly from_agent: unknown;
  readonly agent_role: string | null;
  readonly agent_id: string | null;
  guardrail_type: string | null;
  guardrail_name: string | null;

  constructor(type: EventType, options: LLMGuardrailCommonEventOptions = {}) {
    super({
      type,
      sourceType: options.from_agent ? "agent" : options.from_task ? "task" : "llm_guardrail",
      sourceFingerprint: getStringProperty(options.from_agent, "id") ?? getStringProperty(options.from_task, "id"),
    });
    this.task_id = options.task_id ?? getStringProperty(options.from_task, "id");
    this.task_name = options.task_name ?? getStringProperty(options.from_task, "name") ?? getStringProperty(options.from_task, "description");
    this.from_task = options.from_task ?? null;
    this.from_agent = options.from_agent ?? null;
    this.agent_role = options.agent_role ?? getStringProperty(options.from_agent, "role");
    this.agent_id = options.agent_id ?? getStringProperty(options.from_agent, "id");
    this.guardrail_type = options.guardrail_type ?? null;
    this.guardrail_name = options.guardrail_name ?? null;
  }
}

type LLMGuardrailCallable = (...args: never[]) => unknown;

export class LLMGuardrailStartedEvent extends LLMGuardrailBaseEvent {
  guardrail: string | LLMGuardrailCallable;
  readonly retry_count: number;

  constructor(options: LLMGuardrailCommonEventOptions & {
    guardrail: string | LLMGuardrailCallable;
    retry_count: number;
  }) {
    super("llm_guardrail_started", options);
    this.retry_count = options.retry_count;
    if (typeof options.guardrail === "function") {
      this.guardrail_type = this.guardrail_type ?? "function";
      this.guardrail_name = this.guardrail_name ?? (options.guardrail.name || null);
      this.guardrail = options.guardrail.toString().trim();
    } else {
      this.guardrail = options.guardrail;
    }
  }
}

export class LLMGuardrailCompletedEvent extends LLMGuardrailBaseEvent {
  readonly success: boolean;
  readonly result: unknown;
  readonly error: string | null;
  readonly retry_count: number;

  constructor(options: LLMGuardrailCommonEventOptions & {
    success: boolean;
    result: unknown;
    error?: unknown;
    retry_count: number;
  }) {
    super("llm_guardrail_completed", options);
    this.success = options.success;
    this.result = options.result;
    this.error = options.error === undefined || options.error === null ? null : formatError(options.error);
    this.retry_count = options.retry_count;
  }
}

export type KnowledgeCommonEventOptions = {
  task_id?: string | null;
  task_name?: string | null;
  from_task?: unknown;
  from_agent?: unknown;
  agent_role?: string | null;
  agent_id?: string | null;
};

export abstract class KnowledgeEventBase extends BaseEvent {
  readonly task_id: string | null;
  readonly task_name: string | null;
  readonly from_task: unknown;
  readonly from_agent: unknown;
  readonly agent_role: string | null;
  readonly agent_id: string | null;

  constructor(type: EventType, options: KnowledgeCommonEventOptions = {}) {
    super({
      type,
      sourceType: options.from_agent ? "agent" : options.from_task ? "task" : "knowledge",
      sourceFingerprint: getStringProperty(options.from_agent, "id") ?? getStringProperty(options.from_task, "id"),
    });
    this.task_id = options.task_id ?? getStringProperty(options.from_task, "id");
    this.task_name = options.task_name ?? getStringProperty(options.from_task, "name") ?? getStringProperty(options.from_task, "description");
    this.from_task = options.from_task ?? null;
    this.from_agent = options.from_agent ?? null;
    this.agent_role = options.agent_role ?? getStringProperty(options.from_agent, "role");
    this.agent_id = options.agent_id ?? getStringProperty(options.from_agent, "id");
  }
}

export class KnowledgeRetrievalStartedEvent extends KnowledgeEventBase {
  constructor(options: KnowledgeCommonEventOptions = {}) {
    super("knowledge_search_query_started", options);
  }
}

export class KnowledgeRetrievalCompletedEvent extends KnowledgeEventBase {
  readonly query: string;
  readonly retrieved_knowledge: string;

  constructor(options: KnowledgeCommonEventOptions & { query: string; retrieved_knowledge: string }) {
    super("knowledge_search_query_completed", options);
    this.query = options.query;
    this.retrieved_knowledge = options.retrieved_knowledge;
  }
}

export class KnowledgeQueryStartedEvent extends KnowledgeEventBase {
  readonly task_prompt: string;

  constructor(options: KnowledgeCommonEventOptions & { task_prompt: string }) {
    super("knowledge_query_started", options);
    this.task_prompt = options.task_prompt;
  }
}

export class KnowledgeQueryFailedEvent extends KnowledgeEventBase {
  readonly error: string;

  constructor(options: KnowledgeCommonEventOptions & { error: unknown }) {
    super("knowledge_query_failed", options);
    this.error = formatError(options.error);
  }
}

export class KnowledgeQueryCompletedEvent extends KnowledgeEventBase {
  readonly query: string;

  constructor(options: KnowledgeCommonEventOptions & { query: string }) {
    super("knowledge_query_completed", options);
    this.query = options.query;
  }
}

export class KnowledgeSearchQueryFailedEvent extends KnowledgeEventBase {
  readonly query: string;
  readonly error: string;

  constructor(options: KnowledgeCommonEventOptions & { query: string; error: unknown }) {
    super("knowledge_search_query_failed", options);
    this.query = options.query;
    this.error = formatError(options.error);
  }
}

export class CCEnvEvent extends BaseEvent {
  constructor() {
    super({ type: "cc_env", sourceType: "environment" });
  }
}

export class CodexEnvEvent extends BaseEvent {
  constructor() {
    super({ type: "codex_env", sourceType: "environment" });
  }
}

export class CursorEnvEvent extends BaseEvent {
  constructor() {
    super({ type: "cursor_env", sourceType: "environment" });
  }
}

export class DefaultEnvEvent extends BaseEvent {
  constructor() {
    super({ type: "default_env", sourceType: "environment" });
  }
}

export type EnvContextEvent = CCEnvEvent | CodexEnvEvent | CursorEnvEvent | DefaultEnvEvent;
export const EnvContextEvent = Object.freeze({ kind: "EnvContextEvent" });
export const ENV_CONTEXT_EVENT_TYPES = Object.freeze([CCEnvEvent, CodexEnvEvent, CursorEnvEvent, DefaultEnvEvent] as const);

function validateEnvContextEventPayload(data: unknown): EnvContextEvent {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Environment context event payload must be an object.");
  }
  const payload = data as Record<string, unknown>;
  switch (payload.type) {
    case "cc_env":
      return new CCEnvEvent();
    case "codex_env":
      return new CodexEnvEvent();
    case "cursor_env":
      return new CursorEnvEvent();
    case "default_env":
      return new DefaultEnvEvent();
    default:
      throw new Error(`Unsupported environment context event type: ${String(payload.type)}`);
  }
}

export const env_context_event_adapter = Object.freeze({
  validatePython: validateEnvContextEventPayload,
  validate_python: validateEnvContextEventPayload,
});

export type CrewAIEvent =
  | CCEnvEvent
  | CodexEnvEvent
  | CursorEnvEvent
  | DefaultEnvEvent
  | CrewKickoffStartedEvent
  | CrewKickoffCompletedEvent
  | CrewKickoffFailedEvent
  | CrewTrainStartedEvent
  | CrewTrainCompletedEvent
  | CrewTrainFailedEvent
  | CrewTestStartedEvent
  | CrewTestCompletedEvent
  | CrewTestFailedEvent
  | TaskStartedEvent
  | TaskCompletedEvent
  | TaskFailedEvent
  | TaskEvaluationEvent
  | CrewTestResultEvent
  | AgentExecutionStartedEvent
  | AgentExecutionCompletedEvent
  | AgentExecutionErrorEvent
  | AgentEvaluationStartedEvent
  | AgentEvaluationCompletedEvent
  | AgentEvaluationFailedEvent
  | AgentReasoningStartedEvent
  | AgentReasoningCompletedEvent
  | AgentReasoningFailedEvent
  | A2ADelegationStartedEvent
  | A2ADelegationCompletedEvent
  | A2AConversationStartedEvent
  | A2AMessageSentEvent
  | A2AResponseReceivedEvent
  | A2AConversationCompletedEvent
  | A2APollingStartedEvent
  | A2APollingStatusEvent
  | A2APushNotificationRegisteredEvent
  | A2APushNotificationReceivedEvent
  | A2APushNotificationSentEvent
  | A2APushNotificationTimeoutEvent
  | A2AStreamingStartedEvent
  | A2AStreamingChunkEvent
  | A2AAgentCardFetchedEvent
  | A2AAuthenticationFailedEvent
  | A2AArtifactReceivedEvent
  | A2AConnectionErrorEvent
  | A2AServerTaskStartedEvent
  | A2AServerTaskCompletedEvent
  | A2AServerTaskCanceledEvent
  | A2AServerTaskFailedEvent
  | A2AParallelDelegationStartedEvent
  | A2AParallelDelegationCompletedEvent
  | A2ATransportNegotiatedEvent
  | A2AContentTypeNegotiatedEvent
  | A2AContextCreatedEvent
  | A2AContextExpiredEvent
  | A2AContextIdleEvent
  | A2AContextCompletedEvent
  | A2AContextPrunedEvent
  | MCPConnectionStartedEvent
  | MCPConnectionCompletedEvent
  | MCPConnectionFailedEvent
  | MCPToolExecutionStartedEvent
  | MCPToolExecutionCompletedEvent
  | MCPToolExecutionFailedEvent
  | MCPConfigFetchFailedEvent
  | SkillDiscoveryStartedEvent
  | SkillDiscoveryCompletedEvent
  | SkillLoadedEvent
  | SkillActivatedEvent
  | SkillLoadFailedEvent
  | SkillDownloadStartedEvent
  | SkillDownloadCompletedEvent
  | LLMCallStartedEvent
  | LLMCallCompletedEvent
  | LLMCallFailedEvent
  | LLMStreamChunkEvent
  | LLMThinkingChunkEvent
  | LLMGuardrailStartedEvent
  | LLMGuardrailCompletedEvent
  | KnowledgeRetrievalStartedEvent
  | KnowledgeRetrievalCompletedEvent
  | KnowledgeQueryStartedEvent
  | KnowledgeQueryFailedEvent
  | KnowledgeQueryCompletedEvent
  | KnowledgeSearchQueryFailedEvent
  | HumanFeedbackRequestedEvent
  | HumanFeedbackReceivedEvent
  | ToolUsageStartedEvent
  | ToolUsageFinishedEvent
  | ToolUsageErrorEvent
  | ToolValidateInputErrorEvent
  | ToolSelectionErrorEvent
  | ToolExecutionErrorEvent
  | LiteAgentExecutionStartedEvent
  | LiteAgentExecutionCompletedEvent
  | LiteAgentExecutionErrorEvent
  | MemorySaveStartedEvent
  | MemorySaveCompletedEvent
  | MemorySaveFailedEvent
  | MemoryQueryStartedEvent
  | MemoryQueryCompletedEvent
  | MemoryQueryFailedEvent
  | MemoryRetrievalStartedEvent
  | MemoryRetrievalCompletedEvent
  | MemoryRetrievalFailedEvent
  | FlowStartedEvent
  | FlowCreatedEvent
  | FlowFinishedEvent
  | FlowFailedEvent
  | FlowPausedEvent
  | FlowPlotEvent
  | FlowInputRequestedEvent
  | FlowInputReceivedEvent
  | MethodExecutionStartedEvent
  | MethodExecutionFinishedEvent
  | MethodExecutionFailedEvent
  | MethodExecutionPausedEvent
  | CheckpointStartedEvent
  | CheckpointCompletedEvent
  | CheckpointFailedEvent
  | CheckpointPrunedEvent
  | CheckpointForkStartedEvent
  | CheckpointForkCompletedEvent
  | CheckpointRestoreStartedEvent
  | CheckpointRestoreCompletedEvent
  | CheckpointRestoreFailedEvent
  | StepObservationStartedEvent
  | StepObservationCompletedEvent
  | StepObservationFailedEvent
  | PlanRefinementEvent
  | PlanReplanTriggeredEvent
  | GoalAchievedEarlyEvent
  | SignalEvent
  | AgentLogsStartedEvent
  | AgentLogsExecutionEvent;

export type EventMap = {
  crew_kickoff_started: CrewKickoffStartedEvent;
  crew_kickoff_completed: CrewKickoffCompletedEvent;
  crew_kickoff_failed: CrewKickoffFailedEvent;
  crew_train_started: CrewTrainStartedEvent;
  crew_train_completed: CrewTrainCompletedEvent;
  crew_train_failed: CrewTrainFailedEvent;
  crew_test_started: CrewTestStartedEvent;
  crew_test_completed: CrewTestCompletedEvent;
  crew_test_failed: CrewTestFailedEvent;
  task_started: TaskStartedEvent;
  task_completed: TaskCompletedEvent;
  task_failed: TaskFailedEvent;
  task_evaluation: TaskEvaluationEvent;
  crew_test_result: CrewTestResultEvent;
  agent_execution_started: AgentExecutionStartedEvent;
  agent_execution_completed: AgentExecutionCompletedEvent;
  agent_execution_error: AgentExecutionErrorEvent;
  agent_evaluation_started: AgentEvaluationStartedEvent;
  agent_evaluation_completed: AgentEvaluationCompletedEvent;
  agent_evaluation_failed: AgentEvaluationFailedEvent;
  agent_reasoning_started: AgentReasoningStartedEvent;
  agent_reasoning_completed: AgentReasoningCompletedEvent;
  agent_reasoning_failed: AgentReasoningFailedEvent;
  a2a_delegation_started: A2ADelegationStartedEvent;
  a2a_delegation_completed: A2ADelegationCompletedEvent;
  a2a_conversation_started: A2AConversationStartedEvent;
  a2a_message_sent: A2AMessageSentEvent;
  a2a_response_received: A2AResponseReceivedEvent;
  a2a_conversation_completed: A2AConversationCompletedEvent;
  a2a_polling_started: A2APollingStartedEvent;
  a2a_polling_status: A2APollingStatusEvent;
  a2a_push_notification_registered: A2APushNotificationRegisteredEvent;
  a2a_push_notification_received: A2APushNotificationReceivedEvent;
  a2a_push_notification_sent: A2APushNotificationSentEvent;
  a2a_push_notification_timeout: A2APushNotificationTimeoutEvent;
  a2a_streaming_started: A2AStreamingStartedEvent;
  a2a_streaming_chunk: A2AStreamingChunkEvent;
  a2a_agent_card_fetched: A2AAgentCardFetchedEvent;
  a2a_authentication_failed: A2AAuthenticationFailedEvent;
  a2a_artifact_received: A2AArtifactReceivedEvent;
  a2a_connection_error: A2AConnectionErrorEvent;
  a2a_server_task_started: A2AServerTaskStartedEvent;
  a2a_server_task_completed: A2AServerTaskCompletedEvent;
  a2a_server_task_canceled: A2AServerTaskCanceledEvent;
  a2a_server_task_failed: A2AServerTaskFailedEvent;
  a2a_parallel_delegation_started: A2AParallelDelegationStartedEvent;
  a2a_parallel_delegation_completed: A2AParallelDelegationCompletedEvent;
  a2a_transport_negotiated: A2ATransportNegotiatedEvent;
  a2a_content_type_negotiated: A2AContentTypeNegotiatedEvent;
  a2a_context_created: A2AContextCreatedEvent;
  a2a_context_expired: A2AContextExpiredEvent;
  a2a_context_idle: A2AContextIdleEvent;
  a2a_context_completed: A2AContextCompletedEvent;
  a2a_context_pruned: A2AContextPrunedEvent;
  mcp_connection_started: MCPConnectionStartedEvent;
  mcp_connection_completed: MCPConnectionCompletedEvent;
  mcp_connection_failed: MCPConnectionFailedEvent;
  mcp_tool_execution_started: MCPToolExecutionStartedEvent;
  mcp_tool_execution_completed: MCPToolExecutionCompletedEvent;
  mcp_tool_execution_failed: MCPToolExecutionFailedEvent;
  mcp_config_fetch_failed: MCPConfigFetchFailedEvent;
  skill_discovery_started: SkillDiscoveryStartedEvent;
  skill_discovery_completed: SkillDiscoveryCompletedEvent;
  skill_loaded: SkillLoadedEvent;
  skill_activated: SkillActivatedEvent;
  skill_load_failed: SkillLoadFailedEvent;
  skill_download_started: SkillDownloadStartedEvent;
  skill_download_completed: SkillDownloadCompletedEvent;
  llm_call_started: LLMCallStartedEvent;
  llm_call_completed: LLMCallCompletedEvent;
  llm_call_failed: LLMCallFailedEvent;
  llm_stream_chunk: LLMStreamChunkEvent;
  llm_thinking_chunk: LLMThinkingChunkEvent;
  llm_guardrail_started: LLMGuardrailStartedEvent;
  llm_guardrail_completed: LLMGuardrailCompletedEvent;
  knowledge_search_query_started: KnowledgeRetrievalStartedEvent;
  knowledge_search_query_completed: KnowledgeRetrievalCompletedEvent;
  knowledge_query_started: KnowledgeQueryStartedEvent;
  knowledge_query_failed: KnowledgeQueryFailedEvent;
  knowledge_query_completed: KnowledgeQueryCompletedEvent;
  knowledge_search_query_failed: KnowledgeSearchQueryFailedEvent;
  human_feedback_requested: HumanFeedbackRequestedEvent;
  human_feedback_received: HumanFeedbackReceivedEvent;
  tool_usage_started: ToolUsageStartedEvent;
  tool_usage_finished: ToolUsageFinishedEvent;
  tool_usage_error: ToolUsageErrorEvent;
  tool_validate_input_error: ToolValidateInputErrorEvent;
  tool_selection_error: ToolSelectionErrorEvent;
  tool_execution_error: ToolExecutionErrorEvent;
  lite_agent_execution_started: LiteAgentExecutionStartedEvent;
  lite_agent_execution_completed: LiteAgentExecutionCompletedEvent;
  lite_agent_execution_error: LiteAgentExecutionErrorEvent;
  memory_save_started: MemorySaveStartedEvent;
  memory_save_completed: MemorySaveCompletedEvent;
  memory_save_failed: MemorySaveFailedEvent;
  memory_query_started: MemoryQueryStartedEvent;
  memory_query_completed: MemoryQueryCompletedEvent;
  memory_query_failed: MemoryQueryFailedEvent;
  memory_retrieval_started: MemoryRetrievalStartedEvent;
  memory_retrieval_completed: MemoryRetrievalCompletedEvent;
  memory_retrieval_failed: MemoryRetrievalFailedEvent;
  flow_started: FlowStartedEvent;
  flow_created: FlowCreatedEvent;
  flow_finished: FlowFinishedEvent;
  flow_failed: FlowFailedEvent;
  flow_paused: FlowPausedEvent;
  flow_plot: FlowPlotEvent;
  flow_input_requested: FlowInputRequestedEvent;
  flow_input_received: FlowInputReceivedEvent;
  method_execution_started: MethodExecutionStartedEvent;
  method_execution_finished: MethodExecutionFinishedEvent;
  method_execution_failed: MethodExecutionFailedEvent;
  method_execution_paused: MethodExecutionPausedEvent;
  checkpoint_started: CheckpointStartedEvent;
  checkpoint_completed: CheckpointCompletedEvent;
  checkpoint_failed: CheckpointFailedEvent;
  checkpoint_pruned: CheckpointPrunedEvent;
  checkpoint_fork_started: CheckpointForkStartedEvent;
  checkpoint_fork_completed: CheckpointForkCompletedEvent;
  checkpoint_restore_started: CheckpointRestoreStartedEvent;
  checkpoint_restore_completed: CheckpointRestoreCompletedEvent;
  checkpoint_restore_failed: CheckpointRestoreFailedEvent;
  step_observation_started: StepObservationStartedEvent;
  step_observation_completed: StepObservationCompletedEvent;
  step_observation_failed: StepObservationFailedEvent;
  plan_refinement: PlanRefinementEvent;
  plan_replan_triggered: PlanReplanTriggeredEvent;
  goal_achieved_early: GoalAchievedEarlyEvent;
  SIGTERM: SigTermEvent;
  SIGINT: SigIntEvent;
  SIGHUP: SigHupEvent;
  SIGTSTP: SigTStpEvent;
  SIGCONT: SigContEvent;
  agent_logs_started: AgentLogsStartedEvent;
  agent_logs_execution: AgentLogsExecutionEvent;
  cc_env: CCEnvEvent;
  codex_env: CodexEnvEvent;
  cursor_env: CursorEnvEvent;
  default_env: DefaultEnvEvent;
};

export type EventHandler<TEvent extends CrewAIEvent = CrewAIEvent> = (
  source: unknown,
  event: TEvent,
  runtimeState?: RuntimeState | null,
) => void | Promise<void>;
export const EventHandler = Object.freeze({ kind: "EventHandler" });

export type ConsoleStreamingLive = {
  start: () => void;
  stop: () => void;
  readonly active?: boolean;
};

export type SyncHandler = (source: unknown, event: BaseEvent, context?: unknown) => void;
export type AsyncHandler = (source: unknown, event: BaseEvent, context?: unknown) => Promise<void>;
export type SyncHandlerSet = ReadonlySet<SyncHandler>;
export type AsyncHandlerSet = ReadonlySet<AsyncHandler>;
export type Handler = (source: unknown, event: BaseEvent, context?: unknown) => unknown;
export type ExecutionPlan = Array<Set<Handler>>;
export type EventT_co = BaseEvent;

export const SyncHandler = Object.freeze({ kind: "SyncHandler" });
export const AsyncHandler = Object.freeze({ kind: "AsyncHandler" });
export const SyncHandlerSet = Object.freeze({ kind: "SyncHandlerSet" });
export const AsyncHandlerSet = Object.freeze({ kind: "AsyncHandlerSet" });
export const Handler = Object.freeze({ kind: "Handler" });
export const ExecutionPlan = Object.freeze({ kind: "ExecutionPlan" });
export const EventT_co = Object.freeze({ kind: "EventT_co" });
export const EventTypes = Object.freeze({ kind: "EventTypes" });
const replayingContext = new AsyncLocalStorage<boolean>();

export function _get_or_create_counter(): IterableIterator<number> {
  let nextValue = getEmissionSequence() + 1;
  return {
    next(): IteratorResult<number> {
      const current = nextValue;
      setEmissionCounter(current);
      nextValue += 1;
      return { done: false, value: current };
    },
    [Symbol.iterator](): IterableIterator<number> {
      return this;
    },
  };
}

export function get_next_emission_sequence(): number {
  return getNextEmissionSequence();
}

export function is_replaying(): boolean {
  return replayingContext.getStore() === true;
}

export class Depends<THandler extends EventHandler = EventHandler> {
  readonly handler: THandler;

  constructor(handler: THandler) {
    this.handler = handler;
  }

  __repr__(): string {
    return this.toString();
  }

  __eq__(other: unknown): boolean {
    return other instanceof Depends && other.handler === this.handler;
  }

  __hash__(): number {
    return objectIdentityHash(this.handler);
  }

  toString(): string {
    return `Depends(${this.handler.name || "anonymous"})`;
  }
}

const eventHandlerIdentityHashes = new WeakMap<object, number>();
let nextEventHandlerIdentityHash = 1;

function objectIdentityHash(value: object): number {
  const existing = eventHandlerIdentityHashes.get(value);
  if (existing !== undefined) {
    return existing;
  }
  const hash = nextEventHandlerIdentityHash++;
  eventHandlerIdentityHashes.set(value, hash);
  return hash;
}

export class CircularDependencyError extends Error {
  readonly handlers: readonly EventHandler[];

  constructor(handlers: readonly EventHandler[] = []) {
    const names = handlers.slice(0, 5).map((handler) => handler.name || "anonymous").join(", ");
    super(`Circular dependency detected in event handlers: ${names}`);
    this.name = "CircularDependencyError";
    this.handlers = handlers;
  }
}

export function is_async_handler(handler: unknown): handler is AsyncHandler {
  if (typeof handler !== "function") {
    return false;
  }
  if (handler.constructor.name === "AsyncFunction") {
    return true;
  }
  const callable = (handler as { call?: unknown; __call__?: unknown }).__call__;
  return typeof callable === "function" && callable.constructor.name === "AsyncFunction";
}

export function is_call_handler_safe(
  handler: SyncHandler,
  source: unknown,
  event: BaseEvent,
  state: unknown = null,
): Error | null {
  try {
    if (handler.length >= 3) {
      handler(source, event, state);
    } else {
      handler(source, event);
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

export class HandlerGraph {
  readonly handlers: Map<Handler, readonly Depends[]>;
  readonly levels: ExecutionPlan = [];

  constructor(handlers: Map<Handler, readonly Depends[]> | Record<string, readonly Depends[]>) {
    this.handlers = handlers instanceof Map ? new Map<Handler, readonly Depends[]>(handlers) : new Map<Handler, readonly Depends[]>();
    this.resolve();
  }

  private resolve(): void {
    const dependents = new Map<Handler, Set<Handler>>();
    const inDegree = new Map<Handler, number>();
    for (const handler of this.handlers.keys()) {
      inDegree.set(handler, 0);
    }
    for (const [handler, dependencies] of this.handlers.entries()) {
      inDegree.set(handler, dependencies.length);
      for (const dependency of dependencies) {
        const dependencyHandler = dependency.handler as Handler;
        const entries = dependents.get(dependencyHandler) ?? new Set<Handler>();
        entries.add(handler);
        dependents.set(dependencyHandler, entries);
      }
    }

    const queue = [...inDegree.entries()].filter(([, degree]) => degree === 0).map(([handler]) => handler);
    while (queue.length > 0) {
      const currentLevel = new Set<Handler>();
      for (const handler of queue.splice(0)) {
        currentLevel.add(handler);
        for (const dependent of dependents.get(handler) ?? []) {
          const degree = (inDegree.get(dependent) ?? 0) - 1;
          inDegree.set(dependent, degree);
          if (degree === 0) {
            queue.push(dependent);
          }
        }
      }
      if (currentLevel.size > 0) {
        this.levels.push(currentLevel);
      }
    }

    const remaining = [...inDegree.entries()].filter(([, degree]) => degree > 0).map(([handler]) => handler);
    if (remaining.length > 0) {
      throw new CircularDependencyError(remaining as EventHandler[]);
    }
  }

  getExecutionPlan(): ExecutionPlan {
    return this.levels;
  }

  get_execution_plan(): ExecutionPlan {
    return this.getExecutionPlan();
  }
}

export function build_execution_plan(
  handlers: readonly Handler[],
  dependencies: Map<Handler, readonly Depends[]> | Record<string, readonly Depends[]> = new Map(),
): ExecutionPlan {
  const dependencyMap = dependencies instanceof Map ? dependencies : new Map<Handler, readonly Depends[]>();
  const graphInput = new Map<Handler, readonly Depends[]>();
  for (const handler of handlers) {
    graphInput.set(handler, dependencyMap.get(handler) ?? []);
  }
  return new HandlerGraph(graphInput).getExecutionPlan();
}

export class TraceBatch {
  readonly version: string;
  readonly batchId: string;
  readonly batch_id: string;
  readonly userContext: Record<string, string>;
  readonly user_context: Record<string, string>;
  readonly executionMetadata: Record<string, unknown>;
  readonly execution_metadata: Record<string, unknown>;
  events: BaseEvent[];

  constructor(options: {
    version?: string;
    batchId?: string;
    batch_id?: string;
    userContext?: Record<string, string>;
    user_context?: Record<string, string>;
    executionMetadata?: Record<string, unknown>;
    execution_metadata?: Record<string, unknown>;
    events?: BaseEvent[];
  } = {}) {
    this.version = options.version ?? __version__;
    this.batchId = options.batchId ?? options.batch_id ?? randomUUID();
    this.batch_id = this.batchId;
    this.userContext = options.userContext ?? options.user_context ?? {};
    this.user_context = this.userContext;
    this.executionMetadata = options.executionMetadata ?? options.execution_metadata ?? {};
    this.execution_metadata = this.executionMetadata;
    this.events = [...(options.events ?? [])];
  }

  toDict(): Record<string, unknown> {
    return {
      version: this.version,
      batch_id: this.batchId,
      user_context: this.userContext,
      execution_metadata: this.executionMetadata,
      events: this.events.map((event) => event.toJSON()),
    };
  }

  to_dict(): Record<string, unknown> {
    return this.toDict();
  }
}

export class TraceEvent extends BaseEvent {
  readonly raw: Record<string, unknown>;

  constructor(options: BaseEventOptions | Record<string, unknown> = { type: "default_env" }) {
    const type = typeof options.type === "string" ? options.type as EventType : "default_env";
    super({ ...options, type });
    this.raw = { ...options };
  }

  toDict(): Record<string, unknown> {
    return this.toJSON();
  }

  to_dict(): Record<string, unknown> {
    return this.toDict();
  }
}

type TraceBackendResponse = {
  status?: number;
  status_code?: number;
  ok?: boolean;
  json?: () => unknown;
};

type TraceBackendApi = {
  sendTraceEvents?: (traceBatchId: string, payload: TraceEventsPayload) => unknown;
  send_trace_events?: (traceBatchId: string, payload: TraceEventsPayload) => unknown;
  sendEphemeralTraceEvents?: (traceBatchId: string, payload: TraceEventsPayload) => unknown;
  send_ephemeral_trace_events?: (traceBatchId: string, payload: TraceEventsPayload) => unknown;
  finalizeTraceBatch?: (traceBatchId: string, payload: TraceFinalizePayload) => unknown;
  finalize_trace_batch?: (traceBatchId: string, payload: TraceFinalizePayload) => unknown;
  finalizeEphemeralTraceBatch?: (traceBatchId: string, payload: TraceFinalizePayload) => unknown;
  finalize_ephemeral_trace_batch?: (traceBatchId: string, payload: TraceFinalizePayload) => unknown;
};

function traceResponseOk(response: unknown): boolean {
  const record = response as TraceBackendResponse | null | undefined;
  if (!record) {
    return true;
  }
  if (typeof record.ok === "boolean") {
    return record.ok;
  }
  const status = record.status ?? record.status_code;
  return typeof status === "number" ? status >= 200 && status < 300 : true;
}

function normalizeTraceBatchInitialization(
  userContextOrOptions: Record<string, string> | {
    userContext?: Record<string, string>;
    user_context?: Record<string, string>;
    executionMetadata?: Record<string, unknown>;
    execution_metadata?: Record<string, unknown>;
    useEphemeral?: boolean;
    use_ephemeral?: boolean;
  },
  executionMetadata: Record<string, unknown>,
  useEphemeral: boolean,
): { userContext: Record<string, string>; executionMetadata: Record<string, unknown>; useEphemeral: boolean } {
  const record = userContextOrOptions as Record<string, unknown>;
  const hasOptionsShape = "userContext" in record
    || "user_context" in record
    || "executionMetadata" in record
    || "execution_metadata" in record
    || "useEphemeral" in record
    || "use_ephemeral" in record;
  if (!hasOptionsShape) {
    return {
      userContext: userContextOrOptions as Record<string, string>,
      executionMetadata,
      useEphemeral,
    };
  }
  const options = userContextOrOptions as {
    userContext?: Record<string, string>;
    user_context?: Record<string, string>;
    executionMetadata?: Record<string, unknown>;
    execution_metadata?: Record<string, unknown>;
    useEphemeral?: boolean;
    use_ephemeral?: boolean;
  };
  return {
    userContext: options.userContext ?? options.user_context ?? {},
    executionMetadata: options.executionMetadata ?? options.execution_metadata ?? {},
    useEphemeral: options.useEphemeral ?? options.use_ephemeral ?? useEphemeral,
  };
}

export class TraceBatchManager {
  readonly plusApi: TraceBackendApi;
  readonly plus_api: TraceBackendApi;
  isCurrentBatchEphemeral = false;
  is_current_batch_ephemeral = false;
  traceBatchId: string | null = null;
  trace_batch_id: string | null = null;
  currentBatch: TraceBatch | null = null;
  current_batch: TraceBatch | null = null;
  eventBuffer: BaseEvent[] = [];
  event_buffer = this.eventBuffer;
  executionStartTimes = new Map<string, number>();
  execution_start_times = this.executionStartTimes;
  batchOwnerType: string | null = null;
  batch_owner_type: string | null = null;
  batchOwnerId: string | null = null;
  batch_owner_id: string | null = null;
  backendInitialized = false;
  backend_initialized = false;
  batchFinalized = false;
  batch_finalized = false;
  _batch_finalized = false;
  deferSessionFinalization = false;
  defer_session_finalization = false;
  ephemeralTraceUrl: string | null = null;
  ephemeral_trace_url: string | null = null;
  private pendingEventsCount = 0;
  private backendFinalizePromise: Promise<boolean> | null = null;

  constructor(options: { plusApi?: TraceBackendApi; plus_api?: TraceBackendApi } = {}) {
    this.plusApi = options.plusApi ?? options.plus_api ?? new PlusAPI();
    this.plus_api = this.plusApi;
  }

  initializeBatch(
    userContext: Record<string, string> | {
      userContext?: Record<string, string>;
      user_context?: Record<string, string>;
      executionMetadata?: Record<string, unknown>;
      execution_metadata?: Record<string, unknown>;
      useEphemeral?: boolean;
      use_ephemeral?: boolean;
    },
    executionMetadata: Record<string, unknown> = {},
    useEphemeral = false,
  ): TraceBatch {
    const normalized = normalizeTraceBatchInitialization(userContext, executionMetadata, useEphemeral);
    if (this.currentBatch) {
      Object.assign(this.currentBatch.executionMetadata, normalized.executionMetadata);
      return this.currentBatch;
    }
    const batch = new TraceBatch({
      userContext: normalized.userContext,
      executionMetadata: normalized.executionMetadata,
    });
    this.currentBatch = batch;
    this.current_batch = batch;
    this.isCurrentBatchEphemeral = normalized.useEphemeral;
    this.is_current_batch_ephemeral = normalized.useEphemeral;
    this.setBatchFinalized(false);
    this.traceBatchId = batch.batchId;
    this.trace_batch_id = batch.batchId;
    this.recordStartTime("execution");
    return batch;
  }

  initialize_batch(
    userContext: Parameters<TraceBatchManager["initializeBatch"]>[0],
    executionMetadata: Record<string, unknown> = {},
    useEphemeral = false,
  ): TraceBatch {
    return this.initializeBatch(userContext, executionMetadata, useEphemeral);
  }

  beginEventProcessing(): void {
    this.pendingEventsCount += 1;
  }

  begin_event_processing(): void {
    this.beginEventProcessing();
  }

  endEventProcessing(): void {
    this.pendingEventsCount = Math.max(0, this.pendingEventsCount - 1);
  }

  end_event_processing(): void {
    this.endEventProcessing();
  }

  waitForPendingEvents(_timeout = 2.0): boolean {
    void _timeout;
    return this.pendingEventsCount === 0;
  }

  wait_for_pending_events(timeout = 2.0): boolean {
    return this.waitForPendingEvents(timeout);
  }

  addEvent(traceEvent: BaseEvent): void {
    this.eventBuffer.push(traceEvent);
  }

  add_event(traceEvent: BaseEvent): void {
    this.addEvent(traceEvent);
  }

  finalizeBatch(): TraceBatch | null {
    if (this.batchFinalized || !this.currentBatch) {
      return null;
    }
    const finalized = this.currentBatch;
    finalized.events = [...this.eventBuffer].sort((left, right) => left.emissionSequence - right.emissionSequence);
    this.currentBatch = null;
    this.current_batch = null;
    this.eventBuffer.length = 0;
    this.traceBatchId = null;
    this.trace_batch_id = null;
    this.isCurrentBatchEphemeral = false;
    this.is_current_batch_ephemeral = false;
    this.setBatchFinalized(true);
    return finalized;
  }

  finalize_batch(): TraceBatch | null {
    return this.finalizeBatch();
  }

  async finalizeBackendBatch(): Promise<boolean> {
    if (this.batchFinalized) {
      return true;
    }
    if (this.backendFinalizePromise) {
      return await this.backendFinalizePromise;
    }
    this.backendFinalizePromise = this.finalizeBackendBatchOnce();
    try {
      return await this.backendFinalizePromise;
    } finally {
      this.backendFinalizePromise = null;
    }
  }

  async _finalize_backend_batch(): Promise<boolean> {
    return await this.finalizeBackendBatch();
  }

  private async finalizeBackendBatchOnce(): Promise<boolean> {
    const capturedBatchId = this.traceBatchId ?? this.trace_batch_id ?? this.currentBatch?.batchId ?? null;
    if (!capturedBatchId) {
      return false;
    }
    const isEphemeral = this.isCurrentBatchEphemeral || this.is_current_batch_ephemeral;
    const eventPayload: TraceEventsPayload = {
      events: this.eventBuffer.map((event) => event.toJSON()),
      batch_metadata: {
        events_count: this.eventBuffer.length,
        batch_sequence: 1,
        is_final_batch: true,
      },
    };
    const sendEvents = isEphemeral
      ? this.plusApi.sendEphemeralTraceEvents ?? this.plusApi.send_ephemeral_trace_events
      : this.plusApi.sendTraceEvents ?? this.plusApi.send_trace_events;
    const finalizeTrace = isEphemeral
      ? this.plusApi.finalizeEphemeralTraceBatch ?? this.plusApi.finalize_ephemeral_trace_batch
      : this.plusApi.finalizeTraceBatch ?? this.plusApi.finalize_trace_batch;

    if (sendEvents && eventPayload.events.length > 0) {
      const response = await sendEvents.call(this.plusApi, capturedBatchId, eventPayload);
      if (!traceResponseOk(response)) {
        return false;
      }
    }
    if (finalizeTrace) {
      const response = await finalizeTrace.call(this.plusApi, capturedBatchId, {
        status: "completed",
        duration_ms: this.calculateDuration("execution"),
        final_event_count: eventPayload.events.length,
      });
      if (!traceResponseOk(response)) {
        return false;
      }
      if (isEphemeral) {
        const responsePayload = await this.readTraceResponseJson(response);
        const accessCode = typeof responsePayload.access_code === "string" ? responsePayload.access_code : null;
        this.ephemeralTraceUrl = accessCode
          ? `ephemeral_trace_batches/${capturedBatchId}?access_code=${accessCode}`
          : `ephemeral_trace_batches/${capturedBatchId}`;
        this.ephemeral_trace_url = this.ephemeralTraceUrl;
      }
    }

    const finalized = this.finalizeBatch();
    if (!finalized) {
      this.setBatchFinalized(true);
      this.eventBuffer.length = 0;
    }
    return true;
  }

  private async readTraceResponseJson(response: unknown): Promise<Record<string, unknown>> {
    const json = (response as TraceBackendResponse | null | undefined)?.json;
    if (!json) {
      return {};
    }
    const payload = await json.call(response);
    return payload !== null && typeof payload === "object" && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : {};
  }

  hasEvents(): boolean {
    return this.eventBuffer.length > 0;
  }

  has_events(): boolean {
    return this.hasEvents();
  }

  getEventCount(): number {
    return this.eventBuffer.length;
  }

  get_event_count(): number {
    return this.getEventCount();
  }

  isBatchInitialized(): boolean {
    return this.currentBatch !== null;
  }

  is_batch_initialized(): boolean {
    return this.isBatchInitialized();
  }

  shouldFinalizeOnShutdown(): boolean {
    return this.isBatchInitialized() && !this.deferSessionFinalization && !this.defer_session_finalization;
  }

  should_finalize_on_shutdown(): boolean {
    return this.shouldFinalizeOnShutdown();
  }

  waitForBatchInitialization(_timeout = 2.0): boolean {
    void _timeout;
    return this.currentBatch !== null;
  }

  wait_for_batch_initialization(timeout = 2.0): boolean {
    return this.waitForBatchInitialization(timeout);
  }

  recordStartTime(key: string): void {
    this.executionStartTimes.set(key, Date.now());
  }

  record_start_time(key: string): void {
    this.recordStartTime(key);
  }

  calculateDuration(key: string): number {
    const start = this.executionStartTimes.get(key);
    if (start === undefined) {
      return 0;
    }
    this.executionStartTimes.delete(key);
    return Date.now() - start;
  }

  private setBatchFinalized(value: boolean): void {
    this.batchFinalized = value;
    this.batch_finalized = value;
    this._batch_finalized = value;
  }

  calculate_duration(key: string): number {
    return this.calculateDuration(key);
  }

  getTraceId(): string | null {
    return this.currentBatch?.userContext.trace_id ?? null;
  }

  get_trace_id(): string | null {
    return this.getTraceId();
  }
}

export abstract class BaseEventListener {
  verbose = false;

  constructor(eventBus: EventBus = crewaiEventBus) {
    this.setupListeners(eventBus);
    eventBus.validateDependencies();
  }

  abstract setupListeners(eventBus: EventBus): void;

  setup_listeners(eventBus: EventBus): void {
    this.setupListeners(eventBus);
  }
}

export class EventBus {
  _shutting_down = false;
  private readonly handlers = new Map<EventType, Set<EventHandler>>();
  private readonly classHandlers = new Map<EventClass, Set<EventHandler>>();
  private readonly handlerDependencies = new Map<EventType, Map<EventHandler, readonly Depends[]>>();
  private readonly classHandlerDependencies = new Map<EventClass, Map<EventHandler, readonly Depends[]>>();
  private readonly pendingHandlers = new Set<Promise<unknown>>();
  private currentRuntimeState: RuntimeState | null = null;
  private registeredEntityIds = new WeakSet<object>();

  on<TEvent extends CrewAIEvent>(eventType: EventClass<TEvent>): (registeredHandler: EventHandler<TEvent>) => EventHandler<TEvent>;
  on<TEvent extends CrewAIEvent>(eventType: EventClass<TEvent>, handler: EventHandler<TEvent>, dependsOn?: Depends | readonly Depends[] | null): () => void;
  on<TEventType extends EventType>(eventType: TEventType): (registeredHandler: EventHandler<EventMap[TEventType]>) => EventHandler<EventMap[TEventType]>;
  on<TEventType extends EventType>(eventType: TEventType, handler: EventHandler<EventMap[TEventType]>, dependsOn?: Depends | readonly Depends[] | null): () => void;
  on<TEventType extends EventRegistrationKey>(
    eventType: TEventType,
    handler?: EventHandler,
    dependsOn?: Depends | readonly Depends[] | null,
  ): (() => void) | ((registeredHandler: EventHandler) => EventHandler) {
    if (!handler) {
      return (registeredHandler: EventHandler) => {
        this.addHandler(eventType, registeredHandler);
        return registeredHandler;
      };
    }
    this.addHandler(eventType, handler, dependsOn);
    return () => {
      this.off(eventType, handler);
    };
  }

  off(eventType: EventRegistrationKey, handler: EventHandler): void {
    const handlers = this.handlerSet(eventType);
    if (!handlers) {
      return;
    }
    handlers.delete(handler);
    const dependencyMap = this.dependencyMap(eventType);
    if (dependencyMap) {
      dependencyMap.delete(handler);
      for (const [registeredHandler, dependencies] of dependencyMap.entries()) {
        const filtered = dependencies.filter((dependency) => dependency.handler !== handler);
        if (filtered.length === 0) {
          dependencyMap.delete(registeredHandler);
        } else if (filtered.length !== dependencies.length) {
          dependencyMap.set(registeredHandler, filtered);
        }
      }
      if (dependencyMap.size === 0) {
        this.deleteDependencyMap(eventType);
      }
    }
    if (handlers.size === 0) {
      this.deleteHandlerSet(eventType);
    }
  }

  once<TEvent extends CrewAIEvent>(eventType: EventClass<TEvent>, handler: EventHandler<TEvent>): () => void;
  once<TEventType extends EventType>(eventType: TEventType, handler: EventHandler<EventMap[TEventType]>): () => void {
    const off = this.on(eventType, (source, event) => {
      off();
      return handler(source, event);
    });
    return off;
  }

  emit(source: unknown, event: CrewAIEvent): void {
    if (this._shutting_down) {
      return;
    }
    this.prepareEvent(source, event);
    this.dispatchPrepared(source, event);
  }

  replay(source: unknown, event: CrewAIEvent): void {
    replayingContext.run(true, () => {
      this.dispatchPrepared(source, event);
    });
  }

  async aemit(source: unknown, event: CrewAIEvent): Promise<void> {
    if (this._shutting_down) {
      return;
    }
    this.prepareEvent(source, event);
    await this.dispatchPreparedAndWait(source, event);
  }

  registerHandler<TEventType extends EventType>(eventType: TEventType, handler: EventHandler<EventMap[TEventType]>): void {
    this.on(eventType, handler);
  }

  register_handler<TEventType extends EventType>(eventType: TEventType, handler: EventHandler<EventMap[TEventType]>): void {
    this.registerHandler(eventType, handler);
  }

  async flush(timeout: number | null = 30): Promise<boolean> {
    if (this.pendingHandlers.size === 0) {
      return true;
    }
    const waitForHandlers = Promise.allSettled([...this.pendingHandlers]).then(() => true);
    if (timeout === null || !Number.isFinite(timeout)) {
      return await waitForHandlers;
    }
    return await Promise.race([
      waitForHandlers,
      new Promise<boolean>((resolve) => {
        setTimeout(() => {
          resolve(false);
        }, timeout * 1000);
      }),
    ]);
  }

  scopedHandlers<T>(callback: () => MaybePromise<T>): MaybePromise<T> {
    const savedHandlers = cloneHandlerMap(this.handlers);
    const savedDependencies = cloneDependencyMap(this.handlerDependencies);
    const savedClassHandlers = cloneClassHandlerMap(this.classHandlers);
    const savedClassDependencies = cloneClassDependencyMap(this.classHandlerDependencies);
    this.handlers.clear();
    this.handlerDependencies.clear();
    this.classHandlers.clear();
    this.classHandlerDependencies.clear();
    let result: MaybePromise<T>;
    try {
      result = callback();
    } catch (error) {
      this.restoreHandlers(savedHandlers, savedDependencies, savedClassHandlers, savedClassDependencies);
      throw error;
    }
    if (isPromiseLike(result)) {
      return result.finally(() => {
        this.restoreHandlers(savedHandlers, savedDependencies, savedClassHandlers, savedClassDependencies);
      });
    }
    this.restoreHandlers(savedHandlers, savedDependencies, savedClassHandlers, savedClassDependencies);
    return result;
  }

  scoped_handlers<T>(callback: () => MaybePromise<T>): MaybePromise<T> {
    return this.scopedHandlers(callback);
  }

  private dispatchPrepared(source: unknown, event: CrewAIEvent): void {
    const { handlers, dependencies } = this.resolveHandlers(event);
    if (handlers.length === 0) {
      return;
    }
    if (dependencies.size > 0) {
      this.emitWithDependencies(source, event, handlers, dependencies);
      return;
    }
    for (const handler of handlers) {
      void this.callHandler(handler, source, event);
    }
  }

  private async dispatchPreparedAndWait(source: unknown, event: CrewAIEvent): Promise<void> {
    const { handlers } = this.resolveHandlers(event);
    if (handlers.length === 0) {
      return;
    }
    const asyncHandlers = handlers.filter((handler) => is_async_handler(handler));
    await Promise.all(asyncHandlers.map(async (handler) => {
      await this.callHandler(handler, source, event);
    }));
  }

  private emitWithDependencies(
    source: unknown,
    event: CrewAIEvent,
    handlers: readonly EventHandler[],
    dependencies: Map<EventHandler, readonly Depends[]>,
  ): void {
    const plan = build_execution_plan(handlers as Handler[], dependencies as Map<Handler, readonly Depends[]>);
    const continuation = this.runDependencyPlan(plan, source, event);
    if (continuation) {
      continuation.catch((error: unknown) => {
        queueMicrotask(() => {
          throw error;
        });
      });
    }
  }

  private runDependencyPlan(plan: ExecutionPlan, source: unknown, event: CrewAIEvent): Promise<void> | null {
    for (let levelIndex = 0; levelIndex < plan.length; levelIndex += 1) {
      const pending: Array<Promise<unknown>> = [];
      for (const handler of plan[levelIndex] ?? []) {
        const result = this.callHandler(handler as EventHandler, source, event);
        if (isPromiseLike(result)) {
          pending.push(result);
        }
      }
      if (pending.length > 0) {
        return this.runRemainingDependencyPlan(plan, levelIndex + 1, source, event, pending);
      }
    }
    return null;
  }

  private async runRemainingDependencyPlan(
    plan: ExecutionPlan,
    startLevel: number,
    source: unknown,
    event: CrewAIEvent,
    pending: Array<Promise<unknown>>,
  ): Promise<void> {
    await Promise.all(pending);
    for (let levelIndex = startLevel; levelIndex < plan.length; levelIndex += 1) {
      const levelPromises: Array<Promise<unknown>> = [];
      for (const handler of plan[levelIndex] ?? []) {
        const result = this.callHandler(handler as EventHandler, source, event);
        if (isPromiseLike(result)) {
          levelPromises.push(result);
        }
      }
      if (levelPromises.length > 0) {
        await Promise.all(levelPromises);
      }
    }
  }

  private async runDependencyPlanAndWait(plan: ExecutionPlan, source: unknown, event: CrewAIEvent): Promise<void> {
    for (const level of plan) {
      await Promise.all([...level].map(async (handler) => {
        await this.callHandler(handler as EventHandler, source, event);
      }));
    }
  }

  private callHandler(handler: EventHandler, source: unknown, event: CrewAIEvent): void | Promise<void> {
    try {
      const result = handler(source, event, this.currentRuntimeState);
      if (isPromiseLike(result)) {
        return this.trackPendingHandler(result.catch(() => undefined));
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  private trackPendingHandler(promise: Promise<unknown>): Promise<void> {
    this.pendingHandlers.add(promise);
    return promise.finally(() => {
      this.pendingHandlers.delete(promise);
    }).then(() => undefined);
  }

  clear(): void {
    this.handlers.clear();
    this.classHandlers.clear();
    this.handlerDependencies.clear();
    this.classHandlerDependencies.clear();
    this.pendingHandlers.clear();
    this.currentRuntimeState = null;
    this.registeredEntityIds = new WeakSet<object>();
  }

  setRuntimeState(state: RuntimeState): void {
    this.currentRuntimeState = state;
    this.registeredEntityIds = new WeakSet<object>();
    for (const entity of state.root) {
      if (entity && typeof entity === "object") {
        this.registeredEntityIds.add(entity);
      }
    }
  }

  set_runtime_state(state: RuntimeState): void {
    this.setRuntimeState(state);
  }

  get runtimeState(): RuntimeState | null {
    return this.currentRuntimeState;
  }

  get runtime_state(): RuntimeState | null {
    return this.runtimeState;
  }

  registerEntity(entity: unknown): void {
    if (!entity || typeof entity !== "object" || this.registeredEntityIds.has(entity)) {
      return;
    }
    this.registeredEntityIds.add(entity);
    if (getEntityType(entity) === "agent") {
      const crew = (entity as { crew?: unknown }).crew;
      if (crew && typeof crew === "object" && this.registeredEntityIds.has(crew)) {
        return;
      }
    }
    this.currentRuntimeState ??= new RuntimeState({ root: [] });
    this.currentRuntimeState.root.push(entity);
  }

  register_entity(entity: unknown): void {
    this.registerEntity(entity);
  }

  private recordEvent(event: CrewAIEvent): void {
    this.currentRuntimeState?.eventRecord.add(event);
  }

  private prepareEvent(source: unknown, event: CrewAIEvent): void {
    this.registerSource(source);
    applyEventContext(event);
    this.recordEvent(event);
  }

  private registerSource(source: unknown): void {
    const entityType = getEntityType(source);
    if (entityType === "flow" || entityType === "crew" || entityType === "agent") {
      this.registerEntity(source);
    }
  }

  validateDependencies(): void {
    for (const [eventType, handlers] of this.handlers.entries()) {
      const dependencyMap = this.handlerDependencies.get(eventType) ?? new Map<EventHandler, readonly Depends[]>();
      build_execution_plan([...handlers] as Handler[], dependencyMap as Map<Handler, readonly Depends[]>);
    }
  }

  validate_dependencies(): void {
    this.validateDependencies();
  }

  shutdown(wait = true): MaybePromise<void> {
    this._shutting_down = true;
    const finish = () => {
      this.handlers.clear();
      this.handlerDependencies.clear();
      this.pendingHandlers.clear();
    };
    if (!wait) {
      finish();
      return;
    }
    const flushed = this.flush();
    return flushed.then(() => {
      finish();
    });
  }

  private restoreHandlers(
    handlers: Map<EventType, Set<EventHandler>>,
    dependencies: Map<EventType, Map<EventHandler, readonly Depends[]>>,
    classHandlers: Map<EventClass, Set<EventHandler>>,
    classDependencies: Map<EventClass, Map<EventHandler, readonly Depends[]>>,
  ): void {
    this.handlers.clear();
    this.handlerDependencies.clear();
    this.classHandlers.clear();
    this.classHandlerDependencies.clear();
    for (const [eventType, eventHandlers] of handlers.entries()) {
      this.handlers.set(eventType, new Set(eventHandlers));
    }
    for (const [eventType, dependencyMap] of dependencies.entries()) {
      this.handlerDependencies.set(eventType, new Map(dependencyMap));
    }
    for (const [eventClass, eventHandlers] of classHandlers.entries()) {
      this.classHandlers.set(eventClass, new Set(eventHandlers));
    }
    for (const [eventClass, dependencyMap] of classDependencies.entries()) {
      this.classHandlerDependencies.set(eventClass, new Map(dependencyMap));
    }
  }

  private handlerStores(eventType: EventRegistrationKey): [Set<EventHandler>, Map<EventHandler, readonly Depends[]>] {
    if (isEventClass(eventType)) {
      const handlers = this.classHandlers.get(eventType) ?? new Set<EventHandler>();
      const dependencies = this.classHandlerDependencies.get(eventType) ?? new Map<EventHandler, readonly Depends[]>();
      this.classHandlers.set(eventType, handlers);
      this.classHandlerDependencies.set(eventType, dependencies);
      return [handlers, dependencies];
    }
    const handlers = this.handlers.get(eventType) ?? new Set<EventHandler>();
    const dependencies = this.handlerDependencies.get(eventType) ?? new Map<EventHandler, readonly Depends[]>();
    this.handlers.set(eventType, handlers);
    this.handlerDependencies.set(eventType, dependencies);
    return [handlers, dependencies];
  }

  private addHandler(
    eventType: EventRegistrationKey,
    handler: EventHandler,
    dependsOn?: Depends | readonly Depends[] | null,
  ): void {
    const [handlers, dependenciesByKey] = this.handlerStores(eventType);
    handlers.add(handler);
    const dependencies = normalizeDepends(dependsOn);
    if (dependencies.length > 0) {
      dependenciesByKey.set(handler, dependencies);
    }
  }

  private handlerSet(eventType: EventRegistrationKey): Set<EventHandler> | undefined {
    return isEventClass(eventType) ? this.classHandlers.get(eventType) : this.handlers.get(eventType);
  }

  private dependencyMap(eventType: EventRegistrationKey): Map<EventHandler, readonly Depends[]> | undefined {
    return isEventClass(eventType) ? this.classHandlerDependencies.get(eventType) : this.handlerDependencies.get(eventType);
  }

  private deleteHandlerSet(eventType: EventRegistrationKey): void {
    if (isEventClass(eventType)) {
      this.classHandlers.delete(eventType);
      return;
    }
    this.handlers.delete(eventType);
  }

  private deleteDependencyMap(eventType: EventRegistrationKey): void {
    if (isEventClass(eventType)) {
      this.classHandlerDependencies.delete(eventType);
      return;
    }
    this.handlerDependencies.delete(eventType);
  }

  private resolveHandlers(event: CrewAIEvent): { handlers: EventHandler[]; dependencies: Map<EventHandler, readonly Depends[]> } {
    const handlers: EventHandler[] = [...(this.handlers.get(event.type) ?? [])];
    const dependencies = new Map<EventHandler, readonly Depends[]>(this.handlerDependencies.get(event.type) ?? []);
    for (const [eventClass, eventHandlers] of this.classHandlers.entries()) {
      if (event instanceof eventClass) {
        handlers.push(...eventHandlers);
        for (const [handler, handlerDepends] of this.classHandlerDependencies.get(eventClass) ?? []) {
          dependencies.set(handler, handlerDepends);
        }
      }
    }
    return { handlers, dependencies };
  }
}

function normalizeDepends(dependsOn: Depends | readonly Depends[] | null | undefined): readonly Depends[] {
  if (!dependsOn) {
    return [];
  }
  return dependsOn instanceof Depends ? [dependsOn] : [...dependsOn];
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return Boolean(value && typeof value === "object" && "then" in value && typeof (value as { then?: unknown }).then === "function");
}

function isEventClass(value: EventRegistrationKey): value is EventClass {
  return typeof value === "function";
}

function cloneHandlerMap(source: Map<EventType, Set<EventHandler>>): Map<EventType, Set<EventHandler>> {
  return new Map([...source.entries()].map(([eventType, handlers]) => [eventType, new Set(handlers)]));
}

function cloneDependencyMap(
  source: Map<EventType, Map<EventHandler, readonly Depends[]>>,
): Map<EventType, Map<EventHandler, readonly Depends[]>> {
  return new Map([...source.entries()].map(([eventType, dependencies]) => [eventType, new Map(dependencies)]));
}

function cloneClassHandlerMap(source: Map<EventClass, Set<EventHandler>>): Map<EventClass, Set<EventHandler>> {
  return new Map([...source.entries()].map(([eventClass, handlers]) => [eventClass, new Set(handlers)]));
}

function cloneClassDependencyMap(
  source: Map<EventClass, Map<EventHandler, readonly Depends[]>>,
): Map<EventClass, Map<EventHandler, readonly Depends[]>> {
  return new Map([...source.entries()].map(([eventClass, dependencies]) => [eventClass, new Map(dependencies)]));
}

function getEntityType(entity: unknown): string | null {
  if (!entity || typeof entity !== "object") {
    return null;
  }
  const record = entity as { entity_type?: unknown; entityType?: unknown };
  const value = record.entity_type ?? record.entityType;
  return typeof value === "string" ? value : null;
}

function getEventValue(record: unknown, ...keys: string[]): unknown {
  if (!record || typeof record !== "object") {
    return null;
  }
  const values = record as Record<string, unknown>;
  for (const key of keys) {
    if (key in values) {
      return values[key];
    }
  }
  return null;
}

function getEventString(record: unknown, ...keys: string[]): string | null {
  const value = getEventValue(record, ...keys);
  return typeof value === "string" ? value : null;
}

function getEventNumber(record: unknown, ...keys: string[]): number | null {
  const value = getEventValue(record, ...keys);
  return typeof value === "number" ? value : null;
}

function getEventRecord(record: unknown, ...keys: string[]): Record<string, unknown> | null {
  const value = getEventValue(record, ...keys);
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function getEventStringArray(record: unknown, ...keys: string[]): readonly string[] | null {
  const value = getEventValue(record, ...keys);
  return Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : null;
}

function formatEventValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value.toString();
  }
  return JSON.stringify(value);
}

function getSourceString(source: unknown, ...keys: string[]): string | null {
  return getEventString(source, ...keys);
}

function getSourceId(source: unknown): string {
  return getSourceString(source, "id") ?? "";
}

function getTaskName(source: unknown): string | null {
  return getSourceString(source, "name") ?? getSourceString(source, "description");
}

function getAgentRole(source: unknown): string {
  const agent = getEventRecord(source, "agent");
  return getEventString(agent, "role") ?? "";
}

function isLLMSource(source: unknown): boolean {
  return getEntityType(source) === "llm" || getSourceString(source, "sourceType", "source_type") === "llm";
}

function setSourceExecutionSpan(source: unknown, span: unknown): void {
  if (source && typeof source === "object") {
    (source as { _execution_span?: unknown })._execution_span = span;
  }
}

function sourceCrew(source: unknown): unknown {
  return getEventValue(source, "crew") ?? getEventValue(getEventValue(source, "agent"), "crew") ?? null;
}

export const crewaiEventBus = new EventBus();
export const crewai_event_bus = crewaiEventBus;
export const CrewAIEventsBus = EventBus;
setEventRuntimeStateProvider(() => crewaiEventBus.runtimeState);

export class EventListener extends BaseEventListener {
  private static instance: EventListener | null = null;
  _telemetry = Telemetry.getInstance();
  formatter = new ConsoleFormatter({ verbose: true });
  executionSpans = new Map<unknown, unknown>();
  execution_spans = this.executionSpans;
  nextChunk = 0;
  next_chunk = 0;
  textStream = "";
  text_stream = "";
  knowledgeRetrievalInProgress = false;
  knowledge_retrieval_in_progress = false;
  knowledgeQueryInProgress = false;
  knowledge_query_in_progress = false;

  static getInstance(): EventListener {
    EventListener.instance ??= new EventListener(crewaiEventBus);
    return EventListener.instance;
  }

  setupListeners(eventBus: EventBus): void {
    const onEvent = (eventType: EventType, handler: (source: unknown, event: Record<string, unknown>) => void): void => {
      eventBus.on(eventType, (source, event) => {
        handler(source, event as unknown as Record<string, unknown>);
      });
    };

    onEvent("cc_env", (_source, event) => {
      this._telemetry.env_context_span(event.type as string);
    });
    onEvent("codex_env", (_source, event) => {
      this._telemetry.env_context_span(event.type as string);
    });
    onEvent("cursor_env", (_source, event) => {
      this._telemetry.env_context_span(event.type as string);
    });
    onEvent("default_env", (_source, event) => {
      this._telemetry.env_context_span(event.type as string);
    });
    onEvent("crew_kickoff_started", (source, event) => {
      this.formatter.handle_crew_started(getEventString(event, "crew_name", "crewName") ?? "Crew", getSourceId(source));
      setSourceExecutionSpan(source, this._telemetry.crew_execution_span(source, getEventRecord(event, "inputs")));
      if (
        getBeforeLlmCallHooks().length > 0
        || getAfterLlmCallHooks().length > 0
        || getBeforeToolCallHooks().length > 0
        || getAfterToolCallHooks().length > 0
      ) {
        this._telemetry.feature_usage_span("hooks:registered");
      }
    });
    onEvent("crew_kickoff_completed", (source, event) => {
      const output = getEventRecord(event, "output");
      const finalOutput = getEventString(output, "raw") ?? "";
      this._telemetry.end_crew(source, finalOutput);
      this.formatter.handle_crew_status(getEventString(event, "crew_name", "crewName") ?? "Crew", getSourceId(source), "completed", finalOutput);
    });
    onEvent("crew_kickoff_failed", (source, event) => {
      this.formatter.handle_crew_status(getEventString(event, "crew_name", "crewName") ?? "Crew", getSourceId(source), "failed");
    });
    onEvent("crew_train_started", (_source, event) => {
      this.formatter.handle_crew_train_started(getEventString(event, "crew_name", "crewName") ?? "Crew", formatEventValue(getEventValue(event, "timestamp")));
    });
    onEvent("crew_train_completed", (_source, event) => {
      this.formatter.handle_crew_train_completed(getEventString(event, "crew_name", "crewName") ?? "Crew", formatEventValue(getEventValue(event, "timestamp")));
    });
    onEvent("crew_train_failed", (_source, event) => {
      this.formatter.handle_crew_train_failed(getEventString(event, "crew_name", "crewName") ?? "Crew");
    });
    onEvent("crew_test_started", (source, event) => {
      this._telemetry.test_execution_span(source, getEventNumber(event, "n_iterations", "nIterations") ?? 0, getEventRecord(event, "inputs"), getEventString(event, "eval_llm", "evalLlm") ?? "");
      this.formatter.handle_crew_test_started(getEventString(event, "crew_name", "crewName") ?? "Crew", getSourceId(source), getEventNumber(event, "n_iterations", "nIterations") ?? 0);
    });
    onEvent("crew_test_completed", (_source, event) => {
      this.formatter.handle_crew_test_completed(getEventString(event, "crew_name", "crewName") ?? "Crew");
    });
    onEvent("crew_test_failed", (_source, event) => {
      this.formatter.handle_crew_test_failed(getEventString(event, "crew_name", "crewName") ?? "Crew");
    });
    onEvent("crew_test_result", (source, event) => {
      this._telemetry.individual_test_result_span(
        getEventValue(source, "crew") ?? source,
        getEventNumber(event, "quality") ?? 0,
        getEventNumber(event, "execution_duration", "executionDuration") ?? 0,
        getEventString(event, "model") ?? "",
      );
    });
    onEvent("task_started", (source) => {
      this.executionSpans.set(source, this._telemetry.task_started(sourceCrew(source), source));
      this.formatter.handle_task_started(getSourceId(source), getTaskName(source));
    });
    onEvent("task_completed", (source) => {
      const span = this.executionSpans.get(source);
      this.executionSpans.delete(source);
      if (span) {
        this._telemetry.task_ended(span, source, sourceCrew(source));
      }
      this.formatter.handle_task_status(getSourceId(source), getAgentRole(source), "completed", getTaskName(source));
    });
    onEvent("task_failed", (source) => {
      const span = this.executionSpans.get(source);
      this.executionSpans.delete(source);
      if (span) {
        this._telemetry.task_ended(span, source, sourceCrew(source));
      }
      this.formatter.handle_task_status(getSourceId(source), getAgentRole(source), "failed", getTaskName(source));
    });
    onEvent("lite_agent_execution_started", (_source, event) => {
      const agentInfo = getEventRecord(event, "agent_info", "agentInfo") ?? {};
      this.formatter.handle_lite_agent_execution(getEventString(agentInfo, "role") ?? "", "started", null, agentInfo);
    });
    onEvent("lite_agent_execution_completed", (_source, event) => {
      const agentInfo = getEventRecord(event, "agent_info", "agentInfo") ?? {};
      this.formatter.handle_lite_agent_execution(getEventString(agentInfo, "role") ?? "", "completed", null, agentInfo);
    });
    onEvent("lite_agent_execution_error", (_source, event) => {
      const agentInfo = getEventRecord(event, "agent_info", "agentInfo") ?? {};
      this.formatter.handle_lite_agent_execution(getEventString(agentInfo, "role") ?? "", "failed", getEventValue(event, "error"), agentInfo);
    });
    onEvent("flow_created", (_source, event) => {
      this._telemetry.flow_creation_span(getEventString(event, "flow_name", "flowName") ?? "Flow");
      this.formatter.handle_flow_created(getEventString(event, "flow_name", "flowName") ?? "Flow", getEventString(event, "flow_id", "flowId") ?? "");
    });
    onEvent("flow_started", (source, event) => {
      const flowId = getEventString(event, "flow_id", "flowId") ?? getSourceString(source, "flow_id", "flowId") ?? "";
      const flowName = getEventString(event, "flow_name", "flowName") ?? "Flow";
      const methods = getEventValue(source, "_methods");
      this._telemetry.flow_execution_span(flowName, methods && typeof methods === "object" ? Object.keys(methods) : []);
      this.formatter.handle_flow_created(flowName, flowId);
      this.formatter.handle_flow_started(flowName, flowId);
    });
    onEvent("flow_finished", (source, event) => {
      this.formatter.handle_flow_status(getEventString(event, "flow_name", "flowName") ?? "Flow", getEventString(event, "flow_id", "flowId") ?? getSourceString(source, "flow_id", "flowId") ?? "");
    });
    onEvent("flow_paused", (_source, event) => {
      this.formatter.handle_flow_status(getEventString(event, "flow_name", "flowName") ?? "Flow", getEventString(event, "flow_id", "flowId") ?? "", "paused");
    });
    onEvent("method_execution_started", (_source, event) => {
      this.formatter.handle_method_status(getEventString(event, "method_name", "methodName") ?? "", "running");
    });
    onEvent("method_execution_finished", (_source, event) => {
      this.formatter.handle_method_status(getEventString(event, "method_name", "methodName") ?? "", "completed");
    });
    onEvent("method_execution_failed", (_source, event) => {
      this.formatter.handle_method_status(getEventString(event, "method_name", "methodName") ?? "", "failed");
    });
    onEvent("method_execution_paused", (_source, event) => {
      this.formatter.handle_method_status(getEventString(event, "method_name", "methodName") ?? "", "paused");
    });
    onEvent("human_feedback_requested", (_source, event) => {
      const emit = getEventValue(event, "emit");
      const outcomes = Array.isArray(emit) ? emit : [];
      this._telemetry.human_feedback_span("requested", outcomes.length > 0, outcomes.length);
    });
    onEvent("human_feedback_received", (_source, event) => {
      const feedback = getEventString(event, "feedback") ?? "";
      this._telemetry.human_feedback_span("received", getEventValue(event, "outcome") !== null, 0, feedback.trim().length > 0, getEventString(event, "outcome"));
    });
    onEvent("tool_usage_started", (source, event) => {
      if (isLLMSource(source)) {
        this.formatter.handle_llm_tool_usage_started(getEventString(event, "tool_name", "toolName") ?? "", getEventRecord(event, "tool_args", "toolArgs") ?? getEventString(event, "tool_args", "toolArgs") ?? "");
      } else {
        this.formatter.handle_tool_usage_started(getEventString(event, "tool_name", "toolName") ?? "", getEventRecord(event, "tool_args", "toolArgs") ?? getEventString(event, "tool_args", "toolArgs") ?? "", getEventNumber(event, "run_attempts", "runAttempts"));
      }
    });
    onEvent("tool_usage_finished", (source, event) => {
      if (isLLMSource(source)) {
        this.formatter.handle_llm_tool_usage_finished(getEventString(event, "tool_name", "toolName") ?? "");
      } else {
        this.formatter.handle_tool_usage_finished(getEventString(event, "tool_name", "toolName") ?? "", getEventString(event, "output") ?? "", getEventNumber(event, "run_attempts", "runAttempts"));
      }
    });
    onEvent("tool_usage_error", (source, event) => {
      if (isLLMSource(source)) {
        this.formatter.handle_llm_tool_usage_error(getEventString(event, "tool_name", "toolName") ?? "", getEventString(event, "error") ?? "");
      } else {
        this.formatter.handle_tool_usage_error(getEventString(event, "tool_name", "toolName") ?? "", getEventString(event, "error") ?? "", getEventNumber(event, "run_attempts", "runAttempts"));
      }
    });
    onEvent("llm_call_started", () => {
      this.textStream = "";
      this.text_stream = "";
      this.nextChunk = 0;
      this.next_chunk = 0;
    });
    onEvent("llm_call_completed", () => {
      this.formatter.handle_llm_stream_completed();
    });
    onEvent("llm_call_failed", (_source, event) => {
      this.formatter.handle_llm_stream_completed();
      this.formatter.handle_llm_call_failed(getEventString(event, "error") ?? "");
    });
    onEvent("llm_stream_chunk", (_source, event) => {
      this.textStream += getEventString(event, "chunk") ?? "";
      this.text_stream = this.textStream;
      this.nextChunk = this.textStream.length;
      this.next_chunk = this.nextChunk;
      this.formatter.handle_llm_stream_chunk(this.textStream, getEventValue(event, "call_type", "callType"));
    });
    onEvent("llm_guardrail_started", (_source, event) => {
      const guardrail = formatEventValue(getEventValue(event, "guardrail"));
      this.formatter.handle_guardrail_started(guardrail.length > 50 ? `${guardrail.slice(0, 50)}...` : guardrail, getEventNumber(event, "retry_count", "retryCount") ?? 0);
    });
    onEvent("llm_guardrail_completed", (_source, event) => {
      this.formatter.handle_guardrail_completed(Boolean(getEventValue(event, "success")), getEventString(event, "error"), getEventNumber(event, "retry_count", "retryCount") ?? 0);
      this._telemetry.feature_usage_span("guardrail:execution");
    });
    onEvent("knowledge_search_query_started", () => {
      if (!this.knowledgeQueryInProgress) {
        this.knowledgeQueryInProgress = true;
        this.knowledge_query_in_progress = true;
      }
    });
    onEvent("knowledge_search_query_completed", () => {
      this.knowledgeQueryInProgress = false;
      this.knowledge_query_in_progress = false;
    });
    onEvent("knowledge_query_failed", (_source, event) => {
      this.formatter.handle_knowledge_query_failed(getEventString(event, "error") ?? "");
    });
    onEvent("knowledge_query_completed", () => {
      this.formatter.handle_knowledge_query_completed();
    });
    onEvent("knowledge_search_query_failed", (_source, event) => {
      this.formatter.handle_knowledge_search_query_failed(getEventString(event, "error") ?? "");
    });
    onEvent("memory_retrieval_started", () => {
      if (!this.knowledgeRetrievalInProgress) {
        this.knowledgeRetrievalInProgress = true;
        this.knowledge_retrieval_in_progress = true;
        this.formatter.handle_knowledge_retrieval_started();
      }
    });
    onEvent("memory_retrieval_completed", (_source, event) => {
      this.knowledgeRetrievalInProgress = false;
      this.knowledge_retrieval_in_progress = false;
      this.formatter.handle_memory_retrieval_completed(getEventString(event, "memory_content", "memoryContent") ?? "", getEventNumber(event, "retrieval_time_ms", "retrievalTimeMs") ?? 0);
      this._telemetry.feature_usage_span("memory:retrieval");
    });
    onEvent("memory_query_failed", (_source, event) => {
      this.formatter.handle_memory_query_failed(getEventString(event, "error") ?? "", getEventString(event, "source_type", "sourceType") ?? "");
    });
    onEvent("memory_save_started", () => {
      this.formatter.handle_memory_save_started();
    });
    onEvent("memory_save_completed", (_source, event) => {
      this.formatter.handle_memory_save_completed(getEventNumber(event, "save_time_ms", "saveTimeMs") ?? 0, getEventString(event, "source_type", "sourceType") ?? "");
      this._telemetry.feature_usage_span("memory:save");
    });
    onEvent("memory_save_failed", (_source, event) => {
      this.formatter.handle_memory_save_failed(getEventString(event, "error") ?? "", getEventString(event, "source_type", "sourceType") ?? "");
    });
    onEvent("agent_reasoning_started", (_source, event) => {
      this.formatter.handle_reasoning_started(getEventNumber(event, "attempt") ?? 0);
    });
    onEvent("agent_reasoning_completed", (_source, event) => {
      this.formatter.handle_reasoning_completed(getEventString(event, "plan") ?? "", Boolean(getEventValue(event, "ready")));
      this._telemetry.feature_usage_span("planning:creation");
    });
    onEvent("agent_reasoning_failed", (_source, event) => {
      this.formatter.handle_reasoning_failed(getEventString(event, "error") ?? "");
    });
    onEvent("step_observation_started", (_source, event) => {
      this.formatter.handle_observation_started(getEventString(event, "agent_role", "agentRole") ?? "", getEventNumber(event, "step_number", "stepNumber") ?? 0, getEventString(event, "step_description", "stepDescription") ?? "");
    });
    onEvent("step_observation_completed", (_source, event) => {
      this.formatter.handle_observation_completed(
        getEventString(event, "agent_role", "agentRole") ?? "",
        getEventNumber(event, "step_number", "stepNumber") ?? 0,
        Boolean(getEventValue(event, "step_completed_successfully", "stepCompletedSuccessfully")),
        Boolean(getEventValue(event, "remaining_plan_still_valid", "remainingPlanStillValid")),
        getEventString(event, "key_information_learned", "keyInformationLearned") ?? "",
        Boolean(getEventValue(event, "needs_full_replan", "needsFullReplan")),
        Boolean(getEventValue(event, "goal_already_achieved", "goalAlreadyAchieved")),
      );
    });
    onEvent("step_observation_failed", (_source, event) => {
      this.formatter.handle_observation_failed(getEventNumber(event, "step_number", "stepNumber") ?? 0, getEventString(event, "error") ?? "");
    });
    onEvent("plan_refinement", (_source, event) => {
      this.formatter.handle_plan_refinement(getEventNumber(event, "step_number", "stepNumber") ?? 0, getEventNumber(event, "refined_step_count", "refinedStepCount") ?? 0, getEventStringArray(event, "refinements"));
    });
    onEvent("plan_replan_triggered", (_source, event) => {
      this.formatter.handle_plan_replan(getEventString(event, "replan_reason", "replanReason") ?? "", getEventNumber(event, "replan_count", "replanCount") ?? 0, getEventNumber(event, "completed_steps_preserved", "completedStepsPreserved") ?? 0);
      this._telemetry.feature_usage_span("planning:replan");
    });
    onEvent("goal_achieved_early", (_source, event) => {
      this.formatter.handle_goal_achieved_early(getEventNumber(event, "steps_completed", "stepsCompleted") ?? 0, getEventNumber(event, "steps_remaining", "stepsRemaining") ?? 0);
      this._telemetry.feature_usage_span("planning:goal_achieved_early");
    });
    onEvent("skill_discovery_completed", () => {
      this._telemetry.feature_usage_span("skill:discovery");
    });
    onEvent("skill_loaded", () => {
      this._telemetry.feature_usage_span("skill:loaded");
    });
    onEvent("skill_load_failed", () => {
      this._telemetry.feature_usage_span("skill:load_failed");
    });
    onEvent("skill_activated", () => {
      this._telemetry.feature_usage_span("skill:activated");
    });
    onEvent("agent_logs_started", (_source, event) => {
      this.formatter.handle_agent_logs_started(getEventString(event, "agent_role", "agentRole") ?? "", getEventString(event, "task_description", "taskDescription"), Boolean(getEventValue(event, "verbose")));
    });
    onEvent("agent_logs_execution", (_source, event) => {
      this.formatter.handle_agent_logs_execution(getEventString(event, "agent_role", "agentRole") ?? "", getEventValue(event, "formatted_answer", "formattedAnswer"), Boolean(getEventValue(event, "verbose")));
    });
    onEvent("a2a_delegation_started", (_source, event) => {
      this.formatter.handle_a2a_delegation_started(getEventString(event, "endpoint") ?? "", getEventString(event, "task_description", "taskDescription") ?? "", getEventString(event, "agent_id", "agentId") ?? "", Boolean(getEventValue(event, "is_multiturn", "isMultiturn")), getEventNumber(event, "turn_number", "turnNumber") ?? 1);
    });
    onEvent("a2a_delegation_completed", (_source, event) => {
      this.formatter.handle_a2a_delegation_completed(getEventString(event, "status") ?? "", getEventString(event, "result"), getEventString(event, "error"), Boolean(getEventValue(event, "is_multiturn", "isMultiturn")));
      this._telemetry.feature_usage_span("a2a:delegation");
    });
    onEvent("a2a_conversation_started", (_source, event) => {
      this.formatter.handle_a2a_conversation_started(getEventString(event, "agent_id", "agentId") ?? "", getEventString(event, "endpoint") ?? "");
    });
    onEvent("a2a_message_sent", (_source, event) => {
      this.formatter.handle_a2a_message_sent(getEventString(event, "message") ?? "", getEventNumber(event, "turn_number", "turnNumber") ?? 0, getEventString(event, "agent_role", "agentRole"));
    });
    onEvent("a2a_response_received", (_source, event) => {
      this.formatter.handle_a2a_response_received(getEventString(event, "response") ?? "", getEventNumber(event, "turn_number", "turnNumber") ?? 0, getEventString(event, "status") ?? "", getEventString(event, "agent_role", "agentRole"));
    });
    onEvent("a2a_conversation_completed", (_source, event) => {
      this.formatter.handle_a2a_conversation_completed(getEventString(event, "status") ?? "", getEventString(event, "final_result", "finalResult"), getEventString(event, "error"), getEventNumber(event, "total_turns", "totalTurns") ?? 0);
      this._telemetry.feature_usage_span("a2a:conversation");
    });
    onEvent("a2a_polling_started", (_source, event) => {
      this.formatter.handle_a2a_polling_started(getEventString(event, "task_id", "taskId") ?? "", getEventNumber(event, "polling_interval", "pollingInterval") ?? 0, getEventString(event, "endpoint") ?? "");
    });
    onEvent("a2a_polling_status", (_source, event) => {
      this.formatter.handle_a2a_polling_status(getEventString(event, "task_id", "taskId") ?? "", getEventString(event, "state") ?? "", getEventNumber(event, "elapsed_seconds", "elapsedSeconds") ?? 0, getEventNumber(event, "poll_count", "pollCount") ?? 0);
    });
    onEvent("mcp_connection_started", (_source, event) => {
      this.formatter.handle_mcp_connection_started(getEventString(event, "server_name", "serverName") ?? "", getEventString(event, "server_url", "serverUrl"), getEventString(event, "transport_type", "transportType"), Boolean(getEventValue(event, "is_reconnect", "isReconnect")), getEventNumber(event, "connect_timeout", "connectTimeout"));
    });
    onEvent("mcp_connection_completed", (_source, event) => {
      this.formatter.handle_mcp_connection_completed(getEventString(event, "server_name", "serverName") ?? "", getEventString(event, "server_url", "serverUrl"), getEventString(event, "transport_type", "transportType"), getEventNumber(event, "connection_duration_ms", "connectionDurationMs"), Boolean(getEventValue(event, "is_reconnect", "isReconnect")));
      this._telemetry.feature_usage_span("mcp:connection");
    });
    onEvent("mcp_connection_failed", (_source, event) => {
      this.formatter.handle_mcp_connection_failed(getEventString(event, "server_name", "serverName") ?? "", getEventString(event, "server_url", "serverUrl"), getEventString(event, "transport_type", "transportType"), getEventString(event, "error") ?? "", getEventString(event, "error_type", "errorType"));
      this._telemetry.feature_usage_span("mcp:connection_failed");
    });
    onEvent("mcp_config_fetch_failed", (_source, event) => {
      this.formatter.handle_mcp_config_fetch_failed(getEventString(event, "slug") ?? "", getEventString(event, "error") ?? "", getEventString(event, "error_type", "errorType"));
      this._telemetry.feature_usage_span("mcp:config_fetch_failed");
    });
    onEvent("mcp_tool_execution_started", (_source, event) => {
      this.formatter.handle_mcp_tool_execution_started(getEventString(event, "server_name", "serverName") ?? "", getEventString(event, "tool_name", "toolName") ?? "", getEventRecord(event, "tool_args", "toolArgs"));
    });
    onEvent("mcp_tool_execution_failed", (_source, event) => {
      this.formatter.handle_mcp_tool_execution_failed(getEventString(event, "server_name", "serverName") ?? "", getEventString(event, "tool_name", "toolName") ?? "", getEventRecord(event, "tool_args", "toolArgs"), getEventString(event, "error") ?? "", getEventString(event, "error_type", "errorType"));
      this._telemetry.feature_usage_span("mcp:tool_execution_failed");
    });
    onEvent("mcp_tool_execution_completed", () => {
      this._telemetry.feature_usage_span("mcp:tool_execution");
    });
    onEvent("memory_query_completed", () => {
      this._telemetry.feature_usage_span("memory:query");
    });
  }

  override setup_listeners(eventBus: EventBus): void {
    this.setupListeners(eventBus);
  }
}

export class ConsoleFormatter {
  readonly verbose: boolean;
  static readonly toolUsageCounts = new Map<string, number>();
  static crewCompletionPrinted = false;
  current_a2a_turn_count = 0;
  private pendingA2AMessage: string | null = null;
  private pendingA2AAgentRole: string | null = null;
  private pendingA2ATurnNumber: number | null = null;
  private currentA2AAgentName: string | null = null;
  private isStreaming = false;
  private justStreamedFinalAnswer = false;
  private lastStreamCallType: unknown = null;
  _streaming_live: ConsoleStreamingLive | null = null;

  constructor(options: { verbose?: boolean } = {}) {
    this.verbose = options.verbose ?? false;
  }

  create_panel(content: unknown, title: string, style = "blue"): Record<string, unknown> {
    return { content, title, border_style: style, style };
  }

  createPanel(content: unknown, title: string, style = "blue"): Record<string, unknown> {
    return this.create_panel(content, title, style);
  }

  _show_version_update_message_if_needed(): void {
    if (!this.verbose) {
      return;
    }
    const isCi = ["true", "1"].includes((process.env.CI ?? "").toLowerCase());
    const disabled = ["true", "1"].includes((process.env.CREWAI_DISABLE_VERSION_CHECK ?? "").toLowerCase());
    if (isCi || disabled) {
      return;
    }
    // The TypeScript port does not query package indexes at runtime; this hook preserves the upstream surface.
  }

  _show_tracing_disabled_message_if_needed(): void {
    if (!this.verbose) {
      return;
    }
    this.print_panel([
      "Info: Tracing is disabled.",
      "",
      "To enable tracing, set tracing=true or CREWAI_TRACING_ENABLED=true.",
    ].join("\n"), "Tracing Status", "blue");
  }

  _simplify_tools_field<TFields extends Record<string, unknown>>(fields: TFields): TFields {
    if (!("tools" in fields)) {
      return fields;
    }
    const record = fields as Record<string, unknown>;
    const tools = record.tools;
    if (!Array.isArray(tools) || tools.length === 0) {
      record.tools = "None";
      return fields;
    }
    record.tools = tools.map((tool) => {
      if (tool && typeof tool === "object" && "name" in tool) {
        const name = (tool as { name?: unknown }).name;
        return typeof name === "string" ? name : String(tool);
      }
      return String(tool);
    }).join(", ");
    return fields;
  }

  create_status_content(
    title: string,
    name: string,
    status_style = "blue",
    tool_args: Record<string, unknown> | string = "",
    fields: Record<string, unknown> = {},
  ): string {
    const lines = [title, `Name: ${name}`];
    for (const [label, value] of Object.entries(fields)) {
      if (!label.endsWith("_style")) {
        lines.push(`${label}: ${this.formatConsoleValue(value)}`);
      }
    }
    if (tool_args && (typeof tool_args === "string" || Object.keys(tool_args).length > 0)) {
      lines.push(`Tool Args: ${this.formatConsoleValue(tool_args)}`);
    }
    void status_style;
    return `${lines.join("\n")}\n`;
  }

  createStatusContent(
    title: string,
    name: string,
    statusStyle = "blue",
    toolArgs: Record<string, unknown> | string = "",
    fields: Record<string, unknown> = {},
  ): string {
    return this.create_status_content(title, name, statusStyle, toolArgs, fields);
  }

  print(...args: unknown[]): void {
    if (args.length === 0 && this.isStreaming) {
      return;
    }
    globalThis.console.log(...args);
  }

  pause_live_updates(): void {
    this._streaming_live?.stop();
    this._streaming_live = null;
    this.isStreaming = false;
  }

  pauseLiveUpdates(): void {
    this.pause_live_updates();
  }

  resume_live_updates(): void {}

  resumeLiveUpdates(): void {
    this.resume_live_updates();
  }

  print_panel(content: unknown, title: string, style = "blue", is_flow = false): void {
    if (this.verbose || is_flow) {
      this.print(`[${title}]`, this.formatConsoleValue(content));
    }
    void style;
  }

  printPanel(content: unknown, title: string, style = "blue", isFlow = false): void {
    this.print_panel(content, title, style, isFlow);
  }

  handle_crew_status(crew_name: string, source_id: string, status = "completed", final_string_output = ""): void {
    if (!this.verbose) {
      return;
    }
    const title = status === "failed" ? "Crew Failure" : status === "completed" ? "Crew Completion" : "Crew Execution";
    this.print_panel(this.create_status_content(`Crew Execution ${status}`, crew_name || "Crew", status, "", {
      ID: source_id,
      ...(final_string_output ? { Output: final_string_output } : {}),
    }), title, status === "failed" ? "red" : "green");
    if (status === "completed" || status === "failed") {
      ConsoleFormatter.crewCompletionPrinted = true;
      this._show_tracing_disabled_message_if_needed();
    }
  }

  handleCrewStatus(crewName: string, sourceId: string, status = "completed", finalStringOutput = ""): void {
    this.handle_crew_status(crewName, sourceId, status, finalStringOutput);
  }

  handle_crew_started(crew_name: string, source_id: string): void {
    ConsoleFormatter.crewCompletionPrinted = false;
    this._show_version_update_message_if_needed();
    this.print_panel(this.create_status_content("Crew Execution Started", crew_name, "cyan", "", { ID: source_id }), "Crew Execution Started", "cyan");
  }

  handleCrewStarted(crewName: string, sourceId: string): void {
    this.handle_crew_started(crewName, sourceId);
  }

  handle_task_started(task_id: string, task_name: string | null = null): void {
    this.print_panel(this.create_status_content("Task Started", task_name ?? task_id, "yellow", "", { ID: task_id }), "Task Started", "yellow");
  }

  handleTaskStarted(taskId: string, taskName: string | null = null): void {
    this.handle_task_started(taskId, taskName);
  }

  handle_task_status(task_id: string, agent_role: string, status = "completed", task_name: string | null = null): void {
    this.print_panel(this.create_status_content(`Task ${status}`, task_name ?? task_id, status === "failed" ? "red" : "green", "", {
      Agent: agent_role,
    }), status === "failed" ? "Task Failure" : "Task Completion", status === "failed" ? "red" : "green");
  }

  handleTaskStatus(taskId: string, agentRole: string, status = "completed", taskName: string | null = null): void {
    this.handle_task_status(taskId, agentRole, status, taskName);
  }

  handle_flow_created(flow_name: string, flow_id: string): void {
    this.print_panel(this.create_status_content("Starting Flow Execution", flow_name, "blue", "", { ID: flow_id }), "Flow Execution", "blue", true);
  }

  handle_flow_started(flow_name: string, flow_id: string): void {
    this.print_panel(this.create_status_content("Flow Started", flow_name, "blue", "", { ID: flow_id }), "Flow Started", "blue", true);
  }

  handle_flow_status(flow_name: string, flow_id: string, status = "completed"): void {
    this.print_panel(this.create_status_content(`Flow ${status}`, flow_name, status === "failed" ? "red" : "green", "", { ID: flow_id }), "Flow Status", status === "failed" ? "red" : "green", true);
  }

  handle_method_status(method_name: string, status = "running"): void {
    this.print_panel(this.create_status_content(`Method ${status}`, method_name, status === "failed" ? "red" : "yellow"), "Flow Method", status === "failed" ? "red" : "yellow", true);
  }

  handle_llm_tool_usage_started(tool_name: string, tool_args: Record<string, unknown> | string): void {
    this.print_panel(this.create_status_content("Tool Usage Started", tool_name, "yellow", tool_args, { Status: "In Progress" }), "LLM Tool Usage", "yellow");
  }

  handle_llm_tool_usage_finished(tool_name: string): void {
    this.print_panel(this.create_status_content("Tool Usage Completed", tool_name, "green"), "LLM Tool Completed", "green");
  }

  handle_llm_tool_usage_error(tool_name: string, error: string): void {
    this.print_panel(this.create_status_content("Tool Usage Failed", tool_name, "red", "", { Error: error }), "LLM Tool Error", "red");
  }

  handle_tool_usage_started(tool_name: string, tool_args: Record<string, unknown> | string = "", run_attempts: number | null = null): void {
    if (!this.verbose) {
      return;
    }
    const iteration = (ConsoleFormatter.toolUsageCounts.get(tool_name) ?? 0) + 1;
    ConsoleFormatter.toolUsageCounts.set(tool_name, iteration);
    this.print_panel(this.create_status_content("Tool Execution Started", tool_name, "yellow", tool_args, {
      Iteration: iteration,
      ...(run_attempts === null ? {} : { Attempt: run_attempts }),
    }), `Tool Execution Started (#${String(iteration)})`, "yellow");
  }

  handle_tool_usage_finished(tool_name: string, output: string, run_attempts: number | null = null): void {
    if (!this.verbose) {
      return;
    }
    const iteration = ConsoleFormatter.toolUsageCounts.get(tool_name) ?? 1;
    this.print_panel(this.create_status_content("Tool Completed", tool_name, "green", "", {
      Iteration: iteration,
      ...(run_attempts === null ? {} : { Attempt: run_attempts }),
      ...(output ? { Output: output } : {}),
    }), `Tool Execution Completed (#${String(iteration)})`, "green");
  }

  handle_tool_usage_error(tool_name: string, error: string, run_attempts: number | null = null): void {
    if (!this.verbose) {
      return;
    }
    const iteration = ConsoleFormatter.toolUsageCounts.get(tool_name) ?? 1;
    this.print_panel(this.create_status_content("Tool Failed", tool_name, "red", "", {
      Iteration: iteration,
      ...(run_attempts === null ? {} : { Attempt: run_attempts }),
      Error: error,
    }), `Tool Error (#${String(iteration)})`, "red");
  }

  handle_llm_call_failed(error: string): void {
    this.print_panel(this.create_status_content("LLM Call Failed", "Error", "red", "", { Error: error }), "LLM Error", "red");
  }

  handle_llm_stream_chunk(accumulated_text: string, call_type: unknown = null): void {
    if (!this.verbose) {
      return;
    }
    if (!this._streaming_live) {
      this._streaming_live = this.create_streaming_live();
      this._streaming_live.start();
    }
    this.isStreaming = true;
    this.lastStreamCallType = call_type;
    this.print_panel(accumulated_text.split("\n").slice(-20).join("\n"), "LLM Stream", "green");
  }

  handle_llm_stream_completed(): void {
    this._streaming_live?.stop();
    this._streaming_live = null;
    this.isStreaming = false;
    this.justStreamedFinalAnswer = this.lastStreamCallType === "llm_call";
    this.lastStreamCallType = null;
  }

  create_streaming_live(): ConsoleStreamingLive {
    let active = false;
    return {
      start: () => {
        active = true;
      },
      stop: () => {
        active = false;
      },
      get active() {
        return active;
      },
    };
  }

  handle_crew_test_started(crew_name: string, source_id: string, n_iterations: number): void {
    this.print_panel(this.create_status_content("Starting Crew Test", crew_name, "blue", "", { ID: source_id, Iterations: n_iterations }), "Test Execution Started", "blue");
  }

  handle_crew_test_completed(crew_name: string): void {
    this.print_panel(this.create_status_content("Test Execution Completed", crew_name, "green"), "Test Completion", "green");
  }

  handle_crew_train_started(crew_name: string, timestamp: string): void {
    this.print_panel(this.create_status_content("Crew Training Started", crew_name, "blue", "", { Time: timestamp }), "Training Started", "blue");
  }

  handle_crew_train_completed(crew_name: string, timestamp: string): void {
    this.print_panel(this.create_status_content("Crew Training Completed", crew_name, "green", "", { Time: timestamp }), "Training Completed", "green");
  }

  handle_crew_train_failed(crew_name: string): void {
    this.print_panel(this.create_status_content("Crew Training Failed", crew_name || "Crew", "red"), "Training Failure", "red");
  }

  handle_crew_test_failed(crew_name: string): void {
    this.print_panel(this.create_status_content("Crew Test Failed", crew_name || "Crew", "red"), "Test Failure", "red");
  }

  create_lite_agent_branch(lite_agent_role: string): void {
    this.print_panel(this.create_status_content("LiteAgent Started", lite_agent_role, "cyan", "", { Status: "In Progress" }), "LiteAgent Started", "cyan");
  }

  update_lite_agent_status(lite_agent_role: string, status = "completed", fields: Record<string, unknown> = {}): void {
    this.print_panel(this.create_status_content(`LiteAgent ${status}`, lite_agent_role, status === "failed" ? "red" : "green", "", fields), "LiteAgent Status", status === "failed" ? "red" : "green");
  }

  handle_lite_agent_execution(lite_agent_role: string, status = "started", error: unknown = null, fields: Record<string, unknown> = {}): void {
    const displayFields = this._simplify_tools_field({ ...fields });
    if (status === "started") {
      this.create_lite_agent_branch(lite_agent_role);
      if (Object.keys(displayFields).length > 0) {
        this.print_panel(this.create_status_content("LiteAgent Session Started", lite_agent_role, "cyan", "", displayFields), "LiteAgent Started", "cyan");
      }
      return;
    }
    this.update_lite_agent_status(lite_agent_role, status, error ? { ...displayFields, Error: error } : displayFields);
  }

  handle_knowledge_retrieval_started(): void {
    this.print_panel("Retrieving...", "Knowledge Retrieval", "blue");
  }

  handle_knowledge_retrieval_completed(retrieved_knowledge: unknown, search_query: string): void {
    this.print_panel(this.create_status_content("Knowledge Retrieved", search_query, "green", "", { Knowledge: this.truncate(retrieved_knowledge, 500) }), "Knowledge Retrieved", "green");
  }

  handle_knowledge_query_started(task_prompt: string): void {
    this.print_panel(this.truncate(task_prompt, 100), "Knowledge Query", "yellow");
  }

  handle_knowledge_query_failed(error: string): void {
    this.print_panel(this.create_status_content("Knowledge Query Failed", "Query Error", "red", "", { Error: error }), "Knowledge Error", "red");
  }

  handle_knowledge_query_completed(): void {
    this.print_panel("Knowledge Query Completed", "Knowledge Query Complete", "green");
  }

  handle_knowledge_search_query_failed(error: string): void {
    this.print_panel(this.create_status_content("Knowledge Search Failed", "Search Error", "red", "", { Error: error }), "Search Error", "red");
  }

  handle_reasoning_started(attempt: number): void {
    this.print_panel(this.create_status_content("Reasoning Started", `Attempt ${String(attempt)}`, "blue"), "Reasoning", "blue");
  }

  handle_reasoning_completed(plan: string, ready: boolean): void {
    this.print_panel(this.create_status_content("Reasoning Completed", ready ? "Ready" : "Not Ready", ready ? "green" : "yellow", "", { Plan: this.truncate(plan, 500) }), "Reasoning Complete", ready ? "green" : "yellow");
  }

  handle_reasoning_failed(error: string): void {
    this.print_panel(this.create_status_content("Reasoning Failed", "Error", "red", "", { Error: error }), "Reasoning Error", "red");
  }

  handle_observation_started(agent_role: string, step_number: number, step_description: string): void {
    this.print_panel(this.create_status_content("Observation Started", agent_role, "cyan", "", { Step: step_number, Description: this.truncate(step_description, 80) }), "Observing Step Result", "cyan");
  }

  handle_observation_completed(agent_role: string, step_number: number, step_completed: boolean, plan_valid: boolean, key_info: string, needs_replan: boolean, goal_achieved: boolean): void {
    const status = goal_achieved ? "Goal Achieved Early" : needs_replan ? "Replan Needed" : plan_valid ? "Plan Valid" : step_completed ? "Step Completed" : "Step Failed";
    this.print_panel(this.create_status_content("Observation Complete", agent_role, "cyan", "", { Step: step_number, Status: status, Learned: this.truncate(key_info, 120) }), "Observation Result", "cyan");
  }

  handle_observation_failed(step_number: number, error: string): void {
    this.print_panel(this.create_status_content("Observation Failed", "Error", "red", "", { Step: step_number, Error: error }), "Observation Error", "red");
  }

  handle_plan_refinement(step_number: number, refined_count: number, refinements: readonly string[] | null): void {
    this.print_panel(this.create_status_content("Plan Refined", `Step ${String(step_number)}`, "cyan", "", { Updated: refined_count, Refinements: refinements?.slice(0, 3).join("; ") ?? "" }), "Plan Refinement", "cyan");
  }

  handle_plan_replan(reason: string, replan_count: number, preserved_count: number): void {
    this.print_panel(this.create_status_content("Full Replan Triggered", reason, "yellow", "", { Replan: replan_count, Preserved: preserved_count }), "Dynamic Replan", "yellow");
  }

  handle_goal_achieved_early(steps_completed: number, steps_remaining: number): void {
    this.print_panel(this.create_status_content("Goal Achieved Early", "Goal", "green", "", { Completed: steps_completed, Remaining: steps_remaining }), "Early Goal Achievement", "green");
  }

  handle_agent_logs_started(agent_role: string, task_description: string | null = null, verbose = false): void {
    if (verbose) {
      this.print_panel(this.create_status_content("Agent Started", agent_role.split("\n")[0] ?? agent_role, "green", "", task_description ? { Task: task_description } : {}), "Agent Started", "magenta", true);
    }
  }

  handle_agent_logs_execution(agent_role: string, formatted_answer: unknown, verbose = false): void {
    if (!verbose) {
      return;
    }
    if (this.justStreamedFinalAnswer) {
      this.justStreamedFinalAnswer = false;
      return;
    }
    this.print_panel(this.create_status_content("Agent Execution", agent_role.split("\n")[0] ?? agent_role, "green", "", { Output: this.truncate(formatted_answer, 2000) }), "Agent Output", "green", true);
  }

  handle_memory_retrieval_started(): void {
    this.print_panel("Retrieving...", "Memory Retrieval", "blue");
  }

  handle_memory_retrieval_completed(memory_content: string, retrieval_time_ms: number): void {
    this.print_panel(this.create_status_content("Memory Retrieval Completed", "Memory", "green", "", { Time: `${retrieval_time_ms.toFixed(2)}ms`, Content: memory_content }), "Memory Retrieved", "green");
  }

  handle_memory_query_failed(error: string, source_type: string): void {
    this.print_panel(this.create_status_content("Memory Query Failed", source_type, "red", "", { Error: error }), "Memory Query Error", "red");
  }

  handle_memory_save_started(): void {
    this.print_panel("Saving...", "Memory Save", "blue");
  }

  handle_memory_save_completed(save_time_ms: number, source_type: string): void {
    this.print_panel(this.create_status_content("Memory Save Completed", source_type, "green", "", { Time: `${save_time_ms.toFixed(2)}ms` }), "Memory Saved", "green");
  }

  handle_memory_save_failed(error: string, source_type: string): void {
    this.print_panel(this.create_status_content("Memory Save Failed", source_type, "red", "", { Error: error }), "Memory Save Error", "red");
  }

  handle_guardrail_started(guardrail_name: string, retry_count: number): void {
    this.print_panel(this.create_status_content("Guardrail Evaluation Started", guardrail_name, "yellow", "", { Attempt: retry_count + 1 }), "Guardrail Check", "yellow");
  }

  handle_guardrail_completed(success: boolean, error: string | null, retry_count: number): void {
    this.print_panel(this.create_status_content(success ? "Guardrail Passed" : "Guardrail Failed", "Validation", success ? "green" : "red", "", { Attempts: retry_count + 1, ...(error ? { Error: error } : {}) }), success ? "Guardrail Success" : "Guardrail Failed", success ? "green" : "red");
  }

  handle_a2a_delegation_started(endpoint: string, task_description: string, agent_id: string, is_multiturn = false, turn_number = 1): void {
    if (is_multiturn) {
      this.current_a2a_turn_count = turn_number;
    }
    this.currentA2AAgentName = agent_id;
    this.print_panel(this.create_status_content("A2A Delegation Started", agent_id, "cyan", "", { Endpoint: endpoint, Task: this.truncate(task_description, 200), Turn: turn_number }), "A2A Delegation", "cyan");
  }

  handle_a2a_delegation_completed(status: string, result: string | null = null, error: string | null = null, is_multiturn = false): void {
    if (is_multiturn && (status === "completed" || status === "failed")) {
      this.current_a2a_turn_count = 0;
    }
    this.print_panel(this.create_status_content(`A2A Delegation ${status}`, this.currentA2AAgentName ?? "A2A Agent", status === "failed" ? "red" : "green", "", { Result: this.truncate(result ?? "", 500), Error: error ?? "" }), "A2A Status", status === "failed" ? "red" : "green");
  }

  handle_a2a_conversation_started(agent_id: string, endpoint: string): void {
    this.currentA2AAgentName = agent_id;
    this.print_panel(this.create_status_content("A2A Conversation Started", agent_id, "cyan", "", { Endpoint: endpoint }), "A2A Conversation", "cyan");
  }

  handle_a2a_message_sent(message: string, turn_number: number, agent_role: string | null = null): void {
    this.pendingA2AMessage = message;
    this.pendingA2AAgentRole = agent_role;
    this.pendingA2ATurnNumber = turn_number;
  }

  handle_a2a_response_received(response: string, turn_number: number, status: string, agent_role: string | null = null): void {
    this.print_panel(this.create_status_content(`A2A Turn ${String(turn_number)}`, this.currentA2AAgentName ?? "A2A Agent", status === "failed" ? "red" : "cyan", "", {
      Status: status,
      MessageFrom: this.pendingA2AAgentRole ?? agent_role ?? "User",
      Message: this.truncate(this.pendingA2AMessage ?? "", 200),
      Response: this.truncate(response, 200),
      PendingTurn: this.pendingA2ATurnNumber ?? turn_number,
    }), `A2A Turn #${String(turn_number)}`, status === "failed" ? "red" : "cyan");
    this.pendingA2AMessage = null;
    this.pendingA2AAgentRole = null;
    this.pendingA2ATurnNumber = null;
  }

  handle_a2a_conversation_completed(status: string, final_result: string | null, error: string | null, total_turns: number): void {
    this.print_panel(this.create_status_content(`A2A Conversation ${status}`, this.currentA2AAgentName ?? "A2A Agent", status === "failed" ? "red" : "green", "", { Turns: total_turns, Result: this.truncate(final_result ?? "", 500), Error: error ?? "" }), "A2A Complete", status === "failed" ? "red" : "green");
    this.current_a2a_turn_count = 0;
    this.pendingA2AMessage = null;
    this.pendingA2AAgentRole = null;
    this.pendingA2ATurnNumber = null;
  }

  handle_mcp_connection_started(server_name: string, server_url: string | null = null, transport_type: string | null = null, is_reconnect = false, connect_timeout: number | null = null): void {
    this.print_panel(this.create_status_content(is_reconnect ? "MCP Reconnection Started" : "MCP Connection Started", server_name, "cyan", "", { URL: server_url ?? "", Transport: transport_type ?? "", Timeout: connect_timeout ?? "" }), "MCP Connection", "cyan");
  }

  handle_mcp_connection_completed(server_name: string, server_url: string | null = null, transport_type: string | null = null, connection_duration_ms: number | null = null, is_reconnect = false): void {
    this.print_panel(this.create_status_content(is_reconnect ? "MCP Reconnected" : "MCP Connection Completed", server_name, "green", "", { URL: server_url ?? "", Transport: transport_type ?? "", Duration: connection_duration_ms ?? "" }), "MCP Connected", "green");
  }

  handle_mcp_connection_failed(server_name: string, server_url: string | null = null, transport_type: string | null = null, error = "", error_type: string | null = null): void {
    this.print_panel(this.create_status_content("MCP Connection Failed", server_name, "red", "", { URL: server_url ?? "", Transport: transport_type ?? "", ErrorType: error_type ?? "", Error: this.truncate(error, 500) }), "MCP Connection Failed", "red");
  }

  handle_mcp_config_fetch_failed(slug: string, error = "", error_type: string | null = null): void {
    this.print_panel(this.create_status_content("MCP Config Fetch Failed", slug, "red", "", { ErrorType: error_type ?? "", Error: this.truncate(error, 500) }), "MCP Config Failed", "red");
  }

  handle_mcp_tool_execution_started(server_name: string, tool_name: string, tool_args: Record<string, unknown> | null = null): void {
    this.print_panel(this.create_status_content("MCP Tool Started", tool_name, "yellow", tool_args ?? {}, { Server: server_name }), "MCP Tool Started", "yellow");
  }

  handle_mcp_tool_execution_failed(server_name: string, tool_name: string, tool_args: Record<string, unknown> | null = null, error = "", error_type: string | null = null): void {
    this.print_panel(this.create_status_content("MCP Tool Execution Failed", tool_name, "red", tool_args ?? {}, { Server: server_name, ErrorType: error_type ?? "", Error: this.truncate(error, 500) }), "MCP Tool Failed", "red");
  }

  handle_a2a_polling_started(task_id: string, polling_interval: number, endpoint: string): void {
    this.print_panel(this.create_status_content("A2A Polling Started", task_id.slice(0, 8), "cyan", "", { Interval: `${String(polling_interval)}s`, Endpoint: endpoint }), "A2A Polling", "cyan");
  }

  handle_a2a_polling_status(task_id: string, state: string, elapsed_seconds: number, poll_count: number): void {
    this.print_panel(this.create_status_content(`Poll #${String(poll_count)}`, task_id.slice(0, 8), state === "failed" ? "red" : "cyan", "", { Status: state, Elapsed: `${elapsed_seconds.toFixed(1)}s` }), `A2A Poll #${String(poll_count)}`, state === "failed" ? "red" : "cyan");
  }

  private truncate(value: unknown, maxLength: number): string {
    const text = this.formatConsoleValue(value);
    return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 3))}...` : text;
  }

  private formatConsoleValue(value: unknown): string {
    if (typeof value === "string") {
      return value;
    }
    if (value === null || value === undefined) {
      return "";
    }
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
      return value.toString();
    }
    try {
      return JSON.stringify(value);
    } catch {
      return Object.prototype.toString.call(value);
    }
  }
}

export const event_listener = EventListener.getInstance();

export class TraceCollectionListener extends BaseEventListener {
  readonly batchManager: TraceBatchManager;
  readonly batch_manager: TraceBatchManager;

  constructor(eventBus: EventBus = crewaiEventBus, batchManager = new TraceBatchManager()) {
    super(eventBus);
    this.batchManager = batchManager;
    this.batch_manager = batchManager;
  }

  setupListeners(_eventBus: EventBus): void {
    void _eventBus;
  }

  override setup_listeners(eventBus: EventBus): void {
    this.setupListeners(eventBus);
  }

  static _isInsideActiveFlowContext(): boolean {
    return getCurrentFlowId() !== null;
  }

  static _is_inside_active_flow_context(): boolean {
    return TraceCollectionListener._isInsideActiveFlowContext();
  }

  _nestedInFlowExecution(): boolean {
    return TraceCollectionListener._isInsideActiveFlowContext();
  }

  _nested_in_flow_execution(): boolean {
    return this._nestedInFlowExecution();
  }

  shouldFinalizeBatchForOwner(): boolean {
    if (this._nestedInFlowExecution()) {
      return false;
    }
    return (this.batchManager.batchOwnerType ?? this.batchManager.batch_owner_type) === "crew";
  }

  _should_finalize_batch_for_owner(): boolean {
    return this.shouldFinalizeBatchForOwner();
  }

  _handleActionEvent(_eventType: string, _source: unknown, event: BaseEvent): void {
    void event;
    if (!TraceCollectionListener._isInsideActiveFlowContext()) {
      return;
    }
    const flowId = getCurrentFlowId();
    const flowName = getCurrentFlowName();
    this.batchManager.batchOwnerType = "flow";
    this.batchManager.batch_owner_type = "flow";
    this.batchManager.batchOwnerId = flowId;
    this.batchManager.batch_owner_id = flowId;
    this.batchManager.initializeBatch(
      {},
      {
        execution_type: "flow",
        flow_name: flowName,
      },
    );
  }

  _handle_action_event(eventType: string, source: unknown, event: BaseEvent): void {
    this._handleActionEvent(eventType, source, event);
  }
}

export class FirstTimeTraceHandler {
  readonly enabled: boolean;
  isFirstTime = false;
  is_first_time = false;
  collectedEvents = false;
  collected_events = false;
  traceBatchId: string | null = null;
  trace_batch_id: string | null = null;
  ephemeralUrl: string | null = null;
  ephemeral_url: string | null = null;
  batchManager: TraceBatchManager | null = null;
  batch_manager: TraceBatchManager | null = null;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  initializeForFirstTimeUser(): boolean {
    this.isFirstTime = this.enabled && shouldAutoCollectFirstTimeTraces();
    this.is_first_time = this.isFirstTime;
    return this.isFirstTime;
  }

  initialize_for_first_time_user(): boolean {
    return this.initializeForFirstTimeUser();
  }

  setBatchManager(batchManager: TraceBatchManager): void {
    this.batchManager = batchManager;
    this.batch_manager = batchManager;
    this.traceBatchId = batchManager.traceBatchId;
    this.trace_batch_id = this.traceBatchId;
  }

  set_batch_manager(batch_manager: TraceBatchManager): void {
    this.setBatchManager(batch_manager);
  }

  markEventsCollected(): void {
    this.collectedEvents = true;
    this.collected_events = true;
  }

  mark_events_collected(): void {
    this.markEventsCollected();
  }

  handleExecutionCompletion(): void {
    if (!this.isFirstTime || !this.collectedEvents) {
      return;
    }
    try {
      const userConsented = promptUserForTraceViewing();
      if (userConsented) {
        this.captureLocalTraceSummary();
      }
      markFirstExecutionCompleted(userConsented);
    } catch {
      markFirstExecutionCompleted(false);
    }
  }

  handle_execution_completion(): void {
    this.handleExecutionCompletion();
  }

  private captureLocalTraceSummary(): void {
    const manager = this.batchManager;
    if (!manager) {
      return;
    }
    this.traceBatchId = manager.traceBatchId;
    this.trace_batch_id = this.traceBatchId;
    this.ephemeralUrl = manager.ephemeralTraceUrl;
    this.ephemeral_url = this.ephemeralUrl;
  }

  _resetBatchState(): void {
    const manager = this.batchManager;
    if (!manager) {
      return;
    }
    manager.batchOwnerType = null;
    manager.batch_owner_type = null;
    manager.batchOwnerId = null;
    manager.batch_owner_id = null;
    manager.deferSessionFinalization = false;
    manager.defer_session_finalization = false;
    manager.currentBatch = null;
    manager.current_batch = null;
    manager.eventBuffer.length = 0;
    manager.traceBatchId = null;
    manager.trace_batch_id = null;
    manager.isCurrentBatchEphemeral = false;
    manager.is_current_batch_ephemeral = false;
    manager.backendInitialized = false;
    manager.backend_initialized = false;
    manager.batchFinalized = false;
    manager.batch_finalized = false;
    manager._batch_finalized = false;
  }

  _reset_batch_state(): void {
    this._resetBatchState();
  }
}

export function resetEmissionSequence(): void {
  resetEmissionCounter();
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function extraEventOptions(options: Record<string, unknown>, knownKeys: readonly string[]): Record<string, unknown> {
  const known = new Set(knownKeys);
  return Object.fromEntries(Object.entries(options).filter(([key]) => !known.has(key)));
}

function getCrewSourceFingerprint(crew: unknown): string | null {
  return getStringProperty(getObjectProperty(crew, "fingerprint"), "uuid_str")
    ?? getStringProperty(getObjectProperty(crew, "fingerprint"), "uuidStr");
}

function getCrewFingerprintMetadata(crew: unknown): Record<string, unknown> | null {
  const fingerprint = getObjectProperty(crew, "fingerprint");
  return getRecordMetadata(fingerprint);
}

function getAgentSourceFingerprint(agent: unknown): string | null {
  return getStringProperty(getAgentFingerprint(agent), "uuid_str")
    ?? getStringProperty(getAgentFingerprint(agent), "uuidStr")
    ?? getStringProperty(agent, "id");
}

function getAgentFingerprintMetadata(agent: unknown): Record<string, unknown> | null {
  const fingerprint = getAgentFingerprint(agent);
  return getRecordMetadata(fingerprint);
}

function getAgentDirectSourceFingerprint(agent: unknown): string | null {
  return getStringProperty(getObjectProperty(agent, "fingerprint"), "uuid_str")
    ?? getStringProperty(getObjectProperty(agent, "fingerprint"), "uuidStr")
    ?? getStringProperty(agent, "id");
}

function getAgentDirectFingerprintMetadata(agent: unknown): Record<string, unknown> | null {
  return getRecordMetadata(getObjectProperty(agent, "fingerprint"));
}

function getRecordMetadata(fingerprint: unknown): Record<string, unknown> | null {
  if (!fingerprint || typeof fingerprint !== "object" || !("metadata" in fingerprint)) {
    return null;
  }
  const metadata = (fingerprint as Record<string, unknown>).metadata;
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : null;
}

function getAgentFingerprint(agent: unknown): unknown {
  const securityConfig = getObjectProperty(agent, "security_config") ?? getObjectProperty(agent, "securityConfig");
  return getObjectProperty(securityConfig, "fingerprint");
}

function inferA2ASourceType(options: A2ACommonEventOptions): string {
  if ((options.fromAgent ?? options.from_agent) !== undefined) {
    return "agent";
  }
  if ((options.fromTask ?? options.from_task) !== undefined) {
    return "task";
  }
  return "a2a";
}

function inferA2ASourceFingerprint(options: A2ACommonEventOptions): string | null {
  const agentId = getStringProperty(options.fromAgent ?? options.from_agent, "id");
  if (agentId !== null) {
    return agentId;
  }
  return getStringProperty(options.fromTask ?? options.from_task, "id");
}

function createA2AFingerprintMetadata(event: A2AEventBase): A2AEventMetadata | null {
  if (event.agentId !== null) {
    return { agent_id: event.agentId, agent_role: event.agentRole };
  }
  if (event.taskId !== null) {
    return { task_id: event.taskId, task_name: event.taskName };
  }
  return null;
}

function setA2ADefault(
  data: Record<string, unknown>,
  snakeKey: string,
  camelKey: string,
  value: unknown,
): void {
  if (data[snakeKey] !== undefined || data[camelKey] !== undefined) {
    return;
  }
  if (camelKey in data || "sourceType" in data || "sourceFingerprint" in data || "fingerprintMetadata" in data || "fromTask" in data || "fromAgent" in data) {
    data[camelKey] = value;
    return;
  }
  data[snakeKey] = value;
}

function getStringProperty(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object" || !(key in value)) {
    return null;
  }
  const property = (value as Record<string, unknown>)[key];
  if (property === null || property === undefined) {
    return null;
  }
  if (typeof property === "string") {
    return property;
  }
  if (typeof property === "number" || typeof property === "boolean" || typeof property === "bigint") {
    return property.toString();
  }
  return null;
}

function getNonEmptyStringProperty(value: unknown, key: string): string | null {
  const property = getStringProperty(value, key);
  return property && property.length > 0 ? property : null;
}

function getObjectProperty(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || !(key in value)) {
    return null;
  }
  return (value as Record<string, unknown>)[key];
}

function applyEventContext(event: CrewAIEvent): void {
  event.previousEventId ??= getLastEventId();
  event.triggeredByEventId ??= getTriggeringEventId();

  if (event.parentEventId === null) {
    if (SCOPE_ENDING_EVENTS.has(event.type)) {
      event.parentEventId = getEnclosingParentId();
      const popped = popEventScope();
      if (!popped) {
        handleEmptyPop(event.type);
      } else {
        const [startedEventId, startedEventType] = popped;
        event.startedEventId ??= startedEventId;
        const expectedStart = VALID_EVENT_PAIRS[event.type];
        if (expectedStart && startedEventType && startedEventType !== expectedStart) {
          handleMismatch(event.type, startedEventType, expectedStart);
        }
      }
    } else if (SCOPE_STARTING_EVENTS.has(event.type)) {
      event.parentEventId = getCurrentParentId();
      pushEventScope(event.eventId, event.type);
    } else {
      event.parentEventId = getCurrentParentId();
    }
  }

  setLastEventId(event.eventId);
}
