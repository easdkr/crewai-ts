import { afterEach, describe, expect, it, vi } from "vitest";
import { createLLM, unregisterLLMProviderFactory } from "@crewai-ts/core/llm";
import { registerOpenAIProvider } from "../src/provider.js";

afterEach(() => {
  unregisterLLMProviderFactory("openai");
  vi.unstubAllGlobals();
});

describe("OpenAI model factory", () => {
  it("sends configured credentials, endpoint and reasoning options through the public factory", async () => {
    registerOpenAIProvider();
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe("https://factory.example/v1/responses");
      expect(init.headers).toMatchObject({ Authorization: "Bearer factory-key" });
      expect(JSON.parse(init.body as string)).toMatchObject({
        model: "gpt-6-astra",
        max_output_tokens: 8192,
        reasoning: { effort: "high" },
      });
      return new Response(JSON.stringify({
        output: [{ type: "message", content: [{ type: "output_text", text: "factory response" }] }],
      }), { status: 200 });
    }));
    const llm = createLLM({
      model: "openai/gpt-6-astra",
      api: "responses",
      apiKey: "factory-key",
      baseUrl: "https://factory.example/v1",
      maxCompletionTokens: 8192,
      reasoningEffort: "high",
      maxRetries: 0,
    });
    await expect(llm?.call([{ role: "user", content: "hello" }])).resolves.toBe("factory response");
  });
});
