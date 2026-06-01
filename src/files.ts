import { readFileSync, statSync } from "node:fs";
import { basename, extname, resolve } from "node:path";

export type FileMode = "strict" | "auto" | "warn" | "chunk";

export type FileReadable = {
  read(size?: number): Uint8Array | Buffer | string;
  seek?(position: number): void;
  tell?(): number;
  close?(): void;
  name?: string;
};

export type FileSourceInput = string | Uint8Array | Buffer | FileSource | FileReadable;
export type FileInput = AudioFile | File | ImageFile | PDFFile | TextFile | VideoFile;
export type FileProvider = string;

export abstract class ResolvedFile {
  readonly contentType: string;
  readonly content_type: string;

  protected constructor(contentType: string) {
    this.contentType = contentType;
    this.content_type = contentType;
  }
}

export class InlineBase64 extends ResolvedFile {
  readonly data: string;

  constructor(options: { contentType?: string; content_type?: string; data: string }) {
    super(options.contentType ?? options.content_type ?? "application/octet-stream");
    this.data = options.data;
    Object.freeze(this);
  }
}

export class InlineBytes extends ResolvedFile {
  readonly data: Uint8Array;

  constructor(options: { contentType?: string; content_type?: string; data: Uint8Array | Buffer | string }) {
    super(options.contentType ?? options.content_type ?? "application/octet-stream");
    this.data = typeof options.data === "string" ? Buffer.from(options.data) : Buffer.from(options.data);
    Object.freeze(this);
  }
}

export class FileReference extends ResolvedFile {
  readonly fileId: string;
  readonly file_id: string;
  readonly provider: string;
  readonly expiresAt: Date | null;
  readonly expires_at: Date | null;
  readonly fileUri: string | null;
  readonly file_uri: string | null;

  constructor(options: {
    contentType?: string;
    content_type?: string;
    fileId?: string;
    file_id?: string;
    provider: string;
    expiresAt?: Date | null;
    expires_at?: Date | null;
    fileUri?: string | null;
    file_uri?: string | null;
  }) {
    super(options.contentType ?? options.content_type ?? "application/octet-stream");
    this.fileId = options.fileId ?? options.file_id ?? "";
    this.file_id = this.fileId;
    this.provider = options.provider;
    this.expiresAt = options.expiresAt ?? options.expires_at ?? null;
    this.expires_at = this.expiresAt;
    this.fileUri = options.fileUri ?? options.file_uri ?? null;
    this.file_uri = this.fileUri;
    Object.freeze(this);
  }
}

export class UrlReference extends ResolvedFile {
  readonly url: string;

  constructor(options: { contentType?: string; content_type?: string; url: string }) {
    super(options.contentType ?? options.content_type ?? "application/octet-stream");
    this.url = options.url;
    Object.freeze(this);
  }
}

export type ResolvedFileType = InlineBase64 | InlineBytes | FileReference | UrlReference;

export abstract class FileSource {
  abstract readonly filename: string | null;
  abstract readonly contentType: string;

  get content_type(): string {
    return this.contentType;
  }

  abstract read(): Uint8Array;

  aread(): Promise<Uint8Array> {
    return Promise.resolve(this.read());
  }

  *readChunks(chunkSize = 65536): IterableIterator<Uint8Array> {
    const data = this.read();
    for (let index = 0; index < data.length; index += chunkSize) {
      yield data.subarray(index, index + chunkSize);
    }
  }

  read_chunks(chunkSize = 65536): IterableIterator<Uint8Array> {
    return this.readChunks(chunkSize);
  }
}

export class FilePath extends FileSource {
  readonly path: string;
  readonly maxSizeBytes: number;
  readonly max_size_bytes: number;
  readonly contentType: string;
  private content: Uint8Array | null = null;

