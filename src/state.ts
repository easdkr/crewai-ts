import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, mkdirSync, openSync, readFileSync, readSync, closeSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve, sep, basename, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

import {
  CheckpointCompletedEvent,
  CheckpointFailedEvent,
  CheckpointForkCompletedEvent,
  CheckpointForkStartedEvent,
  CheckpointRestoreCompletedEvent,
  CheckpointRestoreFailedEvent,
  CheckpointRestoreStartedEvent,
  CheckpointStartedEvent,
  CheckpointPrunedEvent,
  crewaiEventBus,
  is_replaying,
  BaseEvent,
  type EventType,
} from "./events.js";
import { __version__ } from "./version.js";
import { captureExecutionContext } from "./context.js";

const requireNodeBuiltin = createRequire(import.meta.url);
let cachedDatabaseSync: typeof import("node:sqlite").DatabaseSync | null = null;
let checkpointHandlersRegistered = false;
const CHECKPOINT_SENTINEL = Symbol("checkpoint-opt-out");

export type CheckpointEventType = EventType | "lite_agent_execution_started" | "lite_agent_execution_completed" | "lite_agent_execution_error";
export const CheckpointEventType = Object.freeze({ kind: "CheckpointEventType" });

export type CheckpointTrigger = CheckpointEventType | "*";

export const _event_type_map: Record<string, typeof BaseEvent> = {};

export function buildEventTypeMap(): Record<string, typeof BaseEvent> {
  if (Object.keys(_event_type_map).length === 0) {
    for (const eventType of checkpointEventTypes()) {
      _event_type_map[eventType] = BaseEvent;
    }
  }
  return _event_type_map;
}

export const _build_event_type_map = buildEventTypeMap;

export function resolveEvent(value: unknown): BaseEvent {
  if (value instanceof BaseEvent) {
    return value;
  }
  const record = isRecord(value) ? value : {};
  buildEventTypeMap();
  const type = typeof record.type === "string" ? record.type : "default_env";
  const event = new BaseEvent({
    type: type as EventType,
    sourceType: typeof record.sourceType === "string"
      ? record.sourceType
      : typeof record.source_type === "string" ? record.source_type : null,
    sourceFingerprint: typeof record.sourceFingerprint === "string"
      ? record.sourceFingerprint
      : typeof record.source_fingerprint === "string" ? record.source_fingerprint : null,
    parentEventId: typeof record.parentEventId === "string"
      ? record.parentEventId
      : typeof record.parent_event_id === "string" ? record.parent_event_id : null,
    previousEventId: typeof record.previousEventId === "string"
      ? record.previousEventId
      : typeof record.previous_event_id === "string" ? record.previous_event_id : null,
    triggeredByEventId: typeof record.triggeredByEventId === "string"
      ? record.triggeredByEventId
      : typeof record.triggered_by_event_id === "string" ? record.triggered_by_event_id : null,
    startedEventId: typeof record.startedEventId === "string"
      ? record.startedEventId
      : typeof record.started_event_id === "string" ? record.started_event_id : null,
  });
  applySerializedEventFields(event, record);
  return event;
}

export const _resolve_event = resolveEvent;

function applySerializedEventFields(event: BaseEvent, record: Record<string, unknown>): void {
  const writableEvent = event as unknown as {
    timestamp: Date;
    eventId: string;
    emissionSequence: number;
  };
  const eventId = stringField(record, "eventId", "event_id");
  if (eventId) {
    writableEvent.eventId = eventId;
  }
  const timestamp = record.timestamp;
  if (typeof timestamp === "string") {
    const parsed = new Date(timestamp);
    if (!Number.isNaN(parsed.getTime())) {
      writableEvent.timestamp = parsed;
    }
  }
  const emissionSequence = numberField(record, "emissionSequence", "emission_sequence");
  if (emissionSequence !== null) {
    writableEvent.emissionSequence = emissionSequence;
  }
  event.sourceType = stringField(record, "sourceType", "source_type");
  event.sourceFingerprint = stringField(record, "sourceFingerprint", "source_fingerprint");
  event.fingerprintMetadata = recordField(record, "fingerprintMetadata", "fingerprint_metadata");
  event.fingerprint_metadata = event.fingerprintMetadata;
  event.taskId = stringField(record, "taskId", "task_id");
  event.task_id = event.taskId;
  event.taskName = stringField(record, "taskName", "task_name");
  event.task_name = event.taskName;
  event.agentId = stringField(record, "agentId", "agent_id");
  event.agent_id = event.agentId;
  event.agentRole = stringField(record, "agentRole", "agent_role");
  event.agent_role = event.agentRole;
}

function checkpointEventTypes(): EventType[] {
  return [
    "crew_kickoff_started",
    "crew_kickoff_completed",
    "crew_kickoff_failed",
    "task_started",
    "task_completed",
    "task_failed",
    "agent_execution_started",
    "agent_execution_completed",
    "agent_execution_error",
    "flow_started",
    "flow_finished",
    "llm_call_started",
    "llm_call_completed",
    "llm_call_failed",
    "tool_usage_started",
    "tool_usage_finished",
    "tool_usage_error",
    "mcp_connection_started",
    "mcp_connection_completed",
    "mcp_connection_failed",
    "default_env",
  ];
}

export function _ensure_handlers_registered(): void {
  if (checkpointHandlersRegistered) {
    return;
  }
  _register_all_handlers(crewaiEventBus);
  checkpointHandlersRegistered = true;
}

function resolveCheckpointValue(value: unknown): CheckpointConfig | typeof CHECKPOINT_SENTINEL | null {
  if (value instanceof CheckpointConfig) {
    _ensure_handlers_registered();
    return value;
  }
  if (value === true) {
    _ensure_handlers_registered();
    return new CheckpointConfig();
  }
  if (value === false) {
    return CHECKPOINT_SENTINEL;
  }
  return null;
}

