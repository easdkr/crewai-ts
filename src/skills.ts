import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";

import { parse as parseYaml } from "yaml";

export const SKILL_FILENAME = "SKILL.md";
export const MAX_SKILL_NAME_LENGTH = 64;
export const MIN_SKILL_NAME_LENGTH = 1;
export const MAX_DESCRIPTION_LENGTH = 1024;
export const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const METADATA = 1;
export const INSTRUCTIONS = 2;
export const RESOURCES = 3;
export const ENV_VAR = "CREWAI_EXPERIMENTAL";

export type DisclosureLevel = typeof METADATA | typeof INSTRUCTIONS | typeof RESOURCES;
export const DisclosureLevel = Object.freeze({ METADATA, INSTRUCTIONS, RESOURCES });
export type ResourceDirName = "scripts" | "references" | "assets";
export const ResourceDirName = Object.freeze(["scripts", "references", "assets"] as const);
export type SkillMetadata = {
  org: string;
  name: string;
  version: string | null;
  installed_at: string;
};
export const SkillMetadata = Object.freeze({ kind: "SkillMetadata" });
export type SkillFrontmatterOptions = {
  name: string;
  description: string;
  license?: string | null;
  compatibility?: string | null;
  metadata?: Record<string, string> | null;
  allowedTools?: readonly string[] | string | null;
  allowed_tools?: readonly string[] | string | null;
  "allowed-tools"?: readonly string[] | string | null;
  version?: string | null;
};

const closingDelimiterPattern = /\n---[ \t]*(?:\n|$)/;
const maxBodyChars = 50_000;
const metaFilename = ".crewai_meta.json";

export class SkillParseError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SkillParseError";
  }
}

export class SkillNotCachedError extends Error {
  readonly ref: string;

  constructor(ref: string) {
    super(`Skill ${JSON.stringify(ref)} is not cached locally. Run \`crewai skill install ${ref}\` to install it first.`);
    this.name = "SkillNotCachedError";
    this.ref = ref;
  }
}

export class ExperimentalFeatureDisabledError extends Error {
  constructor() {
    super(`The Skills Repository (registry refs, cache, downloads) is experimental. Set ${ENV_VAR}=1 to enable it.`);
    this.name = "ExperimentalFeatureDisabledError";
  }
}

export class SkillFrontmatter {
  readonly name: string;
  readonly description: string;
  readonly license: string | null;
  readonly compatibility: string | null;
  readonly metadata: Record<string, string> | null;
  readonly allowedTools: readonly string[] | null;
  readonly allowed_tools: readonly string[] | null;
  readonly version: string | null;

  constructor(options: SkillFrontmatterOptions) {
    validateSkillName(options.name);
    if (options.description.length < 1 || options.description.length > MAX_DESCRIPTION_LENGTH) {
      throw new SkillParseError(`Skill description must be 1-${String(MAX_DESCRIPTION_LENGTH)} characters.`);
    }
    this.name = options.name;
    this.description = options.description;
    this.license = options.license ?? null;
    this.compatibility = options.compatibility ?? null;
    this.metadata = options.metadata ? { ...options.metadata } : null;
    this.allowedTools = normalizeAllowedTools(options.allowedTools ?? options.allowed_tools ?? options["allowed-tools"] ?? null);
    this.allowed_tools = this.allowedTools;
    this.version = options.version ?? null;
  }

  static parseAllowedTools<TValues extends Record<string, unknown>>(values: TValues): TValues & { "allowed-tools"?: readonly string[] | null } {
    const raw = values["allowed-tools"] ?? values.allowed_tools;
    if (typeof raw !== "string") {
      return values;
    }
    return {
      ...values,
      "allowed-tools": normalizeAllowedTools(raw),
    };
  }

  static parse_allowed_tools<TValues extends Record<string, unknown>>(values: TValues): TValues & { "allowed-tools"?: readonly string[] | null } {
    return SkillFrontmatter.parseAllowedTools(values);
  }
}

export class Skill {
  readonly frontmatter: SkillFrontmatter;
  readonly instructions: string | null;
  readonly path: string;
  readonly disclosureLevel: DisclosureLevel;
  readonly disclosure_level: DisclosureLevel;
  readonly resourceFiles: Partial<Record<ResourceDirName, readonly string[]>> | null;
  readonly resource_files: Partial<Record<ResourceDirName, readonly string[]>> | null;

