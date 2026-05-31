import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { join, resolve } from "node:path";

import type { Crew } from "./crew.js";
import { callLLM, createLLM, createLLMClient, type LLM, type LLMClient } from "./llm.js";
import type { LLMMessage } from "./types.js";
import { readToml } from "./utilities.js";

export const MIN_REQUIRED_CONVERSATIONAL_CREW_VERSION = "0.98.0";
export const MIN_REQUIRED_VERSION = MIN_REQUIRED_CONVERSATIONAL_CREW_VERSION;
export const DEFAULT_INPUT_DESCRIPTION = "Input value for the crew's tasks and agents.";
export const DEFAULT_CREW_DESCRIPTION = "A CrewAI crew.";

export type ChatInputFieldOptions = {
  name: string;
  description: string;
};

export class ChatInputField {
  readonly name: string;
  readonly description: string;

  constructor(options: ChatInputFieldOptions) {
    this.name = options.name;
    this.description = options.description;
  }
}

export type ChatInputsOptions = {
  crewName?: string;
  crew_name?: string;
  crewDescription?: string;
  crew_description?: string;
  inputs?: readonly (ChatInputField | ChatInputFieldOptions)[];
};

export class ChatInputs {
  readonly crewName: string;
  readonly crew_name: string;
  readonly crewDescription: string;
  readonly crew_description: string;
  readonly inputs: readonly ChatInputField[];

  constructor(options: ChatInputsOptions) {
    const crewName = options.crewName ?? options.crew_name;
    const crewDescription = options.crewDescription ?? options.crew_description;
    if (!crewName) {
      throw new Error("ChatInputs requires crewName.");
    }
    if (!crewDescription) {
      throw new Error("ChatInputs requires crewDescription.");
    }
    this.crewName = crewName;
    this.crew_name = crewName;
    this.crewDescription = crewDescription;
    this.crew_description = crewDescription;
    this.inputs = (options.inputs ?? []).map((input) => (
      input instanceof ChatInputField ? input : new ChatInputField(input)
    ));
  }
}

export type CrewChatToolSchema = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: "string"; description: string }>;
      required: string[];
    };
  };
};

export type GenerateCrewChatInputsOptions = {
  generateDescriptions?: boolean;
  generate_descriptions?: boolean;
};

export type CrewChatLoader = () => [Crew, string];
export type ChatLoopOptions = {
  getUserInput?: () => string | Promise<string>;
  onAssistantMessage?: (message: string) => void;
  onError?: (error: unknown) => void;
  maxTurns?: number;
};

let crewChatLoader: CrewChatLoader | null = null;

export function checkConversationalCrewsVersion(crewaiVersion: string, _pyprojectData: Record<string, unknown> = {}): boolean {
  void _pyprojectData;
  if (!isValidVersion(crewaiVersion)) {
    return false;
  }
  return compareVersions(crewaiVersion, MIN_REQUIRED_CONVERSATIONAL_CREW_VERSION) >= 0;
}

export const check_conversational_crews_version = checkConversationalCrewsVersion;

export function buildSystemMessage(crewChatInputs: ChatInputs): string {
  const requiredFields = crewChatInputs.inputs
    .map((field) => `${field.name} (desc: ${field.description || "n/a"})`)
    .join(", ") || "(No required fields detected)";

  return [
    "You are a helpful AI assistant for the CrewAI platform.",
    "Your primary purpose is to assist users with the crew's specific tasks.",
    "You can answer general questions, but should guide users back to the crew's purpose afterward.",
    "You have a function (tool) you can call by name if you have all required inputs.",
    `Those required inputs are: ${requiredFields}.`,
    "Once you have them, call the function.",
    "Please keep your responses concise and friendly.",
    "If a user asks a question outside the crew's scope, provide a brief answer and remind them of the crew's purpose.",
    "After calling the tool, be prepared to take user feedback and make adjustments as needed.",
    "If you are ever unsure about a user's request or need clarification, ask the user for more information.",
    "Before doing anything else, introduce yourself with a friendly message and ask for the required inputs.",
    `\nCrew Name: ${crewChatInputs.crewName}`,
    `Crew Description: ${crewChatInputs.crewDescription}`,
  ].join(" ");
}

export const build_system_message = buildSystemMessage;

