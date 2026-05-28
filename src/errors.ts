export class DatabaseOperationError extends Error {
  readonly originalError: Error | null;
  readonly original_error: Error | null;

  constructor(message: string, originalError: Error | null = null) {
    super(message);
    this.name = "DatabaseOperationError";
    this.originalError = originalError;
    this.original_error = originalError;
  }
}

export const DatabaseError = {
  INIT_ERROR: "Database initialization error: {}",
  SAVE_ERROR: "Error saving task outputs: {}",
  UPDATE_ERROR: "Error updating task outputs: {}",
  LOAD_ERROR: "Error loading task outputs: {}",
  DELETE_ERROR: "Error deleting task outputs: {}",
  formatError(template: string, error: Error): string {
    return template.replace("{}", error.message);
  },
  format_error(template: string, error: Error): string {
    return this.formatError(template, error);
  },
} as const;

export class AgentRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentRepositoryError";
  }
}

export const CONTEXT_LIMIT_ERRORS = [
  "expected a string with maximum length",
  "maximum context length",
  "context length exceeded",
  "context_length_exceeded",
  "context window full",
  "too many tokens",
  "input is too long",
  "exceeds token limit",
] as const;

export class LLMContextLengthExceededError extends Error {
  readonly originalErrorMessage: string;
  readonly original_error_message: string;

  constructor(errorMessage: string) {
    super(LLMContextLengthExceededError.getErrorMessage(errorMessage));
    this.name = "LLMContextLengthExceededError";
    this.originalErrorMessage = errorMessage;
    this.original_error_message = errorMessage;
  }

  static isContextLimitError(errorMessage: string): boolean {
    const normalized = errorMessage.toLowerCase();
    return CONTEXT_LIMIT_ERRORS.some((phrase) => normalized.includes(phrase));
  }

  static is_context_limit_error(errorMessage: string): boolean {
    return this.isContextLimitError(errorMessage);
  }

  static getErrorMessage(errorMessage: string): string {
    return [
      `LLM context length exceeded. Original error: ${errorMessage}`,
      "Consider using a smaller input or implementing a text splitting strategy.",
    ].join("\n");
  }

  static get_error_message(errorMessage: string): string {
    return this.getErrorMessage(errorMessage);
  }
}
