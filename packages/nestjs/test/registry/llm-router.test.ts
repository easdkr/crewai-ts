import { describe, it, expect, beforeEach } from "vitest";
import { LlmRegistryService } from "../../src/registry/llm-registry.js";
import { LlmRouterService } from "../../src/registry/llm-router.js";
import type { LLMSupply } from "../../src/tokens.js";

// Test fixtures — distinct LLM identities (toBe checks, not toEqual).
const makeLlm = (tag: string): LLMSupply => {
  const fn = (() => tag) as (...args: never[]) => unknown;
  Object.defineProperty(fn, "name", { value: `llm_${tag}` });
  return fn;
};
const llmA = makeLlm("A");
const llmB = makeLlm("B");
const llmC = makeLlm("C");

describe("LlmRouterService", () => {
  let registry: LlmRegistryService;
  let router: LlmRouterService;

  beforeEach(() => {
    registry = new LlmRegistryService();
    router = new LlmRouterService(registry);
  });

  describe("route() guards", () => {
    it("throws when no LLM_REGISTRY is bound", () => {
      // Construct without a registry — simulates @Optional() injection where
      // the token is not provided.
      const orphan = new LlmRouterService();
      expect(() => orphan.route()).toThrow(/no LLM_REGISTRY bound/);
    });

    it("throws when the registry is empty", () => {
      expect(() => router.route()).toThrow(/registry is empty/);
    });

    it("returns the sole LLM directly when the registry has 1 entry (no strategy overhead)", () => {
      registry.register("only", llmA);
      // Default strategy is round-robin; with 1 LLM the router must short-circuit
      // and not invoke the strategy. Verified by identity (toBe).
      expect(router.route()).toBe(llmA);
      // Repeated calls also return the same LLM, not undefined.
      expect(router.route()).toBe(llmA);
    });
  });

  describe("round-robin strategy (Atomics.add on SharedArrayBuffer)", () => {
    it("alternates indices across 4 sequential calls (2 LLMs)", () => {
      registry.register("a", llmA);
      registry.register("b", llmB);
      router.use("round-robin");

      const results = [router.route(), router.route(), router.route(), router.route()];

      // With 2 LLMs, Atomics.add returns 0,1,2,3; % 2 gives 0,1,0,1 → 2×A, 2×B.
      expect(results.filter((r) => r === llmA)).toHaveLength(2);
      expect(results.filter((r) => r === llmB)).toHaveLength(2);
    });

    it("Promise.all of 4 concurrent route() returns 2×A and 2×B with 2 LLMs (atomic counter)", async () => {
      // Concurrency regression net: a non-atomic `let index = 0` would let
      // microtask-interleaved calls collide on the same counter slot. The
      // SharedArrayBuffer + Atomics.add implementation must hand back 4
      // distinct return values (0, 1, 2, 3) so 2×A and 2×B.
      registry.register("a", llmA);
      registry.register("b", llmB);
      router.use("round-robin");

      const results = await Promise.all([
        router.route(),
        router.route(),
        router.route(),
        router.route(),
      ]);

      expect(results.filter((r) => r === llmA)).toHaveLength(2);
      expect(results.filter((r) => r === llmB)).toHaveLength(2);
    });

    it("wraps modulo llms.length when the counter overflows (3 LLMs, 6 calls)", () => {
      registry.register("a", llmA);
      registry.register("b", llmB);
      registry.register("c", llmC);
      router.use("round-robin");

      // Atomics.add returns 0..5; % 3 gives 0,1,2,0,1,2 → each LLM picked twice.
      const results = [
        router.route(),
        router.route(),
        router.route(),
        router.route(),
        router.route(),
        router.route(),
      ];
      expect(results.filter((r) => r === llmA)).toHaveLength(2);
      expect(results.filter((r) => r === llmB)).toHaveLength(2);
      expect(results.filter((r) => r === llmC)).toHaveLength(2);
    });
  });

  describe("fallback strategy", () => {
    it("always returns llms[0] regardless of which strategy is plugged", () => {
      registry.register("a", llmA);
      registry.register("b", llmB);
      router.use("fallback");
      expect(router.route()).toBe(llmA);
      expect(router.route()).toBe(llmA);
      expect(router.route()).toBe(llmA);
    });
  });

  describe("race strategy", () => {
    it("returns the first LLM by index (deterministic)", () => {
      registry.register("a", llmA);
      registry.register("b", llmB);
      router.use("race");
      expect(router.route()).toBe(llmA);
      // Subsequent calls also pick llms[0] (race is just a picker; the actual
      // racing is the caller's job).
      expect(router.route()).toBe(llmA);
    });
  });

  describe("weighted strategy (equal-weight spread)", () => {
    it("over 1000 iterations picks each of 2 LLMs within ±10% of 1/2", () => {
      registry.register("a", llmA);
      registry.register("b", llmB);
      router.use("weighted");

      let aCount = 0;
      for (let i = 0; i < 1000; i++) {
        if (router.route() === llmA) aCount++;
      }
      // 1/n = 0.5; allow ±10% tolerance = 400..600 (in practice, binomial SD is
      // ~16, so 400-600 is a comfortable bound that catches a broken picker).
      expect(aCount).toBeGreaterThan(400);
      expect(aCount).toBeLessThan(600);
    });
  });

  describe("use(strategy) overload", () => {
    it("accepts a custom RouterStrategyFn and bypasses the built-ins", () => {
      registry.register("a", llmA);
      registry.register("b", llmB);
      let callCount = 0;
      router.use((llms) => {
        callCount++;
        return llms[1]!; // always pick the second LLM
      });
      expect(router.route()).toBe(llmB);
      expect(router.route()).toBe(llmB);
      expect(callCount).toBe(2);
    });

    it("use('fallback') switches back to the built-in fallback after a custom strategy", () => {
      registry.register("a", llmA);
      registry.register("b", llmB);
      router.use(() => llmB); // plug a custom that always returns B
      router.use("fallback"); // revert to built-in
      expect(router.route()).toBe(llmA);
    });

    it("use('round-robin') switches to round-robin", () => {
      registry.register("a", llmA);
      registry.register("b", llmB);
      router.use("fallback"); // start with fallback
      router.use("round-robin");
      // First call: idx=0 (A). Second: idx=1 (B).
      expect(router.route()).toBe(llmA);
      expect(router.route()).toBe(llmB);
    });

    it("use('weighted') switches to weighted (still produces both LLMs over 100 calls)", () => {
      registry.register("a", llmA);
      registry.register("b", llmB);
      router.use("fallback");
      router.use("weighted");

      let sawA = false;
      let sawB = false;
      for (let i = 0; i < 100; i++) {
        const picked = router.route();
        if (picked === llmA) sawA = true;
        if (picked === llmB) sawB = true;
      }
      // 100 trials with p=0.5 → near-certain to see both. A broken fallback-
      // styled weighted (always returning llms[0]) would fail sawB.
      expect(sawA).toBe(true);
      expect(sawB).toBe(true);
    });

    it("use() returns `this` for chaining", () => {
      registry.register("a", llmA);
      registry.register("b", llmB);
      expect(router.use("fallback")).toBe(router);
      expect(router.use("round-robin")).toBe(router);
    });
  });
});
