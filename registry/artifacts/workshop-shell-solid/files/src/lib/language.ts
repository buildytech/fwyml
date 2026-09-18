/**
 * Language facade — LanguageService when host:live + languages-workspace-go selected;
 * path/extension stub in preview or when bindings unavailable.
 */
import {
  CancelValidation,
  Complete as LanguageComplete,
  Definition as LanguageDefinition,
  Diagnostics as LanguageDiagnostics,
  Format as LanguageFormat,
  Hover as LanguageHover,
  Runtime as LanguageRuntime,
  Status as LanguageStatus,
} from "../../frontend/bindings/example.com/app/compose/languageservice";
import { usePreviewHost } from "./host";

export type LanguageStatusView = {
  language: string;
  ready: boolean;
  reason: string;
  format: boolean;
  definition: boolean;
  hover: boolean;
  complete: boolean;
  diagnostics: boolean;
};

export type LanguageHitView = {
  path: string;
  line: number;
  column: number;
  text: string;
  preview: string;
};

function languageOf(path: string): string {
  const ext = path.includes(".") ? path.slice(path.lastIndexOf(".")).toLowerCase() : "";
  switch (ext) {
    case ".go":
      return "go";
    case ".ts":
    case ".tsx":
    case ".mts":
    case ".cts":
      return "typescript";
    case ".js":
    case ".jsx":
    case ".mjs":
    case ".cjs":
      return "javascript";
    case ".json":
      return "json";
    case ".md":
    case ".mdx":
      return "markdown";
    case ".css":
      return "css";
    case ".html":
    case ".htm":
      return "html";
    case ".py":
      return "python";
    case ".rs":
      return "rust";
    case ".yaml":
    case ".yml":
      return "yaml";
    default:
      return "";
  }
}

const idle: LanguageStatusView = {
  language: "",
  ready: false,
  reason: "languages host adapter not selected",
  format: false,
  definition: false,
  hover: false,
  complete: false,
  diagnostics: false,
};

function asStatus(row: {
  language?: string;
  ready?: boolean;
  reason?: string;
  format?: boolean;
  definition?: boolean;
  hover?: boolean;
  complete?: boolean;
  diagnostics?: boolean;
} | null | undefined): LanguageStatusView {
  return {
    language: row?.language ?? "",
    ready: row?.ready === true,
    reason: row?.reason ?? "",
    format: row?.format === true,
    definition: row?.definition === true,
    hover: row?.hover === true,
    complete: row?.complete === true,
    diagnostics: row?.diagnostics === true,
  };
}

function asHits(
  rows: { path?: string; line?: number; column?: number; text?: string; preview?: string }[] | null | undefined,
): LanguageHitView[] {
  return (rows ?? []).map((row) => ({
    path: row.path ?? "",
    line: row.line ?? 0,
    column: row.column ?? 0,
    text: row.text ?? "",
    preview: row.preview ?? "",
  }));
}

function stubStatus(path: string): LanguageStatusView {
  const language = languageOf(path);
  if (!language) {
    return {
      ...idle,
      language: "plaintext",
      reason: "No project language service for this file.",
    };
  }
  return {
    language,
    ready: false,
    reason: `${language}: preview stub — language service uses host LanguageService when live.`,
    format: false,
    definition: false,
    hover: false,
    complete: false,
    diagnostics: false,
  };
}

export async function languageStatus(path: string): Promise<LanguageStatusView> {
  if (usePreviewHost()) return stubStatus(path);
  try {
    return asStatus(await LanguageStatus(path));
  } catch (error) {
    const language = languageOf(path) || "plaintext";
    return {
      ...idle,
      language,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function languageFormat(path: string, text: string): Promise<string> {
  if (usePreviewHost()) return text;
  return LanguageFormat(path, text);
}

export async function languageDefinition(
  path: string,
  text: string,
  line: number,
  column: number,
): Promise<LanguageHitView[]> {
  if (usePreviewHost()) return [];
  return asHits(await LanguageDefinition(path, text, line, column));
}

export async function languageHover(
  path: string,
  text: string,
  line: number,
  column: number,
): Promise<string> {
  if (usePreviewHost()) return "";
  return LanguageHover(path, text, line, column);
}

export async function languageDiagnostics(path: string): Promise<LanguageHitView[]> {
  if (usePreviewHost()) return [];
  return asHits(await LanguageDiagnostics(path));
}

export async function languageComplete(
  path: string,
  text: string,
  line: number,
  column: number,
): Promise<LanguageHitView[]> {
  if (usePreviewHost()) return [];
  return asHits(await LanguageComplete(path, text, line, column));
}

export async function cancelValidation(): Promise<void> {
  if (usePreviewHost()) return;
  try {
    await CancelValidation();
  } catch {
    /* ignore */
  }
}

export async function languageRuntimeLabel(): Promise<string> {
  if (usePreviewHost()) return "languages:preview";
  try {
    return await LanguageRuntime();
  } catch {
    return "languages";
  }
}

