import { createHash } from "node:crypto";

type LockState = {
  queue: Array<() => void>;
  held: boolean;
};

export type LockBackend = <T>(
  name: string,
  fn: () => T | Promise<T>,
  options: { timeout: number },
) => T | Promise<T>;

const locks = new Map<string, LockState>();
const defaultTimeout = 120_000;
let customBackend: LockBackend | null = null;

export async function lock<T>(
  name: string,
  fn: () => T | Promise<T>,
  options: { timeout?: number } = {},
): Promise<T> {
  const timeout = options.timeout ?? defaultTimeout;
  if (customBackend) {
    return await customBackend(name, fn, { timeout });
  }
  const key = lockKey(name);
  const release = await acquireNamedLock(key, timeout);
  try {
    return await fn();
  } finally {
    release();
  }
}

export const withLock = lock;
export const with_lock = withLock;

export function setLockBackend(backend: LockBackend | null): void {
  customBackend = backend;
}

export const set_lock_backend = setLockBackend;

export function clearNamedLocks(): void {
  locks.clear();
}

export const clear_named_locks = clearNamedLocks;

export function getLockName(name: string): string {
  return lockKey(name);
}

export const get_lock_name = getLockName;

function acquireNamedLock(key: string, timeout: number): Promise<() => void> {
  const state = locks.get(key) ?? { queue: [], held: false };
  locks.set(key, state);
  if (!state.held) {
    state.held = true;
    return Promise.resolve(() => {
      releaseNamedLock(key);
    });
  }

  return new Promise<() => void>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      const index = state.queue.indexOf(next);
      if (index >= 0) {
        state.queue.splice(index, 1);
      }
      reject(new Error(`Failed to acquire lock '${key}' (timeout=${String(timeout)}ms).`));
    }, timeout);

    const next = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      state.held = true;
      resolve(() => {
        releaseNamedLock(key);
      });
    };

    state.queue.push(next);
  });
}

function releaseNamedLock(key: string): void {
  const state = locks.get(key);
  if (!state) {
    return;
  }
  const next = state.queue.shift();
  if (next) {
    next();
    return;
  }
  state.held = false;
  locks.delete(key);
}

function lockKey(name: string): string {
  return `crewai:${createHash("md5").update(name).digest("hex")}`;
}
