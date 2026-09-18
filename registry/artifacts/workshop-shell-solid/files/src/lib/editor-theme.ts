import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

/**
 * CodeMirror chrome from BuildY Studio (`apps/web/src/editor/theme.ts`).
 * Syntax comes from theme.css --cm-* tokens so HinddY can swap blues for orange.
 */
export const workspaceEditorTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: "var(--cm-editor-bg)",
      color: "var(--cm-editor-fg)",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-scroller": {
      fontFamily: "var(--font-mono)",
      lineHeight: "1.45",
      overflow: "auto",
    },
    ".cm-content": {
      caretColor: "var(--primary)",
      padding: "0.5rem 0",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--primary)",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: "var(--cm-selection) !important",
      },
    ".cm-activeLine": {
      backgroundColor: "color-mix(in srgb, var(--cm-editor-fg) 5%, transparent)",
    },
    ".cm-gutters": {
      backgroundColor: "var(--cm-editor-gutter)",
      color: "var(--cm-meta)",
      border: "none",
      borderRight: "1px solid color-mix(in oklab, var(--cm-editor-fg) 12%, transparent)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "color-mix(in srgb, var(--cm-editor-fg) 8%, transparent)",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "var(--muted)",
      border: "none",
      color: "var(--muted-foreground)",
    },
    ".cm-panels": { backgroundColor: "var(--card)", color: "var(--foreground)" },
    ".cm-search input": { backgroundColor: "var(--background)", color: "var(--foreground)" },
    ".cm-tooltip": {
      backgroundColor: "var(--popover)",
      border: "1px solid var(--border)",
      color: "var(--popover-foreground)",
    },
  },
  { dark: true },
);

/** Syntax comes from theme.css --cm-* tokens so HinddY can swap blues for orange. */
const studioHighlight = HighlightStyle.define([
  { tag: t.keyword, color: "var(--cm-keyword)" },
  { tag: t.operator, color: "var(--cm-editor-fg)" },
  { tag: t.special(t.variableName), color: "var(--cm-special)" },
  { tag: t.typeName, color: "var(--cm-type)" },
  { tag: t.className, color: "var(--cm-type)" },
  { tag: t.propertyName, color: "var(--cm-property)" },
  { tag: t.variableName, color: "var(--cm-editor-fg)" },
  { tag: t.definition(t.variableName), color: "var(--cm-editor-fg)" },
  { tag: t.function(t.variableName), color: "var(--cm-function)" },
  { tag: t.string, color: "var(--cm-string)" },
  { tag: t.special(t.string), color: "var(--cm-string)" },
  { tag: t.number, color: "var(--cm-number)" },
  { tag: t.bool, color: "var(--cm-number)" },
  { tag: t.null, color: "var(--cm-number)" },
  { tag: t.comment, color: "var(--cm-comment)", fontStyle: "italic" },
  { tag: t.meta, color: "var(--cm-meta)" },
  { tag: t.tagName, color: "var(--cm-keyword)" },
  { tag: t.attributeName, color: "var(--cm-type)" },
  { tag: t.attributeValue, color: "var(--cm-string)" },
  { tag: t.heading, color: "var(--cm-special)", fontWeight: "bold" },
  { tag: t.link, color: "var(--cm-function)" },
  { tag: t.url, color: "var(--cm-function)" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.invalid, color: "var(--cm-invalid)" },
]);

export const studioSyntaxHighlighting = syntaxHighlighting(studioHighlight);
