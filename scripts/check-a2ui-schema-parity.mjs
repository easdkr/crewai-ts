#!/usr/bin/env node
/* global console, process */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { load_schema } from "../dist/index.js";

const upstream = process.env.UPSTREAM_CREWAI_SRC ?? "/tmp/crewai-upstream-current/lib/crewai/src/crewai";
const schemaRoot = join(upstream, "a2a", "extensions", "a2ui", "schema");
const specs = {
  "v0.8": ["server_to_client", "client_to_server", "standard_catalog_definition", "server_to_client_with_standard_catalog"],
  "v0.9": ["server_to_client", "client_to_server", "common_types", "basic_catalog", "client_capabilities", "server_capabilities", "client_data_model"],
};

let missing = 0;
for (const [version, names] of Object.entries(specs)) {
  const dir = version.replace(".", "_");
  for (const name of names) {
    const upstreamSchema = JSON.parse(readFileSync(join(schemaRoot, dir, `${name}.json`), "utf8"));
    const localSchema = load_schema(name, { version });
    if (JSON.stringify(localSchema) !== JSON.stringify(upstreamSchema)) {
      missing += 1;
      console.log(`${version}/${name}`);
    }
  }
}

console.log(`total_mismatched=${String(missing)}`);
process.exitCode = missing ? 1 : 0;
