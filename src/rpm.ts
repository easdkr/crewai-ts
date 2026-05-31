export class RpmController {
  readonly maxRpm: number;
  private nextRequestAt = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(maxRpm: number) {
    if (!Number.isFinite(maxRpm) || maxRpm <= 0) {
      throw new Error("maxRpm must be a positive number.");
    }
    this.maxRpm = maxRpm;
  }

  async waitForSlot(): Promise<void> {
    const current = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await current;
    try {
      const now = performance.now();
      const waitMs = Math.max(0, this.nextRequestAt - now);
      if (waitMs > 0) {
        await delay(waitMs);
      }
      this.nextRequestAt = performance.now() + (60_000 / this.maxRpm);
    } finally {
      release();
    }
  }

  reset(): void {
    this.nextRequestAt = 0;
    this.queue = Promise.resolve();
  }
}

export class RPMController extends RpmController {
  readonly max_rpm: number | null;
  _current_rpm = 0;
  private rpmResetTimer: ReturnType<typeof setTimeout> | null = null;
  private rpmShutdownFlag = false;

  constructor(options: number | { maxRpm?: number | null; max_rpm?: number | null } = {}) {
    const maxRpm = typeof options === "number"
      ? options
      : options.maxRpm ?? options.max_rpm ?? null;
    super(maxRpm ?? Number.MAX_SAFE_INTEGER);
    this.max_rpm = maxRpm;
    if (this.max_rpm !== null) {
      this._reset_request_count();
    }
  }

  checkOrWait(): boolean {
    if (this.max_rpm === null) {
      return true;
    }
    if (this._current_rpm < this.max_rpm) {
      this._current_rpm += 1;
      void this.waitForSlot();
      return true;
    }
    void this._wait_for_next_minute().then(() => {
      this._current_rpm = 1;
    });
    return true;
  }

  check_or_wait(): boolean {
    return this.checkOrWait();
  }

  resetCounter(): this {
    this._reset_request_count();
    return this;
  }

  reset_counter(): this {
    return this.resetCounter();
  }

  stopRpmCounter(): void {
    this.rpmShutdownFlag = true;
    if (this.rpmResetTimer) {
      clearTimeout(this.rpmResetTimer);
      this.rpmResetTimer = null;
    }
    this.reset();
  }

  stop_rpm_counter(): void {
    this.stopRpmCounter();
  }

  async _wait_for_next_minute(): Promise<void> {
    await delay(60_000);
    this._current_rpm = 0;
  }

  _reset_request_count(): void {
    this._current_rpm = 0;
    this.reset();
    if (this.rpmResetTimer) {
      clearTimeout(this.rpmResetTimer);
      this.rpmResetTimer = null;
    }
    if (!this.rpmShutdownFlag && this.max_rpm !== null) {
      this.rpmResetTimer = setTimeout(() => {
        this._reset_request_count();
      }, 60_000);
      this.rpmResetTimer.unref();
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
