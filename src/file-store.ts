export const DEFAULT_FILE_STORE_TTL = 3600;

export type FileInput = unknown;
export type FileInputMap = Record<string, FileInput>;
export type FileStoreId = string | number | bigint | { toString(): string };

type StoreEntry = {
  files: FileInputMap;
  expiresAt: number | null;
};

const crewPrefix = "crew:";
const taskPrefix = "task:";
const fileStore = new Map<string, StoreEntry>();

export function astoreFiles(
  executionId: FileStoreId,
  files: FileInputMap,
  ttl = DEFAULT_FILE_STORE_TTL,
): Promise<void> {
  storeFiles(executionId, files, ttl);
  return Promise.resolve();
}

export const astore_files = astoreFiles;

export function agetFiles(executionId: FileStoreId): Promise<FileInputMap | null> {
  return Promise.resolve(getFiles(executionId));
}

export const aget_files = agetFiles;

export function aclearFiles(executionId: FileStoreId): Promise<void> {
  clearFiles(executionId);
  return Promise.resolve();
}

export const aclear_files = aclearFiles;

export function astoreTaskFiles(
  taskId: FileStoreId,
  files: FileInputMap,
  ttl = DEFAULT_FILE_STORE_TTL,
): Promise<void> {
  storeTaskFiles(taskId, files, ttl);
  return Promise.resolve();
}

export const astore_task_files = astoreTaskFiles;

export function agetTaskFiles(taskId: FileStoreId): Promise<FileInputMap | null> {
  return Promise.resolve(getTaskFiles(taskId));
}

export const aget_task_files = agetTaskFiles;

export function aclearTaskFiles(taskId: FileStoreId): Promise<void> {
  clearTaskFiles(taskId);
  return Promise.resolve();
}

export const aclear_task_files = aclearTaskFiles;

export function agetAllFiles(crewId: FileStoreId, taskId?: FileStoreId | null): Promise<FileInputMap | null> {
  return Promise.resolve(getAllFiles(crewId, taskId));
}

export const aget_all_files = agetAllFiles;

export function storeFiles(
  executionId: FileStoreId,
  files: FileInputMap,
  ttl = DEFAULT_FILE_STORE_TTL,
): void {
  fileStore.set(crewKey(executionId), createEntry(files, ttl));
}

export const store_files = storeFiles;

export function getFiles(executionId: FileStoreId): FileInputMap | null {
  return readEntry(crewKey(executionId));
}

export const get_files = getFiles;

export function clearFiles(executionId: FileStoreId): void {
  fileStore.delete(crewKey(executionId));
}

export const clear_files = clearFiles;

export function storeTaskFiles(
  taskId: FileStoreId,
  files: FileInputMap,
  ttl = DEFAULT_FILE_STORE_TTL,
): void {
  fileStore.set(taskKey(taskId), createEntry(files, ttl));
}

export const store_task_files = storeTaskFiles;

export function getTaskFiles(taskId: FileStoreId): FileInputMap | null {
  return readEntry(taskKey(taskId));
}

export const get_task_files = getTaskFiles;

export function clearTaskFiles(taskId: FileStoreId): void {
  fileStore.delete(taskKey(taskId));
}

export const clear_task_files = clearTaskFiles;

export function getAllFiles(crewId: FileStoreId, taskId?: FileStoreId | null): FileInputMap | null {
  const crewFiles = getFiles(crewId);
  const taskFiles = taskId === null || taskId === undefined ? null : getTaskFiles(taskId);
  if (!crewFiles && !taskFiles) {
    return null;
  }
  return { ...(crewFiles ?? {}), ...(taskFiles ?? {}) };
}

export const get_all_files = getAllFiles;

export function clearFileStore(): void {
  fileStore.clear();
}

export const clear_file_store = clearFileStore;

export async function _run_sync<T>(task: Promise<T> | (() => T | Promise<T>)): Promise<T> {
  return await (typeof task === "function" ? task() : task);
}

function createEntry(files: FileInputMap, ttl: number): StoreEntry {
  return {
    files: { ...files },
    expiresAt: ttl > 0 ? Date.now() + (ttl * 1000) : null,
  };
}

function readEntry(key: string): FileInputMap | null {
  const entry = fileStore.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
    fileStore.delete(key);
    return null;
  }
  return { ...entry.files };
}

function crewKey(executionId: FileStoreId): string {
  return `${crewPrefix}${normalizeStoreId(executionId)}`;
}

function taskKey(taskId: FileStoreId): string {
  return `${taskPrefix}${normalizeStoreId(taskId)}`;
}

function normalizeStoreId(value: FileStoreId): string {
  return value.toString();
}
