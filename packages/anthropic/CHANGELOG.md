# @crewai-ts/anthropic

## 0.3.0

### Minor Changes

- 0f2d8ce: Add support for current OpenAI GPT-6 Astra and GPT-5.6 models and Anthropic Claude Fable 5.1, Opus 5, and Sonnet 5 models.

  Update model catalogs, context limits, and multimodal capability detection. Fix Claude provider routing and preserve credentials, token limits, reasoning effort, and thinking settings through `createLLM()`.

  Correct OpenAI reasoning token parameters and stop-sequence handling. Default GPT-6 Astra to the Responses API for tool support and omit its unsupported sampling and logprobs parameters.

  Add Claude adaptive thinking, effort controls, and native structured outputs, with model-specific thinking and tool constraints and explicit errors for malformed structured responses. Preserve supported legacy model behavior.

### Patch Changes

- Updated dependencies [0f2d8ce]
  - @crewai-ts/core@0.2.6
