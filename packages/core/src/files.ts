import { createHash } from "node:crypto";
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

export enum FileHandling {
  STRICT = "strict",
  AUTO = "auto",
  WARN = "warn",
  CHUNK = "chunk",
}

export class FileValidationError extends Error {
  readonly fileName: string | null;
  readonly file_name: string | null;

  constructor(message: string, options: { fileName?: string | null; file_name?: string | null } = {}) {
    super(message);
    this.name = "FileValidationError";
    this.fileName = options.fileName ?? options.file_name ?? null;
    this.file_name = this.fileName;
  }
}

export class FileTooLargeError extends FileValidationError {
  readonly actualSize: number | null;
  readonly actual_size: number | null;
  readonly maxSize: number | null;
  readonly max_size: number | null;

  constructor(message: string, options: {
    fileName?: string | null;
    file_name?: string | null;
    actualSize?: number | null;
    actual_size?: number | null;
    maxSize?: number | null;
    max_size?: number | null;
  } = {}) {
    super(message, options);
    this.name = "FileTooLargeError";
    this.actualSize = options.actualSize ?? options.actual_size ?? null;
    this.actual_size = this.actualSize;
    this.maxSize = options.maxSize ?? options.max_size ?? null;
    this.max_size = this.maxSize;
  }
}

export class UnsupportedFileTypeError extends FileValidationError {
  readonly contentType: string | null;
  readonly content_type: string | null;

  constructor(message: string, options: { fileName?: string | null; file_name?: string | null; contentType?: string | null; content_type?: string | null } = {}) {
    super(message, options);
    this.name = "UnsupportedFileTypeError";
    this.contentType = options.contentType ?? options.content_type ?? null;
    this.content_type = this.contentType;
  }
}

export class FileProcessingError extends FileValidationError {
  constructor(message: string, options: { fileName?: string | null; file_name?: string | null } = {}) {
    super(message, options);
    this.name = "FileProcessingError";
  }
}

export class ProcessingDependencyError extends FileProcessingError {
  readonly dependency: string | null;
  readonly installCommand: string | null;
  readonly install_command: string | null;

  constructor(message: string, options: { dependency?: string | null; installCommand?: string | null; install_command?: string | null } = {}) {
    super(message);
    this.name = "ProcessingDependencyError";
    this.dependency = options.dependency ?? null;
    this.installCommand = options.installCommand ?? options.install_command ?? null;
    this.install_command = this.installCommand;
  }
}

const DEFAULT_IMAGE_FORMATS = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;
const GEMINI_IMAGE_FORMATS = [...DEFAULT_IMAGE_FORMATS, "image/heic", "image/heif"] as const;
const DEFAULT_AUDIO_FORMATS = ["audio/mp3", "audio/mpeg", "audio/wav", "audio/ogg", "audio/flac", "audio/aac", "audio/m4a"] as const;
const GEMINI_AUDIO_FORMATS = [...DEFAULT_AUDIO_FORMATS, "audio/opus"] as const;
const DEFAULT_VIDEO_FORMATS = ["video/mp4", "video/mpeg", "video/webm", "video/quicktime"] as const;
const GEMINI_VIDEO_FORMATS = [...DEFAULT_VIDEO_FORMATS, "video/x-msvideo", "video/x-flv"] as const;
const DEFAULT_TEXT_FORMATS = ["text/plain", "text/markdown", "text/csv", "application/json", "text/xml", "text/html"] as const;
const GEMINI_TEXT_FORMATS = [...DEFAULT_TEXT_FORMATS, "application/xml", "application/x-yaml", "text/yaml"] as const;

export class ImageConstraints {
  readonly maxSizeBytes: number;
  readonly max_size_bytes: number;
  readonly maxWidth: number | null;
  readonly max_width: number | null;
  readonly maxHeight: number | null;
  readonly max_height: number | null;
  readonly maxImagesPerRequest: number | null;
  readonly max_images_per_request: number | null;
  readonly supportedFormats: readonly string[];
  readonly supported_formats: readonly string[];

  constructor(options: { maxSizeBytes?: number; max_size_bytes?: number; maxWidth?: number | null; max_width?: number | null; maxHeight?: number | null; max_height?: number | null; maxImagesPerRequest?: number | null; max_images_per_request?: number | null; supportedFormats?: readonly string[]; supported_formats?: readonly string[] }) {
    this.maxSizeBytes = options.maxSizeBytes ?? options.max_size_bytes ?? 0;
    this.max_size_bytes = this.maxSizeBytes;
    this.maxWidth = options.maxWidth ?? options.max_width ?? null;
    this.max_width = this.maxWidth;
    this.maxHeight = options.maxHeight ?? options.max_height ?? null;
    this.max_height = this.maxHeight;
    this.maxImagesPerRequest = options.maxImagesPerRequest ?? options.max_images_per_request ?? null;
    this.max_images_per_request = this.maxImagesPerRequest;
    this.supportedFormats = options.supportedFormats ?? options.supported_formats ?? DEFAULT_IMAGE_FORMATS;
    this.supported_formats = this.supportedFormats;
    Object.freeze(this);
  }
}

export class PDFConstraints {
  readonly maxSizeBytes: number;
  readonly max_size_bytes: number;
  readonly maxPages: number | null;
  readonly max_pages: number | null;

  constructor(options: { maxSizeBytes?: number; max_size_bytes?: number; maxPages?: number | null; max_pages?: number | null }) {
    this.maxSizeBytes = options.maxSizeBytes ?? options.max_size_bytes ?? 0;
    this.max_size_bytes = this.maxSizeBytes;
    this.maxPages = options.maxPages ?? options.max_pages ?? null;
    this.max_pages = this.maxPages;
    Object.freeze(this);
  }
}

export class AudioConstraints {
  readonly maxSizeBytes: number;
  readonly max_size_bytes: number;
  readonly maxDurationSeconds: number | null;
  readonly max_duration_seconds: number | null;
  readonly supportedFormats: readonly string[];
  readonly supported_formats: readonly string[];

