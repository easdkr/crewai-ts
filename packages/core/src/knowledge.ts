import { extname, isAbsolute, join } from "node:path";
import { existsSync, readFileSync, statSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import {
  buildEmbedder,
  ChromaDBConfig,
  createRagClient,
  getRagClient,
  type BaseRecord,
  type EmbedderConfig,
  type EmbeddingFunction,
  type RagClient,
  type SearchResult,
} from "./rag.js";
import { KNOWLEDGE_DIRECTORY } from "./settings.js";

export type KnowledgeSearchResult = {
  content: string;
  score: number;
  source: string | null;
  metadata: Record<string, unknown>;
};

export type KnowledgeQueryOptions = {
  resultsLimit?: number;
  results_limit?: number;
  scoreThreshold?: number | null;
  score_threshold?: number | null;
};

export const DEFAULT_KNOWLEDGE_SCORE_THRESHOLD = 0.6;

export type KnowledgeSource = {
  readonly sourceType?: string;
  readonly metadata?: Record<string, unknown>;
  storage?: BaseKnowledgeStorage | null;
  chunks(): readonly string[];
  add?(): void;
  aadd?(): Promise<void>;
  get_embeddings?(): readonly unknown[];
  validate_content?(): unknown;
};

export type StringKnowledgeSourceOptions = {
  content: string;
  chunkSize?: number;
  chunkOverlap?: number;
  metadata?: Record<string, unknown>;
  storage?: BaseKnowledgeStorage | null;
  collectionName?: string | null;
  collection_name?: string | null;
};

export type FileKnowledgeSourceOptions = {
  filePaths?: string | readonly string[];
  file_path?: string | readonly string[];
  file_paths?: string | readonly string[];
  chunkSize?: number;
  chunkOverlap?: number;
  metadata?: Record<string, unknown>;
  storage?: BaseKnowledgeStorage | null;
  collectionName?: string | null;
  collection_name?: string | null;
};

export type BaseKnowledgeSourceOptions = {
  chunkSize?: number;
  chunk_size?: number;
  chunkOverlap?: number;
  chunk_overlap?: number;
  chunks?: readonly string[];
  chunkEmbeddings?: readonly unknown[];
  chunk_embeddings?: readonly unknown[];
  metadata?: Record<string, unknown>;
  storage?: BaseKnowledgeStorage | null;
  collectionName?: string | null;
  collection_name?: string | null;
};

export type PDFTextExtractor = (filePath: string, bytes: Buffer) => string;

export type PDFKnowledgeSourceOptions = FileKnowledgeSourceOptions & {
  extractor?: PDFTextExtractor;
};

export type ExcelSheetData = readonly (readonly unknown[])[];
export type ExcelWorkbookData = Record<string, ExcelSheetData>;
export type ExcelTextExtractor = (filePath: string, bytes: Buffer) => ExcelWorkbookData | string;

export type ExcelKnowledgeSourceOptions = FileKnowledgeSourceOptions & {
  extractor?: ExcelTextExtractor;
};

export type DoclingConversionResult = unknown;
export type DoclingDocumentConverter = {
  convert_all?: (paths: readonly string[]) => Iterable<DoclingConversionResult>;
  convertAll?: (paths: readonly string[]) => Iterable<DoclingConversionResult>;
} | ((paths: readonly string[]) => Iterable<DoclingConversionResult>);
export type DoclingChunk = { text?: string | number | boolean | bigint | null | undefined } | string;
export type DoclingChunker = {
  chunk?: (document: unknown) => Iterable<DoclingChunk>;
} | ((document: unknown) => Iterable<DoclingChunk>);
export type CrewDoclingSourceOptions = FileKnowledgeSourceOptions & {
  documentConverter?: DoclingDocumentConverter | null;
  document_converter?: DoclingDocumentConverter | null;
  chunker?: DoclingChunker | null;
};

type KnowledgeEntry = {
  content: string;
  source: string | null;
  metadata: Record<string, unknown>;
};

export class BaseKnowledgeSource {
  readonly chunkSize: number;
  readonly chunk_size: number;
  readonly chunkOverlap: number;
  readonly chunk_overlap: number;
  readonly metadata: Record<string, unknown>;
  readonly collectionName: string | null;
  readonly collection_name: string | null;
  storage: BaseKnowledgeStorage | null;
  chunks: string[];
  private chunkEmbeddingsValue: unknown[];

  constructor(options: BaseKnowledgeSourceOptions = {}) {
    this.chunkSize = options.chunkSize ?? options.chunk_size ?? 4000;
    this.chunk_size = this.chunkSize;
    this.chunkOverlap = options.chunkOverlap ?? options.chunk_overlap ?? 200;
    this.chunk_overlap = this.chunkOverlap;
    this.chunks = [...(options.chunks ?? [])];
    this.chunkEmbeddingsValue = [...(options.chunkEmbeddings ?? options.chunk_embeddings ?? [])];
    this.metadata = options.metadata ?? {};
    this.storage = options.storage ?? null;
    this.collectionName = options.collectionName ?? options.collection_name ?? null;
    this.collection_name = this.collectionName;
    if (this.chunkSize <= 0) {
      throw new Error("BaseKnowledgeSource chunk_size must be a positive number.");
    }
    if (this.chunkOverlap < 0 || this.chunkOverlap >= this.chunkSize) {
      throw new Error("BaseKnowledgeSource chunk_overlap must be smaller than chunk_size.");
    }
  }

  get chunkEmbeddings(): unknown[] {
    return this.chunkEmbeddingsValue;
  }

  set chunkEmbeddings(value: readonly unknown[]) {
    this.chunkEmbeddingsValue = [...value];
  }

  get chunk_embeddings(): unknown[] {
    return this.chunkEmbeddingsValue;
  }

  set chunk_embeddings(value: readonly unknown[]) {
    this.chunkEmbeddingsValue = [...value];
  }

  validateContent(): unknown {
    return null;
  }

  validate_content(): unknown {
    return this.validateContent();
  }

  add(): void {
    this._save_documents();
  }

  async aadd(): Promise<void> {
    await this._asave_documents();
  }

  getEmbeddings(): readonly unknown[] {
    return this.chunkEmbeddings;
  }

  get_embeddings(): readonly unknown[] {
    return this.getEmbeddings();
  }

  chunkText(text: string): string[] {
    const chunks: string[] = [];
    const step = this.chunkSize - this.chunkOverlap;
    for (let index = 0; index < text.length; index += step) {
      chunks.push(text.slice(index, index + this.chunkSize));
    }
    return chunks;
  }

  _chunk_text(text: string): string[] {
    return this.chunkText(text);
  }

  saveDocuments(): void {
    if (!this.storage) {
      throw new Error("No storage found to save documents.");
    }
    this.storage.save(this.chunks);
  }

  _save_documents(): void {
    this.saveDocuments();
  }

  async asaveDocuments(): Promise<void> {
    if (!this.storage) {
      throw new Error("No storage found to save documents.");
    }
    await this.storage.asave(this.chunks);
  }

  async _asave_documents(): Promise<void> {
    await this.asaveDocuments();
  }
}

export type KnowledgeOptions = {
  sources?: readonly KnowledgeSource[];
  collectionName?: string | null;
  collection_name?: string | null;
  storage?: BaseKnowledgeStorage | null;
  embedder?: EmbedderConfig | null;
};

export type KnowledgeStorageOptions = {
  collectionName?: string | null;
  collection_name?: string | null;
  client?: RagClient | null;
  embedder?: EmbedderConfig | null;
};

export class StringKnowledgeSource implements KnowledgeSource {
  readonly sourceType = "string";
  readonly source_type = "string";
  readonly content: string;
  readonly chunkSize: number;
  readonly chunkOverlap: number;
  readonly metadata: Record<string, unknown>;
  readonly collectionName: string | null;
  readonly collection_name: string | null;
  storage: BaseKnowledgeStorage | null;

  constructor(options: StringKnowledgeSourceOptions | string) {
    const normalized = typeof options === "string" ? { content: options } : options;
    this.content = normalized.content;
    this.chunkSize = normalized.chunkSize ?? 4000;
    this.chunkOverlap = normalized.chunkOverlap ?? 200;
    this.metadata = normalized.metadata ?? {};
    this.storage = normalized.storage ?? null;
    this.collectionName = normalized.collectionName ?? normalized.collection_name ?? null;
    this.collection_name = this.collectionName;
    if (this.chunkSize <= 0) {
      throw new Error("StringKnowledgeSource chunkSize must be a positive number.");
    }
    if (this.chunkOverlap < 0 || this.chunkOverlap >= this.chunkSize) {
      throw new Error("StringKnowledgeSource chunkOverlap must be smaller than chunkSize.");
    }
    this.validate_content();
  }

  model_post_init(_context: unknown = null): void {
    void _context;
    this.validateContent();
  }

  validateContent(): void {
    if (typeof this.content !== "string") {
      throw new Error("StringKnowledgeSource only accepts string content");
    }
  }

  validate_content(): void {
    this.validateContent();
  }

  chunks(): readonly string[] {
    return this._chunk_text(this.content);
  }

  _chunk_text(text: string): string[] {
    return [...chunkText(text, this.chunkSize, this.chunkOverlap)];
  }

  add(): void {
    this.saveDocuments(this.chunks());
  }

  async aadd(): Promise<void> {
    await this.asaveDocuments(this.chunks());
  }

  getEmbeddings(): readonly unknown[] {
    return [];
  }

  get_embeddings(): readonly unknown[] {
    return this.getEmbeddings();
  }

  saveDocuments(documents: readonly string[] = this.chunks()): void {
    if (!this.storage) {
      throw new Error("No storage found to save documents.");
    }
    this.storage.save(documents);
  }

  _save_documents(): void {
    this.saveDocuments();
  }

  async asaveDocuments(documents: readonly string[] = this.chunks()): Promise<void> {
    if (!this.storage) {
      throw new Error("No storage found to save documents.");
    }
    await this.storage.asave(documents);
  }

  async _asave_documents(): Promise<void> {
    await this.asaveDocuments();
  }
}

abstract class BaseTextKnowledgeSource implements KnowledgeSource {
  abstract readonly sourceType: string;
  readonly chunkSize: number;
  readonly chunkOverlap: number;
  readonly metadata: Record<string, unknown>;
  readonly collectionName: string | null;
  readonly collection_name: string | null;
  storage: BaseKnowledgeStorage | null;

  protected constructor(options: Pick<FileKnowledgeSourceOptions, "chunkSize" | "chunkOverlap" | "metadata" | "storage" | "collectionName" | "collection_name">) {
    this.chunkSize = options.chunkSize ?? 4000;
    this.chunkOverlap = options.chunkOverlap ?? 200;
    this.metadata = options.metadata ?? {};
    this.storage = options.storage ?? null;
    this.collectionName = options.collectionName ?? options.collection_name ?? null;
    this.collection_name = this.collectionName;
    if (this.chunkSize <= 0) {
      throw new Error(`${this.constructor.name} chunkSize must be a positive number.`);
    }
    if (this.chunkOverlap < 0 || this.chunkOverlap >= this.chunkSize) {
      throw new Error(`${this.constructor.name} chunkOverlap must be smaller than chunkSize.`);
    }
  }

  chunks(): readonly string[] {
    return chunkText(this.loadText(), this.chunkSize, this.chunkOverlap);
  }

  _chunk_text(text: string): string[] {
    return [...chunkText(text, this.chunkSize, this.chunkOverlap)];
  }

  validateContent(): void {
    void this.loadText();
  }

  validate_content(): void {
    this.validateContent();
  }

  add(): void {
    this.saveDocuments(this.chunks());
  }

  async aadd(): Promise<void> {
    await this.asaveDocuments(this.chunks());
  }

  getEmbeddings(): readonly unknown[] {
    return [];
  }

  get_embeddings(): readonly unknown[] {
    return this.getEmbeddings();
  }

  protected abstract loadText(): string;

  saveDocuments(documents: readonly string[] = this.chunks()): void {
    if (!this.storage) {
      throw new Error("No storage found to save documents.");
    }
    this.storage.save(documents);
  }

  _save_documents(): void {
    this.saveDocuments();
  }

  async asaveDocuments(documents: readonly string[] = this.chunks()): Promise<void> {
    if (!this.storage) {
      throw new Error("No storage found to save documents.");
    }
    await this.storage.asave(documents);
  }

  async _asave_documents(): Promise<void> {
    await this.asaveDocuments();
  }
}

export abstract class BaseFileKnowledgeSource extends BaseTextKnowledgeSource {
  readonly filePath: string | readonly string[] | null;
  readonly file_path: string | readonly string[] | null;
  readonly filePaths: readonly string[];
  readonly file_paths: readonly string[];
  safeFilePaths: string[] = [];
  safe_file_paths: string[] = this.safeFilePaths;
  content: Record<string, string> = {};

  protected constructor(options: FileKnowledgeSourceOptions | string | readonly string[]) {
    const normalized = normalizeFileKnowledgeOptions(options);
    super(normalized);
    this.filePath = isFileKnowledgeOptionsObject(options) ? options.file_path ?? null : null;
    this.file_path = this.filePath;
    this.filePaths = normalized.filePaths;
    this.file_paths = this.filePaths;
  }

  model_post_init(_context: unknown = null): void {
    void _context;
    this.safeFilePaths = this.processFilePaths();
    this.safe_file_paths = this.safeFilePaths;
    this.validateContent();
    this.content = this.load_content();
  }

  validateFilePath(
    value: string | readonly string[] | null,
    info: { field_name?: string; data?: Record<string, unknown> } = {},
  ): string | readonly string[] | null {
    const alternate = info.field_name === "file_paths" ? "file_path" : "file_paths";
    if (value === null && info.data?.[alternate] === undefined) {
      return null;
    }
    return value;
  }

  validate_file_path(
    value: string | readonly string[] | null,
    info: { field_name?: string; data?: Record<string, unknown> } = {},
  ): string | readonly string[] | null {
    return this.validateFilePath(value, info);
  }

  override validateContent(): void {
    for (const filePath of this.safeFilePaths) {
      readFileSync(filePath);
    }
  }

  override validate_content(): void {
    this.validateContent();
  }

  abstract loadContent(): Record<string, string>;

  load_content(): Record<string, string> {
    return this.loadContent();
  }

  _load_content(): unknown {
    return this.loadContent();
  }

  convertToPath(filePath: string): string {
    return isAbsolute(filePath) ? filePath : join(KNOWLEDGE_DIRECTORY, filePath);
  }

  convert_to_path(filePath: string): string {
    return this.convertToPath(filePath);
  }

  protected override loadText(): string {
    return Object.values(this.content).join("\n");
  }

  protected processFilePaths(): string[] {
    if (this.filePaths.length === 0) {
      throw new Error("file_path/file_paths must be a Path, str, or a list of these types");
    }
    return this.filePaths.map((filePath) => this.convertToPath(filePath));
  }

  _process_file_paths(): string[] {
    return this.processFilePaths();
  }
}

export class TextFileKnowledgeSource extends BaseFileKnowledgeSource {
  readonly sourceType = "text_file";
  readonly source_type = "text_file";

  constructor(options: FileKnowledgeSourceOptions | string | readonly string[]) {
    super(options);
    this.model_post_init();
  }

  loadContent(): Record<string, string> {
    return Object.fromEntries(this.safeFilePaths.map((filePath) => [filePath, readFileSync(filePath, "utf8")]));
  }
}

export class JSONKnowledgeSource extends BaseFileKnowledgeSource {
  readonly sourceType = "json";
  readonly source_type = "json";

  constructor(options: FileKnowledgeSourceOptions | string | readonly string[]) {
    super(options);
    this.model_post_init();
  }

  loadContent(): Record<string, string> {
    return Object.fromEntries(this.safeFilePaths.map((filePath) => [
      filePath,
      this._json_to_text(JSON.parse(readFileSync(filePath, "utf8"))),
    ]));
  }

  _json_to_text(data: unknown, level = 0): string {
    return jsonToText(data, level);
  }
}

export class CSVKnowledgeSource extends BaseFileKnowledgeSource {
  readonly sourceType = "csv";
  readonly source_type = "csv";

  constructor(options: FileKnowledgeSourceOptions | string | readonly string[]) {
    super(options);
    this.model_post_init();
  }

  loadContent(): Record<string, string> {
    return Object.fromEntries(this.safeFilePaths.map((filePath) => [
      filePath,
      parseCsv(readFileSync(filePath, "utf8"))
        .map((row) => row.join(" "))
        .join("\n"),
    ]));
  }
}

export class PDFKnowledgeSource extends BaseFileKnowledgeSource {
  readonly sourceType = "pdf";
  readonly source_type = "pdf";
  private readonly extractor: PDFTextExtractor | null;

  constructor(options: PDFKnowledgeSourceOptions | string | readonly string[]) {
    super(options);
    this.extractor = isFileKnowledgeOptionsObject(options) && "extractor" in options ? options.extractor ?? null : null;
    if (this.extractor) {
      this.model_post_init();
    } else {
      this.safeFilePaths = this.processFilePaths();
      this.safe_file_paths = this.safeFilePaths;
      this.validateContent();
    }
  }

  loadContent(): Record<string, string> {
    const extractor = this.extractor ?? defaultPDFTextExtractor;
    return Object.fromEntries(this.safeFilePaths.map((filePath) => [filePath, extractor(filePath, readFileSync(filePath))]));
  }

  _import_pdfplumber(): never {
    throw new Error("pdfplumber is not available in the TypeScript runtime. Pass a PDF extractor or use aadd() for the built-in parser.");
  }

  override _chunk_text(text: string): string[] {
    return [...chunkText(text, this.chunkSize, this.chunkOverlap)];
  }

  override add(): void {
    if (!this.extractor && Object.keys(this.content).length === 0) {
      throw new Error("PDFKnowledgeSource default parsing is asynchronous. Use aadd() or pass a synchronous extractor.");
    }
    super.add();
  }

  override async aadd(): Promise<void> {
    if (this.extractor) {
      await super.aadd();
      return;
    }
    this.content = await this.loadContentAsync();
    if (!this.storage) {
      throw new Error("No storage found to save documents.");
    }
    await this.storage.asave(this.chunks());
  }

  private async loadContentAsync(): Promise<Record<string, string>> {
    return Object.fromEntries(await Promise.all(this.safeFilePaths.map(async (filePath) => [
      filePath,
      await defaultPDFTextExtractorAsync(readFileSync(filePath)),
    ] as const)));
  }
}

export class ExcelKnowledgeSource extends BaseFileKnowledgeSource {
  readonly sourceType = "excel";
  readonly source_type = "excel";
  private readonly extractor: ExcelTextExtractor | null;

  constructor(options: ExcelKnowledgeSourceOptions | string | readonly string[]) {
    super(options);
    this.extractor = isFileKnowledgeOptionsObject(options) && "extractor" in options ? options.extractor ?? null : null;
    this.model_post_init();
  }

  loadContent(): Record<string, string> {
    const extractor = this.extractor ?? defaultExcelTextExtractor;
    return Object.fromEntries(this.safeFilePaths.map((filePath) => [
      filePath,
      excelContentToText(extractor(filePath, readFileSync(filePath))),
    ]));
  }

  _import_dependencies(): { readWorkbook: typeof parseXlsxWorkbook } {
    return { readWorkbook: parseXlsxWorkbook };
  }
}

export class CrewDoclingSource extends BaseFileKnowledgeSource {
  readonly sourceType = "docling";
  readonly source_type = "docling";
  private readonly documentConverter: DoclingDocumentConverter;
  private readonly chunker: DoclingChunker | null;
  private doclingDocuments: unknown[] = [];

  constructor(options: CrewDoclingSourceOptions | string | readonly string[]) {
    super(options);
    const converter = isFileKnowledgeOptionsObject(options) ? options.documentConverter ?? options.document_converter : null;
    if (!converter) {
      throw new Error("CrewDoclingSource requires a docling document converter. Pass { documentConverter } / { document_converter } or use TextFileKnowledgeSource, JSONKnowledgeSource, CSVKnowledgeSource, PDFKnowledgeSource with an extractor, or ExcelKnowledgeSource with an extractor in TypeScript.");
    }
    this.documentConverter = converter;
    this.chunker = isFileKnowledgeOptionsObject(options) ? options.chunker ?? null : null;
    Object.defineProperty(this, "chunks", {
      value: [],
      writable: true,
      enumerable: true,
      configurable: true,
    });
    this.model_post_init();
  }

  override model_post_init(_context: unknown = null): void {
    void _context;
    this.safeFilePaths = this.validateContent();
    this.safe_file_paths = this.safeFilePaths;
    this.doclingDocuments = this._load_content();
  }

  override validateContent(): string[] {
    const processedPaths: string[] = [];
    for (const filePath of this.filePaths) {
      if (isHttpUrl(filePath)) {
        if (!isValidHttpUrl(filePath)) {
          throw new Error(`Invalid URL format: ${filePath}`);
        }
        processedPaths.push(filePath);
        continue;
      }
      const localPath = this.convertToPath(filePath);
      if (!existsSync(localPath)) {
        throw new Error(`File not found: ${localPath}`);
      }
      if (!statSync(localPath).isFile()) {
        throw new Error(`Path is not a file: ${localPath}`);
      }
      processedPaths.push(localPath);
    }
    return processedPaths;
  }

  override validate_content(): string[] {
    return this.validateContent();
  }

  override loadContent(): Record<string, string> {
    return Object.fromEntries(this.doclingDocuments.map((document, index) => [
      this.safeFilePaths[index] ?? String(index),
      this.chunkDoc(document).join("\n"),
    ]));
  }

  override load_content(): Record<string, string> {
    return this.loadContent();
  }

  override _load_content(): unknown[] {
    return this.convertSourceToDoclingDocuments();
  }

  add(): void {
    if (this.doclingDocuments.length === 0) {
      return;
    }
    const newChunks = this.doclingDocuments.flatMap((document) => this.chunkDoc(document));
    (this as unknown as { chunks: string[] }).chunks.push(...newChunks);
    this.saveDoclingDocuments();
  }

  async aadd(): Promise<void> {
    if (this.doclingDocuments.length === 0) {
      return;
    }
    const newChunks = this.doclingDocuments.flatMap((document) => this.chunkDoc(document));
    (this as unknown as { chunks: string[] }).chunks.push(...newChunks);
    await this.asaveDoclingDocuments();
  }

  _convert_source_to_docling_documents(): unknown[] {
    return this.convertSourceToDoclingDocuments();
  }

  _chunk_doc(document: unknown): Iterable<string> {
    return this.chunkDoc(document);
  }

  _save_documents(): void {
    this.saveDoclingDocuments();
  }

  async _asave_documents(): Promise<void> {
    await this.asaveDoclingDocuments();
  }

  _validate_url(url: string): boolean {
    return isValidHttpUrl(url);
  }

  private convertSourceToDoclingDocuments(): unknown[] {
    const converter = this.documentConverter;
    const results = typeof converter === "function"
      ? converter(this.safeFilePaths)
      : (converter.convert_all ?? converter.convertAll)?.(this.safeFilePaths);
    if (!results) {
      throw new Error("CrewDoclingSource document converter must expose convert_all or convertAll.");
    }
    return [...results].map((result) => {
      if (result && typeof result === "object" && "document" in result) {
        return (result as { document?: unknown }).document;
      }
      return result;
    });
  }

  private chunkDoc(document: unknown): string[] {
    if (!this.chunker) {
      return [stringifyKnowledgeDocument(document)];
    }
    const chunks = typeof this.chunker === "function"
      ? this.chunker(document)
      : this.chunker.chunk?.(document);
    if (!chunks) {
      throw new Error("CrewDoclingSource chunker must expose chunk.");
    }
    return [...chunks]
      .map((chunk) => typeof chunk === "string" ? chunk : stringifyDoclingValue(chunk.text))
      .filter((chunk) => chunk.length > 0);
  }

  private saveDoclingDocuments(): void {
    if (!this.storage) {
      throw new Error("No storage found to save documents.");
    }
    this.storage.save((this as unknown as { chunks: string[] }).chunks);
  }

  private async asaveDoclingDocuments(): Promise<void> {
    if (!this.storage) {
      throw new Error("No storage found to save documents.");
    }
    await this.storage.asave((this as unknown as { chunks: string[] }).chunks);
  }
}

export class SourceHelper {
  static readonly SUPPORTED_FILE_TYPES = [".csv", ".pdf", ".json", ".txt", ".xlsx", ".xls"] as const;
  static readonly _FILE_TYPE_MAP = {
    ".csv": CSVKnowledgeSource,
    ".pdf": PDFKnowledgeSource,
    ".json": JSONKnowledgeSource,
    ".txt": TextFileKnowledgeSource,
    ".xlsx": ExcelKnowledgeSource,
    ".xls": ExcelKnowledgeSource,
  } as const;

  readonly supportedFileTypes = SourceHelper.SUPPORTED_FILE_TYPES;
  readonly _fileTypeMap = SourceHelper._FILE_TYPE_MAP;
  readonly _file_type_map = SourceHelper._FILE_TYPE_MAP;

  isSupportedFile(filePath: string): boolean {
    return SourceHelper.isSupportedFile(filePath);
  }

  getSource(filePath: string, metadata?: Record<string, unknown> | null): KnowledgeSource {
    return SourceHelper.getSource(filePath, metadata);
  }

  static isSupportedFile(filePath: string): boolean {
    return this.SUPPORTED_FILE_TYPES.includes(extname(filePath).toLowerCase() as typeof SourceHelper.SUPPORTED_FILE_TYPES[number]);
  }

  static is_supported_file(filePath: string): boolean {
    return this.isSupportedFile(filePath);
  }

  static getSource(filePath: string, metadata?: Record<string, unknown> | null): KnowledgeSource {
    const extension = extname(filePath).toLowerCase();
    if (!this.isSupportedFile(filePath)) {
      throw new Error(`Unsupported file type: ${filePath}`);
    }
    const SourceClass = this._FILE_TYPE_MAP[extension as keyof typeof SourceHelper._FILE_TYPE_MAP];
    return new SourceClass({
      file_path: [filePath],
      ...(metadata === undefined || metadata === null ? {} : { metadata }),
    });
  }

  static get_source(filePath: string, metadata?: Record<string, unknown> | null): KnowledgeSource {
    return this.getSource(filePath, metadata);
  }
}

export class Knowledge {
  readonly sources: readonly KnowledgeSource[];
  readonly collectionName: string | null;
  readonly collection_name: string | null;
  readonly storage: BaseKnowledgeStorage | null;
  private entries: KnowledgeEntry[] = [];

  constructor(options: KnowledgeOptions = {}) {
    this.sources = options.sources ?? [];
    this.collectionName = options.collectionName ?? options.collection_name ?? null;
    this.collection_name = this.collectionName;
    this.storage = options.storage ?? (
      options.embedder
        ? new KnowledgeStorage({ collectionName: this.collectionName, embedder: options.embedder })
        : null
    );
    this.addSources();
  }

  addSources(sources: readonly KnowledgeSource[] = this.sources): void {
    if (this.storage) {
      for (const source of sources) {
        source.storage = this.storage;
        if (source.add) {
          source.add();
        } else {
          this.storage.save([...source.chunks()]);
        }
      }
      return;
    }
    for (const source of sources) {
      for (const chunk of source.chunks()) {
        this.entries.push({
          content: chunk,
          source: source.sourceType ?? null,
          metadata: source.metadata ?? {},
        });
      }
    }
  }

  add_sources(sources: readonly KnowledgeSource[] = this.sources): void {
    this.addSources(sources);
  }

  async aaddSources(sources: readonly KnowledgeSource[] = this.sources): Promise<void> {
    if (this.storage) {
      for (const source of sources) {
        source.storage = this.storage;
        if (source.aadd) {
          await source.aadd();
        } else {
          await this.storage.asave([...source.chunks()]);
        }
      }
      return;
    }
    this.addSources(sources);
  }

  async aadd_sources(sources: readonly KnowledgeSource[] = this.sources): Promise<void> {
    await this.aaddSources(sources);
  }

  add(content: string, options: { source?: string | null; metadata?: Record<string, unknown> | null } = {}): void {
    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }
    this.entries.push({
      content: trimmed,
      source: options.source ?? null,
      metadata: options.metadata ?? {},
    });
  }

  query(query: string | readonly string[], options: KnowledgeQueryOptions = {}): KnowledgeSearchResult[] {
    const queries: readonly string[] = typeof query === "string" ? [query] : query;
    const resultsLimit = options.resultsLimit ?? options.results_limit ?? 5;
    const scoreThreshold = "scoreThreshold" in options
      ? options.scoreThreshold
      : "score_threshold" in options
        ? options.score_threshold
        : DEFAULT_KNOWLEDGE_SCORE_THRESHOLD;
    if (this.storage) {
      return this.storage.search(queries, resultsLimit, null, scoreThreshold ?? 0).map(searchResultToKnowledgeResult);
    }
    const queryTerms = new Set(queries.flatMap((value) => [...tokenize(value)]));
    return this.entries
      .map((entry) => ({
        ...entry,
        score: scoreContent(entry.content, queryTerms),
      }))
      .filter((result) => scoreThreshold === null || result.score >= scoreThreshold)
      .sort((left, right) => right.score - left.score)
      .slice(0, resultsLimit);
  }

  async aquery(query: string | readonly string[], options: KnowledgeQueryOptions = {}): Promise<KnowledgeSearchResult[]> {
    const queries: readonly string[] = typeof query === "string" ? [query] : query;
    const resultsLimit = options.resultsLimit ?? options.results_limit ?? 5;
    const scoreThreshold = "scoreThreshold" in options
      ? options.scoreThreshold
      : "score_threshold" in options
        ? options.score_threshold
        : DEFAULT_KNOWLEDGE_SCORE_THRESHOLD;
    if (this.storage) {
      return (await this.storage.asearch(queries, resultsLimit, null, scoreThreshold ?? 0)).map(searchResultToKnowledgeResult);
    }
    return this.query(queries, options);
  }

  reset(): void {
    if (this.storage) {
      this.storage.reset();
      return;
    }
    this.entries = [];
  }

  async areset(): Promise<void> {
    if (this.storage) {
      await this.storage.areset();
      return;
    }
    this.reset();
  }

  private documentsFromSources(sources: readonly KnowledgeSource[]): string[] {
    return sources.flatMap((source) => [...source.chunks()]);
  }
}

