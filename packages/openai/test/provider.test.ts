import { afterEach, describe, expect, it, vi } from "vitest";

import { BaseTool, type ToolArgsSchema } from "@crewai-ts/core/tools";
import { OpenAICompletion } from "../src/index.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

class CloneRepoTool extends BaseTool {
  constructor() {
    super({
      name: "clone_repo",
      description: "clone",
      argsSchema: {
        repo: { type: "string", required: true },
        owner: { type: "string", required: false },
        branch: { type: "string", required: false },
      },
    });
  }

  protected _run(args: Record<string, unknown>): Record<string, unknown> {
    return args;
  }
}

describe("OpenAICompletion tool schema conversion", () => {
  it("normalizes ToolArgsSchema optional args for OpenAI strict function calling", () => {
    const llm = new OpenAICompletion({ model: "gpt-4o", apiKey: "test-key" });

    const params = llm.prepareCompletionParams([], [new CloneRepoTool()]);

    expect(params.tools).toEqual([{
      type: "function",
      function: {
        name: "clone_repo",
        description: "clone",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            repo: { type: "string", additionalProperties: false },
            owner: { type: ["string", "null"], additionalProperties: false },
            branch: { type: ["string", "null"], additionalProperties: false },
          },
          required: ["repo", "owner", "branch"],
        },
        strict: true,
      },
    }]);
  });

  it("preserves pre-converted OpenAI function schemas instead of converting them as generic tools", () => {
    const llm = new OpenAICompletion({ model: "gpt-4o", apiKey: "test-key" });
    const preConvertedTool = {
      type: "function",
      function: {
        name: "clone_repo",
        description: "clone",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            repo: { type: "string", additionalProperties: false },
            branch: { type: ["string", "null"], additionalProperties: false },
          },
          required: ["repo", "branch"],
        },
        strict: true,
      },
    };

    const params = llm.prepareCompletionParams([], [preConvertedTool as never]);

    expect(params.tools).toEqual([preConvertedTool]);
  });

  it("preserves null unions for JSON schema tool parameters", () => {
    const llm = new OpenAICompletion({ model: "gpt-4o", apiKey: "test-key" });
    const jsonSchemaTool = {
      name: "clone_repo",
      description: "clone",
      argsSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          repo: { type: "string" },
          branch: { type: ["string", "null"], additionalProperties: false },
        },
        required: ["repo", "branch"],
      } as unknown as ToolArgsSchema,
    };

    const params = llm.prepareCompletionParams([], [jsonSchemaTool as never]);

    expect(params.tools).toEqual([{
      type: "function",
      function: {
        name: "clone_repo",
        description: "clone",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            repo: { type: "string" },
            branch: { type: ["string", "null"], additionalProperties: false },
          },
          required: ["repo", "branch"],
        },
        strict: true,
      },
    }]);
  });
});

