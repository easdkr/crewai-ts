import { BadRequestException } from "@nestjs/common";
import { Task } from "@crewai-ts/core";
import { Flow, listen, or_, router, start, type FlowContext, type FlowRuntime } from "@crewai-ts/flow";
import {
  AgentFactory,
  type CrewFactory,
  type LLMSupply,
  type LlmRegistryService,
} from "@crewai-ts/nestjs";
import { LlmConfigService, type DemoProvider } from "../llm/llm-config.service.js";

export type ResearchDepth = "standard" | "deep";

export type ResearchFlowInput = {
  id: string;
  topic: string;
  provider?: string;
  depth?: ResearchDepth;
  audience?: string;
  riskTolerance?: "low" | "medium" | "high";
  requireRiskReview?: boolean;
};

export type ResearchAuditEntry = {
  step: string;
  message: string;
  data?: Record<string, unknown>;
};

export type ResearchWorkflowState = {
  id?: string;
  topic?: string;
  provider?: string;
  requestedProvider?: string;
  selectedRegistryKey?: string;
  availableProviders: string[];
  audience: string;
  riskTolerance: "low" | "medium" | "high";
  depth: ResearchDepth;
  requireRiskReview: boolean;
  route?: "standard_path" | "deep_path";
  rawBrief?: string;
  revisedBrief?: string;
  output?: string;
  qualityScore: number;
  riskScore: number;
  warnings: string[];
  nextActions: string[];
  audit: ResearchAuditEntry[];
};

export type ResearchWorkflowResult = {
  provider: string;
  requestedProvider?: string;
  topic: string;
  depth: ResearchDepth;
  qualityScore: number;
  riskScore: number;
  warnings: string[];
  nextActions: string[];
  output: string;
  audit: ResearchAuditEntry[];
};

export type ResearchFlowDeps = {
  agentFactory: AgentFactory;
  crewFactory: CrewFactory;
  registry: LlmRegistryService;
  config: LlmConfigService;
};

export interface ResearchBriefingFlow extends FlowRuntime<ResearchWorkflowState> {}

@Flow<ResearchWorkflowState>({
  initialState: () => ({
    availableProviders: [],
    audience: "backend engineers",
    riskTolerance: "medium",
    depth: "standard",
    requireRiskReview: false,
    qualityScore: 0,
    riskScore: 0,
    warnings: [],
    nextActions: [],
    audit: [],
  }),
})
export class ResearchBriefingFlow {
  constructor(private readonly deps: ResearchFlowDeps) {}

  @start()
  begin(ctx: FlowContext<ResearchWorkflowState>, input: ResearchFlowInput) {
    const topic = input.topic.trim();
    if (topic.length < 4) {
      throw new BadRequestException("topic must be at least 4 characters.");
    }

    const available = [...this.deps.registry.names()];
    const requested = input.provider?.trim();
    if (requested && !this.deps.registry.has(requested)) {
      throw new BadRequestException(
        `Unknown provider '${requested}'. Registered: ${available.join(", ")}.`,
      );
    }

    const selectedRegistryKey = requested || "default";
    const selectedProvider = selectedRegistryKey === "default"
      ? this.deps.config.resolvedDefaultProvider()
      : selectedRegistryKey;
    const depth = input.depth ?? (topic.length > 48 || input.requireRiskReview ? "deep" : "standard");

    ctx.state.id = input.id;
    ctx.state.topic = topic;
    ctx.state.requestedProvider = requested;
    ctx.state.selectedRegistryKey = selectedRegistryKey;
    ctx.state.provider = selectedProvider;
    ctx.state.availableProviders = available;
    ctx.state.audience = input.audience?.trim() || "backend engineers";
    ctx.state.riskTolerance = input.riskTolerance ?? "medium";
    ctx.state.depth = depth;
    ctx.state.requireRiskReview = input.requireRiskReview ?? depth === "deep";
    this.audit(ctx, "begin", "Validated request and resolved provider.", {
      selectedRegistryKey,
      selectedProvider,
      depth,
    });

    return {
      topic,
      selectedRegistryKey,
      selectedProvider,
      depth,
    };
  }

