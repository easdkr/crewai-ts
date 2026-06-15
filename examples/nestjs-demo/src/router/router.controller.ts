import { BadRequestException, Controller, Get, Inject, Post, Query } from "@nestjs/common";
import {
  LLM_REGISTRY,
  LlmRegistryService,
  LlmRouterService,
  type RouterStrategy,
} from "@crewai-ts/nestjs";

const BUILTIN: readonly RouterStrategy[] = ["round-robin", "fallback", "race", "weighted"];

/**
 * Demonstrates `LLM_ROUTER` / `LlmRouterService`: `use()` + `route()` across the
 * registry, with all built-in strategies and a custom `RouterStrategyFn`.
 *
 * NOTE: with a single registered provider the router short-circuits to it;
 * strategy differences are only observable with 2+ providers (i.e. 2+ keys set).
 */
@Controller("router")
export class RouterController {
  constructor(
    @Inject(LlmRouterService) private readonly router: LlmRouterService,
    @Inject(LLM_REGISTRY) private readonly registry: LlmRegistryService,
  ) {}

  /** GET /router/route?strategy=round-robin|fallback|race|weighted */
  @Get("route")
  route(@Query("strategy") strategy?: string) {
    if (strategy) {
      if (!BUILTIN.includes(strategy as RouterStrategy)) {
        throw new BadRequestException(
          `Unknown strategy '${strategy}'. Use one of: ${BUILTIN.join(", ")}.`,
        );
      }
      this.router.use(strategy as RouterStrategy);
    }
    return { strategy: strategy ?? "(current)", picked: this.nameOf(this.router.route()) };
  }

  /** POST /router/custom → install a custom RouterStrategyFn (picks the last entry). */
  @Post("custom")
  custom() {
    this.router.use((llms) => llms[llms.length - 1]!);
    return { strategy: "custom(last)", picked: this.nameOf(this.router.route()) };
  }

  /** Map a picked LLM back to its registry name(s) by identity (secret-safe). */
  private nameOf(picked: unknown): string {
    const names = this.registry.names().filter((n) => this.registry.get(n) === picked);
    return names.join(", ") || "(unnamed)";
  }
}
