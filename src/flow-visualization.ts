import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

export const CREWAI_ORANGE = "#FF5A50";
export const DARK_GRAY = "#333333";
export const WHITE = "#FFFFFF";
export const GRAY = "#666666";
export const BG_DARK = "#0d1117";
export const BG_CARD = "#161b22";
export const BORDER_SUBTLE = "#30363d";
export const TEXT_PRIMARY = "#e6edf3";
export const TEXT_SECONDARY = "#7d8590";

export class CSSExtension {
  readonly tags = new Set(["css"]);

  parse(parser: ExtensionParserLike): ExtensionParseResult {
    const lineno = readParserLineno(parser);
    const href = String(parser.parse_expression());
    return {
      lineno,
      method: "_render_css",
      args: [href],
      html: this._render_css(href),
    };
  }

  renderCss(href: string): string {
    return `<link rel="stylesheet" href="${escapeHtml(href)}">`;
  }

  _render_css(href: string): string {
    return this.renderCss(href);
  }
}

export class JSExtension {
  readonly tags = new Set(["js"]);

  parse(parser: ExtensionParserLike): ExtensionParseResult {
    const lineno = readParserLineno(parser);
    const src = String(parser.parse_expression());
    return {
      lineno,
      method: "_render_js",
      args: [src],
      html: this._render_js(src),
    };
  }

  renderJs(src: string): string {
    return `<script src="${escapeHtml(src)}"></script>`;
  }

  _render_js(src: string): string {
    return this.renderJs(src);
  }
}

export type ExtensionParserLike = {
  stream: Iterator<{ lineno?: number }> | Iterable<{ lineno?: number }> | readonly { lineno?: number }[];
  parse_expression: () => unknown;
};

export type ExtensionParseResult = {
  lineno: number;
  method: "_render_css" | "_render_js";
  args: readonly string[];
  html: string;
};

export type FlowVisualizationNodeMetadata = {
  type?: string;
  condition_type?: string | null;
  conditionType?: string | null;
  trigger_methods?: readonly string[];
  triggerMethods?: readonly string[];
  router_paths?: readonly string[];
  routerPaths?: readonly string[];
};
export const NodeMetadata = Object.freeze({ kind: "NodeMetadata" });

export type FlowVisualizationEdge = {
  source: string;
  target: string;
  condition_type?: string | null;
  conditionType?: string | null;
  is_router_path?: boolean;
  isRouterPath?: boolean;
  router_path_label?: string | null;
  routerPathLabel?: string | null;
};
export const StructureEdge = Object.freeze({ kind: "StructureEdge" });

export type FlowStructureLike = {
  nodes?: Record<string, FlowVisualizationNodeMetadata>;
  edges?: readonly FlowVisualizationEdge[];
  start_methods?: readonly string[];
  startMethods?: readonly string[];
};

export type NodePosition = {
  level: number;
  x: number;
  y: number;
};

export function calculateNodePositions(dag: FlowStructureLike): Record<string, NodePosition> {
  const nodes = dag.nodes ?? {};
  const edges = dag.edges ?? [];
  const startMethods = dag.start_methods ?? dag.startMethods ?? [];
  const nodeNames = Object.keys(nodes);
  const children = Object.fromEntries(nodeNames.map((name) => [name, [] as string[]]));
  const parents = Object.fromEntries(nodeNames.map((name) => [name, [] as string[]]));

  for (const edge of edges) {
    if (edge.source in children && edge.target in children) {
      children[edge.source]?.push(edge.target);
      parents[edge.target]?.push(edge.source);
    }
  }

  const levels: Record<string, number> = {};
  const queue: Array<[string, number]> = [];
  for (const startMethod of startMethods) {
    if (startMethod in nodes) {
      levels[startMethod] = 0;
      queue.push([startMethod, 0]);
    }
  }

  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const [node, level] = current;
    if (visited.has(node)) {
      continue;
    }
    visited.add(node);
    levels[node] = Math.max(levels[node] ?? level, level);
    for (const child of children[node] ?? []) {
      const childLevel = level + 1;
      levels[child] = Math.max(levels[child] ?? childLevel, childLevel);
      queue.push([child, childLevel]);
    }
  }

  for (const name of nodeNames) {
    levels[name] ??= 0;
  }

  const nodesByLevel = new Map<number, string[]>();
  for (const [node, level] of Object.entries(levels)) {
    const group = nodesByLevel.get(level) ?? [];
    group.push(node);
    nodesByLevel.set(level, group);
  }

  const positions: Record<string, NodePosition> = {};
  const levelSeparation = 300;
  const nodeSpacing = 400;
  for (const [level, nodesAtLevel] of [...nodesByLevel.entries()].sort((left, right) => left[0] - right[0])) {
    const y = level * levelSeparation;
    if (level === 0) {
      const count = nodesAtLevel.length;
      nodesAtLevel.forEach((node, index) => {
        positions[node] = { level, x: (index - (count - 1) / 2) * nodeSpacing, y };
      });
      continue;
    }
    nodesAtLevel.forEach((node, index) => {
      const parentPositions = (parents[node] ?? []).map((parent) => positions[parent]?.x).filter(isNumber);
      const x = parentPositions.length > 0
        ? parentPositions.reduce((sum, parentX) => sum + parentX, 0) / parentPositions.length
        : index * nodeSpacing * 0.5;
      positions[node] = { level, x, y };
    });
    const sorted = [...nodesAtLevel].sort((left, right) => (positions[left]?.x ?? 0) - (positions[right]?.x ?? 0));
    for (let index = 0; index < sorted.length - 1; index += 1) {
      const current = sorted[index];
      const next = sorted[index + 1];
      if (!current || !next || !positions[current] || !positions[next]) {
        continue;
      }
      const minSpacing = nodeSpacing * 0.6;
      if (positions[next].x - positions[current].x < minSpacing) {
        positions[next] = { ...positions[next], x: positions[current].x + minSpacing };
      }
    }
  }

  return positions;
}