  constructor(options: { maxSizeBytes?: number; max_size_bytes?: number; maxDurationSeconds?: number | null; max_duration_seconds?: number | null; supportedFormats?: readonly string[]; supported_formats?: readonly string[] }) {
    this.maxSizeBytes = options.maxSizeBytes ?? options.max_size_bytes ?? 0;
    this.max_size_bytes = this.maxSizeBytes;
    this.maxDurationSeconds = options.maxDurationSeconds ?? options.max_duration_seconds ?? null;
    this.max_duration_seconds = this.maxDurationSeconds;
    this.supportedFormats = options.supportedFormats ?? options.supported_formats ?? DEFAULT_AUDIO_FORMATS;
    this.supported_formats = this.supportedFormats;
    Object.freeze(this);
  }
}

export class VideoConstraints {
  readonly maxSizeBytes: number;
  readonly max_size_bytes: number;
  readonly maxDurationSeconds: number | null;
  readonly max_duration_seconds: number | null;
  readonly supportedFormats: readonly string[];
  readonly supported_formats: readonly string[];

  constructor(options: { maxSizeBytes?: number; max_size_bytes?: number; maxDurationSeconds?: number | null; max_duration_seconds?: number | null; supportedFormats?: readonly string[]; supported_formats?: readonly string[] }) {
    this.maxSizeBytes = options.maxSizeBytes ?? options.max_size_bytes ?? 0;
    this.max_size_bytes = this.maxSizeBytes;
    this.maxDurationSeconds = options.maxDurationSeconds ?? options.max_duration_seconds ?? null;
    this.max_duration_seconds = this.maxDurationSeconds;
    this.supportedFormats = options.supportedFormats ?? options.supported_formats ?? DEFAULT_VIDEO_FORMATS;
    this.supported_formats = this.supportedFormats;
    Object.freeze(this);
  }
}

export class TextConstraints {
  readonly maxSizeBytes: number;
  readonly max_size_bytes: number;
  readonly supportedFormats: readonly string[];
  readonly supported_formats: readonly string[];

  constructor(options: { maxSizeBytes?: number; max_size_bytes?: number; supportedFormats?: readonly string[]; supported_formats?: readonly string[] }) {
    this.maxSizeBytes = options.maxSizeBytes ?? options.max_size_bytes ?? 0;
    this.max_size_bytes = this.maxSizeBytes;
    this.supportedFormats = options.supportedFormats ?? options.supported_formats ?? DEFAULT_TEXT_FORMATS;
    this.supported_formats = this.supportedFormats;
    Object.freeze(this);
  }
}

export class ProviderConstraints {
  readonly name: string;
  readonly image: ImageConstraints | null;
  readonly pdf: PDFConstraints | null;
  readonly audio: AudioConstraints | null;
  readonly video: VideoConstraints | null;
  readonly text: TextConstraints | null;
  readonly generalMaxSizeBytes: number | null;
  readonly general_max_size_bytes: number | null;
  readonly supportsFileUpload: boolean;
  readonly supports_file_upload: boolean;
  readonly fileUploadThresholdBytes: number | null;
  readonly file_upload_threshold_bytes: number | null;
  readonly supportsUrlReferences: boolean;
  readonly supports_url_references: boolean;

  constructor(options: {
    name: string;
    image?: ImageConstraints | null;
    pdf?: PDFConstraints | null;
    audio?: AudioConstraints | null;
    video?: VideoConstraints | null;
    text?: TextConstraints | null;
    generalMaxSizeBytes?: number | null;
    general_max_size_bytes?: number | null;
    supportsFileUpload?: boolean;
    supports_file_upload?: boolean;
    fileUploadThresholdBytes?: number | null;
    file_upload_threshold_bytes?: number | null;
    supportsUrlReferences?: boolean;
    supports_url_references?: boolean;
  }) {
    this.name = options.name;
    this.image = options.image ?? null;
    this.pdf = options.pdf ?? null;
    this.audio = options.audio ?? null;
    this.video = options.video ?? null;
    this.text = options.text ?? null;
    this.generalMaxSizeBytes = options.generalMaxSizeBytes ?? options.general_max_size_bytes ?? null;
    this.general_max_size_bytes = this.generalMaxSizeBytes;
    this.supportsFileUpload = options.supportsFileUpload ?? options.supports_file_upload ?? false;
    this.supports_file_upload = this.supportsFileUpload;
    this.fileUploadThresholdBytes = options.fileUploadThresholdBytes ?? options.file_upload_threshold_bytes ?? null;
    this.file_upload_threshold_bytes = this.fileUploadThresholdBytes;
    this.supportsUrlReferences = options.supportsUrlReferences ?? options.supports_url_references ?? false;
    this.supports_url_references = this.supportsUrlReferences;
    Object.freeze(this);
  }
}

export const ANTHROPIC_CONSTRAINTS = new ProviderConstraints({
  name: "anthropic",
  image: new ImageConstraints({ maxSizeBytes: 5_242_880, maxWidth: 8000, maxHeight: 8000, maxImagesPerRequest: 100 }),
  pdf: new PDFConstraints({ maxSizeBytes: 33_554_432, maxPages: 100 }),
  supportsFileUpload: true,
  fileUploadThresholdBytes: 5_242_880,
  supportsUrlReferences: true,
});

export const OPENAI_RESPONSES_CONSTRAINTS = new ProviderConstraints({
  name: "openai_responses",
  image: new ImageConstraints({ maxSizeBytes: 20_971_520, maxImagesPerRequest: 10 }),
  pdf: new PDFConstraints({ maxSizeBytes: 33_554_432, maxPages: 100 }),
  audio: new AudioConstraints({ maxSizeBytes: 26_214_400, maxDurationSeconds: 1500 }),
  supportsFileUpload: true,
  fileUploadThresholdBytes: 5_242_880,
  supportsUrlReferences: true,
});

export const OPENAI_CONSTRAINTS = new ProviderConstraints({
  name: "openai",
  image: new ImageConstraints({ maxSizeBytes: 20_971_520, maxImagesPerRequest: 10 }),
  supportsFileUpload: true,
  fileUploadThresholdBytes: 5_242_880,
  supportsUrlReferences: true,
});

