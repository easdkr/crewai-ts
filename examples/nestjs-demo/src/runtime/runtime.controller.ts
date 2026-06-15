import { Controller, Get, Inject } from "@nestjs/common";
import {
  FUNCTION_CALLING_LLM,
  KNOWLEDGE,
  LLM,
  MEMORY,
  PLANNING_LLM,
  type KnowledgeSupply,
  type LLMSupply,
  type MemorySupply,
} from "@crewai-ts/nestjs";
import { LlmConfigService } from "../llm/llm-config.service.js";
import { describeSupply } from "../util/describe.js";

/**
 * Demonstrates direct injection of the module-level tokens:
 * `LLM`, `MEMORY`, `KNOWLEDGE`, `PLANNING_LLM`, `FUNCTION_CALLING_LLM`.
 */
@Controller("runtime")
export class RuntimeController {
  constructor(
    @Inject(LLM) private readonly llm: LLMSupply,
    @Inject(MEMORY) private readonly memory: MemorySupply,
    @Inject(KNOWLEDGE) private readonly knowledge: KnowledgeSupply,
    @Inject(PLANNING_LLM) private readonly planningLlm: LLMSupply,
    @Inject(FUNCTION_CALLING_LLM) private readonly functionCallingLlm: LLMSupply,
    @Inject(LlmConfigService) private readonly config: LlmConfigService,
  ) {}

  /** GET /runtime → a secret-safe summary of the wired AI runtime. */
  @Get()
  summary() {
    const recalled = this.memory?.recall("implementation") ?? [];
    return {
      defaultProvider: this.config.resolvedDefaultProvider(),
      availableProviders: this.config.available(),
      tokens: {
        LLM: describeSupply(this.llm),
        PLANNING_LLM: describeSupply(this.planningLlm),
        FUNCTION_CALLING_LLM: describeSupply(this.functionCallingLlm),
        MEMORY: (this.memory as { memoryKind?: string } | null)?.memoryKind ?? null,
        KNOWLEDGE: this.knowledge?.length ?? 0,
      },
      memoryRecall: recalled.map((m) => (m as { record?: { content?: string } }).record?.content ?? String(m)),
    };
  }
}