  constructor(options: {
    frontmatter: SkillFrontmatter;
    path: string;
    instructions?: string | null;
    disclosureLevel?: DisclosureLevel;
    disclosure_level?: DisclosureLevel;
    resourceFiles?: Partial<Record<ResourceDirName, readonly string[]>> | null;
    resource_files?: Partial<Record<ResourceDirName, readonly string[]>> | null;
  }) {
    this.frontmatter = options.frontmatter;
    this.path = options.path;
    this.instructions = options.instructions ?? null;
    this.disclosureLevel = options.disclosureLevel ?? options.disclosure_level ?? METADATA;
    this.disclosure_level = this.disclosureLevel;
    this.resourceFiles = options.resourceFiles ?? options.resource_files ?? null;
    this.resource_files = this.resourceFiles;
  }

  get name(): string {
    return this.frontmatter.name;
  }

  get description(): string {
    return this.frontmatter.description;
  }

  get scriptsDir(): string {
    return join(this.path, "scripts");
  }

  get scripts_dir(): string {
    return this.scriptsDir;
  }

  get referencesDir(): string {
    return join(this.path, "references");
  }

  get references_dir(): string {
    return this.referencesDir;
  }

  get assetsDir(): string {
    return join(this.path, "assets");
  }

  get assets_dir(): string {
    return this.assetsDir;
  }

  withDisclosureLevel(
    level: DisclosureLevel,
    options: {
      instructions?: string | null;
      resourceFiles?: Partial<Record<ResourceDirName, readonly string[]>> | null;
      resource_files?: Partial<Record<ResourceDirName, readonly string[]>> | null;
    } = {},
  ): Skill {
    return new Skill({
      frontmatter: this.frontmatter,
      path: this.path,
      instructions: options.instructions ?? this.instructions,
      disclosureLevel: level,
      resourceFiles: options.resourceFiles ?? options.resource_files ?? this.resourceFiles,
    });
  }

  with_disclosure_level(level: DisclosureLevel, instructions?: string | null, resource_files?: Partial<Record<ResourceDirName, readonly string[]>> | null): Skill {
    return this.withDisclosureLevel(level, {
      ...(instructions === undefined ? {} : { instructions }),
      ...(resource_files === undefined ? {} : { resource_files }),
    });
  }
}

export class SkillCacheManager {
  private readonly root: string;

  constructor(cacheRoot: string | null = null) {
    this.root = cacheRoot ?? join(homedir(), ".crewai", "skills");
  }

  getCachedPath(org: string, name: string): string | null {
    const skillDir = this.skillDir(org, name);
    return existsSync(skillDir) && existsSync(join(skillDir, metaFilename)) ? skillDir : null;
  }

  get_cached_path(org: string, name: string): string | null {
    return this.getCachedPath(org, name);
  }

  storeDirectory(org: string, name: string, version: string | null, sourceDirectory: string): string {
    const skillDir = this.skillDir(org, name);
    if (existsSync(skillDir)) {
      rmSync(skillDir, { recursive: true, force: true });
    }
    mkdirSync(skillDir, { recursive: true });
    cpSync(sourceDirectory, skillDir, { recursive: true });
    this.writeMetadata(skillDir, org, name, version);
    return skillDir;
  }

  store_directory(org: string, name: string, version: string | null, source_directory: string): string {
    return this.storeDirectory(org, name, version, source_directory);
  }

  store(org: string, name: string, version: string | null, archiveBytes: Uint8Array): string {
    const skillDir = this.skillDir(org, name);
    if (existsSync(skillDir)) {
      rmSync(skillDir, { recursive: true, force: true });
    }
    mkdirSync(skillDir, { recursive: true });
    try {
      extractSkillArchive(archiveBytes, skillDir);
      this.writeMetadata(skillDir, org, name, version);
      return skillDir;
    } catch (error) {
      rmSync(skillDir, { recursive: true, force: true });
      throw error;
    }
  }

  listCached(): SkillMetadata[] {
    if (!existsSync(this.root)) {
      return [];
    }
    const results: SkillMetadata[] = [];
    for (const orgDir of sortedDirectories(this.root)) {
      for (const skillDir of sortedDirectories(orgDir)) {
        const metaPath = join(skillDir, metaFilename);
        if (!existsSync(metaPath)) {
          continue;
        }
        try {
          const parsed: unknown = JSON.parse(readFileSync(metaPath, "utf8"));
          if (isSkillMetadata(parsed)) {
            results.push(parsed);
          }
        } catch {
          // Match upstream: malformed cache entries are ignored.
        }
      }
    }
    return results;
  }

