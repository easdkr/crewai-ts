import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync, mkdirSync, openSync, readSync, closeSync, statSync, writeFileSync } from "node:fs";
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
  crewaiEventBus,
  type BaseEvent,
  type EventType,
} from "./events.js";
import { __version__ } from "./version.js";

const requireNodeBuiltin = createRequire(import.meta.url);
let cachedDatabaseSync: typeof import("node:sqlite").DatabaseSync | null = null;

export type CheckpointEventType = EventType | "lite_agent_execution_started" | "lite_agent_execution_completed" | "lite_agent_execution_error";
export const CheckpointEventType = Object.freeze({ kind: "CheckpointEventType" });

export type CheckpointTrigger = CheckpointEventType | "*";

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

  constructor(options: { event: BaseEvent; edges?: Record<string, readonly string[]> }) {
    this.event = options.event;
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
}

export class EventRecord {
  nodes: Record<string, EventNode>;

  constructor(options: { nodes?: Record<string, EventNode | { event: BaseEvent; edges?: Record<string, readonly string[]> }> } = {}) {
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
    return {
      crewai_version: __version__,
      parent_id: this.parentId,
      branch: this.branch,
      entities: this.root.map((entity) => serializeRuntimeEntity(entity)),
      event_record: this.eventRecord.toJSON(),
    };
  }

  toJSONText(): string {
    return JSON.stringify(this.toJSON());
  }

  to_json(): string {
    return this.toJSONText();
  }

  static fromJSONText(raw: string, provider: BaseProvider = new JsonProvider()): RuntimeState {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const state = new RuntimeState({
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      provider,
      parentId: typeof parsed.parent_id === "string" ? parsed.parent_id : null,
      branch: typeof parsed.branch === "string" ? parsed.branch : "main",
    });
    return state;
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
    const checkpointId = this.provider.extractId(location);
    this.checkpointId = checkpointId;
    this.checkpoint_id = checkpointId;
    this.parentId = checkpointId;
    this.parent_id = checkpointId;
  }

  private beginCheckpoint(location: string): { providerName: string; parentId: string | null; branch: string; startedAt: number } {
    const providerName = this.provider.constructor.name;
    const parentId = this.parentId;
    const branch = this.branch;
    crewaiEventBus.emit(this, new CheckpointStartedEvent({
      location,
      provider: providerName,
      branch,
      parent_id: parentId,
    }));
    return { providerName, parentId, branch, startedAt: Date.now() };
  }

  private emitCheckpointCompleted(
    location: string,
    providerName: string,
    parentId: string | null,
    branch: string,
    startedAt: number,
  ): void {
    crewaiEventBus.emit(this, new CheckpointCompletedEvent({
      location,
      provider: providerName,
      checkpoint_id: this.provider.extractId(location),
      duration_ms: Date.now() - startedAt,
      branch,
      parent_id: parentId,
    }));
  }

  private emitCheckpointFailed(
    location: string,
    providerName: string,
    parentId: string | null,
    branch: string,
    error: unknown,
  ): void {
    crewaiEventBus.emit(this, new CheckpointFailedEvent({
      location,
      provider: providerName,
      error,
      branch,
      parent_id: parentId,
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

  async prune(location: string, maxKeep: number, options: { branch?: string } = {}): Promise<number> {
    const branch = options.branch ?? "main";
    assertSafeBranch(location, branch);
    const branchDir = join(location, branch);
    if (!existsSync(branchDir)) {
      return 0;
    }
    const files = (await readdir(branchDir, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => join(branchDir, entry.name))
      .sort((left, right) => statSync(left).mtimeMs - statSync(right).mtimeMs);
    const removable = maxKeep === 0 ? files : files.slice(0, Math.max(0, files.length - maxKeep));
    for (const file of removable) {
      await rm(file, { force: true });
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

  fromCheckpoint(location: string): Promise<string> {
    return readFile(location, "utf8");
  }

  from_checkpoint(location: string): Promise<string> {
    return this.fromCheckpoint(location);
  }

  afromCheckpoint(location: string): Promise<string> {
    return this.fromCheckpoint(location);
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
    const { checkpointId, timestamp } = makeCheckpointId();
    mkdirSync(dirname(location), { recursive: true });
    const db = new (databaseSync())(location);
    try {
      db.exec("PRAGMA journal_mode=WAL");
      db.exec(CREATE_CHECKPOINTS_TABLE);
      db.prepare("INSERT INTO checkpoints (id, created_at, parent_id, branch, data) VALUES (?, ?, ?, ?, ?)")
        .run(checkpointId, timestamp, parentId, branch, data);
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
      return String(row.data);
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
    if (this.provider instanceof SqliteProvider && !extname(this.location)) {
      this.location = `${this.location}.db`;
    }
    this.maxCheckpoints = options.maxCheckpoints ?? options.max_checkpoints ?? null;
    this.max_checkpoints = this.maxCheckpoints;
    this.restoreFrom = options.restoreFrom ?? options.restore_from ?? null;
    this.restore_from = this.restoreFrom;
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

function buildCheckpointPath(directory: string, branch: string, parentId: string | null): string {
  assertSafeBranch(directory, branch);
  const now = new Date();
  const timestamp = now.toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "");
  const shortUuid = randomUUID().replaceAll("-", "").slice(0, 8);
  const parent = parentId || "none";
  return join(directory, branch, `${timestamp}_${shortUuid}_p-${parent}.json`);
}

function assertSafeBranch(base: string, branch: string): void {
  const baseResolved = resolve(base);
  const target = resolve(base, branch);
  if (target !== baseResolved && !target.startsWith(`${baseResolved}${sep}`)) {
    throw new Error(`Branch name escapes checkpoint directory: ${JSON.stringify(branch)}`);
  }
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
