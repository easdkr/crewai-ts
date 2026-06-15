import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import { LLM_REGISTRY, LlmRegistryService } from "@crewai-ts/nestjs";
import { describeSupply } from "../util/describe.js";

/**
 * Demonstrates `LLM_REGISTRY` / `LlmRegistryService`:
 * `names()`, `has()`, `get()`, `register()`, `resolve()`.
 */
@Controller("llms")
export class RegistryController {
  constructor(@Inject(LLM_REGISTRY) private readonly registry: LlmRegistryService) {}

  /** GET /llms → registered LLM names. */
  @Get()
  list() {
    return { names: this.registry.names() };
  }

  /** GET /llms/:name → the (secret-safe) description of one registered LLM. */
  @Get(":name")
  get(@Param("name") name: string) {
    if (!this.registry.has(name)) {
      throw new NotFoundException(
        `No LLM named '${name}'. Registered: ${this.registry.names().join(", ")}.`,
      );
    }
    return { name, llm: describeSupply(this.registry.get(name)) };
  }

  /**
   * POST /llms/:name { "aliasOf": "default" } → register `name` as an alias of
   * an existing entry (demonstrates `register()` + `resolve()`).
   */
  @Post(":name")
  register(@Param("name") name: string, @Body() body: { aliasOf?: string }) {
    const source = body?.aliasOf ?? "default";
    if (!this.registry.has(source)) {
      throw new BadRequestException(
        `Cannot alias '${source}': not registered. Registered: ${this.registry.names().join(", ")}.`,
      );
    }
    this.registry.register(name, this.registry.resolve(source));
    return { registered: name, aliasOf: source, names: this.registry.names() };
  }
}
