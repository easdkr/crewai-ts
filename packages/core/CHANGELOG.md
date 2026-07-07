# @crewai-ts/core

## 0.2.5

### Patch Changes

- 4113794: Execute OpenAI native tool calls when `availableFunctions` or `available_functions` is provided, including bounded `maxToolRounds` support.
- 0ab2f55: Normalize optional tool args for OpenAI strict function schemas and preserve pre-converted OpenAI function schemas in the OpenAI provider.
- 30f63ad: Fix tool function parameter handling for minified and non-minified functions.
