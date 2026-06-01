export type JsonSchema = Record<string, unknown>;

export interface JsonSchemaInfo {
  name: string;
  strict: true;
  schema: JsonSchema;
}

export interface ModelDescription {
  type: "json_schema";
  json_schema: JsonSchemaInfo;
}

export const JsonSchemaInfo = class JsonSchemaInfo {
  readonly name: string;
  readonly strict = true;
  readonly schema: JsonSchema;

  constructor(options: { name: string; schema: JsonSchema; strict?: true }) {
    this.name = options.name;
    this.schema = options.schema;
    void options.strict;
  }
};

export const ModelDescription = class ModelDescription {
  readonly type = "json_schema";
  readonly json_schema: InstanceType<typeof JsonSchemaInfo>;

  constructor(options: { json_schema: InstanceType<typeof JsonSchemaInfo> | { name: string; schema: JsonSchema; strict?: true } }) {
    this.json_schema = options.json_schema instanceof JsonSchemaInfo
      ? options.json_schema
      : new JsonSchemaInfo(options.json_schema);
  }
};

export const FORMAT_TYPE_MAP = {
  "date-time": "string",
  date: "string",
  time: "string",
  duration: "string",
} as const;

export const OPENAI_SUPPORTED_FORMATS = new Set(["date-time", "date", "time", "duration"] as const);

const STRICT_METADATA_KEYS = [
  "title",
  "default",
  "examples",
  "example",
  "$comment",
  "readOnly",
  "writeOnly",
  "deprecated",
] as const;

const CLAUDE_STRICT_UNSUPPORTED = [
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "pattern",
  "minItems",
  "maxItems",
  "uniqueItems",
  "minContains",
  "maxContains",
  "minProperties",
  "maxProperties",
  "patternProperties",
  "propertyNames",
  "dependentRequired",
  "dependentSchemas",
] as const;

function isSchemaRecord(value: unknown): value is JsonSchema {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function cloneSchema<T>(value: T): T {
  return structuredClone(value);
}

function localDefName(ref: string): string | null {
  const prefix = "#/$defs/";
  return ref.startsWith(prefix) ? ref.slice(prefix.length) : null;
}

function walkSchema(value: unknown, visitor: (node: JsonSchema) => void, seen = new WeakSet<object>()): void {
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return;
    }
    seen.add(value);
    for (const item of value) {
      walkSchema(item, visitor, seen);
    }
    return;
  }

  if (!isSchemaRecord(value)) {
    return;
  }
  if (seen.has(value)) {
    return;
  }
  seen.add(value);
  visitor(value);
  for (const child of Object.values(value)) {
    walkSchema(child, visitor, seen);
  }
}

export function resolveRefs(schema: JsonSchema): JsonSchema {
  const defs = isSchemaRecord(schema.$defs) ? schema.$defs : {};
  const schemaCopy = cloneSchema(schema);
  const expanding = new Set<string>();

  function resolveNode(node: unknown): unknown {
    if (Array.isArray(node)) {
      return node.map((item) => resolveNode(item));
    }

    if (!isSchemaRecord(node)) {
      return node;
    }

    const ref = node.$ref;
    if (typeof ref === "string") {
      const defName = localDefName(ref);
      if (defName) {
        const defSchema = defs[defName];
        if (!isSchemaRecord(defSchema)) {
          throw new Error(`Definition '${defName}' not found in $defs.`);
        }
        if (expanding.has(defName)) {
          const stub: JsonSchema = { type: typeof defSchema.type === "string" ? defSchema.type : "object" };
          if (typeof defSchema.description === "string") {
            stub.description = defSchema.description;
          }
          return stub;
        }

        expanding.add(defName);
        try {
          return resolveNode(cloneSchema(defSchema));
        } finally {
          expanding.delete(defName);
        }
      }
    }

    return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, resolveNode(value)]));
  }

  return resolveNode(schemaCopy) as JsonSchema;
}

export function addKeyInDictRecursively(
  schema: JsonSchema,
  key: string,
  value: unknown,
  criteria: (schema: JsonSchema) => boolean,
): JsonSchema {
  walkSchema(schema, (node) => {
    if (criteria(node) && !(key in node)) {
      node[key] = value;
    }
  });
  return schema;
}

