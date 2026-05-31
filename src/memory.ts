import {
  MemoryQueryCompletedEvent,
  MemoryQueryFailedEvent,
  MemoryQueryStartedEvent,
  MemorySaveCompletedEvent,
  MemorySaveFailedEvent,
  MemorySaveStartedEvent,
  crewaiEventBus,
} from "./events.js";
import { callLLM, createLLMClient, type LLM } from "./llm.js";
import { I18N_DEFAULT } from "./i18n.js";
import { BaseTool, type BaseToolOptions, type ToolArgsSchema } from "./tools.js";
import type { LLMMessage, Tool } from "./types.js";

export type MemoryRecordOptions = {
  id?: string;
  content: string;
  scope?: string;
  categories?: readonly string[];
  metadata?: Record<string, unknown>;
  importance?: number;
  source?: string | null;
  private?: boolean;
  createdAt?: Date | string;
  created_at?: Date | string;
  lastAccessed?: Date | string;
  last_accessed?: Date | string;
  embedding?: readonly number[] | null;
};

export class MemoryRecord {
  readonly id: string;
  readonly content: string;
  readonly scope: string;
  readonly categories: readonly string[];
  readonly metadata: Record<string, unknown>;
  readonly importance: number;
  readonly source: string | null;
  readonly private: boolean;
  readonly createdAt: Date;
  readonly created_at?: Date;
  readonly lastAccessed?: Date;
  readonly last_accessed?: Date;
  readonly embedding?: readonly number[] | null;

  constructor(options: MemoryRecordOptions) {
    const createdAt = coerceDate(options.createdAt ?? options.created_at) ?? new Date();
    const lastAccessed = coerceDate(options.lastAccessed ?? options.last_accessed) ?? createdAt;
    this.id = options.id ?? crypto.randomUUID();
    this.content = options.content;
    this.scope = options.scope ?? "/";
    this.categories = options.categories ?? [];
    this.metadata = { ...(options.metadata ?? {}) };
    this.importance = clamp01(options.importance ?? 0.5);
    this.source = options.source ?? null;
    this.private = options.private ?? false;
    this.createdAt = createdAt;
    this.created_at = createdAt;
    this.lastAccessed = lastAccessed;
    this.last_accessed = lastAccessed;
    this.embedding = options.embedding ?? null;
  }
}

export type MemoryMatchOptions = {
  record: MemoryRecord | MemoryRecordOptions;
  score: number;
  matchReasons?: readonly string[];
  match_reasons?: readonly string[];
  evidenceGaps?: readonly string[];
  evidence_gaps?: readonly string[];
};

export class MemoryMatch {
  readonly record: MemoryRecord;
  readonly score: number;
  readonly matchReasons: readonly string[];
  readonly match_reasons: readonly string[];
  readonly evidenceGaps: readonly string[];
  readonly evidence_gaps: readonly string[];

  constructor(options: MemoryMatchOptions) {
    this.record = options.record instanceof MemoryRecord ? options.record : new MemoryRecord(options.record);
    this.score = options.score;
    this.matchReasons = options.matchReasons ?? options.match_reasons ?? [];
    this.match_reasons = this.matchReasons;
    this.evidenceGaps = options.evidenceGaps ?? options.evidence_gaps ?? [];
    this.evidence_gaps = this.evidenceGaps;
  }

  format(): string {
    const lines = [`- (score=${this.score.toFixed(2)}) ${this.record.content}`];
    if (this.record.categories.length > 0) {
      lines.push(`  categories: ${this.record.categories.join(", ")}`);
    }
    for (const [key, value] of Object.entries(this.record.metadata)) {
      if (value !== null && value !== undefined) {
        lines.push(`  ${key}: ${formatMetadataValue(value)}`);
      }
    }
    return lines.join("\n");
  }
}

export type MemoryOptions = {
  readOnly?: boolean;
  rootScope?: string | null;
  llm?: LLM | null;
};

export class ExtractedMetadata {
  readonly entities: readonly string[];
  readonly dates: readonly string[];
  readonly topics: readonly string[];

  constructor(options: { entities?: readonly string[]; dates?: readonly string[]; topics?: readonly string[] } = {}) {
    this.entities = options.entities ?? [];
    this.dates = options.dates ?? [];
    this.topics = options.topics ?? [];
  }
}

export class MemoryAnalysis {
  readonly suggestedScope: string;
  readonly suggested_scope: string;
  readonly categories: readonly string[];
  readonly importance: number;
  readonly extractedMetadata: ExtractedMetadata;
  readonly extracted_metadata: ExtractedMetadata;

  constructor(options: {
    suggestedScope?: string;
    suggested_scope?: string;
    categories?: readonly string[];
    importance?: number;
    extractedMetadata?: ExtractedMetadata | Record<string, unknown>;
    extracted_metadata?: ExtractedMetadata | Record<string, unknown>;
  } = {}) {
    this.suggestedScope = options.suggestedScope ?? options.suggested_scope ?? "/";
    this.suggested_scope = this.suggestedScope;
    this.categories = options.categories ?? [];
    this.importance = clamp01(options.importance ?? 0.5);
    this.extractedMetadata = coerceExtractedMetadata(options.extractedMetadata ?? options.extracted_metadata);
    this.extracted_metadata = this.extractedMetadata;
  }
}

export class QueryAnalysis {
  readonly keywords: readonly string[];
  readonly suggestedScopes: readonly string[];
  readonly suggested_scopes: readonly string[];
  readonly complexity: string;
  readonly recallQueries: readonly string[];
  readonly recall_queries: readonly string[];
  readonly timeFilter: string | null;
  readonly time_filter: string | null;

  constructor(options: {
    keywords?: readonly string[];
    suggestedScopes?: readonly string[];
    suggested_scopes?: readonly string[];
    complexity?: string;
    recallQueries?: readonly string[];
    recall_queries?: readonly string[];
    timeFilter?: string | null;
    time_filter?: string | null;
  } = {}) {
    this.keywords = options.keywords ?? [];
    this.suggestedScopes = options.suggestedScopes ?? options.suggested_scopes ?? [];
    this.suggested_scopes = this.suggestedScopes;
    this.complexity = options.complexity ?? "simple";
    this.recallQueries = options.recallQueries ?? options.recall_queries ?? [];
    this.recall_queries = this.recallQueries;
    this.timeFilter = options.timeFilter ?? options.time_filter ?? null;
    this.time_filter = this.timeFilter;
  }
}

export class ExtractedMemories {
  readonly memories: readonly string[];

  constructor(options: { memories?: readonly string[] } = {}) {
    this.memories = options.memories ?? [];
  }
}

export class ConsolidationAction {
  readonly action: string;
  readonly recordId: string;
  readonly record_id: string;
  readonly newContent: string | null;
  readonly new_content: string | null;
  readonly reason: string;

  constructor(options: { action: string; recordId?: string; record_id?: string; newContent?: string | null; new_content?: string | null; reason?: string }) {
    this.action = options.action;
    this.recordId = options.recordId ?? options.record_id ?? "";
    this.record_id = this.recordId;
    this.newContent = options.newContent ?? options.new_content ?? null;
    this.new_content = this.newContent;
    this.reason = options.reason ?? "";
  }
}

export class ConsolidationPlan {
  readonly actions: readonly ConsolidationAction[];
  readonly insertNew: boolean;
  readonly insert_new: boolean;
  readonly insertReason: string;
  readonly insert_reason: string;

  constructor(options: { actions?: readonly (ConsolidationAction | Record<string, unknown>)[]; insertNew?: boolean; insert_new?: boolean; insertReason?: string; insert_reason?: string } = {}) {
    this.actions = (options.actions ?? []).map(coerceConsolidationAction);
    this.insertNew = options.insertNew ?? options.insert_new ?? true;
    this.insert_new = this.insertNew;
    this.insertReason = options.insertReason ?? options.insert_reason ?? "";
    this.insert_reason = this.insertReason;
  }
}

export type ScopeInfoOptions = {
  path: string;
  count?: number;
  recordCount?: number;
  record_count?: number;
  categories?: readonly string[];
  lastUpdated?: Date | string | null;
  last_updated?: Date | string | null;
  oldestRecord?: Date | string | null;
  oldest_record?: Date | string | null;
  newestRecord?: Date | string | null;
  newest_record?: Date | string | null;
  childScopes?: readonly string[];
  child_scopes?: readonly string[];
};

export class ScopeInfo {
  readonly path: string;
  readonly count: number;
  readonly recordCount: number;
  readonly record_count: number;
  readonly categories: readonly string[];
  readonly lastUpdated: Date | null;
  readonly last_updated: Date | null;
  readonly oldestRecord: Date | null;
  readonly oldest_record: Date | null;
  readonly newestRecord: Date | null;
  readonly newest_record: Date | null;
  readonly childScopes: readonly string[];
  readonly child_scopes: readonly string[];

