---
"@crewai-ts/openai": patch
---

Fix `maxRetries` so it actually retries failed OpenAI requests (network errors, 408/409/429/5xx) with exponential backoff and `Retry-After` support, and add an opt-in `flexFallbackToAuto` / `flex_fallback_to_auto` option that falls back from `service_tier: "flex"` to `"auto"` on retryable errors. Defaults to `false`, so existing Flex users keep their current behavior. Failed requests now throw `OpenAIRequestError`, which preserves the HTTP status code.
