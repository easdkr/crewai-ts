import { describe, expect, it, vi } from "vitest";

import type { LLMResponse } from "@crewai-ts/core/llm";
import type { LLMMessage } from "@crewai-ts/core/types";
import { OpenAICompletion } from "@crewai-ts/openai";
import { AzureCompletion } from "../src/index.js";

describe("AzureCompletion", () => {
  it("exposes aliases and calls chat completions through fetch", async () => {
    const azure = new AzureCompletion({
      model: "gpt-4o",
      endpoint: "https://example.openai.azure.com/openai/deployments/gpt-4o",
      previous_response_id: "az-resp-1",
    });
    for (const methodName of [
      "acall",
      "aclose",
      "call",
      "get_context_window_size",
      "reset_chain",
      "reset_reasoning_chain",
      "supports_function_calling",
      "supports_multimodal",
      "supports_stop_words",
      "_extract_azure_token_usage",
      "_get_sync_client",
      "_make_client_kwargs",
      "to_config_dict",
    ]) {
      expect(Object.hasOwn(AzureCompletion.prototype, methodName)).toBe(true);
    }
    expect(azure.last_response_id).toBe("az-resp-1");
    expect(azure.last_reasoning_items).toBeNull();
    azure.reset_chain();
    expect(azure.last_response_id).toBeNull();
    await expect(azure.aclose()).resolves.toBeUndefined();

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: "azure smoke ok" } }],
        usage: { prompt_tokens: 6, completion_tokens: 3, total_tokens: 9 },
      }),
    } as Response);
    try {
      const liveAzure = new AzureCompletion({
        model: "gpt-4o",
        api_key: "azure-key",
        endpoint: "https://example.openai.azure.com/openai/deployments/gpt-4o",
      });
      await expect(liveAzure.acall([{ role: "user", content: "hello" }])).resolves.toBe("azure smoke ok");
      const [azureUrl, azureInit] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(azureUrl).toBe("https://example.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2024-06-01");
      expect(azureInit.method).toBe("POST");
      expect(azureInit.headers).toMatchObject({ "api-key": "azure-key" });
      expect(liveAzure.get_token_usage_summary()).toMatchObject({
        promptTokens: 6,
        completionTokens: 3,
        totalTokens: 9,
        successfulRequests: 1,
      });
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("reads Azure credential scopes and lazy credentials from the environment", () => {
    const previousScopes = process.env.AZURE_CREDENTIAL_SCOPES;
    const previousApiKey = process.env.AZURE_API_KEY;
    const previousEndpoint = process.env.AZURE_ENDPOINT;
    try {
      process.env.AZURE_CREDENTIAL_SCOPES = "https://cognitiveservices.azure.com/.default,  https://management.azure.com/.default ,";
      expect(AzureCompletion._credential_scopes_from_env()).toEqual([
        "https://cognitiveservices.azure.com/.default",
        "https://management.azure.com/.default",
      ]);
      expect(new AzureCompletion({ model: "gpt-4o" }).credential_scopes).toEqual([
        "https://cognitiveservices.azure.com/.default",
        "https://management.azure.com/.default",
      ]);

      delete process.env.AZURE_CREDENTIAL_SCOPES;
      delete process.env.AZURE_API_KEY;
      delete process.env.AZURE_ENDPOINT;
      const azure = new AzureCompletion({ model: "gpt-4" });
      expect(azure.api_key).toBeNull();
      expect(azure.endpoint).toBeNull();

      process.env.AZURE_API_KEY = "late-key";
      process.env.AZURE_ENDPOINT = "https://test.openai.azure.com/openai/deployments/gpt-4";
      expect(azure._get_sync_client()).toMatchObject({
        api_key: "late-key",
        endpoint: "https://test.openai.azure.com/openai/deployments/gpt-4",
      });
      expect(azure.api_key).toBe("late-key");
      expect(azure.endpoint).toBe("https://test.openai.azure.com/openai/deployments/gpt-4");
      expect(azure.is_azure_openai_endpoint).toBe(true);
    } finally {
      if (previousScopes === undefined) delete process.env.AZURE_CREDENTIAL_SCOPES;
      else process.env.AZURE_CREDENTIAL_SCOPES = previousScopes;
      if (previousApiKey === undefined) delete process.env.AZURE_API_KEY;
      else process.env.AZURE_API_KEY = previousApiKey;
      if (previousEndpoint === undefined) delete process.env.AZURE_ENDPOINT;
      else process.env.AZURE_ENDPOINT = previousEndpoint;
    }
  });

  it("prepares completion request parameters with model extras and endpoint rules", () => {
    const search = {
      name: "search docs",
      description: "Search documentation",
      argsSchema: {
        query: { type: "string", description: "Search query" },
      },
      run: () => "result",
    };
    const azureOpenAI = new AzureCompletion({
      model: "gpt-4o",
      endpoint: "https://example.openai.azure.com/openai/deployments/gpt-4o",
      temperature: 0.2,
      top_p: 0.8,
      frequency_penalty: 0.1,
      presence_penalty: 0.2,
      max_tokens: 300,
      stop: ["STOP"],
      stream: true,
      additional_params: {
        prompt_cache_key: "cache-key",
        drop_params: true,
        additional_drop_params: ["frequency_penalty"],
      },
    });

    const params = azureOpenAI._prepare_completion_params([{ role: "user", content: "Find CrewAI" }], [search]);

    expect(params).toMatchObject({
      messages: [{ role: "user", content: "Find CrewAI" }],
      stream: true,
      temperature: 0.2,
      top_p: 0.8,
      presence_penalty: 0.2,
      max_tokens: 300,
      stop: ["STOP"],
      model_extras: {
        stream_options: { include_usage: true },
        prompt_cache_key: "cache-key",
      },
      tools: [{
        type: "function",
        function: {
          name: "search_docs",
          description: "Search documentation",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query" },
            },
          },
        },
      }],
      tool_choice: "auto",
    });
    expect(params).not.toHaveProperty("model");
    expect(params).not.toHaveProperty("frequency_penalty");

    const external = new AzureCompletion({
      model: "mistral-large",
      endpoint: "https://models.inference.ai.azure.com",
      max_tokens: 100,
    });
    expect(external._prepare_completion_params([{ role: "user", content: "Find CrewAI" }], [search])).toMatchObject({
      model: "mistral-large",
      messages: [{ role: "user", content: "Find CrewAI" }],
      max_tokens: 100,
    });
  });

  it("delegates Responses API behavior through the OpenAI Responses adapter", async () => {
    const azure = new AzureCompletion({
      model: "azure/gpt-5.2-chat",
      api: "responses",
      api_key: "azure-key",
      endpoint: "https://example.openai.azure.com:8443/openai/deployments/gpt-5.2-chat",
      temperature: 0.2,
      top_p: 0.8,
      max_tokens: 1000,
      max_completion_tokens: 800,
      reasoning_effort: "medium",
      instructions: "Be concise",
      store: true,
      previous_response_id: "resp-prev",
      include: ["reasoning.encrypted_content"],
      builtin_tools: ["web_search"],
      parse_tool_outputs: true,
      auto_chain: true,
      auto_chain_reasoning: true,
      stream: true,
    });

    const delegate = azure._responses_delegate as OpenAICompletion;
    expect(azure.api).toBe("responses");
    expect(delegate).toBeInstanceOf(OpenAICompletion);
    expect(delegate.to_config_dict()).toMatchObject({
      model: "gpt-5.2-chat",
      provider: "openai",
      api_key: "azure-key",
      base_url: "https://example.openai.azure.com:8443/openai/v1/",
    });

    const params = azure._prepare_responses_params([
      { role: "system", content: "System prompt" },
      { role: "user", content: "Hello" },
    ]);

    expect(params).toMatchObject({
      model: "gpt-5.2-chat",
      instructions: "Be concise\n\nSystem prompt",
      input: [{ role: "user", content: "Hello" }],
      stream: true,
      store: true,
      previous_response_id: "resp-prev",
      include: ["reasoning.encrypted_content"],
      temperature: 0.2,
      top_p: 0.8,
      max_output_tokens: 800,
      reasoning: { effort: "medium" },
      tools: [{ type: "web_search_preview" }],
    });
    expect(azure.supports_stop_words()).toBe(false);
    expect(azure.to_config_dict()).toMatchObject({
      api: "responses",
      reasoning_effort: "medium",
      instructions: "Be concise",
      store: true,
      max_completion_tokens: 800,
    });

    (delegate as unknown as { call: (messages: readonly LLMMessage[]) => Promise<LLMResponse> }).call = (messages) =>
      Promise.resolve(`delegated:${messages[0]?.content ?? ""}`);
    await expect(azure.call([{ role: "user", content: "ping" }])).resolves.toBe("delegated:ping");
  });
});