export function _resolve_from_agent(agent: unknown): CheckpointConfig | null {
  if (!isRecord(agent)) {
    return null;
  }
  const result = resolveCheckpointValue(agent.checkpoint);
  if (result instanceof CheckpointConfig) {
    return result;
  }
  if (result === CHECKPOINT_SENTINEL) {
    return null;
  }
  const crew = agent.crew;
  if (!isRecord(crew)) {
    return null;
  }
  const crewResult = resolveCheckpointValue(crew.checkpoint);
  return crewResult instanceof CheckpointConfig ? crewResult : null;
}

export function _find_checkpoint(source: unknown): CheckpointConfig | null {
  if (!isRecord(source)) {
    return null;
  }
  if ("checkpoint" in source) {
    const result = resolveCheckpointValue(source.checkpoint);
    if (result instanceof CheckpointConfig) {
      return result;
    }
    if (result === CHECKPOINT_SENTINEL) {
      return null;
    }
  }
  if (isRecord(source.agent)) {
    return _resolve_from_agent(source.agent);
  }
  return null;
}

export function _do_checkpoint(state: RuntimeState, cfg: CheckpointConfig, event: BaseEvent | null = null): void {
  const providerName = cfg.provider.constructor.name;
  const trigger = event?.type ?? null;
  const parentIdSnapshot = state.parentId;
  const branchSnapshot = state.branch;
  crewaiEventBus.emit(cfg, new CheckpointStartedEvent({
    location: cfg.location,
    provider: providerName,
    trigger,
    branch: branchSnapshot,
    parent_id: parentIdSnapshot,
  }));

  const startedAt = Date.now();
  try {
    _prepare_entities(state.root.filter((entity): entity is object => typeof entity === "object" && entity !== null));
    const payload = state._serialize();
    if (event) {
      payload.trigger = event.type;
    }
    const location = cfg.provider.checkpoint(JSON.stringify(payload), cfg.location, {
      parentId: parentIdSnapshot,
      parent_id: parentIdSnapshot,
      branch: branchSnapshot,
    });
    if (typeof location !== "string") {
      throw new Error("Provider returned a Promise from synchronous checkpoint(). Use acheckpoint() instead.");
    }
    state._chain_lineage(cfg.provider, location);
    const checkpointId = cfg.provider.extract_id(location);
    crewaiEventBus.emit(cfg, new CheckpointCompletedEvent({
      location,
      provider: providerName,
      trigger,
      branch: branchSnapshot,
      parent_id: parentIdSnapshot,
      checkpoint_id: checkpointId,
      duration_ms: Date.now() - startedAt,
    }));
    if (cfg.max_checkpoints !== null) {
      const removedCount = cfg.provider.prune(cfg.location, cfg.max_checkpoints, { branch: branchSnapshot });
      if (typeof removedCount !== "number") {
        throw new Error("Provider returned a Promise from synchronous prune().");
      }
      crewaiEventBus.emit(cfg, new CheckpointPrunedEvent({
        location: cfg.location,
        provider: providerName,
        trigger,
        branch: branchSnapshot,
        parent_id: parentIdSnapshot,
        removed_count: removedCount,
        max_checkpoints: cfg.max_checkpoints,
      }));
    }
  } catch (error) {
    crewaiEventBus.emit(cfg, new CheckpointFailedEvent({
      location: cfg.location,
      provider: providerName,
      trigger,
      branch: branchSnapshot,
      parent_id: parentIdSnapshot,
      error,
    }));
    throw error;
  }
}

export function _should_checkpoint(source: unknown, event: BaseEvent): CheckpointConfig | null {
  const cfg = _find_checkpoint(source);
  if (!cfg) {
    return null;
  }
  if (!cfg.trigger_all && !cfg.trigger_events.has(event.type)) {
    return null;
  }
  return cfg;
}

export function _on_any_event(source: unknown, event: BaseEvent, state: unknown = null): void {
  if (is_replaying() || event.type.startsWith("checkpoint_")) {
    return;
  }
  const cfg = _should_checkpoint(source, event);
  if (!cfg) {
    return;
  }
  const runtime = state instanceof RuntimeState
    ? state
    : crewaiEventBus.runtimeState ?? new RuntimeState({
      root: source && typeof source === "object" ? [source] : [],
      provider: cfg.provider,
    });
  _do_checkpoint(runtime, cfg, event);
}

export function _register_all_handlers(event_bus: typeof crewaiEventBus): void {
  for (const eventType of checkpointEventTypes()) {
    if (!eventType.startsWith("checkpoint_")) {
      event_bus.register_handler(eventType, _on_any_event);
    }
  }
}

export type EdgeType =
  | "parent"
  | "child"
  | "trigger"
  | "triggered_by"
  | "next"
  | "previous"
  | "started"
  | "completed_by";
export const EdgeType = Object.freeze([
  "parent",
  "child",
  "trigger",
  "triggered_by",
  "next",
  "previous",
  "started",
  "completed_by",
] as const);

export class EventNode {
  readonly event: BaseEvent;
  readonly edges: Record<string, string[]>;

  constructor(options: { event: BaseEvent | Record<string, unknown>; edges?: Record<string, readonly string[]> }) {
    this.event = options.event instanceof BaseEvent ? options.event : resolveEvent(options.event);
    this.edges = Object.fromEntries(
      Object.entries(options.edges ?? {}).map(([key, value]) => [key, [...value]]),
    );
  }

  addEdge(edgeType: EdgeType, targetId: string): void {
    this.edges[edgeType] ??= [];
    if (!this.edges[edgeType].includes(targetId)) {
      this.edges[edgeType].push(targetId);
    }
  }

  add_edge(edgeType: EdgeType, targetId: string): void {
    this.addEdge(edgeType, targetId);
  }

