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
  requestFeedback(request: HumanInputRequest): string | Promise<string> {
    if (!input.isTTY) {
      return "";
    }
    const rl = createInterface({ input, output });
    return rl.question(defaultHumanInputPrompt(request))
      .then((answer) => answer.trim())
      .finally(() => {
        rl.close();
      });
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
    const feedback = this.requestFeedback(createHumanInputRequest(formattedAnswer, context));
    if (isPromiseLike(feedback)) {
      return feedback.then((resolved) => handleHumanFeedbackLoopAsync(
        formattedAnswer,
        resolved,
        context,
        async (answer) => await this.requestFeedback(createHumanInputRequest(answer, context)),
      ));
    }
    return handleHumanFeedbackLoop(
      formattedAnswer,
      feedback,
      context,
      (answer) => this.requestFeedback(createHumanInputRequest(answer, context)) as unknown as string,
    );
  }

  handle_feedback(formatted_answer: unknown, context: ExecutorContext): unknown {
    return this.handleFeedback(formatted_answer, context);
  }

  async handleFeedbackAsync(formattedAnswer: unknown, context: AsyncExecutorContext): Promise<unknown> {
    const feedback = await this.requestFeedback(createHumanInputRequest(formattedAnswer, context));
    return await handleHumanFeedbackLoopAsync(
      formattedAnswer,
      feedback,
      context,
      async (answer) => await this.requestFeedback(createHumanInputRequest(answer, context)),
    );
  }

  async handle_feedback_async(formatted_answer: unknown, context: AsyncExecutorContext): Promise<unknown> {
    return await this.handleFeedbackAsync(formatted_answer, context);
  }

  static _get_output_string(answer: unknown): string {
    const record = asRecord(answer);
    const output = record?.output ?? record?.raw ?? answer;
    const outputRecord = asRecord(output);
    const modelDumpJson = outputRecord?.model_dump_json ?? outputRecord?.modelDumpJson;
    if (typeof modelDumpJson === "function") {
      return String((modelDumpJson as () => unknown).call(output));
    }
    return typeof output === "string" ? output : JSON.stringify(output);
  }

  static _handle_training_feedback(initialAnswer: unknown, feedback: string, context: ExecutorContext): unknown {
    handleTrainingOutput(context, initialAnswer, feedback);
    appendFeedback(context, feedback);
    const improvedAnswer = invokeLoop(context);
    handleTrainingOutput(context, improvedAnswer, null);
    setAskForHumanInput(context, false);
    return improvedAnswer;
  }

  _handle_training_feedback(initialAnswer: unknown, feedback: string, context: ExecutorContext): unknown {
    return SyncHumanInputProvider._handle_training_feedback(initialAnswer, feedback, context);
  }

  _handle_regular_feedback(currentAnswer: unknown, initialFeedback: string, context: ExecutorContext): unknown {
    return handleHumanFeedbackLoop(currentAnswer, initialFeedback, context, () => this._prompt_input(context.crew));
  }

  static async _handle_training_feedback_async(initialAnswer: unknown, feedback: string, context: AsyncExecutorContext): Promise<unknown> {
    handleTrainingOutput(context, initialAnswer, feedback);
    appendFeedback(context, feedback);
    const improvedAnswer = await ainvokeLoop(context);
    handleTrainingOutput(context, improvedAnswer, null);
    setAskForHumanInput(context, false);
    return improvedAnswer;
  }

  async _handle_training_feedback_async(initialAnswer: unknown, feedback: string, context: AsyncExecutorContext): Promise<unknown> {
    return await SyncHumanInputProvider._handle_training_feedback_async(initialAnswer, feedback, context);
  }

  async _handle_regular_feedback_async(currentAnswer: unknown, initialFeedback: string, context: AsyncExecutorContext): Promise<unknown> {
    return await handleHumanFeedbackLoopAsync(currentAnswer, initialFeedback, context, async () => await this._prompt_input_async(context.crew));
  }

  _prompt_input(crew: unknown = null): string {
    const feedback = this.requestFeedback(createPromptOnlyHumanInputRequest(crew));
    if (isPromiseLike(feedback)) {
      throw new Error("Synchronous human input prompt received an asynchronous feedback provider.");
    }
    return feedback;
  }

  async _prompt_input_async(crew: unknown = null): Promise<string> {
    return await this.requestFeedback(createPromptOnlyHumanInputRequest(crew));
  }
}

