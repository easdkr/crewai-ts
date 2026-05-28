import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { StructuredTool, sanitizeToolName } from "./tools.js";
import type { Tool } from "./types.js";

export type InputFile = string | {
  path?: string;
  content?: string;
  filename?: string;
  contentType?: string;
};

export type InputFiles = Record<string, InputFile>;

export type ExtractedInputFiles = {
  inputs: Record<string, unknown>;
  inputFiles: InputFiles;
};

export function renderInputFiles(inputFiles: InputFiles): string | null {
  const entries = Object.entries(inputFiles);
  if (entries.length === 0) {
    return null;
  }

  const lines = ["Input files (content already loaded in conversation):"];
  for (const [name, file] of entries) {
    const rendered = renderInputFile(name, file);
    const metadata = rendered.contentType
      ? `${rendered.filename}, ${rendered.contentType}`
      : rendered.filename;
    lines.push(`  - "${name}" (${metadata})`);
    lines.push("    Content:");
    lines.push(indentInputFileContent(rendered.content));
  }
  return lines.join("\n");
}

export function createReadFileTool(inputFiles: InputFiles): Tool {
  return new StructuredTool({
    name: "read_file",
    description: "Read content from an input file by name. Returns file content as text.",
    argsSchema: {
      file_name: {
        type: "string",
        required: true,
        description: "The name of the input file to read",
      },
    },
    cache: false,
    func: (args) => {
      if (Object.keys(inputFiles).length === 0) {
        return "No input files available.";
      }
      const fileName = typeof args.file_name === "string"
        ? args.file_name
        : typeof args.fileName === "string"
          ? args.fileName
          : "";
      const inputFile = inputFiles[fileName];
      if (!fileName || inputFile === undefined) {
        const available = Object.keys(inputFiles).join(", ");
        return `File '${fileName}' not found. Available files: ${available}`;
      }
      return renderInputFile(fileName, inputFile).content;
    },
  });
}

export function withReadFileTool(tools: readonly Tool[], inputFiles: InputFiles | undefined): readonly Tool[] {
  if (!inputFiles || Object.keys(inputFiles).length === 0) {
    return tools;
  }
  if (tools.some((tool) => sanitizeToolName(tool.name) === "read_file")) {
    return tools;
  }
  return [...tools, createReadFileTool(inputFiles)];
}

export function extractInputFilesFromInputs(inputs: Record<string, unknown>): ExtractedInputFiles {
  const nextInputs: Record<string, unknown> = {};
  const inputFiles: InputFiles = {};
  for (const [key, value] of Object.entries(inputs)) {
    if (isStructuredInputFile(value)) {
      inputFiles[key] = value;
    } else {
      nextInputs[key] = value;
    }
  }
  return { inputs: nextInputs, inputFiles };
}

export function isStructuredInputFile(value: unknown): value is Exclude<InputFile, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.content === "string"
    || typeof record.path === "string"
  ) && (
    record.filename === undefined || typeof record.filename === "string"
  ) && (
    record.contentType === undefined || typeof record.contentType === "string"
  );
}

function renderInputFile(name: string, file: InputFile): { filename: string; contentType: string | null; content: string } {
  if (typeof file === "string") {
    return {
      filename: basename(file) || name,
      contentType: guessTextContentType(file),
      content: readFileSync(file, "utf8"),
    };
  }

  if (typeof file.content === "string") {
    return {
      filename: file.filename ?? (file.path ? basename(file.path) : name),
      contentType: file.contentType ?? guessTextContentType(file.filename ?? file.path ?? name),
      content: file.content,
    };
  }

  if (file.path) {
    return {
      filename: file.filename ?? (basename(file.path) || name),
      contentType: file.contentType ?? guessTextContentType(file.path),
      content: readFileSync(file.path, "utf8"),
    };
  }

  throw new Error(`Input file '${name}' requires either a path or text content.`);
}

function indentInputFileContent(content: string): string {
  if (content.length === 0) {
    return "    ";
  }
  return content.split("\n").map((line) => `    ${line}`).join("\n");
}

function guessTextContentType(path: string): string | null {
  const lower = path.toLowerCase();
  if (lower.endsWith(".json")) {
    return "application/json";
  }
  if (lower.endsWith(".csv")) {
    return "text/csv";
  }
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
    return "text/markdown";
  }
  if (lower.endsWith(".txt") || lower.endsWith(".log")) {
    return "text/plain";
  }
  return null;
}
