import { I18N_DEFAULT } from "./i18n.js";

export const FINAL_ANSWER_ACTION = "Final Answer:";
export const MISSING_ACTION_AFTER_THOUGHT_ERROR_MESSAGE = "I did it wrong. Invalid Format: I missed the 'Action:' after 'Thought:'. I will do right next, and don't use a tool I have already used.\n";
export const MISSING_ACTION_INPUT_AFTER_ACTION_ERROR_MESSAGE = "I did it wrong. Invalid Format: I missed the 'Action Input:' after 'Action:'. I will do right next, and don't use a tool I have already used.\n";
export const FINAL_ANSWER_AND_PARSABLE_ACTION_ERROR_MESSAGE = "I did it wrong. Tried to both perform Action and give a Final Answer at the same time, I must do one or the other";
export const UNABLE_TO_REPAIR_JSON_RESULTS = new Set(["\"\"", "{}"]);

const ACTION_INPUT_REGEX = /Action\s*\d*\s*:\s*(.*?)\s*Action\s*\d*\s*Input\s*\d*\s*:\s*(.*)/s;
const ACTION_REGEX = /Action\s*\d*\s*:\s*(.*?)/s;
const ACTION_INPUT_ONLY_REGEX = /\s*Action\s*\d*\s*Input\s*\d*\s*:\s*(.*)/s;

export class AgentAction {
  readonly thought: string;
  readonly tool: string;
  readonly toolInput: string;
  readonly tool_input: string;
  readonly text: string;
  readonly result: string | null;

  constructor(options: { thought: string; tool: string; toolInput?: string; tool_input?: string; text: string; result?: string | null }) {
    this.thought = options.thought;
    this.tool = options.tool;
    this.toolInput = options.toolInput ?? options.tool_input ?? "";
    this.tool_input = this.toolInput;
    this.text = options.text;
    this.result = options.result ?? null;
  }
}

export class AgentFinish {
  readonly thought: string;
  readonly output: unknown;
  readonly text: string;

  constructor(options: { thought: string; output: unknown; text: string }) {
    this.thought = options.thought;
    this.output = options.output;
    this.text = options.text;
  }
}

export class OutputParserError extends Error {
  readonly error: string;

  constructor(error: string) {
    super(error);
    this.name = "OutputParserError";
    this.error = error;
  }
}

export function parseAgentOutput(text: string): AgentAction | AgentFinish {
  const thought = extractThought(text);
  const includesAnswer = text.includes(FINAL_ANSWER_ACTION);
  const actionMatch = ACTION_INPUT_REGEX.exec(text);

  if (includesAnswer) {
    let finalAnswer = text.split(FINAL_ANSWER_ACTION).at(-1)?.trim() ?? "";
    if (finalAnswer.endsWith("```") && finalAnswer.split("```").length % 2 === 0) {
      finalAnswer = finalAnswer.slice(0, -3).trimEnd();
    }
    return new AgentFinish({ thought, output: finalAnswer, text });
  }

  if (actionMatch) {
    const action = actionMatch[1] ?? "";
    const actionInput = (actionMatch[2] ?? "").trim();
    const toolInput = actionInput.trim().replace(/^"|"$/g, "");
    return new AgentAction({
      thought,
      tool: cleanAction(action),
      toolInput: safeRepairJson(toolInput),
      text,
    });
  }

  if (!ACTION_REGEX.test(text)) {
    throw new OutputParserError(`${MISSING_ACTION_AFTER_THOUGHT_ERROR_MESSAGE}\n${I18N_DEFAULT.slice("final_answer_format")}`);
  }
  if (!ACTION_INPUT_ONLY_REGEX.test(text)) {
    throw new OutputParserError(MISSING_ACTION_INPUT_AFTER_ACTION_ERROR_MESSAGE);
  }
  throw new OutputParserError(I18N_DEFAULT.slice("format_without_tools"));
}

export const parse = parseAgentOutput;

function extractThought(text: string): string {
  let thoughtIndex = text.indexOf("\nAction");
  if (thoughtIndex === -1) {
    thoughtIndex = text.indexOf("\nFinal Answer");
  }
  if (thoughtIndex === -1) {
    return "";
  }
  return text.slice(0, thoughtIndex).trim().replaceAll("```", "").trim();
}

function cleanAction(text: string): string {
  return text.trim().replace(/^\*+|\*+$/g, "").trim();
}

function safeRepairJson(toolInput: string): string {
  if (toolInput.startsWith("[") && toolInput.endsWith("]")) {
    return toolInput;
  }
  const normalized = toolInput.replaceAll('"""', '"');
  try {
    const parsed: unknown = JSON.parse(normalized);
    const repaired = JSON.stringify(parsed);
    return UNABLE_TO_REPAIR_JSON_RESULTS.has(repaired) ? toolInput : repaired;
  } catch {
    return repairLooseJsonObject(normalized) ?? toolInput;
  }
}

function repairLooseJsonObject(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return null;
  }
  const quotedKeys = trimmed.replace(/([{,]\s*)([A-Za-z_][\w-]*)(\s*:)/g, "$1\"$2\"$3");
  const singleToDouble = quotedKeys.replace(/'([^']*)'/g, (_match, inner: string) => JSON.stringify(inner));
  try {
    const parsed: unknown = JSON.parse(singleToDouble);
    return JSON.stringify(parsed);
  } catch {
    return null;
  }
}

export const parse_agent_output = parseAgentOutput;
