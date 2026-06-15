import { Body, Controller, Inject, Post } from "@nestjs/common";
import { ResearchService } from "./research.service.js";

interface RunBody {
  topic?: string;
  /** Optional registry name: openai | gemini | anthropic | default. */
  provider?: string;
}

@Controller("research")
export class ResearchController {
  constructor(@Inject(ResearchService) private readonly research: ResearchService) {}

  /**
   * POST /research { "topic": "...", "provider": "openai" }
   * Runs a 2-agent crew and returns the LIVE LLM output.
   */
  @Post()
  run(@Body() body: RunBody) {
    const topic = body?.topic?.trim() || "dependency injection in NestJS";
    return this.research.run(topic, body?.provider?.trim() || undefined);
  }
}
