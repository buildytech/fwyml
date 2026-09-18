/**
 * Aria helpers — static role/aria-* attributes cover most chrome.
 * Optional @ui8kit/aria patterns are not selected on this product (package may be unpublished);
 * startAria/bindLateAria are honest no-ops so the bridge can call them like ide/.
 */
export const ariaPatterns = ["dialog", "disclosure", "tooltip", "alert"] as const;

export function startAria(_root: Document | Element = document): void {
  /* no-op: @ui8kit/aria not selected; dirty dialog already uses role=dialog aria-modal */
}

export function bindLateAria(_root: Document | Element = document): void {
  /* no-op: re-init hook reserved for when aria adapter is published */
}