  constructor(options: { path: string; maxSizeBytes?: number; max_size_bytes?: number }) {
    super();
    this.path = options.path;
    this.maxSizeBytes = options.maxSizeBytes ?? options.max_size_bytes ?? 100 * 1024 * 1024;
    this.max_size_bytes = this.maxSizeBytes;

    if (this.path.includes("..")) {
      throw new Error(`Path traversal not allowed: ${this.path}`);
    }
    const stats = statSync(this.path, { throwIfNoEntry: false });
    if (!stats) {
      throw new Error(`File not found: ${this.path}`);
    }
    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${this.path}`);
    }
    if (stats.size > this.maxSizeBytes) {
      throw new Error(`File exceeds max size (${String(stats.size)} > ${String(this.maxSizeBytes)})`);
    }
    this.contentType = detectContentType(readFileSync(this.path).subarray(0, 2048), this.filename);
  }

  get filename(): string {
    return basename(this.path);
  }

  read(): Uint8Array {
    this.content ??= readFileSync(this.path);
    return this.content;
  }
}

export class FileBytes extends FileSource {
  readonly data: Uint8Array;
  readonly filename: string | null;
  readonly contentType: string;

  constructor(options: { data: Uint8Array | Buffer | string; filename?: string | null }) {
    super();
    this.data = typeof options.data === "string" ? Buffer.from(options.data) : Buffer.from(options.data);
    this.filename = options.filename ?? null;
    this.contentType = detectContentType(this.data, this.filename);
  }

  read(): Uint8Array {
    return this.data;
  }
}

export class FileStream extends FileSource {
  readonly stream: FileReadable;
  filename: string | null;
  readonly contentType: string;
  private content: Uint8Array | null = null;

  constructor(options: { stream: FileReadable; filename?: string | null }) {
    super();
    this.stream = options.stream;
    this.filename = options.filename ?? (options.stream.name ? basename(options.stream.name) : null);
    const position = typeof options.stream.tell === "function" ? options.stream.tell() : null;
    options.stream.seek?.(0);
    const header = Buffer.from(options.stream.read(2048));
    if (position !== null) {
      options.stream.seek?.(position);
    }
    this.contentType = detectContentType(header, this.filename);
  }

  read(): Uint8Array {
    if (this.content === null) {
      const position = typeof this.stream.tell === "function" ? this.stream.tell() : null;
      this.stream.seek?.(0);
      this.content = Buffer.from(this.stream.read());
      if (position !== null) {
        this.stream.seek?.(position);
      }
    }
    return this.content;
  }

  close(): void {
    this.stream.close?.();
  }
}

export class FileUrl extends FileSource {
  readonly url: string;
  readonly filename: string | null;
  private detectedContentType: string | null = null;
  private content: Uint8Array | null = null;
  private readonly fetcher: ((url: string) => Promise<{ content: Uint8Array | Buffer | string; contentType?: string | null }>) | null;

  constructor(options: {
    url: string;
    filename?: string | null;
    fetcher?: ((url: string) => Promise<{ content: Uint8Array | Buffer | string; contentType?: string | null }>) | null;
  }) {
    super();
    if (!options.url.startsWith("http://") && !options.url.startsWith("https://")) {
      throw new Error(`Invalid URL scheme: ${options.url}`);
    }
    this.url = options.url;
    this.filename = options.filename ?? null;
    this.fetcher = options.fetcher ?? null;
  }

  get contentType(): string {
    this.detectedContentType ??= contentTypeFromFilename(this.filename ?? urlPathname(this.url)) ?? "application/octet-stream";
    return this.detectedContentType;
  }

  override read(): Uint8Array {
    throw new Error("FileUrl.read requires an injected fetcher in this deterministic TypeScript shim. Use aread() with a fetcher or resolve URL-capable providers as UrlReference.");
  }

  override async aread(): Promise<Uint8Array> {
    if (this.content !== null) {
      return this.content;
    }
    if (!this.fetcher) {
      throw new Error("FileUrl.aread requires an injected fetcher in this deterministic TypeScript shim.");
    }
    const fetched = await this.fetcher(this.url);
    this.content = typeof fetched.content === "string" ? Buffer.from(fetched.content) : Buffer.from(fetched.content);
    if (fetched.contentType) {
      this.detectedContentType = fetched.contentType.split(";")[0] ?? fetched.contentType;
    }
    return this.content;
  }
}

export abstract class BaseFile {
  readonly source: FileSource;
  readonly mode: FileMode;

  constructor(options: { source: FileSourceInput; mode?: FileMode } | FileSourceInput) {
    const source = isFileOptions(options) ? options.source : options;
    this.source = coerceFileSource(source);
    this.mode = isFileOptions(options) ? options.mode ?? "auto" : "auto";
  }

  get filename(): string | null {
    return this.source.filename;
  }

  get contentType(): string {
    return this.source.contentType;
  }

  get content_type(): string {
    return this.contentType;
  }

  read(): Uint8Array {
    return this.source.read();
  }

  async aread(): Promise<Uint8Array> {
    return await this.source.aread();
  }

  readText(encoding: BufferEncoding = "utf8"): string {
    return Buffer.from(this.read()).toString(encoding);
  }

  read_text(encoding: BufferEncoding = "utf8"): string {
    return this.readText(encoding);
  }

  keys(): string[] {
    return [this.unpackKey()];
  }

  getItem(key: string): this {
    if (key !== this.unpackKey()) {
      throw new Error(key);
    }
    return this;
  }

  __getitem__(key: string): this {
    return this.getItem(key);
  }

  protected unpackKey(): string {
    const name = this.filename;
    return name ? name.replace(/\.[^.]*$/, "") : "file";
  }
}

export class ImageFile extends BaseFile {}
export class PDFFile extends BaseFile {}
export class TextFile extends BaseFile {}
export class AudioFile extends BaseFile {}
export class VideoFile extends BaseFile {}
export class File extends BaseFile {}

export function detectContentType(data: Uint8Array | Buffer | string, filename?: string | null): string {
  const bytes = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.subarray(0, 4).toString("ascii") === "%PDF") {
    return "application/pdf";
  }
  const byExtension = contentTypeFromFilename(filename);
  if (byExtension && byExtension !== "application/octet-stream") {
    return byExtension;
  }
  const text = bytes.toString("utf8").trim();
  if (text) {
    try {
      JSON.parse(text);
      return "application/json";
    } catch {
      // fall through to text/plain detection
    }
  }
  return isLikelyText(bytes) ? "text/plain" : "application/octet-stream";
}

export const detect_content_type = detectContentType;

export function wrapFileSource(source: FileSource): FileInput {
  if (source.contentType.startsWith("image/")) {
    return new ImageFile({ source });
  }
  if (source.contentType.startsWith("audio/")) {
    return new AudioFile({ source });
  }
  if (source.contentType.startsWith("video/")) {
    return new VideoFile({ source });
  }
  if (source.contentType === "application/pdf") {
    return new PDFFile({ source });
  }
  return new TextFile({ source });
}

export const wrap_file_source = wrapFileSource;

export function normalizeInputFiles(inputFiles: readonly (FileSourceInput | FileInput)[]): Record<string, FileInput> {
  const result: Record<string, FileInput> = {};
  inputFiles.forEach((item, index) => {
    if (item instanceof BaseFile) {
      const filename = item.filename ?? `file_${String(index)}`;
      result[filename.replace(/\.[^.]*$/, "")] = item;
      return;
    }
    const source = coerceFileSource(item);
    const filename = source.filename ?? `file_${String(index)}`;
    result[filename] = wrapFileSource(source);
  });
  return result;
}

export const normalize_input_files = normalizeInputFiles;

export class FileResolverConfig {
  readonly preferUpload: boolean;
  readonly prefer_upload: boolean;
  readonly uploadThresholdBytes: number | null;
  readonly upload_threshold_bytes: number | null;
  readonly useBytesForBedrock: boolean;
  readonly use_bytes_for_bedrock: boolean;

  constructor(options: {
    preferUpload?: boolean;
    prefer_upload?: boolean;
    uploadThresholdBytes?: number | null;
    upload_threshold_bytes?: number | null;
    useBytesForBedrock?: boolean;
    use_bytes_for_bedrock?: boolean;
  } = {}) {
    this.preferUpload = options.preferUpload ?? options.prefer_upload ?? false;
    this.prefer_upload = this.preferUpload;
    this.uploadThresholdBytes = options.uploadThresholdBytes ?? options.upload_threshold_bytes ?? null;
    this.upload_threshold_bytes = this.uploadThresholdBytes;
    this.useBytesForBedrock = options.useBytesForBedrock ?? options.use_bytes_for_bedrock ?? true;
    this.use_bytes_for_bedrock = this.useBytesForBedrock;
  }
}

export class FileResolver {
  readonly config: FileResolverConfig;

  constructor(options: { config?: FileResolverConfig | ConstructorParameters<typeof FileResolverConfig>[0] } = {}) {
    this.config = options.config instanceof FileResolverConfig
      ? options.config
      : new FileResolverConfig(options.config);
  }

  resolve(file: FileInput, provider: FileProvider): ResolvedFileType {
    const source = file.source;
    if (source instanceof FileUrl && supportsUrlReferences(provider)) {
      return new UrlReference({ contentType: file.contentType, url: source.url });
    }
    const content = file.read();
    if (provider.toLowerCase() === "bedrock" && this.config.useBytesForBedrock) {
      return new InlineBytes({ contentType: file.contentType, data: content });
    }
    return new InlineBase64({ contentType: file.contentType, data: Buffer.from(content).toString("base64") });
  }

  async aresolve(file: FileInput, provider: FileProvider): Promise<ResolvedFileType> {
    const source = file.source;
    if (source instanceof FileUrl && supportsUrlReferences(provider)) {
      return new UrlReference({ contentType: file.contentType, url: source.url });
    }
    const content = await file.aread();
    if (provider.toLowerCase() === "bedrock" && this.config.useBytesForBedrock) {
      return new InlineBytes({ contentType: file.contentType, data: content });
    }
    return new InlineBase64({ contentType: file.contentType, data: Buffer.from(content).toString("base64") });
  }

  resolveFiles(files: Record<string, FileInput>, provider: FileProvider): Record<string, ResolvedFileType> {
    return Object.fromEntries(Object.entries(files).map(([name, file]) => [name, this.resolve(file, provider)]));
  }

  resolve_files(files: Record<string, FileInput>, provider: FileProvider): Record<string, ResolvedFileType> {
    return this.resolveFiles(files, provider);
  }

  async aresolveFiles(files: Record<string, FileInput>, provider: FileProvider): Promise<Record<string, ResolvedFileType>> {
    const entries = await Promise.all(Object.entries(files).map(async ([name, file]) => [name, await this.aresolve(file, provider)] as const));
    return Object.fromEntries(entries);
  }

  async aresolve_files(files: Record<string, FileInput>, provider: FileProvider): Promise<Record<string, ResolvedFileType>> {
    return await this.aresolveFiles(files, provider);
  }
}

export function createResolver(config?: FileResolverConfig | ConstructorParameters<typeof FileResolverConfig>[0]): FileResolver {
  return new FileResolver({ config });
}

export const create_resolver = createResolver;

function isFileOptions(value: unknown): value is { source: FileSourceInput; mode?: FileMode } {
  return Boolean(value && typeof value === "object" && "source" in value);
}

function coerceFileSource(value: FileSourceInput): FileSource {
  if (value instanceof FileSource) {
    return value;
  }
  if (typeof value === "string") {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      return new FileUrl({ url: value });
    }
    return new FilePath({ path: resolve(value) });
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return new FileBytes({ data: value });
  }
  return new FileStream({ stream: value });
}

function supportsUrlReferences(provider: FileProvider): boolean {
  return new Set(["anthropic", "azure", "gemini", "openai"]).has(provider.toLowerCase());
}

function contentTypeFromFilename(filename?: string | null): string | null {
  switch (extname((filename ?? "").split("?")[0] ?? "").toLowerCase()) {
    case ".txt":
    case ".log":
      return "text/plain";
    case ".md":
    case ".markdown":
      return "text/markdown";
    case ".csv":
      return "text/csv";
    case ".json":
      return "application/json";
    case ".xml":
      return "application/xml";
    case ".yaml":
    case ".yml":
      return "application/x-yaml";
    case ".html":
    case ".htm":
      return "text/html";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".pdf":
      return "application/pdf";
    case ".wav":
      return "audio/wav";
    case ".mp3":
      return "audio/mpeg";
    case ".mp4":
      return "video/mp4";
    default:
      return null;
  }
}

function urlPathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function isLikelyText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) {
    return true;
  }
  let printable = 0;
  for (const byte of bytes) {
    if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126)) {
      printable += 1;
    }
  }
  return printable / bytes.length > 0.9;
}