  neighbors(edgeType: EdgeType): string[] {
    return [...(this.edges[edgeType] ?? [])];
  }

  toJSON(): Record<string, unknown> {
    return {
      event: this.event.toJSON(),
      edges: this.edges,
    };
  }

  modelDump(): Record<string, unknown> {
    return this.toJSON();
  }

  model_dump(): Record<string, unknown> {
    return this.modelDump();
  }
}

export class EventRecord {
  nodes: Record<string, EventNode>;

  constructor(options: { nodes?: Record<string, EventNode | { event: BaseEvent | Record<string, unknown>; edges?: Record<string, readonly string[]> }> } = {}) {
    this.nodes = {};
    for (const [id, node] of Object.entries(options.nodes ?? {})) {
      this.nodes[id] = node instanceof EventNode ? node : new EventNode(node);
    }
  }

  add(event: BaseEvent): EventNode {
    const node = new EventNode({ event });
    this.nodes[event.eventId] = node;

    const parentNode = event.parentEventId ? this.nodes[event.parentEventId] : undefined;
    if (event.parentEventId && parentNode) {
      node.addEdge("parent", event.parentEventId);
      parentNode.addEdge("child", event.eventId);
    }

    const triggeredByNode = event.triggeredByEventId ? this.nodes[event.triggeredByEventId] : undefined;
    if (event.triggeredByEventId && triggeredByNode) {
      node.addEdge("triggered_by", event.triggeredByEventId);
      triggeredByNode.addEdge("trigger", event.eventId);
    }

    const previousNode = event.previousEventId ? this.nodes[event.previousEventId] : undefined;
    if (event.previousEventId && previousNode) {
      node.addEdge("previous", event.previousEventId);
      previousNode.addEdge("next", event.eventId);
    }

    const startedNode = event.startedEventId ? this.nodes[event.startedEventId] : undefined;
    if (event.startedEventId && startedNode) {
      node.addEdge("started", event.startedEventId);
      startedNode.addEdge("completed_by", event.eventId);
    }

    return node;
  }

  get(eventId: string): EventNode | null {
    return this.nodes[eventId] ?? null;
  }

  descendants(eventId: string): EventNode[] {
    const result: EventNode[] = [];
    const queue = [eventId];
    const visited = new Set<string>();
    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId || visited.has(currentId)) {
        continue;
      }
      visited.add(currentId);
      const node = this.nodes[currentId];
      if (!node) {
        continue;
      }
      for (const childId of node.neighbors("child")) {
        if (!visited.has(childId)) {
          const child = this.nodes[childId];
          if (child) {
            result.push(child);
            queue.push(childId);
          }
        }
      }
    }
    return result;
  }

  roots(): EventNode[] {
    return Object.values(this.nodes).filter((node) => node.neighbors("parent").length === 0);
  }

  allNodes(): EventNode[] {
    return Object.values(this.nodes);
  }

  all_nodes(): EventNode[] {
    return this.allNodes();
  }

  clear(): void {
    this.nodes = {};
  }

  has(eventId: string): boolean {
    return eventId in this.nodes;
  }

  __contains__(eventId: string): boolean {
    return this.has(eventId);
  }

  get size(): number {
    return Object.keys(this.nodes).length;
  }

  __len__(): number {
    return this.size;
  }

  toJSON(): Record<string, unknown> {
    return { nodes: this.nodes };
  }

  modelDump(): Record<string, unknown> {
    return this.toJSON();
  }

  model_dump(): Record<string, unknown> {
    return this.modelDump();
  }

  modelDumpJson(): string {
    return JSON.stringify(this.modelDump());
  }

  model_dump_json(): string {
    return this.modelDumpJson();
  }

  static modelValidateJson(value: string): EventRecord {
    const parsed = JSON.parse(value) as unknown;
    const record = isRecord(parsed) ? parsed : {};
    const nodes = isRecord(record.nodes) ? record.nodes : {};
    const restoredNodes: Record<string, EventNode> = {};
    for (const [id, node] of Object.entries(nodes)) {
      if (!isRecord(node)) {
        continue;
      }
      const event = isRecord(node.event) ? node.event : {};
      const edges = normalizeEdgeRecord(node.edges);
      restoredNodes[id] = new EventNode({ event, edges });
    }
    return new EventRecord({ nodes: restoredNodes });
  }

  static model_validate_json(value: string): EventRecord {
    return EventRecord.modelValidateJson(value);
  }
}

export type RuntimeStateOptions = {
  root?: readonly unknown[];
  entities?: readonly unknown[];
  provider?: BaseProvider;
  eventRecord?: EventRecord;
  event_record?: EventRecord;
  checkpointId?: string | null;
  checkpoint_id?: string | null;
  parentId?: string | null;
  parent_id?: string | null;
  branch?: string;
  crewaiVersion?: string;
  crewai_version?: string;
};

type MutableRecord = Record<string, unknown>;

