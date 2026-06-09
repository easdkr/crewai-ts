import { describe, expect, it, vi } from "vitest";

import {
  HTTPTransport,
  MCPNativeTool,
  MCPServerHTTP,
  MCPServerSSE,
  MCPServerStdio,
  MCPToolResolver,
  MCPToolWrapper,
  StaticToolFilter,
  TransportType,
  isMCPServerConfig,
} from "../src/index.js";

describe("@crewai-ts/mcp", () => {
  it("filters MCP tools with static allow and block lists", () => {
    const allow = new StaticToolFilter({ allowedToolNames: ["search"] });
    const block = new StaticToolFilter({ blockedToolNames: ["delete"] });

    expect(allow.filter({ name: "search" })).toBe(true);
    expect(allow.filter({ name: "delete" })).toBe(false);
    expect(block.filter({ name: "search" })).toBe(true);
    expect(block.filter({ name: "delete" })).toBe(false);
  });

  it("builds MCP server configs and transport metadata", () => {
    const resolver = new MCPToolResolver({ logger: { log: vi.fn() } });
    const stdio = new MCPServerStdio({ command: "node", args: ["server.js"] });
    const http = resolver._build_mcp_config_from_dict({
      type: "http",
      url: "https://api.example.com/mcp",
      headers: { Authorization: "Bearer token" },
      streamable: false,
    });
    const sse = MCPToolResolver._build_mcp_config_from_dict({
      type: "sse",
      url: "https://api.example.com/sse",
    });

    expect(stdio.args).toEqual(["server.js"]);
    expect(http).toBeInstanceOf(MCPServerHTTP);
    expect((http as MCPServerHTTP).streamable).toBe(false);
    expect((http as MCPServerHTTP).headers).toEqual({ Authorization: "Bearer token" });
    expect(sse).toBeInstanceOf(MCPServerSSE);
    expect(isMCPServerConfig(stdio)).toBe(true);
    expect(isMCPServerConfig({ command: "node" })).toBe(false);
    expect(resolver._parse_amp_ref("crewai-amp:notion#search")).toEqual(["notion", "search"]);
    expect(resolver._extract_server_name("https://api.example.com/mcp/v1")).toBe("api_example_com_mcp_v1");

    const [transport, serverName] = MCPToolResolver.createTransport(http);
    expect(transport).toBeInstanceOf(HTTPTransport);
    expect(transport.transport_type).toBe(TransportType.HTTP);
    expect(serverName).toBe("api_example_com_mcp");
  });

  it("uses fresh native MCP clients for tool invocations", async () => {
    const connect = vi.fn(() => Promise.resolve());
    const disconnect = vi.fn(() => Promise.resolve());
    const callTool = vi.fn((_toolName: string, args: Record<string, unknown>) => Promise.resolve({ ok: args.query }));
    const tool = new MCPNativeTool({
      clientFactory: () => ({ connect, disconnect, callTool }),
      toolName: "search",
      originalToolName: "Search Issues",
      serverName: "github",
      toolSchema: {
        description: "Search issues",
        inputSchema: {
          type: "object",
          properties: { query: { type: "string", description: "Search query" } },
          required: ["query"],
        },
      },
    });

    await expect(tool._run_async({ query: "CrewAI" })).resolves.toBe("{\"ok\":\"CrewAI\"}");
    expect(tool.name).toBe("github_search");
    expect(tool.description).toBe("Search issues");
    expect(tool.args_schema.query).toMatchObject({ type: "string", required: true });
    expect(connect).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(callTool).toHaveBeenCalledWith("Search Issues", { query: "CrewAI" });
  });

  it("classifies wrapper execution errors and supports retry helpers", async () => {
    class TestMCPToolWrapper extends MCPToolWrapper {
      attempts = 0;

      override async _do_mcp_call(args: Record<string, unknown> = {}): Promise<string> {
        this.attempts += 1;
        if (args.fail === "network" && this.attempts === 1) {
          throw new Error("network unavailable");
        }
        if (args.fail === "auth") {
          throw new Error("Unauthorized");
        }
        return `Echo ${String(args.query ?? "")}`;
      }
    }

    const wrapper = new TestMCPToolWrapper({
      mcpServerParams: { url: "https://mcp.example.com" },
      toolName: "search",
      serverName: "docs",
      toolSchema: { description: "Search docs" },
    });
    vi.spyOn(wrapper, "_retry_with_exponential_backoff").mockImplementation(async (operation, args) => {
      const [result, error] = await wrapper._execute_single_attempt(operation, args);
      return result ?? error;
    });

    await expect(wrapper._run_async({ query: "CrewAI" })).resolves.toBe("Echo CrewAI");
    await expect(wrapper._run_async({ fail: "auth" })).resolves.toBe("Authentication failed for MCP server: Unauthorized");
    await expect(wrapper._execute_single_attempt(async () => {
      throw new Error("tool not found");
    })).resolves.toEqual([null, "Tool 'search' not found on MCP server", false]);
  });
});
