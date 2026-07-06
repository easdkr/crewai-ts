import { describe, expect, it } from "vitest";

import { BaseTool, type ToolArgsSchema } from "@crewai-ts/core/tools";
import { OpenAICompletion } from "../src/index.js";

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
