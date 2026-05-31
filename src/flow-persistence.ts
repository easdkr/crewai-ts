import { mkdirSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import type { PendingFeedbackContext } from "./flow.js";
import { dbStoragePath } from "./settings.js";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";

const requireNodeBuiltin = createRequire(import.meta.url);
let cachedDatabaseSync: typeof import("node:sqlite").DatabaseSync | null = null;

export type PendingFeedbackRecord = {
  state: Record<string, unknown>;
  context: PendingFeedbackContext;
};

export type FlowPersistence = {
  persistenceType?: string;
  persistence_type?: string;
  saveState?(flowId: string, methodName: string, state: unknown): Promise<void>;
  save_state?(flowId: string, methodName: string, state: unknown): Promise<void>;
  loadState?(flowId: string): Promise<Record<string, unknown> | null>;
  load_state?(flowId: string): Promise<Record<string, unknown> | null>;
  savePendingFeedback(
    flowId: string,
    context: PendingFeedbackContext,
    state: unknown,
  ): Promise<void>;
  save_pending_feedback(
    flowId: string,
    context: PendingFeedbackContext,
    state: unknown,
  ): Promise<void>;
  loadPendingFeedback(flowId: string): Promise<PendingFeedbackRecord | null>;
  load_pending_feedback(flowId: string): Promise<PendingFeedbackRecord | null>;
  clearPendingFeedback(flowId: string): Promise<void>;
  clear_pending_feedback(flowId: string): Promise<void>;
};
export const FlowPersistence = Object.freeze({ kind: "FlowPersistence" });
export const LOG_MESSAGES = Object.freeze({
  SAVE_SKIPPED: "Flow persistence skipped.",
  LOAD_SKIPPED: "Flow persistence load skipped.",
});

type PersistableFlowInstance = {
  state?: unknown;
  name?: string | null;
  constructor: { name?: string };
};

// TS mixin class expressions must use any[] constructor args.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FlowClass = new (...args: any[]) => object;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFlowMethod<This = unknown> = (this: This, ...args: any[]) => unknown;

export type PersistDecoratorOptions = {
  persistence?: FlowPersistence | null;
  verbose?: boolean;
};

type ClassDecoratorFactory = <TClass extends FlowClass>(
  value: TClass,
  context: ClassDecoratorContext<TClass>,
) => TClass | undefined;

type MethodDecoratorFactory = <
  This extends PersistableFlowInstance,
  Args extends unknown[],
  Return,
>(
  value: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
) => ((this: This, ...args: Args) => Return) | undefined;

export class JsonFlowPersistence implements FlowPersistence {
  readonly persistenceType = "JsonFlowPersistence";
  readonly persistence_type = "JsonFlowPersistence";

  constructor(readonly location = ".flows") {}

  async saveState(flowId: string, methodName: string, state: Record<string, unknown>): Promise<void> {
    await this.ensureDirectory();
    await writeFile(
      this.statePath(flowId),
      JSON.stringify({ flowId, methodName, state }, null, 2),
      "utf8",
    );
  }

  async save_state(flowId: string, methodName: string, state: Record<string, unknown>): Promise<void> {
    await this.saveState(flowId, methodName, state);
  }

  async loadState(flowId: string): Promise<Record<string, unknown> | null> {
    try {
      const raw = await readFile(this.statePath(flowId), "utf8");
      const parsed = JSON.parse(raw) as { state?: unknown };
      return isRecord(parsed.state) ? parsed.state : null;
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async load_state(flowId: string): Promise<Record<string, unknown> | null> {
    return await this.loadState(flowId);
  }

  async savePendingFeedback(
    flowId: string,
    context: PendingFeedbackContext,
    state: Record<string, unknown>,
  ): Promise<void> {
    await this.ensureDirectory();
    await this.saveState(flowId, context.methodName, state);
    await writeFile(
      this.pendingPath(flowId),
      JSON.stringify({
        state,
        context: serializePendingFeedbackContext(context),
      }, null, 2),
      "utf8",
    );
  }

  async save_pending_feedback(
    flowId: string,
    context: PendingFeedbackContext,
    state: Record<string, unknown>,
  ): Promise<void> {
    await this.savePendingFeedback(flowId, context, state);
  }

  async loadPendingFeedback(flowId: string): Promise<PendingFeedbackRecord | null> {
    try {
      const raw = await readFile(this.pendingPath(flowId), "utf8");
      const parsed = JSON.parse(raw) as { state?: unknown; context?: unknown };
      if (!isRecord(parsed.state) || !isRecord(parsed.context)) {
        return null;
      }
      return {
        state: parsed.state,
        context: deserializePendingFeedbackContext(parsed.context),
      };
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async load_pending_feedback(flowId: string): Promise<PendingFeedbackRecord | null> {
    return await this.loadPendingFeedback(flowId);
  }

  async clearPendingFeedback(flowId: string): Promise<void> {
    await rm(this.pendingPath(flowId), { force: true });
  }

  async clear_pending_feedback(flowId: string): Promise<void> {
    await this.clearPendingFeedback(flowId);
  }

  private async ensureDirectory(): Promise<void> {
    await mkdir(this.location, { recursive: true });
  }

  private statePath(flowId: string): string {
    return join(this.location, `${encodeFlowId(flowId)}.state.json`);
  }

  private pendingPath(flowId: string): string {
    return join(this.location, `${encodeFlowId(flowId)}.pending.json`);
  }
}

export class SQLiteFlowPersistence implements FlowPersistence {
  readonly persistenceType = "SQLiteFlowPersistence";
  readonly persistence_type = "SQLiteFlowPersistence";
  readonly dbPath: string;
  readonly db_path: string;

  constructor(dbPath: string | null = null) {
    this.dbPath = dbPath ?? join(dbStoragePath(), "flow_states.db");
    this.db_path = this.dbPath;
    this.initDb();
  }

  initDb(): void {
    mkdirSync(dirname(this.dbPath), { recursive: true });
    this.withDb((db) => {
      db.exec("PRAGMA journal_mode=WAL");
      db.exec(`
        CREATE TABLE IF NOT EXISTS flow_states (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          flow_uuid TEXT NOT NULL,
          method_name TEXT NOT NULL,
          timestamp DATETIME NOT NULL,
          state_json TEXT NOT NULL
        )
      `);
      db.exec("CREATE INDEX IF NOT EXISTS idx_flow_states_uuid ON flow_states(flow_uuid)");
      db.exec(`
        CREATE TABLE IF NOT EXISTS pending_feedback (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          flow_uuid TEXT NOT NULL UNIQUE,
          context_json TEXT NOT NULL,
          state_json TEXT NOT NULL,
          created_at DATETIME NOT NULL
        )
      `);
      db.exec("CREATE INDEX IF NOT EXISTS idx_pending_feedback_uuid ON pending_feedback(flow_uuid)");
    });
  }

  init_db(): void {
    this.initDb();
  }

  saveState(flowId: string, methodName: string, state: unknown): Promise<void> {
    const stateDict = SQLiteFlowPersistence._to_state_dict(state);
    this.withDb((db) => {
      this._save_state_sql(db, flowId, methodName, stateDict);
    });
    return Promise.resolve();
  }

  save_state(flowId: string, methodName: string, state: unknown): Promise<void> {
    return this.saveState(flowId, methodName, state);
  }

  loadState(flowId: string): Promise<Record<string, unknown> | null> {
    return Promise.resolve(this.withDb((db) => {
      const row = db.prepare(`
        SELECT state_json
        FROM flow_states
        WHERE flow_uuid = ?
        ORDER BY id DESC
        LIMIT 1
      `).get(flowId) as { state_json: unknown } | undefined;
      if (!row) {
        return null;
      }
      return parseJsonRecord(row.state_json);
    }));
  }

  load_state(flowId: string): Promise<Record<string, unknown> | null> {
    return this.loadState(flowId);
  }

  savePendingFeedback(
    flowId: string,
    context: PendingFeedbackContext,
    state: unknown,
  ): Promise<void> {
    const stateDict = SQLiteFlowPersistence._to_state_dict(state);
    this.withDb((db) => {
      this._save_state_sql(db, flowId, context.methodName, stateDict);
      db.prepare(`
        INSERT OR REPLACE INTO pending_feedback (
          flow_uuid,
          context_json,
          state_json,
          created_at
        ) VALUES (?, ?, ?, ?)
      `).run(
        flowId,
        JSON.stringify(serializePendingFeedbackContext(context)),
        JSON.stringify(stateDict),
        new Date().toISOString(),
      );
    });
    return Promise.resolve();
  }

  save_pending_feedback(
    flowId: string,
    context: PendingFeedbackContext,
    state: unknown,
  ): Promise<void> {
    return this.savePendingFeedback(flowId, context, state);
  }

  loadPendingFeedback(flowId: string): Promise<PendingFeedbackRecord | null> {
    return Promise.resolve(this.withDb((db) => {
      const row = db.prepare(`
        SELECT state_json, context_json
        FROM pending_feedback
        WHERE flow_uuid = ?
      `).get(flowId) as { state_json: unknown; context_json: unknown } | undefined;
      if (!row) {
        return null;
      }
      const state = parseJsonRecord(row.state_json);
      const context = parseJsonRecord(row.context_json);
      if (!state || !context) {
        return null;
      }
      return {
        state,
        context: deserializePendingFeedbackContext(context),
      };
    }));
  }

  load_pending_feedback(flowId: string): Promise<PendingFeedbackRecord | null> {
    return this.loadPendingFeedback(flowId);
  }

  clearPendingFeedback(flowId: string): Promise<void> {
    this.withDb((db) => {
      db.prepare("DELETE FROM pending_feedback WHERE flow_uuid = ?").run(flowId);
    });
    return Promise.resolve();
  }

  clear_pending_feedback(flowId: string): Promise<void> {
    return this.clearPendingFeedback(flowId);
  }

  static _to_state_dict(stateData: unknown): Record<string, unknown> {
    const modelDump = (stateData as { model_dump?: unknown; modelDump?: unknown } | null)?.model_dump
      ?? (stateData as { modelDump?: unknown } | null)?.modelDump;
    if (typeof modelDump === "function") {
      const dumped: unknown = modelDump.call(stateData);
      if (isRecord(dumped)) {
        return dumped;
      }
    }
    if (isRecord(stateData)) {
      return stateData;
    }
    throw new Error(`state_data must be either a model_dump/modelDump object or plain object, got ${typeof stateData}`);
  }

  _to_state_dict(stateData: unknown): Record<string, unknown> {
    return SQLiteFlowPersistence._to_state_dict(stateData);
  }

  _save_state_sql(db: DatabaseSyncType, flowId: string, methodName: string, state: unknown): void {
    const stateDict = SQLiteFlowPersistence._to_state_dict(state);
    db.prepare(`
      INSERT INTO flow_states (
        flow_uuid,
        method_name,
        timestamp,
        state_json
      ) VALUES (?, ?, ?, ?)
    `).run(flowId, methodName, new Date().toISOString(), JSON.stringify(stateDict));
  }

  private withDb<T>(fn: (db: DatabaseSyncType) => T): T {
    const db = new (databaseSync())(this.dbPath);
    try {
      return fn(db);
    } finally {
      db.close();
    }
  }
}

export async function persistState(
  flowInstance: PersistableFlowInstance,
  methodName: string,
  persistenceInstance: FlowPersistence,
  verbose = false,
): Promise<void> {
  if (!persistenceInstance.saveState) {
    return;
  }
  const state = flowInstance.state;
  if (!isRecord(state)) {
    throw new Error("Flow instance has no state.");
  }
  const flowId = flowStateId(state);
  if (!flowId) {
    throw new Error("Flow state must have an 'id' field for persistence.");
  }
  if (verbose) {
    console.info(`Saving flow state to memory for ID: ${flowId}`);
  }
  await persistenceInstance.saveState(flowId, methodName, { ...state });
}

export function persist(
  persistenceOrOptions: FlowPersistence | PersistDecoratorOptions | null = null,
  verbose = false,
): ClassDecoratorFactory & MethodDecoratorFactory {
  const persistence = coercePersistence(persistenceOrOptions);
  const shouldLog = typeof persistenceOrOptions === "object"
    && persistenceOrOptions !== null
    && "verbose" in persistenceOrOptions
    ? persistenceOrOptions.verbose
    : verbose;

  function decorateClass<TClass extends FlowClass>(
    value: TClass,
  ): TClass {
    const actualPersistence = persistence ?? new SQLiteFlowPersistence();
    return class extends value {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      constructor(...args: any[]) {
        super(...injectPersistenceOption(args, actualPersistence));
        const instance = this as PersistableFlowInstance & { persistence?: FlowPersistence | null };
        instance.persistence ??= actualPersistence;
      }
    };
  }

  function decorateMethod<This extends PersistableFlowInstance, Args extends unknown[], Return>(
    value: (this: This, ...args: Args) => Return,
    context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
  ): (this: This, ...args: Args) => Return {
    const actualPersistence = persistence ?? new SQLiteFlowPersistence();
    const wrapped = async function persistWrappedMethod(this: This, ...args: Args): Promise<Awaited<Return>> {
      const result = await value.call(this, ...args);
      await persistState(this, String(context.name), actualPersistence, shouldLog);
      return result;
    };
    return wrapped as (this: This, ...args: Args) => Return;
  }

  return function decorate(
    value: FlowClass | AnyFlowMethod<PersistableFlowInstance>,
    context: ClassDecoratorContext<FlowClass> | ClassMethodDecoratorContext<PersistableFlowInstance, AnyFlowMethod<PersistableFlowInstance>>,
  ): FlowClass | AnyFlowMethod<PersistableFlowInstance> | undefined {
    if (context.kind === "class") {
      return decorateClass(value as FlowClass);
    }
    return decorateMethod(value as AnyFlowMethod<PersistableFlowInstance>, context);
  } as ClassDecoratorFactory & MethodDecoratorFactory;
}

export const PersistenceDecorator = { persistState };
export const PersistDecorator = PersistenceDecorator;
export const persist_state = persistState;

export const SQLiteFlowPersistenceAlias = SQLiteFlowPersistence;
export const SqliteFlowPersistence = SQLiteFlowPersistence;
export const sqliteFlowPersistence = SQLiteFlowPersistence;
export const sqlite_flow_persistence = SQLiteFlowPersistence;

function databaseSync(): typeof import("node:sqlite").DatabaseSync {
  cachedDatabaseSync ??= (requireNodeBuiltin("node:sqlite") as typeof import("node:sqlite")).DatabaseSync;
  return cachedDatabaseSync;
}

export function serializePendingFeedbackContext(context: PendingFeedbackContext): Record<string, unknown> {
  return {
    ...context,
    requestedAt: context.requestedAt.toISOString(),
  };
}

export function deserializePendingFeedbackContext(value: Record<string, unknown>): PendingFeedbackContext {
  return {
    flowName: stringValue(value.flowName),
    flowClass: stringValue(value.flowClass),
    flowId: typeof value.flowId === "string" ? value.flowId : null,
    methodName: stringValue(value.methodName),
    output: value.output,
    message: stringValue(value.message),
    emit: Array.isArray(value.emit) ? value.emit.filter((entry): entry is string => typeof entry === "string") : null,
    defaultOutcome: typeof value.defaultOutcome === "string" ? value.defaultOutcome : null,
    metadata: isRecord(value.metadata) ? value.metadata : {},
    llm: typeof value.llm === "string" || isRecord(value.llm) ? value.llm : null,
    requestedAt: typeof value.requestedAt === "string" ? new Date(value.requestedAt) : new Date(),
  };
}

function encodeFlowId(flowId: string): string {
  return encodeURIComponent(flowId).replaceAll("%", "_");
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function coercePersistence(value: FlowPersistence | PersistDecoratorOptions | null): FlowPersistence | null {
  if (!value) {
    return null;
  }
  if (isPersistDecoratorOptions(value)) {
    return value.persistence ?? null;
  }
  return value;
}

function isPersistDecoratorOptions(value: FlowPersistence | PersistDecoratorOptions): value is PersistDecoratorOptions {
  return "persistence" in value || "verbose" in value;
}

function injectPersistenceOption(args: readonly unknown[], persistence: FlowPersistence): unknown[] {
  const [first, ...rest] = args;
  if (isRecord(first)) {
    return [{ ...first, persistence: first.persistence ?? persistence }, ...rest];
  }
  return [{ persistence }, ...rest];
}

function flowStateId(state: Record<string, unknown>): string | null {
  const id = state.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(String(value)) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error !== null && typeof error === "object" && "code" in error;
}
