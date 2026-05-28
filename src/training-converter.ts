import type { LLMMessage } from "./types.js";

export type TrainingConverterField = {
  description: string;
  type?: "string" | "list" | "float" | "number" | "unknown";
};

export type TrainingConverterModel = Record<string, TrainingConverterField>;

export type TrainingConverterLLM = {
  call(messages: readonly LLMMessage[]): string;
};

export type TrainingConverterOptions = {
  llm: TrainingConverterLLM;
  text: string;
  model: TrainingConverterModel;
  instructions?: string;
};

const floatPattern = /(\d+(?:\.\d+)?)/;

export class TrainingConverter {
  readonly llm: TrainingConverterLLM;
  readonly text: string;
  readonly model: TrainingConverterModel;
  readonly instructions: string;

  constructor(options: TrainingConverterOptions) {
    this.llm = options.llm;
    this.text = options.text;
    this.model = options.model;
    this.instructions = options.instructions ?? "";
  }

  toPydantic(): Record<string, unknown> {
    return this.convertFieldByField();
  }

  to_pydantic(): Record<string, unknown> {
    return this.toPydantic();
  }

  convertFieldByField(): Record<string, unknown> {
    const fieldValues: Record<string, unknown> = {};
    for (const [fieldName, fieldInfo] of Object.entries(this.model)) {
      if (!fieldInfo.description) {
        throw new Error(`Field '${fieldName}' has no description`);
      }
      const response = this.askLlmForField(fieldName, fieldInfo.description);
      fieldValues[fieldName] = this.processFieldValue(response, fieldInfo.type);
    }
    return fieldValues;
  }

  _convert_field_by_field(): Record<string, unknown> {
    return this.convertFieldByField();
  }

  askLlmForField(fieldName: string, fieldDescription: string): string {
    const prompt = [
      "Based on the following information:",
      this.text,
      "",
      `Please provide ONLY the ${fieldName} field value as described:`,
      `"${fieldDescription}"`,
      "",
      "Respond with ONLY the requested information, nothing else.",
    ].join("\n");
    return this.llm.call([
      {
        role: "system",
        content: `Extract the ${fieldName} from the previous information.`,
      },
      { role: "user", content: prompt },
    ]);
  }

  _ask_llm_for_field(fieldName: string, fieldDescription: string): string {
    return this.askLlmForField(fieldName, fieldDescription);
  }

  processFieldValue(response: string, fieldType?: TrainingConverterField["type"]): unknown {
    const trimmed = response.trim();
    if (fieldType === "list") {
      return this.parseList(trimmed);
    }
    if (fieldType === "float" || fieldType === "number") {
      return TrainingConverter.parseFloat(trimmed);
    }
    if (fieldType === "string") {
      return trimmed;
    }
    return trimmed;
  }

  _process_field_value(response: string, fieldType?: TrainingConverterField["type"]): unknown {
    return this.processFieldValue(response, fieldType);
  }

  parseList(response: string): unknown[] {
    try {
      if (response.startsWith("[")) {
        const parsed: unknown = JSON.parse(response);
        return Array.isArray(parsed) ? parsed : [response];
      }
      return response
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => TrainingConverter.stripBullet(item));
    } catch {
      return [response];
    }
  }

  _parse_list(response: string): unknown[] {
    return this.parseList(response);
  }

  static parseFloat(response: string): number {
    const match = floatPattern.exec(response);
    return match?.[1] ? Number(match[1]) : 0;
  }

  static _parse_float(response: string): number {
    return TrainingConverter.parseFloat(response);
  }

  static stripBullet(item: string): string {
    return item.startsWith("- ") || item.startsWith("* ")
      ? item.slice(2).trim()
      : item.trim();
  }

  static _strip_bullet(item: string): string {
    return TrainingConverter.stripBullet(item);
  }
}
