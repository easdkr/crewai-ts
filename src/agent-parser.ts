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
    const actionInput = cleanActionInput(actionMatch[2] ?? "");
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

export function extractThought(text: string): string {
  let thoughtIndex = text.indexOf("\nAction");
  if (thoughtIndex === -1) {
    thoughtIndex = text.indexOf("\nFinal Answer");
  }
  if (thoughtIndex === -1) {
    return "";
  }
  return text.slice(0, thoughtIndex).trim().replaceAll("```", "").trim();
}

export function cleanAction(text: string): string {
  return text.trim().replace(/^\*+|\*+$/g, "").trim();
}

function cleanActionInput(text: string): string {
  return text.trim().replace(/^\*+\s+/, "").trim();
}

export function safeRepairJson(toolInput: string): string {
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
  const trimmed = extractLooseJsonObject(value.trim());
  if (trimmed === null) {
    return null;
  }
  const withoutRawNewlines = trimmed.replaceAll(/\r?\n/g, "");
  const withoutTrailingCommas = withoutRawNewlines.replace(/,\s*([}\]])/g, "$1");
  const quotedKeys = withoutTrailingCommas.replace(/([{,]\s*)([A-Za-z_][\w-]*)(\s*:)/g, "$1\"$2\"$3");
  const singleToDouble = quotedKeys.replace(/'([^']*)'/g, (_match, inner: string) => JSON.stringify(inner));
  const withMissingColons = singleToDouble.replace(/("([^"\\]|\\.)*")\s+("([^"\\]|\\.)*")(?=\s*[,}])/g, "$1: $3");
  const withMissingCommas = withMissingColons.replace(/("([^"\\]|\\.)*")\s+("([^"\\]|\\.)*"\s*:)/g, "$1, $3");
  const withQuotedBareValues = withMissingCommas.replace(
    /:\s*([^,}]*?)(\s*[,}])/g,
    (match: string, raw: string, suffix: string) => {
      const value = raw.trim();
      if (value === "" || value.startsWith("\"") || value.startsWith("{") || value.startsWith("[")) {
        return match;
      }
      if (/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value) || ["true", "false", "null"].includes(value)) {
        return `: ${value}${suffix}`;
      }
      return `: ${JSON.stringify(value)}${suffix}`;
    },
  );
  try {
    const parsed: unknown = JSON.parse(withQuotedBareValues);
    return JSON.stringify(parsed);
  } catch {
    return null;
  }
}

function extractLooseJsonObject(value: string): string | null {
  if (!value.startsWith("{")) {
    return null;
  }
  let depth = 0;
  let inString: "\"" | "'" | null = null;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (inString) {
      if (char === inString) {
        inString = null;
      }
      continue;
    }
    if (char === "\"" || char === "'") {
      inString = char;
      continue;
    }
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return value.slice(0, index + 1);
      }
    }
  }
  return depth > 0 ? `${value}}` : null;
}

export const parse_agent_output = parseAgentOutput;
export const _extract_thought = extractThought;
export const _clean_action = cleanAction;
export const _safe_repair_json = safeRepairJson;
