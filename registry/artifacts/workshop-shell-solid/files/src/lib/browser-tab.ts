export const browserPrefix = "browser:";

export type BrowserDoc = {
  url: string;
  title: string;
};

export const defaultBrowserURL = "https://example.com";

export function isBrowserPath(path: string): boolean {
  return path.startsWith(browserPrefix);
}

export function nextBrowserPath(used: Iterable<string>): string {
  let n = 1;
  const taken = new Set(used);
  while (taken.has(`${browserPrefix}${n}`)) n += 1;
  return `${browserPrefix}${n}`;
}

export function parseBrowserDoc(text: string): BrowserDoc {
  try {
    const row = JSON.parse(text) as Partial<BrowserDoc>;
    if (row && typeof row.url === "string") {
      return {
        url: row.url,
        title: typeof row.title === "string" && row.title.trim() ? row.title : browserTabLabel("", row.url),
      };
    }
  } catch {
    /* plain URL fallback */
  }
  const url = text.trim();
  return { url: url || defaultBrowserURL, title: browserTabLabel("", url || defaultBrowserURL) };
}

export function encodeBrowserDoc(doc: BrowserDoc): string {
  return JSON.stringify({ url: doc.url, title: doc.title });
}

export function browserTabLabel(path: string, url = ""): string {
  if (url && url !== "about:blank") {
    try {
      const host = new URL(url).hostname;
      if (host) return host;
    } catch {
      /* keep fallback */
    }
  }
  const n = path.startsWith(browserPrefix) ? path.slice(browserPrefix.length) : "";
  return n ? `Browser ${n}` : "Browser";
}

export function browseFault(err: unknown, disconnected: string): string {
  const text = String(err ?? "");
  if (/disconnected|wsasend|failed to write|aborted by the software/i.test(text)) {
    return disconnected;
  }
  return text;
}

export function formatBrowsePick(pick: {
  url: string;
  title?: string;
  selector: string;
  html: string;
  text: string;
}): string {
  const lines = [
    `Inspected ${pick.url || "page"}`,
    pick.selector ? `Selector: ${pick.selector}` : "",
    pick.text ? pick.text.slice(0, 400) : "",
  ].filter(Boolean);
  if (pick.html) {
    lines.push("```html", pick.html.slice(0, 2000), "```");
  }
  return lines.join("\n");
}
