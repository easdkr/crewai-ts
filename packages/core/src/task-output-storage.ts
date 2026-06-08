import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

import { DatabaseError, DatabaseOperationError } from "./errors.js";
import { dbStoragePath } from "./settings.js";
import type { Task } from "./task.js";
import { crewJsonStringify } from "./utilities.js";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";

const requireNodeBuiltin = createRequire(import.meta.url);
let cachedDatabaseSync: typeof import("node:sqlite").DatabaseSync | null = null;

export type StoredTaskOutput = {
  description: string;
  summary?: string;
  raw: string;
  pydantic: unknown;
  jsonDict: Record<string, unknown> | null;
  json_dict?: Record<string, unknown> | null;
  outputFormat: string;
  output_format?: string;
  agent: string;
  messages?: readonly unknown[];
};

export type TaskOutputStorageRecord = {
  task_id: string;
  expected_output: string;
  output: StoredTaskOutput;
  task_index: number;
  inputs: Record<string, unknown>;
  was_replayed: boolean;
  timestamp: string;
};

export type TaskOutputStorageUpdate = Partial<Omit<TaskOutputStorageRecord, "task_index" | "timestamp">>;

export interface KickoffTaskOutputsStorage {
  add(
    task: Task,
    output: StoredTaskOutput,
    taskIndex: number,
    wasReplayed?: boolean,
    inputs?: Record<string, unknown>,
  ): void;
  update(taskIndex: number, fields: TaskOutputStorageUpdate): void;
  load(): TaskOutputStorageRecord[];
  deleteAll(): void;
}

export class KickoffTaskOutputsSQLiteStorage implements KickoffTaskOutputsStorage {
  readonly dbPath: string;
  readonly db_path: string;

  constructor(dbPath: string | null = null) {
    this.dbPath = dbPath ?? join(dbStoragePath(), "latest_kickoff_task_outputs.db");
    this.db_path = this.dbPath;
    this._initialize_db();
  }