export function _sync_checkpoint_fields(entity: object): void {
  const record = entity as MutableRecord;
  const privateKickoffId = record._kickoff_event_id;
  if (typeof privateKickoffId === "string") {
    record.checkpointKickoffEventId = privateKickoffId;
    record.checkpoint_kickoff_event_id = privateKickoffId;
  }

  const copyState = record._copy_and_serialize_state ?? record._copyAndSerializeState;
  if (typeof copyState === "function") {
    const completedMethods = normalizeRuntimeSet(record.completedMethods ?? record.runtimeCompletedMethods);
    const methodOutputs = normalizeRuntimeArray(record.methodOutputs ?? record.method_outputs ?? record.runtimeMethodOutputs);
    const methodCounts = normalizeRuntimeMap(record.methodExecutionCounts ?? record.runtimeMethodExecutionCounts);
    record.checkpoint_completed_methods = completedMethods.length > 0 ? completedMethods : null;
    record.checkpoint_method_outputs = methodOutputs.length > 0 ? methodOutputs : null;
    record.checkpoint_method_counts = Object.keys(methodCounts).length > 0 ? methodCounts : null;
    record.checkpoint_state = copyState.call(entity);
  }

  if (Array.isArray(record.tasks)) {
    if (isRecord(record._inputs)) {
      record.checkpointInputs = { ...record._inputs };
      record.checkpoint_inputs = { ...record._inputs };
    }
    if (typeof record._train === "boolean") {
      record.checkpointTrain = record._train;
      record.checkpoint_train = record._train;
    }
    for (const task of record.tasks) {
      if (!isRecord(task)) {
        continue;
      }
      const originalDescription = task._original_description ?? task.originalDescription ?? task.description;
      if (typeof originalDescription === "string") {
        task.checkpointOriginalDescription = originalDescription;
        task.checkpoint_original_description = originalDescription;
      }
      const originalExpectedOutput = task._original_expected_output ?? task.originalExpectedOutput ?? task.expectedOutput ?? task.expected_output;
      if (typeof originalExpectedOutput === "string") {
        task.checkpointOriginalExpectedOutput = originalExpectedOutput;
        task.checkpoint_original_expected_output = originalExpectedOutput;
      }
    }
  }
}

export function _backfill_memory_kind(value: unknown): void {
  if (!isRecord(value) || "memory_kind" in value) {
    return;
  }
  if ("scopes" in value) {
    value.memory_kind = "slice";
  } else if ("root_path" in value) {
    value.memory_kind = "scope";
  } else {
    value.memory_kind = "memory";
  }
}

export function _backfill_source_type(source: unknown): void {
  if (!isRecord(source) || "source_type" in source) {
    return;
  }
  if (typeof source.content === "string") {
    source.source_type = "string";
    return;
  }
  throw new Error(
    "Legacy knowledge source is missing 'source_type' and could not be inferred during migration. Re-checkpoint after upgrading to 1.14.6+.",
  );
}

export function _backfill_sources_on(container: unknown): void {
  if (!isRecord(container)) {
    return;
  }
  for (const key of ["sources", "knowledge_sources"]) {
    const sources = container[key];
    if (!Array.isArray(sources)) {
      continue;
    }
    for (const source of sources) {
      _backfill_source_type(source);
    }
  }
}

export function _backfill_discriminators(entity: unknown): void {
  if (!isRecord(entity)) {
    return;
  }
  _backfill_memory_kind(entity.memory);
  _backfill_sources_on(entity);
  _backfill_sources_on(entity.knowledge);
  const agents = entity.agents;
  if (!Array.isArray(agents)) {
    return;
  }
  for (const agent of agents) {
    if (!isRecord(agent)) {
      continue;
    }
    _backfill_memory_kind(agent.memory);
    _backfill_sources_on(agent);
    _backfill_sources_on(agent.knowledge);
  }
}

export function _prepare_entities(root: readonly object[]): void {
  for (const entity of root) {
    (entity as MutableRecord).executionContext = captureExecutionContext();
    (entity as MutableRecord).execution_context = (entity as MutableRecord).executionContext;
    _sync_checkpoint_fields(entity);
  }
}

function migrateRuntimeStateData(data: Record<string, unknown>): Record<string, unknown> {
  const entities = data.entities;
  if (Array.isArray(entities)) {
    for (const entity of entities) {
      _backfill_discriminators(entity);
    }
  }
  return data;
}

function normalizeRuntimeStateData(data: unknown): Record<string, unknown> {
  if (Array.isArray(data)) {
    for (const entity of data) {
      _backfill_discriminators(entity);
    }
    return { entities: data };
  }
  return isRecord(data) ? migrateRuntimeStateData(data) : {};
}

function deserializeEventRecord(data: Record<string, unknown>): EventRecord {
  const record = data.event_record ?? data.eventRecord;
  if (record instanceof EventRecord) {
    return record;
  }
  if (!record) {
    return new EventRecord();
  }
  return EventRecord.modelValidateJson(JSON.stringify(record));
}

export class RuntimeState {
  root: unknown[];
  private provider: BaseProvider;
  private readonly runtimeEventRecord: EventRecord;
  checkpointId: string | null;
  checkpoint_id: string | null;
  parentId: string | null;
  parent_id: string | null;
  branch: string;

  constructor(options: RuntimeStateOptions = {}) {
    this.root = [...(options.root ?? options.entities ?? [])];
    this.provider = options.provider ?? new JsonProvider();
    this.runtimeEventRecord = options.eventRecord ?? options.event_record ?? new EventRecord();
    this.checkpointId = options.checkpointId ?? options.checkpoint_id ?? null;
    this.checkpoint_id = this.checkpointId;
    this.parentId = options.parentId ?? options.parent_id ?? null;
    this.parent_id = this.parentId;
    this.branch = options.branch ?? "main";
  }

  get eventRecord(): EventRecord {
    return this.runtimeEventRecord;
  }

  get event_record(): EventRecord {
    return this.eventRecord;
  }

  get providerType(): string {
    return this.provider.providerType;
  }

  setProvider(provider: BaseProvider): void {
    this.provider = provider;
  }

  set_provider(provider: BaseProvider): void {
    this.setProvider(provider);
  }

  checkpoint(location: string): string {
    const { providerName, parentId, branch, startedAt } = this.beginCheckpoint(location);
    try {
      const result = this.provider.checkpoint(this.toJSONText(), location, {
        parentId,
        branch,
      });
      if (typeof result !== "string") {
        throw new Error("Provider returned a Promise from synchronous checkpoint(). Use acheckpoint() instead.");
      }
      this.chainLineage(result);
      this.emitCheckpointCompleted(result, providerName, parentId, branch, startedAt);
      return result;
    } catch (error) {
      this.emitCheckpointFailed(location, providerName, parentId, branch, error);
      throw error;
    }
  }

