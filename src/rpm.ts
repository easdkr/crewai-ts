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

  constructor(options: number | { maxRpm?: number | null; max_rpm?: number | null } = {}) {
    const maxRpm = typeof options === "number"
      ? options
      : options.maxRpm ?? options.max_rpm ?? null;
    super(maxRpm ?? Number.MAX_SAFE_INTEGER);
    this.max_rpm = maxRpm;
  }

  checkOrWait(): boolean {
    void this.waitForSlot();
    return true;
  }

  check_or_wait(): boolean {
    return this.checkOrWait();
  }

  resetCounter(): this {
    this.reset();
    return this;
  }

  reset_counter(): this {
    return this.resetCounter();
  }

  stopRpmCounter(): void {
    this.reset();
  }

  stop_rpm_counter(): void {
    this.stopRpmCounter();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
