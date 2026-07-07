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
