import { createHash } from "node:crypto";

export type InterpolationValue =
  | string
  | number
  | boolean
  | null
  | readonly InterpolationValue[]
  | { readonly [key: string]: InterpolationValue };

const variablePattern = /\{([A-Za-z_][A-Za-z0-9_-]*)\}/g;
const quotePattern = /['"]+/g;
const camelUpperLowerPattern = /([A-Z]+)([A-Z][a-z])/g;
const camelLowerUpperPattern = /([a-z])([A-Z])/g;
const disallowedCharsPattern = /[^a-zA-Z0-9]+/g;
const duplicateUnderscorePattern = /_+/g;
const maxToolNameLength = 64;

export function sanitizeToolName(name: string, maxLength = maxToolNameLength): string {
  let normalized = normalizeAscii(name);
  normalized = normalized.replace(camelUpperLowerPattern, "$1_$2");
  normalized = normalized.replace(camelLowerUpperPattern, "$1_$2");
  normalized = normalized.toLowerCase();
  normalized = normalized.replace(quotePattern, "");
  normalized = normalized.replace(disallowedCharsPattern, "_");
  normalized = normalized.replace(duplicateUnderscorePattern, "_");
  normalized = normalized.replace(/^_+|_+$/g, "");

  if (normalized.length > maxLength) {
    const hash = createHash("sha256").update(normalized).digest("hex").slice(0, 8);
    const suffix = `_${hash}`;
    normalized = `${normalized.slice(0, maxLength - suffix.length).replace(/_+$/g, "")}${suffix}`;
  }

  return normalized;
}

export const sanitize_tool_name = sanitizeToolName;

export function slugify(text: string, separator = "_"): string {
  let normalized = normalizeAscii(text);
  normalized = normalized.toLowerCase();
  normalized = normalized.replace(quotePattern, "");
  normalized = normalized.replace(disallowedCharsPattern, separator);
  normalized = normalized.replace(_duplicate_separator_pattern(separator), separator);
  return trimSeparator(normalized, separator);
}

export function _duplicate_separator_pattern(separator: string): RegExp {
  return new RegExp(`(?:${escapeRegExp(separator)}){2,}`, "g");
}

export function interpolateOnly(
  inputString: string | null | undefined,
  inputs: Record<string, unknown>,
  options: { strictMissing?: boolean } = {},
): string {
  const strictMissing = options.strictMissing ?? true;
  validateInterpolationInputs(inputs);

  if (!inputString) {
    return "";
  }
  if (!inputString.includes("{") && !inputString.includes("}")) {
    return inputString;
  }
  if (strictMissing && Object.keys(inputs).length === 0) {
    throw new Error("Inputs dictionary cannot be empty when interpolating variables");
  }

  const variables = [...inputString.matchAll(variablePattern)].map((match) => match[1]).filter((key): key is string => Boolean(key));
  const missingVariable = variables.find((variable) => !(variable in inputs));
  if (strictMissing && missingVariable) {
    throw new Error(`Template variable '${missingVariable}' not found in inputs dictionary`);
  }

  return inputString.replace(variablePattern, (placeholder, variable: string) => {
    if (!(variable in inputs)) {
      return placeholder;
    }
    return stringifyInterpolationValue(inputs[variable]);
  });
}

export const interpolate_only = interpolateOnly;

function validateInterpolationInputs(inputs: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(inputs)) {
    try {
      validateInterpolationValue(value);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid value for key '${key}': ${message}`, { cause: error });
    }
  }
}

export function _validate_type(value: unknown): void {
  if (
    value === null
    || typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean"
  ) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(_validate_type);
    return;
  }
  if (value && typeof value === "object" && isPlainObject(value)) {
    Object.values(value).forEach(_validate_type);
    return;
  }
  throw new Error(
    `Unsupported type ${typeName(value)} in inputs. Only str, int, float, bool, dict, and list are allowed.`,
  );
}

const validateInterpolationValue = _validate_type;

function stringifyInterpolationValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null) {
    return "null";
  }
  return JSON.stringify(value);
}

function normalizeAscii(value: string): string {
  const decomposed = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  let ascii = "";
  for (let index = 0; index < decomposed.length; index += 1) {
    const char = decomposed[index];
    if (char && char.charCodeAt(0) <= 127) {
      ascii += char;
    }
  }
  return ascii;
}

function trimSeparator(value: string, separator: string): string {
  if (!separator) {
    return value;
  }
  const escapedSeparator = escapeRegExp(separator);
  return value.replace(new RegExp(`^(?:${escapedSeparator})+|(?:${escapedSeparator})+$`, "g"), "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isPlainObject(value: object): boolean {
  return Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null;
}

function typeName(value: unknown): string {
  if (value === null) {
    return "NoneType";
  }
  if (value && typeof value === "object") {
    return value.constructor.name;
  }
  return typeof value;
}
