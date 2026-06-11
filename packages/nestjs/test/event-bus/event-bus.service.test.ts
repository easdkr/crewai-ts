import { describe, it, expect, beforeEach, vi } from "vitest";
import { crewaiEventBus, type EventHandler } from "@crewai-ts/core";
import { EventBusService } from "../../src/event-bus/event-bus.service.js";

// The bus's `on` overloads only accept the closed EventType string union.
// These tests register handlers for arbitrary event names, so widen the type
// at the test boundary — same runtime behavior, the union is compile-time.
const bus = crewaiEventBus as unknown as {
  on(type: string, handler: EventHandler): () => void;
};

describe("EventBusService", () => {
  let service: EventBusService;

  beforeEach(() => {
    service = new EventBusService();
  });

  it("on() returns an unsubscribe function", () => {
    const handler = vi.fn();
    const off = service.on("test:returns-off", handler);
    expect(typeof off).toBe("function");
  });

  it("on() + emit() calls the handler with the event", () => {
    const handler = vi.fn();
    service.on("test:on-emit", handler);
    service.emit({ type: "test:on-emit", payload: 1 });
    expect(handler).toHaveBeenCalledTimes(1);
    // EventBus mutates the event with runtime metadata (eventId,
    // previousEventId, triggeredByEventId, parentEventId) before dispatch.
    // Assert on the type/payload fields, not full object equality.
    const received = handler.mock.calls[0]?.[0] as { type: string; payload: number };
    expect(received).toMatchObject({ type: "test:on-emit", payload: 1 });
  });

  it("off() removes the handler", () => {
    const handler = vi.fn();
    service.on("test:off", handler);
    service.off("test:off", handler);
    service.emit({ type: "test:off", payload: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it("destroy() removes tracked handlers only (isolation)", () => {
    const directHandler = vi.fn();
    const serviceHandler = vi.fn();
    const off = bus.on("test:isolation", directHandler);
    service.on("test:isolation", serviceHandler);

    // Both handlers fire while service is alive.
    service.emit({ type: "test:isolation", payload: 1 });
    expect(directHandler).toHaveBeenCalledTimes(1);
    expect(serviceHandler).toHaveBeenCalledTimes(1);

    // Destroying the service must NOT touch direct bus registrations.
    service.destroy();
    service.emit({ type: "test:isolation", payload: 2 });
    expect(directHandler).toHaveBeenCalledTimes(2);
    expect(serviceHandler).toHaveBeenCalledTimes(1);

    off();
  });

  it("destroy() calls all tracked offFns (multiple on() for the same type)", () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    service.on("test:multi", h1);
    service.on("test:multi", h2);

    service.destroy();

    service.emit({ type: "test:multi", payload: 1 });
    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it("emit() delegates to the underlying bus", () => {
    const handler = vi.fn();
    const off = bus.on("test:delegate", handler);
    service.emit({ type: "test:delegate", payload: "x" });
    expect(handler).toHaveBeenCalledTimes(1);
    off();
  });

  it("off() with unknown type is a no-op (no throw)", () => {
    const handler = vi.fn();
    expect(() => service.off("test:off-unknown-type", handler)).not.toThrow();
  });

  it("off() with unknown handler is a no-op (no throw)", () => {
    service.on("test:off-unknown-handler", () => {});
    expect(() => service.off("test:off-unknown-handler", () => {})).not.toThrow();
    service.destroy(); // cleanup
  });

  it("off() called twice for the same handler is idempotent (no throw)", () => {
    const handler = vi.fn();
    service.on("test:off-double", handler);
    service.off("test:off-double", handler);
    expect(() => service.off("test:off-double", handler)).not.toThrow();
  });
});