export const GEMINI_CONSTRAINTS = new ProviderConstraints({
  name: "gemini",
  image: new ImageConstraints({ maxSizeBytes: 104_857_600, supportedFormats: GEMINI_IMAGE_FORMATS }),
  pdf: new PDFConstraints({ maxSizeBytes: 52_428_800 }),
  audio: new AudioConstraints({ maxSizeBytes: 104_857_600, maxDurationSeconds: 34200, supportedFormats: GEMINI_AUDIO_FORMATS }),
  video: new VideoConstraints({ maxSizeBytes: 2_147_483_648, maxDurationSeconds: 3600, supportedFormats: GEMINI_VIDEO_FORMATS }),
  text: new TextConstraints({ maxSizeBytes: 104_857_600, supportedFormats: GEMINI_TEXT_FORMATS }),
  supportsFileUpload: true,
  fileUploadThresholdBytes: 20_971_520,
  supportsUrlReferences: true,
});

export const BEDROCK_CONSTRAINTS = new ProviderConstraints({
  name: "bedrock",
  image: new ImageConstraints({ maxSizeBytes: 4_608_000, maxWidth: 8000, maxHeight: 8000 }),
  pdf: new PDFConstraints({ maxSizeBytes: 3_840_000, maxPages: 100 }),
  supportsUrlReferences: true,
});

export const AZURE_CONSTRAINTS = new ProviderConstraints({
  name: "azure",
  image: new ImageConstraints({ maxSizeBytes: 20_971_520, maxImagesPerRequest: 10 }),
  audio: new AudioConstraints({ maxSizeBytes: 26_214_400, maxDurationSeconds: 1500 }),
  supportsUrlReferences: true,
});

const PROVIDER_CONSTRAINTS = new Map<string, ProviderConstraints>([
  ["anthropic", ANTHROPIC_CONSTRAINTS],
  ["openai", OPENAI_CONSTRAINTS],
  ["openai_responses", OPENAI_RESPONSES_CONSTRAINTS],
  ["gemini", GEMINI_CONSTRAINTS],
  ["bedrock", BEDROCK_CONSTRAINTS],
  ["azure", AZURE_CONSTRAINTS],
  ["claude", ANTHROPIC_CONSTRAINTS],
  ["gpt", OPENAI_CONSTRAINTS],
  ["google", GEMINI_CONSTRAINTS],
  ["aws", BEDROCK_CONSTRAINTS],
]);

export function getConstraintsForProvider(provider: string | ProviderConstraints): ProviderConstraints | null {
  if (provider instanceof ProviderConstraints) {
    return provider;
  }
  const providerLower = provider.toLowerCase();
  const exact = PROVIDER_CONSTRAINTS.get(providerLower);
  if (exact) {
    return exact;
  }
  for (const [key, constraints] of PROVIDER_CONSTRAINTS) {
    if (providerLower.includes(key)) {
      return constraints;
    }
  }
  return null;
}

export const get_constraints_for_provider = getConstraintsForProvider;

export function usesOpenAIResponsesApi(provider: string, api: string | null = null): boolean {
  if (api !== "responses") {
    return false;
  }
  const providerLower = provider.toLowerCase();
  return providerLower.includes("openai")
    || providerLower === "gpt"
    || providerLower.startsWith("gpt-")
    || providerLower.includes("/gpt-");
}

export const uses_openai_responses_api = usesOpenAIResponsesApi;

export function getSupportedContentTypes(provider: string, api: string | null = null): string[] {
  const lookup = usesOpenAIResponsesApi(provider, api) ? "openai_responses" : provider;
  const constraints = getConstraintsForProvider(lookup);
  if (!constraints) {
    return [];
  }
  const types: string[] = [];
  if (constraints.image) {
    types.push("image/");
  }
  if (constraints.pdf) {
    types.push("application/pdf");
  }
  if (constraints.audio) {
    types.push("audio/");
  }
  if (constraints.video) {
    types.push("video/");
  }
  if (constraints.text) {
    types.push("text/");
  }
  return types;
}

export const get_supported_content_types = getSupportedContentTypes;

export function validateImage(file: ImageFile, constraints: ImageConstraints, options: { raiseOnError?: boolean; raise_on_error?: boolean } = {}): string[] {
  const errors: string[] = [];
  const raiseOnError = options.raiseOnError ?? options.raise_on_error ?? true;
  const content = file.read();
  validateSize("Image", file.filename, content.length, constraints.maxSizeBytes, errors, raiseOnError);
  validateFormat("Image", file.filename, file.contentType, constraints.supportedFormats, errors, raiseOnError);
  return errors;
}

export const validate_image = validateImage;

export function validatePDF(file: PDFFile, constraints: PDFConstraints, options: { raiseOnError?: boolean; raise_on_error?: boolean } = {}): string[] {
  const errors: string[] = [];
  const raiseOnError = options.raiseOnError ?? options.raise_on_error ?? true;
  validateSize("PDF", file.filename, file.read().length, constraints.maxSizeBytes, errors, raiseOnError);
  return errors;
}

export const validate_pdf = validatePDF;

export function validateAudio(file: AudioFile, constraints: AudioConstraints, options: { raiseOnError?: boolean; raise_on_error?: boolean; durationSeconds?: number | null; duration_seconds?: number | null } = {}): string[] {
  const errors: string[] = [];
  const raiseOnError = options.raiseOnError ?? options.raise_on_error ?? true;
  const duration = options.durationSeconds ?? options.duration_seconds ?? null;
  validateSize("Audio", file.filename, file.read().length, constraints.maxSizeBytes, errors, raiseOnError);
  validateFormat("Audio", file.filename, file.contentType, constraints.supportedFormats, errors, raiseOnError);
  if (constraints.maxDurationSeconds !== null && duration !== null && duration > constraints.maxDurationSeconds) {
    const message = `Audio '${file.filename ?? "null"}' duration (${duration.toFixed(1)}s) exceeds maximum (${String(constraints.maxDurationSeconds)}s)`;
    errors.push(message);
    if (raiseOnError) {
      throw new FileValidationError(message, { fileName: file.filename });
    }
  }
  return errors;
}

export const validate_audio = validateAudio;

export function validateVideo(file: VideoFile, constraints: VideoConstraints, options: { raiseOnError?: boolean; raise_on_error?: boolean; durationSeconds?: number | null; duration_seconds?: number | null } = {}): string[] {
  const errors: string[] = [];
  const raiseOnError = options.raiseOnError ?? options.raise_on_error ?? true;
  const duration = options.durationSeconds ?? options.duration_seconds ?? null;
  validateSize("Video", file.filename, file.read().length, constraints.maxSizeBytes, errors, raiseOnError);
  validateFormat("Video", file.filename, file.contentType, constraints.supportedFormats, errors, raiseOnError);
  if (constraints.maxDurationSeconds !== null && duration !== null && duration > constraints.maxDurationSeconds) {
    const message = `Video '${file.filename ?? "null"}' duration (${duration.toFixed(1)}s) exceeds maximum (${String(constraints.maxDurationSeconds)}s)`;
    errors.push(message);
    if (raiseOnError) {
      throw new FileValidationError(message, { fileName: file.filename });
    }
  }
  return errors;
}

