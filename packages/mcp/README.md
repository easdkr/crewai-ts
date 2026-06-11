# @crewai-ts/mcp

[![npm version](https://img.shields.io/npm/v/@crewai-ts/mcp.svg)](https://www.npmjs.com/package/@crewai-ts/mcp)

MCP (Model Context Protocol) integration for CrewAI TypeScript.

This package provides MCP client transports, tool wrappers, and server configuration helpers for connecting agents to MCP servers via stdio, HTTP, SSE, and streamable HTTP.

## Install

```sh
npm install @crewai-ts/mcp
```

Requirements:

- Node.js 22 or later
- `@crewai-ts/core` 0.2.0 or later

## Quick Start

```ts
import { Agent } from "@crewai-ts/core";
import { MCPClient, StdioTransport, MCPToolResolver } from "@crewai-ts/mcp";

// Connect to an MCP server via stdio
const transport = new StdioTransport({
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
});

const client = new MCPClient(transport);
await client.connect();

// List available tools
const tools = await client.listTools();

// Call a tool
const result = await client.callTool("read_file", { path: "/tmp/example.txt" });
```

## Using MCP Tools with Agents

```ts
import { Agent } from "@crewai-ts/core";
import { MCPServerStdio, MCPToolResolver } from "@crewai-ts/mcp";

const resolver = new MCPToolResolver();
const tools = await resolver.resolve([
  new MCPServerStdio({
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
  }),
]);

const agent = new Agent({
  role: "File Assistant",
  goal: "Read and write files",
  backstory: "A helpful file manager.",
  tools,
  llm: "openai/gpt-4o-mini",
});
```

## Transports

- `StdioTransport` — spawn a subprocess and communicate via stdio
- `HTTPTransport` — connect via HTTP/Streamable HTTP
- `SSETransport` — connect via Server-Sent Events

## Tool Filtering

Filter which tools are exposed to agents:

```ts
import { StaticToolFilter, createStaticToolFilter } from "@crewai-ts/mcp";

const filter = new StaticToolFilter({
  allowedToolNames: ["read_file", "write_file"],
});

const server = new MCPServerStdio({
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
  toolFilter: filter,
});
```

## Exports

- `MCPClient` — MCP client with connection, tool discovery, and execution
- `StdioTransport`, `HTTPTransport`, `SSETransport` — transport implementations
- `MCPServerStdio`, `MCPServerHTTP`, `MCPServerSSE` — server configuration classes
- `MCPToolResolver` — resolve MCP servers into CrewAI tools
- `StaticToolFilter`, `createStaticToolFilter`, `createDynamicToolFilter` — tool filtering
- `MCPNativeTool`, `MCPToolWrapper` — tool wrappers

## License

MIT
