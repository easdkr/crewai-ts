import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcePath = join(root, "examples", "gemini-crew.ts");
const workspace = join(tmpdir(), "crewai-ts-gemini-demo");
const outputPath = join(workspace, "gemini-crew.mjs");

rmSync(workspace, { force: true, recursive: true });
mkdirSync(workspace, { recursive: true });

const distImport = pathToFileURL(join(root, "dist", "index.js")).href;
const source = readFileSync(sourcePath, "utf8")
  .replace('from "../dist/index.js";', `from "${distImport}";`);

const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2024,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    useDefineForClassFields: true,
  },
  fileName: sourcePath.replace(/\.ts$/, ".mts"),
  reportDiagnostics: true,
});

const diagnostics = transpiled.diagnostics ?? [];
if (diagnostics.length > 0) {
  const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => root,
    getNewLine: () => "\n",
  });
  throw new Error(formatted);
}

writeFileSync(outputPath, transpiled.outputText);
await import(pathToFileURL(outputPath).href);
