export type TokenProcessLike = {
  sum_successful_requests?: (requests: number) => void;
  sumSuccessfulRequests?: (requests: number) => void;
  sum_prompt_tokens?: (tokens: number) => void;
  sumPromptTokens?: (tokens: number) => void;
  sum_completion_tokens?: (tokens: number) => void;
  sumCompletionTokens?: (tokens: number) => void;
  sum_cached_prompt_tokens?: (tokens: number) => void;
  sumCachedPromptTokens?: (tokens: number) => void;
};

export type TokenUsageLike = {
  prompt_tokens?: number;
  promptTokens?: number;
  completion_tokens?: number;
  completionTokens?: number;
  prompt_tokens_details?: { cached_tokens?: number; cachedTokens?: number } | null;
  promptTokensDetails?: { cached_tokens?: number; cachedTokens?: number } | null;
};

export class TokenCalcHandler {
  tokenCostProcess: TokenProcessLike | null;
  token_cost_process: TokenProcessLike | null;

  constructor(tokenCostProcess: TokenProcessLike | null = null) {
    this.tokenCostProcess = tokenCostProcess;
    this.token_cost_process = tokenCostProcess;
  }

  logSuccessEvent(
    _kwargs: Record<string, unknown>,
    responseObj: Record<string, unknown>,
    _startTime: number,
    _endTime: number,
  ): void {
    void _startTime;
    void _endTime;
    if (!this.tokenCostProcess) {
      return;
    }
    const usage = responseObj.usage;
    if (!usage || typeof usage !== "object") {
      return;
    }
    this.recordUsage(usage);
  }

  log_success_event(
    kwargs: Record<string, unknown>,
    responseObj: Record<string, unknown>,
    startTime: number,
    endTime: number,
  ): void {
    this.logSuccessEvent(kwargs, responseObj, startTime, endTime);
  }

  private recordUsage(usage: TokenUsageLike): void {
    const process = this.tokenCostProcess;
    if (!process) {
      return;
    }
    callCounter(process.sumSuccessfulRequests, process.sum_successful_requests, 1);

    const promptTokens = usage.promptTokens ?? usage.prompt_tokens;
    if (typeof promptTokens === "number") {
      callCounter(process.sumPromptTokens, process.sum_prompt_tokens, promptTokens);
    }
    const completionTokens = usage.completionTokens ?? usage.completion_tokens;
    if (typeof completionTokens === "number") {
      callCounter(process.sumCompletionTokens, process.sum_completion_tokens, completionTokens);
    }
    const details = usage.promptTokensDetails ?? usage.prompt_tokens_details;
    const cachedTokens = details?.cachedTokens ?? details?.cached_tokens;
    if (typeof cachedTokens === "number" && cachedTokens > 0) {
      callCounter(process.sumCachedPromptTokens, process.sum_cached_prompt_tokens, cachedTokens);
    }
  }
}

function callCounter(
  camel: ((value: number) => void) | undefined,
  snake: ((value: number) => void) | undefined,
  value: number,
): void {
  if (camel) {
    camel(value);
  } else {
    snake?.(value);
  }
}
