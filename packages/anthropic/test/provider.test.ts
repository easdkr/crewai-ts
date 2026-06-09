import { describe, expect, it, vi } from "vitest";

import { StructuredTool } from "@crewai-ts/core";
import { sanitizeToolParamsForAnthropicStrict } from "@crewai-ts/core/schema-utils";
import type { LLMMessage } from "@crewai-ts/core/types";
import { AnthropicCompletion } from "../src/index.js";

describe("AnthropicCompletion", () => {
  it("prepares request parameters with thinking and tool search", () => {
    const search = new StructuredTool({
      name: "search docs",
      description: "Search documentation",
      argsSchema: {
        query: { type: "string", description: "Search query" },
      },
      func: () => "result",
    });
    const lookup = new StructuredTool({
      name: "lookup docs",
      description: "Lookup documentation",
      argsSchema: {
        id: { type: "string", description: "Document id" },
      },
      func: () => "result",
    });
    const anthropic = new AnthropicCompletion({
      model: "claude-sonnet-4-5",
      temperature: 0.3,
      top_p: 0.7,
      max_tokens: 2048,
      stop: ["STOP"],
      stream: true,
      thinking: { type: "enabled", budget_tokens: 1024 },
      tool_search: { type: "regex" },
    });

    const params = anthropic._prepare_completion_params(
      [{ role: "user", content: "Find CrewAI" }],
      "System prompt",
      [search, lookup],
      { search_docs: search, lookup_docs: lookup },
    );

    expect(params).toMatchObject({
      model: "claude-sonnet-4-5",
      messages: [{ role: "user", content: "Find CrewAI" }],
      system: "System prompt",
      max_tokens: 2048,
      stream: true,
      temperature: 0.3,
      top_p: 0.7,
      stop_sequences: ["STOP"],
      thinking: { type: "enabled", budget_tokens: 1024 },
      tools: [
        { type: "tool_search_tool_regex_20251119", name: "tool_search_tool_regex" },
        expect.objectContaining({ name: "search_docs", defer_loading: true }),
        expect.objectContaining({ name: "lookup_docs", defer_loading: true }),
      ],
    });
  });

  it("calls the Anthropic Messages API with an injected api_key", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: "msg_live",
        content: [{ type: "text", text: "crewai-ts smoke ok" }],
        usage: {
          input_tokens: 18,
          output_tokens: 10,
        },
      }),
    } as Response);

    try {
      const anthropic = new AnthropicCompletion({
        model: "claude-haiku-4-5-20251001",
        api_key: "anthropic-key",
        max_tokens: 16,
      });
      await expect(anthropic.call([{ role: "user", content: "smoke" }])).resolves.toBe("crewai-ts smoke ok");

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://api.anthropic.com/v1/messages");
      expect(init.method).toBe("POST");
      expect(init.headers).toMatchObject({
        "content-type": "application/json",
        "x-api-key": "anthropic-key",
        "anthropic-version": "2023-06-01",
      });
      expect(JSON.parse(init.body as string) as Record<string, unknown>).toMatchObject({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 16,
        messages: [{ role: "user", content: "smoke" }],
        stream: false,
      });
      expect(anthropic.get_token_usage_summary()).toMatchObject({
        promptTokens: 18,
        completionTokens: 10,
        totalTokens: 28,
        successfulRequests: 1,
      });
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("forces structured output through a response_format tool", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [{
          type: "tool_use",
          id: "toolu_structured",
          name: "structured_output",
          input: { answer: "done", confidence: 0.93 },
        }],
        usage: { input_tokens: 12, output_tokens: 4 },
      }),
    } as Response);
    const responseFormat = {
      model_json_schema: () => ({
        type: "object",
        additionalProperties: false,
        properties: {
          answer: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["answer", "confidence"],
      }),
    };

    try {
      const anthropic = new AnthropicCompletion({
        model: "claude-sonnet-4-6",
        api_key: "anthropic-key",
        response_format: responseFormat as never,
      });
      await expect(anthropic.call([{ role: "user", content: "Analyze" }])).resolves.toEqual({
        answer: "done",
        confidence: 0.93,
      });
      const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as Record<string, unknown>;
      expect(body.tool_choice).toEqual({ type: "tool", name: "structured_output" });
      expect(body.tools).toContainEqual(expect.objectContaining({
        name: "structured_output",
        input_schema: sanitizeToolParamsForAnthropicStrict(responseFormat.model_json_schema()),
      }));
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("formats multimodal message files and extracts tool uses", () => {
    const anthropic = new AnthropicCompletion({ model: "claude-3-5-sonnet-20241022" });
    const blocks = [
      { type: "text", text: "Observation: Here is the image:" },
      { type: "image_url", image_url: { url: "data:image/png;base64,abc123" } },
    ];

    const [messages] = anthropic._format_messages_for_anthropic([
      { role: "user", content: blocks },
      { role: "tool", tool_call_id: "call_1", content: blocks },
    ] as unknown as LLMMessage[]);

    expect(messages[0]?.content).toContainEqual({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: "abc123" },
    });
    expect(AnthropicCompletion.extract_tool_uses_from_response({
      content: [
        { type: "tool_use", id: "tool-1", name: "search_docs", input: { query: "CrewAI" } },
        { type: "tool_use", id: "tool-2", name: "structured_output", input: { answer: "done" } },
      ],
    })).toEqual([{ type: "tool_use", id: "tool-1", name: "search_docs", input: { query: "CrewAI" } }]);
  });
});