export const validate_video = validateVideo;

export function validateText(file: TextFile, constraints: ProviderConstraints, options: { raiseOnError?: boolean; raise_on_error?: boolean } = {}): string[] {
  const errors: string[] = [];
  if (constraints.generalMaxSizeBytes === null) {
    return errors;
  }
  validateSize("Text file", file.filename, file.read().length, constraints.generalMaxSizeBytes, errors, options.raiseOnError ?? options.raise_on_error ?? true);
  return errors;
}

export const validate_text = validateText;

export function validateFile(file: FileInput, constraints: ProviderConstraints, options: { raiseOnError?: boolean; raise_on_error?: boolean } = {}): string[] {
  const raiseOnError = options.raiseOnError ?? options.raise_on_error ?? true;
  if (file instanceof ImageFile) {
    return constraints.image
      ? validateImage(file, constraints.image, { raiseOnError })
      : unsupportedFileType(file, constraints.name, "images", raiseOnError);
  }
  if (file instanceof PDFFile) {
    return constraints.pdf
      ? validatePDF(file, constraints.pdf, { raiseOnError })
      : unsupportedFileType(file, constraints.name, "PDFs", raiseOnError);
  }
  if (file instanceof AudioFile) {
    return constraints.audio
      ? validateAudio(file, constraints.audio, { raiseOnError })
      : unsupportedFileType(file, constraints.name, "audio", raiseOnError);
  }
  if (file instanceof VideoFile) {
    return constraints.video
      ? validateVideo(file, constraints.video, { raiseOnError })
      : unsupportedFileType(file, constraints.name, "video", raiseOnError);
  }
  if (file instanceof TextFile) {
    return validateText(file, constraints, { raiseOnError });
  }
  return [];
}

export const validate_file = validateFile;

export class FileProcessor {
  readonly constraints: ProviderConstraints | null;

  constructor(options: { constraints?: ProviderConstraints | string | null } | ProviderConstraints | string | null = {}) {
    const value = options instanceof ProviderConstraints || typeof options === "string" || options === null
      ? options
      : options.constraints ?? null;
    this.constraints = typeof value === "string" ? getConstraintsForProvider(value) : value;
  }

  validate(file: FileInput): string[] {
    if (this.constraints === null) {
      return [];
    }
    return validateFile(file, this.constraints, { raiseOnError: this.fileMode(file) === FileHandling.STRICT });
  }

  process(file: FileInput): FileInput | FileInput[] {
    if (this.constraints === null) {
      return file;
    }
    const mode = this.fileMode(file);
    const errors = this.validate(file);
    if (errors.length === 0) {
      return file;
    }
    if (mode === FileHandling.STRICT) {
      throw new FileValidationError(errors.join("; "), { fileName: file.filename });
    }
    if (mode === FileHandling.CHUNK) {
      return this.chunkProcess(file);
    }
    return file;
  }

  processFiles(files: Record<string, FileInput>): Record<string, FileInput> {
    const result: Record<string, FileInput> = {};
    for (const [name, file] of Object.entries(files)) {
      const processed = this.process(file);
      if (Array.isArray(processed)) {
        processed.forEach((chunk, index) => {
          result[`${name}_chunk_${String(index)}`] = chunk;
        });
      } else {
        result[name] = processed;
      }
    }
    return result;
  }

  process_files(files: Record<string, FileInput>): Record<string, FileInput> {
    return this.processFiles(files);
  }

  aprocessFiles(files: Record<string, FileInput>): Promise<Record<string, FileInput>> {
    return Promise.resolve(this.processFiles(files));
  }

  aprocess_files(files: Record<string, FileInput>): Promise<Record<string, FileInput>> {
    return this.aprocessFiles(files);
  }

  private fileMode(file: FileInput): FileHandling {
    return Object.values(FileHandling).includes(file.mode as FileHandling) ? file.mode as FileHandling : FileHandling.AUTO;
  }

  private chunkProcess(file: FileInput): FileInput | FileInput[] {
    if (this.constraints === null) {
      return file;
    }
    if (file instanceof TextFile && this.constraints.generalMaxSizeBytes !== null) {
      return chunkText(file, this.constraints.generalMaxSizeBytes);
    }
    return file;
  }
}

export function chunkText(
  file: TextFile,
  maxChars: number,
  options: { overlapChars?: number; overlap_chars?: number; splitOnNewlines?: boolean; split_on_newlines?: boolean } = {},
): TextFile[] {
  const overlapChars = Math.max(0, options.overlapChars ?? options.overlap_chars ?? 200);
  const splitOnNewlines = options.splitOnNewlines ?? options.split_on_newlines ?? true;
  const text = Buffer.from(file.read()).toString("utf8");
  if (text.length <= maxChars) {
    return [file];
  }
  const filename = file.filename ?? "text.txt";
  const dotIndex = filename.lastIndexOf(".");
  const base = dotIndex >= 0 ? filename.slice(0, dotIndex) : filename;
  const extension = dotIndex >= 0 ? filename.slice(dotIndex + 1) : "txt";
  const chunks: TextFile[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length && splitOnNewlines) {
      const lastNewline = text.lastIndexOf("\n", end - 1);
      if (lastNewline > start + Math.floor(maxChars / 2)) {
        end = lastNewline + 1;
      }
    }
    chunks.push(new TextFile({
      source: new FileBytes({
        data: Buffer.from(text.slice(start, end), "utf8"),
        filename: `${base}_chunk_${String(chunks.length)}.${extension}`,
      }),
    }));
    start = end < text.length ? Math.max(start + 1, end - overlapChars) : text.length;
  }
  return chunks;
}

export const chunk_text = chunkText;

export function chunkPDF(_file: PDFFile, _maxPages: number): PDFFile[] {
  void _file;
  void _maxPages;
  throw new ProcessingDependencyError("pypdf is required for PDF chunking", { dependency: "pypdf", installCommand: "pip install pypdf" });
}