export function forceAdditionalPropertiesFalse<T>(schema: T): T {
  walkSchema(schema, (node) => {
    if (node.type === "object") {
      node.additionalProperties = false;
      node.properties ??= {};
      node.required ??= [];
    }
  });
  return schema;
}

export function stripUnsupportedFormats<T>(schema: T): T {
  walkSchema(schema, (node) => {
    if (typeof node.format === "string" && !OPENAI_SUPPORTED_FORMATS.has(node.format as never)) {
      delete node.format;
    }
  });
  return schema;
}

export function ensureTypeInSchemas<T>(schema: T): T {
  walkSchema(schema, (node) => {
    for (const key of ["anyOf", "oneOf"] as const) {
      const variants = node[key];
      if (!isUnknownArray(variants)) {
        continue;
      }
      for (let index = 0; index < variants.length; index += 1) {
        const variant = variants[index];
        if (isSchemaRecord(variant) && Object.keys(variant).length === 0) {
          variants[index] = { type: "object" };
        }
      }
    }
  });
  return schema;
}

export function fixDiscriminatorMappings(schema: JsonSchema): JsonSchema {
  const properties = isSchemaRecord(schema.properties) ? schema.properties : null;
  const output = properties && isSchemaRecord(properties.output) ? properties.output : null;
  const discriminator = output && isSchemaRecord(output.discriminator) ? output.discriminator : null;
  const mapping = discriminator && isSchemaRecord(discriminator.mapping) ? discriminator.mapping : null;
  if (!discriminator || !mapping) {
    return schema;
  }

  discriminator.mapping = Object.fromEntries(
    Object.entries(mapping).map(([key, value]) => [key, typeof value === "string" ? value.split("/").at(-1) : value]),
  );
  return schema;
}

export function addConstToOneOfVariants(schema: JsonSchema): JsonSchema {
  const copy = cloneSchema(schema);
  walkSchema(copy, (node) => {
    const variants = node.oneOf;
    const discriminator = isSchemaRecord(node.discriminator) ? node.discriminator : null;
    const mapping = discriminator && isSchemaRecord(discriminator.mapping) ? discriminator.mapping : null;
    const propertyName = discriminator ? discriminator.propertyName : undefined;
    if (!Array.isArray(variants) || typeof propertyName !== "string" || !mapping) {
      return;
    }

    for (const variant of variants) {
      if (!isSchemaRecord(variant) || !isSchemaRecord(variant.properties)) {
        continue;
      }
      const variantTitle = typeof variant.title === "string" ? variant.title : "";
      const match = Object.entries(mapping).find(([, schemaName]) => {
        return typeof schemaName === "string" && (variantTitle === schemaName || variantTitle.endsWith(schemaName));
      });
      if (!match) {
        continue;
      }
      const target = variant.properties[propertyName];
      if (isSchemaRecord(target)) {
        target.const = match[0];
      }
    }
  });
  return copy;
}

export function convertOneOfToAnyOf(schema: JsonSchema): JsonSchema {
  walkSchema(schema, (node) => {
    if ("oneOf" in node) {
      node.anyOf = node.oneOf;
      delete node.oneOf;
    }
  });
  return schema;
}

export function ensureAllPropertiesRequired(schema: JsonSchema): JsonSchema {
  walkSchema(schema, (node) => {
    if (node.type === "object" && isSchemaRecord(node.properties) && Object.keys(node.properties).length > 0) {
      node.required = Object.keys(node.properties);
    }
  });
  return schema;
}

export function stripNullFromTypes(schema: JsonSchema): JsonSchema {
  walkSchema(schema, (node) => {
    const anyOf = node.anyOf;
    if (Array.isArray(anyOf)) {
      const nonNull = anyOf.filter((option) => !isSchemaRecord(option) || option.type !== "null");
      if (nonNull.length === 1 && isSchemaRecord(nonNull[0])) {
        delete node.anyOf;
        Object.assign(node, nonNull[0]);
      } else if (nonNull.length > 1) {
        node.anyOf = nonNull;
      }
    }

    const typeValue = node.type;
    if (Array.isArray(typeValue) && typeValue.includes("null")) {
      const nonNullTypes = typeValue.filter((entry) => entry !== "null");
      if (nonNullTypes.length === 1) {
        node.type = nonNullTypes[0];
      } else if (nonNullTypes.length > 1) {
        node.type = nonNullTypes;
      }
    }
  });
  return schema;
}

