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
export class BedrockProvider {
  readonly provider = "amazon-bedrock";
  readonly model_name: string;
  readonly session: unknown;

  constructor(options: BedrockProviderConfig = {}) {
    this.model_name = options.model_name ?? "amazon.titan-embed-text-v1";
    this.session = options.session ?? create_aws_session();
  }

  build(): TypedEmbeddingFunction {
    return defaultEmbeddingCallable;
  }
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
};
export const VertexAIProviderConfig = Object.freeze({ kind: "VertexAIProviderConfig" });
export type VertexAIProviderSpec = BaseProviderSpec<"google-vertex", VertexAIProviderConfig>;
export const VertexAIProviderSpec = providerSpecMarker("VertexAIProviderSpec");

export type HuggingFaceProviderConfig = { api_key?: string; model?: string; model_name?: string };
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

export type InstructorProviderConfig = { model_name?: string; device?: string; instruction?: string };
export const InstructorProviderConfig = Object.freeze({ kind: "InstructorProviderConfig" });
export type InstructorProviderSpec = BaseProviderSpec<"instructor", InstructorProviderConfig>;
export const InstructorProviderSpec = providerSpecMarker("InstructorProviderSpec");

export type JinaProviderConfig = { api_key?: string; model_name?: string };
export const JinaProviderConfig = Object.freeze({ kind: "JinaProviderConfig" });
export type JinaProviderSpec = BaseProviderSpec<"jina", JinaProviderConfig>;
export const JinaProviderSpec = providerSpecMarker("JinaProviderSpec");

export type OllamaProviderConfig = { url?: string; model_name?: string };
export const OllamaProviderConfig = Object.freeze({ kind: "OllamaProviderConfig" });
export type OllamaProviderSpec = BaseProviderSpec<"ollama", OllamaProviderConfig>;
export const OllamaProviderSpec = providerSpecMarker("OllamaProviderSpec");

export type ONNXProviderConfig = { preferred_providers?: readonly string[] };
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

export type OpenCLIPProviderConfig = { model_name?: string; checkpoint?: string; device?: string };
export const OpenCLIPProviderConfig = Object.freeze({ kind: "OpenCLIPProviderConfig" });
export type OpenCLIPProviderSpec = BaseProviderSpec<"openclip", OpenCLIPProviderConfig>;
export const OpenCLIPProviderSpec = providerSpecMarker("OpenCLIPProviderSpec");

export type RoboflowProviderConfig = { api_key?: string; api_url?: string };
export const RoboflowProviderConfig = Object.freeze({ kind: "RoboflowProviderConfig" });
export type RoboflowProviderSpec = BaseProviderSpec<"roboflow", RoboflowProviderConfig>;
export const RoboflowProviderSpec = providerSpecMarker("RoboflowProviderSpec");

export type SentenceTransformerProviderConfig = {
  model_name?: string;
  device?: string;
  normalize_embeddings?: boolean;
};
export const SentenceTransformerProviderConfig = Object.freeze({ kind: "SentenceTransformerProviderConfig" });
export type SentenceTransformerProviderSpec = BaseProviderSpec<"sentence-transformer", SentenceTransformerProviderConfig>;
export const SentenceTransformerProviderSpec = providerSpecMarker("SentenceTransformerProviderSpec");

export type Text2VecProviderConfig = { model_name?: string };
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

const defaultEmbeddingCallable: TypedEmbeddingFunction = (input: Embeddable) => {
  const values = Array.isArray(input) ? input : [input];
  return values.map(() => [0]);
};

export class AzureProvider extends BaseEmbeddingsProvider {
  readonly provider = "azure";

  constructor(options: AzureProviderConfig = { deployment_id: "" }) {
    super({
      embeddingCallable: defaultEmbeddingCallable,
      api_type: "azure",
      api_version: "2024-02-01",
      model_name: "text-embedding-ada-002",
      ...options,
    });
  }
}

export class CohereProvider extends BaseEmbeddingsProvider {
  readonly provider = "cohere";

  constructor(options: CohereProviderConfig = {}) {
    super({
      embeddingCallable: defaultEmbeddingCallable,
      model_name: "large",
      ...options,
    });
  }
}

export class CustomEmbeddingFunction {
  constructor(readonly embeddingCallable: TypedEmbeddingFunction = defaultEmbeddingCallable) {}

  call(input: Embeddable): unknown {
    return this.embeddingCallable(input);
  }
}

export class CustomProvider extends BaseEmbeddingsProvider {
  readonly provider = "custom";

  constructor(options: CustomProviderConfig = {}) {
    const { embeddingCallable, embedding_callable: embeddingCallableSnake, ...config } = options;
    super({ ...config, embeddingCallable: embeddingCallable ?? embeddingCallableSnake ?? defaultEmbeddingCallable });
  }
}

export class GoogleGenAIVertexEmbeddingFunction {
  static name(): string {
    return "google-vertex";
  }

  call(input: Embeddable): unknown {
    return defaultEmbeddingCallable(input);
  }
}

export class GenerativeAiProvider extends BaseEmbeddingsProvider {
  readonly provider = "google-generativeai";

  constructor(options: GenerativeAiProviderConfig = {}) {
    super({
      embeddingCallable: defaultEmbeddingCallable,
      model_name: "gemini-embedding-001",
      task_type: "RETRIEVAL_DOCUMENT",
      ...options,
    });
  }
}

