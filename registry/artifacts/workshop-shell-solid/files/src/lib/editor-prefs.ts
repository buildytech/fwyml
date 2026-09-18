import { indentUnit } from "@codemirror/language";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { FontScale, TabSize, UiZoom } from "./prefs";

export type EditorLayoutPrefs = {
  tabSize: TabSize;
  lineWrap: boolean;
  fontScale: FontScale;
  uiZoom: UiZoom;
};

export function fontSizePx(scale: FontScale): string {
  if (scale === "sm") return "12px";
  if (scale === "lg") return "14px";
  return "13px";
}

/** Layout-only CodeMirror extensions. Language and colors stay code-owned. */
export function editorLayoutExtensions(prefs: EditorLayoutPrefs): Extension {
  return [
    EditorState.tabSize.of(prefs.tabSize),
    indentUnit.of(" ".repeat(prefs.tabSize)),
    prefs.lineWrap ? EditorView.lineWrapping : [],
    EditorView.theme({
      "&": { fontSize: fontSizePx(prefs.fontScale) },
    }),
  ];
}
