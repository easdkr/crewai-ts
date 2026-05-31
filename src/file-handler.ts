import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { dirname } from "node:path";

export type LogEntry = {
  taskName?: string | null;
  task?: string;
  agent?: string;
  status?: string;
  output?: string;
  input?: string;
  message?: string;
  level?: string;
  crew?: string | null;
  tool?: string;
  error?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
};
export const LogEntry = Object.freeze({ kind: "LogEntry" });

export class FileHandler {
  path: string;
  _path: string;

  constructor(filePath: boolean | string) {
    this.path = "";
    this._path = "";
    this._initialize_path(filePath);
  }

  _initialize_path(filePath: boolean | string): void {
    if (filePath === true) {
      this.path = "logs.txt";
    } else if (typeof filePath === "string") {
      this.path = filePath.endsWith(".json") || filePath.endsWith(".txt")
        ? filePath
        : `${filePath}.txt`;
    } else {
      throw new Error("filePath must be a string or boolean.");
    }
    this._path = this.path;
  }

  async log(entry: LogEntry): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const logEntry = {
      timestamp: formatTimestamp(new Date()),
      ...entry,
    };

    if (this.path.endsWith(".json")) {
      let existing: unknown;
      try {
        existing = JSON.parse(await readFile(this.path, "utf8"));
      } catch {
        existing = [];
      }
      const entries = Array.isArray(existing) ? existing : [];
      entries.push(logEntry);
      await writeFile(this.path, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
      return;
    }

    const fields = Object.entries(entry)
      .map(([key, value]) => `${key}="${formatLogValue(value)}"`)
      .join(", ");
    await appendFile(this.path, `${logEntry.timestamp}: ${fields}\n`, "utf8");
  }
}

export class PickleHandler {
  readonly filePath: string;
  readonly file_path: string;

  constructor(fileName: string) {
    this.filePath = fileName.endsWith(".pkl") ? fileName : `${fileName}.pkl`;
    this.file_path = this.filePath;
  }

  initializeFile(): void {
    this.save({});
  }

  initialize_file(): void {
    this.initializeFile();
  }

  save(data: unknown): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }

  load(): unknown {
    if (!existsSync(this.filePath)) {
      return {};
    }
    try {
      const content = readFileSync(this.filePath, "utf8").trim();
      return content ? JSON.parse(content) : {};
    } catch {
      return {};
    }
  }
}

function formatLogValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value === null || value === undefined) {
    return "";
  }
  return JSON.stringify(value);
}

function formatTimestamp(date: Date): string {
  const yyyy = String(date.getFullYear()).padStart(4, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}
