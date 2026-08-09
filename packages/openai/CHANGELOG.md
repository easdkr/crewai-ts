# @crewai-ts/openai

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
