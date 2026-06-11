import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  crewaiEventBus,
  type CrewAIEvent,
  type EventBus,
  type EventHandler,
} from "@crewai-ts/core";
import { EVENT_BUS } from "../tokens.js";

/**
 * A simple 1-arg handler shape: receives the event payload directly.
 * This is the public surface of `EventBusService`; the underlying
 * `EventBus` uses a richer `(source, event, runtimeState)` signature
 * which this service hides from Nest consumers.
 */
type Handler = (event: unknown) => void;

/**
 * Nest-friendly facade over `crewaiEventBus`.
 *
 * Handlers registered via `on()` are tracked so that `destroy()` can remove
 * ONLY this service's handlers. Handlers registered directly on the global
 * `crewaiEventBus` are NOT touched by `destroy()` — that would clobber
 * non-Nest consumers (Flows, other modules, etc.).
 *
 * No `OnModuleDestroy` is used (0 occurrences in repo; brand-new pattern).
 * Callers must invoke `destroy()` explicitly.
 */
@Injectable()
export class EventBusService {
  private readonly handlers = new Map<string, Map<Handler, () => void>>();

  constructor(
    @Optional() @Inject(EVENT_BUS) private readonly bus: EventBus = crewaiEventBus,
  ) {}

  /**
   * Register a handler for `type`. Returns the bus-provided unsubscribe
   * function. The handler is called with the event payload only — the
   * underlying `(source, event, runtimeState)` signature is hidden.
   */
  on(type: string, handler: Handler): () => void {
    const wrapped: EventHandler = (_source, event) => {
      handler(event);
    };
    // Widen EventBus.on's narrow EventType union to `string` — the bus
    // accepts any string at runtime, the union is a compile-time contract.
    // `.bind(this.bus)` keeps the `this` binding that `addHandler` requires.
    const busOn = this.bus.on.bind(this.bus) as (t: string, h: EventHandler) => () => void;
    const offFn = busOn(type, wrapped);

    let typeMap = this.handlers.get(type);
    if (!typeMap) {
      typeMap = new Map();
      this.handlers.set(type, typeMap);
    }
    typeMap.set(handler, offFn);

    return offFn;
  }

  /**
   * Remove a previously registered handler. No-op if `handler` was never
   * registered for `type` (or was already removed).
   */
  off(type: string, handler: Handler): void {
    const typeMap = this.handlers.get(type);
    if (!typeMap) {
      return;
    }
    const offFn = typeMap.get(handler);
    if (!offFn) {
      return;
    }
    offFn();
    typeMap.delete(handler);
    if (typeMap.size === 0) {
      this.handlers.delete(type);
    }
  }

  /**
   * Emit `event` on the underlying bus. The event's `type` field is the
   * same string the receiving handler was registered for.
   */
  emit(event: { type: string; [key: string]: unknown }): void {
    this.bus.emit(null, event as unknown as CrewAIEvent);
  }

  /**
   * Removes ONLY handlers this service registered. Direct `bus.on()` calls
   * are preserved. Does NOT call `this.bus.clear()` or
   * `this.bus.removeAllListeners()` — that would wipe non-Nest consumers
   * that share the global `crewaiEventBus` singleton.
   *
   * A faulty offFn is swallowed so one bad registration cannot block the
   * removal of the rest. The handler map is cleared even if any offFn
   * throws, so the service ends in a clean state.
   */
  destroy(): void {
    for (const typeMap of this.handlers.values()) {
      for (const offFn of typeMap.values()) {
        try {
          offFn();
        } catch {
          // swallow — a faulty offFn must not block other removals
        }
      }
      typeMap.clear();
    }
    this.handlers.clear();
  }
}
