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

  it.each([
    "claude-fable-5-1",
    "claude-opus-5",
    "claude-sonnet-5",
  ])("prepares adaptive thinking and effort for %s", (model) => {
    const anthropic = new AnthropicCompletion({
      model,
      max_tokens: 16_000,
      thinking: { type: "adaptive", display: "summarized" },
      effort: "xhigh",
    });

    expect(anthropic._prepare_completion_params([
      { role: "user", content: "Reason carefully" },
    ])).toMatchObject({
      model,
      max_tokens: 16_000,
      thinking: { type: "adaptive", display: "summarized" },
      output_config: { effort: "xhigh" },
    });
  });

  it("preserves manual thinking for Claude Sonnet 4.6", () => {
    const anthropic = new AnthropicCompletion({
      model: "claude-sonnet-4-6",
      max_tokens: 16_000,
      thinking: { type: "enabled", budget_tokens: 10_000 },
    });

    expect(anthropic._prepare_completion_params([
      { role: "user", content: "Prove the result" },
    ])).toMatchObject({
      thinking: { type: "enabled", budget_tokens: 10_000 },
    });
  });

  it("keeps tool choice automatic for Claude Fable 5.1", () => {
    const lookup = new StructuredTool({
      name: "lookup docs",
      description: "Lookup documentation",
      argsSchema: { id: { type: "string" } },
      func: () => "result",
    });
    const anthropic = new AnthropicCompletion({ model: "claude-fable-5-1" });

    const params = anthropic._prepare_completion_params(
      [{ role: "user", content: "Find CrewAI" }],
      null,
      [lookup],
      { lookup_docs: lookup },
    );

    expect(params.tools).toContainEqual(expect.objectContaining({ name: "lookup_docs" }));
    expect(params).not.toHaveProperty("tool_choice");
  });

  it("rejects manual thinking for Claude Sonnet 5", () => {
    const anthropic = new AnthropicCompletion({
      model: "claude-sonnet-5",
      thinking: { type: "enabled", budget_tokens: 10_000 },
    });

    expect(() => anthropic._prepare_completion_params([
      { role: "user", content: "Prove the result" },
    ])).toThrow("does not support manual thinking");
  });

  it("omits unsupported sampling parameters for Claude Sonnet 5", () => {
    const anthropic = new AnthropicCompletion({
      model: "claude-sonnet-5",
      temperature: 0.3,
      top_p: 0.7,
    });

    const params = anthropic._prepare_completion_params([
      { role: "user", content: "Answer briefly" },
    ]);

    expect(params).not.toHaveProperty("temperature");
    expect(params).not.toHaveProperty("top_p");
  });

  it.each([
    "claude-fable-5-1",
    "claude-opus-5",
    "claude-sonnet-5",
  ])("recognizes multimodal input for %s", (model) => {
    expect(new AnthropicCompletion({ model }).supports_multimodal()).toBe(true);
  });

  it("does not force a tool when manual thinking is enabled", () => {
    const lookup = new StructuredTool({
      name: "lookup docs",
      description: "Lookup documentation",
      argsSchema: { id: { type: "string" } },
      func: () => "result",
    });
    const anthropic = new AnthropicCompletion({
      model: "claude-sonnet-4-6",
      thinking: { type: "enabled", budget_tokens: 10_000 },
    });

    const params = anthropic._prepare_completion_params(
      [{ role: "user", content: "Find CrewAI" }],
      null,
      [lookup],
      { lookup_docs: lookup },
    );

    expect(params).not.toHaveProperty("tool_choice");
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

  it("uses native structured outputs for Claude Opus 5", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [{ type: "text", text: '{"answer":"done","confidence":0.93}' }],
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
        model: "claude-opus-5",
        api_key: "anthropic-key",
        response_format: responseFormat as never,
      });
      await expect(anthropic.call([{ role: "user", content: "Analyze" }])).resolves.toEqual({
        answer: "done",
        confidence: 0.93,
      });
      const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as Record<string, unknown>;
      expect(body.output_config).toEqual({
        format: {
          type: "json_schema",
          schema: sanitizeToolParamsForAnthropicStrict(responseFormat.model_json_schema()),
        },
      });
      expect(body).not.toHaveProperty("tools");
      expect(body).not.toHaveProperty("tool_choice");
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("rejects malformed native structured output", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "not json" }],
      }),
    } as Response);
    const responseFormat = {
      model_json_schema: () => ({
        type: "object",
        additionalProperties: false,
        properties: { answer: { type: "string" } },
        required: ["answer"],
      }),
    };

    try {
      const anthropic = new AnthropicCompletion({
        model: "claude-opus-5",
        api_key: "anthropic-key",
        response_format: responseFormat as never,
      });
      await expect(anthropic.call([{ role: "user", content: "Analyze" }]))
        .rejects.toThrow("native structured output was not valid JSON");
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
        model: "claude-3-5-sonnet-20241022",
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