function stripKeysRecursive<T>(schema: T, keys: readonly string[]): T {
  walkSchema(schema, (node) => {
    for (const key of keys) {
      Reflect.deleteProperty(node, key);
    }
  });
  return schema;
}

export const _strip_keys_recursive = stripKeysRecursive;

export function liftTopLevelAnyOf(schema: JsonSchema): JsonSchema {
  for (const key of ["anyOf", "oneOf", "allOf"] as const) {
    const variants = schema[key];
    if (!isUnknownArray(variants)) {
      continue;
    }
    const objectVariants = variants.filter((variant): variant is JsonSchema => {
      return isSchemaRecord(variant) && variant.type === "object";
    });
    if (objectVariants.length === 1) {
      Reflect.deleteProperty(schema, key);
      Object.assign(schema, cloneSchema(objectVariants[0]));
      break;
    }
  }
  return schema;
}

function commonStrictPipeline(params: JsonSchema): JsonSchema {
  let sanitized = resolveRefs(cloneSchema(params));
  delete sanitized.$defs;
  sanitized = convertOneOfToAnyOf(sanitized);
  sanitized = ensureTypeInSchemas(sanitized);
  sanitized = forceAdditionalPropertiesFalse(sanitized);
  sanitized = ensureAllPropertiesRequired(sanitized);
  return stripKeysRecursive(sanitized, STRICT_METADATA_KEYS);
}

export const _common_strict_pipeline = commonStrictPipeline;

export function sanitizeToolParamsForOpenAIStrict<T>(params: T): T {
  if (!isSchemaRecord(params)) {
    return params;
  }
  return stripUnsupportedFormats(commonStrictPipeline(params)) as T;
}

export function sanitizeToolParamsForAnthropicStrict<T>(params: T): T {
  if (!isSchemaRecord(params)) {
    return params;
  }
  let sanitized = liftTopLevelAnyOf(commonStrictPipeline(params));
  sanitized = stripKeysRecursive(sanitized, CLAUDE_STRICT_UNSUPPORTED);
  return stripUnsupportedFormats(sanitized) as T;
}

export function sanitizeToolParamsForBedrockStrict<T>(params: T): T {
  return sanitizeToolParamsForAnthropicStrict(params);
}

function describeValue(value: unknown): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value === null) {
    return "null";
  }
  if (typeof value === "undefined") {
    return "undefined";
  }
  if (typeof value === "symbol") {
    return value.toString();
  }
  if (typeof value === "function") {
    return value.name ? `[function ${value.name}]` : "[function]";
  }
  return JSON.stringify(value);
}

export function buildRichFieldDescription(propSchema: JsonSchema): string {
  const parts: string[] = [];

  if (typeof propSchema.description === "string" && propSchema.description.length > 0) {
    parts.push(propSchema.description);
  }
  if (typeof propSchema.format === "string" && propSchema.format.length > 0) {
    parts.push(`Format: ${propSchema.format}`);
  }
  if (Array.isArray(propSchema.enum) && propSchema.enum.length > 0) {
    parts.push(`Allowed values: [${propSchema.enum.map((value) => describeValue(value)).join(", ")}]`);
  }
  if (typeof propSchema.pattern === "string" && propSchema.pattern.length > 0) {
    parts.push(`Pattern: ${propSchema.pattern}`);
  }
  if (propSchema.minimum !== undefined) {
    parts.push(`Minimum: ${describeValue(propSchema.minimum)}`);
  }
  if (propSchema.maximum !== undefined) {
    parts.push(`Maximum: ${describeValue(propSchema.maximum)}`);
  }
  if (propSchema.minLength !== undefined) {
    parts.push(`Min length: ${describeValue(propSchema.minLength)}`);
  }
  if (propSchema.maxLength !== undefined) {
    parts.push(`Max length: ${describeValue(propSchema.maxLength)}`);
  }
  if (Array.isArray(propSchema.examples) && propSchema.examples.length > 0) {
    parts.push(`Examples: ${propSchema.examples.slice(0, 3).map((value) => describeValue(value)).join(", ")}`);
  }

  return parts.join(". ");
}

