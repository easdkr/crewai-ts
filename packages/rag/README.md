# @crewai-ts/rag

[![npm version](https://img.shields.io/npm/v/@crewai-ts/rag.svg)](https://www.npmjs.com/package/@crewai-ts/rag)

RAG, knowledge, memory, and file-ingestion features for CrewAI TypeScript.

This package provides `Memory`, `Knowledge`, vector store abstractions (Qdrant, ChromaDB), embedding functions, and PDF text extraction for building retrieval-augmented generation workflows.

## Install

```sh
npm install @crewai-ts/rag
```

Requirements:

- Node.js 22 or later
- `@crewai-ts/core` 0.2.0 or later

## Memory

Store and recall information across agent executions:

```ts
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
```

Attach memory to a crew:

```ts
import { Crew } from "@crewai-ts/core";

const crew = new Crew({
  agents: [researcher],
  tasks: [task],
  memory,
});
```

## Knowledge

Inject knowledge sources into agent and crew prompts:

```ts
import { StringKnowledgeSource, TextFileKnowledgeSource, JSONKnowledgeSource, CSVKnowledgeSource } from "@crewai-ts/rag";

const crew = new Crew({
  agents: [researcher],
  tasks: [task],
  knowledgeSources: [
    new StringKnowledgeSource({
      content: "NestJS uses modules, providers, and controllers.",
      metadata: { source: "architecture" },
    }),
    new TextFileKnowledgeSource("docs/notes.txt"),
    new JSONKnowledgeSource("data/facts.json"),
    new CSVKnowledgeSource("data/records.csv"),
  ],
});
```

## Vector Stores

### Qdrant

```ts
import { QdrantVectorStore } from "@crewai-ts/rag";

const store = new QdrantVectorStore({
  collectionName: "my-collection",
  embeddingFunction: myEmbeddingFunc,
});
```

### ChromaDB

```ts
import { ChromaDBVectorStore } from "@crewai-ts/rag";

const store = new ChromaDBVectorStore({
  collectionName: "my-collection",
  embeddingFunction: myEmbeddingFunc,
});
```

## PDF Text Extraction

```ts
import { defaultPDFTextExtractorAsync } from "@crewai-ts/rag";

const text = await defaultPDFTextExtractorAsync(pdfBuffer);
```

## Exports

- `Memory`, `MemoryScope`, `MemorySlice` — memory storage and recall
- `Knowledge`, `StringKnowledgeSource`, `TextFileKnowledgeSource`, `JSONKnowledgeSource`, `CSVKnowledgeSource` — knowledge sources
- `QdrantVectorStore`, `ChromaDBVectorStore` — vector store implementations
- `BaseRecord`, `Embedding`, `EmbeddingFunction` — vector store types
- `defaultPDFTextExtractorAsync` — PDF text extraction

## License

MIT