export const chunk_pdf = chunkPDF;

export function resizeImage(_file: ImageFile, _maxWidth: number, _maxHeight: number): ImageFile {
  void _file;
  void _maxWidth;
  void _maxHeight;
  throw new ProcessingDependencyError("Pillow is required for image resizing", { dependency: "Pillow", installCommand: "pip install Pillow" });
}

export const resize_image = resizeImage;

export function optimizeImage(_file: ImageFile, _targetSizeBytes: number): ImageFile {
  void _file;
  void _targetSizeBytes;
  throw new ProcessingDependencyError("Pillow is required for image optimization", { dependency: "Pillow", installCommand: "pip install Pillow" });
}

export const optimize_image = optimizeImage;

export class CachedUpload {
  readonly fileId: string;
  readonly file_id: string;
  readonly provider: string;
  readonly fileUri: string | null;
  readonly file_uri: string | null;
  readonly contentType: string;
  readonly content_type: string;
  readonly uploadedAt: Date;
  readonly uploaded_at: Date;
  readonly expiresAt: Date | null;
  readonly expires_at: Date | null;

  constructor(options: {
    fileId?: string;
    file_id?: string;
    provider: string;
    fileUri?: string | null;
    file_uri?: string | null;
    contentType?: string;
    content_type?: string;
    uploadedAt?: Date;
    uploaded_at?: Date;
    expiresAt?: Date | null;
    expires_at?: Date | null;
  }) {
    this.fileId = options.fileId ?? options.file_id ?? "";
    this.file_id = this.fileId;
    this.provider = options.provider;
    this.fileUri = options.fileUri ?? options.file_uri ?? null;
    this.file_uri = this.fileUri;
    this.contentType = options.contentType ?? options.content_type ?? "application/octet-stream";
    this.content_type = this.contentType;
    this.uploadedAt = options.uploadedAt ?? options.uploaded_at ?? new Date();
    this.uploaded_at = this.uploadedAt;
    this.expiresAt = options.expiresAt ?? options.expires_at ?? null;
    this.expires_at = this.expiresAt;
  }

  isExpired(now = new Date()): boolean {
    return this.expiresAt !== null && now.getTime() >= this.expiresAt.getTime();
  }

  is_expired(now = new Date()): boolean {
    return this.isExpired(now);
  }
}

export class UploadCache {
  readonly ttl: number;
  readonly namespace: string;
  readonly maxEntries: number | null;
  readonly max_entries: number | null;
  private readonly entries = new Map<string, CachedUpload>();
  private readonly providerKeys = new Map<string, Set<string>>();
  private readonly accessOrder: string[] = [];

  constructor(options: {
    ttl?: number;
    namespace?: string;
    cacheType?: string;
    cache_type?: string;
    maxEntries?: number | null;
    max_entries?: number | null;
  } = {}) {
    this.ttl = options.ttl ?? 24 * 60 * 60;
    this.namespace = options.namespace ?? "crewai_uploads";
    this.maxEntries = options.maxEntries ?? options.max_entries ?? 1000;
    this.max_entries = this.maxEntries;
  }

  get size(): number {
    return this.entries.size;
  }

  get length(): number {
    return this.size;
  }

  get(file: FileInput, provider: FileProvider): CachedUpload | null {
    return this.getByHash(computeFileHash(file), provider);
  }

  get_by_hash(fileHash: string, provider: FileProvider): CachedUpload | null {
    return this.getByHash(fileHash, provider);
  }

  getByHash(fileHash: string, provider: FileProvider): CachedUpload | null {
    const key = uploadCacheKey(fileHash, provider);
    const cached = this.entries.get(key) ?? null;
    if (cached === null) {
      return null;
    }
    if (cached.isExpired()) {
      this.entries.delete(key);
      this.untrackKey(provider, key);
      return null;
    }
    this.trackKey(provider, key);
    return cached;
  }

  aget(file: FileInput, provider: FileProvider): Promise<CachedUpload | null> {
    return Promise.resolve(this.get(file, provider));
  }

  aget_by_hash(fileHash: string, provider: FileProvider): Promise<CachedUpload | null> {
    return Promise.resolve(this.getByHash(fileHash, provider));
  }

  agetByHash(fileHash: string, provider: FileProvider): Promise<CachedUpload | null> {
    return Promise.resolve(this.getByHash(fileHash, provider));
  }

  set(
    file: FileInput,
    provider: FileProvider,
    fileIdOrOptions: string | { fileId?: string; file_id?: string; fileUri?: string | null; file_uri?: string | null; expiresAt?: Date | null; expires_at?: Date | null },
    fileUri: string | null = null,
    expiresAt: Date | null = null,
  ): CachedUpload {
    const fileId = typeof fileIdOrOptions === "string" ? fileIdOrOptions : fileIdOrOptions.fileId ?? fileIdOrOptions.file_id ?? "";
    const resolvedUri = typeof fileIdOrOptions === "string" ? fileUri : fileIdOrOptions.fileUri ?? fileIdOrOptions.file_uri ?? null;
    const resolvedExpiry = typeof fileIdOrOptions === "string" ? expiresAt : fileIdOrOptions.expiresAt ?? fileIdOrOptions.expires_at ?? null;
    return this.setByHash(computeFileHash(file), file.contentType, provider, fileId, resolvedUri, resolvedExpiry);
  }

  set_by_hash(
    fileHash: string,
    contentType: string,
    provider: FileProvider,
    fileId: string,
    fileUri: string | null = null,
    expiresAt: Date | null = null,
  ): CachedUpload {
    return this.setByHash(fileHash, contentType, provider, fileId, fileUri, expiresAt);
  }

  setByHash(
    fileHash: string,
    contentType: string,
    provider: FileProvider,
    fileId: string,
    fileUri: string | null = null,
    expiresAt: Date | null = null,
  ): CachedUpload {
    this.evictIfNeeded();
    const key = uploadCacheKey(fileHash, provider);
    const cached = new CachedUpload({
      fileId,
      provider,
      fileUri,
      contentType,
      uploadedAt: new Date(),
      expiresAt,
    });
    this.entries.set(key, cached);
    this.trackKey(provider, key);
    return cached;
  }

