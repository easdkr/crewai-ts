import { execFileSync } from "node:child_process";

const raw = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
  cwd: new URL("..", import.meta.url),
  encoding: "utf8",
});
const [pack] = JSON.parse(raw);
const summary = {
  name: pack.name,
  version: pack.version,
  size: pack.size,
  unpackedSize: pack.unpackedSize,
  files: pack.files?.length ?? 0,
};

if (summary.name !== "@crewai-ts/openai") {
  throw new Error(`Unexpected package name: ${summary.name}`);
}
if (summary.unpackedSize > 800_000) {
  throw new Error(`OpenAI package is unexpectedly large: ${summary.unpackedSize}`);
}

console.log(JSON.stringify(summary, null, 2));
