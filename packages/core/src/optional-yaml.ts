import { createRequire } from "node:module";

type YamlModule = {
  parse: (source: string) => unknown;
  stringify: (value: unknown) => string;
};

const requireModule = createRequire(import.meta.url);
let cachedYaml: YamlModule | null = null;

export function loadOptionalYaml(): YamlModule {
  if (cachedYaml) {
    return cachedYaml;
  }
  try {
    cachedYaml = requireModule("yaml") as YamlModule;
    return cachedYaml;
  } catch (error) {
    throw new Error(
      "YAML support is optional in @crewai-ts/core. Install yaml, @crewai-ts/flow, or the feature package that owns your YAML-based workflow.",
      { cause: error },
    );
  }
}

export function parseYaml(source: string): unknown {
  return loadOptionalYaml().parse(source);
}

export function stringifyYaml(value: unknown): string {
  return loadOptionalYaml().stringify(value);
}
