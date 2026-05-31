import { createHash } from "node:crypto";

export const DISCRIMINATOR = "provider";
export const DEFAULT_RAG_CONFIG_PATH = "crewai.rag.chromadb.config";
export const DEFAULT_RAG_CONFIG_CLASS = "ChromaDBConfig";
export const DEFAULT_CHROMADB_TENANT = "default_tenant";
export const DEFAULT_CHROMADB_DATABASE = "default_database";
export const DEFAULT_CHROMADB_STORAGE_PATH = "./chroma";
export const DEFAULT_TENANT = DEFAULT_CHROMADB_TENANT;
export const DEFAULT_DATABASE = DEFAULT_CHROMADB_DATABASE;
export const MIN_COLLECTION_LENGTH = 3;
export const MAX_COLLECTION_LENGTH = 63;
export const DEFAULT_COLLECTION = "default_collection";
export const INVALID_CHARS_PATTERN = /[^a-zA-Z0-9_-]/;
export const IPV4_PATTERN = /^(\d{1,3}\.){3}\d{1,3}$/;
export const DEFAULT_QDRANT_STORAGE_PATH = "./qdrant";
export const DEFAULT_QDRANT_EMBEDDING_MODEL = "BAAI/bge-small-en";
export const DEFAULT_VECTOR_PARAMS = Object.freeze({ size: 384, distance: "Cosine" });
export const DEFAULT_EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
export const DEFAULT_STORAGE_PATH = DEFAULT_QDRANT_STORAGE_PATH;

export type RagMetadataValue = string | number | boolean;
export type RagMetadata = Record<string, RagMetadataValue>;

export type BaseRecord = {
  docId?: string;
  doc_id?: string;
  content: string;
  metadata?: RagMetadata | readonly RagMetadata[] | null;
};

export type BaseRecordOptions = BaseRecord;

export const BaseRecord = class BaseRecord {
  readonly docId: string | null;
  readonly doc_id: string | null;
  readonly content: string;
  readonly metadata: RagMetadata | readonly RagMetadata[] | null;

  constructor(options: BaseRecordOptions) {
    this.docId = options.docId ?? options.doc_id ?? null;
    this.doc_id = this.docId;
    this.content = options.content;
    this.metadata = options.metadata ?? null;
  }
};
export const BaseClient = Object.freeze({ kind: "BaseClient" });

export type Embedding = readonly number[];
export const Embedding = Array;
export type Embeddings = readonly Embedding[];
export const Embeddings = Array;
export type EmbeddingFunction = (...args: readonly unknown[]) => unknown;
export const EmbeddingFunction = Object.freeze({ kind: "EmbeddingFunction" });
export type AsyncEmbeddingFunction = (...args: readonly unknown[]) => Promise<unknown>;
export const AsyncEmbeddingFunction = Object.freeze({ kind: "AsyncEmbeddingFunction" });
export type QueryEmbedding = readonly number[];
export const QueryEmbedding = Array;
export const QdrantClientType = Object.freeze({ kind: "QdrantClientType" });
export const BasicConditions = Object.freeze({ kind: "BasicConditions" });
export const StructuralConditions = Object.freeze({ kind: "StructuralConditions" });
export const FilterCondition = Object.freeze({ kind: "FilterCondition" });
export const MetadataFilterValue = Object.freeze({ kind: "MetadataFilterValue" });
export const MetadataFilter = Object.freeze({ kind: "MetadataFilter" });
export const QdrantClientParams = Object.freeze({ kind: "QdrantClientParams" });
export const CommonCreateFields = Object.freeze({ kind: "CommonCreateFields" });
export const QdrantCollectionCreateParams = Object.freeze({ kind: "QdrantCollectionCreateParams" });
export const CreateCollectionParams = Object.freeze({ kind: "CreateCollectionParams" });
export const PreparedSearchParams = Object.freeze({ kind: "PreparedSearchParams" });
export const QdrantEmbeddingFunctionWrapper = {
  __get_pydantic_core_schema__(): unknown {
    return {};
  },
};
export const ChromaDBClientType = Object.freeze({ kind: "ChromaDBClientType" });
export const ChromaEmbeddingFunctionWrapper = {
  __get_pydantic_core_schema__(): unknown {
    return {};
  },
};
export class PreparedDocuments {
  readonly ids: string[];
  readonly texts: string[];
  readonly metadatas: Array<Record<string, string | number | boolean>>;

  constructor(
    ids: string[] = [],
    texts: string[] = [],
    metadatas: Array<Record<string, string | number | boolean>> = [],
  ) {
    this.ids = ids;
    this.texts = texts;
    this.metadatas = metadatas;
  }

  *[Symbol.iterator](): IterableIterator<unknown> {
    yield this.ids;
    yield this.texts;
    yield this.metadatas;
  }
}
export class ExtractedSearchParams {
  readonly collection_name: string;
  readonly query: string;
  readonly limit: number;
  readonly metadata_filter: Record<string, unknown> | null;
  readonly score_threshold: number | null;
  readonly where: unknown;
  readonly where_document: unknown;
  readonly include: unknown;

  constructor(options: {
    collection_name?: string;
    collectionName?: string;
    query?: string;
    limit?: number;
    metadata_filter?: Record<string, unknown> | null;
    metadataFilter?: Record<string, unknown> | null;
    score_threshold?: number | null;
    scoreThreshold?: number | null;
    where?: unknown;
    where_document?: unknown;
    whereDocument?: unknown;
    include?: unknown;
  } = {}) {
    this.collection_name = options.collection_name ?? options.collectionName ?? DEFAULT_COLLECTION;
    this.query = options.query ?? "";
    this.limit = options.limit ?? 10;
    this.metadata_filter = options.metadata_filter ?? options.metadataFilter ?? null;
    this.score_threshold = options.score_threshold ?? options.scoreThreshold ?? null;
    this.where = options.where ?? null;
    this.where_document = options.where_document ?? options.whereDocument ?? null;
    this.include = options.include ?? ["documents", "metadatas", "distances"];
  }
}
export const ChromaDBCollectionCreateParams = Object.freeze({ kind: "ChromaDBCollectionCreateParams" });
export const ChromaDBCollectionSearchParams = Object.freeze({ kind: "ChromaDBCollectionSearchParams" });
export type Embeddable = readonly string[] | readonly unknown[];
export const Embeddable = Object.freeze({ kind: "Embeddable" });
export const Documents = Array;
export const Images = Array;
export const PyEmbedding = Array;
export const PyEmbeddings = Array;
export const ScalarType = Object.freeze({ kind: "ScalarType" });
export const NumberType = Object.freeze({ kind: "NumberType" });
export const IntegerType = Object.freeze({ kind: "IntegerType" });
export const FloatingType = Object.freeze({ kind: "FloatingType" });
export const DType32 = Object.freeze({ kind: "DType32" });
export const DType64 = Object.freeze({ kind: "DType64" });
export const DTypeCommon = Object.freeze({ kind: "DTypeCommon" });
export type TypedEmbeddingFunction<TInput = Embeddable> = {
  (input: TInput): Embeddings | Embedding | Promise<Embeddings | Embedding>;
  embedQuery?: (input: TInput) => Embeddings | Embedding | Promise<Embeddings | Embedding>;
  embed_query?: (input: TInput) => Embeddings | Embedding | Promise<Embeddings | Embedding>;
};

export type AllowedEmbeddingProvider =
  | "azure"
  | "amazon-bedrock"
  | "cohere"
  | "custom"
  | "google-generativeai"
  | "google"
  | "google-vertex"
  | "huggingface"
  | "instructor"
  | "jina"
  | "ollama"
  | "onnx"
  | "openai"
  | "openclip"
  | "roboflow"
  | "sentence-transformer"
  | "text2vec"
  | "voyageai"
  | "watsonx";
export const AllowedEmbeddingProviders = Object.freeze([
  "azure",
  "amazon-bedrock",
  "cohere",
  "custom",
  "google-generativeai",
  "google-vertex",
  "huggingface",
  "instructor",
  "jina",
  "ollama",
  "onnx",
  "openai",
  "openclip",
  "roboflow",
  "sentence-transformer",
  "text2vec",
  "voyageai",
  "watsonx",
] as const);

export type BaseProviderSpec<TProvider extends AllowedEmbeddingProvider = AllowedEmbeddingProvider, TConfig extends Record<string, unknown> = Record<string, unknown>> = {
  provider: TProvider;
  config?: TConfig;
};

function providerSpecMarker(name: string): string {
  return name;
}

export type AzureProviderConfig = {
  api_key?: string;
  api_base?: string;
  api_type?: string;
  api_version?: string;
  model_name?: string;
  default_headers?: Record<string, unknown>;
  dimensions?: number;
  deployment_id: string;
  organization_id?: string;
};
export const AzureProviderConfig = Object.freeze({ kind: "AzureProviderConfig" });
export type AzureProviderSpec = BaseProviderSpec<"azure", AzureProviderConfig>;
export const AzureProviderSpec = providerSpecMarker("AzureProviderSpec");

export type BedrockProviderConfig = { model_name?: string; session?: unknown };
export const BedrockProviderConfig = Object.freeze({ kind: "BedrockProviderConfig" });
export type BedrockProviderSpec = BaseProviderSpec<"amazon-bedrock", BedrockProviderConfig>;
export const BedrockProviderSpec = providerSpecMarker("BedrockProviderSpec");
export function create_aws_session(): unknown {
  return {};
}
type BedrockInvokeResult = {
  body?: unknown;
  Body?: unknown;
};
type BedrockRuntimeClient = {
  invokeModel?: (input: Record<string, unknown>) => Promise<BedrockInvokeResult> | BedrockInvokeResult;
  invoke_model?: (input: Record<string, unknown>) => Promise<BedrockInvokeResult> | BedrockInvokeResult;
};
type BedrockSessionLike = BedrockRuntimeClient & {
  client?: (serviceName: string) => BedrockRuntimeClient;
};
export class BedrockProvider {
  readonly provider = "amazon-bedrock";
  readonly model_name: string;
  readonly session: unknown;

  constructor(options: BedrockProviderConfig = {}) {
    this.model_name = options.model_name ?? "amazon.titan-embed-text-v1";
    this.session = options.session ?? create_aws_session();
  }

  build(): TypedEmbeddingFunction {
    const callable: TypedEmbeddingFunction = (input: Embeddable) => this.embed(input);
    callable.embedQuery = callable;
    callable.embed_query = callable;
    return callable;
  }

  private async embed(input: Embeddable): Promise<Embeddings> {
    const values = Array.isArray(input) ? input.map((value) => String(value)) : [String(input)];
    const client = resolveBedrockRuntimeClient(this.session);
    const embeddings: Embedding[] = [];
    for (const value of values) {
      const response = await invokeBedrockModel(client, {
        body: JSON.stringify({ inputText: value }),
        Body: JSON.stringify({ inputText: value }),
        modelId: this.model_name,
        accept: "application/json",
        contentType: "application/json",
      });
      embeddings.push(extractBedrockEmbedding(await readBedrockBody(response.body ?? response.Body)));
    }
    return embeddings;
  }
}

function resolveBedrockRuntimeClient(session: unknown): BedrockRuntimeClient {
  if (isBedrockRuntimeClient(session)) {
    return session;
  }
  if (isRecord(session) && typeof session.client === "function") {
    const client = (session as BedrockSessionLike).client?.("bedrock-runtime");
    if (isBedrockRuntimeClient(client)) {
      return client;
    }
  }
  throw new Error("Amazon Bedrock embeddings require a session with invokeModel or client('bedrock-runtime').");
}

function isBedrockRuntimeClient(value: unknown): value is BedrockRuntimeClient {
  return isRecord(value) && (typeof value.invokeModel === "function" || typeof value.invoke_model === "function");
}

async function invokeBedrockModel(client: BedrockRuntimeClient, input: Record<string, unknown>): Promise<BedrockInvokeResult> {
  if (client.invokeModel) {
    return client.invokeModel(input);
  }
  if (client.invoke_model) {
    return client.invoke_model(input);
  }
  throw new Error("Amazon Bedrock runtime client does not provide invokeModel.");
}

async function readBedrockBody(body: unknown): Promise<unknown> {
  if (typeof body === "string") {
    return JSON.parse(body);
  }
  if (body instanceof Uint8Array) {
    return JSON.parse(new TextDecoder().decode(body));
  }
  if (isRecord(body) && typeof body.transformToString === "function") {
    return JSON.parse(await (body.transformToString as () => Promise<string> | string)());
  }
  if (isRecord(body) && typeof body.text === "function") {
    return JSON.parse(await (body.text as () => Promise<string> | string)());
  }
  if (isRecord(body)) {
    return body;
  }
  throw new Error("Amazon Bedrock response did not include a readable body.");
}

function extractBedrockEmbedding(payload: unknown): Embedding {
  if (isRecord(payload) && isNumberArray(payload.embedding)) {
    return payload.embedding;
  }
  if (isRecord(payload) && isNumberArray(payload.vector)) {
    return payload.vector;
  }
  if (isRecord(payload) && Array.isArray(payload.embeddings) && isNumberArray(payload.embeddings[0])) {
    return payload.embeddings[0];
  }
  throw new Error("Amazon Bedrock embeddings response did not include an embedding.");
}

