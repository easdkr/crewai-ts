import { describe, it, expect, beforeEach } from "vitest";
import { LlmRegistryService } from "../../src/registry/llm-registry.js";
import type { LLMSupply } from "../../src/tokens.js";

// Test fixtures — distinct LLM identities to verify identity (toBe) vs equality (toEqual).
const makeLlm = (tag: string): LLMSupply => {
  const fn = (() => tag) as (...args: never[]) => unknown;
  // Tag the function so error messages can identify which fixture was used.
  Object.defineProperty(fn, "name", { value: `llm_${tag}` });
  return fn;
};
const fast = makeLlm("fast");
const deep = makeLlm("deep");
const planner = makeLlm("planner");
const toolLlm = makeLlm("tool");

describe("LlmRegistryService", () => {
  let registry: LlmRegistryService;
  beforeEach(() => {
    registry = new LlmRegistryService();
  });

  describe("register + get", () => {
    it("register() + get() round-trips the same reference", () => {
      registry.register("fast", fast);
      expect(registry.get("fast")).toBe(fast);
    });

    it("get() on an unknown name throws with the registered-names list", () => {
      registry.register("fast", fast);
      registry.register("deep", deep);

      expect(() => registry.get("missing")).toThrow(/unknown llm name/i);
      expect(() => registry.get("missing")).toThrow(/fast/);
      expect(() => registry.get("missing")).toThrow(/deep/);
    });

    it("get() on an empty registry throws a descriptive error", () => {
      expect(() => registry.get("anything")).toThrow(/unknown llm name/i);
      // Empty registry should NOT include a trailing comma or empty list.
      // The error must still be informative even when nothing is registered.
      let message = "";
      try {
        registry.get("anything");
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message).toBeTruthy();
    });

    it("register() with a duplicate name silently overwrites (Map.set semantics)", () => {
      const replacement = makeLlm("replacement");
      registry.register("fast", fast);
      registry.register("fast", replacement);
      expect(registry.get("fast")).toBe(replacement);
      expect(registry.names()).toEqual(["fast"]);
    });

    it("register() returns `this` for chaining", () => {
      expect(registry.register("fast", fast)).toBe(registry);
      expect(registry.registerAll({ deep })).toBe(registry);
      expect(registry.setDefault(fast)).toBe(registry);
    });
  });

  describe("registerAll", () => {
    it("registerAll({a, b}) populates the map with every entry", () => {
      registry.registerAll({ fast, deep });
      expect(registry.get("fast")).toBe(fast);
      expect(registry.get("deep")).toBe(deep);
      expect(registry.names()).toHaveLength(2);
    });

    it("registerAll({}) on an empty registry is a no-op", () => {
      registry.registerAll({});
      expect(registry.names()).toEqual([]);
    });

    it("registerAll() merges into the existing registry without removing prior entries", () => {
      registry.register("planner", planner);
      registry.registerAll({ fast, deep });
      expect([...registry.names()].sort()).toEqual(["deep", "fast", "planner"]);
    });
  });

  describe("has + names + clear", () => {
    it("has() returns true for registered names and false otherwise", () => {
      registry.register("fast", fast);
      expect(registry.has("fast")).toBe(true);
      expect(registry.has("missing")).toBe(false);
    });

    it("has() returns false on a fresh registry", () => {
      expect(registry.has("anything")).toBe(false);
    });

    it("names() returns the registered keys", () => {
      registry.register("fast", fast);
      registry.register("deep", deep);
      const result = [...registry.names()].sort();
      expect(result).toEqual(["deep", "fast"]);
    });

    it("names() returns an empty array on a fresh registry", () => {
      expect(registry.names()).toEqual([]);
    });

    it("clear() removes every entry", () => {
      registry.register("fast", fast);
      registry.register("deep", deep);
      registry.clear();
      expect(registry.names()).toEqual([]);
      expect(registry.has("fast")).toBe(false);
      expect(registry.has("deep")).toBe(false);
    });

    it("clear() on an empty registry is a safe no-op", () => {
      expect(() => registry.clear()).not.toThrow();
      expect(registry.names()).toEqual([]);
    });
  });

  describe("setDefault", () => {
    it("setDefault(llm) is equivalent to register('default', llm)", () => {
      registry.setDefault(fast);
      expect(registry.get("default")).toBe(fast);
      expect(registry.has("default")).toBe(true);
    });

    it("setDefault(llm) is resolved by resolve('default')", () => {
      registry.setDefault(fast);
      expect(registry.resolve("default")).toBe(fast);
    });
  });

  describe("resolve — 4 resolution forms", () => {
    describe("Form 1: identity (function or object LLMClient)", () => {
      it("resolve(llmFunction) returns the function unchanged", () => {
        const llmFn = makeLlm("fn");
        // Empty registry still does identity passthrough.
        expect(registry.resolve(llmFn)).toBe(llmFn);
      });

      it("resolve(llmFunction) on a non-empty registry still returns the same reference", () => {
        registry.register("fast", fast);
        const llmFn = makeLlm("fn");
        expect(registry.resolve(llmFn)).toBe(llmFn);
      });

      it("resolve(llmObject) returns the object reference unchanged", () => {
        // Cast through `unknown` to satisfy LLM's strict `call` signature without
        // pulling in the full message/options shape — the registry only cares
        // that resolve() returns the same reference.
        const llmObject = {
          call: (): unknown => "object-llm",
        } as unknown as LLMSupply;
        expect(registry.resolve(llmObject)).toBe(llmObject);
      });
    });

    describe("Form 2: registered name lookup", () => {
      it("resolve('fast') returns the registered LLM", () => {
        registry.register("fast", fast);
        expect(registry.resolve("fast")).toBe(fast);
      });

      it("resolve('default') returns the registered default", () => {
        registry.setDefault(fast);
        expect(registry.resolve("default")).toBe(fast);
      });
    });

    describe("Form 3: unregistered string delegation (passes through to createLLM later)", () => {
      it("resolve('openai/gpt-4o') returns the same string when not registered", () => {
        expect(registry.resolve("openai/gpt-4o")).toBe("openai/gpt-4o");
      });

      it("resolve('openai/gpt-4o') on a non-empty registry also returns the string", () => {
        registry.register("fast", fast);
        expect(registry.resolve("openai/gpt-4o")).toBe("openai/gpt-4o");
      });
    });

    describe("Form 4: null/undefined with empty-vs-non-empty semantics", () => {
      it("resolve(null) on an empty registry returns null (legacy NOOP path)", () => {
        expect(registry.resolve(null)).toBeNull();
      });

      it("resolve(undefined) on an empty registry returns null", () => {
        expect(registry.resolve(undefined)).toBeNull();
      });

      it("resolve(null) on a non-empty registry throws with a descriptive error", () => {
        registry.register("fast", fast);
        registry.register("deep", deep);

        let message = "";
        try {
          registry.resolve(null);
        } catch (e) {
          message = (e as Error).message;
        }

        expect(message).toMatch(/cannot resolve null/i);
        // The error must enumerate the registered names so the developer can fix config.
        expect(message).toMatch(/fast/);
        expect(message).toMatch(/deep/);
        // And point at the CrewModule.forRoot default.
        expect(message).toMatch(/crewmodule\.forroot|llms\.default/i);
      });

      it("resolve(undefined) on a non-empty registry throws with a descriptive error", () => {
        registry.register("fast", fast);

        expect(() => registry.resolve(undefined)).toThrow(/cannot resolve null|undefined/i);
        expect(() => registry.resolve(undefined)).toThrow(/fast/);
      });

      it("resolve(null) on a non-empty registry that only has 'default' still throws and lists 'default'", () => {
        registry.setDefault(fast);
        let message = "";
        try {
          registry.resolve(null);
        } catch (e) {
          message = (e as Error).message;
        }
        expect(message).toMatch(/cannot resolve null/i);
        expect(message).toMatch(/default/);
      });
    });
  });

  describe("realistic multi-LLM usage", () => {
    it("can register a planning/function-calling split and resolve each by name", () => {
      registry.register("default", fast);
      registry.register("planner", planner);
      registry.register("tool", toolLlm);
      registry.register("deep", deep);

      // Each named slot resolves to a different LLM.
      expect(registry.resolve("default")).toBe(fast);
      expect(registry.resolve("planner")).toBe(planner);
      expect(registry.resolve("tool")).toBe(toolLlm);
      expect(registry.resolve("deep")).toBe(deep);

      // Unregistered string still passes through (delegated to createLLM at agent-construction time).
      expect(registry.resolve("openai/gpt-4o")).toBe("openai/gpt-4o");

      // Per-agent override identity: an explicitly provided LLM is returned as-is.
      const customLlm = makeLlm("custom");
      expect(registry.resolve(customLlm)).toBe(customLlm);

      // Consumer (T6 router) can introspect the registry:
      expect([...registry.names()].sort()).toEqual(["deep", "default", "planner", "tool"]);
    });
  });
});
