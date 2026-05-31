import { extname } from "node:path";
import { readFileSync } from "node:fs";
import {
  getRagClient,
  type BaseRecord,
  type RagClient,
  type SearchResult,
} from "./rag.js";

export type KnowledgeSearchResult = {
  content: string;
  score: number;
  source: string | null;
  metadata: Record<string, unknown>;
};

export type KnowledgeQueryOptions = {
  resultsLimit?: number;
  scoreThreshold?: number | null;
};

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

type KnowledgeEntry = {
  content: string;
  source: string | null;
  metadata: Record<string, unknown>;
};

export type KnowledgeOptions = {
  sources?: readonly KnowledgeSource[];
  collectionName?: string | null;
  collection_name?: string | null;
  storage?: BaseKnowledgeStorage | null;
};

export type KnowledgeStorageOptions = {
  collectionName?: string | null;
  collection_name?: string | null;
  client?: RagClient | null;
};

export class StringKnowledgeSource implements KnowledgeSource {
  readonly sourceType = "string";
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

  validateContent(): void {
    if (typeof this.content !== "string") {
      throw new Error("StringKnowledgeSource only accepts string content");
    }
  }

  validate_content(): void {
    this.validateContent();
  }

  chunks(): readonly string[] {
    const step = this.chunkSize - this.chunkOverlap;
    const chunks: string[] = [];
    for (let index = 0; index < this.content.length; index += step) {
      const chunk = this.content.slice(index, index + this.chunkSize).trim();
      if (chunk) {
        chunks.push(chunk);
      }
    }
    return chunks;
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

  private saveDocuments(documents: readonly string[]): void {
    if (!this.storage) {
      throw new Error("No storage found to save documents.");
    }
    this.storage.save(documents);
  }

  private async asaveDocuments(documents: readonly string[]): Promise<void> {
    if (!this.storage) {
      throw new Error("No storage found to save documents.");
    }
    await this.storage.asave(documents);
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

  private saveDocuments(documents: readonly string[]): void {
    if (!this.storage) {
      throw new Error("No storage found to save documents.");
    }
    this.storage.save(documents);
  }

  private async asaveDocuments(documents: readonly string[]): Promise<void> {
    if (!this.storage) {
      throw new Error("No storage found to save documents.");
    }
    await this.storage.asave(documents);
  }
}

export class TextFileKnowledgeSource extends BaseTextKnowledgeSource {
  readonly sourceType = "text_file";
  readonly filePaths: readonly string[];

  constructor(options: FileKnowledgeSourceOptions | string | readonly string[]) {
    const normalized = normalizeFileKnowledgeOptions(options);
    super(normalized);
    this.filePaths = normalized.filePaths;
  }

  protected loadText(): string {
    return this.filePaths.map((filePath) => readFileSync(filePath, "utf8")).join("\n");
  }
}

export class JSONKnowledgeSource extends BaseTextKnowledgeSource {
  readonly sourceType = "json";
  readonly filePaths: readonly string[];

  constructor(options: FileKnowledgeSourceOptions | string | readonly string[]) {
    const normalized = normalizeFileKnowledgeOptions(options);
    super(normalized);
    this.filePaths = normalized.filePaths;
  }

  protected loadText(): string {
    return this.filePaths
      .map((filePath) => jsonToText(JSON.parse(readFileSync(filePath, "utf8"))))
      .join("\n");
  }
}

export class CSVKnowledgeSource extends BaseTextKnowledgeSource {
  readonly sourceType = "csv";
  readonly filePaths: readonly string[];

  constructor(options: FileKnowledgeSourceOptions | string | readonly string[]) {
    const normalized = normalizeFileKnowledgeOptions(options);
    super(normalized);
    this.filePaths = normalized.filePaths;
  }

  protected loadText(): string {
    return this.filePaths
      .map((filePath) => parseCsv(readFileSync(filePath, "utf8"))
        .map((row) => row.join(" "))
        .join("\n"))
      .join("\n");
  }
}

export class PDFKnowledgeSource extends BaseTextKnowledgeSource {
  readonly sourceType = "pdf";
  readonly filePaths: readonly string[];
  private readonly extractor: PDFTextExtractor | null;

  constructor(options: PDFKnowledgeSourceOptions | string | readonly string[]) {
    const normalized = normalizeFileKnowledgeOptions(options);
    super(normalized);
    this.filePaths = normalized.filePaths;
    this.extractor = isFileKnowledgeOptionsObject(options) && "extractor" in options ? options.extractor ?? null : null;
  }

  protected loadText(): string {
    const extractor = this.extractor ?? defaultPDFTextExtractor;
    return this.filePaths
      .map((filePath) => extractor(filePath, readFileSync(filePath)))
      .join("\n");
  }
}

export class ExcelKnowledgeSource extends BaseTextKnowledgeSource {
  readonly sourceType = "excel";
  readonly filePaths: readonly string[];
  private readonly extractor: ExcelTextExtractor | null;

  constructor(options: ExcelKnowledgeSourceOptions | string | readonly string[]) {
    const normalized = normalizeFileKnowledgeOptions(options);
    super(normalized);
    this.filePaths = normalized.filePaths;
    this.extractor = isFileKnowledgeOptionsObject(options) && "extractor" in options ? options.extractor ?? null : null;
  }

  protected loadText(): string {
    const extractor = this.extractor ?? defaultExcelTextExtractor;
    return this.filePaths
      .map((filePath) => excelContentToText(extractor(filePath, readFileSync(filePath))))
      .join("\n");
  }
}

export class CrewDoclingSource extends BaseTextKnowledgeSource {
  readonly sourceType = "docling";
  readonly filePaths: readonly string[];

  constructor(options: FileKnowledgeSourceOptions | string | readonly string[]) {
    const normalized = normalizeFileKnowledgeOptions(options);
    super(normalized);
    this.filePaths = normalized.filePaths;
    throw new Error("CrewDoclingSource requires the Python docling package upstream; use TextFileKnowledgeSource, JSONKnowledgeSource, CSVKnowledgeSource, PDFKnowledgeSource with an extractor, or ExcelKnowledgeSource with an extractor in TypeScript.");
  }

  protected loadText(): string {
    return "";
  }
}

export class SourceHelper {
  static readonly SUPPORTED_FILE_TYPES = [".csv", ".pdf", ".json", ".txt", ".xlsx", ".xls"] as const;

  readonly supportedFileTypes = SourceHelper.SUPPORTED_FILE_TYPES;

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
    const options = {
      filePaths: [filePath],
      ...(metadata === undefined || metadata === null ? {} : { metadata }),
    };
    switch (extension) {
      case ".csv":
        return new CSVKnowledgeSource(options);
      case ".json":
        return new JSONKnowledgeSource(options);
      case ".txt":
        return new TextFileKnowledgeSource(options);
      case ".pdf":
        return new PDFKnowledgeSource(options);
      case ".xlsx":
      case ".xls":
        return new ExcelKnowledgeSource(options);
      default:
        throw new Error(`Unsupported file type: ${filePath}`);
    }
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
    this.storage = options.storage ?? null;
    this.addSources();
  }

  addSources(sources: readonly KnowledgeSource[] = this.sources): void {
    if (this.storage) {
      this.storage.save(this.documentsFromSources(sources));
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

  add_sources(): void {
    this.addSources();
  }

  async aaddSources(sources: readonly KnowledgeSource[] = this.sources): Promise<void> {
    if (this.storage) {
      await this.storage.asave(this.documentsFromSources(sources));
      return;
    }
    this.addSources(sources);
  }

  async aadd_sources(): Promise<void> {
    await this.aaddSources();
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
    const resultsLimit = options.resultsLimit ?? 5;
    const scoreThreshold = options.scoreThreshold === undefined ? 0.1 : options.scoreThreshold;
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
    const resultsLimit = options.resultsLimit ?? 5;
    const scoreThreshold = options.scoreThreshold === undefined ? 0.1 : options.scoreThreshold;
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
  private readonly client: RagClient | null;

  constructor(options: KnowledgeStorageOptions = {}) {
    super();
    this.collectionName = options.collectionName ?? options.collection_name ?? null;
    this.collection_name = this.collectionName;
    this.client = options.client ?? null;
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
      const client = this.getClient() as RagClient & {
        search?: (params: Record<string, unknown>) => unknown;
      };
      const result = client.search?.({
        collection_name: this.ragCollectionName(),
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
    const client = this.getClient() as RagClient & {
      asearch?: (params: Record<string, unknown>) => Promise<SearchResult[]>;
    };
    try {
      const params = {
        collection_name: this.ragCollectionName(),
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
    const client = this.getClient() as RagClient & {
      get_or_create_collection?: (params: Record<string, unknown>) => unknown;
      add_documents?: (params: { collection_name: string; documents: BaseRecord[] }) => unknown;
    };
    client.get_or_create_collection?.({ collection_name: this.ragCollectionName() });
    const ragDocuments = documents.map((content) => ({ content }));
    if (client.add_documents) {
      client.add_documents({ collection_name: this.ragCollectionName(), documents: ragDocuments });
      return;
    }
    client.add?.(this.ragCollectionName(), ragDocuments);
  }

  async asave(documents: readonly string[]): Promise<void> {
    if (documents.length === 0) {
      return;
    }
    const client = this.getClient() as RagClient & {
      aget_or_create_collection?: (params: Record<string, unknown>) => Promise<unknown>;
      aadd_documents?: (params: { collection_name: string; documents: BaseRecord[] }) => Promise<unknown>;
    };
    await client.aget_or_create_collection?.({ collection_name: this.ragCollectionName() });
    const ragDocuments = documents.map((content) => ({ content }));
    if (client.aadd_documents) {
      await client.aadd_documents({ collection_name: this.ragCollectionName(), documents: ragDocuments });
      return;
    }
    this.save(documents);
  }

  reset(): void {
    const client = this.getClient() as RagClient & {
      delete_collection?: (params: Record<string, unknown>) => unknown;
    };
    if (client.delete_collection) {
      client.delete_collection({ collection_name: this.ragCollectionName() });
      return;
    }
    const deleteCollection = client.deleteCollection as ((collectionName: string) => unknown) | undefined;
    deleteCollection?.(this.ragCollectionName());
  }

  async areset(): Promise<void> {
    const client = this.getClient() as RagClient & {
      adelete_collection?: (params: Record<string, unknown>) => Promise<unknown>;
    };
    if (client.adelete_collection) {
      await client.adelete_collection({ collection_name: this.ragCollectionName() });
      return;
    }
    this.reset();
  }

  private getClient(): RagClient {
    return this.client ?? getRagClient();
  }

  private ragCollectionName(): string {
    return this.collectionName ? `knowledge_${this.collectionName}` : "knowledge";
  }
}

export function extractKnowledgeContext(results: readonly KnowledgeSearchResult[]): string {
  const content = results
    .map((result) => result.content.trim())
    .filter(Boolean)
    .join("\n");
  return content ? `Additional Information: ${content}` : "";
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
  return matches / queryTerms.size;
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
  throw new Error(`PDFKnowledgeSource requires a PDF text extractor for '${filePath}'. Pass { extractor } or install a parser integration in the host app.`);
}

function defaultExcelTextExtractor(filePath: string): ExcelWorkbookData {
  throw new Error(`ExcelKnowledgeSource requires an Excel extractor for '${filePath}'. Pass { extractor } or install a parser integration in the host app.`);
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
