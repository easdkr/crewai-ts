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

export function createModelFromSchema(name: string, schema: JsonSchema): { name: string; schema: JsonSchema; modelValidate(value: unknown): unknown; model_validate(value: unknown): unknown } {
  return {
    name,
    schema,
    modelValidate: (value: unknown) => value,
    model_validate(value: unknown): unknown {
      return this.modelValidate(value);
    },
  };
}

export const create_model_from_schema = createModelFromSchema;
