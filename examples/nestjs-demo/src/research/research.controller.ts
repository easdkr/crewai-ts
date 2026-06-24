import { Body, Controller, Inject, Post } from "@nestjs/common";
import { ResearchService } from "./research.service.js";
import type { ResearchDepth } from "./research-flow.js";

interface RunBody {
  topic?: string;
  /** Optional registry name: openai | gemini | anthropic | default. */
  provider?: string;
  depth?: ResearchDepth;
  audience?: string;
  riskTolerance?: "low" | "medium" | "high";
  requireRiskReview?: boolean;
}

@Controller("research")
export class ResearchController {
  constructor(@Inject(ResearchService) private readonly research: ResearchService) {}

  /**
   * POST /research { "topic": "...", "provider": "openai" }
   * Runs the live multi-step Flow-backed research workflow.
   */
  @Post()
  run(@Body() body: RunBody) {
    const topic = body?.topic?.trim() || "dependency injection in NestJS";
    return this.research.run(topic, {
      ...(body?.provider?.trim() ? { provider: body.provider.trim() } : {}),
      ...(body?.depth ? { depth: body.depth } : {}),
      ...(body?.audience?.trim() ? { audience: body.audience.trim() } : {}),
      ...(body?.riskTolerance ? { riskTolerance: body.riskTolerance } : {}),
      ...(body?.requireRiskReview === undefined ? {} : { requireRiskReview: body.requireRiskReview }),
    });
  }
}
