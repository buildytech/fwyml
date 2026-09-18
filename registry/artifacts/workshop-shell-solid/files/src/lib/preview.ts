/** Browser UX preview: `http://127.0.0.1:5173/?preview=` (or any Vite preview without native IPC). */

export function isPreviewMode(search?: string): boolean {
  const query = search ?? (typeof window !== "undefined" ? window.location.search : "");
  return new URLSearchParams(query).has("preview");
}

type WailsBridge = {
  environment?: unknown;
  invoke?: unknown;
  clientId?: unknown;
  flags?: unknown;
};

type NativeHostWindow = Window & {
  go?: unknown;
  wails?: { invoke?: unknown };
  chrome?: { webview?: { postMessage?: unknown } };
  webkit?: { messageHandlers?: { external?: { postMessage?: unknown } } };
  _wails?: WailsBridge;
};

/**
 * True when a real desktop webview IPC bridge is present.
 *
 * Important: importing `@wailsio/runtime` always creates `window._wails = {}` and
 * assigns `invoke`/`clientId` even in plain Vite — those must NOT count as native.
 * `environment` is filled asynchronously by the host after ready (race). Prefer the
 * same native IPC probes Wails itself uses in system.js.
 */
function hasNativeIPC(host: NativeHostWindow): boolean {
  try {
    if (host.chrome?.webview?.postMessage) return true; // Windows WebView2
    if (host.webkit?.messageHandlers?.external?.postMessage) return true; // Linux/macOS WebKit
    if (host.wails?.invoke) return true; // Android
  } catch {
    /* ignore */
  }
  return false;
}

export function hasNativeHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window as NativeHostWindow;
  const bridge = host._wails;
  if (bridge && typeof bridge === "object" && bridge.environment != null) return true;
  if (hasNativeIPC(host)) return true;
  // Legacy bridges
  if (host.wails != null) return true;
  if (host.go != null) return true;
  return false;
}

export function previewUrl(href = typeof window !== "undefined" ? window.location.href : "http://127.0.0.1:5173/"): string {
  const url = new URL(href);
  url.searchParams.set("preview", "");
  return url.href;
}