export type CohereProviderConfig = { api_key?: string; model_name?: string };
export const CohereProviderConfig = Object.freeze({ kind: "CohereProviderConfig" });
export type CohereProviderSpec = BaseProviderSpec<"cohere", CohereProviderConfig>;
export const CohereProviderSpec = providerSpecMarker("CohereProviderSpec");

export type CustomProviderConfig = {
  embeddingCallable?: TypedEmbeddingFunction | null;
  embedding_callable?: TypedEmbeddingFunction | null;
};
export const CustomProviderConfig = Object.freeze({ kind: "CustomProviderConfig" });
export type CustomProviderSpec = BaseProviderSpec<"custom", CustomProviderConfig>;
export const CustomProviderSpec = providerSpecMarker("CustomProviderSpec");

export type GenerativeAiProviderConfig = {
  api_key?: string;
  model_name?: "gemini-embedding-001" | "text-embedding-005" | "text-multilingual-embedding-002";
  task_type?: string;
  api_url?: string;
};
export const GenerativeAiProviderConfig = Object.freeze({ kind: "GenerativeAiProviderConfig" });
export type GenerativeAiProviderSpec = BaseProviderSpec<"google-generativeai", GenerativeAiProviderConfig>;
export const GenerativeAiProviderSpec = providerSpecMarker("GenerativeAiProviderSpec");

export type VertexAIProviderConfig = {
  api_key?: string;
  model_name?: string;
  project_id?: string;
  location?: string;
  region?: string;
  task_type?: string;
  output_dimensionality?: number;
  api_url?: string;
};
export const VertexAIProviderConfig = Object.freeze({ kind: "VertexAIProviderConfig" });
export type VertexAIProviderSpec = BaseProviderSpec<"google-vertex", VertexAIProviderConfig>;
export const VertexAIProviderSpec = providerSpecMarker("VertexAIProviderSpec");

export type HuggingFaceProviderConfig = { api_key?: string; model?: string; model_name?: string; api_url?: string };
export const HuggingFaceProviderConfig = Object.freeze({ kind: "HuggingFaceProviderConfig" });
export type HuggingFaceProviderSpec = BaseProviderSpec<"huggingface", HuggingFaceProviderConfig>;
export const HuggingFaceProviderSpec = providerSpecMarker("HuggingFaceProviderSpec");

export type WatsonXProviderConfig = {
  model_id?: string;
  url?: string;
  params?: Record<string, string | Record<string, string>>;
  credentials?: unknown;
  project_id?: string;
  space_id?: string;
  api_client?: unknown;
  verify?: boolean | string;
  persistent_connection?: boolean;
  batch_size?: number;
  concurrency_limit?: number;
  max_retries?: number;
  delay_time?: number;
  retry_status_codes?: readonly number[];
  api_key?: string;
  [key: string]: unknown;
};
export const WatsonXProviderConfig = Object.freeze({ kind: "WatsonXProviderConfig" });
export type WatsonXProviderSpec = BaseProviderSpec<"watsonx", WatsonXProviderConfig>;
export const WatsonXProviderSpec = providerSpecMarker("WatsonXProviderSpec");

export type LocalEmbeddingRuntime = TypedEmbeddingFunction | Record<string, unknown>;
export type InstructorProviderConfig = {
  model_name?: string;
  model?: string | LocalEmbeddingRuntime;
  device?: string;
  instruction?: string | null;
  embeddingCallable?: TypedEmbeddingFunction;
  embedding_callable?: TypedEmbeddingFunction;
  runtime?: LocalEmbeddingRuntime;
  client?: LocalEmbeddingRuntime;
};
export const InstructorProviderConfig = Object.freeze({ kind: "InstructorProviderConfig" });
export type InstructorProviderSpec = BaseProviderSpec<"instructor", InstructorProviderConfig>;
export const InstructorProviderSpec = providerSpecMarker("InstructorProviderSpec");

export type JinaProviderConfig = { api_key?: string; model_name?: string };
export const JinaProviderConfig = Object.freeze({ kind: "JinaProviderConfig" });
export type JinaProviderSpec = BaseProviderSpec<"jina", JinaProviderConfig>;
export const JinaProviderSpec = providerSpecMarker("JinaProviderSpec");

export type OllamaProviderConfig = { url?: string; model_name?: string; model?: string };
export const OllamaProviderConfig = Object.freeze({ kind: "OllamaProviderConfig" });
export type OllamaProviderSpec = BaseProviderSpec<"ollama", OllamaProviderConfig>;
export const OllamaProviderSpec = providerSpecMarker("OllamaProviderSpec");

export type ONNXProviderConfig = {
  preferred_providers?: readonly string[] | null;
  embeddingCallable?: TypedEmbeddingFunction;
  embedding_callable?: TypedEmbeddingFunction;
  runtime?: LocalEmbeddingRuntime;
  model?: LocalEmbeddingRuntime;
  client?: LocalEmbeddingRuntime;
};
export const ONNXProviderConfig = Object.freeze({ kind: "ONNXProviderConfig" });
export type ONNXProviderSpec = BaseProviderSpec<"onnx", ONNXProviderConfig>;
export const ONNXProviderSpec = providerSpecMarker("ONNXProviderSpec");

export type OpenAIProviderConfig = {
  api_key?: string;
  model_name?: string;
  api_base?: string;
  api_type?: string;
  api_version?: string;
  default_headers?: Record<string, unknown>;
  dimensions?: number;
  deployment_id?: string;
  organization_id?: string;
};
export const OpenAIProviderConfig = Object.freeze({ kind: "OpenAIProviderConfig" });
export type OpenAIProviderSpec = BaseProviderSpec<"openai", OpenAIProviderConfig>;
export const OpenAIProviderSpec = providerSpecMarker("OpenAIProviderSpec");

export type OpenCLIPProviderConfig = {
  model_name?: string;
  model?: string | LocalEmbeddingRuntime;
  checkpoint?: string;
  device?: string;
  embeddingCallable?: TypedEmbeddingFunction;
  embedding_callable?: TypedEmbeddingFunction;
  runtime?: LocalEmbeddingRuntime;
  client?: LocalEmbeddingRuntime;
};
export const OpenCLIPProviderConfig = Object.freeze({ kind: "OpenCLIPProviderConfig" });
export type OpenCLIPProviderSpec = BaseProviderSpec<"openclip", OpenCLIPProviderConfig>;
export const OpenCLIPProviderSpec = providerSpecMarker("OpenCLIPProviderSpec");

export type RoboflowProviderConfig = { api_key?: string; api_url?: string };
export const RoboflowProviderConfig = Object.freeze({ kind: "RoboflowProviderConfig" });
export type RoboflowProviderSpec = BaseProviderSpec<"roboflow", RoboflowProviderConfig>;
export const RoboflowProviderSpec = providerSpecMarker("RoboflowProviderSpec");

export type SentenceTransformerProviderConfig = {
  model_name?: string;
  model?: string | LocalEmbeddingRuntime;
  device?: string;
  normalize_embeddings?: boolean;
  embeddingCallable?: TypedEmbeddingFunction;
  embedding_callable?: TypedEmbeddingFunction;
  runtime?: LocalEmbeddingRuntime;
  client?: LocalEmbeddingRuntime;
};
export const SentenceTransformerProviderConfig = Object.freeze({ kind: "SentenceTransformerProviderConfig" });
export type SentenceTransformerProviderSpec = BaseProviderSpec<"sentence-transformer", SentenceTransformerProviderConfig>;
export const SentenceTransformerProviderSpec = providerSpecMarker("SentenceTransformerProviderSpec");

export type Text2VecProviderConfig = {
  model_name?: string;
  model?: string | LocalEmbeddingRuntime;
  embeddingCallable?: TypedEmbeddingFunction;
  embedding_callable?: TypedEmbeddingFunction;
  runtime?: LocalEmbeddingRuntime;
  client?: LocalEmbeddingRuntime;
};
export const Text2VecProviderConfig = Object.freeze({ kind: "Text2VecProviderConfig" });
export type Text2VecProviderSpec = BaseProviderSpec<"text2vec", Text2VecProviderConfig>;
export const Text2VecProviderSpec = providerSpecMarker("Text2VecProviderSpec");

export type VoyageAIProviderConfig = {
  api_key?: string;
  model?: string;
  input_type?: string;
  truncation?: boolean;
  output_dtype?: string;
  output_dimension?: number;
  max_retries?: number;
  timeout?: number;
  api_url?: string;
};
export const VoyageAIProviderConfig = Object.freeze({ kind: "VoyageAIProviderConfig" });
export type VoyageAIProviderSpec = BaseProviderSpec<"voyageai", VoyageAIProviderConfig>;
export const VoyageAIProviderSpec = providerSpecMarker("VoyageAIProviderSpec");

export type ProviderSpec =
  | AzureProviderSpec
  | BedrockProviderSpec
  | CohereProviderSpec
  | CustomProviderSpec
  | GenerativeAiProviderSpec
  | HuggingFaceProviderSpec
  | InstructorProviderSpec
  | JinaProviderSpec
  | OllamaProviderSpec
  | ONNXProviderSpec
  | OpenAIProviderSpec
  | OpenCLIPProviderSpec
  | RoboflowProviderSpec
  | SentenceTransformerProviderSpec
  | Text2VecProviderSpec
  | VertexAIProviderSpec
  | VoyageAIProviderSpec
  | WatsonXProviderSpec;
export const ProviderSpec = providerSpecMarker("ProviderSpec");

export type EmbedderConfig = ProviderSpec | BaseEmbeddingsProvider | TypedEmbeddingFunction;
export const EmbedderConfig = Object.freeze({ kind: "EmbedderConfig" });

export class BaseEmbeddingsProvider<TEmbeddingFunction extends TypedEmbeddingFunction = TypedEmbeddingFunction> {
  readonly embeddingCallable: TEmbeddingFunction;
  readonly embedding_callable: TEmbeddingFunction;
  readonly config: Record<string, unknown>;
  [key: string]: unknown;

  constructor(options: { embeddingCallable?: TEmbeddingFunction; embedding_callable?: TEmbeddingFunction } & Record<string, unknown>) {
    const embeddingCallable = options.embeddingCallable ?? options.embedding_callable;
    if (!embeddingCallable) {
      throw new Error("BaseEmbeddingsProvider requires embeddingCallable.");
    }
    this.embeddingCallable = embeddingCallable;
    this.embedding_callable = embeddingCallable;
    const { embeddingCallable: _embeddingCallable, embedding_callable: _embedding_callable, ...config } = options;
    void _embeddingCallable;
    void _embedding_callable;
    this.config = config;
    Object.assign(this, config);
  }

  build(): TEmbeddingFunction {
    return this.embeddingCallable;
  }
}

export type BaseEmbeddingsCallable<TInput = Embeddable> = TypedEmbeddingFunction<TInput>;
export const BaseEmbeddingsCallable = Function;

const unimplementedCustomEmbeddingCallable: TypedEmbeddingFunction = (input: Embeddable) => {
  void input;
  throw new Error("Subclasses must implement __call__ method");
};

export class OpenAIEmbeddingFunction {
  readonly api_key: string | null;
  readonly model_name: string;
  readonly api_base: string | null;
  readonly api_type: string | null;
  readonly api_version: string | null;
  readonly default_headers: Record<string, unknown> | null;
  readonly dimensions: number | null;
  readonly deployment_id: string | null;
  readonly organization_id: string | null;

  constructor(options: OpenAIProviderConfig = {}) {
    this.api_key = options.api_key ?? null;
    this.model_name = options.model_name ?? "text-embedding-ada-002";
    this.api_base = options.api_base ?? null;
    this.api_type = options.api_type ?? null;
    this.api_version = options.api_version ?? null;
    this.default_headers = options.default_headers ?? null;
    this.dimensions = options.dimensions ?? null;
    this.deployment_id = options.deployment_id ?? null;
    this.organization_id = options.organization_id ?? null;
  }

  async call(input: Embeddable): Promise<Embeddings> {
    const values = Array.isArray(input) ? input.map((value) => String(value)) : [String(input)];
    const response = await fetch(this.endpointUrl(), {
      method: "POST",
      headers: this.requestHeaders(),
      body: JSON.stringify(this.requestBody(values)),
    });
    if (!response.ok) {
      throw new Error(`OpenAI embeddings request failed with status ${String(response.status)}`);
    }
    return extractOpenAIEmbeddings(await response.json());
  }

  async __call__(input: Embeddable): Promise<Embeddings> {
    return this.call(input);
  }

  asCallable(): TypedEmbeddingFunction {
    const callable: TypedEmbeddingFunction = (input: Embeddable) => this.call(input);
    callable.embedQuery = callable;
    callable.embed_query = callable;
    return callable;
  }

  private isAzure(): boolean {
    return this.api_type === "azure" || Boolean(this.deployment_id);
  }

  private endpointUrl(): string {
    if (this.isAzure()) {
      const base = trimTrailingSlash(this.api_base ?? "");
      const deployment = encodeURIComponent(this.deployment_id ?? this.model_name);
      const version = encodeURIComponent(this.api_version ?? "2024-02-01");
      return `${base}/openai/deployments/${deployment}/embeddings?api-version=${version}`;
    }
    return `${trimTrailingSlash(this.api_base ?? "https://api.openai.com/v1")}/embeddings`;
  }