  aset(file: FileInput, provider: FileProvider, fileId: string, fileUri: string | null = null, expiresAt: Date | null = null): Promise<CachedUpload> {
    return Promise.resolve(this.set(file, provider, fileId, fileUri, expiresAt));
  }

  aset_by_hash(fileHash: string, contentType: string, provider: FileProvider, fileId: string, fileUri: string | null = null, expiresAt: Date | null = null): Promise<CachedUpload> {
    return Promise.resolve(this.setByHash(fileHash, contentType, provider, fileId, fileUri, expiresAt));
  }

  asetByHash(fileHash: string, contentType: string, provider: FileProvider, fileId: string, fileUri: string | null = null, expiresAt: Date | null = null): Promise<CachedUpload> {
    return Promise.resolve(this.setByHash(fileHash, contentType, provider, fileId, fileUri, expiresAt));
  }

  remove(file: FileInput, provider: FileProvider): boolean {
    const key = uploadCacheKey(computeFileHash(file), provider);
    const removed = this.entries.delete(key);
    if (removed) {
      this.untrackKey(provider, key);
    }
    return removed;
  }

  aremove(file: FileInput, provider: FileProvider): Promise<boolean> {
    return Promise.resolve(this.remove(file, provider));
  }

  removeByFileId(fileId: string, provider: FileProvider): boolean {
    for (const key of [...(this.providerKeys.get(provider) ?? [])]) {
      if (this.entries.get(key)?.fileId === fileId) {
        this.entries.delete(key);
        this.untrackKey(provider, key);
        return true;
      }
    }
    return false;
  }

  remove_by_file_id(fileId: string, provider: FileProvider): boolean {
    return this.removeByFileId(fileId, provider);
  }

  aremove_by_file_id(fileId: string, provider: FileProvider): Promise<boolean> {
    return Promise.resolve(this.removeByFileId(fileId, provider));
  }

  clearExpired(): number {
    let removed = 0;
    for (const [key, cached] of [...this.entries]) {
      if (cached.isExpired()) {
        this.entries.delete(key);
        this.untrackKey(cached.provider, key);
        removed += 1;
      }
    }
    return removed;
  }

  clear_expired(): number {
    return this.clearExpired();
  }

  aclear_expired(): Promise<number> {
    return Promise.resolve(this.clearExpired());
  }

  clear(): number {
    const count = this.entries.size;
    this.entries.clear();
    this.providerKeys.clear();
    this.accessOrder.length = 0;
    return count;
  }

  aclear(): Promise<number> {
    return Promise.resolve(this.clear());
  }

  getAllForProvider(provider: FileProvider): CachedUpload[] {
    return [...(this.providerKeys.get(provider) ?? [])]
      .map((key) => this.getCachedByKey(key, provider))
      .filter((cached): cached is CachedUpload => cached !== null);
  }

  get_all_for_provider(provider: FileProvider): CachedUpload[] {
    return this.getAllForProvider(provider);
  }

  aget_all_for_provider(provider: FileProvider): Promise<CachedUpload[]> {
    return Promise.resolve(this.getAllForProvider(provider));
  }

  getProviders(): Set<string> {
    return new Set(this.providerKeys.keys());
  }

  get_providers(): Set<string> {
    return this.getProviders();
  }

  private getCachedByKey(key: string, provider: FileProvider): CachedUpload | null {
    const cached = this.entries.get(key) ?? null;
    if (cached === null) {
      this.untrackKey(provider, key);
      return null;
    }
    if (cached.isExpired()) {
      this.entries.delete(key);
      this.untrackKey(provider, key);
      return null;
    }
    return cached;
  }

  private trackKey(provider: FileProvider, key: string): void {
    const keys = this.providerKeys.get(provider) ?? new Set<string>();
    keys.add(key);
    this.providerKeys.set(provider, keys);
    const index = this.accessOrder.indexOf(key);
    if (index >= 0) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  private untrackKey(provider: FileProvider, key: string): void {
    this.providerKeys.get(provider)?.delete(key);
    if (this.providerKeys.get(provider)?.size === 0) {
      this.providerKeys.delete(provider);
    }
    const index = this.accessOrder.indexOf(key);
    if (index >= 0) {
      this.accessOrder.splice(index, 1);
    }
  }

  private evictIfNeeded(): void {
    if (this.maxEntries === null || this.entries.size < this.maxEntries) {
      return;
    }
    const count = Math.max(1, Math.floor(this.maxEntries / 10));
    for (const key of this.accessOrder.slice(0, count)) {
      const cached = this.entries.get(key);
      this.entries.delete(key);
      if (cached) {
        this.untrackKey(cached.provider, key);
      }
    }
  }
}

let defaultUploadCache: UploadCache | null = null;

export function getUploadCache(options: {
  ttl?: number;
  namespace?: string;
  cacheType?: string;
  cache_type?: string;
  maxEntries?: number | null;
  max_entries?: number | null;
} = {}): UploadCache {
  defaultUploadCache ??= new UploadCache(options);
  return defaultUploadCache;
}

export const get_upload_cache = getUploadCache;

export function resetUploadCache(): void {
  defaultUploadCache?.clear();
  defaultUploadCache = null;
}

export const reset_upload_cache = resetUploadCache;

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

type FileUrlFetchResult = { content: Uint8Array | Buffer | string; contentType?: string | null };
type FileUrlFetcher = (url: string) => FileUrlFetchResult | Promise<FileUrlFetchResult>;

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
  private readonly fetcher: FileUrlFetcher | null;