  constructor(options: ScopeInfoOptions) {
    const count = options.count ?? options.recordCount ?? options.record_count ?? 0;
    const newestRecord = coerceDate(options.newestRecord ?? options.newest_record ?? options.lastUpdated ?? options.last_updated);
    this.path = options.path;
    this.count = count;
    this.recordCount = count;
    this.record_count = count;
    this.categories = options.categories ?? [];
    this.lastUpdated = coerceDate(options.lastUpdated ?? options.last_updated) ?? newestRecord;
    this.last_updated = this.lastUpdated;
    this.oldestRecord = coerceDate(options.oldestRecord ?? options.oldest_record);
    this.oldest_record = this.oldestRecord;
    this.newestRecord = newestRecord;
    this.newest_record = newestRecord;
    this.childScopes = options.childScopes ?? options.child_scopes ?? [];
    this.child_scopes = this.childScopes;
  }
}

export class MemoryConfig {
  readonly recencyWeight: number;
  readonly recency_weight: number;
  readonly semanticWeight: number;
  readonly semantic_weight: number;
  readonly importanceWeight: number;
  readonly importance_weight: number;
  readonly recencyHalfLifeDays: number;
  readonly recency_half_life_days: number;
  readonly consolidationThreshold: number;
  readonly consolidation_threshold: number;
  readonly consolidationLimit: number;
  readonly consolidation_limit: number;
  readonly batchDedupThreshold: number;
  readonly batch_dedup_threshold: number;
  readonly defaultImportance: number;
  readonly default_importance: number;
  readonly confidenceThresholdHigh: number;
  readonly confidence_threshold_high: number;
  readonly confidenceThresholdLow: number;
  readonly confidence_threshold_low: number;
  readonly complexQueryThreshold: number;
  readonly complex_query_threshold: number;
  readonly explorationBudget: number;
  readonly exploration_budget: number;
  readonly recallOversampleFactor: number;
  readonly recall_oversample_factor: number;
  readonly queryAnalysisThreshold: number;
  readonly query_analysis_threshold: number;

  constructor(options: {
    recencyWeight?: number;
    recency_weight?: number;
    semanticWeight?: number;
    semantic_weight?: number;
    importanceWeight?: number;
    importance_weight?: number;
    recencyHalfLifeDays?: number;
    recency_half_life_days?: number;
    consolidationThreshold?: number;
    consolidation_threshold?: number;
    consolidationLimit?: number;
    consolidation_limit?: number;
    batchDedupThreshold?: number;
    batch_dedup_threshold?: number;
    defaultImportance?: number;
    default_importance?: number;
    confidenceThresholdHigh?: number;
    confidence_threshold_high?: number;
    confidenceThresholdLow?: number;
    confidence_threshold_low?: number;
    complexQueryThreshold?: number;
    complex_query_threshold?: number;
    explorationBudget?: number;
    exploration_budget?: number;
    recallOversampleFactor?: number;
    recall_oversample_factor?: number;
    queryAnalysisThreshold?: number;
    query_analysis_threshold?: number;
  } = {}) {
    this.recencyWeight = clamp01(options.recencyWeight ?? options.recency_weight ?? 0.3);
    this.recency_weight = this.recencyWeight;
    this.semanticWeight = clamp01(options.semanticWeight ?? options.semantic_weight ?? 0.5);
    this.semantic_weight = this.semanticWeight;
    this.importanceWeight = clamp01(options.importanceWeight ?? options.importance_weight ?? 0.2);
    this.importance_weight = this.importanceWeight;
    this.recencyHalfLifeDays = Math.max(1, options.recencyHalfLifeDays ?? options.recency_half_life_days ?? 30);
    this.recency_half_life_days = this.recencyHalfLifeDays;
    this.consolidationThreshold = clamp01(options.consolidationThreshold ?? options.consolidation_threshold ?? 0.85);
    this.consolidation_threshold = this.consolidationThreshold;
    this.consolidationLimit = Math.max(1, options.consolidationLimit ?? options.consolidation_limit ?? 5);
    this.consolidation_limit = this.consolidationLimit;
    this.batchDedupThreshold = clamp01(options.batchDedupThreshold ?? options.batch_dedup_threshold ?? 0.98);
    this.batch_dedup_threshold = this.batchDedupThreshold;
    this.defaultImportance = clamp01(options.defaultImportance ?? options.default_importance ?? 0.5);
    this.default_importance = this.defaultImportance;
    this.confidenceThresholdHigh = clamp01(options.confidenceThresholdHigh ?? options.confidence_threshold_high ?? 0.8);
    this.confidence_threshold_high = this.confidenceThresholdHigh;
    this.confidenceThresholdLow = clamp01(options.confidenceThresholdLow ?? options.confidence_threshold_low ?? 0.5);
    this.confidence_threshold_low = this.confidenceThresholdLow;
    this.complexQueryThreshold = clamp01(options.complexQueryThreshold ?? options.complex_query_threshold ?? 0.7);
    this.complex_query_threshold = this.complexQueryThreshold;
    this.explorationBudget = Math.max(0, options.explorationBudget ?? options.exploration_budget ?? 1);
    this.exploration_budget = this.explorationBudget;
    this.recallOversampleFactor = Math.max(1, options.recallOversampleFactor ?? options.recall_oversample_factor ?? 2);
    this.recall_oversample_factor = this.recallOversampleFactor;
    this.queryAnalysisThreshold = Math.max(0, options.queryAnalysisThreshold ?? options.query_analysis_threshold ?? 250);
    this.query_analysis_threshold = this.queryAnalysisThreshold;
  }
}

export class ItemState {
  constructor(public readonly content = "") {}
}

export class EncodingState {
  readonly id = crypto.randomUUID();
  readonly items: ItemState[];
  records_inserted = 0;
  records_updated = 0;
  records_deleted = 0;
  items_dropped_dedup = 0;

  constructor(options: { items?: readonly (ItemState | string)[] } = {}) {
    this.items = (options.items ?? []).map((item) => item instanceof ItemState ? item : new ItemState(item));
  }
}

export class EncodingFlow {
  readonly state: EncodingState;

  constructor(public readonly storage: unknown = null, public readonly llm: unknown = null, public readonly embedder: unknown = null, public readonly config = new MemoryConfig()) {
    this.state = new EncodingState();
  }
}

export class RecallState {
  id: string;
  query: string;
  scope: string | null;
  categories: readonly string[] | null;
  timeCutoff: Date | null;
  time_cutoff: Date | null;
  source: string | null;
  includePrivate: boolean;
  include_private: boolean;
  limit: number;
  queryEmbeddings: Array<readonly [string, readonly number[]]>;
  query_embeddings: Array<readonly [string, readonly number[]]>;
  candidateScopes: string[];
  candidate_scopes: string[];
  chunkFindings: unknown[];
  chunk_findings: unknown[];
  evidenceGaps: string[];
  evidence_gaps: string[];
  confidence: number;
  finalResults: MemoryMatch[];
  final_results: MemoryMatch[];
  explorationBudget: number;
  exploration_budget: number;

  constructor(options: {
    id?: string;
    query?: string;
    scope?: string | null;
    categories?: readonly string[] | null;
    timeCutoff?: Date | string | null;
    time_cutoff?: Date | string | null;
    source?: string | null;
    includePrivate?: boolean;
    include_private?: boolean;
    limit?: number;
    queryEmbeddings?: Array<readonly [string, readonly number[]]>;
    query_embeddings?: Array<readonly [string, readonly number[]]>;
    candidateScopes?: readonly string[];
    candidate_scopes?: readonly string[];
    chunkFindings?: readonly unknown[];
    chunk_findings?: readonly unknown[];
    evidenceGaps?: readonly string[];
    evidence_gaps?: readonly string[];
    confidence?: number;
    finalResults?: readonly MemoryMatch[];
    final_results?: readonly MemoryMatch[];
    explorationBudget?: number;
    exploration_budget?: number;
  } = {}) {
    this.id = options.id ?? crypto.randomUUID();
    this.query = options.query ?? "";
    this.scope = options.scope ?? null;
    this.categories = options.categories ?? null;
    const timeCutoff = coerceDate(options.timeCutoff ?? options.time_cutoff) ?? null;
    this.timeCutoff = timeCutoff;
    this.time_cutoff = timeCutoff;
    this.source = options.source ?? null;
    this.includePrivate = options.includePrivate ?? options.include_private ?? false;
    this.include_private = this.includePrivate;
    this.limit = options.limit ?? 10;
    this.queryEmbeddings = [...(options.queryEmbeddings ?? options.query_embeddings ?? [])];
    this.query_embeddings = this.queryEmbeddings;
    this.candidateScopes = [...(options.candidateScopes ?? options.candidate_scopes ?? [])];
    this.candidate_scopes = this.candidateScopes;
    this.chunkFindings = [...(options.chunkFindings ?? options.chunk_findings ?? [])];
    this.chunk_findings = this.chunkFindings;
    this.evidenceGaps = [...(options.evidenceGaps ?? options.evidence_gaps ?? [])];
    this.evidence_gaps = this.evidenceGaps;
    this.confidence = options.confidence ?? 0;
    this.finalResults = [...(options.finalResults ?? options.final_results ?? [])];
    this.final_results = this.finalResults;
    this.explorationBudget = options.explorationBudget ?? options.exploration_budget ?? 1;
    this.exploration_budget = this.explorationBudget;
  }
}

