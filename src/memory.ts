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

const RECALL_OVERSAMPLE_FACTOR = 2;

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
  read_only?: boolean;
  rootScope?: string | null;
  root_scope?: string | null;
  llm?: LLM | null;
  embedder?: unknown;
} & ConstructorParameters<typeof MemoryConfig>[0];

export type MemoryUpdateOptions = {
  content?: string | null;
  scope?: string | null;
  categories?: readonly string[] | null;
  metadata?: Record<string, unknown> | null;
  importance?: number | null;
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
  scope: string | null;
  categories: readonly string[] | null;
  metadata: Record<string, unknown> | null;
  importance: number | null;
  source: string | null;
  private: boolean;
  rootScope: string | null;
  root_scope: string | null;
  resolvedScope: string;
  resolved_scope: string;
  resolvedCategories: readonly string[];
  resolved_categories: readonly string[];
  resolvedMetadata: Record<string, unknown>;
  resolved_metadata: Record<string, unknown>;
  resolvedImportance: number;
  resolved_importance: number;
  resolvedSource: string | null;
  resolved_source: string | null;
  resolvedPrivate: boolean;
  resolved_private: boolean;
  embedding: number[];
  dropped: boolean;
  similarRecords: MemoryRecord[];
  similar_records: MemoryRecord[];
  topSimilarity: number;
  top_similarity: number;
  plan: ConsolidationPlan | null;
  resultRecord: MemoryRecord | null;
  result_record: MemoryRecord | null;

  constructor(public readonly content = "", options: {
    scope?: string | null;
    categories?: readonly string[] | null;
    metadata?: Record<string, unknown> | null;
    importance?: number | null;
    source?: string | null;
    private?: boolean;
    rootScope?: string | null;
    root_scope?: string | null;
    resolvedScope?: string;
    resolved_scope?: string;
    resolvedCategories?: readonly string[];
    resolved_categories?: readonly string[];
    resolvedMetadata?: Record<string, unknown>;
    resolved_metadata?: Record<string, unknown>;
    resolvedImportance?: number;
    resolved_importance?: number;
    resolvedSource?: string | null;
    resolved_source?: string | null;
    resolvedPrivate?: boolean;
    resolved_private?: boolean;
    embedding?: readonly number[];
    dropped?: boolean;
    similarRecords?: readonly MemoryRecord[];
    similar_records?: readonly MemoryRecord[];
    topSimilarity?: number;
    top_similarity?: number;
    plan?: ConsolidationPlan | null;
    resultRecord?: MemoryRecord | null;
    result_record?: MemoryRecord | null;
  } = {}) {
    this.scope = options.scope ?? null;
    this.categories = options.categories ?? null;
    this.metadata = options.metadata === undefined ? null : options.metadata;
    this.importance = options.importance ?? null;
    this.source = options.source ?? null;
    this.private = options.private ?? false;
    this.rootScope = options.rootScope ?? options.root_scope ?? null;
    this.root_scope = this.rootScope;
    this.resolvedScope = options.resolvedScope ?? options.resolved_scope ?? "/";
    this.resolved_scope = this.resolvedScope;
    this.resolvedCategories = [...(options.resolvedCategories ?? options.resolved_categories ?? [])];
    this.resolved_categories = this.resolvedCategories;
    this.resolvedMetadata = { ...(options.resolvedMetadata ?? options.resolved_metadata ?? {}) };
    this.resolved_metadata = this.resolvedMetadata;
    this.resolvedImportance = clamp01(options.resolvedImportance ?? options.resolved_importance ?? 0.5);
    this.resolved_importance = this.resolvedImportance;
    this.resolvedSource = options.resolvedSource ?? options.resolved_source ?? null;
    this.resolved_source = this.resolvedSource;
    this.resolvedPrivate = options.resolvedPrivate ?? options.resolved_private ?? false;
    this.resolved_private = this.resolvedPrivate;
    this.embedding = [...(options.embedding ?? [])];
    this.dropped = options.dropped ?? false;
    this.similarRecords = [...(options.similarRecords ?? options.similar_records ?? [])];
    this.similar_records = this.similarRecords;
    this.topSimilarity = options.topSimilarity ?? options.top_similarity ?? 0;
    this.top_similarity = this.topSimilarity;
    this.plan = options.plan ?? null;
    this.resultRecord = options.resultRecord ?? options.result_record ?? null;
    this.result_record = this.resultRecord;
  }
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
    void this.storage;
    void this.llm;
    this.state = new EncodingState();
  }

  batch_embed(): void {
    const texts = this.state.items.map((item) => item.content);
    const embeddings = embed_texts(this.embedder, texts);
    this.state.items.forEach((item, index) => {
      item.embedding = embeddings[index] ?? [];
    });
  }

  batchEmbed(): void {
    this.batch_embed();
  }

  intra_batch_dedup(): void {
    const items = this.state.items;
    if (items.length <= 1) {
      return;
    }
    for (let current = 1; current < items.length; current += 1) {
      const item = items[current];
      if (!item || item.dropped || item.embedding.length === 0) {
        continue;
      }
      for (let previous = 0; previous < current; previous += 1) {
        const candidate = items[previous];
        if (!candidate || candidate.dropped || candidate.embedding.length === 0) {
          continue;
        }
        if (EncodingFlow._cosine_similarity(candidate.embedding, item.embedding) >= this.config.batchDedupThreshold) {
          item.dropped = true;
          this.state.items_dropped_dedup += 1;
          break;
        }
      }
    }
  }

  intraBatchDedup(): void {
    this.intra_batch_dedup();
  }

  parallel_find_similar(): void {
    for (const item of this.state.items) {
      if (item.dropped || item.embedding.length === 0) {
        continue;
      }
      let raw: Array<readonly [MemoryRecord, number]>;
      try {
        raw = this._search_one(item);
      } catch {
        raw = [];
      }
      item.similarRecords = raw.map(([record]) => record);
      item.similar_records = item.similarRecords;
      item.topSimilarity = raw.length > 0 ? raw[0]?.[1] ?? 0 : 0;
      item.top_similarity = item.topSimilarity;
    }
  }

  parallelFindSimilar(): void {
    this.parallel_find_similar();
  }

  _search_one(item: ItemState): Array<readonly [MemoryRecord, number]> {
    const searchStorage = this.storage as {
      search?: (embedding: readonly number[], options?: MemoryVectorSearchOptions) => Array<readonly [MemoryRecord, number]>;
    } | null;
    if (typeof searchStorage?.search !== "function") {
      return [];
    }
    let effectivePrefix: string | null = null;
    const rootScope = item.root_scope;
    if (rootScope) {
      effectivePrefix = rootScope.replace(/\/+$/u, "");
      const itemScope = item.scope?.replace(/^\/+|\/+$/gu, "");
      if (itemScope) {
        effectivePrefix = `${effectivePrefix}/${itemScope}`;
      }
    } else {
      const itemScope = item.scope?.replace(/^\/+|\/+$/gu, "");
      if (itemScope) {
        effectivePrefix = item.scope;
      }
    }
    return searchStorage.search(item.embedding, {
      scope_prefix: effectivePrefix,
      categories: null,
      limit: this.config.consolidationLimit,
      min_score: 0,
    });
  }

  async parallel_analyze(): Promise<void> {
    const items = this.state.items;
    const threshold = this.config.consolidationThreshold;
    const activeItems = items.filter((item) => !item.dropped);
    const anyNeedsFields = activeItems.some((item) =>
      item.scope === null || item.categories === null || item.importance === null,
    );
    const existingScopes = anyNeedsFields ? this.listStorageScopes(activeItems) : [];
    const existingCategories = anyNeedsFields ? this.listStorageCategories(activeItems) : [];

    await Promise.all(items.map(async (item) => {
      if (item.dropped) {
        return;
      }
      const fieldsProvided = item.scope !== null && item.categories !== null && item.importance !== null;
      const hasSimilar = item.topSimilarity >= threshold;
      if (fieldsProvided) {
        this._apply_defaults(item);
      } else {
        const analysis = await analyzeForSave(item.content, existingScopes, existingCategories, this.llm as LLM);
        this.applyEncodingAnalysis(item, analysis);
      }
      if (hasSimilar) {
        item.plan = await analyzeForConsolidation(item.content, item.similar_records, this.llm as LLM);
        return;
      }
      item.plan = new ConsolidationPlan({ actions: [], insertNew: true });
    }));
  }

  parallelAnalyze(): Promise<void> {
    return this.parallel_analyze();
  }

  static _cosine_similarity(a: readonly number[], b: readonly number[]): number {
    if (a.length !== b.length || a.length === 0) {
      return 0;
    }
    return cosineSimilarity(a, b);
  }

  _apply_defaults(item: ItemState): void {
    const innerScope = item.scope ?? "/";
    item.resolvedScope = item.root_scope ? joinScopePaths(item.root_scope, innerScope) : innerScope;
    item.resolved_scope = item.resolvedScope;
    item.resolvedCategories = [...(item.categories ?? [])];
    item.resolved_categories = item.resolvedCategories;
    item.resolvedMetadata = { ...(item.metadata ?? {}) };
    item.resolved_metadata = item.resolvedMetadata;
    item.resolvedImportance = item.importance ?? this.config.defaultImportance;
    item.resolved_importance = item.resolvedImportance;
    item.resolvedSource = item.source;
    item.resolved_source = item.resolvedSource;
    item.resolvedPrivate = item.private;
    item.resolved_private = item.resolvedPrivate;
  }

  private applyEncodingAnalysis(item: ItemState, analysis: MemoryAnalysis): void {
    const innerScope = item.scope ?? analysis.suggested_scope;
    item.resolvedScope = item.root_scope ? joinScopePaths(item.root_scope, innerScope) : innerScope;
    item.resolved_scope = item.resolvedScope;
    item.resolvedCategories = [...(item.categories ?? analysis.categories)];
    item.resolved_categories = item.resolvedCategories;
    item.resolvedMetadata = {
      ...(item.metadata ?? {}),
      entities: analysis.extracted_metadata.entities,
      dates: analysis.extracted_metadata.dates,
      topics: analysis.extracted_metadata.topics,
    };
    item.resolved_metadata = item.resolvedMetadata;
    item.resolvedImportance = item.importance ?? analysis.importance;
    item.resolved_importance = item.resolvedImportance;
    item.resolvedSource = item.source;
    item.resolved_source = item.resolvedSource;
    item.resolvedPrivate = item.private;
    item.resolved_private = item.resolvedPrivate;
  }

  private listStorageScopes(activeItems: readonly ItemState[]): readonly string[] {
    const storage = this.storage as { list_scopes?: (scope?: string | null) => readonly string[]; listScopes?: (scope?: string | null) => readonly string[] } | null;
    const activeRoot = activeItems.find((item) => item.root_scope)?.root_scope ?? "/";
    try {
      return storage?.list_scopes?.(activeRoot) ?? storage?.listScopes?.(activeRoot) ?? ["/"];
    } catch {
      return ["/"];
    }
  }

  private listStorageCategories(activeItems: readonly ItemState[]): readonly string[] {
    const storage = this.storage as { list_categories?: (scope?: string | null) => Record<string, unknown>; listCategories?: (scope?: string | null) => Record<string, unknown> } | null;
    const activeRoot = activeItems.find((item) => item.root_scope)?.root_scope ?? null;
    try {
      const categories = storage?.list_categories?.(activeRoot) ?? storage?.listCategories?.(activeRoot) ?? {};
      return Object.keys(categories);
    } catch {
      return [];
    }
  }

  execute_plans(): void {
    const storage = this.storage as {
      delete?: (scopePrefix?: string | null, categories?: readonly string[] | null, recordIds?: readonly string[] | null) => number | undefined;
      update?: (record: MemoryRecord) => unknown;
      save?: (records: readonly MemoryRecord[]) => unknown;
    } | null;
    const allSimilar = new Map<string, MemoryRecord>();
    const deletes = new Set<string>();
    const updates = new Map<string, { item: ItemState; content: string }>();

    for (const item of this.state.items) {
      if (item.dropped || item.plan === null) {
        continue;
      }
      for (const record of item.similar_records) {
        if (!allSimilar.has(record.id)) {
          allSimilar.set(record.id, record);
        }
      }
      for (const action of item.plan.actions) {
        if (action.action === "delete" && !deletes.has(action.record_id) && !updates.has(action.record_id)) {
          deletes.add(action.record_id);
        } else if (action.action === "update" && action.new_content && !deletes.has(action.record_id) && !updates.has(action.record_id)) {
          updates.set(action.record_id, { item, content: action.new_content });
        }
      }
    }

    const updateEntries = [...updates.entries()];
    const updateEmbeddings = updateEntries.length > 0
      ? embed_texts(this.embedder, updateEntries.map(([, update]) => update.content))
      : [];
    const updatedRecords = new Map<string, MemoryRecord>();

    if (deletes.size > 0) {
      storage?.delete?.(null, null, [...deletes]);
      this.state.records_deleted += deletes.size;
    }

    updateEntries.forEach(([recordId, update], index) => {
      const existing = allSimilar.get(recordId);
      if (!existing) {
        return;
      }
      const updated = new MemoryRecord({
        id: existing.id,
        content: update.content,
        scope: existing.scope,
        categories: existing.categories,
        metadata: existing.metadata,
        importance: existing.importance,
        source: existing.source,
        private: existing.private,
        createdAt: existing.createdAt,
        lastAccessed: new Date(),
        embedding: updateEmbeddings[index] ?? existing.embedding ?? null,
      });
      storage?.update?.(updated);
      this.state.records_updated += 1;
      updatedRecords.set(recordId, updated);
      update.item.resultRecord = updated;
      update.item.result_record = updated;
    });

    const inserts: Array<readonly [ItemState, MemoryRecord]> = [];
    for (const item of this.state.items) {
      if (item.dropped || item.plan === null || !item.plan.insert_new) {
        continue;
      }
      inserts.push([item, new MemoryRecord({
        content: item.content,
        scope: item.resolved_scope,
        categories: item.resolved_categories,
        metadata: item.resolved_metadata,
        importance: item.resolved_importance,
        source: item.resolved_source,
        private: item.resolved_private,
        embedding: item.embedding.length > 0 ? item.embedding : null,
      })] as const);
    }
    if (inserts.length > 0) {
      const records = inserts.map(([, record]) => record);
      storage?.save?.(records);
      this.state.records_inserted += records.length;
      for (const [item, record] of inserts) {
        item.resultRecord = record;
        item.result_record = record;
      }
    }

    for (const item of this.state.items) {
      if (item.dropped || item.plan === null || item.plan.insert_new || item.result_record !== null) {
        continue;
      }
      const firstUpdated = item.plan.actions
        .filter((action) => action.action === "update")
        .map((action) => updatedRecords.get(action.record_id))
        .find((record): record is MemoryRecord => record !== undefined);
      const result = firstUpdated ?? item.similar_records[0] ?? null;
      item.resultRecord = result;
      item.result_record = result;
    }
  }

  executePlans(): void {
    this.execute_plans();
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
  queryAnalysis: QueryAnalysis | null;
  query_analysis: QueryAnalysis | null;
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
    queryAnalysis?: QueryAnalysis | null;
    query_analysis?: QueryAnalysis | null;
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
    this.queryAnalysis = options.queryAnalysis ?? options.query_analysis ?? null;
    this.query_analysis = this.queryAnalysis;
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

export type QdrantEdgeConfig = {
  vectors: Record<string, { size: number; distance: "Cosine" }>;
};

export type QdrantScopeFilter = {
  must: readonly [{ key: "scope_ancestors"; match: { value: string } }];
};

export type QdrantPoint = {
  id: number;
  vector: Record<typeof VECTOR_NAME, readonly number[]>;
  payload: {
    record_id: string;
    content: string;
    scope: string;
    scope_ancestors: readonly string[];
    categories: readonly string[];
    metadata: Record<string, unknown>;
    importance: number;
    created_at: string;
    last_accessed: string;
    source: string;
    private: boolean;
  };
};

export type QdrantShardHandle = {
  path: string;
  points: QdrantPoint[];
  closed: boolean;
  close: () => void;
  flush: () => void;
};

export class QdrantEdgeStorage implements MemoryVectorStorageLike {
  private readonly records = new Map<string, MemoryRecord>();
  readonly path: string | null;
  readonly vectorDim: number;
  readonly vector_dim: number;
  readonly _base_path: string | null;
  readonly _central_path: string | null;
  readonly _local_path: string | null;
  _local_has_data = false;
  _closed = false;
  _indexes_created = false;

  constructor(options: string | { path?: string | null; vectorDim?: number | null; vector_dim?: number | null } | null = null) {
    const config = typeof options === "string" || options === null ? { path: options } : options;
    this.path = config.path ?? null;
    this.vectorDim = config.vectorDim ?? config.vector_dim ?? DEFAULT_VECTOR_DIM;
    this.vector_dim = this.vectorDim;
    this._base_path = this.path;
    this._central_path = this.path ? `${this.path.replace(/\/+$/u, "")}/central` : null;
    this._local_path = this.path ? `${this.path.replace(/\/+$/u, "")}/worker-0` : null;
  }

  save(records: MemoryRecord | MemoryRecordOptions | readonly (MemoryRecord | MemoryRecordOptions)[]): void {
    const memoryRecords: readonly (MemoryRecord | MemoryRecordOptions)[] = Array.isArray(records)
      ? records as readonly (MemoryRecord | MemoryRecordOptions)[]
      : [records as MemoryRecord | MemoryRecordOptions];
    for (const record of memoryRecords) {
      const memoryRecord = record instanceof MemoryRecord ? record : new MemoryRecord(record);
      this.records.set(memoryRecord.id, memoryRecord);
    }
    if (memoryRecords.length > 0) {
      this._local_has_data = true;
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
      .filter((record) => is_scope_within_prefix(record.scope, scopePrefix))
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
      .filter((record) => is_scope_within_prefix(record.scope, scope_prefix))
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
      if (!is_scope_within_prefix(record.scope, normalizedScope)) {
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
    this._local_has_data = false;
  }

  flushToCentral(): void {
    this.flush_to_central();
  }

  close(): void {
    if (this._closed) {
      return;
    }
    this._closed = true;
    this.flush_to_central();
  }

  async aclose(): Promise<void> {
    await Promise.resolve();
    this.close();
  }

  _build_config(dim: number): QdrantEdgeConfig {
    return {
      vectors: {
        [VECTOR_NAME]: {
          size: dim,
          distance: "Cosine",
        },
      },
    };
  }

  _open_shard(path: string): QdrantShardHandle {
    return {
      path,
      points: [],
      closed: false,
      close() {
        this.closed = true;
      },
      flush() {
      },
    };
  }

  _ensure_indexes(_shard: QdrantShardHandle): void {
    void _shard;
    this._indexes_created = true;
  }

  _record_to_point(record: MemoryRecord): QdrantPoint {
    return {
      id: uuidToPointId(record.id),
      vector: {
        [VECTOR_NAME]: record.embedding && record.embedding.length > 0
          ? record.embedding
          : Array.from({ length: this.vectorDim }, () => 0),
      },
      payload: {
        record_id: record.id,
        content: record.content,
        scope: record.scope,
        scope_ancestors: buildScopeAncestors(record.scope),
        categories: record.categories,
        metadata: record.metadata,
        importance: record.importance,
        created_at: record.createdAt.toISOString(),
        last_accessed: (record.lastAccessed ?? record.createdAt).toISOString(),
        source: record.source ?? "",
        private: record.private,
      },
    };
  }

  _payload_to_record(
    payload: QdrantPoint["payload"] | Record<string, unknown>,
    vector: Record<typeof VECTOR_NAME, readonly number[]> | null = null,
  ): MemoryRecord {
    const fallbackId = "id" in payload ? payload.id : "";
    const content = typeof payload.content === "string" ? payload.content : "";
    const scope = typeof payload.scope === "string" ? payload.scope : "/";
    return new MemoryRecord({
      id: String(payload.record_id ?? fallbackId),
      content,
      scope,
      categories: Array.isArray(payload.categories)
        ? payload.categories.filter((category): category is string => typeof category === "string")
        : [],
      metadata: isRecord(payload.metadata) ? payload.metadata : {},
      importance: typeof payload.importance === "number" ? payload.importance : Number(payload.importance ?? 0.5),
      createdAt: typeof payload.created_at === "string" ? payload.created_at : new Date(),
      lastAccessed: typeof payload.last_accessed === "string" ? payload.last_accessed : new Date(),
      embedding: vector?.[VECTOR_NAME] ?? null,
      source: typeof payload.source === "string" && payload.source ? payload.source : null,
      private: Boolean(payload.private),
    });
  }

  _build_scope_filter(scope_prefix: string | null): QdrantScopeFilter | null {
    if (!scope_prefix || !scope_prefix.trim().replaceAll("/", "")) {
      return null;
    }
    return {
      must: [{
        key: "scope_ancestors",
        match: { value: normalize_scope_path(scope_prefix) },
      }],
    };
  }

  _scroll_all(shard: QdrantShardHandle, _filter: QdrantScopeFilter | null = null, _with_vector = false): QdrantPoint[] {
    void _filter;
    void _with_vector;
    return [...shard.points];
  }

  _delete_from_shard(
    shard: QdrantShardHandle,
    scope_prefix: string | null,
    categories: readonly string[] | null,
    record_ids: readonly string[] | null,
    older_than: Date | string | null,
    metadata_filter: Record<string, unknown> | null,
  ): number {
    const before = shard.points.length;
    const cutoff = coerceDate(older_than);
    const ids = new Set(record_ids ?? []);
    shard.points = shard.points.filter((point) => {
      const record = this._payload_to_record(point.payload, point.vector);
      if (!is_scope_within_prefix(record.scope, scope_prefix)) {
        return true;
      }
      if (ids.size > 0 && !ids.has(record.id)) {
        return true;
      }
      if (categories && !categories.some((category) => record.categories.includes(category))) {
        return true;
      }
      if (metadata_filter && !Object.entries(metadata_filter).every(([key, value]) => record.metadata[key] === value)) {
        return true;
      }
      if (cutoff && record.createdAt >= cutoff) {
        return true;
      }
      return false;
    });
    return before - shard.points.length;
  }

  _delete_from_shard_path(
    shard_path: string,
    scope_prefix: string | null,
    categories: readonly string[] | null,
    record_ids: readonly string[] | null,
    older_than: Date | string | null,
    metadata_filter: Record<string, unknown> | null,
  ): number {
    const shard = this._open_shard(shard_path);
    try {
      const deleted = this._delete_from_shard(shard, scope_prefix, categories, record_ids, older_than, metadata_filter);
      shard.flush();
      return deleted;
    } finally {
      shard.close();
    }
  }

  _upsert_to_central(points: readonly QdrantPoint[]): void {
    for (const point of points) {
      this.records.set(point.payload.record_id, this._payload_to_record(point.payload, point.vector));
    }
  }

  _cleanup_orphaned_shards(): void {
  }
}

export type LanceDBStorageOptions = {
  path?: string | null;
  tableName?: string;
  table_name?: string;
  vectorDim?: number | null;
  vector_dim?: number | null;
  compactEvery?: number;
  compact_every?: number;
};

export type LanceDBRow = {
  id: string;
  content: string;
  scope: string;
  categories_str: string;
  metadata_str: string;
  importance: number;
  created_at: string;
  last_accessed: string;
  source: string;
  private: boolean;
  vector: readonly number[];
};

export class LanceDBStorage extends QdrantEdgeStorage {
  readonly tableName: string;
  readonly table_name: string;
  readonly compactEvery: number;
  readonly compact_every: number;
  _save_count = 0;

  constructor(options: string | LanceDBStorageOptions | null = null) {
    const config = typeof options === "string" || options === null ? { path: options } : options;
    super({
      path: config.path ?? null,
      vectorDim: config.vectorDim ?? config.vector_dim ?? null,
    });
    this.tableName = config.tableName ?? config.table_name ?? "memories";
    this.table_name = this.tableName;
    this.compactEvery = Math.max(0, config.compactEvery ?? config.compact_every ?? 100);
    this.compact_every = this.compactEvery;
  }

  override save(records: MemoryRecord | MemoryRecordOptions | readonly (MemoryRecord | MemoryRecordOptions)[]): void {
    super.save(records);
    this._save_count += 1;
    if (this.compactEvery > 0 && this._save_count % this.compactEvery === 0) {
      this._compact_async();
    }
  }

  _infer_dim_from_table(table: { schema?: Iterable<{ name?: string; type?: { list_size?: unknown; listSize?: unknown } }> }): number {
    for (const field of table.schema ?? []) {
      if (field.name !== "vector") {
        continue;
      }
      const size = field.type?.list_size ?? field.type?.listSize;
      if (typeof size === "number" && Number.isFinite(size) && size > 0) {
        return size;
      }
      if (typeof size === "string" && Number.isFinite(Number(size)) && Number(size) > 0) {
        return Number(size);
      }
    }
    return DEFAULT_VECTOR_DIM;
  }

  _ensure_table(_vector_dim: number | null = null): this {
    void _vector_dim;
    return this;
  }

  _create_table(vector_dim: number): this {
    if (Number.isFinite(vector_dim) && vector_dim > 0) {
      (this as { vectorDim: number; vector_dim: number }).vectorDim = vector_dim;
      (this as { vectorDim: number; vector_dim: number }).vector_dim = vector_dim;
    }
    return this;
  }

  _do_write(op: string, ...args: unknown[]): unknown {
    if (op === "add") {
      const rows = Array.isArray(args[0]) ? args[0] : [];
      const records = rows.map((row) => this._row_to_record(row as Record<string, unknown>));
      this.save(records);
      return null;
    }
    if (op === "delete") {
      const where = typeof args[0] === "string" ? args[0] : "";
      const id = /^id = '(.+)'$/u.exec(where)?.[1]?.replaceAll("''", "'");
      return id ? this.delete(null, null, [id]) : 0;
    }
    if (op === "update") {
      return null;
    }
    throw new Error(`Unsupported LanceDB write operation: ${op}`);
  }

  _ensure_scope_index(): void {
  }

  _compact_if_needed(): void {
    if (this.compactEvery > 0) {
      this._compact_async();
    }
  }

  _compact_async(): void {
    this._compact_safe();
  }

  _compact_safe(): void {
    this.optimize();
    this._ensure_scope_index();
  }

  _record_to_row(record: MemoryRecord): LanceDBRow {
    return {
      id: record.id,
      content: record.content,
      scope: record.scope,
      categories_str: JSON.stringify(record.categories),
      metadata_str: JSON.stringify(record.metadata),
      importance: record.importance,
      created_at: record.createdAt.toISOString(),
      last_accessed: (record.lastAccessed ?? record.createdAt).toISOString(),
      source: record.source ?? "",
      private: record.private,
      vector: record.embedding && record.embedding.length > 0
        ? record.embedding
        : Array.from({ length: this.vectorDim }, () => 0),
    };
  }

  _row_to_record(row: LanceDBRow | Record<string, unknown>): MemoryRecord {
    const categories = parseJsonArray(row.categories_str);
    const metadata = parseJsonRecord(row.metadata_str) ?? {};
    return new MemoryRecord({
      id: String(row.id),
      content: String(row.content),
      scope: String(row.scope),
      categories,
      metadata,
      importance: typeof row.importance === "number" ? row.importance : Number(row.importance ?? 0.5),
      createdAt: typeof row.created_at === "string" ? row.created_at : new Date(),
      lastAccessed: typeof row.last_accessed === "string" ? row.last_accessed : new Date(),
      embedding: Array.isArray(row.vector) ? row.vector.filter((value): value is number => typeof value === "number") : null,
      source: typeof row.source === "string" && row.source ? row.source : null,
      private: Boolean(row.private),
    });
  }

  _scan_rows(scope_prefix: string | null = null, limit = 10_000, columns: readonly string[] | null = null): Record<string, unknown>[] {
    return this.list_records(scope_prefix, limit).map((record) => {
      const row = this._record_to_row(record);
      if (!columns) {
        return row;
      }
      return Object.fromEntries(columns.map((column) => [column, (row as unknown as Record<string, unknown>)[column]]));
    });
  }
}

export class StorageBackend extends QdrantEdgeStorage {}

type RecallLLMCallable = (messages: readonly LLMMessage[], options?: { responseModel?: unknown }) => unknown;
type RecallLLMClient = { call(messages: readonly LLMMessage[], options?: { responseModel?: unknown }): unknown };

function isRecallLLMCallable(value: unknown): value is RecallLLMCallable {
  return typeof value === "function";
}

function isRecallLLMClient(value: unknown): value is RecallLLMClient {
  return isRecord(value) && typeof value.call === "function";
}

export class RecallFlow {
  readonly _skip_auto_memory = true;
  readonly state = new RecallState();

  constructor(private readonly storage: MemoryVectorStorageLike, private readonly llm: unknown = null, private readonly embedder: unknown = null, private readonly config = new MemoryConfig()) {
    void this.llm;
  }

  analyze_query_step(): QueryAnalysis {
    this.state.explorationBudget = this.config.explorationBudget;
    this.state.exploration_budget = this.state.explorationBudget;
    const skipLlm = this.state.query.length < this.config.queryAnalysisThreshold;
    let analysis: QueryAnalysis;
    if (skipLlm) {
      analysis = new QueryAnalysis({
        keywords: [],
        suggestedScopes: [],
        complexity: "simple",
        recallQueries: [this.state.query],
      });
    } else {
      const availableScopes = this.recallStorageListScopes(this.state.scope ?? "/");
      const scopeInfo = this.state.scope ? this.recallStorageScopeInfo(this.state.scope) : null;
      analysis = this.analyzeRecallQuerySync(this.state.query, availableScopes, scopeInfo);
      const timeCutoff = coerceDate(analysis.time_filter);
      if (timeCutoff) {
        this.state.timeCutoff = timeCutoff;
        this.state.time_cutoff = timeCutoff;
      }
    }
    this.state.queryAnalysis = analysis;
    this.state.query_analysis = analysis;
    const queries = (analysis.recall_queries.length > 0 ? analysis.recall_queries : [this.state.query]).slice(0, 3);
    const embeddings = embed_texts(this.embedder, queries);
    let pairs = queries
      .map((query, index) => [query, embeddings[index] ?? []] as const)
      .filter(([, embedding]) => embedding.length > 0);
    if (pairs.length === 0) {
      const fallback = embed_texts(this.embedder, [this.state.query])[0] ?? [];
      if (fallback.length > 0) {
        pairs = [[this.state.query, fallback]];
      }
    }
    this.state.queryEmbeddings = pairs;
    this.state.query_embeddings = pairs;
    return analysis;
  }

  analyzeQueryStep(): QueryAnalysis {
    return this.analyze_query_step();
  }

  private recallStorageListScopes(scope: string): readonly string[] {
    const storage = this.storage as MemoryVectorStorageLike & {
      list_scopes?: (scopePrefix?: string | null) => readonly string[];
      listScopes?: (scopePrefix?: string | null) => readonly string[];
    };
    try {
      const scopes = storage.list_scopes?.(scope) ?? storage.listScopes?.(scope) ?? [];
      return scopes.length > 0 ? scopes : ["/"];
    } catch {
      return ["/"];
    }
  }

  private recallStorageScopeInfo(scope: string): ScopeInfo | null {
    const storage = this.storage as MemoryVectorStorageLike & {
      get_scope_info?: (scope: string) => ScopeInfo;
      getScopeInfo?: (scope: string) => ScopeInfo;
    };
    try {
      return storage.get_scope_info?.(scope) ?? storage.getScopeInfo?.(scope) ?? null;
    } catch {
      return null;
    }
  }

  private analyzeRecallQuerySync(query: string, availableScopes: readonly string[], scopeInfo: ScopeInfo | null): QueryAnalysis {
    const scopeDescription = scopeInfo
      ? `Current scope has ${String(scopeInfo.count)} records, categories: ${scopeInfo.categories.join(", ")}`
      : "";
    const messages: readonly LLMMessage[] = [
      { role: "system", content: memoryPrompt("query_system") },
      {
        role: "user",
        content: memoryPrompt("query_user")
          .replace("{query}", query)
          .replace("{available_scopes}", JSON.stringify(availableScopes.length > 0 ? availableScopes : ["/"]))
          .replace("{scope_desc}", scopeDescription),
      },
    ];
    try {
      const raw = this.callRecallLLMSync(messages, { responseModel: QueryAnalysis });
      if (raw && typeof (raw as { then?: unknown }).then === "function") {
        throw new Error("Async LLM response is not supported by synchronous RecallFlow.analyze_query_step");
      }
      return coerceQueryAnalysis(raw, query, availableScopes);
    } catch {
      return new QueryAnalysis({
        suggestedScopes: (availableScopes.length > 0 ? availableScopes : ["/"]).slice(0, 5),
        complexity: "simple",
        recallQueries: [query],
      });
    }
  }

  private callRecallLLMSync(messages: readonly LLMMessage[], options?: { responseModel?: unknown }): unknown {
    if (isRecallLLMCallable(this.llm)) {
      return this.llm(messages, options);
    }
    if (isRecallLLMClient(this.llm)) {
      return this.llm.call(messages, options);
    }
    return undefined;
  }

  filter_and_chunk(): string[] {
    const analysis = this.state.query_analysis;
    const scopePrefix = (this.state.scope ?? "/").replace(/\/+$/u, "") || "/";
    let candidates = analysis && analysis.suggested_scopes.length > 0
      ? analysis.suggested_scopes.filter((scope) => scope.length > 0)
      : [];
    if (candidates.length === 0) {
      const storage = this.storage as MemoryVectorStorageLike & {
        list_scopes?: (scopePrefix?: string | null) => readonly string[];
        listScopes?: (scopePrefix?: string | null) => readonly string[];
      };
      try {
        candidates = [...(storage.list_scopes?.(scopePrefix) ?? storage.listScopes?.(scopePrefix) ?? [])];
      } catch {
        candidates = [];
      }
    }
    if (candidates.length === 0) {
      candidates = [scopePrefix];
    }
    this.state.candidateScopes = candidates.slice(0, 20);
    this.state.candidate_scopes = this.state.candidateScopes;
    return this.state.candidateScopes;
  }

  filterAndChunk(): string[] {
    return this.filter_and_chunk();
  }

  _merged_categories(): readonly string[] | null {
    return this.state.categories && this.state.categories.length > 0 ? this.state.categories : null;
  }

  private mergedCategories(): readonly string[] | null {
    return this._merged_categories();
  }

  _search_one(embedding: readonly number[], scope: string): [string, Array<readonly [MemoryRecord, number]>] {
    let results = this.storage.search(embedding, {
      scope_prefix: scope,
      categories: this._merged_categories(),
      limit: this.state.limit * this.config.recallOversampleFactor,
      min_score: 0,
    });
    const timeCutoff = this.state.time_cutoff;
    if (timeCutoff) {
      results = results.filter(([record]) => record.createdAt >= timeCutoff);
    }
    if (!this.state.include_private) {
      results = results.filter(([record]) => !record.private || record.source === this.state.source);
    }
    return [scope, results];
  }

  _do_search(): Array<{ scope: string; results: Array<readonly [MemoryRecord, number]>; top_score: number }> {
    const findings: Array<{ scope: string; results: Array<readonly [MemoryRecord, number]>; top_score: number }> = [];
    const scopes = this.state.candidate_scopes.length > 0 ? this.state.candidate_scopes : [this.state.scope ?? "/"];
    for (const [, embedding] of this.state.query_embeddings) {
      for (const scope of scopes) {
        let results: Array<readonly [MemoryRecord, number]>;
        try {
          [, results] = this._search_one(embedding, scope);
        } catch {
          continue;
        }
        const firstResult = results[0];
        if (firstResult) {
          const [topScore] = compute_composite_score(firstResult[0], firstResult[1], this.config);
          findings.push({ scope, results, top_score: topScore });
        }
      }
    }
    this.state.chunkFindings = findings;
    this.state.chunk_findings = findings;
    this.state.confidence = findings.reduce((max, finding) => Math.max(max, finding.top_score), 0);
    return findings;
  }

  private doSearch(): Array<{ scope: string; results: Array<readonly [MemoryRecord, number]>; top_score: number }> {
    return this._do_search();
  }

  search_chunks(): Array<{ scope: string; results: Array<readonly [MemoryRecord, number]>; top_score: number }> {
    return this.doSearch();
  }

  searchChunks(): Array<{ scope: string; results: Array<readonly [MemoryRecord, number]>; top_score: number }> {
    return this.search_chunks();
  }

  decide_depth(): "explore_deeper" | "synthesize" {
    const analysis = this.state.query_analysis;
    if (
      analysis
      && analysis.complexity === "complex"
      && this.state.confidence < this.config.complexQueryThreshold
      && this.state.exploration_budget > 0
    ) {
      return "explore_deeper";
    }
    if (this.state.confidence >= this.config.confidenceThresholdHigh) {
      return "synthesize";
    }
    if (this.state.exploration_budget > 0 && this.state.confidence < this.config.confidenceThresholdLow) {
      return "explore_deeper";
    }
    return "synthesize";
  }

  decideDepth(): "explore_deeper" | "synthesize" {
    return this.decide_depth();
  }

  recursive_exploration(): Array<{ scope: string; extraction: unknown; results: unknown }> {
    this.state.explorationBudget = Math.max(0, this.state.exploration_budget - 1);
    this.state.exploration_budget = this.state.explorationBudget;
    const enhanced: Array<{ scope: string; extraction: unknown; results: unknown }> = [];
    for (const finding of this.state.chunk_findings) {
      if (!finding || typeof finding !== "object" || !("results" in finding)) {
        continue;
      }
      const scope = "scope" in finding && typeof (finding as { scope?: unknown }).scope === "string"
        ? (finding as { scope: string }).scope
        : "/";
      const results = (finding as { results?: unknown }).results;
      const resultItems = Array.isArray(results) ? results : [];
      if (resultItems.length === 0) {
        continue;
      }
      const contentParts = resultItems
        .slice(0, 5)
        .map((item) => Array.isArray(item) && item[0] instanceof MemoryRecord ? item[0].content : "")
        .filter((content) => content.length > 0);
      const prompt = [
        `Query: ${this.state.query}`,
        "",
        `Relevant memory excerpts:\n${contentParts.join("\n---\n")}`,
        "",
        "Extract the most relevant information for the query. If something is missing, say what's missing in one short line.",
      ].join("\n");
      let extraction: unknown;
      try {
        extraction = this.callRecallLLMSync([{ role: "user", content: prompt }]) ?? "";
        if (typeof extraction === "string" && extraction.toLowerCase().includes("missing")) {
          this.state.evidenceGaps = [...this.state.evidence_gaps, extraction.slice(0, 200)];
          this.state.evidence_gaps = this.state.evidenceGaps;
        }
      } catch {
        extraction = "";
      }
      enhanced.push({ scope, extraction, results });
    }
    this.state.chunkFindings = enhanced;
    this.state.chunk_findings = enhanced;
    return enhanced;
  }

  recursiveExploration(): Array<{ scope: string; extraction: unknown; results: unknown }> {
    return this.recursive_exploration();
  }

  re_search(): Array<{ scope: string; results: Array<readonly [MemoryRecord, number]>; top_score: number }> {
    return this.doSearch();
  }

  reSearch(): Array<{ scope: string; results: Array<readonly [MemoryRecord, number]>; top_score: number }> {
    return this.re_search();
  }

  re_decide_depth(): "explore_deeper" | "synthesize" {
    return this.decide_depth();
  }

  reDecideDepth(): "explore_deeper" | "synthesize" {
    return this.re_decide_depth();
  }

  synthesize_results(): MemoryMatch[] {
    const seen = new Set<string>();
    const matches: MemoryMatch[] = [];
    for (const finding of this.state.chunk_findings) {
      if (!finding || typeof finding !== "object" || !("results" in finding)) {
        continue;
      }
      const results = (finding as { results?: unknown }).results;
      if (!Array.isArray(results)) {
        continue;
      }
      for (const item of results) {
        if (!Array.isArray(item) || item.length < 2) {
          continue;
        }
        const record: unknown = item[0];
        const semanticScore: unknown = item[1];
        if (!(record instanceof MemoryRecord) || seen.has(record.id)) {
          continue;
        }
        seen.add(record.id);
        const [score, reasons] = compute_composite_score(record, Number(semanticScore), this.config);
        matches.push(new MemoryMatch({ record, score, matchReasons: reasons }));
      }
    }
    matches.sort((left, right) => right.score - left.score);
    const finalResults = matches.slice(0, this.state.limit);
    const topResult = finalResults[0];
    if (this.state.evidence_gaps.length > 0 && topResult) {
      finalResults[0] = new MemoryMatch({
        record: topResult.record,
        score: topResult.score,
        matchReasons: topResult.matchReasons,
        evidenceGaps: this.state.evidence_gaps,
      });
    }
    this.state.finalResults = finalResults;
    this.state.final_results = finalResults;
    return finalResults;
  }

  synthesizeResults(): MemoryMatch[] {
    return this.synthesize_results();
  }

  kickoff(options: { inputs?: Partial<RecallState> } = {}): MemoryMatch[] {
    Object.assign(this.state, options.inputs ?? {});
    this.analyze_query_step();
    this.filter_and_chunk();
    this.search_chunks();
    if (this.decide_depth() === "explore_deeper") {
      this.recursive_exploration();
      this.re_search();
      if (this.re_decide_depth() === "explore_deeper") {
        this.recursive_exploration();
        this.re_search();
      }
    }
    const results = this.synthesize_results();
    this.state.confidence = this.state.finalResults[0]?.score ?? 0;
    return results;
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
  readonly memoryKind = "memory";
  readonly memory_kind = "memory";
  readonly readOnly: boolean;
  readonly read_only: boolean;
  readonly rootScope: string | null;
  readonly root_scope: string | null;
  readonly llm: LLM | null;
  readonly embedder: unknown;
  private config: MemoryConfig;
  private readonly configOptions: ConstructorParameters<typeof MemoryConfig>[0];
  private readonly records: MemoryRecord[] = [];
  private readonly pendingWrites: Array<() => MemoryRecord[]> = [];

  constructor(options: MemoryOptions = {}) {
    this.readOnly = options.readOnly ?? options.read_only ?? false;
    this.read_only = this.readOnly;
    this.rootScope = options.rootScope ?? options.root_scope ?? null;
    this.root_scope = this.rootScope;
    this.llm = options.llm ?? null;
    this.embedder = options.embedder ?? null;
    this.configOptions = { ...options };
    this.config = new MemoryConfig(this.configOptions);
  }

  modelPostInit(_context: unknown = null): void {
    void _context;
    this.config = new MemoryConfig(this.configOptions);
  }

  model_post_init(_context: unknown = null): void {
    this.modelPostInit(_context);
  }

  get _llm(): LLM | null {
    return this.llm;
  }

  get _embedder(): unknown {
    return this.embedder;
  }

  _submit_save(fn: (...args: readonly unknown[]) => MemoryRecord[], ...args: readonly unknown[]): { result: () => MemoryRecord[] } {
    let settled = false;
    let value: MemoryRecord[] = [];
    let failure: unknown = null;
    const run = (): MemoryRecord[] => {
      if (!settled) {
        try {
          value = fn(...args);
        } catch (error) {
          failure = error;
        }
        settled = true;
        this._on_save_done({ exception: () => failure });
      }
      if (failure) {
        throw failure instanceof Error ? failure : new Error(formatUnknownError(failure));
      }
      return value;
    };
    this.pendingWrites.push(run);
    return { result: run };
  }

  _on_save_done(future: { exception?: () => unknown } | null): void {
    const error = future?.exception?.();
    if (error) {
      crewaiEventBus.emit(this, new MemorySaveFailedEvent({
        value: "background save",
        error,
      }));
    }
  }

  _encode_batch(
    contents: readonly string[],
    scope: string | null = null,
    categories: readonly string[] | null = null,
    metadata: Record<string, unknown> | null = null,
    importance: number | null = null,
    source: string | null = null,
    privateMemory = false,
    rootScope: string | null = null,
  ): MemoryRecord[] {
    const records = contents.map((content) => this.createMemoryRecordFromResolvedItem({
      content,
      options: {
        scope: rootScope ? joinScopePaths(rootScope, scope ?? "/") : scope,
        categories,
        metadata,
        importance,
        source,
        private: privateMemory,
      },
    }));
    this.records.push(...records);
    return records;
  }

  _background_encode_batch(
    contents: readonly string[],
    scope: string | null = null,
    categories: readonly string[] | null = null,
    metadata: Record<string, unknown> | null = null,
    importance: number | null = null,
    source: string | null = null,
    privateMemory = false,
    agentRole: string | null = null,
    rootScope: string | null = null,
  ): MemoryRecord[] {
    return this.runBackgroundSave(contents, {
      scope: rootScope ? joinScopePaths(rootScope, scope ?? "/") : scope,
      categories,
      metadata,
      importance,
      source,
      private: privateMemory,
      agentRole,
    });
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
        importance: options.importance ?? this.config.defaultImportance,
        source: options.source ?? null,
        private: options.private ?? false,
        embedding: this.embeddingForText(content),
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
    return this.records
      .filter((record) => !effectiveScope || record.scope.startsWith(effectiveScope))
      .map((record) => ({ record, score: scoreRecord(record, terms) }))
      .filter(({ score }) => score >= this.config.consolidationThreshold)
      .sort((left, right) => right.score - left.score)
      .slice(0, this.config.consolidationLimit)
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
        embedding: this.embeddingForText(newContent) ?? existing.embedding ?? null,
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
    const plannedItems = await Promise.all(items.map(async (item) => {
      const similarRecords = this.findSimilarRecords(item.content, item.options.scope);
      const plan = similarRecords.length > 0
        ? await analyzeForConsolidation(item.content, similarRecords, this.llm as LLM)
        : new ConsolidationPlan({ actions: [], insertNew: true });
      return { ...item, similarRecords, plan };
    }));
    this.pendingWrites.push(() => this.runResolvedBackgroundSave(plannedItems, options));
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
      depth?: "shallow" | "deep";
    } = {},
  ): MemoryMatch[] {
    const limit = options.limit ?? 10;
    const scoreThreshold = options.scoreThreshold ?? null;
    this.drainWrites();
    crewaiEventBus.emit(this, new MemoryQueryStartedEvent({ query, limit, scoreThreshold }));
    const start = performance.now();
    try {
      const scope = options.scope ? this.scopePath(options.scope) : this.rootScope;
      const depth = options.depth ?? (isEmbeddingCallable(this.embedder) ? "deep" : "shallow");
      const matches = depth === "deep" && isEmbeddingCallable(this.embedder)
        ? this.deepRecall(query, {
          scope,
          categories: options.categories ?? null,
          limit,
          source: options.source ?? null,
          includePrivate: options.includePrivate ?? false,
        })
        : this.shallowRecall(query, {
          scope,
          categories: options.categories ?? null,
          limit,
          scoreThreshold,
          source: options.source ?? null,
          includePrivate: options.includePrivate ?? false,
        });
      this.touchRecords(matches.map((match) => match.record.id));
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

  private touchRecords(recordIds: readonly string[]): void {
    if (recordIds.length === 0) {
      return;
    }
    const ids = new Set(recordIds);
    this.records.forEach((record, index) => {
      if (!ids.has(record.id)) {
        return;
      }
      const previousAccessed = record.lastAccessed ?? record.createdAt;
      const touchedAt = new Date(Math.max(Date.now(), previousAccessed.getTime() + 1));
      this.records[index] = new MemoryRecord({
        id: record.id,
        content: record.content,
        scope: record.scope,
        categories: record.categories,
        metadata: record.metadata,
        importance: record.importance,
        source: record.source,
        private: record.private,
        createdAt: record.createdAt,
        lastAccessed: touchedAt,
        embedding: record.embedding ?? null,
      });
    });
  }

  private shallowRecall(query: string, options: {
    scope: string | null;
    categories: readonly string[] | null;
    limit: number;
    scoreThreshold: number | null;
    source: string | null;
    includePrivate: boolean;
  }): MemoryMatch[] {
    if (isEmbeddingCallable(this.embedder)) {
      const embedding = embed_text(this.embedder, query);
      if (embedding.length > 0) {
        return this.memoryVectorStorage().search(embedding, {
          scope_prefix: options.scope,
          categories: options.categories,
          limit: options.limit,
          min_score: 0,
        })
          .filter(([record]) => options.includePrivate || !record.private || record.source === options.source)
          .map(([record, semanticScore]) => {
            const [score, reasons] = compute_composite_score(record, semanticScore, this.config);
            return new MemoryMatch({ record, score, matchReasons: reasons });
          })
          .filter((match) => options.scoreThreshold === null || match.score >= options.scoreThreshold)
          .sort((left, right) => right.score - left.score)
          .slice(0, options.limit);
      }
    }
    const queryTerms = tokenize(query);
    return this.records
      .filter((record) => !options.scope || record.scope.startsWith(options.scope))
      .filter((record) => options.includePrivate || !record.private || record.source === options.source)
      .filter((record) => !options.categories || options.categories.some((category) => record.categories.includes(category)))
      .map((record) => ({ record, score: scoreRecord(record, queryTerms) }))
      .filter((match) => options.scoreThreshold === null || match.score >= options.scoreThreshold)
      .sort((a, b) => b.score - a.score || b.record.createdAt.getTime() - a.record.createdAt.getTime())
      .slice(0, options.limit)
      .map((match) => new MemoryMatch(match));
  }

  private deepRecall(query: string, options: {
    scope: string | null;
    categories: readonly string[] | null;
    limit: number;
    source: string | null;
    includePrivate: boolean;
  }): MemoryMatch[] {
    const flow = new RecallFlow(this.memoryVectorStorage(), this.llm, this.embedder, this.config);
    void flow.kickoff({
      inputs: {
        query,
        scope: options.scope,
        categories: options.categories,
        limit: options.limit,
        source: options.source,
        includePrivate: options.includePrivate,
      },
    });
    return flow.state.final_results;
  }

  forget(options: {
    scope?: string | null;
    categories?: readonly string[] | null;
    recordIds?: readonly string[] | null;
    record_ids?: readonly string[] | null;
    olderThan?: Date | string | null;
    older_than?: Date | string | null;
    metadataFilter?: Record<string, unknown> | null;
    metadata_filter?: Record<string, unknown> | null;
  } = {}): number {
    const before = this.records.length;
    const scope = options.scope ? this.scopePath(options.scope) : null;
    const ids = new Set(options.recordIds ?? options.record_ids ?? []);
    const cutoff = coerceDate(options.olderThan ?? options.older_than);
    const metadataFilter = options.metadataFilter ?? options.metadata_filter ?? null;
    for (let index = this.records.length - 1; index >= 0; index -= 1) {
      const record = this.records[index];
      if (!record) {
        continue;
      }
      const matchesScope = !scope || record.scope.startsWith(scope);
      const matchesCategory = !options.categories || options.categories.some((category) => record.categories.includes(category));
      const matchesId = ids.size === 0 || ids.has(record.id);
      const matchesAge = !cutoff || record.createdAt < cutoff;
      const matchesMetadata = !metadataFilter || Object.entries(metadataFilter).every(([key, value]) => record.metadata[key] === value);
      if (matchesScope && matchesCategory && matchesId && matchesAge && matchesMetadata) {
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

  update(record: MemoryRecord | MemoryRecordOptions): MemoryRecord | null;
  update(recordId: string, updates: MemoryUpdateOptions): MemoryRecord | null;
  update(recordOrId: MemoryRecord | MemoryRecordOptions | string, updates: MemoryUpdateOptions = {}): MemoryRecord | null {
    if (this.readOnly) {
      return null;
    }
    if (typeof recordOrId === "string") {
      const existing = this.get_record(recordOrId);
      if (!existing) {
        throw new Error(`Record not found: ${recordOrId}`);
      }
      const memoryRecord = new MemoryRecord({
        id: existing.id,
        content: updates.content ?? existing.content,
        scope: updates.scope === undefined || updates.scope === null ? existing.scope : this.scopePath(updates.scope),
        categories: updates.categories ?? existing.categories,
        metadata: updates.metadata ?? existing.metadata,
        importance: updates.importance ?? existing.importance,
        source: existing.source,
        private: existing.private,
        createdAt: existing.createdAt,
        lastAccessed: new Date(),
        embedding: updates.content === undefined || updates.content === null
          ? existing.embedding ?? null
          : this.embeddingForText(updates.content) ?? existing.embedding ?? null,
      });
      const index = this.records.findIndex((candidate) => candidate.id === memoryRecord.id);
      this.records[index] = memoryRecord;
      return memoryRecord;
    }
    const memoryRecord = recordOrId instanceof MemoryRecord ? recordOrId : new MemoryRecord(recordOrId);
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

  reset(scope?: string | null | { scope_prefix?: string | null; scopePrefix?: string | null }): void {
    if (typeof scope === "object" && scope !== null) {
      this.reset(scope.scope_prefix ?? scope.scopePrefix ?? null);
      return;
    }
    if (!scope) {
      if (this.rootScope) {
        const rootScope = normalize_scope_path(this.rootScope);
        for (let index = this.records.length - 1; index >= 0; index -= 1) {
          if (this.records[index]?.scope.startsWith(rootScope)) {
            this.records.splice(index, 1);
          }
        }
        return;
      }
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

  listScopes(full?: boolean): readonly string[] | readonly ScopeInfo[];
  listScopes(path: string | null): readonly string[];
  listScopes(pathOrFull: string | null | boolean = false): readonly string[] | readonly ScopeInfo[] {
    if (typeof pathOrFull === "string" || pathOrFull === null) {
      return this.immediateChildScopes(this.effectivePath(pathOrFull));
    }
    const full = pathOrFull;
    const infos = this.scopeInfos();
    return full ? infos : infos.map((info) => info.path);
  }

  list_scopes(full?: boolean): readonly string[] | readonly ScopeInfo[];
  list_scopes(path: string | null): readonly string[];
  list_scopes(pathOrFull: string | null | boolean = false): readonly string[] | readonly ScopeInfo[] {
    return this.listScopes(pathOrFull as boolean);
  }

  listCategories(full?: boolean): Record<string, number> | Record<string, { count: number; scopes: readonly string[] }>;
  listCategories(path: string | null): Record<string, number>;
  listCategories(pathOrFull: string | null | boolean = false): Record<string, number> | Record<string, { count: number; scopes: readonly string[] }> {
    if (typeof pathOrFull === "string" || pathOrFull === null) {
      return categoriesForRecords(this.recordsForScope(this.effectivePath(pathOrFull)), false);
    }
    const full = pathOrFull;
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

  list_categories(full?: boolean): Record<string, number> | Record<string, { count: number; scopes: readonly string[] }>;
  list_categories(path: string | null): Record<string, number>;
  list_categories(pathOrFull: string | null | boolean = false): Record<string, number> | Record<string, { count: number; scopes: readonly string[] }> {
    return this.listCategories(pathOrFull as boolean);
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

  info(full?: boolean): MemoryInfo;
  info(path: string | null): ScopeInfo;
  info(pathOrFull: string | null | boolean = false): MemoryInfo | ScopeInfo {
    if (typeof pathOrFull === "string" || pathOrFull === null) {
      return this.scopeInfoForPath(this.effectivePath(pathOrFull));
    }
    const full = pathOrFull;
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

  tree(full?: boolean, maxDepth?: number): MemoryTreeNode;
  tree(path: string | null, maxDepth?: number): string;
  tree(pathOrFull: string | null | boolean = false, maxDepth = Number.POSITIVE_INFINITY): MemoryTreeNode | string {
    if (typeof pathOrFull === "string" || pathOrFull === null) {
      return this.formatTree(this.effectivePath(pathOrFull), maxDepth);
    }
    const full = pathOrFull;
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
    items: readonly {
      content: string;
      options: NonNullable<Parameters<Memory["remember"]>[1]>;
      similarRecords?: readonly MemoryRecord[];
      plan?: ConsolidationPlan | null;
    }[],
    eventOptions: Parameters<Memory["remember"]>[1] = {},
  ): MemoryRecord[] {
    crewaiEventBus.emit(this, new MemorySaveStartedEvent({
      value: `${String(items.length)} memories (background)`,
      metadata: eventOptions.metadata ?? null,
      agentRole: eventOptions.agentRole ?? null,
    }));
    const start = performance.now();
    try {
      const activeItems = deduplicateMemoryBatch(items, this.config);
      const records = this.applyBatchSavePlans(activeItems);
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

  private applyBatchSavePlans(
    items: readonly {
      content: string;
      options: NonNullable<Parameters<Memory["remember"]>[1]>;
      similarRecords?: readonly MemoryRecord[];
      plan?: ConsolidationPlan | null;
    }[],
  ): MemoryRecord[] {
    if (!items.some((item) => item.plan)) {
      const records = items.map((item) => this.createMemoryRecordFromResolvedItem(item));
      this.records.push(...records);
      return records;
    }

    const deletes = new Set<string>();
    const updates = new Map<string, { content: string; existing: MemoryRecord }>();
    for (const item of items) {
      const similarById = new Map((item.similarRecords ?? []).map((record) => [record.id, record]));
      for (const action of item.plan?.actions ?? []) {
        if (action.action === "delete" && !deletes.has(action.recordId) && !updates.has(action.recordId)) {
          deletes.add(action.recordId);
        } else if (
          action.action === "update"
          && action.newContent
          && !deletes.has(action.recordId)
          && !updates.has(action.recordId)
        ) {
          const existing = similarById.get(action.recordId) ?? this.get_record(action.recordId);
          if (existing) {
            updates.set(action.recordId, { content: action.newContent, existing });
          }
        }
      }
    }

    if (deletes.size > 0) {
      this.forget({ recordIds: [...deletes] });
    }

    const updatedRecords = new Map<string, MemoryRecord>();
    for (const [recordId, update] of updates.entries()) {
      const existing = this.get_record(recordId) ?? update.existing;
      const updated = new MemoryRecord({
        id: existing.id,
        content: update.content,
        scope: existing.scope,
        categories: existing.categories,
        metadata: existing.metadata,
        importance: existing.importance,
        source: existing.source,
        private: existing.private,
        createdAt: existing.createdAt,
        lastAccessed: new Date(),
        embedding: this.embeddingForText(update.content) ?? existing.embedding ?? null,
      });
      this.update(updated);
      updatedRecords.set(recordId, updated);
    }

    const inserted = items
      .filter((item) => item.plan?.insertNew ?? true)
      .map((item) => this.createMemoryRecordFromResolvedItem(item));
    this.records.push(...inserted);

    const resultRecords: MemoryRecord[] = [];
    for (const item of items) {
      if (item.plan?.insertNew ?? true) {
        const insertedRecord = inserted.shift();
        if (insertedRecord) {
          resultRecords.push(insertedRecord);
        }
        continue;
      }
      const actions = item.plan?.actions ?? [];
      const updated = actions
        .map((action) => updatedRecords.get(action.recordId))
        .find((record): record is MemoryRecord => record !== undefined);
      if (updated) {
        resultRecords.push(updated);
      } else if (item.similarRecords?.[0]) {
        resultRecords.push(item.similarRecords[0]);
      }
    }
    return resultRecords;
  }

  private createMemoryRecordFromResolvedItem(item: { content: string; options: NonNullable<Parameters<Memory["remember"]>[1]> }): MemoryRecord {
    return new MemoryRecord({
      content: item.content,
      scope: this.scopePath(item.options.scope),
      categories: item.options.categories ?? [],
      metadata: item.options.metadata ?? {},
      importance: item.options.importance ?? this.config.defaultImportance,
      source: item.options.source ?? null,
      private: item.options.private ?? false,
      embedding: this.embeddingForText(item.content),
    });
  }

  private embeddingForText(content: string): readonly number[] | null {
    const embedding = embed_text(this.embedder, content);
    return embedding.length > 0 ? embedding : null;
  }

  private memoryVectorStorage(): MemoryVectorStorageLike & {
    list_scopes(scopePrefix?: string | null): string[];
    get_scope_info(scope: string): ScopeInfo;
    touch_records(recordIds: readonly string[]): void;
  } {
    return {
      search: (embedding, options = {}) => {
        const scopePrefix = options.scopePrefix ?? options.scope_prefix ?? null;
        const categories = options.categories ?? null;
        const limit = options.limit ?? 10;
        const minScore = options.minScore ?? options.min_score ?? Number.NEGATIVE_INFINITY;
        return this.records
          .filter((record) => is_scope_within_prefix(record.scope, scopePrefix))
          .filter((record) => !categories || categories.some((category) => record.categories.includes(category)))
          .map((record) => [record, cosineSimilarity(embedding, record.embedding ?? [])] as const)
          .filter(([, score]) => score >= minScore)
          .sort((left, right) => right[1] - left[1])
          .slice(0, limit);
      },
      list_scopes: (scopePrefix = "/") => this.immediateChildScopes(scopePrefix ?? "/"),
      get_scope_info: (scope) => this.scopeInfoForPath(scope),
      touch_records: (recordIds) => {
        this.touchRecords(recordIds);
      },
    };
  }

  private scopePath(scope: string | null | undefined): string {
    return joinScopePaths(this.rootScope, scope ?? "/");
  }

  private effectivePath(path: string | null): string {
    if (path === null) {
      return this.rootScope ? normalize_scope_path(this.rootScope) : "/";
    }
    return this.scopePath(path);
  }

  private recordsForScope(scopePrefix: string): MemoryRecord[] {
    return this.records.filter((record) => record.scope.startsWith(scopePrefix));
  }

  private immediateChildScopes(scopePrefix: string): string[] {
    const normalized = normalize_scope_path(scopePrefix);
    const childPrefix = normalized === "/" ? "/" : `${normalized}/`;
    const children = new Set<string>();
    for (const record of this.recordsForScope(normalized)) {
      if (!record.scope.startsWith(childPrefix) || record.scope === normalized) {
        continue;
      }
      const rest = record.scope.slice(childPrefix.length);
      const firstComponent = rest.split("/", 1)[0];
      if (firstComponent) {
        children.add(`${childPrefix}${firstComponent}`);
      }
    }
    return [...children].sort();
  }

  private scopeInfoForPath(scopePrefix: string): ScopeInfo {
    const normalized = normalize_scope_path(scopePrefix);
    const records = this.recordsForScope(normalized);
    const categories = new Set<string>();
    let oldestRecord: Date | null = null;
    let newestRecord: Date | null = null;
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
    }
    return new ScopeInfo({
      path: normalized,
      recordCount: records.length,
      categories: [...categories].sort(),
      oldestRecord,
      newestRecord,
      lastUpdated: newestRecord,
      childScopes: this.immediateChildScopes(normalized),
    });
  }

  private formatTree(path: string, maxDepth = 3): string {
    const lines: string[] = [];
    const walk = (currentPath: string, depth: number, prefix: string): void => {
      if (depth > maxDepth) {
        return;
      }
      const info = this.scopeInfoForPath(currentPath);
      lines.push(`${prefix}${info.path} (${String(info.recordCount)} records)`);
      for (const child of info.childScopes.slice(0, 20)) {
        walk(child, depth + 1, `${prefix}  `);
      }
    };
    walk(normalize_scope_path(path), 0, "");
    return lines.length > 0 ? lines.join("\n") : `${path || "/"} (0 records)`;
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

function is_scope_within_prefix(scope: string, scopePrefix: string | null | undefined): boolean {
  if (!scopePrefix || !scopePrefix.trim().replaceAll("/", "")) {
    return true;
  }
  const normalizedScope = normalize_scope_path(scope);
  const normalizedPrefix = normalize_scope_path(scopePrefix);
  return normalizedScope === normalizedPrefix || normalizedScope.startsWith(`${normalizedPrefix}/`);
}

function buildScopeAncestors(scope: string): string[] {
  const normalizedScope = normalize_scope_path(scope);
  if (normalizedScope === "/") {
    return ["/"];
  }
  const ancestors = ["/"];
  let current = "";
  for (const part of normalizedScope.split("/").filter(Boolean)) {
    current = `${current}/${part}`;
    ancestors.push(current);
  }
  return ancestors;
}

function uuidToPointId(value: string): number {
  const normalized = value.replaceAll("-", "");
  if (/^[\da-f]{32}$/iu.test(normalized)) {
    const parsed = Number.parseInt(normalized.slice(-13), 16);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export const join_scope_paths = joinScopePaths;

type MemoryRememberOptions = NonNullable<Parameters<Memory["remember"]>[1]>;
type MemoryRecallOptions = NonNullable<Parameters<Memory["recall"]>[1]>;
type MemoryForgetOptions = NonNullable<Parameters<Memory["forget"]>[0]>;

export class MemoryScope {
  memory: Memory;
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

  _requireMemory(): Memory {
    return this.memory;
  }

  _require_memory(): Memory {
    return this._requireMemory();
  }

  _scopePath(scope: string | null = "/"): string {
    return joinScopePaths(this.rootPath, scope ?? "/");
  }

  _scope_path(scope: string | null = "/"): string {
    return this._scopePath(scope);
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

  reset(scope?: string | null): void {
    this.memory.reset(joinScopePaths(this.rootPath, scope ?? "/"));
  }

  listScopes(full?: boolean): readonly string[] | readonly ScopeInfo[];
  listScopes(path: string | null): readonly string[];
  listScopes(pathOrFull: string | null | boolean = false): readonly string[] | readonly ScopeInfo[] {
    if (typeof pathOrFull === "string" || pathOrFull === null) {
      return this.memory.list_scopes(joinScopePaths(this.rootPath, pathOrFull ?? "/"));
    }
    const full = pathOrFull;
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

  list_scopes(full?: boolean): readonly string[] | readonly ScopeInfo[];
  list_scopes(path: string | null): readonly string[];
  list_scopes(pathOrFull: string | null | boolean = false): readonly string[] | readonly ScopeInfo[] {
    return this.listScopes(pathOrFull as boolean);
  }

  info(full?: boolean): MemoryInfo;
  info(path: string | null): ScopeInfo;
  info(pathOrFull: string | null | boolean = false): MemoryInfo | ScopeInfo {
    if (typeof pathOrFull === "string" || pathOrFull === null) {
      return this.memory.info(joinScopePaths(this.rootPath, pathOrFull ?? "/"));
    }
    const full = pathOrFull;
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

  listCategories(full?: boolean): Record<string, number> | Record<string, { count: number; scopes: readonly string[] }>;
  listCategories(path: string | null): Record<string, number>;
  listCategories(pathOrFull: string | null | boolean = false): Record<string, number> | Record<string, { count: number; scopes: readonly string[] }> {
    if (typeof pathOrFull === "string" || pathOrFull === null) {
      return this.memory.list_categories(joinScopePaths(this.rootPath, pathOrFull ?? "/"));
    }
    const full = pathOrFull;
    return categoriesForRecords(this.memory.allRecords().filter((record) => record.scope.startsWith(this.rootPath)), full);
  }

  list_categories(full?: boolean): Record<string, number> | Record<string, { count: number; scopes: readonly string[] }>;
  list_categories(path: string | null): Record<string, number>;
  list_categories(pathOrFull: string | null | boolean = false): Record<string, number> | Record<string, { count: number; scopes: readonly string[] }> {
    return this.listCategories(pathOrFull as boolean);
  }

  tree(full?: boolean, maxDepth?: number): MemoryTreeNode;
  tree(path: string | null, maxDepth?: number): string;
  tree(pathOrFull: string | null | boolean = false, maxDepth = Number.POSITIVE_INFINITY): MemoryTreeNode | string {
    if (typeof pathOrFull === "string" || pathOrFull === null) {
      return this.memory.tree(joinScopePaths(this.rootPath, pathOrFull ?? "/"), maxDepth);
    }
    const full = pathOrFull;
    return treeForRecords(this.memory.allRecords().filter((record) => record.scope.startsWith(this.rootPath)), full, maxDepth);
  }

  subscope(path: string): MemoryScope {
    return new MemoryScope(this.memory, joinScopePaths(this.rootPath, path));
  }

  bind(memory: Memory): this {
    this.memory = memory;
    return this;
  }
}

export class MemorySlice {
  memory: Memory;
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

  _requireMemory(): Memory {
    return this.memory;
  }

  _require_memory(): Memory {
    return this._requireMemory();
  }

  remember(content: string, options: MemoryRememberOptions = {}): MemoryRecord | null {
    if (this.readOnly) {
      return null;
    }
    return this.memory.remember(content, { ...options, scope: options.scope ?? this.scopes[0] ?? "/" });
  }

  rememberMany(contents: readonly string[], options: MemoryRememberOptions = {}): MemoryRecord[] {
    if (this.readOnly) {
      return [];
    }
    return this.memory.rememberMany(contents, { ...options, scope: options.scope ?? this.scopes[0] ?? "/" });
  }

  remember_many(contents: readonly string[], options: MemoryRememberOptions = {}): MemoryRecord[] {
    return this.rememberMany(contents, options);
  }

  recall(query: string, options: Omit<MemoryRecallOptions, "scope"> = {}): MemoryMatch[] {
    const matches = new Map<string, MemoryMatch>();
    const categories = options.categories ?? this.categories ?? undefined;
    const limit = options.limit ?? 10;
    const perScopeLimit = limit * RECALL_OVERSAMPLE_FACTOR;
    for (const scope of this.scopes) {
      const recallOptions: MemoryRecallOptions = { ...options, scope, limit: perScopeLimit };
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
    return [...matches.values()].sort((left, right) => right.score - left.score).slice(0, limit);
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

  listScopes(full?: boolean): readonly string[] | readonly ScopeInfo[];
  listScopes(path: string | null): readonly string[];
  listScopes(pathOrFull: string | null | boolean = false): readonly string[] | readonly ScopeInfo[] {
    if (typeof pathOrFull === "string" || pathOrFull === null) {
      const paths = new Set<string>();
      for (const scope of this.scopes) {
        for (const childScope of this.memory.list_scopes(this.slicePath(scope, pathOrFull))) {
          paths.add(childScope);
        }
      }
      return [...paths].sort();
    }
    const full = pathOrFull;
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

  list_scopes(full?: boolean): readonly string[] | readonly ScopeInfo[];
  list_scopes(path: string | null): readonly string[];
  list_scopes(pathOrFull: string | null | boolean = false): readonly string[] | readonly ScopeInfo[] {
    return this.listScopes(pathOrFull as boolean);
  }

  info(full?: boolean): MemoryInfo;
  info(path: string | null): ScopeInfo;
  info(pathOrFull: string | null | boolean = false): MemoryInfo | ScopeInfo {
    if (typeof pathOrFull === "string" || pathOrFull === null) {
      const categories = new Set<string>();
      const childScopes = new Set<string>();
      let recordCount = 0;
      let oldestRecord: Date | null = null;
      let newestRecord: Date | null = null;
      for (const scope of this.scopes) {
        const info = this.memory.info(this.slicePath(scope, pathOrFull));
        recordCount += info.recordCount;
        for (const category of info.categories) {
          categories.add(category);
        }
        for (const childScope of info.childScopes) {
          childScopes.add(childScope);
        }
        if (info.oldestRecord && (!oldestRecord || info.oldestRecord < oldestRecord)) {
          oldestRecord = info.oldestRecord;
        }
        if (info.newestRecord && (!newestRecord || info.newestRecord > newestRecord)) {
          newestRecord = info.newestRecord;
        }
      }
      return new ScopeInfo({
        path: pathOrFull ?? "/",
        recordCount,
        categories: [...categories].sort(),
        oldestRecord,
        newestRecord,
        lastUpdated: newestRecord,
        childScopes: [...childScopes].sort(),
      });
    }
    const full = pathOrFull;
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

  listCategories(full?: boolean): Record<string, number> | Record<string, { count: number; scopes: readonly string[] }>;
  listCategories(path: string | null): Record<string, number>;
  listCategories(pathOrFull: string | null | boolean = false): Record<string, number> | Record<string, { count: number; scopes: readonly string[] }> {
    if (typeof pathOrFull === "string" || pathOrFull === null) {
      const counts: Record<string, number> = {};
      for (const scope of this.scopes) {
        const categories = this.memory.list_categories(this.slicePath(scope, pathOrFull));
        for (const [category, count] of Object.entries(categories)) {
          counts[category] = (counts[category] ?? 0) + count;
        }
      }
      return counts;
    }
    const full = pathOrFull;
    return categoriesForRecords(this.recordsInSlice(), full);
  }

  list_categories(full?: boolean): Record<string, number> | Record<string, { count: number; scopes: readonly string[] }>;
  list_categories(path: string | null): Record<string, number>;
  list_categories(pathOrFull: string | null | boolean = false): Record<string, number> | Record<string, { count: number; scopes: readonly string[] }> {
    return this.listCategories(pathOrFull as boolean);
  }

  tree(full = false, maxDepth = Number.POSITIVE_INFINITY): MemoryTreeNode {
    return treeForRecords(this.recordsInSlice(), full, maxDepth);
  }

  bind(memory: Memory): this {
    this.memory = memory;
    return this;
  }

  private recordsInSlice(): readonly MemoryRecord[] {
    return this.memory.allRecords().filter((record) =>
      this.scopes.some((scope) => record.scope.startsWith(scope)),
    );
  }

  private slicePath(scope: string, path: string | null): string {
    return joinScopePaths(scope, path ?? "/");
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

function deduplicateMemoryBatch<T extends { content: string }>(items: readonly T[], config = new MemoryConfig()): T[] {
  const active: T[] = [];
  for (const item of items) {
    const duplicate = active.some((existing) =>
      tokenCosineSimilarity(existing.content, item.content) >= config.batchDedupThreshold,
    );
    if (!duplicate) {
      active.push(item);
    }
  }
  return active;
}

function tokenCosineSimilarity(left: string, right: string): number {
  const leftTerms = tokenize(left);
  const rightTerms = tokenize(right);
  if (leftTerms.size === 0 || rightTerms.size === 0) {
    return 0;
  }
  let overlap = 0;
  for (const term of leftTerms) {
    if (rightTerms.has(term)) {
      overlap += 1;
    }
  }
  return overlap / Math.sqrt(leftTerms.size * rightTerms.size);
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

function parseJsonArray(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value !== "string" || !value) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) {
    return value;
  }
  if (typeof value !== "string" || !value) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
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

function formatUnknownError(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      return Object.prototype.toString.call(error);
    }
  }
  return String(error);
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