  @router("begin")
  routeWork(ctx: FlowContext<ResearchWorkflowState>) {
    const route = ctx.state.depth === "deep" ? "deep_path" : "standard_path";
    ctx.state.route = route;
    this.audit(ctx, "routeWork", `Selected ${route}.`);
    return route;
  }

  @listen("standard_path")
  async runStandardResearch(ctx: FlowContext<ResearchWorkflowState>) {
    const brief = await this.runCrew(ctx, {
      mode: "standard",
      wordLimit: 140,
      sections: ["implementation brief", "risks", "next steps"],
    });
    ctx.state.rawBrief = brief;
    this.audit(ctx, "runStandardResearch", "Completed standard live crew kickoff.");
    return brief;
  }

  @listen("deep_path")
  async runDeepResearch(ctx: FlowContext<ResearchWorkflowState>) {
    const brief = await this.runCrew(ctx, {
      mode: "deep",
      wordLimit: 220,
      sections: ["context", "architecture", "risks", "rollout checks", "next steps"],
    });
    ctx.state.rawBrief = brief;
    this.audit(ctx, "runDeepResearch", "Completed deep live crew kickoff.");
    return brief;
  }

  @listen(or_("runStandardResearch", "runDeepResearch"))
  assessQuality(ctx: FlowContext<ResearchWorkflowState>, brief: string) {
    const normalized = brief.trim();
    const hasRisks = /\brisk|주의|위험|trade[- ]?off/i.test(normalized);
    const hasNextSteps = /\bnext|step|rollout|검증|후속/i.test(normalized);
    const hasEnoughDetail = normalized.length >= (ctx.state.depth === "deep" ? 320 : 160);
    const qualityScore = [hasRisks, hasNextSteps, hasEnoughDetail].filter(Boolean).length;
    const riskScore = this.estimateRiskScore(normalized, ctx.state.riskTolerance);

    ctx.state.qualityScore = qualityScore;
    ctx.state.riskScore = riskScore;
    ctx.state.warnings = [
      ...(hasRisks ? [] : ["missing-risk-section"]),
      ...(hasNextSteps ? [] : ["missing-next-actions"]),
      ...(hasEnoughDetail ? [] : ["brief-too-thin"]),
      ...(riskScore >= 3 ? ["high-risk-topic"] : []),
    ];
    ctx.state.nextActions = this.deriveNextActions(ctx.state.warnings, ctx.state.depth);
    this.audit(ctx, "assessQuality", "Scored deterministic quality and risk gates.", {
      qualityScore,
      riskScore,
      warnings: ctx.state.warnings,
    });
    return { qualityScore, riskScore };
  }

  @router("assessQuality")
  qualityGate(ctx: FlowContext<ResearchWorkflowState>) {
    const mustRevise = ctx.state.qualityScore < 2 || (ctx.state.requireRiskReview && ctx.state.riskScore >= 3);
    const route = mustRevise ? "revision_path" : "finalize_path";
    this.audit(ctx, "qualityGate", `Selected ${route}.`);
    return route;
  }

  @listen("revision_path")
  tightenBrief(ctx: FlowContext<ResearchWorkflowState>) {
    const brief = ctx.state.rawBrief ?? "";
    const additions = [
      ctx.state.warnings.includes("missing-risk-section")
        ? "Risk: validate provider credentials, latency, and fallback behavior before rollout."
        : null,
      ctx.state.warnings.includes("missing-next-actions")
        ? "Next steps: add CI smoke coverage, pin provider models, and monitor live error rate."
        : null,
      ctx.state.warnings.includes("high-risk-topic")
        ? "Guardrail: use a staged rollout with rollback criteria and request logging."
        : null,
    ].filter((line): line is string => Boolean(line));

    ctx.state.revisedBrief = [brief, ...additions].filter(Boolean).join("\n\n");
    this.audit(ctx, "tightenBrief", "Applied deterministic revision after quality gate.", {
      additions: additions.length,
    });
    return ctx.state.revisedBrief;
  }