export const VECTOR_NAME = "memory";
export const DEFAULT_VECTOR_DIM = 1536;

export type MemoryVectorSearchOptions = {
  scope_prefix?: string | null;
  scopePrefix?: string | null;
  categories?: readonly string[] | null;
  metadata_filter?: Record<string, unknown> | null;
  metadataFilter?: Record<string, unknown> | null;
  limit?: number;
  min_score?: number;
  minScore?: number;
};

export type MemoryVectorStorageLike = {
  search(embedding: readonly number[], options?: MemoryVectorSearchOptions): Array<readonly [MemoryRecord, number]>;
};

export class QdrantEdgeStorage implements MemoryVectorStorageLike {
  private readonly records = new Map<string, MemoryRecord>();
  readonly path: string | null;
  readonly vectorDim: number;
  readonly vector_dim: number;

  constructor(options: string | { path?: string | null; vectorDim?: number | null; vector_dim?: number | null } | null = null) {
    const config = typeof options === "string" || options === null ? { path: options } : options;
    this.path = config.path ?? null;
    this.vectorDim = config.vectorDim ?? config.vector_dim ?? DEFAULT_VECTOR_DIM;
    this.vector_dim = this.vectorDim;
  }

  save(records: MemoryRecord | MemoryRecordOptions | readonly (MemoryRecord | MemoryRecordOptions)[]): void {
    const memoryRecords: readonly (MemoryRecord | MemoryRecordOptions)[] = Array.isArray(records)
      ? records as readonly (MemoryRecord | MemoryRecordOptions)[]
      : [records as MemoryRecord | MemoryRecordOptions];
    for (const record of memoryRecords) {
      const memoryRecord = record instanceof MemoryRecord ? record : new MemoryRecord(record);
      this.records.set(memoryRecord.id, memoryRecord);
    }
  }

  search(
    embedding: readonly number[],
    optionsOrScopePrefix: MemoryVectorSearchOptions | string | null = {},
    categoriesArg: readonly string[] | null = null,
    metadataFilterArg: Record<string, unknown> | null = null,
    limitArg?: number,
    minScoreArg?: number,
  ): Array<readonly [MemoryRecord, number]> {
    let options: MemoryVectorSearchOptions;
    if (typeof optionsOrScopePrefix === "object" && optionsOrScopePrefix !== null && !Array.isArray(optionsOrScopePrefix)) {
      options = optionsOrScopePrefix;
    } else {
      options = {
        scopePrefix: typeof optionsOrScopePrefix === "string" ? optionsOrScopePrefix : null,
        categories: categoriesArg,
        metadataFilter: metadataFilterArg,
      };
      if (limitArg !== undefined) {
        options.limit = limitArg;
      }
      if (minScoreArg !== undefined) {
        options.minScore = minScoreArg;
      }
    }
    const scopePrefix = options.scopePrefix ?? options.scope_prefix ?? null;
    const categories = options.categories ?? null;
    const metadataFilter = options.metadataFilter ?? options.metadata_filter ?? null;
    const limit = options.limit ?? 10;
    const minScore = options.minScore ?? options.min_score ?? Number.NEGATIVE_INFINITY;
    return [...this.records.values()]
      .filter((record) => !scopePrefix || !scopePrefix.trim().replaceAll("/", "") || record.scope.startsWith(normalize_scope_path(scopePrefix)))
      .filter((record) => !categories || categories.some((category) => record.categories.includes(category)))
      .filter((record) => !metadataFilter || Object.entries(metadataFilter).every(([key, value]) => record.metadata[key] === value))
      .map((record) => [record, cosineSimilarity(embedding, record.embedding ?? [])] as const)
      .filter(([, score]) => score >= minScore)
      .sort((left, right) => right[1] - left[1])
      .slice(0, limit);
  }

  get_record(record_id: string): MemoryRecord | null {
    return this.records.get(record_id) ?? null;
  }

  getRecord(recordId: string): MemoryRecord | null {
    return this.get_record(recordId);
  }

  update(record: MemoryRecord | MemoryRecordOptions): void {
    const memoryRecord = record instanceof MemoryRecord ? record : new MemoryRecord(record);
    this.records.set(memoryRecord.id, memoryRecord);
  }

  touch_records(record_ids: readonly string[]): void {
    if (record_ids.length === 0) {
      return;
    }
    const now = new Date();
    for (const recordId of record_ids) {
      const existing = this.records.get(recordId);
      if (!existing) {
        continue;
      }
      const touchedOptions: MemoryRecordOptions = {
        id: existing.id,
        content: existing.content,
        scope: existing.scope,
        categories: existing.categories,
        metadata: existing.metadata,
        importance: existing.importance,
        source: existing.source,
        private: existing.private,
        createdAt: existing.createdAt,
        lastAccessed: now,
      };
      if (existing.embedding !== undefined) {
        touchedOptions.embedding = existing.embedding;
      }
      this.records.set(recordId, new MemoryRecord(touchedOptions));
    }
  }

  touchRecords(recordIds: readonly string[]): void {
    this.touch_records(recordIds);
  }

  list_records(scope_prefix: string | null = null, limit = 200, offset = 0): MemoryRecord[] {
    return [...this.records.values()]
      .filter((record) => !scope_prefix || record.scope.startsWith(normalize_scope_path(scope_prefix)))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(offset, offset + limit);
  }

  listRecords(scopePrefix: string | null = null, limit = 200, offset = 0): MemoryRecord[] {
    return this.list_records(scopePrefix, limit, offset);
  }

  delete(
    scope_prefix: string | null = null,
    categories: readonly string[] | null = null,
    record_ids: readonly string[] | null = null,
    older_than: Date | string | null = null,
    metadata_filter: Record<string, unknown> | null = null,
  ): number {
    const before = this.records.size;
    const normalizedScope = scope_prefix ? normalize_scope_path(scope_prefix) : null;
    const ids = new Set(record_ids ?? []);
    const cutoff = coerceDate(older_than);
    for (const record of [...this.records.values()]) {
      if (normalizedScope && !record.scope.startsWith(normalizedScope)) {
        continue;
      }
      if (categories && !categories.some((category) => record.categories.includes(category))) {
        continue;
      }
      if (ids.size > 0 && !ids.has(record.id)) {
        continue;
      }
      if (cutoff && record.createdAt >= cutoff) {
        continue;
      }
      if (metadata_filter && !Object.entries(metadata_filter).every(([key, value]) => record.metadata[key] === value)) {
        continue;
      }
      this.records.delete(record.id);
    }
    return before - this.records.size;
  }

  reset(scope_prefix: string | null = null): void {
    for (const record of this.list_records(scope_prefix, Number.POSITIVE_INFINITY)) {
      this.records.delete(record.id);
    }
  }

  get_scope_info(scope: string): ScopeInfo {
    const normalizedScope = normalize_scope_path(scope);
    const records = this.list_records(normalizedScope, Number.POSITIVE_INFINITY);
    const categories = new Set<string>();
    const childScopes = new Set<string>();
    let oldestRecord: Date | null = null;
    let newestRecord: Date | null = null;
    const childPrefix = normalizedScope === "/" ? "/" : `${normalizedScope}/`;
    for (const record of records) {
      for (const category of record.categories) {
        categories.add(category);
      }
      if (!oldestRecord || record.createdAt < oldestRecord) {
        oldestRecord = record.createdAt;
      }
      if (!newestRecord || record.createdAt > newestRecord) {
        newestRecord = record.createdAt;
      }
      if (record.scope.startsWith(childPrefix) && record.scope !== normalizedScope) {
        const rest = record.scope.slice(childPrefix.length);
        const firstComponent = rest.split("/", 1)[0];
        if (firstComponent) {
          childScopes.add(`${childPrefix}${firstComponent}`);
        }
      }
    }
    return new ScopeInfo({
      path: normalizedScope,
      recordCount: records.length,
      categories: [...categories].sort(),
      oldestRecord,
      newestRecord,
      lastUpdated: newestRecord,
      childScopes: [...childScopes].sort(),
    });
  }

  getScopeInfo(scope: string): ScopeInfo {
    return this.get_scope_info(scope);
  }

  list_scopes(parent = "/"): string[] {
    const normalizedParent = normalize_scope_path(parent);
    const prefix = normalizedParent === "/" ? "/" : `${normalizedParent}/`;
    const children = new Set<string>();
    for (const record of this.records.values()) {
      if (!record.scope.startsWith(prefix) || record.scope === normalizedParent) {
        continue;
      }
      const rest = record.scope.slice(prefix.length);
      const firstComponent = rest.split("/", 1)[0];
      if (firstComponent) {
        children.add(`${prefix}${firstComponent}`);
      }
    }
    return [...children].sort();
  }

  listScopes(parent = "/"): string[] {
    return this.list_scopes(parent);
  }