  async acheckpoint(location: string): Promise<string> {
    const { providerName, parentId, branch, startedAt } = this.beginCheckpoint(location);
    try {
      const result = await this.provider.acheckpoint(this.toJSONText(), location, {
        parentId,
        branch,
      });
      this.chainLineage(result);
      this.emitCheckpointCompleted(result, providerName, parentId, branch, startedAt);
      return result;
    } catch (error) {
      this.emitCheckpointFailed(location, providerName, parentId, branch, error);
      throw error;
    }
  }

  fork(branch?: string): string {
    const parentBranch = this.branch;
    const parentCheckpointId = this.checkpointId;
    const suffix = randomUUID().replaceAll("-", "").slice(0, this.checkpointId ? 6 : 8);
    const newBranch = branch ?? (this.checkpointId
      ? `fork/${this.checkpointId}_${suffix}`
      : `fork/${suffix}`);
    crewaiEventBus.emit(this, new CheckpointForkStartedEvent({
      branch: newBranch,
      parent_branch: parentBranch,
      parent_checkpoint_id: parentCheckpointId,
    }));
    this.branch = newBranch;
    crewaiEventBus.emit(this, new CheckpointForkCompletedEvent({
      branch: newBranch,
      parent_branch: parentBranch,
      parent_checkpoint_id: parentCheckpointId,
    }));
    return this.branch;
  }

  toJSON(): Record<string, unknown> {
    _prepare_entities(this.root.filter((entity): entity is object => typeof entity === "object" && entity !== null));
    return {
      crewai_version: __version__,
      parent_id: this.parentId,
      branch: this.branch,
      entities: this.root.map((entity) => serializeRuntimeEntity(entity)),
      event_record: this.eventRecord.toJSON(),
    };
  }

  _serialize(): Record<string, unknown> {
    return this.toJSON();
  }

  toJSONText(): string {
    return JSON.stringify(this.toJSON());
  }

  to_json(): string {
    return this.toJSONText();
  }

  static fromJSONText(raw: string, provider: BaseProvider = new JsonProvider()): RuntimeState {
    const parsed = normalizeRuntimeStateData(JSON.parse(raw) as unknown);
    const state = new RuntimeState({
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      provider,
      eventRecord: deserializeEventRecord(parsed),
      parentId: typeof parsed.parent_id === "string" ? parsed.parent_id : null,
      branch: typeof parsed.branch === "string" ? parsed.branch : "main",
    });
    return state;
  }

  static _deserialize(data: unknown, provider: BaseProvider = new JsonProvider()): RuntimeState {
    if (typeof data === "string") {
      return RuntimeState.fromJSONText(data, provider);
    }
    const record = normalizeRuntimeStateData(data);
    return new RuntimeState({
      entities: Array.isArray(record.entities) ? record.entities : Array.isArray(record.root) ? record.root : [],
      provider,
      eventRecord: deserializeEventRecord(record),
      parentId: typeof record.parent_id === "string" ? record.parent_id : typeof record.parentId === "string" ? record.parentId : null,
      branch: typeof record.branch === "string" ? record.branch : "main",
    });
  }

  static from_json(raw: string, provider: BaseProvider = new JsonProvider()): RuntimeState {
    return RuntimeState.fromJSONText(raw, provider);
  }

  static async fromCheckpoint(config: CheckpointConfig, provider?: BaseProvider): Promise<RuntimeState> {
    if (!config.restoreFrom) {
      throw new Error("CheckpointConfig.restoreFrom is required to restore RuntimeState.");
    }
    const location = config.restoreFrom;
    crewaiEventBus.emit(config, new CheckpointRestoreStartedEvent({ location }));
    const startedAt = Date.now();
    let effectiveProvider: BaseProvider | null = null;
    try {
      effectiveProvider = provider ?? detectProvider(location);
      const raw = await effectiveProvider.afromCheckpoint(location);
      const state = RuntimeState.fromJSONText(raw, effectiveProvider);
      const checkpointId = effectiveProvider.extractId(location);
      state.checkpointId = checkpointId;
      state.checkpoint_id = checkpointId;
      state.parentId = checkpointId;
      state.parent_id = checkpointId;
      crewaiEventBus.emit(config, new CheckpointRestoreCompletedEvent({
        location,
        provider: effectiveProvider.constructor.name,
        checkpoint_id: checkpointId,
        branch: state.branch,
        parent_id: state.parentId,
        duration_ms: Date.now() - startedAt,
      }));
      return state;
    } catch (error) {
      crewaiEventBus.emit(config, new CheckpointRestoreFailedEvent({
        location,
        provider: effectiveProvider?.constructor.name ?? null,
        error,
      }));
      throw error;
    }
  }

  static async from_checkpoint(config: CheckpointConfig, provider?: BaseProvider): Promise<RuntimeState> {
    return await RuntimeState.fromCheckpoint(config, provider);
  }

  static async afromCheckpoint(config: CheckpointConfig, provider?: BaseProvider): Promise<RuntimeState> {
    return await RuntimeState.fromCheckpoint(config, provider);
  }

  static async afrom_checkpoint(config: CheckpointConfig, provider?: BaseProvider): Promise<RuntimeState> {
    return await RuntimeState.afromCheckpoint(config, provider);
  }

  private chainLineage(location: string): void {
    this._chain_lineage(this.provider, location);
  }

  _chain_lineage(provider: BaseProvider, location: string): void {
    const checkpointId = provider.extractId(location);
    this.checkpointId = checkpointId;
    this.checkpoint_id = checkpointId;
    this.parentId = checkpointId;
    this.parent_id = checkpointId;
  }

