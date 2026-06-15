# @crewai-ts/nestjs-demo

A runnable **HTTP NestJS app** that exercises most of the `@crewai-ts/nestjs`
helper surface, and doubles as a **live smoke test** against a real LLM
(OpenAI, Gemini, or Anthropic) using provider keys from your environment.

> **Live only.** There is no mock fallback — if no provider key is set, the app
> fails fast with a clear error. Secrets are read from `process.env` only and
> are **never** hardcoded.

## What it demonstrates

| Helper / token | Where |
| --- | --- |
| `CrewModule.forRootAsync` (`imports`/`inject`/`useFactory`) | `src/app.module.ts` |
| `forRoot` options (`llms`, `planningLlm`, `functionCallingLlm`, `planning`, `verbose`, `cache`, `llmRouter`, `memory`, `knowledge`) | `src/llm/llm-config.service.ts` |
| `AgentFactory`, `CREW_FACTORY` / `DefaultCrewFactory`, `crew.kickoff` (**live**) | `src/research/*` |
| `LLM_REGISTRY` / `LlmRegistryService` (`names`/`get`/`has`/`register`/`resolve`) | `src/registry/*` |
| `LLM_ROUTER` / `LlmRouterService` (round-robin / fallback / race / weighted / custom) | `src/router/*` |
| `EVENT_BUS` / `EventBusService` (`on`/`off`/`emit`/`destroy`) | `src/events/*` |
| `AgentProvider` + `AGENT_REGISTRY` / `AgentRegistryService` | `src/agents/*` |
| `LLM` / `MEMORY` / `KNOWLEDGE` / `PLANNING_LLM` / `FUNCTION_CALLING_LLM` tokens | `src/runtime/*` |

> `llmProviders: [...]` (native provider auto-registration) is **documented but
> not enabled** here — see [Provider auto-registration](#provider-auto-registration).

## Environment

Set the key(s) for the provider(s) you want. The first available provider (order
`openai → gemini → anthropic`) backs `llms.default`; override with `LLM_PROVIDER`.
Names only — see [`.env.example`](./.env.example).

| Provider | Key | Model override | Notes |
| --- | --- | --- | --- |
| OpenAI | `OPENAI_API_KEY` | `OPENAI_MODEL` (def. `gpt-4o-mini`) | public endpoint |
| Gemini | `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) | `GEMINI_MODEL` (def. `gemini-2.5-flash`) | public endpoint |
| Anthropic | `ANTHROPIC_API_KEY` **or** `CLAUDE_API_KEY` | `ANTHROPIC_MODEL` (def. `claude-sonnet-4-5`) | `ANTHROPIC_BASE_URL` routes through a proxy (e.g. local Headroom on `:8787`). The proxy may only serve current model ids — set `ANTHROPIC_MODEL` accordingly. |

The Anthropic provider does not auto-read env keys, so the demo passes the
(bridged) key explicitly and forwards `ANTHROPIC_BASE_URL`. If your keys already
live in `~/.zshrc`, just run from that shell — no `.env` needed.

## Run

From the repo root (links the workspace + builds deps):

```sh
pnpm install
pnpm --filter @crewai-ts/core build
pnpm --filter @crewai-ts/nestjs build
# provider packages ship prebuilt; rebuild if you changed them:
# pnpm --filter @crewai-ts/openai --filter @crewai-ts/gemini --filter @crewai-ts/anthropic build
```

### Live smoke test

```sh
# uses the first available key (openai -> gemini -> anthropic)
pnpm --filter @crewai-ts/nestjs-demo smoke

# pin a provider
LLM_PROVIDER=openai    pnpm --filter @crewai-ts/nestjs-demo smoke
LLM_PROVIDER=gemini    pnpm --filter @crewai-ts/nestjs-demo smoke
LLM_PROVIDER=anthropic pnpm --filter @crewai-ts/nestjs-demo smoke   # needs the proxy on ANTHROPIC_BASE_URL
```

Exit code `0` = a real LLM round-trip returned non-empty output.

### HTTP server

```sh
pnpm --filter @crewai-ts/nestjs-demo start   # http://localhost:3000 (PORT to override)
```

```sh
# Live 2-agent crew (default provider)
curl -X POST localhost:3000/research -H 'content-type: application/json' \
  -d '{"topic":"dependency injection in NestJS"}'
# Pin a provider per request
curl -X POST localhost:3000/research -H 'content-type: application/json' \
  -d '{"topic":"caching","provider":"gemini"}'

curl localhost:3000/llms
curl localhost:3000/llms/default
curl -X POST localhost:3000/llms/quick -H 'content-type: application/json' -d '{"aliasOf":"default"}'

curl 'localhost:3000/router/route?strategy=round-robin'
curl -X POST localhost:3000/router/custom

curl localhost:3000/agents
curl localhost:3000/agents/researcher
curl localhost:3000/runtime

curl localhost:3000/events
curl -X POST localhost:3000/events/emit -H 'content-type: application/json' -d '{"type":"demo_event"}'
```

## Provider auto-registration

In a normal flat-install app you can let `CrewModule` lazy-register native
provider packages:

```ts
CrewModule.forRoot({ llms: { default: "gpt-4o-mini" }, llmProviders: ["openai"] });
```

This demo **omits `llmProviders`** because the lazy `import('@crewai-ts/openai')`
runs from inside the `@crewai-ts/nestjs` package, which a **pnpm-isolated
workspace** cannot resolve (the provider packages aren't visible from nestjs's
own `node_modules`). Instead, `LlmConfigService.clientFor()` calls
`registerOpenAIProvider()` / `registerGeminiProvider()` / `registerAnthropicProvider()`
directly — the same end state, workspace-safe.