  private requestHeaders(): Record<string, string> {
    const headers = normalizeStringHeaders(this.default_headers);
    headers["content-type"] = headers["content-type"] ?? "application/json";
    if (this.isAzure()) {
      if (this.api_key) {
        headers["api-key"] = this.api_key;
      }
      return headers;
    }
    if (this.api_key) {
      headers.authorization = `Bearer ${this.api_key}`;
    }
    if (this.organization_id) {
      headers["openai-organization"] = this.organization_id;
    }
    return headers;
  }

  private requestBody(input: readonly string[]): Record<string, unknown> {
    const body: Record<string, unknown> = {
      input,
      model: this.model_name,
    };
    if (typeof this.dimensions === "number") {
      body.dimensions = this.dimensions;
    }
    return body;
  }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeStringHeaders(headers: Record<string, unknown> | null): Record<string, string> {
  const normalized: Record<string, string> = {};
  if (!headers) {
    return normalized;
  }
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") {
      normalized[key.toLowerCase()] = value;
    }
  }
  return normalized;
}

function extractOpenAIEmbeddings(payload: unknown): Embeddings {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new Error("OpenAI embeddings response did not include data.");
  }
  const data = payload.data
    .filter(isRecord)
    .map((item, position) => ({
      index: typeof item.index === "number" ? item.index : position,
      embedding: item.embedding,
    }))
    .sort((left, right) => left.index - right.index);
  const embeddings: Embedding[] = [];
  for (const item of data) {
    if (!isNumberArray(item.embedding)) {
      throw new Error("OpenAI embeddings response did not include embeddings.");
    }
    embeddings.push(item.embedding);
  }
  if (embeddings.length === 0) {
    throw new Error("OpenAI embeddings response did not include embeddings.");
  }
  return embeddings;
}

export class AzureProvider extends BaseEmbeddingsProvider {
  readonly provider = "azure";

  constructor(options: AzureProviderConfig = { deployment_id: "" }) {
    const config = {
      api_type: "azure",
      api_version: "2024-02-01",
      model_name: "text-embedding-ada-002",
      ...options,
    };
    super({
      embeddingCallable: new OpenAIEmbeddingFunction(config).asCallable(),
      ...config,
    });
  }
}

export class CohereEmbeddingFunction {
  readonly api_key: string | null;
  readonly model_name: string;
  readonly api_url: string;

  constructor(options: CohereProviderConfig & { api_url?: string } = {}) {
    this.api_key = options.api_key ?? null;
    this.model_name = options.model_name ?? "large";
    this.api_url = options.api_url ?? "https://api.cohere.ai/v1/embed";
  }

  async call(input: Embeddable): Promise<Embeddings> {
    const values = Array.isArray(input) ? input.map((value) => String(value)) : [String(input)];
    const response = await fetch(this.api_url, {
      method: "POST",
      headers: this.requestHeaders(),
      body: JSON.stringify({
        texts: values,
        model: this.model_name,
      }),
    });
    if (!response.ok) {
      throw new Error(`Cohere embeddings request failed with status ${String(response.status)}`);
    }
    return extractCohereEmbeddings(await response.json());
  }

  async __call__(input: Embeddable): Promise<Embeddings> {
    return this.call(input);
  }

  asCallable(): TypedEmbeddingFunction {
    const callable: TypedEmbeddingFunction = (input: Embeddable) => this.call(input);
    callable.embedQuery = callable;
    callable.embed_query = callable;
    return callable;
  }

  private requestHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (this.api_key) {
      headers.authorization = `Bearer ${this.api_key}`;
    }
    return headers;
  }
}

function extractCohereEmbeddings(payload: unknown): Embeddings {
  if (!isRecord(payload) || !Array.isArray(payload.embeddings)) {
    throw new Error("Cohere embeddings response did not include embeddings.");
  }
  if (!payload.embeddings.every(isNumberArray)) {
    throw new Error("Cohere embeddings response did not include numeric embeddings.");
  }
  return payload.embeddings;
}

export class CohereProvider extends BaseEmbeddingsProvider {
  readonly provider = "cohere";

  constructor(options: CohereProviderConfig = {}) {
    const config = {
      model_name: "large",
      ...options,
    };
    super({
      embeddingCallable: new CohereEmbeddingFunction(config).asCallable(),
      ...config,
    });
  }
}

export class CustomEmbeddingFunction {
  constructor(readonly embeddingCallable: TypedEmbeddingFunction = unimplementedCustomEmbeddingCallable) {}

  call(input: Embeddable): unknown {
    return this.embeddingCallable(input);
  }

  __call__(input: Embeddable): unknown {
    return this.call(input);
  }
}

export class CustomProvider extends BaseEmbeddingsProvider {
  readonly provider = "custom";

  constructor(options: CustomProviderConfig = {}) {
    const { embeddingCallable, embedding_callable: embeddingCallableSnake, ...config } = options;
    const callable = embeddingCallable ?? embeddingCallableSnake;
    super({ ...config, ...(callable ? { embeddingCallable: callable } : {}) });
  }
}

export class GoogleGenAIVertexEmbeddingFunction {
  static readonly LEGACY_MODELS = new Set([
    "textembedding-gecko",
    "textembedding-gecko@001",
    "textembedding-gecko@002",
    "textembedding-gecko@003",
    "textembedding-gecko@latest",
    "textembedding-gecko-multilingual",
    "textembedding-gecko-multilingual@001",
    "textembedding-gecko-multilingual@latest",
  ]);

  readonly api_key: string | null;
  readonly model_name: string;
  readonly project_id: string | null;
  readonly location: string;
  readonly task_type: string;
  readonly output_dimensionality: number | null;
  readonly api_url: string | null;

  constructor(options: VertexAIProviderConfig = {}) {
    this.api_key = options.api_key ?? null;
    this.model_name = options.model_name ?? "textembedding-gecko";
    this.project_id = options.project_id ?? null;
    this.location = options.location ?? options.region ?? "us-central1";
    this.task_type = options.task_type ?? "RETRIEVAL_DOCUMENT";
    this.output_dimensionality = options.output_dimensionality ?? null;
    this.api_url = options.api_url ?? null;
  }

  static name(): string {
    return "google-vertex";
  }

  async call(input: Embeddable): Promise<Embeddings> {
    if (this.isLegacyModel()) {
      throw new Error("Google Vertex legacy textembedding-gecko models require Vertex AI SDK credentials.");
    }
    const values = Array.isArray(input) ? input.map((value) => String(value)) : [String(input)];
    const response = await fetch(this.endpointUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requests: values.map((text) => ({
          model: `models/${this.model_name}`,
          content: { parts: [{ text }] },
          taskType: this.task_type,
          ...(typeof this.output_dimensionality === "number"
            ? { outputDimensionality: this.output_dimensionality }
            : {}),
        })),
      }),
    });
    if (!response.ok) {
      throw new Error(`Google Vertex embeddings request failed with status ${String(response.status)}`);
    }
    return extractGoogleGenerativeAiEmbeddings(await response.json());
  }

  async __call__(input: Embeddable): Promise<Embeddings> {
    return this.call(input);
  }

  asCallable(): TypedEmbeddingFunction {
    const callable: TypedEmbeddingFunction = (input: Embeddable) => this.call(input);
    callable.embedQuery = callable;
    callable.embed_query = callable;
    return callable;
  }

  private isLegacyModel(): boolean {
    return GoogleGenAIVertexEmbeddingFunction.LEGACY_MODELS.has(this.model_name) || this.model_name.startsWith("textembedding-gecko");
  }

  private endpointUrl(): string {
    if (this.api_url) {
      return appendGoogleApiKey(this.api_url, this.api_key);
    }
    const model = encodeURIComponent(this.model_name);
    return appendGoogleApiKey(`https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents`, this.api_key);
  }
}

export class GoogleGenerativeAiEmbeddingFunction {
  readonly api_key: string | null;
  readonly model_name: string;
  readonly task_type: string;
  readonly api_url: string | null;

  constructor(options: GenerativeAiProviderConfig = {}) {
    this.api_key = options.api_key ?? null;
    this.model_name = options.model_name ?? "gemini-embedding-001";
    this.task_type = options.task_type ?? "RETRIEVAL_DOCUMENT";
    this.api_url = options.api_url ?? null;
  }

  static name(): string {
    return "google-generativeai";
  }

  async call(input: Embeddable): Promise<Embeddings> {
    const values = Array.isArray(input) ? input.map((value) => String(value)) : [String(input)];
    const response = await fetch(this.endpointUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requests: values.map((text) => ({
          model: `models/${this.model_name}`,
          content: { parts: [{ text }] },
          taskType: this.task_type,
        })),
      }),
    });
    if (!response.ok) {
      throw new Error(`Google Generative AI embeddings request failed with status ${String(response.status)}`);
    }
    return extractGoogleGenerativeAiEmbeddings(await response.json());
  }

  async __call__(input: Embeddable): Promise<Embeddings> {
    return this.call(input);
  }

  asCallable(): TypedEmbeddingFunction {
    const callable: TypedEmbeddingFunction = (input: Embeddable) => this.call(input);
    callable.embedQuery = callable;
    callable.embed_query = callable;
    return callable;
  }

  private endpointUrl(): string {
    if (this.api_url) {
      return appendGoogleApiKey(this.api_url, this.api_key);
    }
    const model = encodeURIComponent(this.model_name);
    return appendGoogleApiKey(`https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents`, this.api_key);
  }
}

function appendGoogleApiKey(url: string, apiKey: string | null): string {
  if (!apiKey) {
    return url;
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}key=${encodeURIComponent(apiKey)}`;
}

function extractGoogleGenerativeAiEmbeddings(payload: unknown): Embeddings {
  if (!isRecord(payload) || !Array.isArray(payload.embeddings)) {
    throw new Error("Google Generative AI embeddings response did not include embeddings.");
  }
  const embeddings: Embedding[] = [];
  for (const item of payload.embeddings) {
    if (!isRecord(item) || !isNumberArray(item.values)) {
      throw new Error("Google Generative AI embeddings response did not include numeric values.");
    }
    embeddings.push(item.values);
  }
  return embeddings;
}

export class GenerativeAiProvider extends BaseEmbeddingsProvider {
  readonly provider = "google-generativeai";

  constructor(options: GenerativeAiProviderConfig = {}) {
    const config = {
      model_name: "gemini-embedding-001" as const,
      task_type: "RETRIEVAL_DOCUMENT",
      ...options,
    };
    super({
      embeddingCallable: new GoogleGenerativeAiEmbeddingFunction(config).asCallable(),
      ...config,
    });
  }
}

export class VertexAIProvider extends BaseEmbeddingsProvider {
  readonly provider = "google-vertex";

  constructor(options: VertexAIProviderConfig = {}) {
    const config = {
      model_name: "textembedding-gecko",
      location: "us-central1",
      task_type: "RETRIEVAL_DOCUMENT",
      ...options,
    };
    super({
      embeddingCallable: new GoogleGenAIVertexEmbeddingFunction(config).asCallable(),
      ...config,
    });
  }
}

export class HuggingFaceEmbeddingFunction {
  readonly api_key: string | null;
  readonly model_name: string;
  readonly api_url: string;

  constructor(options: HuggingFaceProviderConfig = {}) {
    this.api_key = options.api_key ?? null;
    this.model_name = options.model_name ?? options.model ?? "sentence-transformers/all-MiniLM-L6-v2";
    this.api_url = options.api_url ?? `https://api-inference.huggingface.co/pipeline/feature-extraction/${encodeModelPath(this.model_name)}`;
  }

  async call(input: Embeddable): Promise<Embeddings> {
    const values = Array.isArray(input) ? input.map((value) => String(value)) : [String(input)];
    const response = await fetch(this.api_url, {
      method: "POST",
      headers: this.requestHeaders(),
      body: JSON.stringify({
        inputs: values,
        options: { wait_for_model: true },
      }),
    });
    if (!response.ok) {
      throw new Error(`HuggingFace embeddings request failed with status ${String(response.status)}`);
    }
    return extractHuggingFaceEmbeddings(await response.json(), values.length);
  }

  async __call__(input: Embeddable): Promise<Embeddings> {
    return this.call(input);
  }

  asCallable(): TypedEmbeddingFunction {
    const callable: TypedEmbeddingFunction = (input: Embeddable) => this.call(input);
    callable.embedQuery = callable;
    callable.embed_query = callable;
    return callable;
  }

  private requestHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (this.api_key) {
      headers.authorization = `Bearer ${this.api_key}`;
    }
    return headers;
  }
}

function encodeModelPath(modelName: string): string {
  return modelName.split("/").map((part) => encodeURIComponent(part)).join("/");
}

function extractHuggingFaceEmbeddings(payload: unknown, expectedCount: number): Embeddings {
  const value = isRecord(payload) && "embeddings" in payload ? payload.embeddings : payload;
  if (isNumberArray(value)) {
    return [value];
  }
  if (!Array.isArray(value)) {
    throw new Error("HuggingFace embeddings response did not include embeddings.");
  }
  if (value.every(isNumberArray)) {
    return value;
  }
  if (value.length === expectedCount && value.every(isMatrixOfNumbers)) {
    return value.map(meanEmbedding);
  }
  if (expectedCount === 1 && isMatrixOfNumbers(value)) {
    return [meanEmbedding(value)];
  }
  throw new Error("HuggingFace embeddings response did not include numeric embeddings.");
}