  private beginCheckpoint(location: string): { providerName: string; parentId: string | null; branch: string; startedAt: number } {
    const [providerName, parentId, branch, startedAt] = this._begin_checkpoint(location);
    return { providerName, parentId, branch, startedAt };
  }

  _begin_checkpoint(location: string): [string, string | null, string, number] {
    const providerName = this.provider.constructor.name;
    const parentId = this.parentId;
    const branch = this.branch;
    crewaiEventBus.emit(this, new CheckpointStartedEvent({
      location,
      provider: providerName,
      branch,
      parent_id: parentId,
    }));
    return [providerName, parentId, branch, Date.now()];
  }

  private emitCheckpointCompleted(
    location: string,
    providerName: string,
    parentId: string | null,
    branch: string,
    startedAt: number,
  ): void {
    this._emit_checkpoint_completed(location, providerName, branch, parentId, startedAt);
  }

  _emit_checkpoint_completed(
    result: string,
    providerName: string,
    branchSnapshot: string,
    parentIdSnapshot: string | null,
    startedAt: number,
  ): void {
    crewaiEventBus.emit(this, new CheckpointCompletedEvent({
      location: result,
      provider: providerName,
      checkpoint_id: this.provider.extractId(result),
      duration_ms: Date.now() - startedAt,
      branch: branchSnapshot,
      parent_id: parentIdSnapshot,
    }));
  }

  private emitCheckpointFailed(
    location: string,
    providerName: string,
    parentId: string | null,
    branch: string,
    error: unknown,
  ): void {
    this._emit_checkpoint_failed(location, providerName, branch, parentId, error);
  }

  _emit_checkpoint_failed(
    location: string,
    providerName: string,
    branchSnapshot: string,
    parentIdSnapshot: string | null,
    error: unknown,
  ): void {
    crewaiEventBus.emit(this, new CheckpointFailedEvent({
      location,
      provider: providerName,
      error,
      branch: branchSnapshot,
      parent_id: parentIdSnapshot,
    }));
  }
}

export type CheckpointProviderOptions = {
  parentId?: string | null;
  parent_id?: string | null;
  branch?: string;
};

export abstract class BaseProvider {
  abstract readonly providerType: string;
  abstract readonly provider_type: string;
  abstract checkpoint(data: string, location: string, options?: CheckpointProviderOptions): string | Promise<string>;
  abstract acheckpoint(data: string, location: string, options?: CheckpointProviderOptions): Promise<string>;
  abstract prune(location: string, maxKeep: number, options?: { branch?: string }): number | Promise<number>;
  abstract extractId(location: string): string;
  abstract extract_id(location: string): string;
  abstract fromCheckpoint(location: string): string | Promise<string>;
  abstract from_checkpoint(location: string): string | Promise<string>;
  abstract afromCheckpoint(location: string): Promise<string>;
  abstract afrom_checkpoint(location: string): Promise<string>;
}

export class JsonProvider implements BaseProvider {
  readonly providerType = "json";
  readonly provider_type = "json";

  checkpoint(data: string, location: string, options: CheckpointProviderOptions = {}): string {
    const branch = options.branch ?? "main";
    const parentId = options.parentId ?? options.parent_id ?? null;
    const path = buildCheckpointPath(location, branch, parentId);
    mkdirSyncForFile(path);
    writeFileSyncUtf8(path, data);
    return path;
  }

  async acheckpoint(data: string, location: string, options: CheckpointProviderOptions = {}): Promise<string> {
    const branch = options.branch ?? "main";
    const parentId = options.parentId ?? options.parent_id ?? null;
    const path = buildCheckpointPath(location, branch, parentId);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data, "utf8");
    return path;
  }

  prune(location: string, maxKeep: number, options: { branch?: string } = {}): number {
    const branch = options.branch ?? "main";
    assertSafeBranch(location, branch);
    const branchDir = join(location, branch);
    if (!existsSync(branchDir)) {
      return 0;
    }
    const files = readdirSync(branchDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => join(branchDir, entry.name))
      .sort((left, right) => statSync(left).mtimeMs - statSync(right).mtimeMs);
    const removable = maxKeep === 0 ? files : files.slice(0, Math.max(0, files.length - maxKeep));
    for (const file of removable) {
      rmSync(file, { force: true });
    }
    return removable.length;
  }

  extractId(location: string): string {
    const stem = basename(location, extname(location));
    const marker = stem.indexOf("_p-");
    return marker === -1 ? stem : stem.slice(0, marker);
  }

  extract_id(location: string): string {
    return this.extractId(location);
  }

  fromCheckpoint(location: string): string {
    return readFileSync(location, "utf8");
  }

  from_checkpoint(location: string): string {
    return this.fromCheckpoint(location);
  }

  async afromCheckpoint(location: string): Promise<string> {
    return await readFile(location, "utf8");
  }

  afrom_checkpoint(location: string): Promise<string> {
    return this.afromCheckpoint(location);
  }
}

export class SqliteProvider implements BaseProvider {
  readonly providerType = "sqlite";
  readonly provider_type = "sqlite";

  checkpoint(data: string, location: string, options: CheckpointProviderOptions = {}): string {
    const branch = options.branch ?? "main";
    const parentId = options.parentId ?? options.parent_id ?? null;
    const canonicalData = canonicalizeSqliteCheckpointJSON(data);
    const { checkpointId, timestamp } = makeCheckpointId();
    mkdirSync(dirname(location), { recursive: true });
    const db = new (databaseSync())(location);
    try {
      db.exec("PRAGMA journal_mode=WAL");
      db.exec(CREATE_CHECKPOINTS_TABLE);
      db.prepare("INSERT INTO checkpoints (id, created_at, parent_id, branch, data) VALUES (?, ?, ?, ?, ?)")
        .run(checkpointId, timestamp, parentId, branch, canonicalData);
    } finally {
      db.close();
    }
    return `${location}#${checkpointId}`;
  }

