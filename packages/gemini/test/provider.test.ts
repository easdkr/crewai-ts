import { describe, expect, it, vi } from "vitest";

import {
  Agent,
  BaseInterceptor,
  FileBytes,
  ImageFile,
  StructuredTool,
  TextFile,
  VideoFile,
  convertToolsToOpenAISchema,
  type LLMMessage,
  type LLMResponse,
} from "@crewai-ts/core";
import { CONTEXT_WINDOW_USAGE_RATIO } from "@crewai-ts/core/llm";
import type { Tool } from "@crewai-ts/core/types";
import { GeminiCompletion } from "../src/index.js";

describe("GeminiCompletion", () => {
  it("exposes upstream provider aliases directly on the provider class", async () => {
    const gemini = new GeminiCompletion({ model: "gemini-2.5-flash", apiKey: "gemini-key" });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "demo ok" }] } }],
    })));

    try {
      for (const methodName of [
        "acall",
        "format_text_content",
        "get_context_window_size",
        "get_file_uploader",
        "supports_function_calling",
        "supports_multimodal",
        "supports_stop_words",
        "to_config_dict",
      ]) {
        expect(Object.hasOwn(GeminiCompletion.prototype, methodName)).toBe(true);
      }
      expect(gemini.get_file_uploader()).toMatchObject({ provider: "gemini" });
      expect(gemini.format_text_content("hello")).toEqual({ text: "hello" });
      expect(gemini.to_config_dict()).toMatchObject({ model: "gemini-2.5-flash", provider: "gemini" });
      await expect(gemini.acall([{ role: "user", content: "hello" }])).resolves.toBe("demo ok");
      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining("gemini-2.5-flash:generateContent?key=gemini-key"), expect.objectContaining({
        method: "POST",
      }));
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("calls Vertex AI Gemini through the built-in fetch transport", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: "vertex smoke ok" }] } }],
      }),
    } as Response);

    try {
      const gemini = new GeminiCompletion({
        model: "gemini-2.5-flash",
        use_vertexai: true,
        project: "demo-project",
        location: "us-central1",
        client_params: { access_token: "vertex-token" },
      });
      await expect(gemini.call([{ role: "user", content: "hello" }])).resolves.toBe("vertex smoke ok");
      const [vertexUrl, vertexInit] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(vertexUrl).toBe("https://us-central1-aiplatform.googleapis.com/v1/projects/demo-project/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent");
      expect(vertexInit.method).toBe("POST");
      expect(vertexInit.headers).toMatchObject({
        Authorization: "Bearer vertex-token",
        "Content-Type": "application/json",
      });
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("formats direct Agent text and video input files", async () => {
    class CapturingGeminiLLM extends GeminiCompletion {
      formattedMessages: readonly LLMMessage[] = [];

      constructor() {
        super({ model: "gemini/gemini-2.0-flash" });
      }

      override async call(messages: readonly LLMMessage[]): Promise<LLMResponse> {
        this.formattedMessages = this.formatMessages(messages);
        return "gemini media done";
      }
    }

    const llmInstance = new CapturingGeminiLLM();
    const agent = new Agent({
      role: "Gemini Media Analyst",
      goal: "Analyze Gemini media files",
      backstory: "Expert at reading multimodal files",
      llm: llmInstance,
    });
    const textBytes = Buffer.from("Gemini direct agent notes");
    const videoBytes = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, ...Buffer.from("mp42")]);
    const readme = new TextFile({
      source: new FileBytes({ data: textBytes, filename: "readme.txt" }),
    });
    const video = new VideoFile({
      source: new FileBytes({ data: videoBytes, filename: "sample.mp4" }),
    });

    await expect(agent.kickoff([
      {
        role: "user",
        content: "What files do you see?",
      },
    ], {
      input_files: {
        readme,
        video,
      },
    })).resolves.toBe("gemini media done");

    const userMessage = llmInstance.formattedMessages.findLast((message) => message.role === "user");
    expect(userMessage?.files).toBeUndefined();
    expect(userMessage?.content).toEqual([
      { text: expect.stringContaining("What files do you see?") },
      {
        inlineData: {
          mimeType: "text/plain",
          data: textBytes.toString("base64"),
        },
      },
      {
        inlineData: {
          mimeType: "video/mp4",
          data: videoBytes.toString("base64"),
        },
      },
    ]);
  });

  it("formats mixed typed files as provider content blocks", () => {
    const pngBytes = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from("gemini-message-image"),
    ]);
    const textBytes = Buffer.from("Gemini text notes");
    const llm = new GeminiCompletion({ model: "gemini/gemini-2.0-flash" });
    const messages = llm._format_messages([{
      role: "user",
      content: "Inspect these files",
      files: {
        chart: new ImageFile({ source: pngBytes }),
        readme: new TextFile({ source: textBytes }),
      },
    }]);

    expect(messages[0]?.files).toBeUndefined();
    expect(messages[0]?.content).toEqual([
      { text: "Inspect these files" },
      {
        inlineData: {
          mimeType: "image/png",
          data: pngBytes.toString("base64"),
        },
      },
      {
        inlineData: {
          mimeType: "text/plain",
          data: textBytes.toString("base64"),
        },
      },
    ]);
  });

  it("preserves Gemini multimodal parts arrays passed as message content", () => {
    const llm = new GeminiCompletion({ model: "gemini/gemini-2.0-flash" });
    const parts = [
      { text: "Inspect this image" },
      {
        inlineData: {
          mimeType: "image/png",
          data: Buffer.from("gemini-inline-image").toString("base64"),
        },
      },
    ];

    const [contents, systemInstruction] = (llm as unknown as {
      _format_messages_for_gemini(messages: Array<LLMMessage & Record<string, unknown>>): [Record<string, unknown>[], string | null];
    })._format_messages_for_gemini([
      { role: "user", content: parts } as unknown as LLMMessage & Record<string, unknown>,
    ]);

    expect(systemInstruction).toBeNull();
    expect(contents).toEqual([
      {
        role: "user",
        parts,
      },
    ]);
  });

  it("rejects interceptor transport", () => {
    class TestInterceptor extends BaseInterceptor {
      on_outbound(message: unknown): unknown {
        return message;
      }

      on_inbound(message: unknown): unknown {
        return message;
      }
    }

    const interceptor = new TestInterceptor();

    expect(() => new GeminiCompletion({ model: "gemini-2.5-pro", interceptor }))
      .toThrow(/gemini.*interceptor/i);
    expect(new GeminiCompletion({ model: "gemini-2.5-pro" }).interceptor).toBeNull();
  });

  it("exposes completion provider parity helpers", () => {
    class GeminiUsageMetadata {
      get prompt_token_count(): number {
        return 10;
      }

      get candidates_token_count(): number {
        return 7;
      }

      get thoughts_token_count(): number {
        return 3;
      }

      get total_token_count(): number {
        return 20;
      }

      get cached_content_token_count(): number {
        return 2;
      }
    }
    const gemini = new GeminiCompletion({
      model: "gemini-2.5-pro",
      api_key: "gemini-key",
      project: "demo-project",
      location: "europe-west1",
      top_p: 0.9,
      top_k: 40,
      max_output_tokens: 2048,
      safety_settings: [{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }],
    });

    expect(gemini.supports_function_calling()).toBe(true);
    expect(gemini.supports_stop_words()).toBe(true);
    expect(gemini.supports_multimodal()).toBe(true);
    expect(gemini.get_context_window_size()).toBe(Math.trunc(1048576 * CONTEXT_WINDOW_USAGE_RATIO));
    expect(gemini.format_text_content("hello")).toEqual({ text: "hello" });
    expect(gemini.to_config_dict()).toMatchObject({
      model: "gemini-2.5-pro",
      provider: "gemini",
      api_key: "gemini-key",
      project: "demo-project",
      location: "europe-west1",
      top_p: 0.9,
      top_k: 40,
      max_output_tokens: 2048,
      safety_settings: [{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }],
    });

    expect(GeminiCompletion.extract_token_usage({
      usage_metadata: new GeminiUsageMetadata(),
    })).toEqual({
      prompt_token_count: 10,
      candidates_token_count: 7,
      completion_tokens: 10,
      total_token_count: 20,
      total_tokens: 20,
      cached_prompt_tokens: 2,
      reasoning_tokens: 3,
    });
    expect((GeminiCompletion as unknown as {
      _extract_token_usage(response: unknown): Record<string, number>;
    })._extract_token_usage({
      usage_metadata: new GeminiUsageMetadata(),
    })).toEqual({
      prompt_token_count: 10,
      candidates_token_count: 7,
      completion_tokens: 10,
      total_token_count: 20,
      total_tokens: 20,
      cached_prompt_tokens: 2,
      reasoning_tokens: 3,
    });

    expect(GeminiCompletion.extract_text_from_response({
      candidates: [{
        content: {
          parts: [
            { text: "visible" },
            { text: "hidden", thought: true },
            { text: " text" },
          ],
        },
      }],
    })).toBe("visible text");
    expect(GeminiCompletion.add_property_ordering({
      type: "object",
      properties: {
        name: { type: "string" },
        nested: {
          type: "object",
          properties: { value: { type: "number" } },
        },
      },
    })).toEqual({
      type: "object",
      propertyOrdering: ["name", "nested"],
      properties: {
        name: { type: "string" },
        nested: {
          type: "object",
          propertyOrdering: ["value"],
          properties: { value: { type: "number" } },
        },
      },
    });
    expect(GeminiCompletion.convert_contents_to_dict([
      { role: "model", parts: [{ text: "assistant text" }] },
      { role: null, parts: [{ text: "user text" }] },
    ])).toEqual([
      { role: "assistant", content: "assistant text" },
      { role: "user", content: "user text" },
    ]);
  });

  it("defaults missing usage metadata fields to zero", () => {
    expect(GeminiCompletion.extract_token_usage({})).toEqual({ total_tokens: 0 });
    expect(GeminiCompletion.extract_token_usage({ usage_metadata: null })).toEqual({ total_tokens: 0 });
    expect(GeminiCompletion.extract_token_usage({
      usage_metadata: {
        prompt_token_count: 80,
        candidates_token_count: 40,
        total_token_count: 120,
        thoughts_token_count: null,
        cached_content_token_count: null,
      },
    })).toEqual({
      prompt_token_count: 80,
      candidates_token_count: 40,
      completion_tokens: 40,
      total_token_count: 120,
      total_tokens: 120,
      cached_prompt_tokens: 0,
      reasoning_tokens: 0,
    });
  });

  it("preserves structured output fields that contain stop words", () => {
    const gemini = new GeminiCompletion({
      model: "gemini-2.0-flash-001",
      stop_sequences: ["Observation:", "Final Answer:", "Action:"],
    });
    const observationModel = {
      name: "AgentObservation",
      model_validate(value: unknown) {
        const record = value as Record<string, unknown>;
        return {
          action_taken: String(record.action_taken),
          observation_result: String(record.observation_result),
          final_answer: String(record.final_answer),
        };
      },
    };

    expect(gemini._validate_structured_output(`{
      "action_taken": "Action: Searched the database",
      "observation_result": "Observation: Found 5 relevant results",
      "final_answer": "Final Answer: The data shows positive growth"
    }`, observationModel)).toEqual({
      action_taken: "Action: Searched the database",
      observation_result: "Observation: Found 5 relevant results",
      final_answer: "Final Answer: The data shows positive growth",
    });
    expect(gemini._apply_stop_words("I need to search.\nObservation: Found results")).toBe("I need to search.");
  });

  it("selects response schema config by model family", () => {
    const responseModel = {
      model_json_schema: () => ({
        type: "object",
        properties: {
          name: { type: "string", description: "The name" },
          age: { type: "integer", description: "The age" },
          email: { type: "string", description: "The email" },
        },
      }),
    };
    const gemini20Config = (new GeminiCompletion({ model: "gemini-2.0-flash-001" }) as unknown as {
      _prepare_generation_config(
        systemInstruction?: string | null,
        tools?: StructuredTool[] | null,
        responseModel?: unknown,
      ): Record<string, unknown>;
    })._prepare_generation_config(null, null, responseModel);
    const gemini15Config = (new GeminiCompletion({ model: "gemini-1.5-pro" }) as unknown as {
      _prepare_generation_config(
        systemInstruction?: string | null,
        tools?: StructuredTool[] | null,
        responseModel?: unknown,
      ): Record<string, unknown>;
    })._prepare_generation_config(null, null, responseModel);

    expect(gemini20Config.response_mime_type).toBe("application/json");
    expect(gemini20Config.response_json_schema).toMatchObject({
      type: "object",
      propertyOrdering: ["name", "age", "email"],
    });
    expect(gemini20Config).not.toHaveProperty("response_schema");
    expect(gemini15Config.response_mime_type).toBe("application/json");
    expect(gemini15Config.response_schema).toBe(responseModel);
    expect(gemini15Config).not.toHaveProperty("response_json_schema");
  });

  it("wraps non-object tool results in function response result fields", () => {
    const gemini = new GeminiCompletion({ model: "gemini-2.0-flash-001" });

    const [contents] = (gemini as unknown as {
      _format_messages_for_gemini(messages: Array<LLMMessage & Record<string, unknown>>): [Record<string, unknown>[], string | null];
    })._format_messages_for_gemini([
      { role: "tool", content: "30000", name: "sum_numbers", tool_call_id: "call_1" },
      { role: "tool", content: "\"done\"", name: "string_tool", tool_call_id: "call_2" },
    ]);

    expect(contents).toEqual([{
      role: "user",
      parts: [
        { functionResponse: { name: "sum_numbers", response: { result: 30000 } } },
        { functionResponse: { name: "string_tool", response: { result: "done" } } },
      ],
    }]);
  });

  it("keeps direct stop assignments synchronized with API stop sequences", () => {
    const gemini = new GeminiCompletion({ model: "gemini-2.0-flash-001" });

    gemini.stop = ["\nObservation:", "\nThought:"];
    expect(gemini.stop_sequences).toEqual(["\nObservation:", "\nThought:"]);
    expect((gemini as unknown as {
      _prepare_generation_config(): Record<string, unknown>;
    })._prepare_generation_config()).toMatchObject({
      stop_sequences: ["\nObservation:", "\nThought:"],
    });

    gemini.stop = "\nFinal Answer:";
    expect(gemini.stop_sequences).toEqual(["\nFinal Answer:"]);

    gemini.stop = null;
    expect(gemini.stop_sequences).toEqual([]);
    expect((gemini as unknown as {
      _prepare_generation_config(): Record<string, unknown>;
    })._prepare_generation_config()).not.toHaveProperty("stop_sequences");
  });

  it("accumulates streaming chunks", () => {
    const gemini = new GeminiCompletion({ model: "gemini-2.5-pro" });
    const functionCallPart = {
      functionCall: { name: "search_docs", args: { query: "CrewAI" } },
      thought_signature: "gemini-thinking-signature",
    };

    const accumulated = (gemini as unknown as {
      _accumulate_stream_chunks(chunks: unknown[]): {
        text: string;
        function_calls: Record<string, unknown>[];
        usage: Record<string, number> | null;
        thinking_text: string;
        response_id: string | null;
      };
    })._accumulate_stream_chunks([
      {
        response_id: "gemini-response-1",
        usage_metadata: {
          prompt_token_count: 10,
          candidates_token_count: 6,
          thoughts_token_count: 2,
          total_token_count: 18,
          cached_content_token_count: 3,
        },
        candidates: [{
          content: {
            parts: [
              { text: "Hel" },
              { text: "thinking", thought: true },
              { text: "lo" },
              functionCallPart,
            ],
          },
        }],
      },
    ]);

    expect(accumulated).toEqual({
      text: "Hello",
      function_calls: [{
        id: "call_0",
        type: "function",
        function: { name: "search_docs", arguments: "{\"query\":\"CrewAI\"}" },
        args: { query: "CrewAI" },
        index: 0,
        raw_part: functionCallPart,
      }],
      usage: {
        prompt_token_count: 10,
        candidates_token_count: 6,
        completion_tokens: 8,
        total_token_count: 18,
        total_tokens: 18,
        cached_prompt_tokens: 3,
        reasoning_tokens: 2,
      },
      thinking_text: "thinking",
      response_id: "gemini-response-1",
    });
    expect(gemini.get_token_usage_summary()).toMatchObject({
      promptTokens: 10,
      completionTokens: 8,
      totalTokens: 18,
      cachedPromptTokens: 3,
      reasoningTokens: 2,
      successfulRequests: 1,
    });
  });

  it("prepares messages and generation config with tools", () => {
    const search = new StructuredTool({
      name: "search docs",
      description: "Search documentation",
      argsSchema: {
        query: { type: "string", description: "Search query" },
      },
      func: () => "result",
    });
    const responseModel = {
      model_json_schema: () => ({
        type: "object",
        properties: {
          answer: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["answer"],
      }),
    };
    const gemini = new GeminiCompletion({
      model: "gemini-2.5-pro",
      temperature: 0.4,
      top_p: 0.9,
      top_k: 40,
      max_output_tokens: 512,
      stop: ["STOP"],
      safety_settings: [{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }],
      thinking_config: { include_thoughts: true },
    });

    const [contents, systemInstruction] = (gemini as unknown as {
      _format_messages_for_gemini(messages: Array<LLMMessage & Record<string, unknown>>): [Record<string, unknown>[], string | null];
    })._format_messages_for_gemini([
      { role: "system", content: "System prompt" },
      { role: "user", content: "Find CrewAI" },
      {
        role: "assistant",
        content: "Calling search",
        tool_calls: [{
          id: "call_1",
          function: { name: "search_docs", arguments: "{\"query\":\"CrewAI\"}" },
        }],
      },
      { role: "tool", content: "{\"result\":\"docs\"}", name: "search_docs", tool_call_id: "call_1" },
    ]);

    expect(systemInstruction).toBe("System prompt");
    expect(contents).toEqual([
      { role: "user", parts: [{ text: "Find CrewAI" }] },
      {
        role: "model",
        parts: [
          { text: "Calling search" },
          { functionCall: { name: "search_docs", args: { query: "CrewAI" } } },
        ],
      },
      { role: "user", parts: [{ functionResponse: { name: "search_docs", response: { result: "docs" } } }] },
    ]);

    const config = (gemini as unknown as {
      _prepare_generation_config(
        systemInstruction?: string | null,
        tools?: StructuredTool[] | null,
        responseModel?: unknown,
      ): Record<string, unknown>;
    })._prepare_generation_config(systemInstruction, [search], responseModel);

    expect(config).toMatchObject({
      system_instruction: { role: "user", parts: [{ text: "System prompt" }] },
      temperature: 0.4,
      top_p: 0.9,
      top_k: 40,
      max_output_tokens: 512,
      stop_sequences: ["STOP"],
      safety_settings: [{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }],
      thinking_config: { include_thoughts: true },
      tools: [
        {
          functionDeclarations: [{
            name: "search_docs",
            description: "Search documentation",
            parametersJsonSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                query: { type: "string", description: "Search query" },
              },
              required: ["query"],
            },
          }],
        },
        {
          functionDeclarations: [{
            name: "structured_output",
            parametersJsonSchema: {
              type: "object",
              propertyOrdering: ["answer", "confidence"],
            },
          }],
        },
      ],
    });
    expect(config).not.toHaveProperty("response_json_schema");
  });

  it("preserves raw tool call parts when formatting assistant tool messages", () => {
    const gemini = new GeminiCompletion({ model: "gemini-2.5-pro" });
    const rawToolPart = { functionCall: { name: "raw_search", args: { query: "CrewAI" } } };

    const [contents] = (gemini as unknown as {
      _format_messages_for_gemini(messages: Array<LLMMessage & Record<string, unknown>>): [Record<string, unknown>[], string | null];
    })._format_messages_for_gemini([
      {
        role: "assistant",
        content: "Using raw call",
        tool_calls: [{
          id: "call_1",
          function: { name: "search_docs", arguments: "{\"query\":\"ignored\"}" },
        }],
        raw_tool_call_parts: [rawToolPart],
      },
    ]);

    expect(contents).toEqual([{
      role: "model",
      parts: [
        { text: "Using raw call" },
        rawToolPart,
      ],
    }]);
  });

  it("extracts function calls and structured output pseudo-tool responses", () => {
    const response = {
      candidates: [{
        content: {
          parts: [
            { text: "Need search" },
            { functionCall: { name: "search_docs", args: { query: "CrewAI" } } },
            { function_call: { name: "lookup_docs", args: { id: "intro" } } },
            { functionCall: { name: "structured_output", args: { answer: "done", confidence: 0.91 } } },
          ],
        },
      }],
    };

    expect(GeminiCompletion.extract_structured_output_from_response(response)).toEqual({
      answer: "done",
      confidence: 0.91,
    });
    expect(GeminiCompletion.extract_function_calls_from_response(response)).toEqual([
      {
        id: "call_0",
        type: "function",
        function: {
          name: "search_docs",
          arguments: "{\"query\":\"CrewAI\"}",
        },
        args: { query: "CrewAI" },
        index: 0,
      },
      {
        id: "call_1",
        type: "function",
        function: {
          name: "lookup_docs",
          arguments: "{\"id\":\"intro\"}",
        },
        args: { id: "intro" },
        index: 1,
      },
    ]);
  });

  it("processes response function calls with optional direct execution", async () => {
    const gemini = new GeminiCompletion({ model: "gemini-2.5-pro" });
    const response = {
      candidates: [{
        content: {
          parts: [
            { text: "Need search" },
            { functionCall: { name: "search_docs", args: { query: "CrewAI" } } },
          ],
        },
      }],
    };

    await expect((gemini as unknown as {
      _process_response_with_tools(
        response: unknown,
        contents: unknown[],
        availableFunctions?: Record<string, unknown> | null,
      ): Promise<unknown>;
    })._process_response_with_tools(response, [])).resolves.toEqual([
      { functionCall: { name: "search_docs", args: { query: "CrewAI" } } },
    ]);
    await expect((gemini as unknown as {
      _process_response_with_tools(
        response: unknown,
        contents: unknown[],
        availableFunctions?: Record<string, unknown> | null,
      ): Promise<unknown>;
    })._process_response_with_tools(response, [], {
      search_docs: ({ query }: { query: string }) => ({ result: `found ${query}` }),
    })).resolves.toBe("{\"result\":\"found CrewAI\"}");
  });

  it("runs all functionCall parts and returns the final text response", async () => {
    const grepCode = vi.fn((args: Record<string, unknown>) => `grep:${String(args.query)}`);
    const readFile = vi.fn((args: Record<string, unknown>) => `read:${String(args.path)}`);
    const tools = [
      geminiNativeTestTool("grep_code", grepCode),
      geminiNativeTestTool("read_file", readFile),
    ];
    const [geminiTools, availableFunctions] = convertToolsToOpenAISchema(tools);
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(geminiFetchResponse(geminiToolResponse([
        { functionCall: { name: "grep_code", args: { query: "GeminiCompletion" } }, thoughtSignature: "sig-grep" },
        { functionCall: { name: "read_file", args: { path: "src/provider.ts" } }, thoughtSignature: "sig-read" },
      ])))
      .mockResolvedValueOnce(geminiFetchResponse(geminiToolResponse([
        { text: "final answer from Gemini" },
      ])));

    try {
      const llm = new GeminiCompletion({ model: "gemini-3.0-pro", apiKey: "test-key" });
      const result = await llm.call([{ role: "user", content: "inspect Gemini tools" }], {
        tools: geminiTools as unknown as Tool[],
        availableFunctions,
      });

      expect(result).toBe("final answer from Gemini");
      expect(grepCode).toHaveBeenCalledWith({ query: "GeminiCompletion" });
      expect(readFile).toHaveBeenCalledWith({ path: "src/provider.ts" });
      expect(fetchMock).toHaveBeenCalledTimes(2);

      const secondRequest = parseGeminiFetchBody(fetchMock, 1);
      const secondContents = secondRequest.contents as Record<string, unknown>[];
      expect(secondContents.at(-2)).toMatchObject({
        role: "model",
        parts: [
          { functionCall: { name: "grep_code", args: { query: "GeminiCompletion" } }, thoughtSignature: "sig-grep" },
          { functionCall: { name: "read_file", args: { path: "src/provider.ts" } }, thoughtSignature: "sig-read" },
        ],
      });
      expect(secondContents.at(-1)).toMatchObject({
        role: "user",
        parts: [
          { functionResponse: { name: "grep_code", response: { result: "grep:GeminiCompletion" } } },
          { functionResponse: { name: "read_file", response: { result: "read:src/provider.ts" } } },
        ],
      });
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("recovers a final text answer when Gemini returns empty text after tool responses", async () => {
    const grepCode = vi.fn((args: Record<string, unknown>) => `grep:${String(args.query)}`);
    const tools = [geminiNativeTestTool("grep_code", grepCode)];
    const [geminiTools, availableFunctions] = convertToolsToOpenAISchema(tools);
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(geminiFetchResponse(geminiToolResponse([
        { functionCall: { name: "grep_code", args: { query: "LeadBotFlow" } }, thoughtSignature: "sig-grep" },
      ])))
      .mockResolvedValueOnce(geminiFetchResponse(geminiToolResponse([
        { text: "thinking without final text", thought: true },
      ])))
      .mockResolvedValueOnce(geminiFetchResponse(geminiToolResponse([
        { text: "final answer after retry" },
      ])));

    try {
      const llm = new GeminiCompletion({ model: "gemini-3.0-pro", apiKey: "test-key" });
      const result = await llm.call([{ role: "user", content: "inspect LeadBot tools" }], {
        tools: geminiTools as unknown as Tool[],
        availableFunctions,
      });

      expect(result).toBe("final answer after retry");
      expect(grepCode).toHaveBeenCalledWith({ query: "LeadBotFlow" });
      expect(fetchMock).toHaveBeenCalledTimes(3);

      const thirdRequest = parseGeminiFetchBody(fetchMock, 2);
      const thirdContents = thirdRequest.contents as Record<string, unknown>[];
      expect(thirdContents.at(-2)).toMatchObject({
        role: "user",
        parts: [
          { functionResponse: { name: "grep_code", response: { result: "grep:LeadBotFlow" } } },
        ],
      });
      expect(thirdContents.at(-1)).toMatchObject({
        role: "user",
        parts: [
          { text: expect.stringContaining("Write the final answer as plain text") },
        ],
      });
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("fails clearly when a response requests an unknown function", async () => {
    const [geminiTools, availableFunctions] = convertToolsToOpenAISchema([
      geminiNativeTestTool("grep_code", () => "unused"),
    ]);
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(geminiFetchResponse(geminiToolResponse([
        { functionCall: { name: "missing_tool", args: { query: "x" } } },
      ])));

    try {
      const llm = new GeminiCompletion({ model: "gemini-3.0-pro", apiKey: "test-key" });
      await expect(llm.call([{ role: "user", content: "call missing tool" }], {
        tools: geminiTools as unknown as Tool[],
        availableFunctions,
      })).rejects.toThrow("Gemini requested unknown function 'missing_tool'.");
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("passes available functions through Agent tools for native calls", async () => {
    const readFile = vi.fn((args: Record<string, unknown>) => `read:${String(args.path)}`);
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(geminiFetchResponse(geminiToolResponse([
        { functionCall: { name: "read_file", args: { path: "README.md" } }, thoughtSignature: "sig-read" },
      ])))
      .mockResolvedValueOnce(geminiFetchResponse(geminiToolResponse([
        { text: "final after reading" },
      ])));

    try {
      const agent = new Agent({
        role: "Gemini Tool Agent",
        goal: "Read files",
        backstory: "Uses native Gemini tools",
        llm: new GeminiCompletion({ model: "gemini-3.0-pro", apiKey: "test-key" }),
        tools: [geminiNativeTestTool("read_file", readFile)],
      });

      await expect(agent.kickoff("Read README.md")).resolves.toBe("final after reading");
      expect(readFile).toHaveBeenCalledWith({ path: "README.md" });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const secondRequest = parseGeminiFetchBody(fetchMock, 1);
      const secondContents = secondRequest.contents as Record<string, unknown>[];
      expect(secondContents.at(-1)).toMatchObject({
        role: "user",
        parts: [
          { functionResponse: { name: "read_file", response: { result: "read:README.md" } } },
        ],
      });
    } finally {
      fetchMock.mockRestore();
    }
  });
});

function geminiToolResponse(parts: unknown[]): Record<string, unknown> {
  return {
    candidates: [{
      content: {
        role: "model",
        parts,
      },
    }],
  };
}

function geminiFetchResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response;
}

function parseGeminiFetchBody(fetchMock: { mock: { calls: ReadonlyArray<readonly unknown[]> } }, index: number): Record<string, unknown> {
  const init = fetchMock.mock.calls[index]?.[1] as { body?: unknown } | undefined;
  const body = init?.body;
  expect(typeof body).toBe("string");
  const parsed = JSON.parse(body as string) as unknown;
  expect(parsed).toEqual(expect.any(Object));
  return parsed as Record<string, unknown>;
}

function geminiNativeTestTool(name: string, run: (args: Record<string, unknown>) => unknown): Tool {
  return {
    name,
    description: `${name} test tool`,
    argsSchema: {
      query: { type: "string" },
      path: { type: "string" },
    },
    run,
  } as unknown as Tool;
}
