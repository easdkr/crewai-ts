import { execFileSync } from "node:child_process";

const raw = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
  cwd: new URL("..", import.meta.url),
  encoding: "utf8",
});
const [pack] = JSON.parse(raw);
const files = pack.files.map((file) => file.path);
const manifestText = execFileSync("node", ["-e", "console.log(JSON.stringify(require('./package.json')))"], {
  cwd: new URL("..", import.meta.url),
  encoding: "utf8",
});
const manifest = JSON.parse(manifestText);
const dependencies = {
  ...(manifest.dependencies ?? {}),
  ...(manifest.peerDependencies ?? {}),
  ...(manifest.optionalDependencies ?? {}),
};

for (const forbidden of ["pdf-parse", "@modelcontextprotocol/sdk", "@crewai-ts/rag", "@crewai-ts/mcp", "@crewai-ts/a2a", "@crewai-ts/flow"]) {
  if (Object.prototype.hasOwnProperty.call(dependencies, forbidden)) {
    throw new Error(`@crewai-ts/gemini must not depend on ${forbidden}`);
  }
}

if (!Object.prototype.hasOwnProperty.call(dependencies, "@crewai-ts/core")) {
  throw new Error("@crewai-ts/gemini must depend on @crewai-ts/core");
}

if (!files.includes("dist/index.js") || !files.includes("dist/index.d.ts")) {
  throw new Error("@crewai-ts/gemini pack output is missing dist index artifacts");
}

console.log(JSON.stringify({
  name: pack.name,
  version: pack.version,
  size: pack.size,
  unpackedSize: pack.unpackedSize,
  files: files.length,
}, null, 2));
