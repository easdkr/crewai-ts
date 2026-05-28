import type { LLMClient } from "./llm.js";
import type { LLMMessage } from "./types.js";

export type StructuredModel<T = unknown> =
  | ((value: unknown) => T)
  | {
    modelValidate?: (value: unknown) => T;
    model_validate?: (value: unknown) => T;
    modelValidateJson?: (value: string) => T;
    model_validate_json?: (value: string) => T;
    modelDump?: (value: T) => Record<string, unknown>;
    model_dump?: (value: T) => Record<string, unknown>;
    schema?: unknown;
    name?: string;
  };

export type ConverterOptions<T = unknown> = {
  llm: LLMClient;
  text: string;
  model: StructuredModel<T>;
  instructions: string;
  maxAttempts?: number;
  max_attempts?: number;
};

export class CreateConverterKwargs<T = unknown> {
  readonly agent: ConversionAgent;
  readonly converterCls: typeof Converter<T>;
  readonly converter_cls: typeof Converter<T>;
  readonly llm: LLMClient;
  readonly text: string;
  readonly model: StructuredModel<T>;
  readonly instructions: string;

  constructor(options: {
    agent: ConversionAgent;
    converterCls?: typeof Converter<T>;
    converter_cls?: typeof Converter<T>;
    llm: LLMClient;
    text: string;
    model: StructuredModel<T>;
    instructions: string;
  }) {
    this.agent = options.agent;
    this.converterCls = options.converterCls ?? options.converter_cls ?? Converter<T>;
    this.converter_cls = this.converterCls;
    this.llm = options.llm;
    this.text = options.text;
    this.model = options.model;
    this.instructions = options.instructions;
  }
}

export type ConversionAgent = {
  llm?: LLMClient | null;
  functionCallingLlm?: LLMClient | null;
  function_calling_llm?: LLMClient | null;
  verbose?: boolean;
};

const jsonPattern = /({.*})/s;

export class ConverterError extends Error {
  readonly message: string;

  constructor(message: string) {
    super(message);
    this.name = "ConverterError";
    this.message = message;
  }
}

export class Converter<T = unknown> {
  readonly llm: LLMClient;
  readonly text: string;
  readonly model: StructuredModel<T>;
  readonly instructions: string;
  readonly maxAttempts: number;
  readonly max_attempts: number;

  constructor(options: ConverterOptions<T>) {
    this.llm = options.llm;
    this.text = options.text;
    this.model = options.model;
    this.instructions = options.instructions;
    this.maxAttempts = options.maxAttempts ?? options.max_attempts ?? 3;
    this.max_attempts = this.maxAttempts;
  }

  buildMessages(): LLMMessage[] {
    return [
      { role: "system", content: this.instructions },
      { role: "user", content: this.text },
    ];
  }

  _build_messages(): LLMMessage[] {
    return this.buildMessages();
  }