  list_categories(scope_prefix: string | null = null): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const record of this.list_records(scope_prefix, Number.POSITIVE_INFINITY)) {
      for (const category of record.categories) {
        counts[category] = (counts[category] ?? 0) + 1;
      }
    }
    return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
  }

  listCategories(scopePrefix: string | null = null): Record<string, number> {
    return this.list_categories(scopePrefix);
  }

  count(scope_prefix: string | null = null): number {
    return this.list_records(scope_prefix, Number.POSITIVE_INFINITY).length;
  }

  async asave(records: MemoryRecord | MemoryRecordOptions | readonly (MemoryRecord | MemoryRecordOptions)[]): Promise<void> {
    await Promise.resolve();
    this.save(records);
  }

  async asearch(
    embedding: readonly number[],
    scope_prefix: string | null = null,
    categories: readonly string[] | null = null,
    metadata_filter: Record<string, unknown> | null = null,
    limit = 10,
    min_score = 0,
  ): Promise<Array<readonly [MemoryRecord, number]>> {
    await Promise.resolve();
    return this.search(embedding, scope_prefix, categories, metadata_filter, limit, min_score);
  }

  async adelete(
    scope_prefix: string | null = null,
    categories: readonly string[] | null = null,
    record_ids: readonly string[] | null = null,
    older_than: Date | string | null = null,
    metadata_filter: Record<string, unknown> | null = null,
  ): Promise<number> {
    await Promise.resolve();
    return this.delete(scope_prefix, categories, record_ids, older_than, metadata_filter);
  }

  optimize(): void {
  }

  flush_to_central(): void {
  }

  flushToCentral(): void {
    this.flush_to_central();
  }

  close(): void {
    this.flush_to_central();
  }

  async aclose(): Promise<void> {
    await Promise.resolve();
    this.close();
  }
}

export class LanceDBStorage extends QdrantEdgeStorage {}

export class RecallFlow {
  readonly _skip_auto_memory = true;
  readonly state = new RecallState();

  constructor(private readonly storage: MemoryVectorStorageLike, private readonly llm: unknown = null, private readonly embedder: unknown = null, private readonly config = new MemoryConfig()) {
    void this.llm;
  }

  async kickoff(options: { inputs?: Partial<RecallState> } = {}): Promise<MemoryMatch[]> {
    await Promise.resolve();
    Object.assign(this.state, options.inputs ?? {});
    const embeddings = embed_texts(this.embedder, [this.state.query]);
    const scopes = this.state.candidateScopes.length > 0 ? this.state.candidateScopes : [this.state.scope ?? "/"];
    const matches: MemoryMatch[] = [];
    for (const embedding of embeddings) {
      for (const scope of scopes) {
        for (const [record, semanticScore] of this.storage.search(embedding, {
          scope_prefix: scope,
          categories: this.state.categories,
          limit: this.state.limit * this.config.recallOversampleFactor,
          min_score: 0,
        })) {
          if (this.state.timeCutoff && record.createdAt < this.state.timeCutoff) {
            continue;
          }
          if (!this.state.includePrivate && record.private && record.source !== this.state.source) {
            continue;
          }
          const [score, reasons] = compute_composite_score(record, semanticScore, this.config);
          matches.push(new MemoryMatch({ record, score, matchReasons: reasons }));
        }
      }
    }
    this.state.finalResults = matches
      .sort((left, right) => right.score - left.score)
      .slice(0, this.state.limit);
    this.state.final_results = this.state.finalResults;
    this.state.confidence = this.state.finalResults[0]?.score ?? 0;
    return this.state.finalResults;
  }
}

export type MemoryInfo = {
  totalRecords: number;
  total_records: number;
  scopes: readonly string[] | readonly ScopeInfo[];
  categories: Record<string, number> | Record<string, { count: number; scopes: readonly string[] }>;
  readOnly: boolean;
  read_only: boolean;
};

export type MemoryTreeNode = {
  path: string;
  count: number;
  children: Record<string, MemoryTreeNode>;
  categories?: readonly string[];
};

export class Memory {
  readonly readOnly: boolean;
  readonly rootScope: string | null;
  readonly llm: LLM | null;
  private readonly records: MemoryRecord[] = [];
  private readonly pendingWrites: Array<() => MemoryRecord[]> = [];

  constructor(options: MemoryOptions = {}) {
    this.readOnly = options.readOnly ?? false;
    this.rootScope = options.rootScope ?? null;
    this.llm = options.llm ?? null;
  }

  remember(
    content: string,
    options: {
      scope?: string | null;
      categories?: readonly string[] | null;
      metadata?: Record<string, unknown> | null;
      importance?: number | null;
      source?: string | null;
      private?: boolean;
      agentRole?: string | null;
    } = {},
  ): MemoryRecord | null {
    if (this.readOnly) {
      return null;
    }
    crewaiEventBus.emit(this, new MemorySaveStartedEvent({
      value: content,
      metadata: options.metadata ?? null,
      agentRole: options.agentRole ?? null,
    }));
    const start = performance.now();
    try {
      const record = new MemoryRecord({
        content,
        scope: this.scopePath(options.scope),
        categories: options.categories ?? [],
        metadata: options.metadata ?? {},
        importance: options.importance ?? 0.5,
        source: options.source ?? null,
        private: options.private ?? false,
      });
      this.records.push(record);
      crewaiEventBus.emit(this, new MemorySaveCompletedEvent({
        value: content,
        metadata: record.metadata,
        agentRole: options.agentRole ?? null,
        saveTimeMs: performance.now() - start,
      }));
      return record;
    } catch (error) {
      crewaiEventBus.emit(this, new MemorySaveFailedEvent({
        value: content,
        metadata: options.metadata ?? null,
        agentRole: options.agentRole ?? null,
        error,
      }));
      throw error;
    }
  }

  rememberMany(contents: readonly string[], options: Parameters<Memory["remember"]>[1] = {}): MemoryRecord[] {
    if (contents.length === 0 || this.readOnly) {
      return [];
    }
    const values = [...contents];
    this.pendingWrites.push(() => this.runBackgroundSave(values, options));
    return [];
  }

  remember_many(contents: readonly string[], options: Parameters<Memory["remember"]>[1] = {}): MemoryRecord[] {
    return this.rememberMany(contents, options);
  }

  async aremember(content: string, options: Parameters<Memory["remember"]>[1] = {}): Promise<MemoryRecord | null> {
    if (!this.llm) {
      await Promise.resolve();
      return this.remember(content, options);
    }
    const resolvedOptions = await this.resolveSaveOptions(content, options);
    const similarRecords = this.findSimilarRecords(content, resolvedOptions.scope);
    if (similarRecords.length > 0) {
      const plan = await analyzeForConsolidation(content, similarRecords, this.llm);
      const consolidated = this.applyConsolidationPlan(plan, similarRecords);
      if (!plan.insertNew) {
        return consolidated;
      }
    }
    return this.remember(content, resolvedOptions);
  }

  private async resolveSaveOptions(
    content: string,
    options: Parameters<Memory["remember"]>[1] = {},
  ): Promise<NonNullable<Parameters<Memory["remember"]>[1]>> {
    if (!this.llm || (options.scope !== undefined && options.categories !== undefined && options.importance !== undefined)) {
      return options;
    }
    const analysis = await analyzeForSave(
      content,
      this.listScopes(false) as readonly string[],
      Object.keys(this.listCategories(false)),
      this.llm,
    );
    return {
      ...options,
      scope: options.scope ?? analysis.suggestedScope,
      categories: options.categories ?? analysis.categories,
      importance: options.importance ?? analysis.importance,
      metadata: {
        ...(options.metadata ?? {}),
        ...extractedMetadataToRecord(analysis.extractedMetadata),
      },
    };
  }

  private findSimilarRecords(content: string, scope: string | null | undefined): MemoryRecord[] {
    const terms = tokenize(content);
    const effectiveScope = scope ? this.scopePath(scope) : this.rootScope;
    const config = new MemoryConfig();
    return this.records
      .filter((record) => !effectiveScope || record.scope.startsWith(effectiveScope))
      .map((record) => ({ record, score: scoreRecord(record, terms) }))
      .filter(({ score }) => score >= config.consolidationThreshold)
      .sort((left, right) => right.score - left.score)
      .slice(0, config.consolidationLimit)
      .map(({ record }) => record);
  }

  private applyConsolidationPlan(plan: ConsolidationPlan, similarRecords: readonly MemoryRecord[]): MemoryRecord | null {
    const deletes = new Set<string>();
    const updates = new Map<string, string>();
    for (const action of plan.actions) {
      if (action.action === "delete" && !deletes.has(action.recordId) && !updates.has(action.recordId)) {
        deletes.add(action.recordId);
      } else if (
        action.action === "update"
        && action.newContent
        && !deletes.has(action.recordId)
        && !updates.has(action.recordId)
      ) {
        updates.set(action.recordId, action.newContent);
      }
    }

    const updatedRecords = new Map<string, MemoryRecord>();
    if (deletes.size > 0) {
      this.forget({ recordIds: [...deletes] });
    }
    for (const [recordId, newContent] of updates) {
      const existing = this.get_record(recordId);
      if (!existing) {
        continue;
      }
      const updated = new MemoryRecord({
        id: existing.id,
        content: newContent,
        scope: existing.scope,
        categories: existing.categories,
        metadata: existing.metadata,
        importance: existing.importance,
        source: existing.source,
        private: existing.private,
        createdAt: existing.createdAt,
        lastAccessed: new Date(),
        ...(existing.embedding === undefined ? {} : { embedding: existing.embedding }),
      });
      this.update(updated);
      updatedRecords.set(recordId, updated);
    }

    return plan.actions
      .map((action) => updatedRecords.get(action.recordId))
      .find((record): record is MemoryRecord => record !== undefined)
      ?? similarRecords[0]
      ?? null;
  }

