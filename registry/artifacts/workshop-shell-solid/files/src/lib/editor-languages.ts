import { css } from "@codemirror/lang-css";
import { go } from "@codemirror/lang-go";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { yaml } from "@codemirror/lang-yaml";
import type { Language } from "@codemirror/language";
import type { Extension } from "@codemirror/state";

const markdownExt = new Set(["md", "mdx", "markdown"]);

function fileExt(filePath: string): string {
  const base = filePath.split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
}

function fenceLanguage(info: string): Language | null {
  const id = info.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (id === "ts" || id === "typescript" || id === "mts" || id === "cts") return javascript({ typescript: true }).language;
  if (id === "tsx") return javascript({ typescript: true, jsx: true }).language;
  if (id === "jsx") return javascript({ jsx: true }).language;
  if (id === "js" || id === "javascript" || id === "mjs" || id === "cjs") return javascript().language;
  if (id === "json" || id === "jsonc") return json().language;
  if (id === "css" || id === "scss" || id === "less") return css().language;
  if (id === "html" || id === "htm" || id === "svg") return html().language;
  if (id === "go") return go().language;
  if (id === "py" || id === "python") return python().language;
  if (id === "yml" || id === "yaml") return yaml().language;
  return null;
}

function markdownSourceSupport(mdx: boolean) {
  return markdown({
    codeLanguages: fenceLanguage,
    defaultCodeLanguage: mdx ? javascript({ jsx: true }) : undefined,
    htmlTagLanguage: mdx ? javascript({ jsx: true }) : undefined,
  });
}

/** True when the workspace path is Markdown or MDX. */
export function isMarkdownPath(filePath: string): boolean {
  return markdownExt.has(fileExt(filePath));
}

export function isMdxPath(filePath: string): boolean {
  return fileExt(filePath) === "mdx";
}

/** Visual is opt-in for Markdown and MDX. EditorY cannot round-trip JSX. */
export function markdownDefaultMode(_filePath: string): "visual" | "source" {
  return "source";
}

/** Map a workspace-relative path to a CodeMirror language extension. */
export function languageSupportForPath(filePath: string): Extension {
  const base = filePath.split(/[/\\]/).pop() ?? "";
  const ext = fileExt(filePath);
  const lower = base.toLowerCase();

  if (
    lower === "dockerfile" ||
    lower.startsWith("dockerfile.") ||
    lower === "makefile" ||
    lower === "cmakelists.txt"
  ) {
    return [];
  }

  switch (ext) {
    case "ts":
    case "mts":
    case "cts":
      return javascript({ typescript: true });
    case "tsx":
      return javascript({ typescript: true, jsx: true });
    case "js":
    case "mjs":
    case "cjs":
      return javascript();
    case "jsx":
      return javascript({ jsx: true });
    case "json":
    case "jsonc":
      return json();
    case "css":
    case "scss":
    case "less":
      return css();
    case "html":
    case "htm":
    case "svg":
      return html();
    case "md":
    case "markdown":
      return markdownSourceSupport(false);
    case "mdx":
      return markdownSourceSupport(true);
    case "go":
      return go();
    case "py":
      return python();
    case "php":
      return [];
    case "yml":
    case "yaml":
      return yaml();
    default:
      return [];
  }
}
