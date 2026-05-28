import { createHash, randomUUID } from "node:crypto";

export const CREW_AI_NAMESPACE = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

export type FingerprintMetadata = Record<string, unknown>;

export type FingerprintOptions = {
  metadata?: FingerprintMetadata;
};

export type FingerprintDict = {
  uuid_str?: string;
  uuidStr?: string;
  created_at?: string;
  createdAt?: string;
  metadata?: FingerprintMetadata;
};

export class Fingerprint {
  private uuidValue: string;
  private createdAtValue: Date;
  metadata: FingerprintMetadata;

  constructor(options: FingerprintOptions = {}) {
    this.uuidValue = randomUUID();
    this.createdAtValue = new Date();
    this.metadata = validateMetadata(options.metadata ?? {});
  }

  get uuidStr(): string {
    return this.uuidValue;
  }

  get uuid_str(): string {
    return this.uuidStr;
  }

  get createdAt(): Date {
    return this.createdAtValue;
  }

  get created_at(): Date {
    return this.createdAt;
  }

  get uuid(): string {
    validateUuid(this.uuidValue);
    return this.uuidValue;
  }

  static generate(seed?: string | null, metadata?: FingerprintMetadata | null): Fingerprint {
    const fingerprint = new Fingerprint({ metadata: metadata ?? {} });
    if (seed !== undefined && seed !== null) {
      fingerprint.uuidValue = Fingerprint.generateUuid(seed);
    }
    return fingerprint;
  }

  static generateUuid(seed: string): string {
    if (!seed.trim()) {
      throw new Error("Seed cannot be empty or whitespace");
    }
    return uuidV5(seed, CREW_AI_NAMESPACE);
  }

  static _generate_uuid(seed: string): string {
    return Fingerprint.generateUuid(seed);
  }

  static fromDict(data: FingerprintDict | null | undefined): Fingerprint {
    if (!data) {
      return new Fingerprint();
    }
    const fingerprint = new Fingerprint({ metadata: data.metadata ?? {} });
    fingerprint.uuidValue = data.uuidStr ?? data.uuid_str ?? fingerprint.uuidValue;
    const createdAt = data.createdAt ?? data.created_at;
    if (createdAt) {
      fingerprint.createdAtValue = new Date(createdAt);
    }
    return fingerprint;
  }

  static from_dict(data: FingerprintDict | null | undefined): Fingerprint {
    return Fingerprint.fromDict(data);
  }

  toDict(): Required<Pick<FingerprintDict, "metadata">> & { uuid_str: string; created_at: string } {
    return {
      uuid_str: this.uuidStr,
      created_at: this.createdAt.toISOString(),
      metadata: this.metadata,
    };
  }

  to_dict(): Required<Pick<FingerprintDict, "metadata">> & { uuid_str: string; created_at: string } {
    return this.toDict();
  }

  equals(other: unknown): boolean {
    return other instanceof Fingerprint && other.uuidStr === this.uuidStr;
  }

  toString(): string {
    return this.uuidStr;
  }
}

export type SecurityConfigOptions = {
  fingerprint?: Fingerprint | FingerprintDict | string | null;
};

export class SecurityConfig {
  fingerprint: Fingerprint;

  constructor(options: SecurityConfigOptions = {}) {
    this.fingerprint = coerceFingerprint(options.fingerprint);
  }

  static fromDict(data: { fingerprint?: FingerprintDict | null } | null | undefined): SecurityConfig {
    return new SecurityConfig({ fingerprint: data?.fingerprint ?? null });
  }

  static from_dict(data: { fingerprint?: FingerprintDict | null } | null | undefined): SecurityConfig {
    return SecurityConfig.fromDict(data);
  }

  cloneWithNewFingerprint(): SecurityConfig {
    return new SecurityConfig({
      fingerprint: new Fingerprint({ metadata: { ...this.fingerprint.metadata } }),
    });
  }

  toDict(): { fingerprint: ReturnType<Fingerprint["toDict"]> } {
    return { fingerprint: this.fingerprint.toDict() };
  }

  to_dict(): { fingerprint: ReturnType<Fingerprint["toDict"]> } {
    return this.toDict();
  }
}

export function coerceSecurityConfig(value?: SecurityConfig | SecurityConfigOptions | null): SecurityConfig {
  if (value instanceof SecurityConfig) {
    return value;
  }
  return new SecurityConfig(value ?? {});
}

function coerceFingerprint(value?: Fingerprint | FingerprintDict | string | null): Fingerprint {
  if (value === undefined || value === null) {
    return new Fingerprint();
  }
  if (value instanceof Fingerprint) {
    return value;
  }
  if (typeof value === "string") {
    if (!value.trim()) {
      throw new Error("Fingerprint seed cannot be empty");
    }
    return Fingerprint.generate(value);
  }
  return Fingerprint.fromDict(value);
}

function validateMetadata(metadata: unknown): FingerprintMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error("Metadata must be a dictionary");
  }
  const record = metadata as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (typeof key !== "string") {
      throw new Error(`Metadata keys must be strings, got ${typeof key}`);
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        if (typeof nestedKey !== "string") {
          throw new Error(`Nested metadata keys must be strings, got ${typeof nestedKey}`);
        }
        if (nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue)) {
          throw new Error("Metadata can only be nested one level deep");
        }
      }
    }
  }
  if (JSON.stringify(record).length > 10_000) {
    throw new Error("Metadata size exceeds maximum allowed (10KB)");
  }
  return { ...record };
}

function uuidV5(seed: string, namespace: string): string {
  const namespaceBytes = uuidToBytes(namespace);
  const seedBytes = Buffer.from(seed, "utf8");
  const hash = createHash("sha1").update(namespaceBytes).update(seedBytes).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  return bytesToUuid(bytes);
}

function uuidToBytes(uuid: string): Buffer {
  validateUuid(uuid);
  return Buffer.from(uuid.replaceAll("-", ""), "hex");
}

function bytesToUuid(bytes: Buffer): string {
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

function validateUuid(uuid: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)) {
    throw new Error(`Invalid UUID: ${uuid}`);
  }
}