  async aremember_many(contents: readonly string[], options: Parameters<Memory["remember"]>[1] = {}): Promise<MemoryRecord[]> {
    if (contents.length === 0 || this.readOnly || !this.llm) {
      await Promise.resolve();
      return this.rememberMany(contents, options);
    }
    const items = await Promise.all(contents.map(async (content) => ({
      content,
      options: await this.resolveSaveOptions(content, options),
    })));
    this.pendingWrites.push(() => this.runResolvedBackgroundSave(items, options));
    return [];
  }

  extractMemories(content: string): readonly string[] {
    const trimmed = content.trim();
    if (!trimmed) {
      return [];
    }
    return [trimmed];
  }

  extract_memories(content: string): readonly string[] {
    return this.extractMemories(content);
  }

  async aextract_memories(content: string): Promise<readonly string[]> {
    if (!this.llm) {
      await Promise.resolve();
      return this.extractMemories(content);
    }
    return await extractMemoriesFromContent(content, this.llm);
  }

  recall(
    query: string,
    options: {
      scope?: string | null;
      categories?: readonly string[] | null;
      limit?: number;
      scoreThreshold?: number | null;
      source?: string | null;
      includePrivate?: boolean;
    } = {},
  ): MemoryMatch[] {
    const limit = options.limit ?? 10;
    const scoreThreshold = options.scoreThreshold ?? null;
    this.drainWrites();
    crewaiEventBus.emit(this, new MemoryQueryStartedEvent({ query, limit, scoreThreshold }));
    const start = performance.now();
    try {
      const scope = options.scope ? this.scopePath(options.scope) : this.rootScope;
      const queryTerms = tokenize(query);
      const matches = this.records
        .filter((record) => !scope || record.scope.startsWith(scope))
        .filter((record) => options.includePrivate || !record.private || record.source === options.source)
        .filter((record) => !options.categories || options.categories.some((category) => record.categories.includes(category)))
        .map((record) => ({ record, score: scoreRecord(record, queryTerms) }))
        .filter((match) => scoreThreshold === null || match.score >= scoreThreshold)
        .sort((a, b) => b.score - a.score || b.record.createdAt.getTime() - a.record.createdAt.getTime())
        .slice(0, limit)
        .map((match) => new MemoryMatch(match));
      crewaiEventBus.emit(this, new MemoryQueryCompletedEvent({
        query,
        results: matches,
        limit,
        scoreThreshold,
        queryTimeMs: performance.now() - start,
      }));
      return matches;
    } catch (error) {
      crewaiEventBus.emit(this, new MemoryQueryFailedEvent({ query, limit, scoreThreshold, error }));
      throw error;
    }
  }

  async arecall(query: string, options: Parameters<Memory["recall"]>[1] = {}): Promise<MemoryMatch[]> {
    await Promise.resolve();
    return this.recall(query, options);
  }

  forget(options: { scope?: string | null; categories?: readonly string[] | null; recordIds?: readonly string[] | null } = {}): number {
    const before = this.records.length;
    const scope = options.scope ? this.scopePath(options.scope) : null;
    const ids = new Set(options.recordIds ?? []);
    for (let index = this.records.length - 1; index >= 0; index -= 1) {
      const record = this.records[index];
      if (!record) {
        continue;
      }
      const matchesScope = !scope || record.scope.startsWith(scope);
      const matchesCategory = !options.categories || options.categories.some((category) => record.categories.includes(category));
      const matchesId = ids.size === 0 || ids.has(record.id);
      if (matchesScope && matchesCategory && matchesId) {
        this.records.splice(index, 1);
      }
    }
    return before - this.records.length;
  }

  get_record(recordId: string): MemoryRecord | null {
    return this.records.find((record) => record.id === recordId) ?? null;
  }

  getRecord(recordId: string): MemoryRecord | null {
    return this.get_record(recordId);
  }

  update(record: MemoryRecord | MemoryRecordOptions): MemoryRecord | null {
    if (this.readOnly) {
      return null;
    }
    const memoryRecord = record instanceof MemoryRecord ? record : new MemoryRecord(record);
    const index = this.records.findIndex((candidate) => candidate.id === memoryRecord.id);
    if (index >= 0) {
      this.records[index] = memoryRecord;
    } else {
      this.records.push(memoryRecord);
    }
    return memoryRecord;
  }

  drainWrites(): void {
    while (this.pendingWrites.length > 0) {
      const write = this.pendingWrites.shift();
      write?.();
    }
  }

  drain_writes(): void {
    this.drainWrites();
  }

  close(): void {
    this.drainWrites();
  }

  reset(scope?: string | null): void {
    if (!scope) {
      this.records.length = 0;
      return;
    }
    this.forget({ scope });
  }

  scope(path: string): MemoryScope {
    return new MemoryScope(this, path);
  }

  slice(scopes: readonly string[] | string, options: { categories?: readonly string[] | null; readOnly?: boolean } = {}): MemorySlice {
    return new MemorySlice(this, typeof scopes === "string" ? [scopes] : scopes, options);
  }

  listScopes(full = false): readonly string[] | readonly ScopeInfo[] {
    const infos = this.scopeInfos();
    return full ? infos : infos.map((info) => info.path);
  }

  list_scopes(full = false): readonly string[] | readonly ScopeInfo[] {
    return this.listScopes(full);
  }

  listCategories(full = false): Record<string, number> | Record<string, { count: number; scopes: readonly string[] }> {
    const categories = new Map<string, { count: number; scopes: Set<string> }>();
    for (const record of this.records) {
      for (const category of record.categories) {
        const entry = categories.get(category) ?? { count: 0, scopes: new Set<string>() };
        entry.count += 1;
        entry.scopes.add(record.scope);
        categories.set(category, entry);
      }
    }
    if (!full) {
      return Object.fromEntries([...categories.entries()].map(([category, entry]) => [category, entry.count]));
    }
    return Object.fromEntries([...categories.entries()].map(([category, entry]) => [
      category,
      { count: entry.count, scopes: [...entry.scopes].sort() },
    ]));
  }

  list_categories(full = false): Record<string, number> | Record<string, { count: number; scopes: readonly string[] }> {
    return this.listCategories(full);
  }

  listRecords(scope: string | null = null, limit = 200, offset = 0): MemoryRecord[] {
    const effectiveScope = scope ? this.scopePath(scope) : this.rootScope;
    return this.records
      .map((record, index) => ({ record, index }))
      .filter(({ record }) => !effectiveScope || record.scope.startsWith(effectiveScope))
      .sort((left, right) => right.record.createdAt.getTime() - left.record.createdAt.getTime() || right.index - left.index)
      .map(({ record }) => record)
      .slice(offset, offset + limit);
  }

  list_records(scope: string | null = null, limit = 200, offset = 0): MemoryRecord[] {
    return this.listRecords(scope, limit, offset);
  }

  info(full = false): MemoryInfo {
    const scopes = this.listScopes(full);
    const categories = this.listCategories(full);
    return {
      totalRecords: this.records.length,
      total_records: this.records.length,
      scopes,
      categories,
      readOnly: this.readOnly,
      read_only: this.readOnly,
    };
  }

  tree(full = false, maxDepth = Number.POSITIVE_INFINITY): MemoryTreeNode {
    const root: MemoryTreeNode = { path: "/", count: 0, children: {} };
    for (const record of this.records) {
      addRecordToTree(root, record, full, maxDepth);
    }
    return root;
  }

  allRecords(): readonly MemoryRecord[] {
    return this.records;
  }

  private runBackgroundSave(contents: readonly string[], options: Parameters<Memory["remember"]>[1] = {}): MemoryRecord[] {
    return this.runResolvedBackgroundSave(contents.map((content) => ({ content, options })), options);
  }

  private runResolvedBackgroundSave(
    items: readonly { content: string; options: NonNullable<Parameters<Memory["remember"]>[1]> }[],
    eventOptions: Parameters<Memory["remember"]>[1] = {},
  ): MemoryRecord[] {
    crewaiEventBus.emit(this, new MemorySaveStartedEvent({
      value: `${String(items.length)} memories (background)`,
      metadata: eventOptions.metadata ?? null,
      agentRole: eventOptions.agentRole ?? null,
    }));
    const start = performance.now();
    try {
      const records = items.map((item) => new MemoryRecord({
        content: item.content,
        scope: this.scopePath(item.options.scope),
        categories: item.options.categories ?? [],
        metadata: item.options.metadata ?? {},
        importance: item.options.importance ?? 0.5,
        source: item.options.source ?? null,
        private: item.options.private ?? false,
      }));
      this.records.push(...records);
      crewaiEventBus.emit(this, new MemorySaveCompletedEvent({
        value: `${String(records.length)} memories saved`,
        metadata: eventOptions.metadata ?? {},
        agentRole: eventOptions.agentRole ?? null,
        saveTimeMs: performance.now() - start,
      }));
      return records;
    } catch (error) {
      crewaiEventBus.emit(this, new MemorySaveFailedEvent({
        value: "background save",
        metadata: eventOptions.metadata ?? null,
        agentRole: eventOptions.agentRole ?? null,
        error,
      }));
      throw error;
    }
  }