describe("OpenAICompletion native tool calls", () => {
  const echoTool = {
    type: "function",
    function: {
      name: "echo",
      description: "echo",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string" },
        },
        required: ["text"],
      },
      strict: true,
    },
  };

  const echoToolCall = {
    id: "call_1",
    type: "function",
    function: {
      name: "echo",
      arguments: JSON.stringify({ text: "hello" }),
    },
  };

  it.each([
    ["availableFunctions", (fn: (args: Record<string, unknown>) => string) => ({ availableFunctions: { echo: fn } })],
    ["available_functions", (fn: (args: Record<string, unknown>) => string) => ({ available_functions: { echo: fn } })],
  ])("executes chat-completion tool calls with %s and returns final text", async (_label, optionsFor) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(openAIResponse({
        choices: [{ message: { role: "assistant", content: null, tool_calls: [echoToolCall] } }],
      }))
      .mockResolvedValueOnce(openAIResponse({
        choices: [{ message: { role: "assistant", content: "final: hello" } }],
      }));
    vi.stubGlobal("fetch", fetchMock);

    const echo = vi.fn((args: Record<string, unknown>) => `echo: ${String(args.text)}`);
    const llm = new OpenAICompletion({ model: "gpt-4o", apiKey: "test-key" });

    const result = await llm.call(
      [{ role: "user", content: "call echo" }],
      { tools: [echoTool as never], ...optionsFor(echo) },
    );

    expect(result).toBe("final: hello");
    expect(echo).toHaveBeenCalledWith({ text: "hello" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = requestBody(fetchMock, 1);
    expect(secondBody.messages).toEqual([
      { role: "user", content: "call echo" },
      { role: "assistant", content: "", tool_calls: [echoToolCall] },
      { role: "tool", content: "echo: hello", tool_call_id: "call_1" },
    ]);
  });

  it("preserves raw tool_calls when no available functions are provided", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(openAIResponse({
      choices: [{ message: { role: "assistant", content: null, tool_calls: [echoToolCall] } }],
    }));
    vi.stubGlobal("fetch", fetchMock);
    const llm = new OpenAICompletion({ model: "gpt-4o", apiKey: "test-key" });

    const result = await llm.call(
      [{ role: "user", content: "call echo" }],
      { tools: [echoTool as never] },
    );

    expect(result).toEqual([echoToolCall]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("bounds the native tool-call loop with maxToolRounds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(openAIResponse({
      choices: [{ message: { role: "assistant", content: null, tool_calls: [echoToolCall] } }],
    }));
    vi.stubGlobal("fetch", fetchMock);
    const llm = new OpenAICompletion({ model: "gpt-4o", apiKey: "test-key" });

    await expect(llm.call(
      [{ role: "user", content: "call echo" }],
      {
        tools: [echoTool as never],
        availableFunctions: { echo: () => "echo: hello" },
        maxToolRounds: 0,
      },
    )).rejects.toThrow("OpenAI tool call loop exceeded maxToolRounds (0).");
  });

  it("executes Responses API function calls with function_call_output follow-ups", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(openAIResponse({
        id: "resp_1",
        output: [{
          type: "function_call",
          call_id: "call_1",
          name: "echo",
          arguments: JSON.stringify({ text: "hello" }),
        }],
      }))
      .mockResolvedValueOnce(openAIResponse({
        id: "resp_2",
        output_text: "final: hello",
        output: [{
          type: "message",
          content: [{ type: "output_text", text: "final: hello" }],
        }],
      }));
    vi.stubGlobal("fetch", fetchMock);

    const echo = vi.fn((args: Record<string, unknown>) => `echo: ${String(args.text)}`);
    const llm = new OpenAICompletion({ model: "gpt-4o", apiKey: "test-key", api: "responses" });

    const result = await llm.call(
      [{ role: "user", content: "call echo" }],
      { tools: [echoTool as never], availableFunctions: { echo } },
    );

    expect(result).toBe("final: hello");
    expect(echo).toHaveBeenCalledWith({ text: "hello" });
    const secondBody = requestBody(fetchMock, 1);
    expect(secondBody.previous_response_id).toBe("resp_1");
    expect(secondBody.input).toEqual([{
      type: "function_call_output",
      call_id: "call_1",
      output: "echo: hello",
    }]);
  });
});