export class VertexAIProvider extends BaseEmbeddingsProvider {
  readonly provider = "google-vertex";

  constructor(options: VertexAIProviderConfig = {}) {
    super({
      embeddingCallable: defaultEmbeddingCallable,
      model_name: "textembedding-gecko",
      location: "us-central1",
      task_type: "RETRIEVAL_DOCUMENT",
      ...options,
    });
  }
}

export class HuggingFaceProvider extends BaseEmbeddingsProvider {
  readonly provider = "huggingface";

  constructor(options: HuggingFaceProviderConfig = {}) {
    super({
      embeddingCallable: defaultEmbeddingCallable,
      model_name: "sentence-transformers/all-MiniLM-L6-v2",
      ...options,
    });
  }
}

export class WatsonXEmbeddingFunction {
  static name(): string {
    return "watsonx";
  }

  call(input: Embeddable): unknown {
    return defaultEmbeddingCallable(input);
  }
}

export class WatsonXProvider extends BaseEmbeddingsProvider {
  readonly provider = "watsonx";

  constructor(options: WatsonXProviderConfig = {}) {
    super({
      embeddingCallable: defaultEmbeddingCallable,
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

export class InstructorProvider extends BaseEmbeddingsProvider {
  readonly provider = "instructor";

  constructor(options: InstructorProviderConfig = {}) {
    super({
      embeddingCallable: defaultEmbeddingCallable,
      model_name: "hkunlp/instructor-base",
      device: "cpu",
      instruction: null,
      ...options,
    });
  }
}

export class JinaProvider extends BaseEmbeddingsProvider {
  readonly provider = "jina";

  constructor(options: JinaProviderConfig = {}) {
    super({
      embeddingCallable: defaultEmbeddingCallable,
      model_name: "jina-embeddings-v2-base-en",
      ...options,
    });
  }
}

export class OllamaProvider extends BaseEmbeddingsProvider {
  readonly provider = "ollama";

  constructor(options: OllamaProviderConfig = {}) {
    super({
      embeddingCallable: defaultEmbeddingCallable,
      url: "http://localhost:11434/api/embeddings",
      ...options,
    });
  }
}

export class ONNXProvider extends BaseEmbeddingsProvider {
  readonly provider = "onnx";

  constructor(options: ONNXProviderConfig = {}) {
    super({
      embeddingCallable: defaultEmbeddingCallable,
      preferred_providers: null,
      ...options,
    });
  }
}

export class OpenAIProvider extends BaseEmbeddingsProvider {
  readonly provider = "openai";

  constructor(options: OpenAIProviderConfig = {}) {
    super({
      embeddingCallable: defaultEmbeddingCallable,
      model_name: "text-embedding-ada-002",
      ...options,
    });
  }
}

export class OpenCLIPProvider extends BaseEmbeddingsProvider {
  readonly provider = "openclip";

  constructor(options: OpenCLIPProviderConfig = {}) {
    super({
      embeddingCallable: defaultEmbeddingCallable,
      model_name: "ViT-B-32",
      checkpoint: "laion2b_s34b_b79k",
      device: "cpu",
      ...options,
    });
  }
}

export class RoboflowProvider extends BaseEmbeddingsProvider {
  readonly provider = "roboflow";

  constructor(options: RoboflowProviderConfig = {}) {
    super({
      embeddingCallable: defaultEmbeddingCallable,
      api_key: "",
      api_url: "https://infer.roboflow.com",
      ...options,
    });
  }
}

export class SentenceTransformerProvider extends BaseEmbeddingsProvider {
  readonly provider = "sentence-transformer";

  constructor(options: SentenceTransformerProviderConfig = {}) {
    super({
      embeddingCallable: defaultEmbeddingCallable,
      model_name: "all-MiniLM-L6-v2",
      device: "cpu",
      normalize_embeddings: false,
      ...options,
    });
  }
}

export class Text2VecProvider extends BaseEmbeddingsProvider {
  readonly provider = "text2vec";

  constructor(options: Text2VecProviderConfig = {}) {
    super({
      embeddingCallable: defaultEmbeddingCallable,
      model_name: "shibing624/text2vec-base-chinese",
      ...options,
    });
  }
}

export class VoyageAIEmbeddingFunction {
  static name(): string {
    return "voyageai";
  }

  call(input: Embeddable): unknown {
    return defaultEmbeddingCallable(input);
  }
}

export class VoyageAIProvider extends BaseEmbeddingsProvider {
  readonly provider = "voyageai";

  constructor(options: VoyageAIProviderConfig = {}) {
    super({
      embeddingCallable: defaultEmbeddingCallable,
      model: "voyage-2",
      truncation: true,
      max_retries: 0,
      ...options,
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
  readonly embeddingFunction: EmbeddingFunction | null;
  readonly embedding_function: EmbeddingFunction | null;
  readonly limit: number;
  readonly scoreThreshold: number;
  readonly score_threshold: number;
  readonly batchSize: number;
  readonly batch_size: number;

  protected constructor(provider: RagProvider, options: BaseRagConfigOptions = {}) {
    this.provider = provider;
    this.embeddingFunction = options.embeddingFunction ?? options.embedding_function ?? null;
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
    embeddingFunction: SimpleEmbeddingFunction = (...args: readonly unknown[]) => {
      void args;
      return [[0]];
    },
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
    embeddingFunction: SimpleEmbeddingFunction = (...args: readonly unknown[]) => {
      void args;
      return [[0]];
    },
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