export abstract class BaseKnowledgeStorage {
  abstract search(
    query: readonly string[],
    limit?: number,
    metadataFilter?: Record<string, unknown> | null,
    scoreThreshold?: number,
  ): SearchResult[];

  abstract asearch(
    query: readonly string[],
    limit?: number,
    metadataFilter?: Record<string, unknown> | null,
    scoreThreshold?: number,
  ): Promise<SearchResult[]>;

  abstract save(documents: readonly string[]): void;

  abstract asave(documents: readonly string[]): Promise<void>;

  abstract reset(): void;

  abstract areset(): Promise<void>;
}

export class KnowledgeStorage extends BaseKnowledgeStorage {
  readonly collectionName: string | null;
  readonly collection_name: string | null;
  readonly embedder: EmbedderConfig | null;
  private client: RagClient | null;

  constructor(options: KnowledgeStorageOptions = {}) {
    super();
    this.collectionName = options.collectionName ?? options.collection_name ?? null;
    this.collection_name = this.collectionName;
    this.client = options.client ?? null;
    this.embedder = options.embedder ?? null;
    this._init_client();
  }

  _init_client(): this {
    if (this.embedder && !this.client) {
      const embedder = buildEmbedder(this.embedder);
      const embeddingFunction: EmbeddingFunction = (input: unknown) => embedder(input as Parameters<typeof embedder>[0]);
      this.client = createRagClient(new ChromaDBConfig({
        embeddingFunction,
      }));
    }
    return this;
  }