  private scopePath(scope: string | null | undefined): string {
    return joinScopePaths(this.rootScope, scope ?? "/");
  }

  private scopeInfos(scopePrefix: string | null = null): ScopeInfo[] {
    const infos = new Map<string, { count: number; categories: Set<string>; lastUpdated: Date | null }>();
    for (const record of this.records) {
      if (scopePrefix && !record.scope.startsWith(scopePrefix)) {
        continue;
      }
      const entry = infos.get(record.scope) ?? { count: 0, categories: new Set<string>(), lastUpdated: null };
      entry.count += 1;
      for (const category of record.categories) {
        entry.categories.add(category);
      }
      if (!entry.lastUpdated || record.createdAt > entry.lastUpdated) {
        entry.lastUpdated = record.createdAt;
      }
      infos.set(record.scope, entry);
    }
    return [...infos.entries()]
      .map(([path, info]) => new ScopeInfo({
        path,
        count: info.count,
        categories: [...info.categories].sort(),
        lastUpdated: info.lastUpdated,
      }))
      .sort((left, right) => left.path.localeCompare(right.path));
  }
}

export function embed_text(embedder: unknown, text: string): number[] {
  return embed_texts(embedder, [text])[0] ?? [];
}

export function embed_texts(embedder: unknown, texts: readonly string[]): number[][] {
  if (texts.length === 0) {
    return [];
  }
  const embeddings = isEmbeddingCallable(embedder) ? embedder(texts) : [];
  if (!Array.isArray(embeddings)) {
    return texts.map(() => []);
  }
  return texts.map((text, index) => text.trim() ? normalizeEmbedding(embeddings[index]) : []);
}

export function compute_composite_score(record: MemoryRecord, semantic_score: number, config: MemoryConfig = new MemoryConfig()): [number, string[]] {
  const ageDays = Math.max((Date.now() - record.createdAt.getTime()) / 86_400_000, 0);
  const decay = 0.5 ** (ageDays / config.recencyHalfLifeDays);
  const score = config.semanticWeight * clamp01(semantic_score)
    + config.recencyWeight * decay
    + config.importanceWeight * record.importance;
  const reasons = ["semantic"];
  if (decay > 0.5) {
    reasons.push("recency");
  }
  if (record.importance > 0.5) {
    reasons.push("importance");
  }
  return [score, reasons];
}

export function sanitize_scope_name(name: string): string {
  const sanitized = name.toLowerCase().trim().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized || "unknown";
}

export function normalize_scope_path(path: string): string {
  if (!path || path === "/") {
    return "/";
  }
  const normalized = path.replace(/\/+/g, "/");
  const prefixed = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return prefixed.length > 1 ? prefixed.replace(/\/+$/g, "") : "/";
}

export const join_scope_paths = joinScopePaths;

type MemoryRememberOptions = NonNullable<Parameters<Memory["remember"]>[1]>;
type MemoryRecallOptions = NonNullable<Parameters<Memory["recall"]>[1]>;
type MemoryForgetOptions = NonNullable<Parameters<Memory["forget"]>[0]>;

export class MemoryScope {
  readonly memory: Memory;
  readonly rootPath: string;

  constructor(memory: Memory, rootPath = "/") {
    this.memory = memory;
    this.rootPath = normalizeScope(rootPath);
  }

  get readOnly(): boolean {
    return this.memory.readOnly;
  }

  get read_only(): boolean {
    return this.readOnly;
  }

  remember(content: string, options: MemoryRememberOptions = {}): MemoryRecord | null {
    return this.memory.remember(content, { ...options, scope: joinScopePaths(this.rootPath, options.scope ?? "/") });
  }

  recall(query: string, options: MemoryRecallOptions = {}): MemoryMatch[] {
    return this.memory.recall(query, { ...options, scope: joinScopePaths(this.rootPath, options.scope ?? "/") });
  }

  rememberMany(contents: readonly string[], options: MemoryRememberOptions = {}): MemoryRecord[] {
    return this.memory.rememberMany(contents, { ...options, scope: joinScopePaths(this.rootPath, options.scope ?? "/") });
  }

  remember_many(contents: readonly string[], options: MemoryRememberOptions = {}): MemoryRecord[] {
    return this.rememberMany(contents, options);
  }

  extractMemories(content: string): readonly string[] {
    return this.memory.extractMemories(content);
  }

  extract_memories(content: string): readonly string[] {
    return this.extractMemories(content);
  }

  forget(options: MemoryForgetOptions = {}): number {
    return this.memory.forget({ ...options, scope: joinScopePaths(this.rootPath, options.scope ?? "/") });
  }

  reset(): void {
    this.memory.reset(this.rootPath);
  }

  listScopes(full = false): readonly string[] | readonly ScopeInfo[] {
    const prefix = this.rootPath;
    const infos = this.memory.allRecords()
      .filter((record) => record.scope.startsWith(prefix))
      .reduce<Map<string, { count: number; categories: Set<string>; lastUpdated: Date | null }>>((accumulator, record) => {
        const entry = accumulator.get(record.scope) ?? { count: 0, categories: new Set<string>(), lastUpdated: null };
        entry.count += 1;
        for (const category of record.categories) {
          entry.categories.add(category);
        }
        if (!entry.lastUpdated || record.createdAt > entry.lastUpdated) {
          entry.lastUpdated = record.createdAt;
        }
        accumulator.set(record.scope, entry);
        return accumulator;
      }, new Map());
    const scopeInfos = [...infos.entries()]
      .map(([path, info]) => new ScopeInfo({
        path,
        count: info.count,
        categories: [...info.categories].sort(),
        lastUpdated: info.lastUpdated,
      }))
      .sort((left, right) => left.path.localeCompare(right.path));
    return full ? scopeInfos : scopeInfos.map((info) => info.path);
  }

  list_scopes(full = false): readonly string[] | readonly ScopeInfo[] {
    return this.listScopes(full);
  }

  info(full = false): MemoryInfo {
    const records = this.memory.allRecords().filter((record) => record.scope.startsWith(this.rootPath));
    return {
      totalRecords: records.length,
      total_records: records.length,
      scopes: this.listScopes(full),
      categories: categoriesForRecords(records, full),
      readOnly: this.readOnly,
      read_only: this.readOnly,
    };
  }

  listCategories(full = false): Record<string, number> | Record<string, { count: number; scopes: readonly string[] }> {
    return categoriesForRecords(this.memory.allRecords().filter((record) => record.scope.startsWith(this.rootPath)), full);
  }

  list_categories(full = false): Record<string, number> | Record<string, { count: number; scopes: readonly string[] }> {
    return this.listCategories(full);
  }

  tree(full = false, maxDepth = Number.POSITIVE_INFINITY): MemoryTreeNode {
    return treeForRecords(this.memory.allRecords().filter((record) => record.scope.startsWith(this.rootPath)), full, maxDepth);
  }

  subscope(path: string): MemoryScope {
    return new MemoryScope(this.memory, joinScopePaths(this.rootPath, path));
  }

  bind(memory: Memory): MemoryScope {
    return new MemoryScope(memory, this.rootPath);
  }
}

export class MemorySlice {
  readonly memory: Memory;
  readonly scopes: readonly string[];
  readonly categories: readonly string[] | null;
  private readonly readOnlyValue: boolean;

  constructor(memory: Memory, scopes: readonly string[], options: { categories?: readonly string[] | null; readOnly?: boolean } = {}) {
    this.memory = memory;
    this.scopes = scopes.map((scope) => normalizeScope(scope));
    this.categories = options.categories ?? null;
    this.readOnlyValue = options.readOnly ?? true;
  }

  get readOnly(): boolean {
    return this.readOnlyValue || this.memory.readOnly;
  }

  get read_only(): boolean {
    return this.readOnly;
  }

  remember(content: string, options: Omit<MemoryRememberOptions, "scope"> = {}): MemoryRecord | null {
    if (this.readOnly) {
      return null;
    }
    return this.memory.remember(content, { ...options, scope: this.scopes[0] ?? "/" });
  }

  rememberMany(contents: readonly string[], options: Omit<MemoryRememberOptions, "scope"> = {}): MemoryRecord[] {
    if (this.readOnly) {
      return [];
    }
    return this.memory.rememberMany(contents, { ...options, scope: this.scopes[0] ?? "/" });
  }

  remember_many(contents: readonly string[], options: Omit<MemoryRememberOptions, "scope"> = {}): MemoryRecord[] {
    return this.rememberMany(contents, options);
  }