  @listen(or_("finalize_path", "tightenBrief"))
  finalize(ctx: FlowContext<ResearchWorkflowState>) {
    const output = ctx.state.revisedBrief ?? ctx.state.rawBrief ?? "";
    ctx.state.output = output;
    this.audit(ctx, "finalize", "Finalized workflow response.", {
      outputLength: output.length,
    });
    return {
      provider: ctx.state.provider ?? this.deps.config.resolvedDefaultProvider(),
      ...(ctx.state.requestedProvider ? { requestedProvider: ctx.state.requestedProvider } : {}),
      topic: ctx.state.topic ?? "",
      depth: ctx.state.depth,
      qualityScore: ctx.state.qualityScore,
      riskScore: ctx.state.riskScore,
      warnings: ctx.state.warnings,
      nextActions: ctx.state.nextActions,
      output,
      audit: ctx.state.audit,
    } satisfies ResearchWorkflowResult;
  }

  private async runCrew(
    ctx: FlowContext<ResearchWorkflowState>,
    options: {
      mode: ResearchDepth;
      wordLimit: number;
      sections: string[];
    },
  ): Promise<string> {
    const llm = this.resolveLlm(ctx.state.selectedRegistryKey ?? "default");
    const topic = ctx.state.topic ?? "";
    const audience = ctx.state.audience;
    const provider = ctx.state.provider ?? this.deps.config.resolvedDefaultProvider();
    const researcher = this.deps.agentFactory.create({
      role: `${options.mode} researcher`,
      goal: `Find practical implementation details for ${topic}`,
      backstory: "You turn ambiguous product requests into concrete engineering constraints.",
      llm,
    });
    const writer = this.deps.agentFactory.create({
      role: "implementation brief writer",
      goal: `Write a concise brief for ${audience}`,
      backstory: "You produce rollout-ready notes with risks and concrete validation steps.",
      llm,
    });
    const task = new Task({
      description: [
        `Topic: ${topic}`,
        `Provider: ${provider}`,
        `Audience: ${audience}`,
        `Mode: ${options.mode}`,
        `Write <= ${options.wordLimit} words.`,
        `Include these sections: ${options.sections.join(", ")}.`,
        "Be concrete enough that a backend engineer can turn it into a PR checklist.",
      ].join("\n"),
      expectedOutput: "A concise implementation brief with risk notes and next actions.",
      agent: writer,
    });
    const crew = this.deps.crewFactory.create({
      agents: [researcher, writer],
      tasks: [task],
      memory: false,
    });
    const result = await ctx.kickoffCrew(crew, {
      inputs: {
        topic,
        provider,
        audience,
        depth: options.mode,
      },
    });
    return result.raw;
  }

  private resolveLlm(provider: string): LLMSupply {
    if (!this.deps.registry.has(provider)) {
      throw new BadRequestException(
        `Unknown provider '${provider}'. Registered: ${this.deps.registry.names().join(", ")}.`,
      );
    }
    return this.deps.registry.get(provider);
  }

  private estimateRiskScore(brief: string, tolerance: ResearchWorkflowState["riskTolerance"]): number {
    const riskTerms = ["migration", "production", "credentials", "latency", "rollback", "security", "data"];
    const hits = riskTerms.filter((term) => brief.toLowerCase().includes(term)).length;
    const tolerancePenalty = tolerance === "low" ? 1 : tolerance === "high" ? -1 : 0;
    return Math.max(0, Math.min(4, hits + tolerancePenalty));
  }

  private deriveNextActions(warnings: readonly string[], depth: ResearchDepth): string[] {
    return [
      "Run the live NestJS smoke test against the selected provider.",
      depth === "deep" ? "Review rollout and rollback criteria before merge." : "Keep the PR scoped to the validated path.",
      ...(warnings.length > 0 ? ["Address deterministic quality warnings before publishing docs."] : []),
    ];
  }

  private audit(
    ctx: FlowContext<ResearchWorkflowState>,
    step: string,
    message: string,
    data?: Record<string, unknown>,
  ): void {
    ctx.state.audit.push({
      step,
      message,
      ...(data ? { data } : {}),
    });
  }
}