  search(
    query: readonly string[],
    limit = 5,
    metadataFilter: Record<string, unknown> | null = null,
    scoreThreshold = 0.6,
  ): SearchResult[] {
    if (query.length === 0) {
      return [];
    }
    try {
      const client = this._get_client() as RagClient & {
        search?: (params: Record<string, unknown>) => unknown;
      };
      const result = client.search?.({
        collection_name: this.rag_collection_name(),
        query: query.length > 1 ? query.join(" ") : query[0] ?? "",
        limit,
        metadata_filter: metadataFilter,
        score_threshold: scoreThreshold,
      });
      return Array.isArray(result) ? result as SearchResult[] : [];
    } catch {
      return [];
    }
  }

  async asearch(
    query: readonly string[],
    limit = 5,
    metadataFilter: Record<string, unknown> | null = null,
    scoreThreshold = 0.6,
  ): Promise<SearchResult[]> {
    if (query.length === 0) {
      return [];
    }
    try {
      const client = this._get_client() as RagClient & {
        asearch?: (params: Record<string, unknown>) => Promise<SearchResult[]>;
      };
      const params = {
        collection_name: this.rag_collection_name(),
        query: query.length > 1 ? query.join(" ") : query[0] ?? "",
        limit,
        metadata_filter: metadataFilter,
        score_threshold: scoreThreshold,
      };
      const syncClient = client as unknown as RagClient & {
        search?: (searchParams: Record<string, unknown>) => unknown;
      };
      const result = client.asearch ? await client.asearch(params) : await Promise.resolve(syncClient.search?.(params));
      return Array.isArray(result) ? result as SearchResult[] : [];
    } catch {
      return [];
    }
  }

