import { clampChatPct, clampTreePct, DEFAULT_CHAT_PCT, DEFAULT_TREE_PCT } from "./column-split";
import { applyTheme, applyUiZoom, themeKey, type Palette, type Theme } from "./theme";

export const prefsKey = "ide-prefs";

export type AgentBridgeId = "cursor" | "pi" | "openai-sdk";
export type FontScale = "sm" | "md" | "lg";
export type TabSize = 2 | 4 | 8;
export type UiZoom = 100 | 125 | 150 | 200;

export type Prefs = {
  version: 1;
  theme: Theme;
  palette: Palette;
  hideHeader: boolean;
  tabSize: TabSize;
  lineWrap: boolean;
  fontScale: FontScale;
  bridge: AgentBridgeId;
  showThinking: boolean;
  showToolTrace: boolean;
  uiZoom: UiZoom;
  treePct: number;
  chatPct: number;
};

export const defaultPrefs: Prefs = {
  version: 1,
  theme: "system",
  palette: "default",
  hideHeader: true,
  tabSize: 4,
  lineWrap: false,
  fontScale: "md",
  bridge: "cursor",
  showThinking: true,
  showToolTrace: true,
  uiZoom: 100,
  treePct: 20,
  chatPct: 28,
};

function isTheme(value: unknown): value is Theme {
  return value === "system" || value === "light" || value === "dark";
}

function isPalette(value: unknown): value is Palette {
  return value === "default" || value === "hinddy";
}

function isTabSize(value: unknown): value is TabSize {
  return value === 2 || value === 4 || value === 8;
}

function isFontScale(value: unknown): value is FontScale {
  return value === "sm" || value === "md" || value === "lg";
}

function isUiZoom(value: unknown): value is UiZoom {
  return value === 100 || value === 125 || value === 150 || value === 200;
}

function isBridge(value: unknown): value is AgentBridgeId {
  return value === "cursor" || value === "pi" || value === "openai-sdk";
}

export function parsePrefs(raw: unknown): Prefs {
  if (!raw || typeof raw !== "object") return { ...defaultPrefs };
  const row = raw as Record<string, unknown>;
  return {
    version: 1,
    theme: isTheme(row.theme) ? row.theme : defaultPrefs.theme,
    palette: isPalette(row.palette) ? row.palette : defaultPrefs.palette,
    hideHeader: typeof row.hideHeader === "boolean" ? row.hideHeader : defaultPrefs.hideHeader,
    tabSize: isTabSize(row.tabSize) ? row.tabSize : defaultPrefs.tabSize,
    lineWrap: typeof row.lineWrap === "boolean" ? row.lineWrap : defaultPrefs.lineWrap,
    fontScale: isFontScale(row.fontScale) ? row.fontScale : defaultPrefs.fontScale,
    bridge: isBridge(row.bridge) ? row.bridge : defaultPrefs.bridge,
    showThinking: typeof row.showThinking === "boolean" ? row.showThinking : defaultPrefs.showThinking,
    showToolTrace: typeof row.showToolTrace === "boolean" ? row.showToolTrace : defaultPrefs.showToolTrace,
    uiZoom: isUiZoom(row.uiZoom) ? row.uiZoom : defaultPrefs.uiZoom,
    treePct: typeof row.treePct === "number" ? clampTreePct(row.treePct) : DEFAULT_TREE_PCT,
    chatPct: typeof row.chatPct === "number" ? clampChatPct(row.chatPct) : DEFAULT_CHAT_PCT,
  };
}

export function readPrefs(): Prefs {
  if (typeof localStorage === "undefined") return { ...defaultPrefs };
  const stored = localStorage.getItem(prefsKey);
  if (stored) {
    try {
      return parsePrefs(JSON.parse(stored) as unknown);
    } catch {
      return { ...defaultPrefs };
    }
  }
  const legacy = localStorage.getItem(themeKey);
  if (isTheme(legacy)) return { ...defaultPrefs, theme: legacy };
  return { ...defaultPrefs };
}

export function writePrefs(prefs: Prefs): void {
  localStorage.setItem(prefsKey, JSON.stringify(prefs));
  applyTheme(prefs.theme, prefs.palette);
  applyUiZoom(prefs.uiZoom);
}

export function patchPrefs(current: Prefs, patch: Partial<Prefs>): Prefs {
  const next = parsePrefs({ ...current, ...patch, version: 1 });
  writePrefs(next);
  return next;
}