export function generateCrewToolSchema(crewInputs: ChatInputs): CrewChatToolSchema {
  const properties: Record<string, { type: "string"; description: string }> = {};
  for (const field of crewInputs.inputs) {
    properties[field.name] = {
      type: "string",
      description: field.description || "No description provided",
    };
  }
  return {
    type: "function",
    function: {
      name: crewInputs.crewName,
      description: crewInputs.crewDescription || "No crew description",
      parameters: {
        type: "object",
        properties,
        required: crewInputs.inputs.map((field) => field.name),
      },
    },
  };
}

export const generate_crew_tool_schema = generateCrewToolSchema;

export async function runCrewTool(
  crew: Crew,
  messages: readonly LLMMessage[],
  kwargs: Record<string, unknown> = {},
): Promise<string> {
  const crewOutput = await crew.kickoff({
    inputs: {
      ...kwargs,
      crew_chat_messages: JSON.stringify(messages),
    },
  });
  return String(crewOutput);
}

export const run_crew_tool = runCrewTool;

export function createToolFunction(
  crew: Crew,
  messages: readonly LLMMessage[],
): (kwargs?: Record<string, unknown>) => Promise<string> {
  return async (kwargs: Record<string, unknown> = {}) => await runCrewTool(crew, messages, kwargs);
}

export const create_tool_function = createToolFunction;

export function flushInput(): void {
  // Node readline does not expose a portable stdin buffer flush.
}

export const flush_input = flushInput;

export async function getUserInput(): Promise<string> {
  if (!input.isTTY) {
    return "exit";
  }
  const rl = createInterface({ input, output });
  const lines: string[] = [];
  try {
    for (;;) {
      const line = await rl.question(lines.length === 0
        ? "\nYou (type your message below. Press Enter twice when you're done):\n"
        : "");
      if (line.trim().toLowerCase() === "exit") {
        return "exit";
      }
      if (line === "") {
        break;
      }
      lines.push(line);
    }
  } finally {
    rl.close();
  }
  return lines.join("\n");
}

export const get_user_input = getUserInput;

export async function handleUserInput(
  userInput: string,
  chatLlm: LLM | LLMClient,
  messages: LLMMessage[],
  crewToolSchema: CrewChatToolSchema | Record<string, unknown>,
  availableFunctions: Record<string, unknown>,
): Promise<void> {
  const trimmed = userInput.trim();
  if (!trimmed || trimmed.toLowerCase() === "exit") {
    return;
  }
  messages.push({ role: "user", content: userInput });
  const response = await callLLM(createLLMClient(chatLlm), messages, {
    tools: [crewToolSchema] as never,
    availableFunctions,
  });
  messages.push({ role: "assistant", content: stringifyLlmResponse(response) });
}

export const handle_user_input = handleUserInput;

export function chatLoop(
  chatLlm: LLM | LLMClient,
  messages: LLMMessage[],
  crewToolSchema: CrewChatToolSchema | Record<string, unknown>,
  availableFunctions: Record<string, unknown>,
  options: ChatLoopOptions = {},
): Promise<void> {
  return runChatLoop(chatLlm, messages, crewToolSchema, availableFunctions, options);
}

export const chat_loop = chatLoop;

export function showLoading(event?: { isSet?: () => boolean; is_set?: () => boolean } | null): void {
  void event;
}

export const show_loading = showLoading;

async function runChatLoop(
  chatLlm: LLM | LLMClient,
  messages: LLMMessage[],
  crewToolSchema: CrewChatToolSchema | Record<string, unknown>,
  availableFunctions: Record<string, unknown>,
  options: ChatLoopOptions,
): Promise<void> {
  const readInput = options.getUserInput ?? getUserInput;
  let turns = 0;
  while (options.maxTurns === undefined || turns < options.maxTurns) {
    try {
      flushInput();
      const userInput = await readInput();
      if (userInput.trim().toLowerCase() === "exit") {
        break;
      }
      const beforeLength = messages.length;
      await handleUserInput(userInput, chatLlm, messages, crewToolSchema, availableFunctions);
      const assistantMessage = messages.slice(beforeLength).findLast((message) => message.role === "assistant");
      if (assistantMessage) {
        options.onAssistantMessage?.(assistantMessage.content);
      }
      turns += 1;
    } catch (error) {
      if (options.onError) {
        options.onError(error);
        break;
      }
      throw error;
    }
  }
}

export function initializeChatLlm(crew: Crew): LLM | LLMClient | null {
  return createLLM(crew.chatLlm);
}

export const initialize_chat_llm = initializeChatLlm;

export function setCrewChatLoader(loader: CrewChatLoader | null): void {
  crewChatLoader = loader;
}

export const set_crew_chat_loader = setCrewChatLoader;

