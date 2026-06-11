import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  Agent,
  type BaseTool,
  type LLM as LLMType,
} from "@crewai-ts/core";
import {
  AGENT_REGISTRY,
  FUNCTION_CALLING_LLM,
  LLM,
  LLM_REGISTRY,
  type LLMSupply,
} from "../tokens.js";
import { LlmRegistryService } from "../registry/llm-registry.js";
import { AgentRegistryService } from "../agents/agent-registry.js";
import {
  emitDeprecationWarning,
  LEGACY_LLM_FIELD_WARNING,
} from "../deprecation.js";

const NOOP_LLM = (): string => "";

/**
 * Agent factory options (v0.3.0).
 *
 * - `llm` accepts 4 forms: registry name (string) | LLM instance | LLM function | LLM token.
 *   A string is resolved against the registry; if not found, the string is passed
 *   through verbatim (delegates to core's `createLLM` later).
 * - `planningLlm` / `functionCallingLlm` accept the same 4 forms and default to
 *   the module-level `PLANNING_LLM` / `FUNCTION_CALLING_LLM` tokens when supplied.
 * - `tools` is per-agent (no crew-level `tools` token — tools are attached at
 *   the agent level).
 *
 * The legacy `llm` field is deprecated; a `DeprecationWarning` is emitted
 * whenever it is set. The runtime still honors it for backward compatibility.
 */
export interface AgentFactoryOptions {
  role: string;
  goal: string;
  backstory: string;
  /** @deprecated since 0.3.0 — use `llms.default` in forRoot. Per-agent override still supported. */
  llm?: LLMSupply;
  planningLlm?: LLMSupply;
  functionCallingLlm?: LLMSupply;
  tools?: readonly BaseTool[];
}

@Injectable()
export class AgentFactory {
  constructor(
    @Optional() @Inject(LLM) private readonly defaultLlm: LLMType | string | null = null,
    @Optional() @Inject(LLM_REGISTRY) private readonly registry: LlmRegistryService | null = null,
    @Optional() @Inject(AGENT_REGISTRY) private readonly agentRegistry: AgentRegistryService | null = null,
    @Optional() @Inject(FUNCTION_CALLING_LLM) private readonly defaultFunctionCallingLlm: LLMSupply = null,
  ) {}

  create(options: AgentFactoryOptions): Agent {
    // 1. Pre-built Agent from registry: skip everything else (T8).
    if (this.agentRegistry?.has(options.role)) {
      return this.agentRegistry.get(options.role);
    }

    // 2. Emit deprecation warning if the legacy `llm` field is set.
    if ("llm" in options && options.llm !== undefined) {
      emitDeprecationWarning(LEGACY_LLM_FIELD_WARNING);
    }

    // 3. Resolve the LLM forms: function/object (identity) | registered name
    //    | unregistered string (registry non-empty: throw) | null fallback.
    //    `planningLlm` is accepted in the input for API uniformity with the
    //    crew factory; core's `Agent` has no `planningLlm` field, so the
    //    value is dropped. `functionCallingLlm` is optional (required=false).
    const effectiveLlm = this.resolveLlm(options.llm ?? this.defaultLlm, true);
    const effectiveFunctionCallingLlm = this.resolveLlm(
      options.functionCallingLlm ?? this.defaultFunctionCallingLlm,
      false,
    );

    return new Agent({
      role: options.role,
      goal: options.goal,
      backstory: options.backstory,
      llm: effectiveLlm as LLMType | string | null,
      ...(effectiveFunctionCallingLlm !== null && effectiveFunctionCallingLlm !== undefined
        ? { functionCallingLlm: effectiveFunctionCallingLlm as LLMType | string | null }
        : {}),
      ...(options.tools ? { tools: [...options.tools] } : {}),
    });
  }

  /**
   * Resolve a possibly-string-or-value LLM into an `LLMSupply`. The
   * 4-form contract:
   *   1. function/object (LLMClient) → return as-is.
   *   2. string in registry → return registered entry.
   *   3. string not in registry, registry non-empty → throw via
   *      `registry.get()` (catches name typos at agent-construction time).
   *   4. string not in registry, registry empty → return verbatim.
   *   5. null/undefined + empty registry → NOOP_LLM (legacy path).
   *   6. null/undefined + non-empty registry → throw descriptive error.
   */
  private resolveLlm(value: LLMSupply | undefined | null, required: boolean): LLMSupply {
    if (value === null || value === undefined) {
      if (!this.registry || this.registry.names().length === 0) {
        return NOOP_LLM;
      }
      if (!required) {
        return null;
      }
      throw new Error(
        `AgentFactory.create: no LLM supplied but registry is non-empty. ` +
          `Registered: ${this.registry.names().join(", ")}. ` +
          `Use llms.default in forRoot or pass llm / planningLlm / functionCallingLlm explicitly.`,
      );
    }
    if (typeof value === "string") {
      if (this.registry?.has(value)) {
        return this.registry.get(value);
      }
      if (this.registry && this.registry.names().length > 0) {
        return this.registry.get(value);
      }
      return value;
    }
    return value;
  }
}
