import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import type { Flow, HumanFeedbackProvider } from "./flow.js";
import type { MaybePromise } from "@crewai-ts/core/types";

export type InputResponse = {
  text: string | null;
  metadata?: Record<string, unknown> | null;
};

export type InputProvider = {
  requestInput?(
    message: string,
    flow: Flow<object>,
    metadata?: Record<string, unknown> | null,
  ): MaybePromise<string | InputResponse | null>;
  request_input?(
    message: string,
    flow: Flow<object>,
    metadata?: Record<string, unknown> | null,
  ): MaybePromise<string | InputResponse | null>;
};

export type FlowConfig = {
  inputProvider: InputProvider | null;
  hitlProvider: HumanFeedbackProvider | null;
};
export const FlowConfig = Object.freeze({ kind: "FlowConfig" });

export const flowConfig: FlowConfig = {
  inputProvider: null,
  hitlProvider: null,
};

export class ConsoleInputProvider implements InputProvider {
  async requestInput(message: string): Promise<string> {
    const readline = createInterface({ input, output });
    try {
      return (await readline.question(`${message} `)).trim();
    } finally {
      readline.close();
    }
  }
}

export function isInputResponse(value: unknown): value is InputResponse {
  return value !== null
    && typeof value === "object"
    && "text" in value;
}
