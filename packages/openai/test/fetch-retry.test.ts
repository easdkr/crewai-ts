import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenAICompletion, OpenAIRequestError } from "../src/index.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function openAIResponse(payload: unknown): Response {
  return {
    ok: true,
    json: async () => payload,
  } as Response;
}

function openAIErrorResponse(status: number, payload: unknown = {}, headers: Record<string, string> = {}): Response {
  return {
    ok: false,
    status,
    headers: new Headers(headers),
    json: async () => payload,
  } as Response;
}

function chatCompletion(content: string): unknown {
  return { choices: [{ message: { role: "assistant", content } }] };
}

function requestBody(fetchMock: ReturnType<typeof vi.fn>, index: number): Record<string, unknown> {
  const init = fetchMock.mock.calls[index]?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
}

describe("OpenAICompletion fetch retry", () => {
  it("does not retry after the first success", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(openAIResponse(chatCompletion("hi")));
    vi.stubGlobal("fetch", fetchMock);
    const llm = new OpenAICompletion({ model: "gpt-4o", apiKey: "test-key" });

    await expect(llm.call([{ role: "user", content: "hi" }])).resolves.toBe("hi");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry non-retryable status codes", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(openAIErrorResponse(400, { error: { message: "bad request" } }));
    vi.stubGlobal("fetch", fetchMock);
    const llm = new OpenAICompletion({
      model: "gpt-4o",
      apiKey: "test-key",
      maxRetries: 3,
      flexFallbackToAuto: true,
    });

    const error = await llm.call([{ role: "user", content: "hi" }]).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(OpenAIRequestError);
    expect((error as OpenAIRequestError).status).toBe(400);
    expect((error as OpenAIRequestError).message).toBe("bad request");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries retryable status codes without switching tier when flexFallbackToAuto is disabled", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(openAIErrorResponse(429, { error: { message: "resource_unavailable" } }))
      .mockResolvedValueOnce(openAIResponse(chatCompletion("ok")));
    vi.stubGlobal("fetch", fetchMock);
    const llm = new OpenAICompletion({
      model: "gpt-4o",
      apiKey: "test-key",
      maxRetries: 1,
      additionalParams: { service_tier: "flex" },
    });

    const promise = llm.call([{ role: "user", content: "hi" }]);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe("ok");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestBody(fetchMock, 0).service_tier).toBe("flex");
    expect(requestBody(fetchMock, 1).service_tier).toBe("flex");
  });

  it("falls back from flex to auto on retryable errors and keeps auto for later retries", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(openAIErrorResponse(429, { error: { message: "resource_unavailable" } }))
      .mockResolvedValueOnce(openAIErrorResponse(500, { error: { message: "server error" } }))
      .mockResolvedValueOnce(openAIErrorResponse(429, { error: { message: "resource_unavailable" } }))
      .mockResolvedValueOnce(openAIResponse(chatCompletion("ok")));
    vi.stubGlobal("fetch", fetchMock);
    const llm = new OpenAICompletion({
      model: "gpt-4o",
      apiKey: "test-key",
      maxRetries: 3,
      flexFallbackToAuto: true,
      additionalParams: { service_tier: "flex" },
    });

    const promise = llm.call([{ role: "user", content: "hi" }]);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe("ok");

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect([0, 1, 2, 3].map((index) => requestBody(fetchMock, index).service_tier)).toEqual([
      "flex",
      "auto",
      "auto",
      "auto",
    ]);
  });

  it("throws the last error with status preserved once retries are exhausted", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(openAIErrorResponse(429, { error: { message: "resource_unavailable" } }));
    vi.stubGlobal("fetch", fetchMock);
    const llm = new OpenAICompletion({
      model: "gpt-4o",
      apiKey: "test-key",
      maxRetries: 2,
      flexFallbackToAuto: true,
      additionalParams: { service_tier: "flex" },
    });

    const promise = llm.call([{ role: "user", content: "hi" }]).catch((err: unknown) => err);
    await vi.runAllTimersAsync();
    const error = await promise;

    expect(error).toBeInstanceOf(OpenAIRequestError);
    expect((error as OpenAIRequestError).status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry when maxRetries is 0", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(openAIErrorResponse(429, { error: { message: "resource_unavailable" } }));
    vi.stubGlobal("fetch", fetchMock);
    const llm = new OpenAICompletion({ model: "gpt-4o", apiKey: "test-key", maxRetries: 0 });

    const error = await llm.call([{ role: "user", content: "hi" }]).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(OpenAIRequestError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("honors the retry-after-ms header instead of exponential backoff", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(openAIErrorResponse(429, {}, { "retry-after-ms": "10" }))
      .mockResolvedValueOnce(openAIResponse(chatCompletion("ok")));
    vi.stubGlobal("fetch", fetchMock);
    const llm = new OpenAICompletion({ model: "gpt-4o", apiKey: "test-key", maxRetries: 1 });

    const promise = llm.call([{ role: "user", content: "hi" }]);
    await vi.advanceTimersByTimeAsync(10);
    await expect(promise).resolves.toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries on network errors", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(openAIResponse(chatCompletion("ok")));
    vi.stubGlobal("fetch", fetchMock);
    const llm = new OpenAICompletion({ model: "gpt-4o", apiKey: "test-key", maxRetries: 1 });

    const promise = llm.call([{ role: "user", content: "hi" }]);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("executes the tool exactly once even when the follow-up request fails before eventually succeeding", async () => {
    vi.useFakeTimers();
    const echoTool = {
      type: "function",
      function: {
        name: "echo",
        description: "echo",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: { text: { type: "string" } },
          required: ["text"],
        },
        strict: true,
      },
    };
    const echoToolCall = {
      id: "call_1",
      type: "function",
      function: { name: "echo", arguments: JSON.stringify({ text: "hello" }) },
    };

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(openAIResponse({
        choices: [{ message: { role: "assistant", content: null, tool_calls: [echoToolCall] } }],
      }))
      .mockResolvedValueOnce(openAIErrorResponse(429, { error: { message: "resource_unavailable" } }))
      .mockResolvedValueOnce(openAIResponse({
        choices: [{ message: { role: "assistant", content: "final: hello" } }],
      }));
    vi.stubGlobal("fetch", fetchMock);

    const echo = vi.fn((args: Record<string, unknown>) => `echo: ${String(args.text)}`);
    const llm = new OpenAICompletion({ model: "gpt-4o", apiKey: "test-key", maxRetries: 1 });

    const promise = llm.call(
      [{ role: "user", content: "call echo" }],
      { tools: [echoTool as never], availableFunctions: { echo } },
    );
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("final: hello");
    expect(echo).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
