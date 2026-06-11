# @crewai-ts/rag

[![npm version](https://img.shields.io/npm/v/@crewai-ts/rag.svg)](https://www.npmjs.com/package/@crewai-ts/rag)
[![license](https://img.shields.io/npm/l/@crewai-ts/rag.svg)](./LICENSE)
[![types](https://img.shields.io/npm/types/@crewai-ts/rag.svg)](https://www.npmjs.com/package/@crewai-ts/rag)

Memory, Knowledge, vector-store, and PDF text-extraction features for
CrewAI TypeScript.

This package provides `Memory` and `MemoryScope` for cross-execution recall,
`Knowledge` source types for prompt-time retrieval, embedding functions, and
Qdrant / ChromaDB client adapters for building retrieval-augmented generation
workflows. PDF text extraction is included by default; vector-store
integration is opt-in.

> **Unofficial project.** This is a community port of
> [CrewAI](https://github.com/crewAIInc/crewAI) and is **not affiliated with,
> endorsed by, or maintained by crewAI, Inc.** See
> [License](#license) for the upstream MIT notice.

## Install

```sh
npm install @crewai-ts/core @crewai-ts/rag
# or
pnpm add @crewai-ts/core @crewai-ts/rag
```

Requirements:

- Node.js 22 or later
- `@crewai-ts/core` 0.2.0 or later

## Memory

Store and recall information across agent executions. `Memory` is attached
to a `Crew` via the `memory` option; agent-level memory is also available
through `new Agent({ memory })`.

```ts
import { Crew, Process, Task } from "@crewai-ts/core";
import { Memory } from "@crewai-ts/rag";

const memory = new Memory();
memory.remember("CrewAI supports sequential crews", {
  scope: "/research",
  categories: ["fact"],
});

const recalled = memory.recall("sequential crews", {
  scope: "/research",
  limit: 5,
});

const crew = new Crew({
  agents: [researcher],
  tasks: [task],
  process: Process.sequential,
  memory,
});
```

## Knowledge

Inject knowledge sources into agent and crew prompts. Each `Knowledge` source
contributes relevant snippets to the task prompt as additional context.

`StringKnowledgeSource` accepts either a plain string or an options object.
The string form is the most ergonomic for inline content:

```ts
import { Agent, Crew, Task } from "@crewai-ts/core";
import {
  CSVKnowledgeSource,
  JSONKnowledgeSource,
  StringKnowledgeSource,
  TextFileKnowledgeSource,
} from "@crewai-ts/rag";

const crew = new Crew({
  agents: [researcher],
  tasks: [
    new Task({
      description: "Explain the Nest integration",
      expectedOutput: "Integration guidance",
      agent: researcher,
    }),
  ],
  knowledgeSources: [
    new StringKnowledgeSource("Nest should consume crewai-ts as a normal TypeScript library."),
    new StringKnowledgeSource({
      content: "The API service uses NestJS modules, providers, and controllers.",
      metadata: { source: "architecture-notes" },
    }),
    new TextFileKnowledgeSource("docs/notes.txt"),
    new JSONKnowledgeSource("data/facts.json"),
    new CSVKnowledgeSource("data/records.csv"),
  ],
});

crew.resetMemories("knowledge");
```

## Vector Stores

This package ships client adapters for Qdrant and ChromaDB. The clients wrap
the existing `EmbeddingFunction` plumbing and let you perform collection
operations, batching, and locked writes against a remote store.

```ts
import { ChromaDBClient, QdrantClient } from "@crewai-ts/rag";

const qdrant = new QdrantClient(existingQdrantClient, {
  embeddingFunction: myEmbeddingFunction,
  defaultLimit: 10,
  defaultScoreThreshold: 0.7,
  defaultBatchSize: 100,
  lockName: "qdrant-research",
});

const chroma = new ChromaDBClient(existingChromaClient, {
  embeddingFunction: myEmbeddingFunction,
  defaultLimit: 5,
  defaultScoreThreshold: 0.6,
  defaultBatchSize: 100,
});
```

`QdrantClient` and `ChromaDBClient` are thin async-friendly adapters —
operations like `acreate_collection`, `aadd`, `aquery`, and `adelete` return
`Promise`s and integrate with the `runNamedLock` helper for process-safe
writes. They expect you to bring your own `@qdrant/js-client-rest` or
`chromadb` client (this package does not bundle a transport).

## PDF Text Extraction

`defaultPDFTextExtractorAsync` extracts plain text from a PDF buffer. It
uses `pdf-parse` internally and accepts a `Buffer`:

```ts
import { readFileSync } from "node:fs";
import { defaultPDFTextExtractorAsync } from "@crewai-ts/rag";

const pdfBuffer = readFileSync("docs/report.pdf");
const text = await defaultPDFTextExtractorAsync(pdfBuffer);
```

If you have a `Uint8Array` instead, wrap it with `Buffer.from(bytes)` first.

## Exports

- `Memory`, `MemoryScope`, `MemorySlice` — memory storage and recall
- `createMemoryTools(memory)` — recall / save tools injected into crews
- `Knowledge`, `StringKnowledgeSource`, `TextFileKnowledgeSource`,
  `JSONKnowledgeSource`, `CSVKnowledgeSource` — knowledge sources
- `QdrantClient`, `ChromaDBClient` — vector-store client adapters
- `QdrantEmbeddingFunctionWrapper`, `ChromaEmbeddingFunctionWrapper` —
  embedding function adapters
- `BaseRecord`, `Embedding`, `Embeddings`, `EmbeddingFunction`,
  `AsyncEmbeddingFunction`, `QueryEmbedding` — vector store types
- `defaultRagEmbeddingFunction` — the default embedding function
- `defaultPDFTextExtractorAsync` — PDF text extraction

## Related Packages

- `@crewai-ts/core` — agents, tasks, crews, tools, hooks, security, checkpoints
- `@crewai-ts/flow` — stateful Flow orchestration
- `@crewai-ts/nestjs` — NestJS DI integration
- `@crewai-ts/cli` — crewai-ts CLI

## License

MIT

This project is an unofficial TypeScript port of
[CrewAI](https://github.com/crewAIInc/crewAI) (Copyright © crewAI, Inc.),
which is distributed under the MIT License. It is not affiliated with or
endorsed by crewAI, Inc. As required by the MIT License, the original
copyright and permission notice are retained in [LICENSE](./LICENSE).
