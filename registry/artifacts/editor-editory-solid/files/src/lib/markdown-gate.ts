export type MarkdownGate = "ignore" | "source" | "apply";

/** First visual emit that rewrites the file must not replace the user's source. */
export function visualMarkdownGate(original: string, next: string, first: boolean): MarkdownGate {
  if (first) {
    return next === original ? "ignore" : "source";
  }
  return "apply";
}