  constructor(options: {
    url: string;
    filename?: string | null;
    fetcher?: FileUrlFetcher | null;
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
    if (this.content !== null) {
      return this.content;
    }
    if (!this.fetcher) {
      throw new Error("FileUrl.read requires an injected fetcher in this deterministic TypeScript shim. Use aread() with a fetcher or resolve URL-capable providers as UrlReference.");
    }
    const fetched = this.fetcher(this.url);
    if (isPromiseLike(fetched)) {
      throw new Error("FileUrl.read requires a synchronous injected fetcher in this deterministic TypeScript shim. Use aread() with async fetchers.");
    }
    return this.applyFetchedContent(fetched);
  }

  override async aread(): Promise<Uint8Array> {
    if (this.content !== null) {
      return this.content;
    }
    if (!this.fetcher) {
      throw new Error("FileUrl.aread requires an injected fetcher in this deterministic TypeScript shim.");
    }
    const fetched = await this.fetcher(this.url);
    return this.applyFetchedContent(fetched);
  }

  private applyFetchedContent(fetched: FileUrlFetchResult): Uint8Array {
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
  readonly uploadCache: UploadCache | null;
  readonly upload_cache: UploadCache | null;

  constructor(options: {
    config?: FileResolverConfig | ConstructorParameters<typeof FileResolverConfig>[0];
    uploadCache?: UploadCache | null;
    upload_cache?: UploadCache | null;
  } = {}) {
    this.config = options.config instanceof FileResolverConfig
      ? options.config
      : new FileResolverConfig(options.config);
    this.uploadCache = options.uploadCache ?? options.upload_cache ?? null;
    this.upload_cache = this.uploadCache;
  }

  resolve(file: FileInput, provider: FileProvider): ResolvedFileType {
    const source = file.source;
    if (source instanceof FileUrl && supportsUrlReferences(provider)) {
      return new UrlReference({ contentType: file.contentType, url: source.url });
    }
    const content = file.read();
    const cached = this.resolveCachedUpload(file, provider, content);
    if (cached) {
      return cached;
    }
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
    const cached = this.resolveCachedUpload(file, provider, content);
    if (cached) {
      return cached;
    }
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

  async aresolveFiles(files: Record<string, FileInput>, provider: FileProvider, maxConcurrency = 10): Promise<Record<string, ResolvedFileType>> {
    const entries = Object.entries(files);
    const output: Record<string, ResolvedFileType> = {};
    let nextIndex = 0;
    const workerCount = Math.max(1, Math.min(maxConcurrency, entries.length));
    await Promise.all(Array.from({ length: workerCount }, async () => {
      while (nextIndex < entries.length) {
        const entry = entries[nextIndex];
        nextIndex += 1;
        if (!entry) {
          continue;
        }
        const [name, file] = entry;
        try {
          output[name] = await this.aresolve(file, provider);
        } catch {
          // Upstream async batch resolution keeps successful entries when one file fails.
        }
      }
    }));
    return output;
  }

  async aresolve_files(files: Record<string, FileInput>, provider: FileProvider, max_concurrency = 10): Promise<Record<string, ResolvedFileType>> {
    return await this.aresolveFiles(files, provider, max_concurrency);
  }

  getCachedUploads(provider: FileProvider): CachedUpload[] {
    return this.uploadCache?.getAllForProvider(provider) ?? [];
  }

  get_cached_uploads(provider: FileProvider): CachedUpload[] {
    return this.getCachedUploads(provider);
  }

  clearCache(): void {
    this.uploadCache?.clear();
  }

  clear_cache(): void {
    this.clearCache();
  }

  private resolveCachedUpload(file: FileInput, provider: FileProvider, content: Uint8Array): FileReference | null {
    if (!this.uploadCache || !this.shouldUseUpload(file, provider, content.length)) {
      return null;
    }
    const cached = this.uploadCache.getByHash(createHash("sha256").update(content).digest("hex"), provider);
    if (!cached) {
      return null;
    }
    return new FileReference({
      contentType: cached.contentType,
      fileId: cached.fileId,
      provider: cached.provider,
      expiresAt: cached.expiresAt,
      fileUri: cached.fileUri,
    });
  }

  private shouldUseUpload(file: FileInput, provider: FileProvider, sizeBytes: number): boolean {
    const constraints = getConstraintsForProvider(provider);
    if (!constraints?.supportsFileUpload) {
      return false;
    }
    if (this.config.preferUpload) {
      return true;
    }
    const typeConstraint = getFileTypeConstraint(file, constraints);
    if (typeConstraint && sizeBytes > typeConstraint.maxSizeBytes) {
      return true;
    }
    return this.config.uploadThresholdBytes !== null && sizeBytes > this.config.uploadThresholdBytes;
  }
}

export type CreateResolverOptions = ConstructorParameters<typeof FileResolverConfig>[0] & {
  provider?: FileProvider | null;
  enableCache?: boolean;
  enable_cache?: boolean;
};

export function createResolver(options: FileResolverConfig | CreateResolverOptions = {}): FileResolver {
  const uploadThresholdBytes = options instanceof FileResolverConfig
    ? null
    : options.uploadThresholdBytes
      ?? options.upload_threshold_bytes
      ?? (options.provider ? getConstraintsForProvider(options.provider)?.fileUploadThresholdBytes : undefined);
  const config = options instanceof FileResolverConfig
    ? options
    : new FileResolverConfig({
      ...options,
      ...(uploadThresholdBytes === undefined ? {} : { uploadThresholdBytes }),
    });
  const enableCache = options instanceof FileResolverConfig
    ? true
    : options.enableCache ?? options.enable_cache ?? true;
  return new FileResolver({ config, uploadCache: enableCache ? new UploadCache() : null });
}

export const create_resolver = createResolver;

export type MultimodalContentApi = "completions" | "responses";

export function formatMultimodalContent(
  files: Record<string, FileInput>,
  provider: string,
  options: { api?: MultimodalContentApi; text?: string | null } | MultimodalContentApi = {},
): Record<string, unknown>[] {
  const api = typeof options === "string" ? options : options.api ?? "completions";
  const text = typeof options === "string" ? null : options.text ?? null;
  const normalizedProvider = provider.toLowerCase();
  const result: Record<string, unknown>[] = [];
  if (text) {
    result.push(formatTextBlockForProvider(text, normalizedProvider, api));
  }
  for (const [name, file] of Object.entries(files)) {
    if (!isOpenAIProvider(normalizedProvider) && !isGeminiProvider(normalizedProvider) && !isAnthropicProvider(normalizedProvider) && !isBedrockProvider(normalizedProvider)) {
      continue;
    }
    const bytes = Buffer.from(file.read());
    const encoded = bytes.toString("base64");
    if (isAnthropicProvider(normalizedProvider) && file instanceof ImageFile) {
      result.push({
        type: "image",
        source: {
          type: "base64",
          media_type: file.contentType,
          data: encoded,
        },
      });
    } else if (isAnthropicProvider(normalizedProvider) && file instanceof PDFFile) {
      result.push({
        type: "document",
        source: {
          type: "base64",
          media_type: file.contentType,
          data: encoded,
        },
      });
    } else if (isBedrockProvider(normalizedProvider) && file instanceof ImageFile) {
      result.push({
        image: {
          format: bedrockImageFormat(file.contentType, file.filename),
          source: { bytes },
        },
      });
    } else if (isBedrockProvider(normalizedProvider) && file instanceof PDFFile) {
      result.push({
        document: {
          name: bedrockDocumentName(file.filename ?? name),
          format: "pdf",
          source: { bytes },
        },
      });
    } else if (isGeminiProvider(normalizedProvider) && file instanceof ImageFile) {
      result.push({
        inlineData: {
          mimeType: file.contentType,
          data: encoded,
        },
      });
    } else if (isGeminiProvider(normalizedProvider) && (file instanceof TextFile || file instanceof AudioFile || file instanceof VideoFile || file instanceof PDFFile)) {
      result.push({
        inlineData: {
          mimeType: file.contentType,
          data: encoded,
        },
      });
    } else if (file instanceof PDFFile && api === "responses") {
      result.push({
        type: "input_file",
        filename: file.filename ?? `${name}.pdf`,
        file_data: `data:application/pdf;base64,${encoded}`,
      });
    } else if (file instanceof ImageFile) {
      result.push({
        type: api === "responses" ? "input_image" : "image_url",
        image_url: { url: `data:${file.contentType};base64,${encoded}` },
      });
    }
  }
  return result;
}

export function format_multimodal_content(
  files: Record<string, FileInput>,
  provider: string,
  options: { api?: MultimodalContentApi; text?: string | null } | MultimodalContentApi = {},
): Record<string, unknown>[] {
  return formatMultimodalContent(files, provider, options);
}

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
  if (["bedrock", "aws"].includes(provider.toLowerCase())) {
    return false;
  }
  return getConstraintsForProvider(provider)?.supportsUrlReferences ?? false;
}

function isOpenAIProvider(provider: string): boolean {
  return provider === "openai"
    || provider === "azure"
    || provider.startsWith("openai/")
    || provider.startsWith("azure/")
    || provider.startsWith("gpt-")
    || provider.startsWith("gpt-35-")
    || provider.startsWith("o1")
    || provider.startsWith("o3")
    || provider.startsWith("o4");
}

function isGeminiProvider(provider: string): boolean {
  return provider === "gemini"
    || provider === "google"
    || provider.startsWith("gemini/")
    || provider.startsWith("google/");
}

function isAnthropicProvider(provider: string): boolean {
  return provider === "anthropic"
    || provider === "claude"
    || provider.startsWith("anthropic/")
    || provider.startsWith("claude");
}

function isBedrockProvider(provider: string): boolean {
  return provider === "bedrock"
    || provider === "aws"
    || provider.startsWith("bedrock/")
    || provider.startsWith("aws/");
}

function formatTextBlockForProvider(text: string, provider: string, api: MultimodalContentApi): Record<string, string> {
  if (api === "responses") {
    return { type: "input_text", text };
  }
  if (isGeminiProvider(provider) || isBedrockProvider(provider)) {
    return { text };
  }
  return { type: "text", text };
}

function bedrockImageFormat(contentType: string, filename: string | null): string {
  const mediaType = contentType.split("/").at(-1)?.toLowerCase();
  if (mediaType === "jpg") {
    return "jpeg";
  }
  if (mediaType) {
    return mediaType;
  }
  const extension = filename?.split(".").at(-1)?.toLowerCase();
  return extension === "jpg" ? "jpeg" : extension || "png";
}

function bedrockDocumentName(filename: string): string {
  const name = filename.replace(/\.[^.]+$/u, "");
  const sanitized = name.replace(/[^\p{L}\p{N}\s\-()[\]]/gu, " ").replace(/\s+/gu, " ").trim();
  return sanitized || "document";
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (typeof value === "object" || typeof value === "function")
    && value !== null
    && "then" in value
    && typeof (value as { then?: unknown }).then === "function";
}

function validateSize(
  fileType: string,
  filename: string | null,
  fileSize: number,
  maxSize: number,
  errors: string[],
  raiseOnError: boolean,
): void {
  if (fileSize <= maxSize) {
    return;
  }
  const message = `${fileType} '${filename ?? "null"}' size (${formatSize(fileSize)}) exceeds maximum (${formatSize(maxSize)})`;
  errors.push(message);
  if (raiseOnError) {
    throw new FileTooLargeError(message, { fileName: filename, actualSize: fileSize, maxSize });
  }
}

function validateFormat(
  fileType: string,
  filename: string | null,
  contentType: string,
  supportedFormats: readonly string[],
  errors: string[],
  raiseOnError: boolean,
): void {
  if (supportedFormats.includes(contentType)) {
    return;
  }
  const message = `${fileType} format '${contentType}' is not supported. Supported: ${supportedFormats.join(", ")}`;
  errors.push(message);
  if (raiseOnError) {
    throw new UnsupportedFileTypeError(message, { fileName: filename, contentType });
  }
}

function unsupportedFileType(file: FileInput, providerName: string, typeName: string, raiseOnError: boolean): string[] {
  const message = `Provider '${providerName}' does not support ${typeName}`;
  if (raiseOnError) {
    throw new UnsupportedFileTypeError(message, { fileName: file.filename, contentType: file.contentType });
  }
  return [message];
}

function getFileTypeConstraint(file: FileInput, constraints: ProviderConstraints): ImageConstraints | PDFConstraints | AudioConstraints | VideoConstraints | TextConstraints | null {
  if (file instanceof ImageFile) {
    return constraints.image;
  }
  if (file instanceof PDFFile) {
    return constraints.pdf;
  }
  if (file instanceof AudioFile) {
    return constraints.audio;
  }
  if (file instanceof VideoFile) {
    return constraints.video;
  }
  if (file instanceof TextFile) {
    return constraints.text;
  }
  return null;
}

function formatSize(sizeBytes: number): string {
  if (sizeBytes >= 1024 * 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  }
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)}MB`;
  }
  if (sizeBytes >= 1024) {
    return `${(sizeBytes / 1024).toFixed(1)}KB`;
  }
  return `${String(sizeBytes)}B`;
}

function computeFileHash(file: FileInput): string {
  return createHash("sha256").update(file.read()).digest("hex");
}

function uploadCacheKey(fileHash: string, provider: FileProvider): string {
  return `upload:${provider}:${fileHash}`;
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