export const calculate_node_positions = calculateNodePositions;

export function renderInteractive(dag: FlowStructureLike, filename = "flow_dag.html", show = true): string {
  void show;
  const nodes = dag.nodes ?? {};
  const edges = dag.edges ?? [];
  const positions = calculateNodePositions(dag);
  const tempDir = mkdtempSync(join(tmpdir(), "crewai_flow_"));
  const outputPath = join(tempDir, basename(filename));
  const graphJson = JSON.stringify({ nodes, edges, positions }, null, 2);

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>CrewAI Flow</title>
  <style>
    body { margin: 0; background: ${BG_DARK}; color: ${TEXT_PRIMARY}; font-family: Inter, system-ui, sans-serif; }
    main { padding: 24px; }
    h1 { font-size: 18px; margin: 0 0 16px; }
    .canvas { position: relative; min-height: 520px; border: 1px solid ${BORDER_SUBTLE}; background: ${BG_CARD}; overflow: auto; }
    .node { position: absolute; min-width: 140px; padding: 10px 12px; border: 2px solid ${CREWAI_ORANGE}; border-radius: 6px; background: ${WHITE}; color: ${DARK_GRAY}; transform: translate(420px, 80px); }
    .node small { color: ${GRAY}; text-transform: uppercase; display: block; margin-top: 4px; }
    pre { color: ${TEXT_SECONDARY}; white-space: pre-wrap; }
  </style>
</head>
<body>
  <main>
    <h1>CrewAI Flow</h1>
    <section class="canvas">
      ${Object.entries(nodes).map(([name, metadata]) => renderNode(name, metadata, positions[name])).join("\n")}
    </section>
    <pre>${escapeHtml(graphJson)}</pre>
  </main>
</body>
</html>
`;
  writeFileSync(outputPath, html, "utf8");
  return outputPath;
}

export const render_interactive = renderInteractive;

function renderNode(name: string, metadata: FlowVisualizationNodeMetadata, position: NodePosition | undefined): string {
  const x = Math.round(position?.x ?? 0);
  const y = Math.round(position?.y ?? 0);
  const type = metadata.type ?? "listen";
  return `<div class="node" style="left:${String(x)}px;top:${String(y)}px"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(type)}</small></div>`;
}

function readParserLineno(parser: ExtensionParserLike): number {
  const stream = parser.stream;
  if (isParserTokenArray(stream)) {
    return stream[0]?.lineno ?? 0;
  }
  const iterator = isParserTokenIterable(stream)
    ? stream[Symbol.iterator]()
    : stream;
  const next = iterator.next();
  return next.done === true ? 0 : next.value.lineno ?? 0;
}

function isParserTokenArray(value: ExtensionParserLike["stream"]): value is readonly { lineno?: number }[] {
  return Array.isArray(value);
}

function isParserTokenIterable(value: ExtensionParserLike["stream"]): value is Iterable<{ lineno?: number }> {
  return !isParserTokenArray(value) && Symbol.iterator in Object(value);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
