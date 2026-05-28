export type MethodKind =
  | "agent"
  | "task"
  | "crew"
  | "beforeKickoff"
  | "afterKickoff"
  | "tool"
  | "llm"
  | "callback"
  | "outputJson"
  | "outputPydantic"
  | "cacheHandler";

export type MethodEntry = {
  name: string | symbol;
  kind: MethodKind;
};

export type Constructor = abstract new (...args: never[]) => object;

const metadata = new WeakMap<Constructor, MethodEntry[]>();

export function registerCrewMethod(target: object, entry: MethodEntry): void {
  const ctor = target.constructor as Constructor;
  const entries = metadata.get(ctor) ?? [];
  entries.push(entry);
  metadata.set(ctor, entries);
}

export function initializeCrewMetadata(constructor: Constructor): void {
  metadata.set(constructor, metadata.get(constructor) ?? []);
}

export function getCrewMetadata(instanceOrConstructor: object | Constructor): readonly MethodEntry[] {
  const ctor =
    typeof instanceOrConstructor === "function"
      ? instanceOrConstructor as Constructor
      : instanceOrConstructor.constructor as Constructor;
  const inherited: MethodEntry[] = [];
  let current: Constructor | null = ctor;
  while (current && current !== Function.prototype.constructor) {
    inherited.unshift(...(metadata.get(current) ?? []));
    const prototype = Object.getPrototypeOf(current.prototype) as object | null;
    current = prototype ? prototype.constructor as Constructor : null;
  }

  const seen = new Set<string>();
  return inherited.filter((entry) => {
    const key = `${String(entry.name)}:${entry.kind}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
