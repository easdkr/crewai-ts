import { Module } from "@nestjs/common";
import { LlmConfigService } from "./llm-config.service.js";

/**
 * Provides {@link LlmConfigService}. Imported by `CrewModule.forRootAsync` so
 * the async factory can inject it, and re-exported so controllers can read the
 * resolved provider configuration.
 */
@Module({
  providers: [LlmConfigService],
  exports: [LlmConfigService],
})
export class LlmConfigModule {}