  save(documents: readonly string[]): void {
    if (documents.length === 0) {
      return;
    }
    try {
      const client = this._get_client() as RagClient & {
        get_or_create_collection?: (params: Record<string, unknown>) => unknown;
        add_documents?: (params: { collection_name: string; documents: BaseRecord[] }) => unknown;
      };
      client.get_or_create_collection?.({ collection_name: this.rag_collection_name() });
      const ragDocuments = documents.map((content) => ({ content }));
      if (client.add_documents) {
        client.add_documents({ collection_name: this.rag_collection_name(), documents: ragDocuments });
        return;
      }
      client.add?.(this.rag_collection_name(), ragDocuments);
    } catch (error) {
      throw normalizeKnowledgeStorageSaveError(error);
    }
  }

  async asave(documents: readonly string[]): Promise<void> {
    if (documents.length === 0) {
      return;
    }
    try {
      const client = this._get_client() as RagClient & {
        aget_or_create_collection?: (params: Record<string, unknown>) => Promise<unknown>;
        aadd_documents?: (params: { collection_name: string; documents: BaseRecord[] }) => Promise<unknown>;
      };
      await client.aget_or_create_collection?.({ collection_name: this.rag_collection_name() });
      const ragDocuments = documents.map((content) => ({ content }));
      if (client.aadd_documents) {
        await client.aadd_documents({ collection_name: this.rag_collection_name(), documents: ragDocuments });
        return;
      }
      this.save(documents);
    } catch (error) {
      throw normalizeKnowledgeStorageSaveError(error);
    }
  }

