import { describe, expect, it } from "vitest";

import {
  ConfiguredLLM,
  contextWindowSizeForModel,
  resolveLLMModelSpec,
} from "../src/llm.js";

describe("current model compatibility", () => {
  it("routes current and unlisted Claude snapshots to Anthropic without claiming Bedrock IDs", () => {
    expect(resolveLLMModelSpec("claude-fable-5-1").provider).toBe("anthropic");
    expect(resolveLLMModelSpec("claude-sonnet-5-20990101").provider).toBe("anthropic");
    expect(resolveLLMModelSpec("anthropic/claude-opus-5")).toMatchObject({
      provider: "anthropic", model: "claude-opus-5",
    });
    expect(resolveLLMModelSpec("bedrock/anthropic.claude-sonnet-4-6").provider).toBe("bedrock");
    expect(resolveLLMModelSpec("gpt-6-astra").provider).toBe("openai");
  });

  it("uses documented latest context windows with the existing safety margin", () => {
    expect(contextWindowSizeForModel("gpt-6-astra")).toBe(892500);
    expect(contextWindowSizeForModel("gpt-5.6-terra")).toBe(892500);
    expect(contextWindowSizeForModel("claude-fable-5-1")).toBe(850000);
    expect(contextWindowSizeForModel("claude-haiku-4-5-20251001")).toBe(170000);
  });

  it("resolves provider-qualified contexts and chooses the most specific model limit", () => {
    expect(contextWindowSizeForModel("openai/gpt-5.4-mini-2026-03-17")).toBe(340000);
    expect(contextWindowSizeForModel("gpt-5.4-2026-03-05")).toBe(892500);
    expect(contextWindowSizeForModel("anthropic/claude-sonnet-5")).toBe(850000);
    expect(new ConfiguredLLM({ model: "gpt-6-astra" }).getContextWindowSize()).toBe(892500);
  });

  it("recognizes current vision models while preserving text-only model restrictions", () => {
    expect(new ConfiguredLLM({ model: "gpt-6-astra" }).supportsMultimodal()).toBe(true);
    expect(new ConfiguredLLM({ model: "anthropic/claude-fable-5-1" }).supportsMultimodal()).toBe(true);
    expect(new ConfiguredLLM({ model: "claude-sonnet-5" }).supportsMultimodal()).toBe(true);
    expect(new ConfiguredLLM({ model: "o3-mini" }).supportsMultimodal()).toBe(false);
  });
});
