import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { Agent, Crew, CrewOutput, FlowStreamingOutput, Task } from "@crewai-ts/core";
import { crewaiEventBus, type FlowFinishedEvent } from "@crewai-ts/core/events";
import {
  AgentMessage,
  ConversationConfig,
  ConversationEvent,
  ConversationMessage,
  ConversationState,
  message_to_llm_dict,
  RouterConfig,
} from "@crewai-ts/core/experimental/conversational";
import type { LLM } from "@crewai-ts/core/llm";
import type { LLMMessage } from "@crewai-ts/core/types";
import {
  FlowEngine as Flow,
  FlowConfigDefinition,
  FlowDefinition,
  FlowDefinitionDiagnostic,
  FlowHumanFeedbackDefinition,
  FlowMethodDefinition,
  FlowPersistenceDefinition,
  FlowStateDefinition,
  and_,
  append_message,
  buildFlowStructure,
  buildFlowDefinition,
  ChatState,
  ConversationalConfig,
  get_conversation_messages,
  get_conversational_config,
  getFlowMetadata,
  getFlowStructure,
  input_history_to_messages,
  listen,
  normalize_kickoff_inputs,
  or_,
  prepare_conversational_turn,
  receive_user_message,
  router,
  set_state_field,
  start,
  visualizeFlowStructure,
} from "../src/index.js";

type Decorator = (
  value: never,
  context: never,
) => unknown;