  reset(): void {
    try {
      const client = this._get_client() as RagClient & {
        delete_collection?: (params: Record<string, unknown>) => unknown;
      };
      if (client.delete_collection) {
        client.delete_collection({ collection_name: this.rag_collection_name() });
        return;
      }
      const deleteCollection = client.deleteCollection as ((collectionName: string) => unknown) | undefined;
      deleteCollection?.(this.rag_collection_name());
    } catch {
      // Upstream logs reset failures and keeps knowledge reset best-effort.
    }
  }

  async areset(): Promise<void> {
    try {
      const client = this._get_client() as RagClient & {
        adelete_collection?: (params: Record<string, unknown>) => Promise<unknown>;
      };
      if (client.adelete_collection) {
        await client.adelete_collection({ collection_name: this.rag_collection_name() });
        return;
      }
      this.reset();
    } catch {
      // Upstream logs reset failures and keeps knowledge reset best-effort.
    }
  }

  _get_client(): RagClient {
    return this.client ?? getRagClient();
  }

  get _client(): RagClient | null {
    return this.client;
  }

  set _client(client: RagClient | null) {
    this.client = client;
  }

  ragCollectionName(): string {
    return this.collectionName ? `knowledge_${this.collectionName}` : "knowledge";
  }

  rag_collection_name(): string {
    return this.ragCollectionName();
  }
}