  recall(query: string, options: Omit<MemoryRecallOptions, "scope"> = {}): MemoryMatch[] {
    const matches = new Map<string, MemoryMatch>();
    const categories = options.categories ?? this.categories ?? undefined;
    for (const scope of this.scopes) {
      const recallOptions: MemoryRecallOptions = { ...options, scope };
      if (categories !== undefined) {
        recallOptions.categories = categories;
      }
      for (const match of this.memory.recall(query, recallOptions)) {
        const existing = matches.get(match.record.id);
        if (!existing || match.score > existing.score) {
          matches.set(match.record.id, match);
        }
      }
    }
    return [...matches.values()].sort((left, right) => right.score - left.score);
  }

  extractMemories(content: string): readonly string[] {
    return this.memory.extractMemories(content);
  }

  extract_memories(content: string): readonly string[] {
    return this.extractMemories(content);
  }

  subscope(path: string): MemorySlice {
    return new MemorySlice(this.memory, this.scopes.map((scope) => joinScopePaths(scope, path)), {
      categories: this.categories,
      readOnly: this.readOnlyValue,
    });
  }

  listScopes(full = false): readonly string[] | readonly ScopeInfo[] {
    const paths = new Set<string>();
    const infos = new Map<string, ScopeInfo>();
    for (const scope of this.scopes) {
      for (const info of this.memory.scope(scope).listScopes(true) as readonly ScopeInfo[]) {
        paths.add(info.path);
        infos.set(info.path, info);
      }
    }
    return full ? [...infos.values()].sort((left, right) => left.path.localeCompare(right.path)) : [...paths].sort();
  }

  list_scopes(full = false): readonly string[] | readonly ScopeInfo[] {
    return this.listScopes(full);
  }

  info(full = false): MemoryInfo {
    const records = this.memory.allRecords().filter((record) =>
      this.scopes.some((scope) => record.scope.startsWith(scope)),
    );
    return {
      totalRecords: records.length,
      total_records: records.length,
      scopes: this.listScopes(full),
      categories: categoriesForRecords(records, full),
      readOnly: this.readOnly,
      read_only: this.readOnly,
    };
  }

  listCategories(full = false): Record<string, number> | Record<string, { count: number; scopes: readonly string[] }> {
    return categoriesForRecords(this.recordsInSlice(), full);
  }

  list_categories(full = false): Record<string, number> | Record<string, { count: number; scopes: readonly string[] }> {
    return this.listCategories(full);
  }

  tree(full = false, maxDepth = Number.POSITIVE_INFINITY): MemoryTreeNode {
    return treeForRecords(this.recordsInSlice(), full, maxDepth);
  }

  bind(memory: Memory): MemorySlice {
    return new MemorySlice(memory, this.scopes, { categories: this.categories, readOnly: this.readOnlyValue });
  }

  private recordsInSlice(): readonly MemoryRecord[] {
    return this.memory.allRecords().filter((record) =>
      this.scopes.some((scope) => record.scope.startsWith(scope)),
    );
  }
}

export const RecallMemorySchema = {
  queries: {
    type: "array",
    required: true,
    description: "One or more search queries.",
  },
} satisfies ToolArgsSchema;

export class RecallMemoryTool extends BaseTool {
  readonly memory: Memory | MemoryScope | MemorySlice;

  constructor(options: Partial<BaseToolOptions> & { memory: Memory | MemoryScope | MemorySlice }) {
    super({
      name: options.name ?? "Search memory",
      description: options.description ?? promptLeafString(I18N_DEFAULT.tools("recall_memory")),
      argsSchema: options.argsSchema ?? options.args_schema ?? RecallMemorySchema,
      ...(options.cache === undefined ? {} : { cache: options.cache }),
      ...(options.resultAsAnswer === undefined ? {} : { resultAsAnswer: options.resultAsAnswer }),
      ...(options.result_as_answer === undefined ? {} : { result_as_answer: options.result_as_answer }),
    });
    this.memory = options.memory;
  }

  protected _run(args: Record<string, unknown>): string {
    const queries = Array.isArray(args.queries) ? args.queries.map(toMemoryToolString) : [toMemoryToolString(args.queries)];
    const lines = new Map<string, string>();
    for (const query of queries) {
      for (const match of this.memory.recall(query, { limit: 20 })) {
        lines.set(match.record.id, match.format());
      }
    }
    return lines.size > 0 ? `Found memories:\n${[...lines.values()].join("\n")}` : "No relevant memories found.";
  }
}

export const RememberSchema = {
  contents: {
    type: "array",
    required: true,
    description: "One or more facts, decisions, or observations to remember.",
  },
} satisfies ToolArgsSchema;

export class RememberTool extends BaseTool {
  readonly memory: Memory | MemoryScope | MemorySlice;

  constructor(options: Partial<BaseToolOptions> & { memory: Memory | MemoryScope | MemorySlice }) {
    super({
      name: options.name ?? "Save to memory",
      description: options.description ?? promptLeafString(I18N_DEFAULT.tools("save_to_memory")),
      argsSchema: options.argsSchema ?? options.args_schema ?? RememberSchema,
      ...(options.cache === undefined ? {} : { cache: options.cache }),
      ...(options.resultAsAnswer === undefined ? {} : { resultAsAnswer: options.resultAsAnswer }),
      ...(options.result_as_answer === undefined ? {} : { result_as_answer: options.result_as_answer }),
    });
    this.memory = options.memory;
  }

  protected _run(args: Record<string, unknown>): string {
    const contents = Array.isArray(args.contents) ? args.contents.map(toMemoryToolString) : [toMemoryToolString(args.contents)];
    if (contents.length === 1) {
      const record = this.memory.remember(contents[0] ?? "");
      return record
        ? `Saved to memory (scope=${record.scope}, importance=${record.importance.toFixed(1)}).`
        : "Memory is read-only; nothing was saved.";
    }
    this.memory.remember_many(contents);
    return `Saving ${String(contents.length)} items to memory in background.`;
  }
}

export function createMemoryTools(memory: Memory | MemoryScope | MemorySlice): Tool[] {
  const tools: Tool[] = [
    new RecallMemoryTool({ memory }),
  ];
  if (!memory.readOnly) {
    tools.push(new RememberTool({ memory }));
  }
  return tools;
}

export const create_memory_tools = createMemoryTools;

function promptLeafString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toMemoryToolString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value.toString();
  }
  return JSON.stringify(value);
}

export async function extractMemoriesFromContent(content: string, llm: LLM): Promise<readonly string[]> {
  if (!content.trim()) {
    return [];
  }
  const messages: LLMMessage[] = [
    { role: "system", content: memoryPrompt("extract_memories_system") },
    { role: "user", content: memoryPrompt("extract_memories_user").replace("{content}", content) },
  ];
  try {
    const response = await callMemoryLLM(llm, messages, ExtractedMemories);
    return coerceExtractedMemories(response).memories;
  } catch {
    const trimmed = content.trim();
    return trimmed ? [trimmed] : [];
  }
}

export const extract_memories_from_content = extractMemoriesFromContent;

export async function analyzeQuery(
  query: string,
  availableScopes: readonly string[],
  scopeInfo: ScopeInfo | null,
  llm: LLM,
): Promise<QueryAnalysis> {
  const scopeDescription = scopeInfo
    ? `Current scope has ${String(scopeInfo.count)} records, categories: ${scopeInfo.categories.join(", ")}`
    : "";
  const user = memoryPrompt("query_user")
    .replace("{query}", query)
    .replace("{available_scopes}", JSON.stringify(availableScopes.length > 0 ? availableScopes : ["/"]))
    .replace("{scope_desc}", scopeDescription);
  try {
    const response = await callMemoryLLM(llm, [
      { role: "system", content: memoryPrompt("query_system") },
      { role: "user", content: user },
    ], QueryAnalysis);
    return coerceQueryAnalysis(response, query, availableScopes);
  } catch {
    return new QueryAnalysis({
      suggestedScopes: (availableScopes.length > 0 ? availableScopes : ["/"]).slice(0, 5),
      complexity: "simple",
      recallQueries: [query],
    });
  }
}

export const analyze_query = analyzeQuery;

export async function analyzeForSave(
  content: string,
  existingScopes: readonly string[],
  existingCategories: readonly string[],
  llm: LLM,
): Promise<MemoryAnalysis> {
  const user = [
    "Analyze this memory before saving.",
    `Content: ${content}`,
    `Existing scopes: ${JSON.stringify(existingScopes.length > 0 ? existingScopes : ["/"])}`,
    `Existing categories: ${JSON.stringify(existingCategories)}`,
    "Return JSON with suggested_scope, categories, importance, extracted_metadata.",
  ].join("\n\n");
  try {
    const response = await callMemoryLLM(llm, [
      { role: "system", content: "You analyze content before saving it to memory." },
      { role: "user", content: user },
    ], MemoryAnalysis);
    return coerceMemoryAnalysis(response);
  } catch {
    return new MemoryAnalysis();
  }
}

export const analyze_for_save = analyzeForSave;