export function _inline_top_level_ref(schema: JsonSchema, rootSchema: JsonSchema = schema): JsonSchema {
  const copy = cloneSchema(schema);
  const ref = copy.$ref;
  const defName = typeof ref === "string" ? localDefName(ref) : null;
  const defs = isSchemaRecord(copy.$defs) ? copy.$defs : isSchemaRecord(rootSchema.$defs) ? rootSchema.$defs : {};
  const defSchema = defName ? defs[defName] : null;
  if (isSchemaRecord(defSchema)) {
    const resolved = cloneSchema(defSchema);
    resolved.$defs ??= defs;
    return resolved;
  }
  return copy;
}

export function _process_oneof(schema: JsonSchema): JsonSchema {
  return addConstToOneOfVariants(schema);
}

export function generateModelDescription(
  name: string,
  schema: JsonSchema,
  options: { stripNullTypes?: boolean } = {},
): ModelDescription {
  let jsonSchema = forceAdditionalPropertiesFalse(cloneSchema(schema));
  jsonSchema = stripUnsupportedFormats(jsonSchema);
  jsonSchema = ensureTypeInSchemas(jsonSchema);
  jsonSchema = resolveRefs(jsonSchema);
  delete jsonSchema.$defs;
  jsonSchema = fixDiscriminatorMappings(jsonSchema);
  jsonSchema = convertOneOfToAnyOf(jsonSchema);
  jsonSchema = ensureAllPropertiesRequired(jsonSchema);
  if (options.stripNullTypes ?? true) {
    jsonSchema = stripNullFromTypes(jsonSchema);
  }

  return {
    type: "json_schema",
    json_schema: {
      name,
      strict: true,
      schema: jsonSchema,
    },
  };
}

export const resolve_refs = resolveRefs;
export const add_key_in_dict_recursively = addKeyInDictRecursively;
export const force_additional_properties_false = forceAdditionalPropertiesFalse;
export const strip_unsupported_formats = stripUnsupportedFormats;
export const ensure_type_in_schemas = ensureTypeInSchemas;
export const fix_discriminator_mappings = fixDiscriminatorMappings;
export const add_const_to_oneof_variants = addConstToOneOfVariants;
export const convert_oneof_to_anyof = convertOneOfToAnyOf;
export const ensure_all_properties_required = ensureAllPropertiesRequired;
export const strip_null_from_types = stripNullFromTypes;
export const lift_top_level_anyof = liftTopLevelAnyOf;
export const sanitize_tool_params_for_openai_strict = sanitizeToolParamsForOpenAIStrict;
export const sanitize_tool_params_for_anthropic_strict = sanitizeToolParamsForAnthropicStrict;
export const sanitize_tool_params_for_bedrock_strict = sanitizeToolParamsForBedrockStrict;
export const build_rich_field_description = buildRichFieldDescription;
export const generate_model_description = generateModelDescription;

export function serializeModelClass(model: unknown): JsonSchema {
  if (typeof model === "function") {
    return { title: model.name || "Model", type: "object" };
  }
  if (model && typeof model === "object" && "schema" in model) {
    const schema = (model as { schema?: unknown }).schema;
    return schema && typeof schema === "object" && !Array.isArray(schema) ? schema as JsonSchema : {};
  }
  return {};
}

export const serialize_model_class = serializeModelClass;

export type SchemaModelField = {
  name: string;
  required: boolean;
  description: string | null;
  schema: JsonSchema;
  annotation?: CreatedSchemaModel;
};

export type CreatedSchemaModel = {
  name: string;
  __name__: string;
  schema: JsonSchema;
  model_fields: Record<string, SchemaModelField>;
  modelFields: Record<string, SchemaModelField>;
  modelValidate(value: unknown): unknown;
  model_validate(value: unknown): unknown;
};

type CreateModelOptions = {
  rootSchema?: JsonSchema | null;
  root_schema?: JsonSchema | null;
  modelName?: string | null;
  model_name?: string | null;
  enrichDescriptions?: boolean;
  enrich_descriptions?: boolean;
};

