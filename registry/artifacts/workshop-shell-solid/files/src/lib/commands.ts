export type CommandId =
  | "find"
  | "line"
  | "save"
  | "save-as"
  | "quick-open"
  | "explorer"
  | "terminal"
  | "problems"
  | "settings"
  | "palette"
  | "escape";

export type CommandSurface = "editor" | "settings" | "welcome" | "quick-open" | "visual-markdown";

export type CommandDef = {
  id: CommandId;
  shortcut?: string;
};

export const commandCatalog: CommandDef[] = [
  { id: "palette", shortcut: "Ctrl+Shift+P" },
  { id: "find", shortcut: "Ctrl+F" },
  { id: "line", shortcut: "Ctrl+G" },
  { id: "save", shortcut: "Ctrl+S" },
  { id: "save-as", shortcut: "Ctrl+Shift+S" },
  { id: "quick-open", shortcut: "Ctrl+P" },
  { id: "explorer", shortcut: "Ctrl+B" },
  { id: "terminal", shortcut: "Ctrl+`" },
  { id: "problems", shortcut: "Ctrl+Shift+M" },
  { id: "settings", shortcut: "Ctrl+," },
  { id: "escape" },
];

export function commandLabel(id: CommandId, labels: Record<CommandId, string>): string {
  return labels[id];
}

export function commandAvailable(id: CommandId, surface: CommandSurface): boolean {
  if (surface === "settings") return id === "escape" || id === "settings";
  if (surface === "welcome") return id === "settings" || id === "quick-open";
  if (surface === "quick-open") return id === "escape" || id === "quick-open";
  if (surface === "visual-markdown") return id !== "find" && id !== "line";
  return true;
}

export function routeEditorCommand(
  id: CommandId,
  surface: CommandSurface,
): { id: CommandId; switchToSource: boolean } | null {
  if (!commandAvailable(id, surface) && surface === "visual-markdown" && (id === "find" || id === "line")) {
    return { id, switchToSource: true };
  }
  if (!commandAvailable(id, surface)) return null;
  return { id, switchToSource: false };
}
