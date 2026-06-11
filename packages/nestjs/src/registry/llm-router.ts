import { Inject, Injectable, Optional } from "@nestjs/common";
import type { LLMSupply, RouterStrategy } from "../tokens.js";
import { LLM_REGISTRY } from "../tokens.js";
import { LlmRegistryService } from "./llm-registry.js";

/**
 * Pluggable picker function: receives a snapshot of the registered LLMs and
 * returns the one the consumer should use. The router is a PICKER, not an
 * executor — it does not invoke the LLM itself.
 */
export type RouterStrategyFn = (llms: readonly LLMSupply[]) => LLMSupply;

/**
 * Router over a {@link LlmRegistryService}.
 *
 * Strategies (all operate on a snapshot of `registry.names().map(get)`):
 *   - `round-robin`: atomic counter via `Atomics.add` on a `SharedArrayBuffer`.
 *     Concurrency-safe: `Promise.all([route(), route()])` returns distinct
 *     indices. A non-atomic `let index = 0` would race under parallel callers.
 *   - `fallback`: returns `llms[0]` (callers handle fallback errors; this is
 *     just the picker).
 *   - `race`: deterministic first-by-index picker. The actual LLM racing is
 *     the caller's job — this picker decides which LLM is the "first"
 *     candidate.
 *   - `weighted`: equal-weight random picker (`Math.floor(Math.random() * n)`).
 *     v0.3.0 is "1/n" only — user-supplied weights are deferred to v0.3.1.
 *
 * `use(strategy)` accepts a `RouterStrategy` (built-in, including `false`) or
 * a `RouterStrategyFn` (custom). With 1 LLM in the registry, `route()` returns
 * it directly — no strategy overhead. With 0 LLMs, throws a descriptive error.
 */
@Injectable()
export class LlmRouterService {
  private counter?: Int32Array;

  constructor(
    @Optional() @Inject(LLM_REGISTRY) private readonly registry: LlmRegistryService | null = null,
  ) {}

  /**
   * Default strategy is round-robin. Field initializer runs AFTER `super()`,
   * and `this.roundRobin` is on the prototype — so the reference is stable
   * by the time the field is assigned.
   */
  private currentStrategy: RouterStrategyFn = this.roundRobin;

  /**
   * Pluggable strategy. Accepts a string (built-in) or a custom function.
   * Returns `this` for chaining.
   */
  use(strategy: RouterStrategy | RouterStrategyFn): this {
    if (typeof strategy === "function") {
      this.currentStrategy = strategy;
      return this;
    }
    if (strategy === false) {
      // `false` is the documented opt-out sentinel in `RouterStrategy`. The
      // router still needs SOME strategy in case the registry grows to 2+
      // LLMs; fallback is the safest default (always pick the first).
      this.currentStrategy = this.fallback;
      return this;
    }
    switch (strategy) {
      case "round-robin":
        this.currentStrategy = this.roundRobin;
        break;
      case "fallback":
        this.currentStrategy = this.fallback;
        break;
      case "race":
        this.currentStrategy = this.race;
        break;
      case "weighted":
        this.currentStrategy = this.weighted;
        break;
    }
    return this;
  }

  /**
   * Main entry: pick an LLM from the registry using the current strategy.
   *
   * @throws if no registry is bound or the registry is empty
   */
  route(): LLMSupply {
    if (!this.registry) {
      throw new Error("LlmRouterService.route: no LLM_REGISTRY bound");
    }
    const names = this.registry.names();
    if (names.length === 0) {
      throw new Error("LlmRouterService.route: registry is empty");
    }
    // Single-LLM short-circuit: no strategy overhead, no counter bump.
    // Snapshot the names array so registry mutations during the map() cannot
    // desync the indices.
    if (names.length === 1) {
      return this.registry.get(names[0]!);
    }
    const llms: readonly LLMSupply[] = names.map((n) => this.registry!.get(n));
    return this.currentStrategy(llms);
  }

  /**
   * Atomic round-robin counter. Uses `SharedArrayBuffer(4)` + `Int32Array` +
   * `Atomics.add` so concurrent `route()` calls (e.g. parallel `kickoff()` in
   * worker-thread / cluster setups, or microtask-interleaved `Promise.all`)
   * never collide on the same counter slot. A non-atomic `let index = 0` would
   * race.
   *
   * `Atomics.add` returns the OLD value (i.e. the value before the add), so
   * the first call gets 0, the second gets 1, and so on. `% llms.length` wraps
   * the counter back to 0 when it exceeds the array size.
   */
  roundRobin(llms: readonly LLMSupply[]): LLMSupply {
    if (!this.counter) {
      this.counter = new Int32Array(new SharedArrayBuffer(4));
    }
    const idx = Atomics.add(this.counter, 0, 1) % llms.length;
    return llms[idx]!;
  }

  /** Always returns `llms[0]`. Callers handle fallback errors. */
  fallback(llms: readonly LLMSupply[]): LLMSupply {
    return llms[0]!;
  }

  /**
   * Deterministic first-by-index picker. The actual race is the caller's job:
   * invoke each LLM and use the first to resolve. This picker just decides
   * which LLM is the "first" candidate.
   */
  race(llms: readonly LLMSupply[]): LLMSupply {
    return llms[0]!;
  }

  /**
   * Equal-weight spread picker. v0.3.0 is "1/n" only — user-supplied weights
   * are deferred to v0.3.1. Over 1000 iterations, each index should appear
   * within 10% of 1/llms.length (binomial SD for p=0.5, n=1000 is ~16, so the
   * 400-600 band catches broken pickers without flake).
   */
  weighted(llms: readonly LLMSupply[]): LLMSupply {
    const n = llms.length;
    if (n === 1) return llms[0]!;
    const idx = Math.floor(Math.random() * n);
    return llms[idx]!;
  }
}
