import { describe, expect, it } from "vitest";

import { StructuredTool } from "@crewai-ts/core";
import type { LLMMessage } from "@crewai-ts/core/types";
import { BedrockCompletion } from "../src/index.js";

describe("BedrockCompletion", () => {
  it("prepares Converse request bodies with tools and provider fields", () => {
    const search = new StructuredTool({
      name: "search docs",
      description: "Search documentation",
      argsSchema: {
        query: { type: "string", description: "Search query" },
      },
      func: () => "result",
    });
    const bedrock = new BedrockCompletion({
      model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      temperature: 0.2,
      top_p: 0.8,
      top_k: 40,
      max_tokens: 300,
      stop: ["STOP"],
      stream: true,
      guardrail_config: { guardrailIdentifier: "guard", guardrailVersion: "1" },
      additional_model_request_fields: { thinking: { type: "enabled", budget_tokens: 1024 } },
      additional_model_response_field_paths: ["/stop_sequence"],
    });

    const prepared = bedrock._prepare_converse_request_body([
      { role: "system", content: "System prompt" },
      { role: "user", content: "Find CrewAI" },
    ], [search]);

    expect(prepared.messages).toEqual([{ role: "user", content: [{ text: "Find CrewAI" }] }]);
    expect(prepared.system_message).toBe("System prompt");
    expect(prepared.body).toMatchObject({
      inferenceConfig: {
        maxTokens: 300,
        temperature: 0.2,
        topP: 0.8,
        stopSequences: ["STOP"],
        topK: 40,
      },
      system: [{ text: "System prompt" }],
      toolConfig: {
        tools: [{
          toolSpec: {
            name: "search_docs",
            description: "Search documentation",
          },
        }],
      },
      guardrailConfig: { guardrailIdentifier: "guard", guardrailVersion: "1" },
      additionalModelRequestFields: { thinking: { type: "enabled", budget_tokens: 1024 } },
      additionalModelResponseFieldPaths: ["/stop_sequence"],
    });
  });

  it("groups Converse tool results and executes tool uses", async () => {
    const bedrock = new BedrockCompletion({ model: "anthropic.claude-3-5-sonnet-20241022-v2:0" });
    const formatted = bedrock._format_messages_for_converse([
      { role: "user", content: "Use tools" },
      {
        role: "assistant",
        content: "",
        tool_calls: [
          { id: "tool-1", type: "function", function: { name: "lookup_weather", arguments: "{\"location\":\"Seoul\"}" } },
          { id: "tool-2", type: "function", function: { name: "lookup_news", arguments: "{\"topic\":\"AI\"}" } },
        ],
      },
      { role: "tool", tool_call_id: "tool-1", content: "sunny" },
      { role: "tool", tool_call_id: "tool-2", content: "news" },
    ] as Array<LLMMessage & Record<string, unknown>>)[0];

    expect(formatted.map((message) => message.role)).toEqual(["user", "assistant", "user"]);
    expect(formatted[2]?.content).toHaveLength(2);

    await expect(bedrock._execute_tool_use_and_prepare_messages(
      [{ role: "user", content: [{ text: "Find docs" }] }],
      { toolUseId: "tooluse-1", name: "search_docs", input: { query: "CrewAI" } },
      { search_docs: ({ query }: Record<string, unknown>) => ({ result: `found ${String(query)}` }) },
    )).resolves.toMatchObject({
      result: "{\"result\":\"found CrewAI\"}",
    });
  });

  it("extracts usage, structured output, and stream events", () => {
    const bedrock = new BedrockCompletion({ model: "anthropic.claude-3-5-sonnet-20241022-v2:0" });

    expect(BedrockCompletion.extract_bedrock_token_usage({
      inputTokens: 9,
      outputTokens: 4,
      totalTokens: 13,
      cacheReadInputTokenCount: 2,
    })).toEqual({
      prompt_tokens: 9,
      completion_tokens: 4,
      total_tokens: 13,
      cached_prompt_tokens: 2,
    });
    expect(BedrockCompletion.extract_structured_output_from_response({
      output: {
        message: {
          content: [
            { toolUse: { toolUseId: "tool-2", name: "structured_output", input: { answer: "done" } } },
          ],
        },
      },
    })).toEqual({ answer: "done" });

    expect(bedrock._accumulate_converse_stream_events([
      { contentBlockDelta: { contentBlockIndex: 0, delta: { text: "Hel" } } },
      { contentBlockDelta: { contentBlockIndex: 0, delta: { text: "lo" } } },
      { messageStop: { stopReason: "end_turn" } },
    ])).toMatchObject({
      text: "Hello",
      stop_reason: "end_turn",
    });
  });
});
