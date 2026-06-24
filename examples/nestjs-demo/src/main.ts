import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

/**
 * HTTP entrypoint. Boots the full Nest app (which forces `CrewModule`'s
 * env-driven, live-only wiring — bootstrap FAILS fast if no provider key).
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  const log = new Logger("bootstrap");
  log.log(`@crewai-ts/nestjs-demo listening on http://localhost:${port}`);
  log.log("Endpoints:");
  log.log(`  POST /research            { "topic": "...", "provider"?, "depth"?, "requireRiskReview"? }  (LIVE Flow + LLM)`);
  log.log(`  GET  /llms                · GET /llms/:name · POST /llms/:name { "aliasOf": "default" }`);
  log.log(`  GET  /router/route?strategy=round-robin|fallback|race|weighted · POST /router/custom`);
  log.log(`  GET  /agents              · GET /agents/:role`);
  log.log(`  GET  /runtime             · GET /events · POST /events/emit · DELETE /events/subscription/:type`);
}

void bootstrap();
