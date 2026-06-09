import { describe, expect, it, vi } from "vitest";

import { Agent, LiteAgent, LiteAgentOutput } from "@crewai-ts/core";
import { getLiteAgentA2AKickoffHandler } from "@crewai-ts/core/feature-hooks";
import {
  A2AClientConfig,
  A2AConfig,
  A2AError,
  A2AErrorCode,
  A2AServerConfig,
  A2ATransport,
  A2UIEvent,
  A2UIEventV09,
  A2UIMessage,
  A2UIMessageV09,
  A2UIValidationError,
  AVAILABLE_AGENTS_TEMPLATE,
  ActionV09,
  ClientTransportConfig,
  GRPCServerConfig,
  InvalidParamsError,
  JSONRPCServerConfig,
  ServerTransportConfig,
  StreamingConfig,
  _get_default_update_config,
  _migrate_client_transport_fields,
  createErrorResponse,
  inject_a2a_server_methods,
  isRetryableError,
  load_schema,
  negotiateTransport,
  renderA2ATemplate,
  validate_a2ui_message,
  validate_a2ui_message_v09,
  validate_catalog_components_v09,
} from "../src/index.js";

describe("@crewai-ts/a2a core integration", () => {
  it("validates A2UI catalog messages from the A2A package", () => {
    expect(load_schema("basic_catalog", { version: "v0.9" }).components).toHaveProperty("Text");
    expect(() => load_schema("missing")).toThrow("Unknown schema");

    expect(new A2UIMessage({
      beginRendering: { surfaceId: "surface", root: "root" },
    })._check_exactly_one()).toBeInstanceOf(A2UIMessage);
    expect(new A2UIEvent({
      userAction: {
        name: "submit",
        surfaceId: "surface",
        sourceComponentId: "button",
        timestamp: "2026-01-01T00:00:00.000Z",
        context: {},
      },
    })._check_exactly_one()).toBeInstanceOf(A2UIEvent);
    expect(() => new A2UIMessage()._check_exactly_one()).toThrow("Exactly one A2UI message type");

    expect(() => validate_a2ui_message({
      surfaceUpdate: {
        surfaceId: "surface",
        components: [{
          id: "custom",
          component: { CustomWidget: { missing: "schema" } },
        }],
      },
    }, { validate_catalog: true })).not.toThrow();

    expect(() => validate_a2ui_message({
      surfaceUpdate: {
        surfaceId: "surface",
        components: [{
          id: "title",
          component: { Text: { usageHint: "h1" } },
        }],
      },
    }, { validate_catalog: true })).toThrow(A2UIValidationError);
  });

  it("validates A2UI v0.9 messages from the A2A package", () => {
    expect(new A2UIMessageV09({
      createSurface: { surfaceId: "surface", root: "root" },
    })._check_exactly_one()).toBeInstanceOf(A2UIMessageV09);
    expect(new A2UIEventV09({
      action: {
        name: "submit",
        surfaceId: "surface",
        sourceComponentId: "button",
        timestamp: "2026-01-01T00:00:00.000Z",
        context: {},
      },
    })._check_exactly_one()).toBeInstanceOf(A2UIEventV09);
    expect(new ActionV09({
      functionCall: { call: "openUrl", args: { href: "https://example.com" } },
    })._check_exactly_one()).toBeInstanceOf(ActionV09);
    expect(() => new ActionV09({ event: { name: "submit" }, functionCall: { call: "openUrl" } })).toThrow("Exactly one event or functionCall");

    const unknownComponent = validate_a2ui_message_v09({
      version: "v0.9",
      updateComponents: {
        surfaceId: "surface",
        components: [{
          id: "custom",
          component: "CustomWidget",
        }],
      },
    });
    expect(() => validate_catalog_components_v09(unknownComponent)).not.toThrow();
  });

  it("injects A2A server agent-card methods through the package hook", () => {
    const agent = new Agent({
      role: "Server Agent",
      goal: "Serve A2A cards",
      backstory: "A2A-ready",
      a2a: new A2AServerConfig({ name: "Configured Server Agent" }),
    }) as Agent & { to_agent_card?: (url: string) => Record<string, unknown> };

    expect(typeof agent.to_agent_card).toBe("function");
    expect(agent.to_agent_card?.("https://agent.example.com/a2a")).toMatchObject({
      name: "Configured Server Agent",
      url: "https://agent.example.com/a2a",
    });

    const clientOnlyAgent = new Agent({
      role: "Client Agent",
      goal: "Delegate only",
      backstory: "Client-only",
      a2a: new A2AClientConfig({ endpoint: "https://remote.example.com/a2a" }),
    }) as Agent & { to_agent_card?: unknown };
    expect(clientOnlyAgent.to_agent_card).toBeUndefined();
  });

  it("builds A2A agent cards with server config values", () => {
    const agent = {
      role: "Researcher",
      goal: "Find evidence",
      backstory: "Careful analyst",
      tools: [{ name: "Search Web", description: "Search public sources" }],
      a2a: new A2AServerConfig({
        name: "Configured Agent",
        url: "https://configured.example.com/a2a",
        preferred_transport: A2ATransport.HTTP_JSON,
      }),
    };

    expect(inject_a2a_server_methods(agent)).toBe(agent);
    const card = (agent as unknown as { to_agent_card: (url: string) => Record<string, unknown> }).to_agent_card("https://agent.example.com/a2a");

    expect(card).toMatchObject({
      name: "Configured Agent",
      description: "Find evidence Careful analyst",
      url: "https://configured.example.com/a2a",
      preferred_transport: A2ATransport.HTTP_JSON,
      protocol_version: "0.3.0",
      skills: [{
        id: "search_web",
        name: "Search Web",
      }],
    });
  });

  it("models and negotiates A2A transport configuration", () => {
    const transport = new ClientTransportConfig({
      supported: [A2ATransport.GRPC, A2ATransport.JSONRPC],
    });
    const client = new A2AClientConfig({
      endpoint: "https://remote.example.com/a2a",
      max_turns: 3,
      fail_fast: false,
      transport_protocol: A2ATransport.GRPC,
      supported_transports: [A2ATransport.GRPC, A2ATransport.HTTP_JSON],
      transport,
    });
    const server = new A2AServerConfig({
      host: "localhost",
      port: 9000,
      transport: new ServerTransportConfig({
        preferred: A2ATransport.GRPC,
        grpc: new GRPCServerConfig({ port: 50052, reflection_enabled: true }),
        jsonrpc: new JSONRPCServerConfig({ rpc_path: "/rpc" }),
      }),
    });

    expect(client.max_turns).toBe(3);
    expect(client.failFast).toBe(false);
    expect(client.transport.preferred).toBe(A2ATransport.GRPC);
    expect(_get_default_update_config()).toBeInstanceOf(StreamingConfig);
    expect(_migrate_client_transport_fields(transport, A2ATransport.HTTP_JSON, [A2ATransport.HTTP_JSON]))
      .toMatchObject({ preferred: A2ATransport.HTTP_JSON, supported: [A2ATransport.HTTP_JSON] });
    expect(new A2AConfig({ endpoint: "https://remote.example.com/a2a" })._serialize_response_model({ name: "DeprecatedResponse" }))
      .toBe("DeprecatedResponse");
    expect(server.endpoint).toBe("http://localhost:9000");
    expect(server.transport.grpc?.reflection_enabled).toBe(true);
    expect(server.transport.jsonrpc.rpcPath).toBe("/rpc");

    const agentCard = {
      name: "remote",
      url: "https://remote.example.com/a2a",
      preferred_transport: A2ATransport.JSONRPC,
      additional_interfaces: [
        { transport: A2ATransport.GRPC, url: "https://remote.example.com/grpc" },
        { transport: A2ATransport.HTTP_JSON, url: "https://remote.example.com/http" },
      ],
    };
    expect(negotiateTransport(agentCard, {
      client_supported_transports: [A2ATransport.JSONRPC, A2ATransport.GRPC],
      client_preferred_transport: A2ATransport.GRPC,
    })).toMatchObject({
      transport: A2ATransport.GRPC,
      url: "https://remote.example.com/grpc",
      source: "client_preferred",
    });
  });

  it("creates A2A JSON-RPC errors and renders templates", () => {
    const error = new InvalidParamsError({ param: "message", reason: "required" });

    expect(error.code).toBe(A2AErrorCode.INVALID_PARAMS);
    expect(new A2AError({ code: A2AErrorCode.TASK_TIMEOUT }).message).toBe("Task execution timed out");
    expect(createErrorResponse(A2AErrorCode.METHOD_NOT_FOUND, null, null, "req-1")).toEqual({
      jsonrpc: "2.0",
      error: {
        code: A2AErrorCode.METHOD_NOT_FOUND,
        message: "Method not found",
      },
      id: "req-1",
    });
    expect(isRetryableError(A2AErrorCode.RATE_LIMIT_EXCEEDED)).toBe(true);
    expect(renderA2ATemplate(AVAILABLE_AGENTS_TEMPLATE, {
      available_a2a_agents: "researcher",
    })).toContain("researcher");
  });

  it("registers LiteAgent A2A kickoff handling through the package hook", async () => {
    const agent = new LiteAgent({
      role: "A2A Lite",
      goal: "Delegate when needed",
      backstory: "Compatibility focused",
      llm: () => "local",
    });
    const original = vi.fn(() => new LiteAgentOutput({
      raw: "local result",
      agent_role: agent.role,
    }));
    const handler = getLiteAgentA2AKickoffHandler();

    expect(handler).toBeTypeOf("function");
    await expect(handler?.({
      agent,
      originalKickoff: original,
      messages: "Research CrewAI",
    }))
      .resolves.toMatchObject({ raw: "local result", agentRole: "A2A Lite" });
    expect(agent.setup_a2a_support()).toBe(agent);
  });
});
