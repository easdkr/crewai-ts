import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ConfiguredLLM, createLLM } from "@crewai-ts/core/llm";
import {
  BedrockCompletion,
  registerBedrockProvider,
} from "../src/index.js";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bedrockPackage = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

describe("@crewai-ts/bedrock import boundary", () => {
  it("exposes Bedrock without optional feature dependencies", () => {
    const allDependencies = {
      ...bedrockPackage.dependencies,
      ...bedrockPackage.peerDependencies,
      ...bedrockPackage.optionalDependencies,
    };

    expect(allDependencies).toHaveProperty("@crewai-ts/core");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/openai");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/anthropic");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/gemini");
    expect(allDependencies).not.toHaveProperty("pdf-parse");
    expect(allDependencies).not.toHaveProperty("@modelcontextprotocol/sdk");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/rag");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/mcp");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/a2a");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/flow");
  });

  it("can instantiate and register Bedrock providers", () => {
    const before = createLLM("bedrock/amazon.nova-pro-v1:0");
    expect(before).toBeInstanceOf(ConfiguredLLM);

    registerBedrockProvider();

    const bedrock = createLLM("bedrock/amazon.nova-pro-v1:0");
    const awsAlias = createLLM("aws/anthropic.claude-3-5-sonnet-20241022-v2:0");

    expect(bedrock).toBeInstanceOf(BedrockCompletion);
    expect((bedrock as BedrockCompletion).provider).toBe("bedrock");
    expect((bedrock as BedrockCompletion).model).toBe("amazon.nova-pro-v1:0");
    expect(awsAlias).toBeInstanceOf(BedrockCompletion);
    expect((awsAlias as BedrockCompletion).provider).toBe("bedrock");
    expect((awsAlias as BedrockCompletion).model).toBe("anthropic.claude-3-5-sonnet-20241022-v2:0");
  });
});