export function loadCrewAndName(): [Crew, string] {
  if (!crewChatLoader) {
    return loadCrewAndNameFromProject();
  }
  return crewChatLoader();
}

export const load_crew_and_name = loadCrewAndName;

function loadCrewAndNameFromProject(): [Crew, string] {
  const cwd = process.cwd();
  const pyprojectPath = join(cwd, "pyproject.toml");
  if (!existsSync(pyprojectPath)) {
    throw new Error("pyproject.toml not found in the current directory.");
  }
  const pyproject = readToml(pyprojectPath);
  const projectName = nestedString(pyproject, ["project", "name"]);
  if (!projectName) {
    throw new Error("Unable to read 'project.name' in the pyproject.toml file.");
  }
  const crewClassName = toCrewClassName(projectName);
  const folderNames = uniqueStrings([
    projectName,
    projectName.replaceAll("-", "_"),
  ]);
  const moduleCandidates = folderNames.flatMap((folderName) => [
    join(cwd, "src", folderName, "crew.cjs"),
    join(cwd, "src", folderName, "crew.js"),
    join(cwd, "src", folderName, "crew", "index.cjs"),
    join(cwd, "src", folderName, "crew", "index.js"),
  ]);
  const modulePath = moduleCandidates.find((candidate) => existsSync(candidate));
  const importLabel = `${projectName}.crew`;
  if (!modulePath) {
    throw new Error(`Failed to import crew module ${importLabel}: module file not found.`);
  }

  let imported: unknown;
  try {
    const requireFromProject = createRequire(join(cwd, "package.json"));
    imported = requireFromProject(resolve(modulePath)) as unknown;
  } catch (error) {
    throw new Error(`Failed to import crew module ${importLabel}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }

  const crewClass = getExportedMember(imported, crewClassName);
  if (typeof crewClass !== "function") {
    throw new Error(`Crew class ${crewClassName} not found in module ${importLabel}`);
  }
  const project = new (crewClass as new () => { crew?: () => Crew })();
  if (typeof project.crew !== "function") {
    throw new Error(`Crew class ${crewClassName} does not provide a crew() method.`);
  }
  return [project.crew(), crewClassName];
}

export async function runChat(): Promise<void> {
  const [crew, crewName] = loadCrewAndName();
  const chatLlm = initializeChatLlm(crew);
  if (!chatLlm) {
    return;
  }
  const crewChatInputs = await generateCrewChatInputs(crew, crewName, chatLlm);
  const crewToolSchema = generateCrewToolSchema(crewChatInputs);
  const systemMessage = buildSystemMessage(crewChatInputs);
  const introductoryMessage = stringifyLlmResponse(await callLLM(createLLMClient(chatLlm), [{ role: "system", content: systemMessage }]));
  const messages: LLMMessage[] = [
    { role: "system", content: systemMessage },
    { role: "assistant", content: introductoryMessage },
  ];
  await chatLoop(chatLlm, messages, crewToolSchema, {
    [crewChatInputs.crewName]: createToolFunction(crew, messages),
  });
}

export const run_chat = runChat;

export async function generateCrewChatInputs(
  crew: Crew,
  crewName: string,
  chatLlm: LLM | LLMClient,
  options: GenerateCrewChatInputsOptions = {},
): Promise<ChatInputs> {
  const generateDescriptions = options.generateDescriptions ?? options.generate_descriptions ?? true;
  const client = createLLMClient(chatLlm);
  const inputFields: ChatInputField[] = [];

  for (const inputName of fetchRequiredInputs(crew)) {
    const description = generateDescriptions
      ? await generateInputDescriptionWithAi(inputName, crew, client)
      : DEFAULT_INPUT_DESCRIPTION;
    inputFields.push(new ChatInputField({ name: inputName, description }));
  }

  const crewDescription = generateDescriptions
    ? await generateCrewDescriptionWithAi(crew, client)
    : DEFAULT_CREW_DESCRIPTION;

  return new ChatInputs({
    crewName,
    crewDescription,
    inputs: inputFields,
  });
}

export const generate_crew_chat_inputs = generateCrewChatInputs;

export function fetchRequiredInputs(crew: Crew): Set<string> {
  return crew.fetchInputs();
}

export const fetch_required_inputs = fetchRequiredInputs;

export async function generateInputDescriptionWithAi(
  inputName: string,
  crew: Crew,
  chatLlm: LLM | LLMClient,
): Promise<string> {
  const context = contextForInput(inputName, crew);
  if (!context) {
    throw new Error(`No context found for input '${inputName}'.`);
  }
  const prompt = [
    `Based on the following context, write a concise description (15 words or less) of the input '${inputName}'.`,
    "Provide only the description, without any extra text or labels. Do not include placeholders like '{topic}' in the description.",
    "Context:",
    context,
  ].join("\n");
  try {
    const response = await callLLM(createLLMClient(chatLlm), [{ role: "user", content: prompt }]);
    return stringifyLlmResponse(response).trim();
  } catch {
    return DEFAULT_INPUT_DESCRIPTION;
  }
}

export const generate_input_description_with_ai = generateInputDescriptionWithAi;

export async function generateCrewDescriptionWithAi(
  crew: Crew,
  chatLlm: LLM | LLMClient,
): Promise<string> {
  const context = fullCrewContext(crew);
  if (!context) {
    throw new Error("No context found for generating crew description.");
  }
  const prompt = [
    "Based on the following context, write a concise, action-oriented description (15 words or less) of the crew's purpose.",
    "Provide only the description, without any extra text or labels. Do not include placeholders like '{topic}' in the description.",
    "Context:",
    context,
  ].join("\n");
  try {
    const response = await callLLM(createLLMClient(chatLlm), [{ role: "user", content: prompt }]);
    return stringifyLlmResponse(response).trim();
  } catch {
    return DEFAULT_CREW_DESCRIPTION;
  }
}

export const generate_crew_description_with_ai = generateCrewDescriptionWithAi;

function contextForInput(inputName: string, crew: Crew): string {
  const context: string[] = [];
  for (const task of crew.tasks) {
    if (task.description.includes(`{${inputName}}`) || task.expectedOutput.includes(`{${inputName}}`)) {
      context.push(`Task Description: ${stripPlaceholders(task.description)}`);
      context.push(`Expected Output: ${stripPlaceholders(task.expectedOutput)}`);
    }
  }
  for (const agent of crew.agents) {
    if (
      agent.role.includes(`{${inputName}}`)
      || agent.goal.includes(`{${inputName}}`)
      || agent.backstory.includes(`{${inputName}}`)
    ) {
      context.push(`Agent Role: ${stripPlaceholders(agent.role)}`);
      context.push(`Agent Goal: ${stripPlaceholders(agent.goal)}`);
      context.push(`Agent Backstory: ${stripPlaceholders(agent.backstory)}`);
    }
  }
  return context.join("\n");
}

function fullCrewContext(crew: Crew): string {
  const context: string[] = [];
  for (const task of crew.tasks) {
    context.push(`Task Description: ${stripPlaceholders(task.description)}`);
    context.push(`Expected Output: ${stripPlaceholders(task.expectedOutput)}`);
  }
  for (const agent of crew.agents) {
    context.push(`Agent Role: ${stripPlaceholders(agent.role)}`);
    context.push(`Agent Goal: ${stripPlaceholders(agent.goal)}`);
    context.push(`Agent Backstory: ${stripPlaceholders(agent.backstory)}`);
  }
  return context.join("\n");
}

function stripPlaceholders(value: string): string {
  return value.replaceAll(/\{(.+?)\}/g, (_match, name: string) => name);
}

function stringifyLlmResponse(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value.toString();
  }
  return JSON.stringify(value);
}

function nestedString(value: unknown, path: readonly string[]): string | null {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" && current.trim() ? current : null;
}

function toCrewClassName(projectName: string): string {
  return projectName
    .split(/[_\-\s]+/u)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join("");
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function getExportedMember(moduleValue: unknown, exportName: string): unknown {
  const record = moduleValue && typeof moduleValue === "object" ? moduleValue as Record<string, unknown> : {};
  const direct = record[exportName];
  if (direct) {
    return direct;
  }
  const defaultExport = record.default;
  if (typeof defaultExport === "function" && defaultExport.name === exportName) {
    return defaultExport;
  }
  if (defaultExport && typeof defaultExport === "object") {
    return (defaultExport as Record<string, unknown>)[exportName];
  }
  return null;
}

function compareVersions(left: string, right: string): number {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart !== rightPart) {
      return leftPart > rightPart ? 1 : -1;
    }
  }
  return 0;
}

function parseVersion(value: string): number[] {
  const match = value.trim().match(/^v?(\d+(?:\.\d+)*)(?:(?:a|b|rc|post|dev)\d*)?(?:\+[0-9A-Za-z.-]+)?$/i);
  if (!match) {
    return [];
  }
  return (match[1] ?? "").split(".").map((part) => Number(part));
}

function isValidVersion(value: string): boolean {
  return parseVersion(value).length > 0;
}
