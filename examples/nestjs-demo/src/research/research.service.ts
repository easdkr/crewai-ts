import { randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  AgentFactory,
  CREW_FACTORY,
  LLM_REGISTRY,
  LlmRegistryService,
  type CrewFactory,
} from "@crewai-ts/nestjs";
import { LlmConfigService } from "../llm/llm-config.service.js";
import {
  ResearchBriefingFlow,
  type ResearchDepth,
  type ResearchFlowInput,
  type ResearchWorkflowResult,
} from "./research-flow.js";

export type ResearchRunOptions = {
  provider?: string;
  depth?: ResearchDepth;
  audience?: string;
  riskTolerance?: "low" | "medium" | "high";
  requireRiskReview?: boolean;
};

export type ResearchRunResult = ResearchWorkflowResult & {
  workflow: {
    id: string;
    route: string | null;
    methodTrace: Array<{
      methodName: string;
      kind: string;
      routerPath: string | null;
    }>;
  };
};

/**
 * The core "does it actually work end-to-end" path:
 * `AgentFactory.create` (x2) → `CREW_FACTORY.create` → `crew.kickoff` (LIVE LLM call).
 *
 * Demonstrates: `AgentFactory`, `CREW_FACTORY`/`DefaultCrewFactory`,
 * `LLM_REGISTRY` (per-agent LLM override by provider name), and the default
 * LLM falling through from the `LLM` token.
 */
@Injectable()
export class ResearchService {
  // NOTE: every dependency is injected with an explicit `@Inject(...)`. The
  // tsx/esbuild runner does not emit `design:paramtypes` decorator metadata, so
  // type-based DI would resolve to `undefined`. Explicit tokens are metadata-free.
  constructor(
    @Inject(AgentFactory) private readonly agentFactory: AgentFactory,
    @Inject(CREW_FACTORY) private readonly crewFactory: CrewFactory,
    @Inject(LLM_REGISTRY) private readonly registry: LlmRegistryService,
    @Inject(LlmConfigService) private readonly config: LlmConfigService,
  ) {}

  async run(topic: string, options: ResearchRunOptions = {}): Promise<ResearchRunResult> {
    if (options.provider) {
      if (!this.registry.has(options.provider)) {
        throw new BadRequestException(
          `Unknown provider '${options.provider}'. Registered: ${this.registry.names().join(", ")}.`,
        );
      }
    }

    const flow = new ResearchBriefingFlow({
      agentFactory: this.agentFactory,
      crewFactory: this.crewFactory,
      registry: this.registry,
      config: this.config,
    });
    const input: ResearchFlowInput = {
      id: randomUUID(),
      topic,
      ...(options.provider ? { provider: options.provider } : {}),
      ...(options.depth ? { depth: options.depth } : {}),
      ...(options.audience ? { audience: options.audience } : {}),
      ...(options.riskTolerance ? { riskTolerance: options.riskTolerance } : {}),
      ...(options.requireRiskReview === undefined ? {} : { requireRiskReview: options.requireRiskReview }),
    };
    const result = await flow.kickoff({ inputs: input }) as ResearchWorkflowResult;
    const state = flow.stateSnapshot();

    return {
      ...result,
      workflow: {
        id: String(state.id ?? input.id),
        route: typeof state.route === "string" ? state.route : null,
        methodTrace: flow.executionTrace.map((entry) => ({
          methodName: entry.methodName,
          kind: entry.kind,
          routerPath: entry.routerPath,
        })),
      },
    };
  }
}
