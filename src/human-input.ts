import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import type { TaskOutput } from "./outputs.js";

export type HumanInputRequest = {
  taskName: string | null;
  taskDescription: string;
  expectedOutput: string;
  output: TaskOutput;
};

export type HumanInputProvider = {
  requestFeedback: (request: HumanInputRequest) => string | Promise<string>;
  setupMessages?: (context: ExecutorContext) => boolean;
  setup_messages?: (context: ExecutorContext) => boolean;
  postSetupMessages?: (context: ExecutorContext) => void;
  post_setup_messages?: (context: ExecutorContext) => void;
  handleFeedback?: (formattedAnswer: unknown, context: ExecutorContext) => unknown;
  handle_feedback?: (formatted_answer: unknown, context: ExecutorContext) => unknown;
  handleFeedbackAsync?: (formattedAnswer: unknown, context: AsyncExecutorContext) => Promise<unknown>;
  handle_feedback_async?: (formatted_answer: unknown, context: AsyncExecutorContext) => Promise<unknown>;
};

export type ExecutorContext = {
  task?: unknown;
  crew?: unknown;
  messages: unknown[];
  askForHumanInput?: boolean;
  ask_for_human_input?: boolean;
  llm?: unknown;
  agent?: unknown;
  _invokeLoop?: () => unknown;
  _invoke_loop?: () => unknown;
  _isTrainingMode?: () => boolean;
  _is_training_mode?: () => boolean;
  _handleCrewTrainingOutput?: (result: unknown, humanFeedback?: string | null) => void;
  _handle_crew_training_output?: (result: unknown, human_feedback?: string | null) => void;
  _formatFeedbackMessage?: (feedback: string) => unknown;
  _format_feedback_message?: (feedback: string) => unknown;
};

export type AsyncExecutorContext = ExecutorContext & {
  _ainvokeLoop?: () => Promise<unknown>;
  _ainvoke_loop?: () => Promise<unknown>;
};

export const HumanInputProvider = Object.freeze({ kind: "HumanInputProvider" });
export const ExecutorContext = Object.freeze({ kind: "ExecutorContext" });
export const AsyncExecutorContext = Object.freeze({ kind: "AsyncExecutorContext" });

export class SyncHumanInputProvider implements HumanInputProvider {
  async requestFeedback(request: HumanInputRequest): Promise<string> {
    if (!input.isTTY) {
      return "";
    }
    const rl = createInterface({ input, output });
    try {
      const answer = await rl.question(defaultHumanInputPrompt(request));
      return answer.trim();
    } finally {
      rl.close();
    }
  }

  setupMessages(_context: ExecutorContext): boolean {
    void _context;
    return false;
  }

  setup_messages(context: ExecutorContext): boolean {
    return this.setupMessages(context);
  }

  postSetupMessages(_context: ExecutorContext): void {
    void _context;
  }

  post_setup_messages(context: ExecutorContext): void {
    this.postSetupMessages(context);
  }

  handleFeedback(formattedAnswer: unknown, context: ExecutorContext): unknown {
    const feedback = "";
    return handleHumanFeedbackLoop(formattedAnswer, feedback, context, false);
  }

  handle_feedback(formatted_answer: unknown, context: ExecutorContext): unknown {
    return this.handleFeedback(formatted_answer, context);
  }

  async handleFeedbackAsync(formattedAnswer: unknown, context: AsyncExecutorContext): Promise<unknown> {
    const feedback = "";
    return await handleHumanFeedbackLoopAsync(formattedAnswer, feedback, context, false);
  }

  async handle_feedback_async(formatted_answer: unknown, context: AsyncExecutorContext): Promise<unknown> {
    return await this.handleFeedbackAsync(formatted_answer, context);
  }
}

let currentProvider: HumanInputProvider | null = null;

export function getHumanInputProvider(): HumanInputProvider {
  currentProvider ??= new SyncHumanInputProvider();
  return currentProvider;
}

export function setHumanInputProvider(provider: HumanInputProvider | null): HumanInputProvider | null {
  const previous = currentProvider;
  currentProvider = provider;
  return previous;
}

export function get_provider(): HumanInputProvider {
  return getHumanInputProvider();
}

export function set_provider(provider: HumanInputProvider): HumanInputProvider | null {
  return setHumanInputProvider(provider);
}

export function reset_provider(token: HumanInputProvider | null): void {
  currentProvider = token;
}

function defaultHumanInputPrompt(request: HumanInputRequest): string {
  return [
    "\nHuman feedback required.",
    `Task: ${request.taskDescription}`,
    `Current output: ${request.output.raw}`,
    "Press Enter to accept, or type feedback to retry: ",
  ].join("\n");
}

function handleHumanFeedbackLoop(answer: unknown, feedback: string, context: ExecutorContext, prompted: boolean): unknown {
  if (isTrainingMode(context)) {
    handleTrainingOutput(context, answer, feedback);
    appendFeedback(context, feedback);
    const improvedAnswer = invokeLoop(context);
    handleTrainingOutput(context, improvedAnswer, null);
    setAskForHumanInput(context, false);
    return improvedAnswer;
  }
  if (!prompted || feedback.trim() === "") {
    setAskForHumanInput(context, false);
    return answer;
  }
  appendFeedback(context, feedback);
  return invokeLoop(context);
}

async function handleHumanFeedbackLoopAsync(answer: unknown, feedback: string, context: AsyncExecutorContext, prompted: boolean): Promise<unknown> {
  if (isTrainingMode(context)) {
    handleTrainingOutput(context, answer, feedback);
    appendFeedback(context, feedback);
    const improvedAnswer = await ainvokeLoop(context);
    handleTrainingOutput(context, improvedAnswer, null);
    setAskForHumanInput(context, false);
    return improvedAnswer;
  }
  if (!prompted || feedback.trim() === "") {
    setAskForHumanInput(context, false);
    return answer;
  }
  appendFeedback(context, feedback);
  return await ainvokeLoop(context);
}

function appendFeedback(context: ExecutorContext, feedback: string): void {
  const formatter = context._formatFeedbackMessage ?? context._format_feedback_message;
  context.messages.push(formatter ? formatter(feedback) : { role: "user", content: feedback });
}

function invokeLoop(context: ExecutorContext): unknown {
  const invoke = context._invokeLoop ?? context._invoke_loop;
  if (!invoke) {
    throw new Error("Executor context does not provide _invoke_loop.");
  }
  return invoke();
}

async function ainvokeLoop(context: AsyncExecutorContext): Promise<unknown> {
  const invoke = context._ainvokeLoop ?? context._ainvoke_loop;
  if (!invoke) {
    return invokeLoop(context);
  }
  return await invoke();
}

function isTrainingMode(context: ExecutorContext): boolean {
  const checker = context._isTrainingMode ?? context._is_training_mode;
  return checker ? checker() : false;
}

function handleTrainingOutput(context: ExecutorContext, result: unknown, feedback: string | null): void {
  const handler = context._handleCrewTrainingOutput ?? context._handle_crew_training_output;
  handler?.(result, feedback);
}

function setAskForHumanInput(context: ExecutorContext, value: boolean): void {
  context.askForHumanInput = value;
  context.ask_for_human_input = value;
}