export async function analyzeForConsolidation(
  newContent: string,
  existingRecords: readonly MemoryRecord[],
  llm: LLM,
): Promise<ConsolidationPlan> {
  if (existingRecords.length === 0) {
    return new ConsolidationPlan({ actions: [], insertNew: true });
  }
  const recordsSummary = existingRecords.map((record) =>
    `- id=${record.id} | scope=${record.scope} | importance=${record.importance.toFixed(2)} | created=${record.createdAt.toISOString()}\n  content: ${record.content.slice(0, 200)}${record.content.length > 200 ? "..." : ""}`,
  ).join("\n\n");
  try {
    const response = await callMemoryLLM(llm, [
      { role: "system", content: "You decide whether a new memory should be inserted or consolidated with existing records." },
      { role: "user", content: `New content:\n${newContent}\n\nExisting records:\n${recordsSummary}\n\nReturn JSON with actions and insert_new.` },
    ], ConsolidationPlan);
    return coerceConsolidationPlan(response);
  } catch {
    return new ConsolidationPlan({ actions: [], insertNew: true });
  }
}

export const analyze_for_consolidation = analyzeForConsolidation;

async function callMemoryLLM(llm: LLM, messages: readonly LLMMessage[], responseModel: unknown): Promise<unknown> {
  return await callLLM(createLLMClient(llm), messages, { responseModel });
}

export function joinScopePaths(root: string | null | undefined, child: string | null | undefined): string {
  const normalizedRoot = normalizeScope(root ?? "/");
  const normalizedChild = normalizeScope(child ?? "/");
  if (normalizedRoot === "/") {
    return normalizedChild;
  }
  if (normalizedChild === "/") {
    return normalizedRoot;
  }
  return `${normalizedRoot}${normalizedChild}`;
}

function normalizeScope(scope: string): string {
  const trimmed = scope.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }
  return `/${trimmed.replaceAll(/^\/+|\/+$/g, "")}`;
}

function tokenize(value: string): Set<string> {
  return new Set(value.toLowerCase().split(/[^a-z0-9가-힣]+/).filter(Boolean));
}

function scoreRecord(record: MemoryRecord, queryTerms: Set<string>): number {
  if (queryTerms.size === 0) {
    return record.importance;
  }
  const contentTerms = tokenize(`${record.content} ${record.categories.join(" ")}`);
  let overlap = 0;
  for (const term of queryTerms) {
    if (contentTerms.has(term)) {
      overlap += 1;
    }
  }
  return overlap / queryTerms.size + record.importance * 0.01;
}

function categoriesForRecords(
  records: readonly MemoryRecord[],
  full: boolean,
): Record<string, number> | Record<string, { count: number; scopes: readonly string[] }> {
  const categories = new Map<string, { count: number; scopes: Set<string> }>();
  for (const record of records) {
    for (const category of record.categories) {
      const entry = categories.get(category) ?? { count: 0, scopes: new Set<string>() };
      entry.count += 1;
      entry.scopes.add(record.scope);
      categories.set(category, entry);
    }
  }
  if (!full) {
    return Object.fromEntries([...categories.entries()].map(([category, entry]) => [category, entry.count]));
  }
  return Object.fromEntries([...categories.entries()].map(([category, entry]) => [
    category,
    { count: entry.count, scopes: [...entry.scopes].sort() },
  ]));
}

function treeForRecords(records: readonly MemoryRecord[], full: boolean, maxDepth: number): MemoryTreeNode {
  const root: MemoryTreeNode = { path: "/", count: 0, children: {} };
  for (const record of records) {
    addRecordToTree(root, record, full, maxDepth);
  }
  return root;
}

function addRecordToTree(root: MemoryTreeNode, record: MemoryRecord, full: boolean, maxDepth: number): void {
  root.count += 1;
  const parts = record.scope.split("/").filter(Boolean);
  let current = root;
  for (const [index, part] of parts.entries()) {
    if (index >= maxDepth) {
      return;
    }
    const path = joinScopePaths(current.path, part);
    current.children[part] ??= { path, count: 0, children: {} };
    current = current.children[part];
    current.count += 1;
    if (full) {
      current.categories = [...new Set([...(current.categories ?? []), ...record.categories])].sort();
    }
  }
}

function memoryPrompt(key: "extract_memories_system" | "extract_memories_user" | "query_system" | "query_user"): string {
  try {
    return I18N_DEFAULT.memory(key);
  } catch {
    switch (key) {
      case "extract_memories_system":
        return "Extract discrete, self-contained memory statements. Return JSON with a memories array.";
      case "extract_memories_user":
        return "Content:\n{content}\n\nExtract memory statements as described. Return structured output.";
      case "query_system":
        return "Analyze a memory recall query. Return JSON with keywords, suggested_scopes, complexity, recall_queries, and time_filter.";
      case "query_user":
        return "Query: {query}\n\nAvailable scopes: {available_scopes}\n{scope_desc}\n\nReturn the analysis as structured output.";
      default:
        return "";
    }
  }
}

function parseMemoryResponse(response: unknown): Record<string, unknown> {
  if (typeof response === "string") {
    const parsed: unknown = JSON.parse(response);
    return isRecord(parsed) ? parsed : {};
  }
  return isRecord(response) ? response : {};
}

function coerceExtractedMetadata(value: unknown): ExtractedMetadata {
  if (value instanceof ExtractedMetadata) {
    return value;
  }
  const record = isRecord(value) ? value : {};
  return new ExtractedMetadata({
    entities: stringArray(record.entities),
    dates: stringArray(record.dates),
    topics: stringArray(record.topics),
  });
}

function extractedMetadataToRecord(metadata: ExtractedMetadata): Record<string, readonly string[]> {
  return {
    entities: metadata.entities,
    dates: metadata.dates,
    topics: metadata.topics,
  };
}

function coerceMemoryAnalysis(value: unknown): MemoryAnalysis {
  if (value instanceof MemoryAnalysis) {
    return value;
  }
  const record = parseMemoryResponse(value);
  return new MemoryAnalysis({
    ...(typeof record.suggested_scope === "string" ? { suggested_scope: record.suggested_scope } : {}),
    categories: stringArray(record.categories),
    ...(typeof record.importance === "number" ? { importance: record.importance } : {}),
    ...(isRecord(record.extracted_metadata) ? { extracted_metadata: record.extracted_metadata } : {}),
  });
}

function coerceQueryAnalysis(value: unknown, query: string, availableScopes: readonly string[]): QueryAnalysis {
  if (value instanceof QueryAnalysis) {
    return value;
  }
  const record = parseMemoryResponse(value);
  const suggestedScopes = stringArray(record.suggested_scopes);
  const recallQueries = stringArray(record.recall_queries);
  return new QueryAnalysis({
    keywords: stringArray(record.keywords),
    suggested_scopes: suggestedScopes.length > 0 ? suggestedScopes : (availableScopes.length > 0 ? availableScopes : ["/"]).slice(0, 5),
    complexity: typeof record.complexity === "string" ? record.complexity : "simple",
    recall_queries: recallQueries.length > 0 ? recallQueries : [query],
    time_filter: typeof record.time_filter === "string" ? record.time_filter : null,
  });
}

function coerceExtractedMemories(value: unknown): ExtractedMemories {
  if (value instanceof ExtractedMemories) {
    return value;
  }
  const record = parseMemoryResponse(value);
  return new ExtractedMemories({ memories: stringArray(record.memories) });
}

function coerceConsolidationAction(value: ConsolidationAction | Record<string, unknown>): ConsolidationAction {
  if (value instanceof ConsolidationAction) {
    return value;
  }
  return new ConsolidationAction({
    action: typeof value.action === "string" ? value.action : "keep",
    ...(typeof value.record_id === "string" ? { record_id: value.record_id } : {}),
    ...(typeof value.new_content === "string" ? { new_content: value.new_content } : {}),
    ...(typeof value.reason === "string" ? { reason: value.reason } : {}),
  });
}

function coerceConsolidationPlan(value: unknown): ConsolidationPlan {
  if (value instanceof ConsolidationPlan) {
    return value;
  }
  const record = parseMemoryResponse(value);
  const actions = Array.isArray(record.actions)
    ? record.actions.filter(isRecord)
    : [];
  return new ConsolidationPlan({
    actions,
    insert_new: typeof record.insert_new === "boolean" ? record.insert_new : true,
    insert_reason: typeof record.insert_reason === "string" ? record.insert_reason : "",
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function formatMetadataValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value.toString();
  }
  return JSON.stringify(value);
}

function coerceDate(value: Date | string | null | undefined): Date | null {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function isEmbeddingCallable(value: unknown): value is (texts: readonly string[]) => unknown {
  return typeof value === "function";
}

function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  const length = Math.min(left.length, right.length);
  if (length === 0) {
    return 0;
  }
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  }
  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function normalizeEmbedding(value: unknown): number[] {
  const arrayLike = value as { tolist?: () => unknown } | null;
  const candidate = arrayLike?.tolist?.() ?? value;
  return Array.isArray(candidate) ? candidate.map((item) => Number(item)).filter(Number.isFinite) : [];
}
