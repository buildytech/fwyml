export type LineEnding = "\n" | "\r\n" | "\r";

/** CodeMirror uses logical LF lines internally, regardless of disk format. */
export function normalizeEditorText(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

/** Keep the first disk line ending; retain it when the buffer has no newline. */
export function detectLineEnding(text: string, fallback: LineEnding = "\n"): LineEnding {
  return (text.match(/\r\n|\r|\n/)?.[0] as LineEnding | undefined) ?? fallback;
}

export function serializeEditorText(text: string, ending: LineEnding): string {
  return normalizeEditorText(text).replace(/\n/g, ending);
}