  list_cached(): SkillMetadata[] {
    return this.listCached();
  }

  invalidate(org: string, name: string): boolean {
    const skillDir = this.skillDir(org, name);
    if (!existsSync(skillDir)) {
      return false;
    }
    rmSync(skillDir, { recursive: true, force: true });
    return true;
  }

  private skillDir(org: string, name: string): string {
    return join(this.root, org, name);
  }

  private writeMetadata(skillDir: string, org: string, name: string, version: string | null): void {
    const meta: SkillMetadata = {
      org,
      name,
      version,
      installed_at: new Date().toISOString(),
    };
    writeFileSync(join(skillDir, metaFilename), JSON.stringify(meta, null, 2));
  }
}

export function parseFrontmatter(content: string): [frontmatter: Record<string, unknown>, body: string] {
  if (!content.startsWith("---")) {
    throw new SkillParseError("SKILL.md must start with '---' frontmatter delimiter");
  }
  const match = closingDelimiterPattern.exec(content.slice(3));
  if (!match) {
    throw new SkillParseError("SKILL.md missing closing '---' frontmatter delimiter");
  }
  const delimiterStart = 3 + match.index;
  const delimiterEnd = 3 + match.index + match[0].length;
  let parsed: unknown;
  try {
    parsed = parseYaml(content.slice(3, delimiterStart).trim());
  } catch (error) {
    throw new SkillParseError(`Invalid YAML in frontmatter: ${String(error)}`, { cause: error });
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SkillParseError("Frontmatter must be a YAML mapping");
  }
  return [parsed as Record<string, unknown>, content.slice(delimiterEnd).trim()];
}

export const parse_frontmatter = parseFrontmatter;

export function parseSkillMd(path: string): [frontmatter: SkillFrontmatter, body: string] {
  const [frontmatter, body] = parseFrontmatter(readFileSync(path, "utf8"));
  return [new SkillFrontmatter(normalizeFrontmatter(frontmatter)), body];
}

export const parse_skill_md = parseSkillMd;

export function loadSkillMetadata(skillDir: string): Skill {
  const [frontmatter, body] = parseSkillMd(join(skillDir, SKILL_FILENAME));
  validateDirectoryName(skillDir, frontmatter.name);
  if (body.length > maxBodyChars) {
    // Large bodies are valid; callers choose whether to activate them.
  }
  return new Skill({
    frontmatter,
    path: skillDir,
    disclosureLevel: METADATA,
  });
}

export const load_skill_metadata = loadSkillMetadata;

export function loadSkillInstructions(skill: Skill): Skill {
  if (skill.disclosureLevel >= INSTRUCTIONS) {
    return skill;
  }
  const [, body] = parseSkillMd(join(skill.path, SKILL_FILENAME));
  return skill.withDisclosureLevel(INSTRUCTIONS, { instructions: body });
}

export const load_skill_instructions = loadSkillInstructions;

export function loadSkillResources(skill: Skill): Skill {
  const withInstructions = skill.disclosureLevel < INSTRUCTIONS ? loadSkillInstructions(skill) : skill;
  if (withInstructions.disclosureLevel >= RESOURCES) {
    return withInstructions;
  }
  const resourceFiles: Partial<Record<ResourceDirName, readonly string[]>> = {};
  for (const dirName of ["scripts", "references", "assets"] as const) {
    const dir = join(withInstructions.path, dirName);
    if (existsSync(dir) && statSync(dir).isDirectory()) {
      resourceFiles[dirName] = listFilesRelative(dir);
    }
  }
  return withInstructions.withDisclosureLevel(RESOURCES, { resourceFiles });
}

export const load_skill_resources = loadSkillResources;
export const loadResources = loadSkillResources;
export const load_resources = loadSkillResources;

export function discoverSkills(searchPath: string, source: unknown = null): Skill[] {
  void source;
  if (!existsSync(searchPath) || !statSync(searchPath).isDirectory()) {
    throw new Error(`Skill search path does not exist or is not a directory: ${searchPath}`);
  }
  const skills: Skill[] = [];
  for (const child of sortedDirectories(searchPath)) {
    if (!existsSync(join(child, SKILL_FILENAME))) {
      continue;
    }
    try {
      skills.push(loadSkillMetadata(child));
    } catch {
      // Match upstream: skip malformed skill directories during discovery.
    }
  }
  return skills;
}

