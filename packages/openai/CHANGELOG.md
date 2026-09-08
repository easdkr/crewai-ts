# @crewai-ts/openai

## 0.3.0

### Minor Changes

- 0f2d8ce: Add support for current OpenAI GPT-6 Astra and GPT-5.6 models and Anthropic Claude Fable 5.1, Opus 5, and Sonnet 5 models.

  Update model catalogs, context limits, and multimodal capability detection. Fix Claude provider routing and preserve credentials, token limits, reasoning effort, and thinking settings through `createLLM()`.

  Correct OpenAI reasoning token parameters and stop-sequence handling. Default GPT-6 Astra to the Responses API for tool support and omit its unsupported sampling and logprobs parameters.

  Add Claude adaptive thinking, effort controls, and native structured outputs, with model-specific thinking and tool constraints and explicit errors for malformed structured responses. Preserve supported legacy model behavior.

### Patch Changes

- Updated dependencies [0f2d8ce]
  - @crewai-ts/core@0.2.6

## 0.2.3

### Patch Changes

- b7bc969: Fix `maxRetries` so it actually retries failed OpenAI requests (network errors, 408/409/429/5xx) with exponential backoff and `Retry-After` support, and add an opt-in `flexFallbackToAuto` / `flex_fallback_to_auto` option that falls back from `service_tier: "flex"` to `"auto"` on retryable errors. Defaults to `false`, so existing Flex users keep their current behavior. Failed requests now throw `OpenAIRequestError`, which preserves the HTTP status code.

## 0.2.2

### Patch Changes

- 4113794: Execute OpenAI native tool calls when `availableFunctions` or `available_functions` is provided, including bounded `maxToolRounds` support.
- 0ab2f55: Normalize optional tool args for OpenAI strict function schemas and preserve pre-converted OpenAI function schemas in the OpenAI provider.
- Updated dependencies [4113794]
- Updated dependencies [0ab2f55]
- Updated dependencies [30f63ad]
  - @crewai-ts/core@0.2.5