export function extractKnowledgeContext(results: readonly unknown[]): string {
  const content = results
    .map((result) => {
      if (!result || typeof result !== "object" || Array.isArray(result)) {
        return "";
      }
      const content = (result as { content?: unknown }).content;
      return typeof content === "string" ? content.trim() : "";
    })
    .filter(Boolean)
    .join("\n");
  return content ? `Additional Information:\n${content}` : "";
}

function searchResultToKnowledgeResult(result: SearchResult): KnowledgeSearchResult {
  const metadata = result.metadata ?? {};
  return {
    content: result.content,
    score: result.score ?? 0,
    source: typeof metadata.source === "string" ? metadata.source : null,
    metadata,
  };
}

function normalizeKnowledgeStorageSaveError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase().includes("dimension mismatch")) {
    return new Error(
      "Embedding dimension mismatch. Make sure you're using the same embedding model across all operations with this collection."
      + " Try resetting the collection using `crewai reset-memories -a`",
    );
  }
  return error instanceof Error ? error : new Error(message);
}

function tokenize(value: string): Set<string> {
  return new Set(value.toLowerCase().split(/[^a-z0-9가-힣]+/).filter(Boolean));
}

function scoreContent(content: string, queryTerms: Set<string>): number {
  if (queryTerms.size === 0) {
    return 0;
  }
  const contentTerms = tokenize(content);
  let matches = 0;
  for (const term of queryTerms) {
    if (contentTerms.has(term) || content.toLowerCase().includes(term)) {
      matches += 1;
    }
  }
  if (matches === 0) {
    return 0;
  }
  return Math.max(matches / queryTerms.size, DEFAULT_KNOWLEDGE_SCORE_THRESHOLD);
}