  add(
    task: Task,
    output: StoredTaskOutput,
    taskIndex: number,
    wasReplayed = false,
    inputs: Record<string, unknown> = {},
  ): void {
    try {
      this.withDb((db) => {
        db.prepare(
          `INSERT OR REPLACE INTO latest_kickoff_task_outputs
           (task_id, expected_output, output, task_index, inputs, was_replayed)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(
          task.id,
          task.expectedOutput,
          crewJsonStringify(output),
          taskIndex,
          crewJsonStringify(inputs),
          wasReplayed ? 1 : 0,
        );
      });
    } catch (error) {
      throw databaseOperationError(DatabaseError.SAVE_ERROR, error);
    }
  }

  update(taskIndex: number, fields: TaskOutputStorageUpdate): void {
    const entries = Object.entries(fields);
    if (entries.length === 0) {
      return;
    }

    try {
      this.withDb((db) => {
        const assignments = entries.map(([key]) => `${key} = ?`).join(", ");
        const values = entries.map(([, value]) => encodeStorageValue(value));
        db.prepare(`UPDATE latest_kickoff_task_outputs SET ${assignments} WHERE task_index = ?`)
          .run(...values, taskIndex);
      });
    } catch (error) {
      throw databaseOperationError(DatabaseError.UPDATE_ERROR, error);
    }
  }

  load(): TaskOutputStorageRecord[] {
    try {
      return this.withDb((db) => {
        const rows = db.prepare(
          `SELECT task_id, expected_output, output, task_index, inputs, was_replayed, timestamp
           FROM latest_kickoff_task_outputs
           ORDER BY task_index`,
        ).all() as Array<Record<string, unknown>>;

        return rows.map((row) => ({
          task_id: String(row.task_id),
          expected_output: String(row.expected_output),
          output: parseJsonRecord(row.output) as StoredTaskOutput,
          task_index: Number(row.task_index),
          inputs: parseJsonRecord(row.inputs),
          was_replayed: Boolean(row.was_replayed),
          timestamp: String(row.timestamp),
        }));
      });
    } catch (error) {
      throw databaseOperationError(DatabaseError.LOAD_ERROR, error);
    }
  }

  deleteAll(): void {
    try {
      this.withDb((db) => {
        db.prepare("DELETE FROM latest_kickoff_task_outputs").run();
      });
    } catch (error) {
      throw databaseOperationError(DatabaseError.DELETE_ERROR, error);
    }
  }

  delete_all(): void {
    this.deleteAll();
  }

  private initializeDb(): void {
    this._initialize_db();
  }

  _initialize_db(): void {
    try {
      mkdirSync(dirname(this.dbPath), { recursive: true });
      this.withDb((db) => {
        db.exec("PRAGMA journal_mode=WAL");
        db.exec(`
          CREATE TABLE IF NOT EXISTS latest_kickoff_task_outputs (
            task_id TEXT PRIMARY KEY,
            expected_output TEXT,
            output JSON,
            task_index INTEGER,
            inputs JSON,
            was_replayed BOOLEAN,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
      });
    } catch (error) {
      throw databaseOperationError(DatabaseError.INIT_ERROR, error);
    }
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

function databaseSync(): typeof import("node:sqlite").DatabaseSync {
  cachedDatabaseSync ??= (requireNodeBuiltin("node:sqlite") as typeof import("node:sqlite")).DatabaseSync;
  return cachedDatabaseSync;
}

export class TaskOutputStorageHandler {
  readonly storage: KickoffTaskOutputsStorage;

  constructor(storage: KickoffTaskOutputsStorage = new KickoffTaskOutputsSQLiteStorage()) {
    this.storage = storage;
  }

  update(taskIndex: number, log: {
    task: Task;
    output: StoredTaskOutput;
    task_index?: number;
    taskIndex?: number;
    inputs?: Record<string, unknown>;
    was_replayed?: boolean;
    wasReplayed?: boolean;
  }): void {
    const savedOutputs = this.load();
    if (savedOutputs === null) {
      throw new Error("Logs cannot be None");
    }

    const wasReplayed = log.was_replayed ?? log.wasReplayed ?? false;
    const inputs = log.inputs ?? {};
    if (wasReplayed) {
      this.storage.update(taskIndex, {
        task_id: log.task.id,
        expected_output: log.task.expectedOutput,
        output: log.output,
        was_replayed: wasReplayed,
        inputs,
      });
      return;
    }

    this.storage.add(log.task, log.output, log.taskIndex ?? log.task_index ?? taskIndex, wasReplayed, inputs);
  }

  add(
    task: Task,
    output: StoredTaskOutput,
    taskIndex: number,
    inputs: Record<string, unknown> = {},
    wasReplayed = false,
  ): void {
    this.storage.add(task, output, taskIndex, wasReplayed, inputs);
  }

  reset(): void {
    this.storage.deleteAll();
  }

  load(): TaskOutputStorageRecord[] | null {
    return this.storage.load();
  }
}

function encodeStorageValue(value: unknown): string | number | null {
  if (value && typeof value === "object") {
    return crewJsonStringify(value);
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  return null;
}

function parseJsonRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") {
    return {};
  }
  const parsed: unknown = JSON.parse(value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
}

function databaseOperationError(template: string, error: unknown): DatabaseOperationError {
  const original = error instanceof Error ? error : new Error(String(error));
  return new DatabaseOperationError(DatabaseError.formatError(template, original), original);
}

export function defaultTaskOutputStoragePath(): string {
  return resolve(join(dbStoragePath(), "latest_kickoff_task_outputs.db"));
}

export const default_task_output_storage_path = defaultTaskOutputStoragePath;
export const KickoffTaskOutputsSqliteStorage = KickoffTaskOutputsSQLiteStorage;
export const TaskOutputStorageHandlerAlias = TaskOutputStorageHandler;
