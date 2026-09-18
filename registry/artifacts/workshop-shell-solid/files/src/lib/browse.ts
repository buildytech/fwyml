/** Browse facade — WebView2 is Windows-only; Linux/preview stay gated. */
import { usePreviewHost } from "./host";

export type BrowseTabView = { id: string; url: string; title: string; error?: string };
export type BrowseCapability = { available: boolean; reason: string };

export function browseCapability(): BrowseCapability {
  if (usePreviewHost()) return { available: false, reason: "preview-no-webview" };
  if (typeof navigator !== "undefined" && /linux/i.test(navigator.userAgent)) {
    return { available: false, reason: "webview2-windows-only" };
  }
  return { available: false, reason: "browse-adapter-stub" };
}

export function browseUnavailableMessage(copy: {
  browserPreview: string;
  browserDisconnected: string;
}): string {
  const cap = browseCapability();
  if (cap.reason === "preview-no-webview") return copy.browserPreview;
  if (cap.reason === "webview2-windows-only") {
    return "Simple Browser needs WebView2 (Windows). This Linux host has no native browser surface.";
  }
  return copy.browserDisconnected;
}

export async function browseOpen(id: string, url: string): Promise<BrowseTabView> {
  const cap = browseCapability();
  if (!cap.available) return { id, url, title: "Browser", error: cap.reason };
  return { id, url, title: "Browser" };
}

export async function browseNavigate(id: string, url: string): Promise<BrowseTabView> {
  return browseOpen(id, url);
}

export async function browseReload(id: string, _hard = false): Promise<BrowseTabView> {
  return { id, url: "", title: "Browser", error: browseCapability().reason };
}

export async function browseClose(_id: string): Promise<void> {}
export async function browsePick(_id: string, _enable: boolean): Promise<void> {
  throw new Error(browseCapability().reason);
}
export async function browseLayout(_id: string, _x: number, _y: number, _w: number, _h: number): Promise<void> {}
export async function browseClearCache(_id: string): Promise<void> {}
export async function browseShow(_id: string, _visible: boolean): Promise<void> {}
export function listenBrowse(_handlers: {
  onNav?: (tab: BrowseTabView) => void;
  onPick?: (pick: { id: string; url: string; title: string; selector: string; html: string; text: string }) => void;
}): () => void {
  return () => undefined;
}
