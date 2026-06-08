export function processConfig(
  values: Record<string, unknown>,
  modelClass: { modelFields?: Record<string, unknown>; model_fields?: Record<string, unknown> },
): Record<string, unknown> {
  const config = values.config;
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return values;
  }
  const fields = modelClass.modelFields ?? modelClass.model_fields ?? {};
  for (const [key, value] of Object.entries(config as Record<string, unknown>)) {
    if (!(key in fields) || values[key] !== undefined && values[key] !== null) {
      continue;
    }
    if (isPlainRecord(value) && isPlainRecord(values[key])) {
      values[key] = { ...(values[key] as Record<string, unknown>), ...value };
    } else {
      values[key] = value;
    }
  }
  delete values.config;
  return values;
}

export const process_config = processConfig;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
