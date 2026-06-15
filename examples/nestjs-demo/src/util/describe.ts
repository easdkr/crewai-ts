import type { LLMSupply } from "@crewai-ts/nestjs";

/**
 * Human-readable, **secret-safe** description of an `LLMSupply`. Reads only the
 * public `model` field and constructor name — never the API key held inside a
 * provider client.
 */
export function describeSupply(supply: LLMSupply): string {
  if (supply === null || supply === undefined) return "null";
  if (typeof supply === "string") return `string:${supply}`;
  if (typeof supply === "function") return "function-llm";
  const model = (supply as { model?: unknown }).model;
  const name = (supply as { constructor?: { name?: string } }).constructor?.name ?? "object";
  return typeof model === "string" ? `client:${name}(${model})` : `client:${name}`;
}
