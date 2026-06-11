import { Injectable } from "@nestjs/common";
import type { LLMSupply } from "../tokens.js";

/**
 * Map-backed named LLM registry.
 *
 * Stores {@link LLMSupply} values (function LLM, object LLM client, or a model
 * string) under string names and provides a single `resolve()` entry point that
 * implements the four resolution forms used by the v0.3 wiring:
 *
 *   1. **Identity** — `nameOrValue` is a function or object (an LLMClient
 *      with a `.call` / callable signature). Return the value unchanged.
 *   2. **Registered name** — `nameOrValue` is a string AND the registry has
 *      that name. Return the registered entry.
 *   3. **Unregistered string delegation** — `nameOrValue` is a string AND
 *      no registry entry matches. Return the string verbatim so the agent
 *      factory (T11) can hand it to core's `createLLM()` later. The registry
 *      itself never calls `createLLM()` and never mutates the core's
 *      `registeredProviders` map; it is a pure data structure.
 *   4. **null / undefined** — the caller did not provide an LLM:
 *      - registry is empty → return `null` (legacy NOOP path; tests and
 *        bare-bones setups rely on this for "don't inject anything").
 *      - registry is non-empty → throw a descriptive error so misconfig is
 *        caught at agent-construction time, not at first LLM call.
 *
 * `setDefault(llm)` is a shorthand for `register("default", llm)`. The
 * `"default"` key is the reserved slot bound from
 * `CrewModule.forRoot({ llms: { default: ... } })` and is what the agent
 * factory falls back to when no per-agent LLM is supplied.
 */
@Injectable()
export class LlmRegistryService {
  private readonly map = new Map<string, LLMSupply>();

  /**
   * Register an LLM under `name`. Duplicate names silently overwrite the
   * previous entry (Map.set semantics). Returns `this` for chaining.
   */
  register(name: string, llm: LLMSupply): this {
    this.map.set(name, llm);
    return this;
  }

  /**
   * Register many LLMs at once. Existing entries are preserved unless the
   * new payload's keys overlap, in which case the new value wins. Returns
   * `this` for chaining.
   */
  registerAll(llms: Record<string, LLMSupply>): this {
    for (const [name, llm] of Object.entries(llms)) {
      this.map.set(name, llm);
    }
    return this;
  }

  /**
   * Get the LLM registered under `name`. Throws a descriptive error
   * (listing the registered names) if the key is absent.
   */
  get(name: string): LLMSupply {
    if (!this.map.has(name)) {
      throw new Error(
        `Unknown LLM name: '${name}'. Registered: ${this.names().join(", ")}`,
      );
    }
    return this.map.get(name) as LLMSupply;
  }

  has(name: string): boolean {
    return this.map.has(name);
  }

  /**
   * Snapshot of the registered names. Returned as a fresh array so callers
   * can mutate / sort it without affecting registry state.
   */
  names(): readonly string[] {
    return Array.from(this.map.keys());
  }

  /**
   * Resolve a possibly-string-or-value LLM reference into an `LLMSupply`.
   *
   * See the class JSDoc for the full 4-form contract. This method is
   * intentionally side-effect-free: it does not call `createLLM()` from core
   * and does not mutate the core's provider map. Unregistered strings are
   * returned verbatim so the caller (typically the agent factory) can decide
   * when to perform model construction.
   */
  resolve(nameOrValue: string | LLMSupply): LLMSupply {
    if (nameOrValue === null || nameOrValue === undefined) {
      if (this.map.size === 0) {
        return null;
      }
      const registered = this.names().join(", ");
      throw new Error(
        `Cannot resolve null LLM: registry is non-empty. ` +
          `Registered: ${registered}. ` +
          `Use llms.default in your CrewModule.forRoot options.`,
      );
    }
    if (typeof nameOrValue === "string") {
      if (this.map.has(nameOrValue)) {
        return this.map.get(nameOrValue) as LLMSupply;
      }
      // Form 3: pass the string through unchanged — the agent factory will
      // route it to core's createLLM() at agent-construction time.
      return nameOrValue;
    }
    // Form 1: function or object (LLMClient) — return as-is (identity).
    return nameOrValue;
  }

  /**
   * Remove every entry. Useful for test isolation and for hot-reload
   * scenarios where a Nest application re-initializes its module config.
   */
  clear(): void {
    this.map.clear();
  }

  /**
   * Register `llm` under the reserved `"default"` key. Shorthand for
   * `register("default", llm)`. Returns `this` for chaining.
   */
  setDefault(llm: LLMSupply): this {
    return this.register("default", llm);
  }
}