function isMatrixOfNumbers(value: unknown): value is number[][] {
  return Array.isArray(value) && value.every(isNumberArray);
}

function meanEmbedding(matrix: number[][]): Embedding {
  if (matrix.length === 0) {
    return [];
  }
  const width = matrix[0]?.length ?? 0;
  const totals = Array.from({ length: width }, () => 0);
  for (const row of matrix) {
    for (let index = 0; index < width; index += 1) {
      totals[index] = (totals[index] ?? 0) + (row[index] ?? 0);
    }
  }
  return totals.map((value) => value / matrix.length);
}

export class HuggingFaceProvider extends BaseEmbeddingsProvider {
  readonly provider = "huggingface";

  constructor(options: HuggingFaceProviderConfig = {}) {
    const config = {
      model_name: "sentence-transformers/all-MiniLM-L6-v2",
      ...options,
    };
    super({
      embeddingCallable: new HuggingFaceEmbeddingFunction(config).asCallable(),
      ...config,
    });
  }
}

export class WatsonXEmbeddingFunction {
  readonly config: Record<string, unknown>;

  constructor(options: Record<string, unknown> = {}) {
    this.config = options;
  }

  static name(): string {
    return "watsonx";
  }

  async call(input: Embeddable): Promise<Embeddings> {
    const values = Array.isArray(input) ? input.map((value) => String(value)) : [String(input)];
    const client = resolveWatsonXEmbeddingClient(this.config);
    const result = await invokeWatsonXEmbeddings(client, values, this.buildRequest(values));
    return extractWatsonXEmbeddings(result);
  }

  async __call__(input: Embeddable): Promise<Embeddings> {
    return this.call(input);
  }

  asCallable(): TypedEmbeddingFunction {
    const callable: TypedEmbeddingFunction = (input: Embeddable) => this.call(input);
    callable.embedQuery = callable;
    callable.embed_query = callable;
    return callable;
  }

  private buildRequest(input: readonly string[]): Record<string, unknown> {
    const request: Record<string, unknown> = {
      inputs: input,
      model_id: this.config.model_id,
      params: this.config.params ?? {
        truncate_input_tokens: 3,
        return_options: { input_text: true },
      },
    };
    if (this.config.project_id) {
      request.project_id = this.config.project_id;
    }
    if (this.config.space_id) {
      request.space_id = this.config.space_id;
    }
    return request;
  }
}

type WatsonXEmbeddingClient = {
  embed_documents?: (input: readonly string[]) => unknown;
  embedDocuments?: (input: readonly string[]) => unknown;
  embed_documents_with_params?: (input: Record<string, unknown>) => unknown;
  embedDocumentsWithParams?: (input: Record<string, unknown>) => unknown;
  embed?: (input: Record<string, unknown> | readonly string[]) => unknown;
};

function resolveWatsonXEmbeddingClient(config: Record<string, unknown>): WatsonXEmbeddingClient {
  const candidates = [config.api_client, config.credentials];
  for (const candidate of candidates) {
    if (isWatsonXEmbeddingClient(candidate)) {
      return candidate;
    }
  }
  throw new Error("WatsonX embeddings require an api_client or credentials object with an embedding method.");
}

function isWatsonXEmbeddingClient(value: unknown): value is WatsonXEmbeddingClient {
  return isRecord(value)
    && (
      typeof value.embed_documents === "function"
      || typeof value.embedDocuments === "function"
      || typeof value.embed_documents_with_params === "function"
      || typeof value.embedDocumentsWithParams === "function"
      || typeof value.embed === "function"
    );
}

function invokeWatsonXEmbeddings(
  client: WatsonXEmbeddingClient,
  input: readonly string[],
  request: Record<string, unknown>,
): Promise<unknown> {
  if (client.embed_documents) {
    return Promise.resolve(client.embed_documents(input));
  }
  if (client.embedDocuments) {
    return Promise.resolve(client.embedDocuments(input));
  }
  if (client.embed_documents_with_params) {
    return Promise.resolve(client.embed_documents_with_params(request));
  }
  if (client.embedDocumentsWithParams) {
    return Promise.resolve(client.embedDocumentsWithParams(request));
  }
  if (client.embed) {
    return Promise.resolve(client.embed(request));
  }
  throw new Error("WatsonX embedding client does not provide an embedding method.");
}

function extractWatsonXEmbeddings(payload: unknown): Embeddings {
  if (Array.isArray(payload) && payload.every(isNumberArray)) {
    return payload;
  }
  if (isRecord(payload) && Array.isArray(payload.embeddings) && payload.embeddings.every(isNumberArray)) {
    return payload.embeddings;
  }
  if (isRecord(payload) && Array.isArray(payload.results)) {
    const embeddings = payload.results
      .filter(isRecord)
      .map((result) => result.embedding);
    if (embeddings.length > 0 && embeddings.every(isNumberArray)) {
      return embeddings;
    }
  }
  throw new Error("WatsonX embeddings response did not include embeddings.");
}

export class WatsonXProvider extends BaseEmbeddingsProvider {
  readonly provider = "watsonx";

  constructor(options: WatsonXProviderConfig = {}) {
    const config = {
      persistent_connection: true,
      batch_size: 100,
      concurrency_limit: 10,
      params: null,
      credentials: null,
      project_id: null,
      space_id: null,
      api_client: null,
      verify: null,
      max_retries: null,
      delay_time: null,
      retry_status_codes: null,
      ...options,
    };
    super({
      embeddingCallable: new WatsonXEmbeddingFunction(config).asCallable(),
      ...config,
    });
  }

  validateSpaceOrProject(): this {
    if (!this.config.space_id && !this.config.project_id) {
      throw new Error("One of 'space_id' or 'project_id' must be provided");
    }
    return this;
  }

  validate_space_or_project(): this {
    return this.validateSpaceOrProject();
  }
}

type LocalEmbeddingInputMapper = (values: readonly string[]) => unknown;

class RuntimeEmbeddingFunction {
  readonly providerName: string;
  readonly runtime: LocalEmbeddingRuntime | null;
  readonly mapInput: LocalEmbeddingInputMapper;

  constructor(options: {
    providerName: string;
    runtime?: LocalEmbeddingRuntime | null;
    mapInput?: LocalEmbeddingInputMapper;
  }) {
    this.providerName = options.providerName;
    this.runtime = options.runtime ?? null;
    this.mapInput = options.mapInput ?? ((values) => values);
  }

  async call(input: Embeddable): Promise<Embeddings> {
    const values = Array.isArray(input) ? input.map((value) => String(value)) : [String(input)];
    if (!this.runtime) {
      throw new Error(`${this.providerName} embedding runtime was not provided.`);
    }
    const result = await invokeLocalEmbeddingRuntime(this.runtime, this.mapInput(values), this.providerName);
    return extractLocalRuntimeEmbeddings(result, this.providerName);
  }

  async __call__(input: Embeddable): Promise<Embeddings> {
    return this.call(input);
  }

  asCallable(): TypedEmbeddingFunction {
    const callable: TypedEmbeddingFunction = (input: Embeddable) => this.call(input);
    callable.embedQuery = callable;
    callable.embed_query = callable;
    return callable;
  }
}

function localEmbeddingRuntimeFrom(options: {
  embeddingCallable?: TypedEmbeddingFunction;
  embedding_callable?: TypedEmbeddingFunction;
  runtime?: LocalEmbeddingRuntime;
  model?: string | LocalEmbeddingRuntime;
  client?: LocalEmbeddingRuntime;
}): LocalEmbeddingRuntime | null {
  if (options.embeddingCallable) {
    return options.embeddingCallable;
  }
  if (options.embedding_callable) {
    return options.embedding_callable;
  }
  if (options.runtime) {
    return options.runtime;
  }
  if (isLocalEmbeddingRuntime(options.model)) {
    return options.model;
  }
  if (options.client) {
    return options.client;
  }
  return null;
}

function isLocalEmbeddingRuntime(value: unknown): value is LocalEmbeddingRuntime {
  return typeof value === "function" || isRecord(value);
}

async function invokeLocalEmbeddingRuntime(
  runtime: LocalEmbeddingRuntime,
  input: unknown,
  providerName: string,
): Promise<unknown> {
  if (typeof runtime === "function") {
    return await (runtime as (value: unknown) => unknown)(input);
  }
  for (const method of ["embedDocuments", "embed_documents", "encode", "embed", "__call__", "call"]) {
    const candidate = runtime[method];
    if (typeof candidate === "function") {
      return await candidate.call(runtime, input);
    }
  }
  throw new Error(`${providerName} embedding runtime does not expose an embedding method.`);
}

function extractLocalRuntimeEmbeddings(payload: unknown, providerName: string): Embeddings {
  if (isNumberArray(payload)) {
    return [payload];
  }
  if (Array.isArray(payload) && payload.every(isNumberArray)) {
    return payload;
  }
  if (isRecord(payload) && isNumberArray(payload.embedding)) {
    return [payload.embedding];
  }
  if (isRecord(payload) && Array.isArray(payload.embeddings) && payload.embeddings.every(isNumberArray)) {
    return payload.embeddings;
  }
  if (isRecord(payload) && isNumberArray(payload.vector)) {
    return [payload.vector];
  }
  if (isRecord(payload) && Array.isArray(payload.data)) {
    const embeddings = payload.data
      .filter(isRecord)
      .map((item) => item.embedding)
      .filter(isNumberArray);
    if (embeddings.length > 0) {
      return embeddings;
    }
  }
  throw new Error(`${providerName} embedding runtime did not return embeddings.`);
}

export class InstructorEmbeddingFunction extends RuntimeEmbeddingFunction {
  readonly model_name: string;
  readonly device: string;
  readonly instruction: string | null;

  constructor(options: InstructorProviderConfig = {}) {
    const instruction = options.instruction ?? null;
    super({
      providerName: "Instructor",
      runtime: localEmbeddingRuntimeFrom(options),
      mapInput: (values) => instruction ? values.map((value) => [instruction, value]) : values,
    });
    this.model_name = typeof options.model === "string" ? options.model : options.model_name ?? "hkunlp/instructor-base";
    this.device = options.device ?? "cpu";
    this.instruction = instruction;
  }

  static name(): string {
    return "instructor";
  }
}

export class InstructorProvider extends BaseEmbeddingsProvider {
  readonly provider = "instructor";

  constructor(options: InstructorProviderConfig = {}) {
    const config = {
      model_name: typeof options.model === "string" ? options.model : "hkunlp/instructor-base",
      device: "cpu",
      instruction: null,
      ...options,
    };
    super({
      embeddingCallable: new InstructorEmbeddingFunction(config).asCallable(),
      ...config,
    });
  }
}

export class JinaEmbeddingFunction {
  readonly api_key: string | null;
  readonly model_name: string;
  readonly api_url: string;

  constructor(options: JinaProviderConfig & { api_url?: string } = {}) {
    this.api_key = options.api_key ?? null;
    this.model_name = options.model_name ?? "jina-embeddings-v2-base-en";
    this.api_url = options.api_url ?? "https://api.jina.ai/v1/embeddings";
  }

  async call(input: Embeddable): Promise<Embeddings> {
    const values = Array.isArray(input) ? input.map((value) => String(value)) : [String(input)];
    const response = await fetch(this.api_url, {
      method: "POST",
      headers: this.requestHeaders(),
      body: JSON.stringify({
        input: values,
        model: this.model_name,
      }),
    });
    if (!response.ok) {
      throw new Error(`Jina embeddings request failed with status ${String(response.status)}`);
    }
    return extractOpenAIEmbeddings(await response.json());
  }

  async __call__(input: Embeddable): Promise<Embeddings> {
    return this.call(input);
  }

  asCallable(): TypedEmbeddingFunction {
    const callable: TypedEmbeddingFunction = (input: Embeddable) => this.call(input);
    callable.embedQuery = callable;
    callable.embed_query = callable;
    return callable;
  }

  private requestHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (this.api_key) {
      headers.authorization = `Bearer ${this.api_key}`;
    }
    return headers;
  }
}

export class JinaProvider extends BaseEmbeddingsProvider {
  readonly provider = "jina";

  constructor(options: JinaProviderConfig = {}) {
    const config = {
      model_name: "jina-embeddings-v2-base-en",
      ...options,
    };
    super({
      embeddingCallable: new JinaEmbeddingFunction(config).asCallable(),
      ...config,
    });
  }
}

export class OllamaEmbeddingFunction {
  readonly url: string;
  readonly model_name: string;

  constructor(options: OllamaProviderConfig & { url: string; model_name: string }) {
    this.url = options.url;
    this.model_name = options.model_name;
  }

  async call(input: Embeddable): Promise<Embeddings> {
    const values = Array.isArray(input) ? input : [input];
    const embeddings: Embedding[] = [];
    for (const value of values) {
      embeddings.push(await this.embedSingle(String(value)));
    }
    return embeddings;
  }