  async toPydantic(currentAttempt = 1): Promise<T> {
    try {
      const response = await this.llm.call(this.buildMessages(), { responseModel: this.model });
      return coerceResponseToModel(response, this.model);
    } catch (error) {
      if (currentAttempt < this.maxAttempts) {
        return await this.toPydantic(currentAttempt + 1);
      }
      throw new ConverterError(`Failed to convert text into a Pydantic model due to error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  to_pydantic(currentAttempt = 1): Promise<T> {
    return this.toPydantic(currentAttempt);
  }

  async atoPydantic(currentAttempt = 1): Promise<T> {
    return await this.toPydantic(currentAttempt);
  }

  ato_pydantic(currentAttempt = 1): Promise<T> {
    return this.atoPydantic(currentAttempt);
  }

  async toJson(currentAttempt = 1): Promise<string | ConverterError> {
    try {
      const response = await this.llm.call(this.buildMessages(), { responseModel: this.model });
      return typeof response === "string" ? response : JSON.stringify(response);
    } catch (error) {
      if (currentAttempt < this.maxAttempts) {
        return await this.toJson(currentAttempt + 1);
      }
      return new ConverterError(`Failed to convert text into JSON, error: ${error instanceof Error ? error.message : String(error)}.`);
    }
  }

  to_json(currentAttempt = 1): Promise<string | ConverterError> {
    return this.toJson(currentAttempt);
  }

  async atoJson(currentAttempt = 1): Promise<string | ConverterError> {
    return await this.toJson(currentAttempt);
  }

  ato_json(currentAttempt = 1): Promise<string | ConverterError> {
    return this.atoJson(currentAttempt);
  }
}

export function validateModel<T>(
  result: string,
  model: StructuredModel<T>,
  isJsonOutput: boolean,
): T | Record<string, unknown> {
  const parsed: unknown = JSON.parse(result);
  const validated = validateStructuredModel(parsed, model);
  return isJsonOutput ? dumpStructuredModel(validated, model) : validated;
}

export const validate_model = validateModel;

export function handlePartialJson<T>(
  result: string,
  model: StructuredModel<T>,
  isJsonOutput: boolean,
  agent: ConversionAgent | null = null,
  converterClass?: typeof Converter<T> | null,
): T | Record<string, unknown> | string {
  const match = jsonPattern.exec(result);
  if (match?.[1]) {
    try {
      return validateModel(match[1], model, isJsonOutput);
    } catch {
      if (!agent && !converterClass) {
        return result;
      }
    }
  }
  if (!agent && !converterClass) {
    return result;
  }
  throw new ConverterError("LLM conversion fallback requires async convertWithInstructions in TypeScript.");
}

export const handle_partial_json = handlePartialJson;

export async function asyncHandlePartialJson<T>(
  result: string,
  model: StructuredModel<T>,
  isJsonOutput: boolean,
  agent: ConversionAgent | null = null,
  converterClass?: typeof Converter<T> | null,
): Promise<T | Record<string, unknown> | string> {
  const handled = handlePartialJson(result, model, isJsonOutput, agent, null);
  if (typeof handled !== "string" || !agent || !converterClass) {
    return handled;
  }
  return await convertWithInstructions(result, model, isJsonOutput, agent, converterClass);
}

export const async_handle_partial_json = asyncHandlePartialJson;

export function convertToModel<T>(
  result: string | T,
  outputPydantic: StructuredModel<T> | null,
  outputJson: StructuredModel<T> | null,
  agent: ConversionAgent | null = null,
  converterClass?: typeof Converter<T> | null,
): T | Record<string, unknown> | string {
  const model = outputPydantic ?? outputJson;
  if (!model) {
    return result;
  }
  if (typeof result !== "string") {
    return outputJson ? dumpStructuredModel(result, model) : result;
  }
  if (converterClass) {
    throw new ConverterError("Use asyncConvertToModel when converterClass fallback is required.");
  }
  try {
    return validateModel(JSON.stringify(JSON.parse(result)), model, Boolean(outputJson));
  } catch {
    return handlePartialJson(result, model, Boolean(outputJson), agent, converterClass);
  }
}

export const convert_to_model = convertToModel;

export async function convertWithInstructions<T>(
  result: string,
  model: StructuredModel<T>,
  isJsonOutput: boolean,
  agent: ConversionAgent | null,
  converterClass: typeof Converter<T> = Converter<T>,
): Promise<T | Record<string, unknown> | string> {
  if (!agent) {
    throw new TypeError("Agent must be provided if converter_cls is not specified.");
  }
  const llm = agent.functionCallingLlm ?? agent.function_calling_llm ?? agent.llm;
  if (!llm) {
    throw new Error("Agent must have a valid LLM instance for conversion");
  }
  const converter = new converterClass({
    agent,
    llm,
    text: result,
    model,
    instructions: getConversionInstructions(model, llm),
  } as ConverterOptions<T> & { agent: ConversionAgent });
  const converted = isJsonOutput ? await converter.toJson() : await converter.toPydantic();
  if (converted instanceof ConverterError) {
    return result;
  }
  if (isJsonOutput && typeof converted === "string") {
    return validateModel(converted, model, true);
  }
  return converted;
}

export const convert_with_instructions = convertWithInstructions;
export const async_convert_with_instructions = convertWithInstructions;

export function createConverter<T>(options: ConverterOptions<T>): Converter<T> {
  return new Converter(options);
}

export const create_converter = createConverter;

export async function asyncConvertToModel<T>(
  result: string | T,
  outputPydantic: StructuredModel<T> | null,
  outputJson: StructuredModel<T> | null,
  agent: ConversionAgent | null = null,
  converterClass?: typeof Converter<T> | null,
): Promise<T | Record<string, unknown> | string> {
  const model = outputPydantic ?? outputJson;
  if (!model) {
    return result;
  }
  if (typeof result !== "string") {
    return outputJson ? dumpStructuredModel(result, model) : result;
  }
  try {
    return validateModel(JSON.stringify(JSON.parse(result)), model, Boolean(outputJson));
  } catch {
    if (converterClass) {
      return await convertWithInstructions(result, model, Boolean(outputJson), agent, converterClass);
    }
    return handlePartialJson(result, model, Boolean(outputJson), agent, converterClass);
  }
}

export const async_convert_to_model = asyncConvertToModel;

export function getConversionInstructions<T>(model: StructuredModel<T>, _llm?: unknown): string {
  void _llm;
  return `Convert the following text into the requested JSON schema:\n${JSON.stringify(describeModel(model), null, 2)}`;
}

export const get_conversion_instructions = getConversionInstructions;

function coerceResponseToModel<T>(response: unknown, model: StructuredModel<T>): T {
  if (typeof response === "string") {
    try {
      return validateStructuredModel(JSON.parse(response), model);
    } catch {
      const partial = handlePartialJson(response, model, false);
      if (typeof partial === "string") {
        throw new ConverterError(`Failed to convert partial JSON result into Pydantic: ${partial}`);
      }
      return partial as T;
    }
  }
  return validateStructuredModel(response, model);
}

function validateStructuredModel<T>(value: unknown, model: StructuredModel<T>): T {
  if (typeof model === "function") {
    return model(value);
  }
  if (model.modelValidate) {
    return model.modelValidate(value);
  }
  if (model.model_validate) {
    return model.model_validate(value);
  }
  if (typeof value === "string" && model.modelValidateJson) {
    return model.modelValidateJson(value);
  }
  if (typeof value === "string" && model.model_validate_json) {
    return model.model_validate_json(value);
  }
  return value as T;
}

function dumpStructuredModel<T>(value: T, model: StructuredModel<T>): Record<string, unknown> {
  if (typeof model !== "function" && model.modelDump) {
    return model.modelDump(value);
  }
  if (typeof model !== "function" && model.model_dump) {
    return model.model_dump(value);
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : { value };
}

function describeModel<T>(model: StructuredModel<T>): unknown {
  return typeof model === "function" ? { name: model.name || "Model" } : model.schema ?? { name: model.name ?? "Model" };
}