export const discover_skills = discoverSkills;

export function activateSkill(skill: Skill, source: unknown = null): Skill {
  void source;
  return skill.disclosureLevel >= INSTRUCTIONS ? skill : loadSkillInstructions(skill);
}

export const activate_skill = activateSkill;

export function formatSkillContext(skill: Skill): string {
  if (skill.disclosureLevel >= INSTRUCTIONS && skill.instructions) {
    const parts = [
      `<skill name="${escapeXmlAttribute(skill.name)}">`,
      skill.description,
      "",
      skill.instructions,
    ];
    if (skill.disclosureLevel >= RESOURCES && skill.resourceFiles) {
      parts.push("", "### Available Resources");
      for (const [dirName, files] of Object.entries(skill.resourceFiles).sort()) {
        if (files.length > 0) {
          parts.push(`- **${dirName}/**: ${files.join(", ")}`);
        }
      }
    }
    parts.push("</skill>");
    return parts.join("\n");
  }
  return `<skill name="${escapeXmlAttribute(skill.name)}">\n${skill.description}\n</skill>`;
}

export const format_skill_context = formatSkillContext;

export function validateDirectoryName(skillDir: string, skillName: string): void {
  const dirName = basename(skillDir);
  if (dirName !== skillName) {
    throw new Error(`Directory name '${dirName}' does not match skill name '${skillName}'`);
  }
}

export const validate_directory_name = validateDirectoryName;

export function isRegistryRef(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("@");
}

export const is_registry_ref = isRegistryRef;

export function is_enabled(): boolean {
  return process.env[ENV_VAR] === "1";
}

export function require_experimental_skills(): void {
  if (!is_enabled()) {
    throw new ExperimentalFeatureDisabledError();
  }
}

export function parseRegistryRef(ref: string): [org: string, name: string] {
  if (!ref.startsWith("@")) {
    throw new Error(`Registry reference must start with '@', got: ${JSON.stringify(ref)}`);
  }
  const withoutAt = ref.slice(1);
  if ((withoutAt.match(/\//g)?.length ?? 0) !== 1) {
    throw new Error(`Registry reference must be in '@org/name' format, got: ${JSON.stringify(ref)}`);
  }
  const [org, name] = withoutAt.split("/") as [string, string];
  if (!org || !name || org.startsWith(".") || name.startsWith(".")) {
    throw new Error(`Registry reference org and name must be single, non-empty path segments, got: ${JSON.stringify(ref)}`);
  }
  return [org, name];
}

export const parse_registry_ref = parseRegistryRef;

export function resolveRegistryRef(ref: string, source: unknown = null, options: { cacheRoot?: string | null; cwd?: string } = {}): Skill {
  const [org, name] = parseRegistryRef(ref);
  const localPath = join(options.cwd ?? process.cwd(), "skills", name);
  if (existsSync(join(localPath, SKILL_FILENAME))) {
    return activateSkill(loadSkillMetadata(localPath), source);
  }
  const cachedPath = new SkillCacheManager(options.cacheRoot ?? null).getCachedPath(org, name);
  if (cachedPath && existsSync(join(cachedPath, SKILL_FILENAME))) {
    return activateSkill(loadSkillMetadata(cachedPath), source);
  }
  throw new SkillNotCachedError(ref);
}

export const resolve_registry_ref = resolveRegistryRef;

function normalizeFrontmatter(value: Record<string, unknown>): SkillFrontmatterOptions {
  const name = value.name;
  const description = value.description;
  if (typeof name !== "string") {
    throw new SkillParseError("Skill frontmatter 'name' must be a string.");
  }
  if (typeof description !== "string") {
    throw new SkillParseError("Skill frontmatter 'description' must be a string.");
  }
  return {
    name,
    description,
    license: optionalString(value.license),
    compatibility: optionalString(value.compatibility),
    metadata: normalizeMetadata(value.metadata),
    allowedTools: normalizeAllowedTools(value["allowed-tools"] ?? value.allowed_tools),
    version: optionalString(value.version),
  };
}

function validateSkillName(name: string): void {
  if (name.length < MIN_SKILL_NAME_LENGTH || name.length > MAX_SKILL_NAME_LENGTH || !SKILL_NAME_PATTERN.test(name)) {
    throw new SkillParseError(`Skill name must match ${SKILL_NAME_PATTERN.source} and be 1-${String(MAX_SKILL_NAME_LENGTH)} characters.`);
  }
}

function normalizeAllowedTools(value: unknown): readonly string[] | null {
  if (typeof value === "string") {
    return value.split(/\s+/).filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.map(String);
  }
  return null;
}

function extractSkillArchive(archiveBytes: Uint8Array, destination: string): void {
  const buffer = Buffer.from(archiveBytes);
  if (buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50) {
    extractZipArchive(buffer, destination);
    return;
  }
  extractTarGzArchive(buffer, destination);
}

function extractTarGzArchive(archiveBytes: Uint8Array, destination: string): void {
  const tar = gunzipSync(archiveBytes);
  const destinationRoot = resolve(destination);
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    offset += 512;
    if (header.every((byte) => byte === 0)) {
      break;
    }
    const name = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const entryName = prefix ? `${prefix}/${name}` : name;
    const size = readTarOctal(header, 124, 12);
    const typeflag = readTarString(header, 156, 1) || "0";
    const entryData = tar.subarray(offset, offset + size);
    offset += size + ((512 - (size % 512)) % 512);
    if (!entryName) {
      continue;
    }
    const target = resolve(destination, entryName);
    if (!target.startsWith(`${destinationRoot}/`) && target !== destinationRoot) {
      throw new Error(`Blocked path traversal attempt: ${JSON.stringify(entryName)}`);
    }
    if (typeflag === "5") {
      mkdirSync(target, { recursive: true });
      continue;
    }
    if (typeflag === "0" || typeflag === "\0") {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, entryData);
    }
  }
}

