# @crewai-ts/snowflake

[![npm version](https://img.shields.io/npm/v/@crewai-ts/snowflake.svg)](https://www.npmjs.com/package/@crewai-ts/snowflake)

Snowflake Cortex native provider for CrewAI TypeScript.

Provides `SnowflakeCompletion` for calling models through Snowflake Cortex, extending the OpenAI-compatible provider with Snowflake-specific authentication and configuration.

## Install

```sh
npm install @crewai-ts/snowflake
```

Requirements:

- Node.js 22 or later
- `@crewai-ts/core` 0.2.0 or later
- Snowflake account and credentials

## Quick Start

```ts
import { Agent } from "@crewai-ts/core";
import { SnowflakeCompletion, registerSnowflakeProvider } from "@crewai-ts/snowflake";

registerSnowflakeProvider();

const agent = new Agent({
  role: "Analyst",
  goal: "Analyze data",
  backstory: "A data-driven analyst.",
  llm: new SnowflakeCompletion({
    model: "claude-3-5-sonnet",
    accountUrl: "https://my-account.snowflakecomputing.com",
    apiKey: process.env.SNOWFLAKE_PAT,
  }),
});
```

Or use the registered provider name:

```ts
const agent = new Agent({
  role: "Analyst",
  goal: "Analyze data",
  backstory: "A data-driven analyst.",
  llm: "snowflake/claude-3-5-sonnet",
});
```

## Authentication

The provider looks for API keys in this order:

1. `apiKey` / `api_key` option
2. `SNOWFLAKE_PAT` environment variable
3. `SNOWFLAKE_TOKEN` environment variable
4. `SNOWFLAKE_JWT` environment variable

## Configuration

```ts
const llm = new SnowflakeCompletion({
  model: "claude-3-5-sonnet",
  accountUrl: "https://my-account.snowflakecomputing.com",
  accountIdentifier: "my-account",
  database: "my_db",
  schemaName: "public",
  warehouse: "my_warehouse",
  role: "my_role",
  apiKey: process.env.SNOWFLAKE_PAT,
});
```

## Exports

- `SnowflakeCompletion` — main LLM provider class
- `SNOWFLAKE_CORTEX_PATH` — Cortex API path constant
- `SNOWFLAKE_TOKEN_ENV_VARS` — token environment variable names
- `registerSnowflakeProvider` — register the provider with the core runtime

## License

MIT