describe("@crewai-ts/flow execution package", () => {
  it("runs start and listener methods with shared state", async () => {
    class ResearchFlow extends Flow<{ topic?: string; events: string[] }> {
      constructor() {
        super({ initialState: { events: [] } });
      }

      begin(inputs: Record<string, unknown>) {
        this.state.topic = String(inputs.topic);
        this.state.events.push(`begin:${this.state.topic}`);
        return this.state.topic;
      }

      summarize(topic: string) {
        this.state.events.push(`summary:${topic}`);
        return `summary for ${topic}`;
      }
    }

    const initializers = [
      decorateMethod(ResearchFlow, "begin", start() as unknown as Decorator),
      decorateMethod(ResearchFlow, "summarize", listen("begin") as unknown as Decorator),
    ];
    const flow = new ResearchFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    const output = await flow.kickoff({ inputs: { topic: "CrewAI" } });

    expect(output).toBe("summary for CrewAI");
    expect(flow.state.events).toEqual(["begin:CrewAI", "summary:CrewAI"]);
    expect(getFlowMetadata(flow).map((entry) => entry.kind)).toEqual(["start", "listen"]);
  });

  it("accepts direct kickoff inputs", async () => {
    class DirectInputFlow extends Flow<{ topic?: string; events: string[] }> {
      constructor() {
        super({ initialState: { events: [] } });
      }

      begin(inputs: Record<string, unknown>) {
        this.state.topic = String(inputs.topic);
        this.state.events.push(`begin:${this.state.topic}`);
        return this.state.topic;
      }
    }

    const initializer = decorateMethod(DirectInputFlow, "begin", start() as unknown as Decorator);
    const flow = new DirectInputFlow();
    initializer.call(flow);

    await expect(flow.kickoff({ topic: "CrewAI" })).resolves.toBe("CrewAI");
    expect(flow.state).toMatchObject({
      topic: "CrewAI",
      events: ["begin:CrewAI"],
    });
  });

  it("provides conversational Flow turn helpers", () => {
    class ChatFlow extends Flow<{
      id: string;
      messages: Array<Record<string, unknown>>;
      last_user_message: string | null;
      last_intent: string | null;
    }> {
      static conversational_config = new ConversationalConfig({
        default_intents: ["answer", "handoff"],
        intent_llm: "fake-intent-llm",
      });

      classified: Array<{ text: string; outcomes: readonly string[]; llm: unknown; context: readonly unknown[] }> = [];

      constructor() {
        super({
          initialState: {
            id: "chat-1",
            messages: [],
            last_user_message: null,
            last_intent: "stale",
          },
        });
      }

      classify_intent(
        text: string,
        outcomes: readonly string[],
        options: { llm?: string | LLM | null; context?: readonly LLMMessage[] | null } = {},
      ) {
        this.classified.push({ text, outcomes, llm: options.llm, context: options.context ?? [] });
        return "handoff";
      }
    }

    expect(normalize_kickoff_inputs(null)).toBeNull();
    expect(normalize_kickoff_inputs({ topic: "CrewAI" }, {
      user_message: { content: "Need help" },
      session_id: "session-1",
    })).toEqual({
      topic: "CrewAI",
      id: "session-1",
      user_message: { content: "Need help" },
    });

    const chatState = new ChatState({ id: "state-1" });
    expect(chatState.id).toBe("state-1");
    expect(chatState.messages).toEqual([]);

    const flow = new ChatFlow();
    append_message(flow, "system", "You are concise.");
    const intent = receive_user_message(flow, "Please route this", {
      outcomes: ["answer", "handoff"],
      llm: "fake-intent-llm",
    });

    expect(intent).toBe("handoff");
    expect(flow.state.last_user_message).toBe("Please route this");
    expect(flow.state.last_intent).toBe("handoff");
    expect(flow.state.messages).toEqual([
      { role: "system", content: "You are concise." },
      { role: "user", content: "Please route this" },
    ]);
    expect(get_conversation_messages(flow)).toEqual(flow.state.messages);
    expect(flow.classified[0]).toMatchObject({
      text: "Please route this",
      outcomes: ["answer", "handoff"],
      llm: "fake-intent-llm",
      context: [
        { role: "system", content: "You are concise." },
        { role: "user", content: "Please route this" },
      ],
    });

    set_state_field(flow, "last_intent", "stale");
    prepare_conversational_turn(flow, {
      user_message: { content: "Next question" },
      config: get_conversational_config(flow),
    });

    expect(flow.state.last_user_message).toBe("Next question");
    expect(flow.state.last_intent).toBe("handoff");
    expect(flow.classified.at(-1)).toMatchObject({
      text: "Next question",
      outcomes: ["answer", "handoff"],
      llm: "fake-intent-llm",
    });

    const fallbackFlow = {} as unknown as Flow;
    append_message(fallbackFlow, "assistant", "Fallback answer", { name: "assistant-tool" });
    expect(get_conversation_messages(fallbackFlow)).toEqual([
      { role: "assistant", content: "Fallback answer", name: "assistant-tool" },
    ]);

    expect(input_history_to_messages([
      { message: "Question?", response: "Answer" },
      { message: "", response: "Follow-up" },
    ])).toEqual([
      { role: "assistant", content: "Question?" },
      { role: "user", content: "Answer" },
      { role: "user", content: "Follow-up" },
    ]);

    class PlainChatFlow extends Flow<{
      id: string;
      messages: Array<Record<string, unknown>>;
      last_intent: string | null;
    }> {
      constructor() {
        super({
          initialState: {
            id: "plain-chat",
            messages: [],
            last_intent: "ORDER",
          },
        });
      }
    }

    const plainFlow = new PlainChatFlow();
    prepare_conversational_turn(plainFlow, { user_message: "hello" });
    expect(plainFlow.state.last_intent).toBeNull();
    expect(get_conversation_messages(plainFlow)).toEqual([{ role: "user", content: "hello" }]);

    class ClassifierFlow extends Flow<{
      id: string;
      messages: Array<Record<string, unknown>>;
    }> {
      constructor() {
        super({
          initialState: {
            id: "classifier-chat",
            messages: [{ role: "user", content: "prior" }],
          },
        });
      }
    }

    const classifier = new ClassifierFlow();
    const collapseCalls: Array<{ feedback: string; outcomes: readonly string[] }> = [];
    classifier._collapse_to_outcome = (feedback, outcomes) => {
      collapseCalls.push({ feedback, outcomes });
      return "help";
    };
    expect(classifier.classify_intent("I need help", ["order", "help"], {
      llm: "gpt-4o-mini",
      context: classifier.conversation_messages,
    })).toBe("help");
    expect(collapseCalls[0]).toMatchObject({ outcomes: ["order", "help"] });
    expect(collapseCalls[0]?.feedback).toContain("I need help");
    expect(collapseCalls[0]?.feedback).toContain("prior");
  });

  it("records conversational agent results with visibility controls", () => {
    class AgentResultFlow extends Flow<ConversationState> {
      static conversational = true;
      static conversational_config = new ConversationConfig({ visible_agent_outputs: ["writer"] });

      constructor() {
        super({ initialState: new ConversationState() });
      }
    }

    const flow = new AgentResultFlow();
    flow.append_agent_result("planner", "private scratch");

    expect(flow.state.messages).toEqual([]);
    expect(flow.state.events[0]).toMatchObject({
      type: "agent_result",
      agent_name: "planner",
      visibility: "private",
      payload: { content: "private scratch" },
    });
    expect(flow.state.agent_threads.planner?.[0]).toMatchObject({
      role: "assistant",
      content: "private scratch",
    });

    flow.append_agent_result("writer", "visible draft");
    flow.append_agent_result("researcher", "public findings", { visibility: "public" });

    expect(flow.state.messages.map((message) => message_to_llm_dict(message))).toEqual([
      { role: "assistant", content: "visible draft", name: "writer" },
      { role: "assistant", content: "public findings", name: "researcher" },
    ]);
    expect(flow.state.events.map((event) => event.visibility)).toEqual(["private", "public", "public"]);
  });

  it("defaults conversational Flow state to ConversationState", () => {
    class BareChat extends Flow<ConversationState> {
      static conversational = true;
    }

    const flow = new BareChat();

    expect(flow.state).toBeInstanceOf(ConversationState);
    expect(flow.state.messages).toEqual([]);
    expect(flow.state.current_user_message).toBeNull();
    expect(flow.state.session_ready).toBe(false);

    const fresh = flow._create_initial_state();
    expect(fresh).toBeInstanceOf(ConversationState);
    expect(fresh.id).toEqual(expect.any(String));
    expect(fresh.messages).toEqual([]);
  });

  it("builds conversational route catalogs for router prompts", () => {
    class CatalogFlow extends Flow<ConversationState> {
      static conversational = true;
      static conversational_config = new ConversationConfig({
        router: new RouterConfig({
          prompt: "Classify the turn.",
          routes: ["RESEARCH", "ORDER", "BARE"],
          route_descriptions: { ORDER: "explicit override for order route" },
        }),
      });

      handleResearch() {
        return "researched";
      }

      handleOrder() {
        return "ordered";
      }

      handleBare() {
        return "bare";
      }
    }

    (CatalogFlow.prototype.handleResearch as unknown as { route_description: string }).route_description = "Fresh web research, current news, real-time lookups.";
    (CatalogFlow.prototype.handleOrder as unknown as { route_description: string }).route_description = "This handler metadata should not win.";

    const initializers = [
      decorateMethod(CatalogFlow, "handleResearch", listen("RESEARCH") as unknown as Decorator),
      decorateMethod(CatalogFlow, "handleOrder", listen("ORDER") as unknown as Decorator),
      decorateMethod(CatalogFlow, "handleBare", listen("BARE") as unknown as Decorator),
    ];
    const flow = new CatalogFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    const routerConfig = CatalogFlow.conversational_config.router as RouterConfig;
    const catalog = flow._build_route_catalog(routerConfig);

    expect(catalog.RESEARCH).toBe("Fresh web research, current news, real-time lookups.");
    expect(catalog.ORDER).toBe("explicit override for order route");
    expect(catalog.BARE).toBe("");
    expect(catalog.converse).toContain("Ordinary chat");
    expect(catalog.end).toContain("finished");

    const messages = flow._build_router_messages(routerConfig, { current_user_message: "research CrewAI" });
    expect(messages[0]?.content).toContain("Classify the turn.");
    expect(messages[0]?.content).toContain("- RESEARCH: Fresh web research, current news, real-time lookups.");
    expect(messages[0]?.content).toContain("- BARE");
    expect(messages[1]?.content).toContain("\"available_routes\"");
  });

  it("routes conversational turns through router LLM and persists last intent", async () => {
    const routerCalls: LLMMessage[][] = [];
    const routerResponses = [{ intent: "research" }, { intent: "converse" }];
    const routerLlm = {
      call(messages: LLMMessage[], options?: Record<string, unknown>) {
        expect(options?.response_format ?? options?.responseFormat).toBeDefined();
        routerCalls.push(messages);
        return routerResponses.shift();
      },
    };
    const chatCalls: LLMMessage[][] = [];
    const chatLlm = {
      call(messages: LLMMessage[]) {
        chatCalls.push(messages);
        return "follow-up reply";
      },
    };

    class RoutedFlow extends Flow<ConversationState> {
      static conversational = true;
      static conversational_config = new ConversationConfig({
        llm: chatLlm,
        router: new RouterConfig({
          llm: routerLlm,
          routes: ["research"],
        }),
      });

      begin() {
        return "ready";
      }

      route() {
        return this.route_turn(this.build_router_context());
      }

      runResearch() {
        this.append_agent_result("researcher", "researched", { visibility: "public" });
        return "researched";
      }

      converseTurnHandler() {
        return this.converse_turn();
      }
    }

    const initializers = [
      decorateMethod(RoutedFlow, "begin", start() as unknown as Decorator),
      decorateMethod(RoutedFlow, "route", router("begin") as unknown as Decorator),
      decorateMethod(RoutedFlow, "runResearch", listen("research") as unknown as Decorator),
      decorateMethod(RoutedFlow, "converseTurnHandler", listen("converse") as unknown as Decorator),
    ];
    const flow = new RoutedFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    await expect(flow.handle_turn("research CrewAI")).resolves.toBe("researched");
    expect(flow.state.last_intent).toBe("research");
    expect(message_to_llm_dict(flow.state.messages.at(-1))).toMatchObject({
      role: "assistant",
      content: "researched",
    });

    await expect(flow.handle_turn("tell me more about that")).resolves.toBe("follow-up reply");
    expect(flow.state.last_intent).toBe("converse");
    expect(chatCalls).toHaveLength(1);
    expect(routerCalls).toHaveLength(2);
    expect(String(routerCalls[1]?.[1]?.content)).toContain("\"last_intent\":\"research\"");
  });

  it("falls back to the configured conversational router intent for invalid LLM routes", async () => {
    const routerLlm = {
      call(_messages: LLMMessage[], options?: Record<string, unknown>) {
        expect(options?.response_format ?? options?.responseFormat).toBeDefined();
        return { intent: "unknown" };
      },
    };

    class FallbackRoutedFlow extends Flow<ConversationState> {
      static conversational = true;
      static conversational_config = new ConversationConfig({
        router: new RouterConfig({
          llm: routerLlm,
          routes: ["research", "clarify"],
          default_intent: "clarify",
          fallback_intent: "clarify",
        }),
      });

      begin() {
        return "ready";
      }

      route() {
        return this.route_turn(this.build_router_context());
      }

      research() {
        this.append_assistant_message("researched");
        return "researched";
      }

      askClarification() {
        this.append_assistant_message("clarify");
        return "clarify";
      }
    }

    const initializers = [
      decorateMethod(FallbackRoutedFlow, "begin", start() as unknown as Decorator),
      decorateMethod(FallbackRoutedFlow, "route", router("begin") as unknown as Decorator),
      decorateMethod(FallbackRoutedFlow, "research", listen("research") as unknown as Decorator),
      decorateMethod(FallbackRoutedFlow, "askClarification", listen("clarify") as unknown as Decorator),
    ];
    const flow = new FallbackRoutedFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    await expect(flow.handle_turn("something vague")).resolves.toBe("clarify");
    expect(flow.state.last_intent).toBe("clarify");
    expect(message_to_llm_dict(flow.state.messages.at(-1))).toMatchObject({
      role: "assistant",
      content: "clarify",
    });
  });

  it("rejects chat loops on non-conversational flows", async () => {
    class PlainFlow extends Flow {
      begin() {
        return "done";
      }
    }

    const initializer = decorateMethod(PlainFlow, "begin", start() as unknown as Decorator);
    const flow = new PlainFlow();
    initializer.call(flow);

    await expect(flow.chat({ input_fn: () => "quit" })).rejects.toThrow("conversational flows");
  });

  it("runs conversational builtin graph without manual decorator wiring", async () => {
    const routerLlm = {
      call() {
        return { intent: "work" };
      },
    };

    class BuiltinGraphFlow extends Flow<ConversationState> {
      static conversational = true;
      static conversational_config = new ConversationConfig({
        router: new RouterConfig({ llm: routerLlm, routes: ["work"] }),
      });

      doWork() {
        this.append_assistant_message("worked");
        return "worked";
      }
    }

    const initializer = decorateMethod(BuiltinGraphFlow, "doWork", listen("work") as unknown as Decorator);
    const flow = new BuiltinGraphFlow();
    initializer.call(flow);

    await expect(flow.handle_turn("please work")).resolves.toBe("worked");

    expect(flow.state.last_intent).toBe("work");
    expect(flow.state.messages.map((message) => message_to_llm_dict(message))).toEqual([
      { role: "user", content: "please work" },
      { role: "assistant", content: "worked" },
    ]);
  });

  it("runs conversational Flow turns through kickoff helpers", async () => {
    class SupportFlow extends Flow<{
      id: string;
      messages: Array<Record<string, unknown>>;
      current_user_message?: string | null;
      last_user_message?: string | null;
      last_intent?: string | null;
      turns: number;
    }> {
      static conversational = true;
      static conversational_config = new ConversationalConfig();

      constructor() {
        super({
          initialState: {
            id: "initial",
            messages: [],
            turns: 0,
            last_intent: "previous",
          },
        });
      }

      begin() {
        this.state.turns += 1;
        return "ready";
      }

      route() {
        return "converse";
      }

      respond() {
        return `reply:${String(this.state.last_user_message)}`;
      }
    }

    const initializers = [
      decorateMethod(SupportFlow, "begin", start() as unknown as Decorator),
      decorateMethod(SupportFlow, "route", router("begin") as unknown as Decorator),
      decorateMethod(SupportFlow, "respond", listen("converse") as unknown as Decorator),
    ];
    const flow = new SupportFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    await expect(flow.handle_turn("Hello", { session_id: "chat-1" })).resolves.toBe("reply:Hello");
    expect(flow.state.id).toBe("chat-1");
    expect(flow.state.last_user_message).toBe("Hello");
    expect(flow.state.messages).toEqual([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "reply:Hello" },
    ]);
    expect(flow.conversation_messages).toEqual(flow.state.messages);

    await expect(flow.kickoff({ user_message: { content: "Next" }, session_id: "chat-1" })).resolves.toBe("reply:Next");
    expect(flow.state.turns).toBe(2);
    expect(flow.state.messages).toEqual([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "reply:Hello" },
      { role: "user", content: "Next" },
    ]);
  });

  it("runs conversational chat loops over handle_turn and finalizes the session", async () => {
    class ChatLoopFlow extends Flow<{
      id: string;
      messages: Array<Record<string, unknown>>;
      current_user_message: string | null;
      last_user_message: string | null;
      last_intent: string | null;
      turns: number;
    }> {
      static conversational = true;
      static conversational_config = new ConversationConfig({ defer_trace_finalization: false });

      constructor() {
        super({
          initialState: {
            id: "initial",
            messages: [],
            current_user_message: null,
            last_user_message: null,
            last_intent: null,
            turns: 0,
          },
        });
      }

      begin() {
        return "ready";
      }

      route() {
        return "work";
      }

      doWork() {
        this.state.turns += 1;
        const reply = `worked: ${String(this.state.current_user_message)}`;
        this.append_assistant_message(reply);
        return reply;
      }
    }

    const initializers = [
      decorateMethod(ChatLoopFlow, "begin", start() as unknown as Decorator),
      decorateMethod(ChatLoopFlow, "route", router("begin") as unknown as Decorator),
      decorateMethod(ChatLoopFlow, "doWork", listen("work") as unknown as Decorator),
    ];
    const flow = new ChatLoopFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });
    const inputs = ["first", "", "second", "quit"];
    const prompts: string[] = [];
    const outputs: string[] = [];
    const finalizeSpy = vi.spyOn(flow, "finalizeSessionTraces").mockImplementation(() => undefined);

    await flow.chat({
      session_id: "session-1",
      input_fn(prompt) {
        prompts.push(prompt);
        return inputs.shift() ?? "quit";
      },
      output_fn: (message) => {
        outputs.push(message);
      },
    });

    expect(flow.state.turns).toBe(2);
    expect(flow.state.id).toBe("session-1");
    expect(prompts).toEqual(["\nYou: ", "\nYou: ", "\nYou: ", "\nYou: "]);
    expect(outputs).toEqual([
      "\nAssistant: worked: first",
      "\nAssistant: worked: second",
    ]);
    expect(finalizeSpy).toHaveBeenCalledOnce();
    expect((flow as unknown as { defer_trace_finalization?: unknown }).defer_trace_finalization).toBeUndefined();
    finalizeSpy.mockRestore();
  });

  it("stringifies conversational chat output like conversation helpers", async () => {
    class RawResult {
      raw = "raw assistant output";
    }

    class RawChatFlow extends Flow<ConversationState> {
      static conversational = true;

      constructor() {
        super({ initialState: new ConversationState() });
      }

      begin() {
        return "ready";
      }

      route() {
        return "work";
      }

      doWork() {
        return new RawResult();
      }
    }

    const initializers = [
      decorateMethod(RawChatFlow, "begin", start() as unknown as Decorator),
      decorateMethod(RawChatFlow, "route", router("begin") as unknown as Decorator),
      decorateMethod(RawChatFlow, "doWork", listen("work") as unknown as Decorator),
    ];
    const flow = new RawChatFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });
    const inputs = ["first", "quit"];
    const outputs: string[] = [];
    const finalizeSpy = vi.spyOn(flow, "finalizeSessionTraces").mockImplementation(() => undefined);

    await flow.chat({
      input_fn: () => inputs.shift() ?? "quit",
      output_fn: (message) => {
        outputs.push(message);
      },
    });

    expect(outputs).toEqual(["\nAssistant: raw assistant output"]);
    expect(finalizeSpy).toHaveBeenCalledOnce();
    finalizeSpy.mockRestore();
  });

  it("defers conversational Flow finish events until session finalization", async () => {
    class DeferredFlow extends Flow<ConversationState> {
      static conversational = true;
      static conversational_config = new ConversationConfig();

      begin() {
        return "ready";
      }

      route() {
        return "work";
      }

      doWork() {
        this.append_assistant_message("worked");
        return "worked";
      }
    }

    const initializers = [
      decorateMethod(DeferredFlow, "begin", start() as unknown as Decorator),
      decorateMethod(DeferredFlow, "route", router("begin") as unknown as Decorator),
      decorateMethod(DeferredFlow, "doWork", listen("work") as unknown as Decorator),
    ];
    const flow = new DeferredFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    const finishedEvents: FlowFinishedEvent[] = [];
    const off = crewaiEventBus.on("flow_finished", (_source, event) => {
      finishedEvents.push(event);
    });
    try {
      await flow.handle_turn("turn 1");
      await flow.handle_turn("turn 2");
      expect(finishedEvents).toEqual([]);

      flow.finalize_session_traces();

      expect(finishedEvents).toHaveLength(1);
      expect(finishedEvents[0]?.result).toBe("worked");
      expect(finishedEvents[0]?.flow_name).toBe("DeferredFlow");
    } finally {
      off();
    }
  });

  it("keeps conversational session finalization a no-op when not deferred", async () => {
    class PlainFlow extends Flow<ConversationState> {
      static conversational = true;
      static conversational_config = new ConversationConfig({ defer_trace_finalization: false });

      begin() {
        return "ready";
      }

      route() {
        return "work";
      }

      doWork() {
        this.append_assistant_message("worked");
        return "worked";
      }
    }

    const initializers = [
      decorateMethod(PlainFlow, "begin", start() as unknown as Decorator),
      decorateMethod(PlainFlow, "route", router("begin") as unknown as Decorator),
      decorateMethod(PlainFlow, "doWork", listen("work") as unknown as Decorator),
    ];
    const flow = new PlainFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    const finishedEvents: FlowFinishedEvent[] = [];
    const off = crewaiEventBus.on("flow_finished", (_source, event) => {
      finishedEvents.push(event);
    });
    try {
      await flow.handle_turn("turn 1");
      expect(finishedEvents).toHaveLength(1);

      flow.finalize_session_traces();

      expect(finishedEvents).toHaveLength(1);
      expect(finishedEvents[0]?.result).toBe("worked");
    } finally {
      off();
    }
  });

  it("resolves conversational trace deferral from ConversationConfig", () => {
    class DeferOn extends Flow<ConversationState> {
      static conversational = true;
      static conversational_config = new ConversationConfig({ defer_trace_finalization: true });
    }

    class DeferOff extends Flow<ConversationState> {
      static conversational = true;
      static conversational_config = new ConversationConfig({ defer_trace_finalization: false });
    }

    expect(new DeferOn()._should_defer_trace_finalization()).toBe(true);
    expect(new DeferOff()._should_defer_trace_finalization()).toBe(false);
  });

  it("marks conversational sessions ended through builtin end route", async () => {
    const routerLlm = {
      call() {
        return { intent: "end" };
      },
    };

    class EndFlow extends Flow<ConversationState> {
      static conversational = true;
      static conversational_config = new ConversationConfig({
        router: new RouterConfig({ llm: routerLlm }),
      });

      begin() {
        return "ready";
      }

      route() {
        return this.route_turn(this.build_router_context());
      }

      endTurn() {
        return this.end_conversation();
      }
    }

    const initializers = [
      decorateMethod(EndFlow, "begin", start() as unknown as Decorator),
      decorateMethod(EndFlow, "route", router("begin") as unknown as Decorator),
      decorateMethod(EndFlow, "endTurn", listen("end") as unknown as Decorator),
    ];
    const flow = new EndFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    await expect(flow.handle_turn("bye")).resolves.toBe("Conversation ended.");

    expect(flow.state.ended).toBe(true);
    expect(flow.state.messages.at(-1)).toMatchObject({
      role: "assistant",
      content: "Conversation ended.",
    });
  });

  it("answers conversational turns from history with configured LLM", async () => {
    const historyCalls: LLMMessage[][] = [];
    const historyLlm = {
      call(messages: LLMMessage[]) {
        historyCalls.push(messages);
        return "summary from history";
      },
    };

    class HistoryFlow extends Flow<ConversationState> {
      static conversational = true;
      static conversational_config = new ConversationConfig({
        answer_from_history_llm: historyLlm,
        answer_from_history_prompt: "Answer only from history.",
      });

      begin() {
        return "ready";
      }

      route() {
        return this.route_conversation();
      }

      answerFromHistory() {
        return this.answer_from_history_turn();
      }
    }

    const initializers = [
      decorateMethod(HistoryFlow, "begin", start() as unknown as Decorator),
      decorateMethod(HistoryFlow, "route", router("begin") as unknown as Decorator),
      decorateMethod(HistoryFlow, "answerFromHistory", listen("answer_from_history") as unknown as Decorator),
    ];
    const flow = new HistoryFlow();
    flow.state.messages = [
      new ConversationMessage({ role: "user", content: "research CrewAI" }),
      new ConversationMessage({ role: "assistant", content: "prior findings" }),
    ];
    flow._collapse_to_outcome = () => "answer_from_history";
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    await expect(flow.handle_turn("summarize this")).resolves.toBe("summary from history");

    expect(flow.state.last_intent).toBe("answer_from_history");
    expect(flow.state.messages.at(-1)).toMatchObject({
      role: "assistant",
      content: "summary from history",
    });
    expect(historyCalls).toHaveLength(1);
    expect(historyCalls[0]?.[0]).toEqual({
      role: "system",
      content: "Answer only from history.",
    });
    expect(historyCalls[0]?.some((message) => message.content === "prior findings")).toBe(true);
    expect(historyCalls[0]?.some((message) => message.content === "summarize this")).toBe(true);
  });

  it("builds conversational router response formats from effective routes", () => {
    const explicitFormat = { name: "ResearchRoute" };
    const explicitRouter = new RouterConfig({
      response_format: explicitFormat,
      routes: ["research"],
    });

    class DefaultRouterFlow extends Flow<ConversationState> {
      static conversational = true;
      static conversational_config = new ConversationConfig({
        router: new RouterConfig({ routes: ["research"] }),
      });

      research() {
        return "researched";
      }
    }

    const initializer = decorateMethod(DefaultRouterFlow, "research", listen("research") as unknown as Decorator);
    const flow = new DefaultRouterFlow();
    initializer.call(flow);

    expect(flow._router_response_format(explicitRouter)).toBe(explicitFormat);
    expect(flow._router_response_format(DefaultRouterFlow.conversational_config.router as RouterConfig)).toEqual({
      name: "ConversationRoute",
      intent_field: "intent",
      routes: ["research", "converse", "end"],
    });

    class InferredRouterFlow extends Flow<ConversationState> {
      static conversational = true;
      static conversational_config = new ConversationConfig({
        router: new RouterConfig(),
      });

      research() {
        return "researched";
      }
    }

    const inferredInitializer = decorateMethod(InferredRouterFlow, "research", listen("research") as unknown as Decorator);
    const inferredFlow = new InferredRouterFlow();
    inferredInitializer.call(inferredFlow);

    expect(inferredFlow._effective_routes(InferredRouterFlow.conversational_config.router as RouterConfig)).toEqual([
      "research",
      "converse",
      "end",
    ]);
  });

  it("auto-enables conversational router only for custom routes", async () => {
    const routerCalls: LLMMessage[][] = [];
    const routerLlm = {
      call(messages: LLMMessage[]) {
        routerCalls.push(messages);
        return { intent: "search" };
      },
    };

    class AutoRouterFlow extends Flow<ConversationState> {
      static conversational = true;
      static conversational_config = new ConversationConfig({ llm: routerLlm });

      handleSearch() {
        this.append_assistant_message("searched");
        return "searched";
      }
    }

    const initializer = decorateMethod(AutoRouterFlow, "handleSearch", listen("search") as unknown as Decorator);
    const flow = new AutoRouterFlow();
    initializer.call(flow);

    await expect(flow.handle_turn("research today")).resolves.toBe("searched");

    expect(routerCalls).toHaveLength(1);
    expect(flow.state.last_intent).toBe("search");
  });

  it("runs user start methods before conversational builtin router", async () => {
    const order: string[] = [];

    class BootstrapFlow extends Flow<ConversationState> {
      static conversational = true;
      static conversational_config = new ConversationConfig({
        router: { defaultIntent: "work", fallbackIntent: "work", routes: ["work"] },
      });

      loadProfile() {
        if (!this.state.session_ready) {
          order.push("load_profile");
          this.state.session_ready = true;
        }
      }

      attachBus() {
        order.push("attach_bus");
      }

      routeTurn(context: Record<string, unknown>) {
        order.push("route_turn");
        return super.routeTurn(context);
      }

      doWork() {
        order.push("do_work");
        this.append_assistant_message("worked");
        return "worked";
      }
    }

    const initializers = [
      decorateMethod(BootstrapFlow, "loadProfile", start() as unknown as Decorator),
      decorateMethod(BootstrapFlow, "attachBus", start() as unknown as Decorator),
      decorateMethod(BootstrapFlow, "doWork", listen("work") as unknown as Decorator),
    ];
    const flow = new BootstrapFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    await expect(flow.handle_turn("turn 1")).resolves.toBe("worked");

    expect(order.indexOf("load_profile")).toBeLessThan(order.indexOf("route_turn"));
    expect(order.indexOf("attach_bus")).toBeLessThan(order.indexOf("route_turn"));
    expect(order).toEqual(["load_profile", "attach_bus", "route_turn", "do_work"]);

    order.length = 0;
    await expect(flow.handle_turn("turn 2")).resolves.toBe("worked");

    expect(order).toEqual(["attach_bus", "route_turn", "do_work"]);
  });

  it("keeps overridden conversational start methods registered without redecorating", async () => {
    const bootstrapCalls: string[] = [];

    class OverrideStartFlow extends Flow<ConversationState> {
      static conversational = true;
      static conversational_config = new ConversationConfig({
        router: { defaultIntent: "work", fallbackIntent: "work", routes: ["work"] },
      });

      override conversation_start() {
        bootstrapCalls.push("ran");
        return super.conversation_start();
      }

      doWork() {
        this.append_assistant_message("worked");
        return "worked";
      }
    }

    const initializer = decorateMethod(OverrideStartFlow, "doWork", listen("work") as unknown as Decorator);
    const flow = new OverrideStartFlow();
    initializer.call(flow);

    expect(OverrideStartFlow.flow_definition().methods.conversation_start?.start).toBe(true);

    await expect(flow.handle_turn("hi")).resolves.toBe("worked");

    expect(bootstrapCalls).toEqual(["ran"]);
    expect(flow.state.messages.at(-1)).toMatchObject({
      role: "assistant",
      content: "worked",
    });
  });

  it("reruns conversational graphs after a prior turn has completed", async () => {
    const routerLlm = {
      calls: 0,
      call() {
        this.calls += 1;
        return { intent: "research" };
      },
    };

    class MultiTurnFlow extends Flow<ConversationState> {
      static conversational = true;
      static conversational_config = new ConversationConfig({
        router: new RouterConfig({ llm: routerLlm, routes: ["research"] }),
      });

      runResearch() {
        const reply = `researched:${String(this.state.current_user_message)}`;
        this.append_assistant_message(reply);
        return reply;
      }
    }

    const initializer = decorateMethod(MultiTurnFlow, "runResearch", listen("research") as unknown as Decorator);
    const flow = new MultiTurnFlow();
    initializer.call(flow);

    await expect(flow.handle_turn("first")).resolves.toBe("researched:first");
    await expect(flow.handle_turn("second")).resolves.toBe("researched:second");

    expect(routerLlm.calls).toBe(2);
    expect(flow.state.messages.map((message) => message.content)).toEqual([
      "first",
      "researched:first",
      "second",
      "researched:second",
    ]);
  });

  it("skips conversational router auto-enable for default intents", async () => {
    const routerLlm = {
      call() {
        throw new Error("router should not be auto-enabled");
      },
    };

    class LegacyIntentFlow extends Flow<ConversationState> {
      static conversational = true;
      static conversational_config = new ConversationConfig({
        llm: routerLlm,
        default_intents: ["search"],
        intent_llm: "fake-intent-llm",
      });

      classify_intent() {
        return "search";
      }

      handleSearch() {
        this.append_assistant_message("legacy-searched");
        return "legacy-searched";
      }
    }

    const initializer = decorateMethod(LegacyIntentFlow, "handleSearch", listen("search") as unknown as Decorator);
    const flow = new LegacyIntentFlow();
    initializer.call(flow);

    await expect(flow.handle_turn("look it up")).resolves.toBe("legacy-searched");

    expect(flow.state.last_intent).toBe("search");
  });

  it("provides conversational data shapes", () => {
    const routerConfig = new RouterConfig({
      routes: ["converse", "handoff"],
      route_descriptions: { handoff: "Send to specialist" },
    });
    expect(routerConfig.default_intent).toBe("converse");
    expect(routerConfig.fallback_intent).toBe("converse");
    expect(routerConfig.intent_field).toBe("intent");
    expect(routerConfig.route_descriptions).toEqual({ handoff: "Send to specialist" });

    const config = new ConversationConfig({
      router: routerConfig,
      visible_agent_outputs: "all",
      defer_trace_finalization: false,
    });
    class ConversationalFlow {
      readonly marker = "flow";
    }
    expect(config.__call__(ConversationalFlow)).toBe(ConversationalFlow);
    expect((ConversationalFlow as unknown as { conversational_config: ConversationConfig }).conversational_config).toBe(config);
    expect(config.visible_agent_outputs).toBe("all");
    expect(config.defer_trace_finalization).toBe(false);

    const message = new ConversationMessage({
      role: "assistant",
      content: "Visible answer",
      name: "writer",
      metadata: { private: true },
      files: { image: "local.png" },
    });
    expect(message.model_dump({ exclude_none: true })).toEqual({
      role: "assistant",
      content: "Visible answer",
      name: "writer",
      files: { image: "local.png" },
      metadata: { private: true },
    });
    expect(message_to_llm_dict(message)).toEqual({
      role: "assistant",
      content: "Visible answer",
      name: "writer",
      files: { image: "local.png" },
    });
    expect(message_to_llm_dict({ role: "tool", content: "ok", metadata: { hidden: true }, tool_call_id: "call-1" })).toEqual({
      role: "tool",
      content: "ok",
      tool_call_id: "call-1",
    });
    expect(message_to_llm_dict("hello")).toEqual({ role: "user", content: "hello" });

    const event = new ConversationEvent({ type: "agent.progress", payload: { step: 1 }, agent_name: "writer" });
    expect(event.visibility).toBe("private");
    const agentMessage = new AgentMessage({ content: { scratch: "notes" } });
    expect(agentMessage.role).toBe("assistant");
    expect(agentMessage.metadata).toEqual({});

    const state = new ConversationState({
      messages: [message],
      events: [event],
      agent_threads: { writer: [agentMessage] },
      current_user_message: "Hi",
      session_ready: true,
    });
    expect(state.id).toEqual(expect.any(String));
    expect(state.messages).toHaveLength(1);
    expect(state.ended).toBe(false);
    expect(state.session_ready).toBe(true);
    expect(state.agent_threads.writer?.[0]?.content).toEqual({ scratch: "notes" });
  });

  it("builds FlowDefinition structures from decorated Flow metadata", () => {
    class DefinitionFlow extends Flow<{ topic?: string }> {
      begin() {
        return "draft";
      }

      branch() {
        return "approved";
      }

      review() {
        return "reviewed";
      }
    }

    const flow = new DefinitionFlow();
    [
      decorateMethod(DefinitionFlow, "begin", start() as unknown as Decorator),
      decorateMethod(DefinitionFlow, "branch", router("begin", { emit: ["approved"] }) as unknown as Decorator),
      decorateMethod(DefinitionFlow, "review", listen(and_("branch", or_("approved", "manual"))) as unknown as Decorator),
    ].forEach((initializer) => {
      initializer.call(flow);
    });

    const definition = buildFlowDefinition(flow);

    expect(definition).toBeInstanceOf(FlowDefinition);
    expect(definition.to_dict()).toMatchObject({
      name: "DefinitionFlow",
      methods: {
        begin: { start: true },
        branch: { router: true, listen: "begin", emit: ["approved"] },
        review: {
          listen: {
            and: [
              "branch",
              { or: ["approved", "manual"] },
            ],
          },
        },
      },
    });
  });

  it("serializes and validates FlowDefinition documents in the Flow package", () => {
    const definition = FlowDefinition.from_dict({
      schema: "crewai.flow/v1",
      name: "ReviewFlow",
      description: "Routes a draft through review",
      state: { type: "dict", default: { id: "flow-1" } },
      config: { stream: true, max_method_calls: 12 },
      persist: { enabled: true, verbose: true, persistence: { type: "sqlite" } },
      methods: {
        begin: { start: true },
        route: { router: true, listen: "begin", emit: ["approved", "changes"] },
        publish: {
          listen: "route",
          human_feedback: {
            message: "Review output",
            emit: ["approved", "changes"],
            llm: null,
            default_outcome: "missing",
          },
        },
      },
      diagnostics: [{ code: "preexisting", message: "kept", path: "methods.begin" }],
    });

    expect(definition.schema_).toBe("crewai.flow/v1");
    expect(definition.methods.route?.router).toBe(true);
    expect(definition.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "preexisting",
      "human_feedback_llm_required",
      "human_feedback_default_not_in_emit",
    ]);
    expect(FlowDefinition.from_json(definition.to_json({ indent: null })).name).toBe("ReviewFlow");
    expect(FlowDefinition.from_yaml(definition.to_yaml()).to_dict()).toEqual(definition.to_dict());
    expect(FlowDefinition.json_schema()).toMatchObject({ title: "FlowDefinition", type: "object" });
    expect(new FlowMethodDefinition({ start: false }).is_start).toBe(false);
    expect(new FlowDefinitionDiagnostic({ code: "warn", message: "careful" }).severity).toBe("warning");
    expect(new FlowStateDefinition().type).toBe("dict");
    expect(new FlowConfigDefinition().max_method_calls).toBe(100);
    expect(new FlowPersistenceDefinition().enabled).toBe(false);
    expect(new FlowHumanFeedbackDefinition({ message: "Review" }).llm).toBe("gpt-4o-mini");
  });

  it("builds Flow structure and visualization from decorated methods", () => {
    class StructureFlow extends Flow {
      begin() {
        return "approved";
      }

      decide() {
        return "approved";
      }

      approved() {
        return "done";
      }

      rejected() {
        return "stop";
      }
    }

    const flow = new StructureFlow();
    [
      decorateMethod(StructureFlow, "begin", start() as unknown as Decorator),
      decorateMethod(StructureFlow, "decide", router("begin") as unknown as Decorator),
      decorateMethod(StructureFlow, "approved", listen(and_("approved", "begin")) as unknown as Decorator),
      decorateMethod(StructureFlow, "rejected", listen(or_("rejected")) as unknown as Decorator),
    ].forEach((initializer) => {
      initializer.call(flow);
    });

    const structure = getFlowStructure(flow);

    expect(structure.name).toBe("StructureFlow");
    expect(structure.startMethods).toEqual(["begin"]);
    expect(structure.routerMethods).toEqual(["decide"]);
    expect(structure.methods.find((method) => method.name === "approved")).toMatchObject({
      type: "listen",
    });
    const visualizationStructure = buildFlowStructure(flow);
    expect(Object.keys(visualizationStructure.nodes)).toEqual([
      "begin",
      "decide",
      "approved",
      "rejected",
    ]);
    const renderedPath = visualizeFlowStructure(visualizationStructure, "structure-flow.html", false);
    expect(renderedPath).toContain("structure-flow.html");
    expect(readFileSync(renderedPath, "utf8")).toContain("StructureFlow");
  });

  it("returns FlowStreamingOutput when a Flow is configured for streaming", async () => {
    class StreamingFlow extends Flow {
      constructor() {
        super({ stream: true });
      }

      begin() {
        return "flow final";
      }
    }

    const flow = new StreamingFlow();
    decorateMethod(StreamingFlow, "begin", start() as unknown as Decorator).call(flow);

    const streaming = await flow.kickoff() as FlowStreamingOutput;

    expect(streaming).toBeInstanceOf(FlowStreamingOutput);
    expect(() => streaming.result).toThrow("Streaming has not completed");

    const chunks = [];
    for await (const chunk of streaming) {
      chunks.push(chunk);
    }

    expect(chunks.map((chunk) => chunk.content)).toEqual(["flow final"]);
    expect(streaming.result).toBe("flow final");
    expect(streaming.isCompleted).toBe(true);
  });

  it("streams CrewOutput chunks from crew-backed Flow steps", async () => {
    class CrewBackedFlow extends Flow {
      constructor() {
        super({ stream: true });
      }

      researchPhase() {
        const researcher = new Agent({
          role: "Research Analyst",
          goal: "Gather comprehensive information",
          backstory: "Expert at finding relevant information",
          llm: () => "research findings",
        });
        const task = new Task({
          description: "Research AI developments in healthcare",
          expectedOutput: "Research findings on AI in healthcare",
          agent: researcher,
        });
        return new Crew({ agents: [researcher], tasks: [task] }).kickoff();
      }
    }

    const flow = new CrewBackedFlow();
    decorateMethod(CrewBackedFlow, "researchPhase", start() as unknown as Decorator).call(flow);

    const streaming = await flow.kickoff() as FlowStreamingOutput;
    const chunks = [];
    for await (const chunk of streaming) {
      chunks.push(chunk);
    }

    expect(chunks.map((chunk) => chunk.content)).toEqual(["research findings"]);
    expect(chunks[0]?.taskName).toBe("Research AI developments in healthcare");
    expect(chunks[0]?.agentRole).toBe("Research Analyst");
    expect(streaming.get_full_text()).toBe("research findings");
    expect((streaming.result as CrewOutput).raw).toBe("research findings");
  });
});

function decorateMethod<T extends object>(
  constructor: new () => T,
  name: keyof T & string,
  decorator: Decorator,
): (this: T) => void {
  const initializers: Array<(this: T) => void> = [];
  type TestMethod = (this: T, ...args: unknown[]) => unknown;
  const prototype = constructor.prototype as Record<string, unknown>;
  const original = prototype[name] as TestMethod;
  const applyDecorator = decorator as unknown as (
    value: TestMethod,
    context: ClassMethodDecoratorContext<T, TestMethod>,
  ) => TestMethod | undefined;
  const replacement = applyDecorator(original, {
    kind: "method",
    name,
    static: false,
    private: false,
    access: {
      has: (object: T) => name in object,
      get: (object: T) => (object as Record<string, unknown>)[name] as TestMethod,
    },
    addInitializer: (init: (this: T) => void) => {
      initializers.push(init);
    },
    metadata: undefined,
  });

  if (replacement !== undefined) {
    Object.defineProperty(constructor.prototype, name, {
      configurable: true,
      writable: true,
      value: replacement,
    });
  }

  const initializer = initializers[0];
  if (!initializer) {
    throw new Error(`Decorator '${name}' did not register an initializer.`);
  }
  return initializer;
}
