/**
 * Preview/Vite session companions. Native host uses UserStoreService via host.ts.
 */
import {
  defaultSessionChrome,
  readSessionLayout,
  type PersistBuffer,
  type SessionChrome,
  type SessionLayoutView,
} from "./session-persist";

export type RecentWorkspace = { id: string; label: string };
export type RecoveryItem = { path: string; text: string; revision: string; untitled: boolean };

const RECENT_KEY = "ide-session-recent";
const LAYOUT_KEY = "ide-session-layout";
const RECOVERY_KEY = "ide-session-recovery";
const CHROME_KEY = "ide-session-chrome";

function storage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadRecentWorkspaces(): RecentWorkspace[] {
  const raw = storage()?.getItem(RECENT_KEY);
  if (!raw) return [];
  try {
    const rows = JSON.parse(raw) as unknown;
    if (!Array.isArray(rows)) return [];
    return rows
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const rec = row as Record<string, unknown>;
        if (typeof rec.id !== "string" || typeof rec.label !== "string") return null;
        return { id: rec.id, label: rec.label };
      })
      .filter((row): row is RecentWorkspace => row !== null)
      .slice(0, 12);
  } catch {
    return [];
  }
}

export function rememberRecentWorkspace(id: string, label: string): RecentWorkspace[] {
  const next = [{ id, label }, ...loadRecentWorkspaces().filter((row) => row.id !== id)].slice(0, 12);
  storage()?.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

export function loadLocalLayout(): SessionLayoutView | null {
  const raw = storage()?.getItem(LAYOUT_KEY);
  if (!raw) return null;
  try {
    return readSessionLayout(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return null;
  }
}

export function saveLocalLayout(layout: SessionLayoutView): void {
  storage()?.setItem(LAYOUT_KEY, JSON.stringify(layout));
}

export function loadLocalChrome(): SessionChrome {
  const raw = storage()?.getItem(CHROME_KEY);
  if (!raw) return defaultSessionChrome();
  try {
    const row = JSON.parse(raw) as Record<string, unknown>;
    const defaults = defaultSessionChrome();
    return {
      bottomTab: row.bottomTab === "terminal" ? "terminal" : defaults.bottomTab,
      bottomVisible: typeof row.bottomVisible === "boolean" ? row.bottomVisible : defaults.bottomVisible,
      chatVisible: row.chatVisible === true,
      markdown:
        typeof row.markdown === "object" && row.markdown
          ? (row.markdown as SessionChrome["markdown"])
          : {},
    };
  } catch {
    return defaultSessionChrome();
  }
}

export function saveLocalChrome(chrome: SessionChrome): void {
  storage()?.setItem(CHROME_KEY, JSON.stringify(chrome));
}

export function loadLocalRecovery(): RecoveryItem[] {
  const raw = storage()?.getItem(RECOVERY_KEY);
  if (!raw) return [];
  try {
    const rows = JSON.parse(raw) as unknown;
    if (!Array.isArray(rows)) return [];
    return rows
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const rec = row as Record<string, unknown>;
        if (typeof rec.path !== "string" || typeof rec.text !== "string") return null;
        return {
          path: rec.path,
          text: rec.text,
          revision: typeof rec.revision === "string" ? rec.revision : "",
          untitled: rec.untitled === true,
        };
      })
      .filter((row): row is RecoveryItem => row !== null);
  } catch {
    return [];
  }
}

export function saveLocalRecovery(items: RecoveryItem[]): void {
  storage()?.setItem(RECOVERY_KEY, JSON.stringify(items));
}

export type { PersistBuffer };
