export type ContentProcessorProvider = {
  process(content: string, context?: Record<string, unknown> | null): string;
};

export const ContentProcessorProvider = Object.freeze({ kind: "ContentProcessorProvider" });

export class NoOpContentProcessor implements ContentProcessorProvider {
  process(content: string, _context: Record<string, unknown> | null = null): string {
    void _context;
    return content;
  }
}

let currentProcessor: ContentProcessorProvider | null = null;
const defaultProcessor = new NoOpContentProcessor();

export function get_processor(): ContentProcessorProvider {
  return currentProcessor ?? defaultProcessor;
}

export function set_processor(processor: ContentProcessorProvider): void {
  currentProcessor = processor;
}

export function process_content(content: string, context: Record<string, unknown> | null = null): string {
  return get_processor().process(content, context);
}