  async acheckpoint(data: string, location: string, options: CheckpointProviderOptions = {}): Promise<string> {
    return await Promise.resolve(this.checkpoint(data, location, options));
  }

  prune(location: string, maxKeep: number, options: { branch?: string } = {}): number {
    const branch = options.branch ?? "main";
    const db = new (databaseSync())(location);
    try {
      db.exec(CREATE_CHECKPOINTS_TABLE);
      const ids = db.prepare("SELECT id FROM checkpoints WHERE branch = ? ORDER BY rowid DESC")
        .all(branch)
        .map((row) => String((row as { id: unknown }).id));
      const removable = maxKeep === 0 ? ids : ids.slice(maxKeep);
      const deleteStatement = db.prepare("DELETE FROM checkpoints WHERE id = ?");
      for (const id of removable) {
        deleteStatement.run(id);
      }
      return removable.length;
    } finally {
      db.close();
    }
  }

  extractId(location: string): string {
    const marker = location.lastIndexOf("#");
    return marker === -1 ? location : location.slice(marker + 1);
  }

  extract_id(location: string): string {
    return this.extractId(location);
  }

  fromCheckpoint(location: string): string {
    const { dbPath, checkpointId } = splitSqliteLocation(location);
    const db = new (databaseSync())(dbPath, { readOnly: true });
    try {
      const row = db.prepare("SELECT data FROM checkpoints WHERE id = ?").get(checkpointId) as { data: unknown } | undefined;
      if (!row) {
        throw new Error(`Checkpoint not found: ${checkpointId}`);
      }
      return canonicalizeSqliteCheckpointJSON(String(row.data));
    } finally {
      db.close();
    }
  }

  from_checkpoint(location: string): string {
    return this.fromCheckpoint(location);
  }

  async afromCheckpoint(location: string): Promise<string> {
    return await Promise.resolve(this.fromCheckpoint(location));
  }

  async afrom_checkpoint(location: string): Promise<string> {
    return this.afromCheckpoint(location);
  }
}

export type CheckpointConfigOptions = {
  location?: string;
  onEvents?: readonly CheckpointTrigger[];
  on_events?: readonly CheckpointTrigger[];
  provider?: BaseProvider;
  maxCheckpoints?: number | null;
  max_checkpoints?: number | null;
  restoreFrom?: string | null;
  restore_from?: string | null;
};

export class CheckpointConfig {
  location: string;
  onEvents: readonly CheckpointTrigger[];
  on_events: readonly CheckpointTrigger[];
  provider: BaseProvider;
  maxCheckpoints: number | null;
  max_checkpoints: number | null;
  restoreFrom: string | null;
  restore_from: string | null;

  constructor(options: CheckpointConfigOptions = {}) {
    this.location = options.location ?? "./.checkpoints";
    this.onEvents = [...(options.onEvents ?? options.on_events ?? ["task_completed"])];
    this.on_events = this.onEvents;
    this.provider = options.provider ?? new JsonProvider();
    this.maxCheckpoints = options.maxCheckpoints ?? options.max_checkpoints ?? null;
    this.max_checkpoints = this.maxCheckpoints;
    this.restoreFrom = options.restoreFrom ?? options.restore_from ?? null;
    this.restore_from = this.restoreFrom;
    this._register_handlers();
  }

  _register_handlers(): this {
    if (this.provider instanceof SqliteProvider && !extname(this.location)) {
      this.location = `${this.location}.db`;
    }
    _ensure_handlers_registered();
    return this;
  }

  get triggerAll(): boolean {
    return this.onEvents.includes("*");
  }

  get trigger_all(): boolean {
    return this.triggerAll;
  }

  get triggerEvents(): ReadonlySet<CheckpointTrigger> {
    return new Set(this.onEvents);
  }

  get trigger_events(): ReadonlySet<CheckpointTrigger> {
    return this.triggerEvents;
  }
}

export type CheckpointOption = CheckpointConfig | CheckpointConfigOptions | boolean | null | undefined;

export function coerceCheckpointConfig(value: CheckpointOption): CheckpointConfig | false | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (value === false) {
    return false;
  }
  if (value === true) {
    return new CheckpointConfig();
  }
  if (value instanceof CheckpointConfig) {
    return value;
  }
  return new CheckpointConfig(value);
}

export const _coerce_checkpoint = coerceCheckpointConfig;

export function apply_checkpoint(instance: unknown, from_checkpoint: CheckpointConfig | null): unknown {
  if (!from_checkpoint) {
    return null;
  }
  if (from_checkpoint.restoreFrom) {
    const constructor = typeof instance === "object" && instance !== null ? instance.constructor as { fromCheckpoint?: (config: CheckpointConfig) => unknown; from_checkpoint?: (config: CheckpointConfig) => unknown } : null;
    const restored = constructor?.fromCheckpoint?.(from_checkpoint) ?? constructor?.from_checkpoint?.(from_checkpoint) ?? null;
    if (restored && typeof restored === "object") {
      (restored as { checkpoint?: CheckpointConfig }).checkpoint = new CheckpointConfig({
        location: from_checkpoint.location,
        onEvents: from_checkpoint.onEvents,
        provider: from_checkpoint.provider,
        maxCheckpoints: from_checkpoint.maxCheckpoints,
      });
    }
    return restored;
  }
  if (instance && typeof instance === "object") {
    (instance as { checkpoint?: CheckpointConfig }).checkpoint = from_checkpoint;
  }
  return null;
}

