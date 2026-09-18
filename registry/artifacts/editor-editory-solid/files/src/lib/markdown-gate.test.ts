import { describe, expect, test } from "bun:test";
import { visualMarkdownGate } from "./markdown-gate";

describe("markdown-find", () => {
  test("an unchanged first visual emit does not rewrite the buffer", () => {
    expect(visualMarkdownGate("# Hi\n", "# Hi\n", true)).toBe("ignore");
  });

  test("a serializer rewrite on open switches to source instead of replacing text", () => {
    expect(visualMarkdownGate("---\ntitle: a\n---\n", "# a\n", true)).toBe("source");
  });

  test("later visual edits apply", () => {
    expect(visualMarkdownGate("# Hi\n", "# Hello\n", false)).toBe("apply");
  });

  test("a first emit that drops MDX JSX switches to source", () => {
    expect(visualMarkdownGate("# Hi\n\n<Callout />\n", "# Hi\n", true)).toBe("source");
  });
});