  async __call__(input: Embeddable): Promise<Embeddings> {
    return this.call(input);
  }

  asCallable(): TypedEmbeddingFunction {
    const callable: TypedEmbeddingFunction = (input: Embeddable) => this.call(input);
    callable.embedQuery = callable;
    callable.embed_query = callable;
    return callable;
  }

  private async embedSingle(prompt: string): Promise<Embedding> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: this.model_name, prompt }),
    });
    if (!response.ok) {
      throw new Error(`Ollama embeddings request failed with status ${String(response.status)}`);
    }
    return extractOllamaEmbedding(await response.json());
  }
}

function extractOllamaEmbedding(payload: unknown): Embedding {
  if (isRecord(payload) && isNumberArray(payload.embedding)) {
    return payload.embedding;
  }
  if (isRecord(payload) && Array.isArray(payload.embeddings) && isNumberArray(payload.embeddings[0])) {
    return payload.embeddings[0];
  }
  throw new Error("Ollama embeddings response did not include an embedding.");
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}

export class OllamaProvider extends BaseEmbeddingsProvider {
  readonly provider = "ollama";

  constructor(options: OllamaProviderConfig = {}) {
    const url = options.url ?? "http://localhost:11434/api/embeddings";
    const modelName = options.model_name ?? options.model ?? "";
    super({
      embeddingCallable: new OllamaEmbeddingFunction({ ...options, url, model_name: modelName }).asCallable(),
      url,
      model_name: modelName,
      ...options,
    });
  }
}

export class ONNXMiniLM_L6_V2 extends RuntimeEmbeddingFunction {
  readonly preferred_providers: readonly string[] | null;

  constructor(options: ONNXProviderConfig = {}) {
    super({
      providerName: "ONNX MiniLM",
      runtime: localEmbeddingRuntimeFrom(options),
    });
    this.preferred_providers = options.preferred_providers ?? null;
  }

  static name(): string {
    return "onnx";
  }
}

export class ONNXProvider extends BaseEmbeddingsProvider {
  readonly provider = "onnx";

  constructor(options: ONNXProviderConfig = {}) {
    const config = {
      preferred_providers: null,
      ...options,
    };
    super({
      embeddingCallable: new ONNXMiniLM_L6_V2(config).asCallable(),
      ...config,
    });
  }
}

export class OpenAIProvider extends BaseEmbeddingsProvider {
  readonly provider = "openai";

  constructor(options: OpenAIProviderConfig = {}) {
    const config = {
      model_name: "text-embedding-ada-002",
      ...options,
    };
    super({
      embeddingCallable: new OpenAIEmbeddingFunction(config).asCallable(),
      ...config,
    });
  }
}

export class OpenCLIPEmbeddingFunction extends RuntimeEmbeddingFunction {
  readonly model_name: string;
  readonly checkpoint: string;
  readonly device: string | null;

  constructor(options: OpenCLIPProviderConfig = {}) {
    super({
      providerName: "OpenCLIP",
      runtime: localEmbeddingRuntimeFrom(options),
    });
    this.model_name = typeof options.model === "string" ? options.model : options.model_name ?? "ViT-B-32";
    this.checkpoint = options.checkpoint ?? "laion2b_s34b_b79k";
    this.device = options.device ?? "cpu";
  }

  static name(): string {
    return "openclip";
  }
}

export class OpenCLIPProvider extends BaseEmbeddingsProvider {
  readonly provider = "openclip";

  constructor(options: OpenCLIPProviderConfig = {}) {
    const config = {
      model_name: typeof options.model === "string" ? options.model : "ViT-B-32",
      checkpoint: "laion2b_s34b_b79k",
      device: "cpu",
      ...options,
    };
    super({
      embeddingCallable: new OpenCLIPEmbeddingFunction(config).asCallable(),
      ...config,
    });
  }
}

export class RoboflowEmbeddingFunction {
  readonly api_key: string | null;
  readonly api_url: string;

  constructor(options: RoboflowProviderConfig = {}) {
    this.api_key = options.api_key ?? null;
    this.api_url = options.api_url ?? "https://infer.roboflow.com";
  }

  static name(): string {
    return "roboflow";
  }

  async call(input: Embeddable): Promise<Embeddings> {
    const values = Array.isArray(input) ? input.map((value) => String(value)) : [String(input)];
    const response = await fetch(this.endpointUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: values.length === 1 ? values[0] : values }),
    });
    if (!response.ok) {
      throw new Error(`Roboflow CLIP text embedding request failed with status ${String(response.status)}`);
    }
    return extractRoboflowEmbeddings(await response.json());
  }

  async __call__(input: Embeddable): Promise<Embeddings> {
    return this.call(input);
  }

  asCallable(): TypedEmbeddingFunction {
    const callable: TypedEmbeddingFunction = (input: Embeddable) => this.call(input);
    callable.embedQuery = callable;
    callable.embed_query = callable;
    return callable;
  }

  private endpointUrl(): string {
    const base = `${trimTrailingSlash(this.api_url)}/clip/embed_text`;
    if (!this.api_key) {
      return base;
    }
    return `${base}?api_key=${encodeURIComponent(this.api_key)}`;
  }
}

function extractRoboflowEmbeddings(payload: unknown): Embeddings {
  const value = isRecord(payload) && "embeddings" in payload ? payload.embeddings : payload;
  if (isNumberArray(value)) {
    return [value];
  }
  if (Array.isArray(value) && value.every(isNumberArray)) {
    return value;
  }
  if (isRecord(payload) && isNumberArray(payload.embedding)) {
    return [payload.embedding];
  }
  if (isRecord(payload) && isNumberArray(payload.vector)) {
    return [payload.vector];
  }
  if (isRecord(payload) && Array.isArray(payload.data)) {
    const embeddings = payload.data
      .filter(isRecord)
      .map((item) => item.embedding)
      .filter(isNumberArray);
    if (embeddings.length > 0) {
      return embeddings;
    }
  }
  throw new Error("Roboflow CLIP text embedding response did not include embeddings.");
}

export class RoboflowProvider extends BaseEmbeddingsProvider {
  readonly provider = "roboflow";

  constructor(options: RoboflowProviderConfig = {}) {
    const config = {
      api_key: "",
      api_url: "https://infer.roboflow.com",
      ...options,
    };
    super({
      embeddingCallable: new RoboflowEmbeddingFunction(config).asCallable(),
      ...config,
    });
  }
}

export class SentenceTransformerEmbeddingFunction extends RuntimeEmbeddingFunction {
  readonly model_name: string;
  readonly device: string;
  readonly normalize_embeddings: boolean;

  constructor(options: SentenceTransformerProviderConfig = {}) {
    super({
      providerName: "SentenceTransformer",
      runtime: localEmbeddingRuntimeFrom(options),
    });
    this.model_name = typeof options.model === "string" ? options.model : options.model_name ?? "all-MiniLM-L6-v2";
    this.device = options.device ?? "cpu";
    this.normalize_embeddings = options.normalize_embeddings ?? false;
  }

  static name(): string {
    return "sentence-transformer";
  }
}

export class SentenceTransformerProvider extends BaseEmbeddingsProvider {
  readonly provider = "sentence-transformer";

  constructor(options: SentenceTransformerProviderConfig = {}) {
    const config = {
      model_name: typeof options.model === "string" ? options.model : "all-MiniLM-L6-v2",
      device: "cpu",
      normalize_embeddings: false,
      ...options,
    };
    super({
      embeddingCallable: new SentenceTransformerEmbeddingFunction(config).asCallable(),
      ...config,
    });
  }
}

export class Text2VecEmbeddingFunction extends RuntimeEmbeddingFunction {
  readonly model_name: string;

  constructor(options: Text2VecProviderConfig = {}) {
    super({
      providerName: "Text2Vec",
      runtime: localEmbeddingRuntimeFrom(options),
    });
    this.model_name = typeof options.model === "string" ? options.model : options.model_name ?? "shibing624/text2vec-base-chinese";
  }

  static name(): string {
    return "text2vec";
  }
}

export class Text2VecProvider extends BaseEmbeddingsProvider {
  readonly provider = "text2vec";

  constructor(options: Text2VecProviderConfig = {}) {
    const config = {
      model_name: typeof options.model === "string" ? options.model : "shibing624/text2vec-base-chinese",
      ...options,
    };
    super({
      embeddingCallable: new Text2VecEmbeddingFunction(config).asCallable(),
      ...config,
    });
  }
}

export class VoyageAIEmbeddingFunction {
  readonly api_key: string | null;
  readonly model: string;
  readonly input_type: string | null;
  readonly truncation: boolean;
  readonly output_dtype: string | null;
  readonly output_dimension: number | null;
  readonly max_retries: number;
  readonly timeout: number | null;
  readonly api_url: string;

  constructor(options: VoyageAIProviderConfig & { api_url?: string } = {}) {
    this.api_key = options.api_key ?? null;
    this.model = options.model ?? "voyage-2";
    this.input_type = options.input_type ?? null;
    this.truncation = options.truncation ?? true;
    this.output_dtype = options.output_dtype ?? null;
    this.output_dimension = options.output_dimension ?? null;
    this.max_retries = options.max_retries ?? 0;
    this.timeout = options.timeout ?? null;
    this.api_url = options.api_url ?? "https://api.voyageai.com/v1/embeddings";
  }

  static name(): string {
    return "voyageai";
  }

  async call(input: Embeddable): Promise<Embeddings> {
    const values = Array.isArray(input) ? input.map((value) => String(value)) : [String(input)];
    const response = await fetch(this.api_url, {
      method: "POST",
      headers: this.requestHeaders(),
      body: JSON.stringify(this.requestBody(values)),
    });
    if (!response.ok) {
      throw new Error(`VoyageAI embeddings request failed with status ${String(response.status)}`);
    }
    return extractVoyageAIEmbeddings(await response.json());
  }

  async __call__(input: Embeddable): Promise<Embeddings> {
    return this.call(input);
  }

  asCallable(): TypedEmbeddingFunction {
    const callable: TypedEmbeddingFunction = (input: Embeddable) => this.call(input);
    callable.embedQuery = callable;
    callable.embed_query = callable;
    return callable;
  }

  private requestHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (this.api_key) {
      headers.authorization = `Bearer ${this.api_key}`;
    }
    return headers;
  }

  private requestBody(input: readonly string[]): Record<string, unknown> {
    const body: Record<string, unknown> = {
      input,
      model: this.model,
      truncation: this.truncation,
    };
    if (this.input_type) {
      body.input_type = this.input_type;
    }
    if (this.output_dtype) {
      body.output_dtype = this.output_dtype;
    }
    if (typeof this.output_dimension === "number") {
      body.output_dimension = this.output_dimension;
    }
    return body;
  }
}

function extractVoyageAIEmbeddings(payload: unknown): Embeddings {
  if (isRecord(payload) && Array.isArray(payload.embeddings) && payload.embeddings.every(isNumberArray)) {
    return payload.embeddings;
  }
  return extractOpenAIEmbeddings(payload);
}

export class VoyageAIProvider extends BaseEmbeddingsProvider {
  readonly provider = "voyageai";

  constructor(options: VoyageAIProviderConfig = {}) {
    const config = {
      model: "voyage-2",
      truncation: true,
      max_retries: 0,
      ...options,
    };
    super({
      embeddingCallable: new VoyageAIEmbeddingFunction(config).asCallable(),
      ...config,
    });
  }
}

export const ChromaFactoryModule = Object.freeze({ kind: "ChromaFactoryModule" });
export const QdrantFactoryModule = Object.freeze({ kind: "QdrantFactoryModule" });

export const PROVIDER_PATHS: Readonly<Record<AllowedEmbeddingProvider, string>> = {
  azure: "crewai.rag.embeddings.providers.microsoft.azure.AzureProvider",
  "amazon-bedrock": "crewai.rag.embeddings.providers.aws.bedrock.BedrockProvider",
  cohere: "crewai.rag.embeddings.providers.cohere.cohere_provider.CohereProvider",
  custom: "crewai.rag.embeddings.providers.custom.custom_provider.CustomProvider",
  "google-generativeai": "crewai.rag.embeddings.providers.google.generative_ai.GenerativeAiProvider",
  google: "crewai.rag.embeddings.providers.google.generative_ai.GenerativeAiProvider",
  "google-vertex": "crewai.rag.embeddings.providers.google.vertex.VertexAIProvider",
  huggingface: "crewai.rag.embeddings.providers.huggingface.huggingface_provider.HuggingFaceProvider",
  instructor: "crewai.rag.embeddings.providers.instructor.instructor_provider.InstructorProvider",
  jina: "crewai.rag.embeddings.providers.jina.jina_provider.JinaProvider",
  ollama: "crewai.rag.embeddings.providers.ollama.ollama_provider.OllamaProvider",
  onnx: "crewai.rag.embeddings.providers.onnx.onnx_provider.ONNXProvider",
  openai: "crewai.rag.embeddings.providers.openai.openai_provider.OpenAIProvider",
  openclip: "crewai.rag.embeddings.providers.openclip.openclip_provider.OpenCLIPProvider",
  roboflow: "crewai.rag.embeddings.providers.roboflow.roboflow_provider.RoboflowProvider",
  "sentence-transformer": "crewai.rag.embeddings.providers.sentence_transformer.sentence_transformer_provider.SentenceTransformerProvider",
  text2vec: "crewai.rag.embeddings.providers.text2vec.text2vec_provider.Text2VecProvider",
  voyageai: "crewai.rag.embeddings.providers.voyageai.voyageai_provider.VoyageAIProvider",
  watsonx: "crewai.rag.embeddings.providers.ibm.watsonx.WatsonXProvider",
};

