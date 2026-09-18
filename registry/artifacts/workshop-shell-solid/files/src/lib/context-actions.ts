/** Preview-safe context-menu style helper (menus.json host path omitted in FW extract). */
export type ContextScope = "tree-root" | "tree-folder" | "tree-file" | "editor-tab" | string;
export type ContextAction = { scope: ContextScope; path: string; action: string };

export function contextStyle(_scope: ContextScope, _path: string): Record<string, string> {
  return {};
}

export function parseContextAction(raw: unknown): ContextAction | null {
  const row = (Array.isArray(raw) ? raw[0] : raw) as Partial<ContextAction> | null;
  if (!row || typeof row.path !== "string" || typeof row.scope !== "string" || typeof row.action !== "string") {
    return null;
  }
  return { scope: row.scope, path: row.path, action: row.action };
}

export function creationParent(scope: ContextScope, path: string): string {
  return scope === "tree-root" ? "" : scope === "tree-folder" ? path : path.slice(0, Math.max(0, path.lastIndexOf("/")));
}

export function closingPaths(paths: string[], target: string, action: string): string[] {
  const index = paths.indexOf(target);
  if (index < 0) return [];
  if (action === "close-all") return paths;
  if (action === "close-others") return paths.filter((path) => path !== target);
  if (action === "close-right") return paths.slice(index + 1);
  return action === "close" ? [target] : [];
}
