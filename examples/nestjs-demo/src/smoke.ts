import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { LLM_REGISTRY, LlmRegistryService, LlmRouterService } from "@crewai-ts/nestjs";
import { LlmConfigService } from "./llm/llm-config.service.js";
import { ResearchService } from "./research/research.service.js";

/**
 * Live smoke test. Boots the SAME `AppModule` headlessly (no HTTP server),
 * exercises read-only helpers, then performs a real `crew.kickoff` against the
 * selected provider and asserts non-empty output. Exits 0 on pass, 1 on fail.
 *
 * Provider is chosen via `LLM_PROVIDER` (else the first available key, in the
 * order openai -> gemini -> anthropic). This is LIVE-ONLY: with no key set,
 * bootstrap throws a clear error.
 */
async function main(): Promise<void> {
  const log = new Logger("smoke");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });

  try {
    const config = app.get(LlmConfigService);
    const provider = process.env.LLM_PROVIDER?.trim() || config.resolvedDefaultProvider();
    log.log(`Available providers: [${config.available().join(", ")}] · using: ${provider}`);

    // Read-only helper checks (breadth).
    const registry = app.get<LlmRegistryService>(LLM_REGISTRY);
    const router = app.get(LlmRouterService);
    log.log(`LLM_REGISTRY names: [${registry.names().join(", ")}]`);
    if (registry.names().length === 0) throw new Error("registry is empty");
    router.use("round-robin");
    if (!router.route()) throw new Error("router.route() returned nothing");

    // Live LLM round-trip (the actual smoke).
    const topic = process.env.SMOKE_TOPIC?.trim() || "dependency injection in NestJS";
    const res = await app.get(ResearchService).run(topic, process.env.LLM_PROVIDER?.trim() || undefined);
    const ok = typeof res.output === "string" && res.output.trim().length > 0;

    log.log(`provider=${res.provider} topic="${res.topic}"`);
    log.log(`output (first 400 chars):\n${res.output.slice(0, 400)}`);
    if (!ok) throw new Error("LLM returned empty output");

    log.log("✅ SMOKE PASS");
    await app.close();
    process.exit(0);
  } catch (err) {
    log.error(`❌ SMOKE FAIL: ${(err as Error).message}`);
    await app.close().catch(() => undefined);
    process.exit(1);
  }
}

void main();
