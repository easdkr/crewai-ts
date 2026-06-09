import {
  registerA2AAgentWrapper,
  registerA2AServerMethodsInjector,
  registerLiteAgentA2AKickoffHandler,
} from "@crewai-ts/core/feature-hooks";
import { LiteAgentOutput } from "@crewai-ts/core";

import {
  _execute_task_with_a2a,
  create_extension_registry_from_config,
  get_a2a_agents_and_response_model,
  inject_a2a_server_methods,
  wrap_agent_with_a2a_instance,
} from "./a2a.js";

export * from "./a2a.js";
export * from "./a2ui.js";

registerA2AServerMethodsInjector(inject_a2a_server_methods);
registerA2AAgentWrapper(wrap_agent_with_a2a_instance);
registerLiteAgentA2AKickoffHandler(async ({ agent, originalKickoff, messages, responseFormat, inputFiles }) => {
  const agentRecord = agent as { a2a?: unknown; role?: unknown };
  const [a2aAgents, agentResponseModel] = get_a2a_agents_and_response_model(agentRecord.a2a as never);
  if (a2aAgents.length === 0) {
    return await originalKickoff(messages, responseFormat, inputFiles);
  }
  const description = liteAgentKickoffDescription(messages);
  if (!description) {
    return await originalKickoff(messages, responseFormat, inputFiles);
  }
  const result = await _execute_task_with_a2a({
    self: agent,
    a2a_agents: a2aAgents,
    original_fn: async () => {
      const output = await originalKickoff(messages, responseFormat, inputFiles) as { raw?: unknown };
      return output.raw;
    },
    task: {
      description,
      agent,
      expected_output: "Result from A2A delegation",
      input_files: inputFiles ?? {},
    },
    agent_response_model: agentResponseModel,
    context: null,
    tools: null,
    extension_registry: create_extension_registry_from_config([]),
  });
  return new LiteAgentOutput({
    raw: String(result),
    agent_role: typeof agentRecord.role === "string" ? agentRecord.role : "",
    usage_metrics: null,
    messages: [],
  });
});

function liteAgentKickoffDescription(messages: unknown): string {
  if (typeof messages === "string") {
    return messages;
  }
  if (!Array.isArray(messages)) {
    return "";
  }
  return messages
    .map((message) => {
      const content = typeof message === "object" && message !== null && "content" in message
        ? (message as { content?: unknown }).content
        : message;
      return typeof content === "string" ? content : "";
    })
    .filter((content) => content.length > 0)
    .join("\n");
}
