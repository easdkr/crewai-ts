import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  MCPClient,
  MCPNativeTool,
  MCPServerHTTP,
  MCPToolResolver,
  MCPToolWrapper,
} from "../src/index.js";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const mcpPackage = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

describe("@crewai-ts/mcp import boundary", () => {
  it("owns MCP SDK integration without provider or optional feature dependencies", () => {
    const allDependencies = {
      ...mcpPackage.dependencies,
      ...mcpPackage.peerDependencies,
      ...mcpPackage.optionalDependencies,
    };

    expect(allDependencies).toHaveProperty("@crewai-ts/core");
    expect(allDependencies).toHaveProperty("@modelcontextprotocol/sdk");
    expect(allDependencies).not.toHaveProperty("pdf-parse");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/rag");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/a2a");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/flow");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/gemini");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/openai");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/anthropic");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/bedrock");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/azure");
  });

  it("exports MCP client, resolver, config, and tool wrappers", () => {
    expect(new MCPServerHTTP({ url: "https://mcp.example.com/api" })).toBeInstanceOf(MCPServerHTTP);
    expect(new MCPToolResolver({ logger: null })).toBeInstanceOf(MCPToolResolver);
    expect(MCPClient).toBeTypeOf("function");
    expect(MCPNativeTool).toBeTypeOf("function");
    expect(MCPToolWrapper).toBeTypeOf("function");
  });
});