export type EmbeddingProviderBuilder<TSpec extends ProviderSpec = ProviderSpec> = (spec: TSpec) => TypedEmbeddingFunction;

const embeddingProviderBuilders = new Map<AllowedEmbeddingProvider, EmbeddingProviderBuilder>();

export type SearchResult = {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
  score?: number;
};

export type SearchResultOptions = SearchResult;

export const SearchResult = class SearchResult {
  readonly id: string;
  readonly content: string;
  readonly metadata: Record<string, unknown>;
  readonly score: number;

  constructor(options: SearchResultOptions) {
    this.id = options.id;
    this.content = options.content;
    this.metadata = { ...(options.metadata ?? {}) };
    this.score = options.score ?? 0;
  }
};

export type BaseCollectionParams = {
  collectionName?: string;
  collection_name?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};
export const BaseCollectionParams = "BaseCollectionParams";

export type BaseCollectionAddParams = BaseCollectionParams & {
  documents: readonly BaseRecord[];
  batchSize?: number;
  batch_size?: number;
};
export const BaseCollectionAddParams = "BaseCollectionAddParams";

export type BaseCollectionSearchParams = BaseCollectionParams & {
  query: string;
  limit?: number;
  metadataFilter?: Record<string, unknown> | null;
  metadata_filter?: Record<string, unknown> | null;
  scoreThreshold?: number | null;
  score_threshold?: number | null;
  where?: Record<string, unknown> | null;
  where_document?: unknown;
  include?: unknown;
};
export const BaseCollectionSearchParams = "BaseCollectionSearchParams";

export type RagProvider = "chromadb" | "qdrant";

export type BaseRagConfigOptions = {
  embeddingFunction?: EmbeddingFunction | null;
  embedding_function?: EmbeddingFunction | null;
  limit?: number;
  scoreThreshold?: number;
  score_threshold?: number;
  batchSize?: number;
  batch_size?: number;
};

export class BaseRagConfig {
  readonly provider: RagProvider;
  readonly embeddingFunction: EmbeddingFunction;
  readonly embedding_function: EmbeddingFunction;
  readonly limit: number;
  readonly scoreThreshold: number;
  readonly score_threshold: number;
  readonly batchSize: number;
  readonly batch_size: number;

  protected constructor(provider: RagProvider, options: BaseRagConfigOptions = {}) {
    this.provider = provider;
    this.embeddingFunction = options.embeddingFunction ?? options.embedding_function ?? defaultRagEmbeddingFunction;
    this.embedding_function = this.embeddingFunction;
    this.limit = options.limit ?? 5;
    this.scoreThreshold = options.scoreThreshold ?? options.score_threshold ?? 0.6;
    this.score_threshold = this.scoreThreshold;
    this.batchSize = options.batchSize ?? options.batch_size ?? 100;
    this.batch_size = this.batchSize;
  }
}

export type ChromaDBSettings = {
  persistDirectory?: string;
  persist_directory?: string;
  allowReset?: boolean;
  allow_reset?: boolean;
  isPersistent?: boolean;
  is_persistent?: boolean;
  anonymizedTelemetry?: boolean;
  anonymized_telemetry?: boolean;
  [key: string]: unknown;
};

export type ChromaDBConfigOptions = BaseRagConfigOptions & {
  tenant?: string;
  database?: string;
  settings?: ChromaDBSettings;
};

export class ChromaDBConfig extends BaseRagConfig {
  readonly provider = "chromadb" as const;
  readonly tenant: string;
  readonly database: string;
  readonly settings: Required<Pick<ChromaDBSettings, "persistDirectory" | "allowReset" | "isPersistent" | "anonymizedTelemetry">> & ChromaDBSettings;

  constructor(options: ChromaDBConfigOptions = {}) {
    super("chromadb", options);
    this.tenant = options.tenant ?? DEFAULT_CHROMADB_TENANT;
    this.database = options.database ?? DEFAULT_CHROMADB_DATABASE;
    this.settings = normalizeChromaSettings(options.settings);
  }
}

export type QdrantClientParams = {
  location?: string | null;
  url?: string | null;
  port?: number;
  grpcPort?: number;
  grpc_port?: number;
  preferGrpc?: boolean;
  prefer_grpc?: boolean;
  https?: boolean | null;
  apiKey?: string | null;
  api_key?: string | null;
  prefix?: string | null;
  timeout?: number | null;
  host?: string | null;
  path?: string | null;
  forceDisableCheckSameThread?: boolean;
  force_disable_check_same_thread?: boolean;
  grpcOptions?: Record<string, unknown> | null;
  grpc_options?: Record<string, unknown> | null;
  authTokenProvider?: (() => string | Promise<string>) | null;
  auth_token_provider?: (() => string | Promise<string>) | null;
  cloudInference?: boolean;
  cloud_inference?: boolean;
  localInferenceBatchSize?: number | null;
  local_inference_batch_size?: number | null;
  checkCompatibility?: boolean;
  check_compatibility?: boolean;
};

export type QdrantConfigOptions = BaseRagConfigOptions & {
  options?: QdrantClientParams;
  vectorsConfig?: unknown;
  vectors_config?: unknown;
};

export class QdrantConfig extends BaseRagConfig {
  readonly provider = "qdrant" as const;
  readonly options: QdrantClientParams;
  readonly vectorsConfig: unknown;
  readonly vectors_config: unknown;

  constructor(options: QdrantConfigOptions = {}) {
    super("qdrant", options);
    this.options = options.options ?? { path: DEFAULT_QDRANT_STORAGE_PATH };
    this.vectorsConfig = options.vectorsConfig ?? options.vectors_config ?? null;
    this.vectors_config = this.vectorsConfig;
  }
}

export class MissingChromaDBConfig extends ChromaDBConfig {}
export class MissingQdrantConfig extends QdrantConfig {}

export type RagConfigType = ChromaDBConfig | QdrantConfig;
export const RagConfigType = "RagConfigType";

export type RagClient = {
  get_or_create_collection?: (params: Record<string, unknown>) => unknown;
  aget_or_create_collection?: (params: Record<string, unknown>) => Promise<unknown>;
  add_documents?: (params: { collection_name: string; documents: readonly BaseRecord[] }) => unknown;
  aadd_documents?: (params: { collection_name: string; documents: readonly BaseRecord[] }) => Promise<unknown>;
  delete_collection?: (params: Record<string, unknown>) => unknown;
  adelete_collection?: (params: Record<string, unknown>) => Promise<unknown>;
  search?: (...args: never[]) => unknown;
  asearch?: (params: BaseCollectionSearchParams) => Promise<unknown>;
  add?: (collectionName: string, records: readonly BaseRecord[]) => unknown;
  deleteCollection?: (...args: never[]) => unknown;
  reset?: () => unknown;
};

export type RagClientFactory<TConfig extends RagConfigType = RagConfigType> = (config: TConfig) => RagClient;

const ragClientFactories = new Map<RagProvider, RagClientFactory>();
let currentRagConfig: RagConfigType | null = null;
let currentRagClient: RagClient | null = null;
type SimpleEmbeddingFunction = (...args: never[]) => unknown;
const DEFAULT_RAG_EMBEDDING_DIMENSIONS = 384;

export function defaultRagEmbeddingFunction(input: unknown): Embedding | Embeddings {
  if (Array.isArray(input)) {
    return input.map((value) => deterministicEmbedding(String(value)));
  }
  return deterministicEmbedding(String(input));
}

export const default_rag_embedding_function = defaultRagEmbeddingFunction;

function deterministicEmbedding(text: string): Embedding {
  const vector: number[] = [];
  for (let index = 0; index < DEFAULT_RAG_EMBEDDING_DIMENSIONS; index += 1) {
    const digest = createHash("sha256").update(`${text}\0${String(index)}`).digest();
    vector.push((digest.readUInt32BE(0) / 0xffffffff) * 2 - 1);
  }
  return vector;
}

export class ClientMethodMismatchError extends TypeError {
  constructor(methodName: string, expectedClient: string, altMethod: string, altClient: string) {
    super(`Method ${methodName}() requires a ${expectedClient}. Use ${altMethod}() for ${altClient}.`);
    this.name = "ClientMethodMismatchError";
  }
}

export class ChromaDBClient {
  readonly client: Record<string, unknown>;
  readonly embeddingFunction: SimpleEmbeddingFunction;
  readonly embedding_function: SimpleEmbeddingFunction;
  readonly defaultLimit: number;
  readonly default_limit: number;
  readonly defaultScoreThreshold: number;
  readonly default_score_threshold: number;
  readonly defaultBatchSize: number;
  readonly default_batch_size: number;

  constructor(
    client: unknown,
    embeddingFunction: SimpleEmbeddingFunction = defaultRagEmbeddingFunction,
    defaultLimit = 5,
    defaultScoreThreshold = 0.6,
    defaultBatchSize = 100,
  ) {
    this.client = client as Record<string, unknown>;
    this.embeddingFunction = embeddingFunction;
    this.embedding_function = embeddingFunction;
    this.defaultLimit = defaultLimit;
    this.default_limit = defaultLimit;
    this.defaultScoreThreshold = defaultScoreThreshold;
    this.default_score_threshold = defaultScoreThreshold;
    this.defaultBatchSize = defaultBatchSize;
    this.default_batch_size = defaultBatchSize;
  }

  create_collection(params: BaseCollectionParams): void {
    this.callClient("create_collection", "createCollection", {
      name: sanitizeCollectionName(collectionNameFrom(params)),
      metadata: normalizeChromaMetadata(params.metadata),
      ...params,
    });
  }

  createCollection(params: BaseCollectionParams): void {
    this.create_collection(params);
  }

  async acreate_collection(params: BaseCollectionParams): Promise<void> {
    await this.callClientAsync("create_collection", "createCollection", {
      name: sanitizeCollectionName(collectionNameFrom(params)),
      metadata: normalizeChromaMetadata(params.metadata),
      ...params,
    });
  }

  get_or_create_collection(params: BaseCollectionParams): unknown {
    return this.callClient("get_or_create_collection", "getOrCreateCollection", {
      name: sanitizeCollectionName(collectionNameFrom(params)),
      metadata: normalizeChromaMetadata(params.metadata),
      embedding_function: this.embeddingFunction,
      ...params,
    });
  }

  getOrCreateCollection(params: BaseCollectionParams): unknown {
    return this.get_or_create_collection(params);
  }

  async aget_or_create_collection(params: BaseCollectionParams): Promise<unknown> {
    return this.callClientAsync("get_or_create_collection", "getOrCreateCollection", {
      name: sanitizeCollectionName(collectionNameFrom(params)),
      metadata: normalizeChromaMetadata(params.metadata),
      embedding_function: this.embeddingFunction,
      ...params,
    });
  }

  add_documents(params: BaseCollectionAddParams): void {
    if (params.documents.length === 0) {
      throw new Error("Documents list cannot be empty");
    }
    const collection = this.get_or_create_collection(params) as Record<string, unknown>;
    const batchSize = params.batchSize ?? params.batch_size ?? this.defaultBatchSize;
    const prepared = prepareDocuments(params.documents);
    for (let index = 0; index < prepared.ids.length; index += batchSize) {
      callMethod(collection, "upsert", "upsert", {
        ids: prepared.ids.slice(index, index + batchSize),
        documents: prepared.texts.slice(index, index + batchSize),
        metadatas: prepared.metadatas.slice(index, index + batchSize),
      });
    }
  }

  addDocuments(params: BaseCollectionAddParams): void {
    this.add_documents(params);
  }

  async aadd_documents(params: BaseCollectionAddParams): Promise<void> {
    if (params.documents.length === 0) {
      throw new Error("Documents list cannot be empty");
    }
    const collection = await this.aget_or_create_collection(params) as Record<string, unknown>;
    const batchSize = params.batchSize ?? params.batch_size ?? this.defaultBatchSize;
    const prepared = prepareDocuments(params.documents);
    for (let index = 0; index < prepared.ids.length; index += batchSize) {
      await callMethodAsync(collection, "upsert", "upsert", {
        ids: prepared.ids.slice(index, index + batchSize),
        documents: prepared.texts.slice(index, index + batchSize),
        metadatas: prepared.metadatas.slice(index, index + batchSize),
      });
    }
  }

  search(params: BaseCollectionSearchParams): SearchResult[] {
    const normalized = normalizeSearchParams(params, this.defaultLimit, this.defaultScoreThreshold);
    const collection = this.get_or_create_collection(normalized) as Record<string, unknown>;
    const result = callMethod(collection, "query", "query", {
      query_texts: [normalized.query],
      n_results: normalized.limit,
      where: normalized.where ?? normalized.metadata_filter,
      where_document: normalized.where_document,
      include: normalized.include ?? ["documents", "metadatas", "distances"],
    });
    return processChromaQueryResult(result, normalized.score_threshold);
  }