function coerceCreateModelOptions(value: unknown): CreateModelOptions {
  if (!isSchemaRecord(value)) {
    return {};
  }
  const options: CreateModelOptions = {};
  if (isSchemaRecord(value.rootSchema)) {
    options.rootSchema = value.rootSchema;
  }
  if (isSchemaRecord(value.root_schema)) {
    options.root_schema = value.root_schema;
  }
  if (typeof value.modelName === "string") {
    options.modelName = value.modelName;
  }
  if (typeof value.model_name === "string") {
    options.model_name = value.model_name;
  }
  if (typeof value.enrichDescriptions === "boolean") {
    options.enrichDescriptions = value.enrichDescriptions;
  }
  if (typeof value.enrich_descriptions === "boolean") {
    options.enrich_descriptions = value.enrich_descriptions;
  }
  return options;
}

function createValidationError(path: string, message: string): Error {
  return new Error(`${path}: ${message}`);
}

function schemaTypeMatches(schema: JsonSchema, expected: string): boolean {
  return schema.type === expected || (Array.isArray(schema.type) && schema.type.includes(expected));
}

function numericConstraint(schema: JsonSchema, key: string): number | null {
  const value = schema[key];
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

function isValidDateString(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isValidTimeString(value: string): boolean {
  const match = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(value);
  if (!match) {
    return false;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] === undefined ? 0 : Number(match[3]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59;
}

function assertStringFormat(schema: JsonSchema, value: string, path: string): void {
  if (schema.format === "date" && !isValidDateString(value)) {
    throw createValidationError(path, "format date");
  }
  if (schema.format === "date-time" && Number.isNaN(Date.parse(value))) {
    throw createValidationError(path, "format date-time");
  }
  if (schema.format === "time" && !isValidTimeString(value)) {
    throw createValidationError(path, "format time");
  }
}

function isDateFormatSchema(schema: JsonSchema): boolean {
  return schema.format === "date" || schema.format === "date-time";
}

function assertStringConstraints(schema: JsonSchema, value: string, path: string): void {
  assertStringFormat(schema, value, path);
  const minLength = numericConstraint(schema, "minLength");
  if (minLength !== null && value.length < minLength) {
    throw createValidationError(path, `minLength ${String(minLength)}`);
  }
  const maxLength = numericConstraint(schema, "maxLength");
  if (maxLength !== null && value.length > maxLength) {
    throw createValidationError(path, `maxLength ${String(maxLength)}`);
  }
  if (typeof schema.pattern === "string" && !(new RegExp(schema.pattern).test(value))) {
    throw createValidationError(path, `pattern ${schema.pattern}`);
  }
}

function assertNumberConstraints(schema: JsonSchema, value: number, path: string): void {
  const minimum = numericConstraint(schema, "minimum");
  if (minimum !== null && value < minimum) {
    throw createValidationError(path, `minimum ${String(minimum)}`);
  }
  const exclusiveMinimum = numericConstraint(schema, "exclusiveMinimum");
  if (exclusiveMinimum !== null && value <= exclusiveMinimum) {
    throw createValidationError(path, `exclusiveMinimum ${String(exclusiveMinimum)}`);
  }
  const maximum = numericConstraint(schema, "maximum");
  if (maximum !== null && value > maximum) {
    throw createValidationError(path, `maximum ${String(maximum)}`);
  }
  const exclusiveMaximum = numericConstraint(schema, "exclusiveMaximum");
  if (exclusiveMaximum !== null && value >= exclusiveMaximum) {
    throw createValidationError(path, `exclusiveMaximum ${String(exclusiveMaximum)}`);
  }
  const multipleOf = numericConstraint(schema, "multipleOf");
  if (multipleOf !== null && multipleOf !== 0 && Math.abs(value / multipleOf - Math.round(value / multipleOf)) > Number.EPSILON) {
    throw createValidationError(path, `multipleOf ${String(multipleOf)}`);
  }
}

function effectiveSchema(schema: JsonSchema, rootSchema: JsonSchema): JsonSchema {
  if (typeof schema.$ref === "string") {
    const resolved = _resolve_ref(schema.$ref, rootSchema);
    if (isSchemaRecord(schema.$defs) && !("$defs" in resolved)) {
      resolved.$defs = schema.$defs;
    }
    return resolved;
  }
  if (Array.isArray(schema.allOf)) {
    return _merge_all_of_schemas(schema.allOf.filter(isSchemaRecord), rootSchema);
  }
  return schema;
}

const SUPPORTED_SCHEMA_TYPES = new Set(["null", "string", "integer", "number", "boolean", "array", "object"]);

function validateSupportedSchemaTypes(
  schema: JsonSchema,
  rootSchema: JsonSchema,
  seen = new WeakSet<object>(),
  seenRefs = new Set<string>(),
): void {
  if (seen.has(schema)) {
    return;
  }
  seen.add(schema);
  if (typeof schema.$ref === "string") {
    if (seenRefs.has(schema.$ref)) {
      return;
    }
    const nextSeenRefs = new Set(seenRefs);
    nextSeenRefs.add(schema.$ref);
    validateSupportedSchemaTypes(_resolve_ref(schema.$ref, rootSchema), rootSchema, seen, nextSeenRefs);
    return;
  }
  const resolved = effectiveSchema(schema, rootSchema);
  if (resolved !== schema) {
    validateSupportedSchemaTypes(resolved, rootSchema, seen, seenRefs);
    return;
  }

  const typeValue = resolved.type;
  if (typeof typeValue === "string" && !SUPPORTED_SCHEMA_TYPES.has(typeValue)) {
    throw new Error(`Unsupported JSON schema type: ${typeValue} from ${JSON.stringify(resolved)}`);
  }
  if (Array.isArray(typeValue)) {
    for (const entry of typeValue) {
      if (typeof entry === "string" && !SUPPORTED_SCHEMA_TYPES.has(entry)) {
        throw new Error(`Unsupported JSON schema type: ${entry} from ${JSON.stringify(resolved)}`);
      }
    }
  }

  for (const key of ["anyOf", "oneOf", "allOf"] as const) {
    const variants = resolved[key];
    if (!Array.isArray(variants)) {
      continue;
    }
    for (const variant of variants) {
      if (isSchemaRecord(variant)) {
        validateSupportedSchemaTypes(variant, rootSchema, seen, seenRefs);
      }
    }
  }
  if (isSchemaRecord(resolved.items)) {
    validateSupportedSchemaTypes(resolved.items, rootSchema, seen, seenRefs);
  }
  if (isSchemaRecord(resolved.properties)) {
    for (const value of Object.values(resolved.properties)) {
      if (isSchemaRecord(value)) {
        validateSupportedSchemaTypes(value, rootSchema, seen, seenRefs);
      }
    }
  }
}

function validateSchemaValue(schema: JsonSchema, value: unknown, path: string, rootSchema: JsonSchema, seen = new Set<JsonSchema>()): unknown {
  const resolved = effectiveSchema(schema, rootSchema);
  if (seen.has(resolved)) {
    return value;
  }
  const nextSeen = new Set(seen);
  nextSeen.add(resolved);

  const variants = Array.isArray(resolved.anyOf)
    ? resolved.anyOf
    : Array.isArray(resolved.oneOf) ? resolved.oneOf : null;
  if (variants) {
    const errors: string[] = [];
    for (const variant of variants) {
      if (!isSchemaRecord(variant)) {
        continue;
      }
      try {
        return validateSchemaValue(variant, value, path, rootSchema, nextSeen);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    throw createValidationError(path, `value did not match any schema${errors.length > 0 ? ` (${errors.join("; ")})` : ""}`);
  }

  if ("const" in resolved && value !== resolved.const) {
    throw createValidationError(path, `expected const ${describeValue(resolved.const)}`);
  }
  if (Array.isArray(resolved.enum) && !resolved.enum.includes(value)) {
    throw createValidationError(path, `expected one of ${resolved.enum.map((entry) => describeValue(entry)).join(", ")}`);
  }

  const typeValue = resolved.type;
  if (Array.isArray(typeValue)) {
    const errors: string[] = [];
    for (const type of typeValue) {
      if (typeof type !== "string") {
        continue;
      }
      try {
        return validateSchemaValue({ ...resolved, type }, value, path, rootSchema, nextSeen);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    throw createValidationError(path, `value did not match any declared type${errors.length > 0 ? ` (${errors.join("; ")})` : ""}`);
  }

  switch (typeValue) {
    case undefined:
      return value;
    case "null":
      if (value !== null) {
        throw createValidationError(path, "expected null");
      }
      return null;
    case "string":
      if (value instanceof Date && isDateFormatSchema(resolved)) {
        if (Number.isNaN(value.getTime())) {
          throw createValidationError(path, `format ${String(resolved.format)}`);
        }
        return value;
      }
      if (typeof value !== "string") {
        throw createValidationError(path, "expected string");
      }
      assertStringConstraints(resolved, value, path);
      return value;
    case "integer":
      if (typeof value !== "number" || !Number.isInteger(value)) {
        throw createValidationError(path, "expected integer");
      }
      assertNumberConstraints(resolved, value, path);
      return value;
    case "number":
      if (typeof value !== "number" || Number.isNaN(value)) {
        throw createValidationError(path, "expected number");
      }
      assertNumberConstraints(resolved, value, path);
      return value;
    case "boolean":
      if (typeof value !== "boolean") {
        throw createValidationError(path, "expected boolean");
      }
      return value;
    case "array": {
      if (!Array.isArray(value)) {
        throw createValidationError(path, "expected array");
      }
      const itemSchema = isSchemaRecord(resolved.items) ? resolved.items : null;
      const items: unknown[] = value;
      return itemSchema ? items.map((item, index) => validateSchemaValue(itemSchema, item, `${path}.${String(index)}`, rootSchema, nextSeen)) : items.slice();
    }
    case "object": {
      if (!isSchemaRecord(value)) {
        throw createValidationError(path, "expected object");
      }
      const properties = isSchemaRecord(resolved.properties) ? resolved.properties : null;
      if (!properties) {
        return { ...value };
      }
      if (resolved.additionalProperties === false) {
        for (const key of Object.keys(value)) {
          if (!(key in properties)) {
            throw createValidationError(`${path}.${key}`, "extra field not permitted");
          }
        }
      }
      const required = Array.isArray(resolved.required) ? resolved.required.filter((entry): entry is string => typeof entry === "string") : [];
      const output: Record<string, unknown> = {};
      for (const [propertyName, propertySchema] of Object.entries(properties)) {
        if (!isSchemaRecord(propertySchema)) {
          continue;
        }
        if (!(propertyName in value)) {
          if (required.includes(propertyName)) {
            throw createValidationError(`${path}.${propertyName}`, "field required");
          }
          output[propertyName] = null;
          continue;
        }
        output[propertyName] = validateSchemaValue(propertySchema, value[propertyName], `${path}.${propertyName}`, rootSchema, nextSeen);
      }
      return output;
    }
    default:
      throw new Error(`Unsupported JSON schema type: ${String(typeValue)}`);
  }
}

function buildModelFields(schema: JsonSchema, rootSchema: JsonSchema, enrichDescriptions: boolean): Record<string, SchemaModelField> {
  const properties = isSchemaRecord(schema.properties) ? schema.properties : {};
  const required = Array.isArray(schema.required) ? schema.required.filter((entry): entry is string => typeof entry === "string") : [];
  const fields: Record<string, SchemaModelField> = {};
  for (const [name, propertySchema] of Object.entries(properties)) {
    if (!isSchemaRecord(propertySchema)) {
      continue;
    }
    const resolved = effectiveSchema(propertySchema, rootSchema);
    const description = enrichDescriptions
      ? buildRichFieldDescription(resolved)
      : typeof resolved.description === "string" ? resolved.description : null;
    const field: SchemaModelField = {
      name,
      required: required.includes(name),
      description,
      schema: resolved,
    };
    if (typeof propertySchema.$ref !== "string" && schemaTypeMatches(resolved, "object") && isSchemaRecord(resolved.properties)) {
      field.annotation = createModelFromSchema(resolved, {
        rootSchema,
        modelName: typeof resolved.title === "string" ? resolved.title : `${name[0]?.toUpperCase() ?? "Nested"}${name.slice(1)}`,
        enrichDescriptions,
      });
    }
    fields[name] = field;
  }
  return fields;
}

export function createModelFromSchema(
  schemaOrName: JsonSchema | string,
  schemaOrOptions: JsonSchema | CreateModelOptions = {},
  maybeOptions: CreateModelOptions = {},
): CreatedSchemaModel {
  let schema: JsonSchema;
  let options: CreateModelOptions;
  let explicitModelName: string | null;
  if (typeof schemaOrName === "string") {
    explicitModelName = schemaOrName;
    schema = isSchemaRecord(schemaOrOptions) ? schemaOrOptions : {};
    options = maybeOptions;
  } else {
    explicitModelName = null;
    schema = schemaOrName;
    options = coerceCreateModelOptions(schemaOrOptions);
  }
  const modelName: string = explicitModelName
    ?? options.modelName
    ?? options.model_name
    ?? (typeof schema.title === "string" ? schema.title : "DynamicModel");
  const enrichDescriptions = options.enrichDescriptions ?? options.enrich_descriptions ?? false;
  const rootSchema = forceAdditionalPropertiesFalse(cloneSchema(options.rootSchema ?? options.root_schema ?? schema));
  const resolvedSchema = forceAdditionalPropertiesFalse(_inline_top_level_ref(cloneSchema(schema), rootSchema));
  const normalizedSchema = Array.isArray(resolvedSchema.allOf) ? _merge_all_of_schemas(resolvedSchema.allOf.filter(isSchemaRecord), resolvedSchema) : resolvedSchema;
  const effectiveRoot = isSchemaRecord(normalizedSchema.$defs) ? normalizedSchema : rootSchema;
  validateSupportedSchemaTypes(normalizedSchema, effectiveRoot);
  const modelFields = buildModelFields(normalizedSchema, effectiveRoot, enrichDescriptions);
  return {
    name: modelName,
    __name__: modelName,
    schema: normalizedSchema,
    model_fields: modelFields,
    modelFields,
    modelValidate(value: unknown): unknown {
      return validateSchemaValue(normalizedSchema, value, modelName, effectiveRoot);
    },
    model_validate(value: unknown): unknown {
      return this.modelValidate(value);
    },
  };
}

export const create_model_from_schema = createModelFromSchema;

export function _resolve_ref(ref: string, rootSchema: JsonSchema): JsonSchema {
  const defName = localDefName(ref);
  const defs = isSchemaRecord(rootSchema.$defs) ? rootSchema.$defs : {};
  const defSchema = defName ? defs[defName] : null;
  if (!isSchemaRecord(defSchema)) {
    throw new Error(`Definition '${defName ?? ref}' not found in $defs.`);
  }
  return cloneSchema(defSchema);
}

export function _merge_all_of_schemas(schemas: readonly JsonSchema[], rootSchema: JsonSchema = {}): JsonSchema {
  const merged: JsonSchema = { type: "object", properties: {}, required: [] };
  const requiredValues = (value: unknown): string[] => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
  for (const schema of schemas) {
    const resolved = typeof schema.$ref === "string" ? _resolve_ref(schema.$ref, rootSchema) : schema;
    Object.assign(merged, cloneSchema(resolved), {
      properties: {
        ...(isSchemaRecord(merged.properties) ? merged.properties : {}),
        ...(isSchemaRecord(resolved.properties) ? resolved.properties : {}),
      },
      required: [...requiredValues(merged.required), ...requiredValues(resolved.required)],
    });
  }
  merged.required = [...new Set(requiredValues(merged.required))];
  return merged;
}

export function _json_schema_to_pydantic_type(schema: JsonSchema): string {
  const typeValue = schema.type;
  if (typeof typeValue === "string") {
    return typeValue;
  }
  if (Array.isArray(typeValue)) {
    return typeValue.filter((entry) => typeof entry === "string").join(" | ") || "unknown";
  }
  return "unknown";
}

export function _json_schema_to_pydantic_field(name: string, schema: JsonSchema, required: readonly string[] = []): {
  name: string;
  type: string;
  required: boolean;
  schema: JsonSchema;
} {
  return {
    name,
    type: _json_schema_to_pydantic_type(schema),
    required: required.includes(name),
    schema,
  };
}

export function _build_model_from_schema(schema: JsonSchema, _effectiveRoot: JsonSchema = schema, options: { model_name?: string | null } = {}): ReturnType<typeof createModelFromSchema> {
  void _effectiveRoot;
  return createModelFromSchema(options.model_name ?? (typeof schema.title === "string" ? schema.title : "DynamicModel"), schema);
}
