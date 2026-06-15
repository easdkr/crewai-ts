import { Body, Controller, Delete, Get, Inject, Param, Post } from "@nestjs/common";
import { EventsService } from "./events.service.js";

/** HTTP surface for the `EventBusService` demo. */
@Controller("events")
export class EventsController {
  constructor(@Inject(EventsService) private readonly events: EventsService) {}

  /** GET /events → recently captured crew/task events. */
  @Get()
  list() {
    return this.events.list();
  }

  /** POST /events/emit { "type": "demo_event" } → emit a custom event. */
  @Post("emit")
  emit(@Body() body: { type?: string }) {
    return this.events.emit(body?.type?.trim() || "demo_event");
  }

  /** DELETE /events/subscription/:type → unsubscribe one handler (off()). */
  @Delete("subscription/:type")
  off(@Param("type") type: string) {
    return this.events.off(type);
  }
}