  async asearch(params: BaseCollectionSearchParams): Promise<SearchResult[]> {
    const normalized = normalizeSearchParams(params, this.defaultLimit, this.defaultScoreThreshold);
    const collection = await this.aget_or_create_collection(normalized) as Record<string, unknown>;
    const result = await callMethodAsync(collection, "query", "query", {
      query_texts: [normalized.query],
      n_results: normalized.limit,
      where: normalized.where ?? normalized.metadata_filter,
      where_document: normalized.where_document,
      include: normalized.include ?? ["documents", "metadatas", "distances"],
    });
    return processChromaQueryResult(result, normalized.score_threshold);
  }

  delete_collection(params: BaseCollectionParams): void {
    this.callClient("delete_collection", "deleteCollection", { name: sanitizeCollectionName(collectionNameFrom(params)), ...params });
  }

  deleteCollection(params: BaseCollectionParams): void {
    this.delete_collection(params);
  }

  async adelete_collection(params: BaseCollectionParams): Promise<void> {
    await this.callClientAsync("delete_collection", "deleteCollection", { name: sanitizeCollectionName(collectionNameFrom(params)), ...params });
  }

  reset(): void {
    if (typeof this.client.reset === "function") {
      (this.client.reset as () => void)();
      return;
    }
    if (this.client.collections instanceof Map) {
      this.client.collections.clear();
    }
  }

  async areset(): Promise<void> {
    if (typeof this.client.reset === "function") {
      await (this.client.reset as () => void | Promise<void>)();
      return;
    }
    this.reset();
  }

  private callClient(snakeName: string, camelName: string, params: Record<string, unknown>): unknown {
    return callMethod(this.client, snakeName, camelName, params);
  }

  private async callClientAsync(snakeName: string, camelName: string, params: Record<string, unknown>): Promise<unknown> {
    return callMethodAsync(this.client, snakeName, camelName, params);
  }
}

export class QdrantClient {
  readonly client: Record<string, unknown>;
  readonly embeddingFunction: SimpleEmbeddingFunction;
  readonly embedding_function: SimpleEmbeddingFunction;
  readonly defaultLimit: number;
  readonly default_limit: number;
  readonly defaultScoreThreshold: number;
  readonly default_score_threshold: number;
  readonly defaultBatchSize: number;
  readonly default_batch_size: number;

  constructor(
    client: unknown,
    embeddingFunction: SimpleEmbeddingFunction = defaultRagEmbeddingFunction,
    defaultLimit = 5,
    defaultScoreThreshold = 0.6,
    defaultBatchSize = 100,
  ) {
    this.client = client as Record<string, unknown>;
    this.embeddingFunction = embeddingFunction;
    this.embedding_function = embeddingFunction;
    this.defaultLimit = defaultLimit;
    this.default_limit = defaultLimit;
    this.defaultScoreThreshold = defaultScoreThreshold;
    this.default_score_threshold = defaultScoreThreshold;
    this.defaultBatchSize = defaultBatchSize;
    this.default_batch_size = defaultBatchSize;
  }

  createCollection(params: BaseCollectionParams = {}): void {
    this.create_collection(params);
  }

  create_collection(params: BaseCollectionParams = {}): void {
    const collectionName = collectionNameFrom(params);
    if (callMethod(this.client, "collection_exists", "collectionExists", collectionName) === true) {
      throw new Error(`Collection '${collectionName}' already exists`);
    }
    callMethod(this.client, "create_collection", "createCollection", { collection_name: collectionName, ...params });
  }

  async acreate_collection(params: BaseCollectionParams = {}): Promise<void> {
    const collectionName = collectionNameFrom(params);
    if ((await callMethodAsync(this.client, "collection_exists", "collectionExists", collectionName)) === true) {
      throw new Error(`Collection '${collectionName}' already exists`);
    }
    await callMethodAsync(this.client, "create_collection", "createCollection", { collection_name: collectionName, ...params });
  }

  get_or_create_collection(params: BaseCollectionParams = {}): unknown {
    const collectionName = collectionNameFrom(params);
    if (callMethod(this.client, "collection_exists", "collectionExists", collectionName) !== true) {
      callMethod(this.client, "create_collection", "createCollection", { collection_name: collectionName, ...params });
    }
    return callMethod(this.client, "get_collection", "getCollection", collectionName);
  }

  getOrCreateCollection(params: BaseCollectionParams = {}): unknown {
    return this.get_or_create_collection(params);
  }

  async aget_or_create_collection(params: BaseCollectionParams = {}): Promise<unknown> {
    const collectionName = collectionNameFrom(params);
    if ((await callMethodAsync(this.client, "collection_exists", "collectionExists", collectionName)) !== true) {
      await callMethodAsync(this.client, "create_collection", "createCollection", { collection_name: collectionName, ...params });
    }
    return callMethodAsync(this.client, "get_collection", "getCollection", collectionName);
  }

  add_documents(params: BaseCollectionAddParams): void {
    const collectionName = collectionNameFrom(params);
    if (params.documents.length === 0) {
      throw new Error("Documents list cannot be empty");
    }
    if (callMethod(this.client, "collection_exists", "collectionExists", collectionName) !== true) {
      throw new Error(`Collection '${collectionName}' does not exist`);
    }
    const batchSize = params.batchSize ?? params.batch_size ?? this.defaultBatchSize;
    for (let index = 0; index < params.documents.length; index += batchSize) {
      const points = params.documents.slice(index, index + batchSize).map((document) => {
        const normalized = normalizeBaseRecord(document);
        return {
          id: normalized.docId,
          vector: callEmbeddingFunction(this.embeddingFunction, normalized.content),
          payload: { id: normalized.docId, content: normalized.content, metadata: normalized.metadata ?? {} },
        };
      });
      callMethod(this.client, "upsert", "upsert", { collection_name: collectionName, points });
    }
  }

  addDocuments(params: BaseCollectionAddParams): void {
    this.add_documents(params);
  }

  async aadd_documents(params: BaseCollectionAddParams): Promise<void> {
    const collectionName = collectionNameFrom(params);
    if (params.documents.length === 0) {
      throw new Error("Documents list cannot be empty");
    }
    if ((await callMethodAsync(this.client, "collection_exists", "collectionExists", collectionName)) !== true) {
      throw new Error(`Collection '${collectionName}' does not exist`);
    }
    const batchSize = params.batchSize ?? params.batch_size ?? this.defaultBatchSize;
    for (let index = 0; index < params.documents.length; index += batchSize) {
      const points = await Promise.all(params.documents.slice(index, index + batchSize).map(async (document) => {
        const normalized = normalizeBaseRecord(document);
        return {
          id: normalized.docId,
          vector: await callEmbeddingFunctionAsync(this.embeddingFunction, normalized.content),
          payload: { id: normalized.docId, content: normalized.content, metadata: normalized.metadata ?? {} },
        };
      }));
      await callMethodAsync(this.client, "upsert", "upsert", { collection_name: collectionName, points });
    }
  }

  search(params: BaseCollectionSearchParams): SearchResult[] {
    const collectionName = collectionNameFrom(params);
    if (callMethod(this.client, "collection_exists", "collectionExists", collectionName) !== true) {
      throw new Error(`Collection '${collectionName}' does not exist`);
    }
    const normalized = normalizeSearchParams(params, this.defaultLimit, this.defaultScoreThreshold);
    const response = callMethod(this.client, "query_points", "queryPoints", {
      collection_name: collectionName,
      query: normalized.query,
      query_embedding: callEmbeddingFunction(this.embeddingFunction, normalized.query),
      limit: normalized.limit,
      score_threshold: normalized.score_threshold,
      filter: normalized.metadata_filter,
    });
    return processQdrantQueryResult(response, normalized.score_threshold);
  }

  async asearch(params: BaseCollectionSearchParams): Promise<SearchResult[]> {
    const collectionName = collectionNameFrom(params);
    if ((await callMethodAsync(this.client, "collection_exists", "collectionExists", collectionName)) !== true) {
      throw new Error(`Collection '${collectionName}' does not exist`);
    }
    const normalized = normalizeSearchParams(params, this.defaultLimit, this.defaultScoreThreshold);
    const response = await callMethodAsync(this.client, "query_points", "queryPoints", {
      collection_name: collectionName,
      query: normalized.query,
      query_embedding: await callEmbeddingFunctionAsync(this.embeddingFunction, normalized.query),
      limit: normalized.limit,
      score_threshold: normalized.score_threshold,
      filter: normalized.metadata_filter,
    });
    return processQdrantQueryResult(response, normalized.score_threshold);
  }

  delete_collection(params: BaseCollectionParams): void {
    const collectionName = collectionNameFrom(params);
    if (callMethod(this.client, "collection_exists", "collectionExists", collectionName) !== true) {
      throw new Error(`Collection '${collectionName}' does not exist`);
    }
    callMethod(this.client, "delete_collection", "deleteCollection", { collection_name: collectionName });
  }

  deleteCollection(params: BaseCollectionParams): void {
    this.delete_collection(params);
  }

  async adelete_collection(params: BaseCollectionParams): Promise<void> {
    const collectionName = collectionNameFrom(params);
    if ((await callMethodAsync(this.client, "collection_exists", "collectionExists", collectionName)) !== true) {
      throw new Error(`Collection '${collectionName}' does not exist`);
    }
    await callMethodAsync(this.client, "delete_collection", "deleteCollection", { collection_name: collectionName });
  }

  reset(): void {
    const response = callMethod(this.client, "get_collections", "getCollections");
    for (const collection of extractCollectionNames(response)) {
      callMethod(this.client, "delete_collection", "deleteCollection", { collection_name: collection });
    }
  }

  async areset(): Promise<void> {
    const response = await callMethodAsync(this.client, "get_collections", "getCollections");
    for (const collection of extractCollectionNames(response)) {
      await callMethodAsync(this.client, "delete_collection", "deleteCollection", { collection_name: collection });
    }
  }
}

export class RagError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RagError";
  }
}

function collectionNameFrom(params: BaseCollectionParams): string {
  const collectionName = params.collectionName ?? params.collection_name;
  if (!collectionName) {
    throw new Error("collection_name is required");
  }
  return collectionName;
}

function sanitizeCollectionName(collectionName: string): string {
  return collectionName
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, MAX_COLLECTION_LENGTH)
    .padEnd(Math.min(MIN_COLLECTION_LENGTH, MAX_COLLECTION_LENGTH), "_");
}

function normalizeChromaMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  return { "hnsw:space": "cosine", ...(metadata ?? {}) };
}

function prepareDocuments(documents: readonly BaseRecord[]): PreparedDocuments {
  const prepared = new PreparedDocuments();
  for (const document of documents) {
    const normalized = normalizeBaseRecord(document);
    prepared.ids.push(normalized.docId);
    prepared.texts.push(normalized.content);
    const metadata = normalized.metadata && !Array.isArray(normalized.metadata)
      ? normalized.metadata as Record<string, string | number | boolean>
      : null;
    prepared.metadatas.push({ ...(metadata ?? {}) });
  }
  return prepared;
}

function normalizeSearchParams(params: BaseCollectionSearchParams, defaultLimit: number, defaultScoreThreshold: number): {
  collection_name: string;
  query: string;
  limit: number;
  metadata_filter: Record<string, unknown> | null;
  score_threshold: number | null;
  where: Record<string, unknown> | null;
  where_document: unknown;
  include: unknown;
} {
  return {
    collection_name: collectionNameFrom(params),
    query: params.query,
    limit: params.limit ?? defaultLimit,
    metadata_filter: params.metadataFilter ?? params.metadata_filter ?? null,
    score_threshold: params.scoreThreshold ?? params.score_threshold ?? defaultScoreThreshold,
    where: params.where ?? null,
    where_document: params.where_document ?? null,
    include: params.include ?? null,
  };
}

function callMethod(target: Record<string, unknown>, snakeName: string, camelName: string, params?: unknown): unknown {
  const method = target[snakeName] ?? target[camelName];
  if (typeof method !== "function") {
    throw new TypeError(`Client method ${snakeName}() is not available.`);
  }
  return params === undefined
    ? (method as () => unknown).call(target)
    : (method as (value: unknown) => unknown).call(target, params);
}

function callMethodAsync(target: Record<string, unknown>, snakeName: string, camelName: string, params?: unknown): Promise<unknown> {
  return Promise.resolve(callMethod(target, snakeName, camelName, params));
}

function callEmbeddingFunction(embeddingFunction: SimpleEmbeddingFunction, text: string): unknown {
  const result = (embeddingFunction as (value: string) => unknown)(text);
  if (result instanceof Promise) {
    throw new TypeError("Async embedding function cannot be used with sync methods. Use async aliases instead.");
  }
  return result;
}

function callEmbeddingFunctionAsync(embeddingFunction: SimpleEmbeddingFunction, text: string): Promise<unknown> {
  return Promise.resolve((embeddingFunction as (value: string) => unknown)(text));
}