function normalizeFileKnowledgeOptions(
  options: FileKnowledgeSourceOptions | string | readonly string[],
): FileKnowledgeSourceOptions & { filePaths: readonly string[] } {
  if (typeof options === "string") {
    return { filePaths: [options] };
  }
  if (!isFileKnowledgeOptionsObject(options)) {
    return { filePaths: options };
  }
  if (options.filePaths === undefined) {
    const paths = options.file_paths ?? options.file_path;
    if (paths === undefined) {
      throw new Error("Either filePaths, file_paths, or file_path must be provided.");
    }
    return {
      ...options,
      filePaths: typeof paths === "string" ? [paths] : paths,
    };
  }
  return {
    ...options,
    filePaths: typeof options.filePaths === "string" ? [options.filePaths] : options.filePaths,
  };
}

function isFileKnowledgeOptionsObject(value: unknown): value is FileKnowledgeSourceOptions {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function chunkText(text: string, chunkSize: number, chunkOverlap: number): readonly string[] {
  const step = chunkSize - chunkOverlap;
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += step) {
    const chunk = text.slice(index, index + chunkSize).trim();
    if (chunk) {
      chunks.push(chunk);
    }
  }
  return chunks;
}

function jsonToText(value: unknown, level = 0): string {
  const indent = "  ".repeat(level);
  if (Array.isArray(value)) {
    return value.map((item) => `${indent}- ${jsonToText(item, level + 1)}`).join("\n");
  }
  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([key, nestedValue]) => `${indent}${key}: ${jsonToText(nestedValue, level + 1)}`)
      .join("\n");
  }
  return String(value);
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index] ?? "";
    const next = content[index + 1] ?? "";
    if (char === "\"") {
      if (inQuotes && next === "\"") {
        field += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(field);
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      field = "";
      continue;
    }
    field += char;
  }
  row.push(field);
  if (row.some((value) => value.length > 0)) {
    rows.push(row);
  }
  return rows;
}

