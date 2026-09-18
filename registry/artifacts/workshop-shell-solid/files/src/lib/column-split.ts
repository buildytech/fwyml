export const TREE_WIDTH_KEY = "ide-tree-pct";
export const CHAT_WIDTH_KEY = "ide-chat-pct";
export const DEFAULT_TREE_PCT = 20;
export const DEFAULT_CHAT_PCT = 28;
export const MIN_TREE_PCT = 12;
export const MAX_TREE_PCT = 40;
export const MIN_CHAT_PCT = 16;
export const MAX_CHAT_PCT = 42;
export const MIN_EDITOR_PCT = 24;

export type ColumnPct = { tree: number; chat: number };

export function clampTreePct(pct: number): number {
  if (!Number.isFinite(pct)) return DEFAULT_TREE_PCT;
  return Math.min(MAX_TREE_PCT, Math.max(MIN_TREE_PCT, Math.round(pct * 10) / 10));
}

export function clampChatPct(pct: number): number {
  if (!Number.isFinite(pct)) return DEFAULT_CHAT_PCT;
  return Math.min(MAX_CHAT_PCT, Math.max(MIN_CHAT_PCT, Math.round(pct * 10) / 10));
}

export function fitColumns(tree: number, chat: number): ColumnPct {
  let nextTree = clampTreePct(tree);
  let nextChat = clampChatPct(chat);
  const overflow = nextTree + nextChat + MIN_EDITOR_PCT - 100;
  if (overflow > 0) {
    nextChat = clampChatPct(nextChat - overflow);
  }
  return { tree: nextTree, chat: nextChat };
}

export function columnsFromPrefs(treePct: number, chatPct: number): ColumnPct {
  return fitColumns(treePct, chatPct);
}

export function readColumnPct(): ColumnPct {
  if (typeof localStorage === "undefined") {
    return { tree: DEFAULT_TREE_PCT, chat: DEFAULT_CHAT_PCT };
  }
  const tree = clampTreePct(Number(localStorage.getItem(TREE_WIDTH_KEY) ?? DEFAULT_TREE_PCT));
  const chat = clampChatPct(Number(localStorage.getItem(CHAT_WIDTH_KEY) ?? DEFAULT_CHAT_PCT));
  return fitColumns(tree, chat);
}

export function persistColumnPct(pct: ColumnPct): void {
  const next = fitColumns(pct.tree, pct.chat);
  localStorage.setItem(TREE_WIDTH_KEY, String(next.tree));
  localStorage.setItem(CHAT_WIDTH_KEY, String(next.chat));
}

export const resetLayoutEvent = "ide:reset-layout";

export function resetColumnPct(): ColumnPct {
  const next = { tree: DEFAULT_TREE_PCT, chat: DEFAULT_CHAT_PCT };
  persistColumnPct(next);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(resetLayoutEvent));
  return next;
}

export function treePctFromPointer(clientX: number, body: { left: number; width: number }): number {
  if (body.width <= 0) return DEFAULT_TREE_PCT;
  return clampTreePct(((clientX - body.left) / body.width) * 100);
}

export function chatPctFromPointer(clientX: number, body: { left: number; width: number; right: number }): number {
  if (body.width <= 0) return DEFAULT_CHAT_PCT;
  return clampChatPct(((body.right - clientX) / body.width) * 100);
}