export async function _async_readline(): Promise<string> {
  if (!input.isTTY) {
    return "";
  }
  const rl = createInterface({ input, output });
  try {
    return (await rl.question("")).replace(/\n$/, "");
  } finally {
    rl.close();
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

function handleHumanFeedbackLoop(
  currentAnswer: unknown,
  initialFeedback: string,
  context: ExecutorContext,
  promptNext: (answer: unknown) => string,
): unknown {
  if (isTrainingMode(context)) {
    handleTrainingOutput(context, currentAnswer, initialFeedback);
    appendFeedback(context, initialFeedback);
    const improvedAnswer = invokeLoop(context);
    handleTrainingOutput(context, improvedAnswer, null);
    setAskForHumanInput(context, false);
    return improvedAnswer;
  }
  let answer = currentAnswer;
  let feedback = initialFeedback;
  while (getAskForHumanInput(context)) {
    if (feedback.trim() === "") {
      setAskForHumanInput(context, false);
      break;
    }
    appendFeedback(context, feedback);
    answer = invokeLoop(context);
    feedback = promptNext(answer);
  }
  return answer;
}

async function handleHumanFeedbackLoopAsync(
  currentAnswer: unknown,
  initialFeedback: string,
  context: AsyncExecutorContext,
  promptNext: (answer: unknown) => string | Promise<string>,
): Promise<unknown> {
  if (isTrainingMode(context)) {
    handleTrainingOutput(context, currentAnswer, initialFeedback);
    appendFeedback(context, initialFeedback);
    const improvedAnswer = await ainvokeLoop(context);
    handleTrainingOutput(context, improvedAnswer, null);
    setAskForHumanInput(context, false);
    return improvedAnswer;
  }
  let answer = currentAnswer;
  let feedback = initialFeedback;
  while (getAskForHumanInput(context)) {
    if (feedback.trim() === "") {
      setAskForHumanInput(context, false);
      break;
    }
    appendFeedback(context, feedback);
    answer = await ainvokeLoop(context);
    feedback = await promptNext(answer);
  }
  return answer;
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

function getAskForHumanInput(context: ExecutorContext): boolean {
  return Boolean(context.askForHumanInput ?? context.ask_for_human_input);
}

function createHumanInputRequest(answer: unknown, context: ExecutorContext): HumanInputRequest {
  const task = asRecord(context.task);
  return {
    taskName: getString(task, "name"),
    taskDescription: getString(task, "description") ?? "",
    expectedOutput: getString(task, "expectedOutput") ?? getString(task, "expected_output") ?? "",
    output: answerToTaskOutput(answer),
  };
}

function createPromptOnlyHumanInputRequest(crew: unknown): HumanInputRequest {
  const crewRecord = asRecord(crew);
  return {
    taskName: null,
    taskDescription: getString(crewRecord, "name") ?? "",
    expectedOutput: "",
    output: { raw: "" } as TaskOutput,
  };
}

function answerToTaskOutput(answer: unknown): TaskOutput {
  const record = asRecord(answer);
  const output = record?.output ?? record?.raw ?? answer;
  const raw = typeof output === "string" ? output : JSON.stringify(output);
  return { raw } as TaskOutput;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function getString(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

function isPromiseLike(value: unknown): value is Promise<string> {
  return Boolean(value && typeof value === "object" && "then" in value && typeof (value as { then?: unknown }).then === "function");
}