export function detectProvider(path: string): BaseProvider {
  const filePath = path.includes("#") ? path.split("#", 1)[0] ?? path : path;
  try {
    const fd = openSync(filePath, "r");
    try {
      const buffer = Buffer.alloc(SQLITE_MAGIC.length);
      readSync(fd, buffer, 0, SQLITE_MAGIC.length, 0);
      if (buffer.equals(SQLITE_MAGIC)) {
        return new SqliteProvider();
      }
    } finally {
      closeSync(fd);
    }
  } catch {
    // Fall through to the default JSON provider when the path does not exist.
  }
  return new JsonProvider();
}

export const detect_provider = detectProvider;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringField(record: Record<string, unknown>, camelKey: string, snakeKey: string): string | null {
  const value = record[camelKey] ?? record[snakeKey];
  return typeof value === "string" ? value : null;
}

function numberField(record: Record<string, unknown>, camelKey: string, snakeKey: string): number | null {
  const value = record[camelKey] ?? record[snakeKey];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function recordField(record: Record<string, unknown>, camelKey: string, snakeKey: string): Record<string, unknown> | null {
  const value = record[camelKey] ?? record[snakeKey];
  return isRecord(value) ? { ...value } : null;
}

function normalizeEdgeRecord(value: unknown): Record<string, readonly string[]> {
  if (!isRecord(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, unknown[]] => Array.isArray(entry[1]))
      .map(([key, edgeIds]) => [key, edgeIds.map(String)]),
  );
}

function normalizeRuntimeSet(value: unknown): string[] {
  if (value instanceof Set) {
    return [...value].map(String);
  }
  if (Array.isArray(value)) {
    return value.map(String);
  }
  return [];
}

function normalizeRuntimeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? Array.from(value as unknown[]) : [];
}

function normalizeRuntimeMap(value: unknown): Record<string, number> {
  if (value instanceof Map) {
    return Object.fromEntries([...value.entries()].map(([key, count]) => [String(key), Number(count)]));
  }
  if (!isRecord(value)) {
    return {};
  }
  const result: Record<string, number> = {};
  for (const [key, count] of Object.entries(value)) {
    if (typeof count === "number") {
      result[key] = count;
    }
  }
  return result;
}

function buildCheckpointPath(directory: string, branch: string, parentId: string | null): string {
  assertSafeBranch(directory, branch);
  const now = new Date();
  const timestamp = now.toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "");
  const shortUuid = randomUUID().replaceAll("-", "").slice(0, 8);
  const parent = parentId || "none";
  return join(directory, branch, `${timestamp}_${shortUuid}_p-${parent}.json`);
}

export function _build_path(directory: string, branch = "main", parent_id: string | null = null): string {
  return buildCheckpointPath(directory, branch, parent_id);
}

function assertSafeBranch(base: string, branch: string): void {
  const baseResolved = resolve(base);
  const target = resolve(base, branch);
  if (target !== baseResolved && !target.startsWith(`${baseResolved}${sep}`)) {
    throw new Error(`Branch name escapes checkpoint directory: ${JSON.stringify(branch)}`);
  }
}

export function _safe_branch(base: string, branch: string): void {
  assertSafeBranch(base, branch);
}

function dirname(path: string): string {
  const index = path.lastIndexOf(sep);
  return index === -1 ? "." : path.slice(0, index);
}

function mkdirSyncForFile(path: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function writeFileSyncUtf8(path: string, data: string): void {
  writeFileSync(path, data, "utf8");
}

const SQLITE_MAGIC = Buffer.from("SQLite format 3\0", "binary");

const CREATE_CHECKPOINTS_TABLE = `
CREATE TABLE IF NOT EXISTS checkpoints (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  parent_id TEXT,
  branch TEXT NOT NULL DEFAULT 'main',
  data TEXT NOT NULL
)`;

function makeCheckpointId(): { checkpointId: string; timestamp: string } {
  const timestamp = new Date().toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "");
  return {
    checkpointId: `${timestamp}_${randomUUID().replaceAll("-", "").slice(0, 8)}`,
    timestamp,
  };
}

export function _make_id(): [string, string] {
  const { checkpointId, timestamp } = makeCheckpointId();
  return [checkpointId, timestamp];
}

function splitSqliteLocation(location: string): { dbPath: string; checkpointId: string } {
  const marker = location.lastIndexOf("#");
  if (marker < 0) {
    throw new Error(`Invalid SQLite checkpoint location: ${location}`);
  }
  return {
    dbPath: location.slice(0, marker),
    checkpointId: location.slice(marker + 1),
  };
}

function canonicalizeSqliteCheckpointJSON(data: string): string {
  return JSON.stringify(JSON.parse(data));
}

function databaseSync(): typeof import("node:sqlite").DatabaseSync {
  cachedDatabaseSync ??= (requireNodeBuiltin("node:sqlite") as typeof import("node:sqlite")).DatabaseSync;
  return cachedDatabaseSync;
}

function serializeRuntimeEntity(entity: unknown): unknown {
  if (!entity || typeof entity !== "object") {
    return entity;
  }
  const maybeSerializable = entity as { toJSON?: () => unknown };
  if (typeof maybeSerializable.toJSON === "function") {
    return maybeSerializable.toJSON();
  }
  const record = entity as Record<string, unknown>;
  const prototype = Object.getPrototypeOf(entity) as { constructor?: { name?: string } } | null;
  const typeName = prototype?.constructor?.name;
  return {
    type: typeName,
    ...(typeof record.name === "string" || record.name === null ? { name: record.name } : {}),
    ...(typeof record.role === "string" ? { role: record.role } : {}),
    ...(typeof record.goal === "string" ? { goal: record.goal } : {}),
    ...(typeof record.backstory === "string" ? { backstory: record.backstory } : {}),
    ...(typeof record.description === "string" ? { description: record.description } : {}),
    ...(typeof record.expectedOutput === "string" ? { expectedOutput: record.expectedOutput } : {}),
  };
}
