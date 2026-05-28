export type PrinterColor =
  | "purple"
  | "bold_purple"
  | "green"
  | "bold_green"
  | "cyan"
  | "bold_cyan"
  | "magenta"
  | "bold_magenta"
  | "yellow"
  | "bold_yellow"
  | "red"
  | "blue"
  | "bold_blue";
export const PrinterColor = Object.freeze({
  purple: "purple",
  bold_purple: "bold_purple",
  green: "green",
  bold_green: "bold_green",
  cyan: "cyan",
  bold_cyan: "bold_cyan",
  magenta: "magenta",
  bold_magenta: "bold_magenta",
  yellow: "yellow",
  bold_yellow: "bold_yellow",
  red: "red",
  blue: "blue",
  bold_blue: "bold_blue",
} as const);

export type ColoredText = {
  text: string;
  color?: PrinterColor | null;
};
export const ColoredText = Object.freeze({ kind: "ColoredText" });

export type LoggerOptions = {
  verbose?: boolean;
  defaultColor?: PrinterColor;
  default_color?: PrinterColor;
  writer?: (message: string) => void;
};

const colorCodes: Record<PrinterColor, string> = {
  purple: "\u001b[95m",
  bold_purple: "\u001b[1m\u001b[95m",
  green: "\u001b[32m",
  bold_green: "\u001b[1m\u001b[92m",
  cyan: "\u001b[96m",
  bold_cyan: "\u001b[1m\u001b[96m",
  magenta: "\u001b[35m",
  bold_magenta: "\u001b[1m\u001b[35m",
  yellow: "\u001b[93m",
  bold_yellow: "\u001b[1m\u001b[93m",
  red: "\u001b[91m",
  blue: "\u001b[94m",
  bold_blue: "\u001b[1m\u001b[94m",
};

const resetCode = "\u001b[0m";
let suppressConsoleOutput = false;

export class Logger {
  verbose: boolean;
  defaultColor: PrinterColor;
  default_color: PrinterColor;
  private readonly writer: (message: string) => void;

  constructor(options: LoggerOptions = {}) {
    this.verbose = options.verbose ?? false;
    this.defaultColor = options.defaultColor ?? options.default_color ?? "bold_yellow";
    this.default_color = this.defaultColor;
    this.writer = options.writer ?? ((message) => {
      process.stdout.write(message);
    });
  }

  log(level: string, message: string, color?: PrinterColor | null): void {
    if (!this.verbose) {
      return;
    }
    const timestamp = formatTimestamp(new Date());
    this.writer(renderColoredText([
      { text: `\n[${timestamp}]`, color: "cyan" },
      { text: `[${level.toUpperCase()}]: `, color: "yellow" },
      { text: message, color: color ?? this.defaultColor },
    ]));
  }
}

export class Printer {
  private readonly writer: (message: string) => void;

  constructor(writer?: (message: string) => void) {
    this.writer = writer ?? ((message) => {
      process.stdout.write(message);
    });
  }

  print(
    content: string | readonly ColoredText[],
    color: PrinterColor | null = null,
    _sep = " ",
    end = "\n",
  ): void {
    if (shouldSuppressConsoleOutput()) {
      return;
    }
    const parts = typeof content === "string" ? [{ text: content, color }] : content;
    const rendered = parts.map((part) => renderColoredText([part])).join(_sep);
    this.writer(`${rendered}${end}`);
  }
}

export const PRINTER = new Printer();

export function setSuppressConsoleOutput(suppress: boolean): boolean {
  const previous = suppressConsoleOutput;
  suppressConsoleOutput = suppress;
  return previous;
}

export const set_suppress_console_output = setSuppressConsoleOutput;

export function shouldSuppressConsoleOutput(): boolean {
  return suppressConsoleOutput;
}

export const should_suppress_console_output = shouldSuppressConsoleOutput;

export async function suppressLogging<T>(fn: () => T | Promise<T>): Promise<T> {
  return withSuppressedOutput(fn);
}

export const suppress_logging = suppressLogging;

export async function suppressWarnings<T>(fn: () => T | Promise<T>): Promise<T> {
  const originalEmitWarning: typeof process.emitWarning = process.emitWarning.bind(process);
  process.emitWarning = () => undefined;
  try {
    return await fn();
  } finally {
    process.emitWarning = originalEmitWarning;
  }
}

export const suppress_warnings = suppressWarnings;

export async function withSuppressedOutput<T>(fn: () => T | Promise<T>): Promise<T> {
  const originalStdoutWrite: typeof process.stdout.write = process.stdout.write.bind(process.stdout);
  const originalStderrWrite: typeof process.stderr.write = process.stderr.write.bind(process.stderr);
  process.stdout.write = () => true;
  process.stderr.write = () => true;
  try {
    return await fn();
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }
}

export const with_suppressed_output = withSuppressedOutput;

export function renderColoredText(parts: readonly ColoredText[], colorize = true): string {
  return parts.map((part) => {
    if (!colorize || !part.color) {
      return part.text;
    }
    return `${colorCodes[part.color]}${part.text}${resetCode}`;
  }).join("");
}

export const render_colored_text = renderColoredText;

function formatTimestamp(date: Date): string {
  const yyyy = String(date.getFullYear()).padStart(4, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}
