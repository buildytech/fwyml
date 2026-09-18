export type DirtyChoice = "save" | "discard" | "cancel";

export function proceedAfterDirty(choice: DirtyChoice, saved: boolean): boolean {
  if (choice === "cancel") return false;
  if (choice === "save") return saved;
  return true;
}