function defaultPDFTextExtractor(filePath: string): string {
  throw new Error(`PDFKnowledgeSource default parsing is asynchronous for '${filePath}'. Use aadd() or pass a synchronous extractor.`);
}

function defaultExcelTextExtractor(filePath: string): ExcelWorkbookData {
  return parseXlsxWorkbook(readFileSync(filePath));
}

function excelContentToText(content: ExcelWorkbookData | string): string {
  if (typeof content === "string") {
    return content;
  }
  return Object.entries(content)
    .map(([sheetName, rows]) => [
      `Sheet: ${sheetName}`,
      rows.map((row) => row.map(formatExcelCell).join(" ")).join("\n"),
    ].join("\n"))
    .join("\n");
}

function formatExcelCell(cell: unknown): string {
  if (cell === null || cell === undefined) {
    return "";
  }
  if (typeof cell === "string" || typeof cell === "number" || typeof cell === "boolean" || typeof cell === "bigint") {
    return String(cell);
  }
  if (cell instanceof Date) {
    return cell.toISOString();
  }
  return JSON.stringify(cell);
}

async function defaultPDFTextExtractorAsync(bytes: Buffer): Promise<string> {
  const module = await import("pdf-parse");
  const PDFParse = module.PDFParse as new (options: { data: Buffer }) => {
    getText(): Promise<{ text?: string }>;
    destroy?: () => Promise<void> | void;
  };
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy?.();
  }
}

function parseXlsxWorkbook(bytes: Buffer): ExcelWorkbookData {
  const entries = readZipEntries(bytes);
  const workbookXml = getZipText(entries, "xl/workbook.xml");
  const workbookRels = parseRelationships(getZipText(entries, "xl/_rels/workbook.xml.rels", false));
  const sharedStrings = parseSharedStrings(getZipText(entries, "xl/sharedStrings.xml", false));
  const result: Record<string, string[][]> = {};
  for (const sheet of parseWorkbookSheets(workbookXml)) {
    const target = workbookRels[sheet.rid] ?? `worksheets/sheet${String(Object.keys(result).length + 1)}.xml`;
    const sheetXml = getZipText(entries, normalizeXlsxPath(`xl/${target}`), false);
    if (sheetXml) {
      result[sheet.name] = parseWorksheet(sheetXml, sharedStrings);
    }
  }
  return result;
}

function readZipEntries(bytes: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 30 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50) {
    const flags = bytes.readUInt16LE(offset + 6);
    const method = bytes.readUInt16LE(offset + 8);
    const compressedSize = bytes.readUInt32LE(offset + 18);
    const fileNameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const name = bytes.subarray(nameStart, nameStart + fileNameLength).toString("utf8");
    if ((flags & 0x08) !== 0) {
      throw new Error("XLSX ZIP data descriptors are not supported.");
    }
    if (method !== 0 && method !== 8) {
      throw new Error(`Unsupported XLSX ZIP compression method: ${String(method)}.`);
    }
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
    entries.set(name, method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed));
    offset = dataStart + compressedSize;
  }
  if (entries.size === 0) {
    throw new Error("Invalid XLSX archive.");
  }
  return entries;
}

function getZipText(entries: Map<string, Buffer>, path: string, required = true): string {
  const value = entries.get(path);
  if (!value) {
    if (required) {
      throw new Error(`XLSX archive is missing ${path}.`);
    }
    return "";
  }
  return value.toString("utf8");
}

function parseRelationships(xml: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const tag of xml.matchAll(/<Relationship\b([^>]*)\/?>(?:<\/Relationship>)?/g)) {
    const attrs = parseXmlAttributes(tag[1] ?? "");
    if (attrs.Id && attrs.Target) {
      result[attrs.Id] = attrs.Target;
    }
  }
  return result;
}

function parseWorkbookSheets(xml: string): { name: string; rid: string }[] {
  return [...xml.matchAll(/<sheet\b([^>]*)\/?>(?:<\/sheet>)?/g)]
    .map((match) => parseXmlAttributes(match[1] ?? ""))
    .filter((attrs): attrs is Record<string, string> & { name: string; "r:id": string } => Boolean(attrs.name && attrs["r:id"]))
    .map((attrs) => ({ name: attrs.name, rid: attrs["r:id"] }));
}

function parseSharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)]
    .map((match) => [...(match[1] ?? "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
      .map((textMatch) => decodeXml(textMatch[1] ?? ""))
      .join(""));
}

function parseWorksheet(xml: string, sharedStrings: readonly string[]): string[][] {
  const rows: string[][] = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cellMatch of (rowMatch[1] ?? "").matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = parseXmlAttributes(cellMatch[1] ?? "");
      const body = cellMatch[2] ?? "";
      const value = firstXmlText(body, "v");
      row.push(attrs.t === "s" ? sharedStrings[Number(value)] ?? "" : decodeXml(value));
    }
    rows.push(row);
  }
  return rows;
}

function firstXmlText(xml: string, tag: string): string {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`).exec(xml);
  return match ? match[1] ?? "" : "";
}

function parseXmlAttributes(raw: string): Record<string, string> {
  return Object.fromEntries([...raw.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [match[1] ?? "", decodeXml(match[2] ?? "")]));
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function normalizeXlsxPath(path: string): string {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return parts.join("/");
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.split(".").length >= 2;
  } catch {
    return false;
  }
}

function stringifyKnowledgeDocument(document: unknown): string {
  if (typeof document === "string") {
    return document;
  }
  if (document && typeof document === "object" && "text" in document) {
    return stringifyDoclingValue((document as { text?: string | number | boolean | bigint | null | undefined }).text);
  }
  return JSON.stringify(document);
}

function stringifyDoclingValue(value: string | number | boolean | bigint | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}