function readTarString(buffer: Buffer, offset: number, length: number): string {
  const slice = buffer.subarray(offset, offset + length);
  const end = slice.indexOf(0);
  return slice.subarray(0, end >= 0 ? end : slice.length).toString("utf8").trim();
}

function readTarOctal(buffer: Buffer, offset: number, length: number): number {
  const raw = readTarString(buffer, offset, length).trim();
  return raw ? Number.parseInt(raw, 8) : 0;
}

function extractZipArchive(zip: Buffer, destination: string): void {
  const destinationRoot = resolve(destination);
  let offset = 0;
  let extracted = false;
  while (offset + 30 <= zip.length) {
    const signature = zip.readUInt32LE(offset);
    if (signature === 0x02014b50 || signature === 0x06054b50) {
      break;
    }
    if (signature !== 0x04034b50) {
      if (!extracted) {
        throw new Error("Invalid ZIP archive");
      }
      break;
    }
    const flags = zip.readUInt16LE(offset + 6);
    const compression = zip.readUInt16LE(offset + 8);
    const compressedSize = zip.readUInt32LE(offset + 18);
    const fileNameLength = zip.readUInt16LE(offset + 26);
    const extraLength = zip.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    const entryName = zip.subarray(nameStart, nameStart + fileNameLength).toString("utf8");
    if ((flags & 0x08) !== 0) {
      throw new Error("ZIP data descriptors are not supported");
    }
    if (compression !== 0) {
      throw new Error("Only uncompressed ZIP entries are supported");
    }
    if (dataEnd > zip.length) {
      throw new Error("Invalid ZIP archive");
    }
    const target = resolve(destination, entryName);
    if (!target.startsWith(`${destinationRoot}/`) && target !== destinationRoot) {
      throw new Error(`Blocked path traversal attempt: ${JSON.stringify(entryName)}`);
    }
    if (entryName.endsWith("/")) {
      mkdirSync(target, { recursive: true });
    } else {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, zip.subarray(dataStart, dataEnd));
    }
    extracted = true;
    offset = dataEnd;
  }
}

function normalizeMetadata(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, String(item)]));
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function sortedDirectories(dir: string): string[] {
  return readdirSync(dir)
    .map((entry) => join(dir, entry))
    .filter((entry) => statSync(entry).isDirectory())
    .sort();
}

function listFilesRelative(dir: string): string[] {
  const root = resolve(dir);
  const results: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current).sort()) {
      const fullPath = join(current, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (stat.isFile()) {
        results.push(resolve(fullPath).slice(root.length + 1));
      }
    }
  };
  walk(root);
  return results;
}

function isSkillMetadata(value: unknown): value is SkillMetadata {
  return Boolean(value)
    && typeof value === "object"
    && typeof (value as SkillMetadata).org === "string"
    && typeof (value as SkillMetadata).name === "string"
    && typeof (value as SkillMetadata).installed_at === "string";
}

function escapeXmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
