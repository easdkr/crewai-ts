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
    const file = item instanceof BaseFile ? item : wrapFileSource(coerceFileSource(item));
    const filename = file.filename ?? `file_${String(index)}`;
    result[filename.replace(/\.[^.]*$/, "")] = file;
  });
  return result;
}

export const normalize_input_files = normalizeInputFiles;

function isFileOptions(value: unknown): value is { source: FileSourceInput; mode?: FileMode } {
  return Boolean(value && typeof value === "object" && "source" in value);
}

function coerceFileSource(value: FileSourceInput): FileSource {
  if (value instanceof FileSource) {
    return value;
  }
  if (typeof value === "string") {
    return new FilePath({ path: resolve(value) });
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return new FileBytes({ data: value });
  }
  return new FileStream({ stream: value });
}

function contentTypeFromFilename(filename?: string | null): string | null {
  switch (extname(filename ?? "").toLowerCase()) {
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
