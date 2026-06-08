type Waiter = {
  kind: "read" | "write";
  resolve: () => void;
};

export class RWLock {
  private readers = 0;
  private writer = false;
  private readonly waiters: Waiter[] = [];

  async rAcquire(): Promise<void> {
    if (!this.writer && !this.hasWaitingWriter()) {
      this.readers += 1;
      return;
    }
    await new Promise<void>((resolve) => {
      this.waiters.push({ kind: "read", resolve });
    });
  }

  r_acquire(): Promise<void> {
    return this.rAcquire();
  }

  rRelease(): void {
    if (this.readers <= 0) {
      throw new Error("Cannot release read lock that is not held.");
    }
    this.readers -= 1;
    if (this.readers === 0) {
      this.drainWaiters();
    }
  }

  r_release(): void {
    this.rRelease();
  }

  async wAcquire(): Promise<void> {
    if (!this.writer && this.readers === 0) {
      this.writer = true;
      return;
    }
    await new Promise<void>((resolve) => {
      this.waiters.push({ kind: "write", resolve });
    });
  }

  w_acquire(): Promise<void> {
    return this.wAcquire();
  }

  wRelease(): void {
    if (!this.writer) {
      throw new Error("Cannot release write lock that is not held.");
    }
    this.writer = false;
    this.drainWaiters();
  }

  w_release(): void {
    this.wRelease();
  }

  async withReadLock<T>(fn: () => T | Promise<T>): Promise<T> {
    await this.rAcquire();
    try {
      return await fn();
    } finally {
      this.rRelease();
    }
  }

  r_locked<T>(fn: () => T | Promise<T>): Promise<T> {
    return this.withReadLock(fn);
  }

  async withWriteLock<T>(fn: () => T | Promise<T>): Promise<T> {
    await this.wAcquire();
    try {
      return await fn();
    } finally {
      this.wRelease();
    }
  }

  w_locked<T>(fn: () => T | Promise<T>): Promise<T> {
    return this.withWriteLock(fn);
  }

  get activeReaders(): number {
    return this.readers;
  }

  get hasWriter(): boolean {
    return this.writer;
  }

  private hasWaitingWriter(): boolean {
    return this.waiters.some((waiter) => waiter.kind === "write");
  }

  private drainWaiters(): void {
    if (this.writer || this.readers > 0) {
      return;
    }
    const next = this.waiters.shift();
    if (!next) {
      return;
    }
    if (next.kind === "write") {
      this.writer = true;
      next.resolve();
      return;
    }
    this.readers += 1;
    next.resolve();
    while (this.waiters[0]?.kind === "read") {
      const reader = this.waiters.shift();
      if (!reader) {
        break;
      }
      this.readers += 1;
      reader.resolve();
    }
  }
}