function processChromaQueryResult(result: unknown, scoreThreshold: number | null): SearchResult[] {
  const value = result as {
    ids?: string[][];
    documents?: string[][];
    metadatas?: Record<string, unknown>[][];
    distances?: number[][];
  };
  const ids = value.ids?.[0] ?? [];
  const documents = value.documents?.[0] ?? [];
  const metadatas = value.metadatas?.[0] ?? [];
  const distances = value.distances?.[0] ?? [];
  return ids
    .map((id, index) => ({
      id,
      content: documents[index] ?? "",
      metadata: metadatas[index] ?? {},
      score: 1 / (1 + (distances[index] ?? 0)),
    }))
    .filter((resultItem) => scoreThreshold === null || resultItem.score >= scoreThreshold);
}

function processQdrantQueryResult(result: unknown, scoreThreshold: number | null): SearchResult[] {
  const points = Array.isArray((result as { points?: unknown[] }).points)
    ? (result as { points: Array<{ id?: unknown; payload?: Record<string, unknown>; score?: number }> }).points
    : Array.isArray(result) ? result as Array<{ id?: unknown; payload?: Record<string, unknown>; score?: number }> : [];
  return points
    .map((point) => {
      const payload = point.payload ?? {};
      return {
        id: stringFromUnknown(payload.id ?? payload.doc_id ?? point.id),
        content: stringFromUnknown(payload.content),
        metadata: (payload.metadata ?? {}) as Record<string, unknown>,
        score: point.score ?? 0,
      };
    })
    .filter((resultItem) => scoreThreshold === null || resultItem.score >= scoreThreshold);
}

function stringFromUnknown(value: unknown): string {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : "";
}

function extractCollectionNames(response: unknown): string[] {
  const collections = (response as { collections?: Array<{ name?: string } | string> }).collections ?? [];
  return collections.map((collection) => typeof collection === "string" ? collection : collection.name).filter((name): name is string => Boolean(name));
}

export function registerRagClientFactory<TConfig extends RagConfigType>(
  provider: TConfig["provider"],
  factory: RagClientFactory<TConfig>,
): void {
  ragClientFactories.set(provider, factory as RagClientFactory);
}

export const register_rag_client_factory = registerRagClientFactory;

export function unregisterRagClientFactory(provider: RagProvider): void {
  ragClientFactories.delete(provider);
}

export const unregister_rag_client_factory = unregisterRagClientFactory;

export function clearRagClientFactories(): void {
  ragClientFactories.clear();
}

export const clear_rag_client_factories = clearRagClientFactories;

export function createRagClient(config: RagConfigType | ({ provider: RagProvider } & Record<string, unknown>)): RagClient {
  const normalized = normalizeRagConfig(config);
  const factory = ragClientFactories.get(normalized.provider);
  if (!factory) {
    throw new Error(
      `No RAG client factory registered for provider '${normalized.provider}'. Register one with registerRagClientFactory().`,
    );
  }
  return factory(normalized);
}

export const create_client = createRagClient;
export const createClient = createRagClient;

export function setRagConfig(config: RagConfigType): void {
  currentRagConfig = config;
  currentRagClient = createRagClient(config);
}

export const set_rag_config = setRagConfig;

export function getRagConfig(): RagConfigType {
  currentRagConfig ??= new ChromaDBConfig();
  return currentRagConfig;
}

export const get_rag_config = getRagConfig;

export function getRagClient(): RagClient {
  currentRagClient ??= createRagClient(getRagConfig());
  return currentRagClient;
}

export const get_rag_client = getRagClient;

export function clearRagConfig(): void {
  currentRagConfig = null;
  currentRagClient = null;
}

export const clear_rag_config = clearRagConfig;

export function normalizeRagConfig(config: RagConfigType | ({ provider: string } & Record<string, unknown>)): RagConfigType {
  if (config instanceof ChromaDBConfig || config instanceof QdrantConfig) {
    return config;
  }
  if (config.provider === "chromadb") {
    return new ChromaDBConfig(config as ChromaDBConfigOptions);
  }
  return config.provider === "qdrant"
    ? new QdrantConfig(config as QdrantConfigOptions)
    : unsupportedRagProvider(config.provider);
}

export const normalize_rag_config = normalizeRagConfig;

function unsupportedRagProvider(provider: string): never {
  throw new Error(`Unsupported provider: ${provider}`);
}

export type BaseRAGStorageOptions = {
  type: string;
  allowReset?: boolean;
  allow_reset?: boolean;
  embedderConfig?: unknown;
  embedder_config?: unknown;
  crew?: { agents?: readonly { role: string }[] } | null;
};

export abstract class BaseRAGStorage {
  readonly type: string;
  readonly allowReset: boolean;
  readonly allow_reset: boolean;
  readonly embedderConfig: unknown;
  readonly embedder_config: unknown;
  readonly crew: { agents?: readonly { role: string }[] } | null;
  readonly agents: string;

  constructor(options: BaseRAGStorageOptions) {
    this.type = options.type;
    this.allowReset = options.allowReset ?? options.allow_reset ?? true;
    this.allow_reset = this.allowReset;
    this.embedderConfig = options.embedderConfig ?? options.embedder_config ?? null;
    this.embedder_config = this.embedderConfig;
    this.crew = options.crew ?? null;
    this.agents = this.initializeAgents();
  }

  protected initializeAgents(): string {
    if (!this.crew?.agents) {
      return "";
    }
    return this.crew.agents.map((agent) => this.sanitizeRole(agent.role)).join("_");
  }

  _initialize_agents(): string {
    return this.initializeAgents();
  }

  protected abstract sanitizeRole(role: string): string;

  _sanitize_role(role: string): string {
    return this.sanitizeRole(role);
  }

  abstract save(value: unknown, metadata: Record<string, unknown>): unknown;

  abstract search(
    query: string,
    limit?: number,
    filter?: Record<string, unknown> | null,
    scoreThreshold?: number,
  ): unknown;

  abstract reset(): unknown;
}

export function normalizeBaseRecord(record: BaseRecord): Required<Pick<BaseRecord, "content">> & {
  docId: string;
  metadata: RagMetadata | readonly RagMetadata[] | null;
} {
  const content = record.content.trim();
  if (!content) {
    throw new Error("RAG record content cannot be empty.");
  }
  return {
    docId: record.docId ?? record.doc_id ?? createContentId(content),
    content,
    metadata: record.metadata ?? null,
  };
}

export const normalize_base_record = normalizeBaseRecord;

export function createContentId(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export const create_content_id = createContentId;

export function normalizeEmbeddings(target: Embedding | Embeddings): Embeddings {
  if (!Array.isArray(target) || target.length === 0) {
    throw new Error("Expected embeddings to be a list with at least one item.");
  }
  const first: unknown = target[0];
  if (typeof first === "number") {
    return [validateEmbedding(target as Embedding)];
  }
  if (Array.isArray(first)) {
    return (target as Embeddings).map(validateEmbedding);
  }
  throw new Error(`Unsupported embeddings format: ${typeof first}`);
}

export const normalize_embeddings = normalizeEmbeddings;

export function maybeCastOneToMany<T>(target: T | readonly T[] | null | undefined): readonly T[] | null {
  if (target === null || target === undefined) {
    return null;
  }
  return Array.isArray(target) ? target as readonly T[] : [target as T];
}

export const maybe_cast_one_to_many = maybeCastOneToMany;

export function validateEmbeddings(embeddings: Embeddings): Embeddings {
  if (!Array.isArray(embeddings) || embeddings.length === 0) {
    throw new Error(`Expected embeddings to be a list with at least one item, got ${String(embeddings.length)} embeddings`);
  }
  return embeddings.map(validateEmbedding);
}

export const validate_embeddings = validateEmbeddings;

export function registerEmbeddingProviderBuilder<TSpec extends ProviderSpec>(
  provider: TSpec["provider"],
  builder: EmbeddingProviderBuilder<TSpec>,
): void {
  embeddingProviderBuilders.set(provider, builder as EmbeddingProviderBuilder);
}

export const register_embedding_provider_builder = registerEmbeddingProviderBuilder;

export function unregisterEmbeddingProviderBuilder(provider: AllowedEmbeddingProvider): void {
  embeddingProviderBuilders.delete(provider);
}

export const unregister_embedding_provider_builder = unregisterEmbeddingProviderBuilder;

export function clearEmbeddingProviderBuilders(): void {
  embeddingProviderBuilders.clear();
}

export const clear_embedding_provider_builders = clearEmbeddingProviderBuilders;

export function buildEmbedderFromProvider(provider: BaseEmbeddingsProvider): TypedEmbeddingFunction {
  return provider.build();
}

export const build_embedder_from_provider = buildEmbedderFromProvider;

export function buildEmbedderFromDict(spec: ProviderSpec): TypedEmbeddingFunction {
  const providerName = spec.provider;
  if (!(providerName in PROVIDER_PATHS)) {
    throw new Error(
      `Unknown provider: ${providerName}. Available providers: ${Object.keys(PROVIDER_PATHS).join(", ")}`,
    );
  }
  if (providerName === "custom") {
    const callable = spec.config?.embeddingCallable ?? spec.config?.embedding_callable;
    if (!callable) {
      throw new Error("Custom provider requires 'embedding_callable' in config");
    }
    return callable;
  }
  const builder = embeddingProviderBuilders.get(providerName);
  if (builder) {
    return builder(spec);
  }
  return buildEmbedderFromBuiltinProvider(providerName, spec.config ?? {});
}

export const build_embedder_from_dict = buildEmbedderFromDict;

function buildEmbedderFromBuiltinProvider(
  providerName: AllowedEmbeddingProvider,
  config: Record<string, unknown>,
): TypedEmbeddingFunction {
  switch (providerName) {
    case "azure":
      return new AzureProvider(toAzureProviderConfig(config)).build();
    case "amazon-bedrock":
      return new BedrockProvider(config).build();
    case "cohere":
      return new CohereProvider(config).build();
    case "google":
    case "google-generativeai":
      return new GenerativeAiProvider(config).build();
    case "google-vertex":
      return new VertexAIProvider(config).build();
    case "huggingface":
      return new HuggingFaceProvider(config).build();
    case "instructor":
      return new InstructorProvider(config).build();
    case "jina":
      return new JinaProvider(config).build();
    case "ollama":
      return new OllamaProvider(config).build();
    case "onnx":
      return new ONNXProvider(config).build();
    case "openai":
      return new OpenAIProvider(config).build();
    case "openclip":
      return new OpenCLIPProvider(config).build();
    case "roboflow":
      return new RoboflowProvider(config).build();
    case "sentence-transformer":
      return new SentenceTransformerProvider(config).build();
    case "text2vec":
      return new Text2VecProvider(config).build();
    case "voyageai":
      return new VoyageAIProvider(config).build();
    case "watsonx":
      return new WatsonXProvider(config).build();
    case "custom":
      throw new Error("Custom provider requires 'embedding_callable' in config");
  }
}

function toAzureProviderConfig(config: Record<string, unknown>): AzureProviderConfig {
  const options: AzureProviderConfig = {
    deployment_id: optionalString(config.deployment_id) ?? "",
  };
  assignOptionalString(options, "api_key", config.api_key);
  assignOptionalString(options, "api_base", config.api_base);
  assignOptionalString(options, "api_type", config.api_type);
  assignOptionalString(options, "api_version", config.api_version);
  assignOptionalString(options, "model_name", config.model_name);
  assignOptionalString(options, "organization_id", config.organization_id);
  if (isRecord(config.default_headers)) {
    options.default_headers = config.default_headers;
  }
  if (typeof config.dimensions === "number") {
    options.dimensions = config.dimensions;
  }
  return options;
}

function assignOptionalString(
  target: AzureProviderConfig,
  key: "api_key" | "api_base" | "api_type" | "api_version" | "model_name" | "organization_id",
  value: unknown,
): void {
  if (typeof value === "string") {
    target[key] = value;
  }
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function buildEmbedder(spec: EmbedderConfig): TypedEmbeddingFunction {
  if (typeof spec === "function") {
    return spec;
  }
  if (spec instanceof BaseEmbeddingsProvider) {
    return buildEmbedderFromProvider(spec);
  }
  return buildEmbedderFromDict(spec);
}

export const build_embedder = buildEmbedder;
export const getEmbeddingFunction = buildEmbedder;
export const get_embedding_function = buildEmbedder;

function normalizeChromaSettings(settings: ChromaDBSettings = {}) {
  const persistDirectory = settings.persistDirectory ?? settings.persist_directory ?? DEFAULT_CHROMADB_STORAGE_PATH;
  const allowReset = settings.allowReset ?? settings.allow_reset ?? true;
  const isPersistent = settings.isPersistent ?? settings.is_persistent ?? true;
  const anonymizedTelemetry = settings.anonymizedTelemetry ?? settings.anonymized_telemetry ?? false;
  return {
    ...settings,
    persistDirectory,
    persist_directory: persistDirectory,
    allowReset,
    allow_reset: allowReset,
    isPersistent,
    is_persistent: isPersistent,
    anonymizedTelemetry,
    anonymized_telemetry: anonymizedTelemetry,
  };
}

function validateEmbedding(embedding: Embedding): Embedding {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("Expected each embedding to be a 1-dimensional array with at least 1 value.");
  }
  const normalized: number[] = [];
  for (const value of embedding) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error("Expected embedding to contain numeric values.");
    }
    normalized.push(value);
  }
  return normalized;
}
