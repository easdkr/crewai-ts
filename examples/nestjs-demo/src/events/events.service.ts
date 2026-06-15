import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { EventBusService } from "@crewai-ts/nestjs";

interface CapturedEvent {
  type: string;
  at: string;
}

/** Crew/task lifecycle events emitted during `kickoff()`. */
const SUBSCRIBED = [
  "crew_kickoff_started",
  "crew_kickoff_completed",
  "crew_kickoff_failed",
  "task_started",
  "task_completed",
  "task_failed",
] as const;

/**
 * Demonstrates `EVENT_BUS` / `EventBusService`: `on()` at startup, a captured
 * ring buffer, `emit()`, `off()`, and `destroy()` on shutdown (removes only
 * THIS service's handlers — global `crewaiEventBus` consumers are preserved).
 */
@Injectable()
export class EventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsService.name);
  private readonly captured: CapturedEvent[] = [];

  // Bound once so the same reference can be passed to on()/off().
  private readonly handler = (event: unknown): void => {
    const type = (event as { type?: string })?.type ?? "unknown";
    this.captured.push({ type, at: new Date().toISOString() });
    if (this.captured.length > 50) this.captured.shift();
  };

  constructor(@Inject(EventBusService) private readonly bus: EventBusService) {}

  onModuleInit(): void {
    for (const type of SUBSCRIBED) this.bus.on(type, this.handler);
    this.logger.log(`Subscribed to: ${SUBSCRIBED.join(", ")}`);
  }

  onModuleDestroy(): void {
    this.bus.destroy();
  }

  list(): { count: number; captured: CapturedEvent[] } {
    return { count: this.captured.length, captured: this.captured.slice(-20) };
  }

  /** Emit a custom event on the shared bus (handlers receive the payload). */
  emit(type: string): { emitted: string } {
    this.bus.emit({ type });
    return { emitted: type };
  }

  /** Unsubscribe from a single event type (demonstrates off()). */
  off(type: string): { unsubscribed: string } {
    this.bus.off(type, this.handler);
    return { unsubscribed: type };
  }

  clear(): void {
    this.captured.length = 0;
  }
}
