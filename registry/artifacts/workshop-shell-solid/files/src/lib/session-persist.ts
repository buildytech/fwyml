import { isBrowserPath } from "./browser-tab";
import { isUntitledPath } from "./file-buffer";

export type PersistBuffer = { text: string; saved: string; revision: string };

export type BottomTab = "terminal" | "problems";
export type MarkdownMode = "visual" | "source";

export type SessionChrome = {
  bottomTab: BottomTab;
  bottomVisible: boolean;
  chatVisible: boolean;
  markdown: Record<string, MarkdownMode>;
};

export type SessionLayoutView = {
  treePct: number;
  chatPct: number;
  tabs: string[];
  active: string;
  line: number;
  column: number;
} & SessionChrome;

export const defaultSessionChrome = (): SessionChrome => ({
  bottomTab: "problems",
  bottomVisible: true,
  chatVisible: false,
  markdown: {},
});

export function dirtyRecoveryItems(buffers: Record<string, PersistBuffer>): {
  path: string;
  text: string;
  revision: string;
  untitled: boolean;
}[] {
  return Object.entries(buffers)
    .filter(([path, buffer]) => isUntitledPath(path) || isBrowserPath(path) || buffer.text !== buffer.saved)
    .map(([path, buffer]) => ({
      path,
      text: buffer.text,
      revision: buffer.revision,
      untitled: isUntitledPath(path),
    }));
}

export async function writeOrThrow(required: boolean, write: () => Promise<void>): Promise<void> {
  try {
    await write();
  } catch (error) {
    if (required) throw error;
  }
}

export function mergeRecoveredBuffers<T>(
  current: Record<string, T>,
  recovered: Record<string, T>,
): Record<string, T> {
  return { ...current, ...recovered };
}

function markdownForOpenTabs(
  markdown: Record<string, MarkdownMode>,
  tabs: string[],
): Record<string, MarkdownMode> {
  const open = new Set(tabs);
  return Object.fromEntries(Object.entries(markdown).filter(([path, mode]) => open.has(path) && (mode === "visual" || mode === "source")));
}

export function sessionLayoutPayload(
  buffers: Record<string, PersistBuffer>,
  prefs: { treePct: number; chatPct: number },
  filePath: string,
  cursor: { line: number; column: number },
  chrome: SessionChrome = defaultSessionChrome(),
  options?: { includeUntitled?: boolean },
): SessionLayoutView {
  const includeUntitled = options?.includeUntitled !== false;
  const tabs = Object.keys(buffers).filter(path => includeUntitled || !isUntitledPath(path));
  const active = tabs.includes(filePath) ? filePath : tabs[0] ?? "";
  return {
    treePct: prefs.treePct,
    chatPct: prefs.chatPct,
    tabs,
    active,
    line: cursor.line,
    column: cursor.column,
    bottomTab: chrome.bottomTab === "terminal" ? "terminal" : "problems",
    bottomVisible: chrome.bottomVisible,
    chatVisible: chrome.chatVisible,
    markdown: markdownForOpenTabs(chrome.markdown, tabs),
  };
}

export function readSessionLayout(row: {
  treePct?: number;
  chatPct?: number;
  tabs?: string[];
  active?: string;
  line?: number;
  column?: number;
  bottomTab?: string;
  bottomVisible?: boolean;
  chatVisible?: boolean;
  markdown?: Record<string, string | undefined>;
}): SessionLayoutView {
  const defaults = defaultSessionChrome();
  const markdown: Record<string, MarkdownMode> = {};
  for (const [path, mode] of Object.entries(row.markdown ?? {})) {
    if (mode === "visual" || mode === "source") markdown[path] = mode;
  }
  return {
    treePct: typeof row.treePct === "number" ? row.treePct : 20,
    chatPct: typeof row.chatPct === "number" ? row.chatPct : 28,
    tabs: (row.tabs ?? []).filter((path): path is string => typeof path === "string" && path.length > 0),
    active: typeof row.active === "string" ? row.active : "",
    line: typeof row.line === "number" ? row.line : 1,
    column: typeof row.column === "number" ? row.column : 1,
    bottomTab: row.bottomTab === "terminal" ? "terminal" : defaults.bottomTab,
    bottomVisible: typeof row.bottomVisible === "boolean" ? row.bottomVisible : defaults.bottomVisible,
    chatVisible: row.chatVisible === true,
    markdown,
  };
}