describe("OpenAICompletion latest reasoning models", () => {
  it("uses Chat Completions reasoning parameters for supported reasoning families", () => {
    for (const [model, reasoningEffort] of [
      ["gpt-5.1", "high"],
      ["gpt-5.5", "high"],
      ["gpt-5.6-sol", "max"],
      ["gpt-5.6-terra", "max"],
      ["gpt-5.6-luna", "max"],
      ["gpt-5.6", "max"],
      ["o3", "high"],
      ["o4-mini", "high"],
    ] as const) {
      const llm = new OpenAICompletion({
        model,
        apiKey: "test-key",
        maxTokens: 128_000,
        reasoningEffort,
      });

      const params = llm.prepareCompletionParams([{ role: "user", content: "reason" }]);

      expect(params).toMatchObject({
        model,
        max_completion_tokens: 128_000,
        reasoning_effort: reasoningEffort,
      });
      expect(params).not.toHaveProperty("max_tokens");
    }
  });

  it("uses Responses reasoning parameters for GPT-6 Astra", () => {
    const llm = new OpenAICompletion({
      model: "gpt-6-astra",
      apiKey: "test-key",
      api: "responses",
      maxTokens: 128_000,
      reasoningEffort: "max",
    });

    expect(llm.prepareResponsesParams([{ role: "user", content: "reason" }])).toMatchObject({
      model: "gpt-6-astra",
      max_output_tokens: 128_000,
      reasoning: { effort: "max" },
    });
  });

  it("omits unsupported sampling parameters for GPT-6 Astra on both endpoints", () => {
    const chat = new OpenAICompletion({
      model: "gpt-6-astra",
      apiKey: "test-key",
      api: "completions",
      temperature: 0.2,
      topP: 0.8,
      topLogprobs: 3,
      logprobs: true,
      additionalParams: {
        temperature: 0.4,
        top_p: 0.7,
        top_logprobs: 2,
        logprobs: true,
      },
    });
    const responses = new OpenAICompletion({
      model: "gpt-6-astra",
      apiKey: "test-key",
      api: "responses",
      temperature: 0.2,
      topP: 0.8,
      additionalParams: {
        temperature: 0.4,
        top_p: 0.7,
        top_logprobs: 2,
        logprobs: true,
      },
    });

    const chatParams = chat.prepareCompletionParams([{ role: "user", content: "reason" }]);
    const responsesParams = responses.prepareResponsesParams([{ role: "user", content: "reason" }]);

    for (const params of [chatParams, responsesParams]) {
      expect(params).not.toHaveProperty("temperature");
      expect(params).not.toHaveProperty("top_p");
    }
    expect(chatParams).not.toHaveProperty("logprobs");
    expect(chatParams).not.toHaveProperty("top_logprobs");
  });

  it("preserves GPT-5.6 sampling parameters from additionalParams", () => {
    const llm = new OpenAICompletion({
      model: "gpt-5.6-sol",
      apiKey: "test-key",
      api: "responses",
      additionalParams: {
        temperature: 0.4,
        top_p: 0.7,
      },
    });

    const params = llm.prepareResponsesParams([{ role: "user", content: "reason" }]);

    expect(params).toMatchObject({
      temperature: 0.4,
      top_p: 0.7,
    });
  });

  it("filters unsupported logprobs include items for GPT-6 Astra Responses", () => {
    const llm = new OpenAICompletion({
      model: "gpt-6-astra",
      apiKey: "test-key",
      api: "responses",
      include: ["message.output_text.logprobs", "reasoning.encrypted_content"],
    });

    expect(llm.prepareResponsesParams([{ role: "user", content: "reason" }]).include)
      .toEqual(["reasoning.encrypted_content"]);
  });

  it("defaults GPT-6 Astra to Responses and rejects Chat tools", () => {
    const llm = new OpenAICompletion({ model: "gpt-6-astra", apiKey: "test-key" });
    const chat = new OpenAICompletion({
      model: "gpt-6-astra",
      apiKey: "test-key",
      api: "completions",
    });

    expect(llm.api).toBe("responses");
    expect(llm.supportsFunctionCalling()).toBe(true);
    expect(chat.supportsFunctionCalling()).toBe(false);
    expect(() => chat.prepareCompletionParams([], [{
      type: "function",
      function: { name: "echo", parameters: { type: "object" } },
    } as never])).toThrow('does not support function calling with Chat Completions; use api: "responses"');
  });

  it("recognizes GPT-6 Astra as a reasoning model in Chat Completions", () => {
    const llm = new OpenAICompletion({
      model: "gpt-6-astra",
      apiKey: "test-key",
      api: "completions",
      reasoningEffort: "high",
    });

    expect(llm.prepareCompletionParams([{ role: "user", content: "reason" }])).toMatchObject({
      reasoning_effort: "high",
    });
  });
});

describe("OpenAICompletion stop sequences", () => {
  it("includes configured stop sequences in Chat Completions requests", () => {
    const llm = new OpenAICompletion({
      model: "gpt-4o",
      apiKey: "test-key",
      stop: ["STOP", "DONE"],
    });

    expect(llm.prepareCompletionParams([{ role: "user", content: "stop" }])).toMatchObject({
      stop: ["STOP", "DONE"],
    });
  });

  it("omits unsupported stop sequences for o3 reasoning requests", () => {
    const llm = new OpenAICompletion({
      model: "o3",
      apiKey: "test-key",
      api: "completions",
      stop: "STOP",
    });

    expect(llm.supportsStopWords()).toBe(false);
    expect(llm.prepareCompletionParams([{ role: "user", content: "stop" }]))
      .not.toHaveProperty("stop");
  });
});

function openAIResponse(payload: unknown): Response {
  return {
    ok: true,
    json: async () => payload,
  } as Response;
}

function requestBody(fetchMock: ReturnType<typeof vi.fn>, index: number): Record<string, unknown> {
  const init = fetchMock.mock.calls[index]?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
}
