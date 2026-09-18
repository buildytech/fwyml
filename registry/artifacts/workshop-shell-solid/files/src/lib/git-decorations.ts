import { RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import type { DiffLineMark } from "./git-diff";

export const setGitDiffMarks = StateEffect.define<DiffLineMark[]>();

const addLine = Decoration.line({ class: "cm-git-add" });
const delLine = Decoration.line({ class: "cm-git-del" });

function buildSet(doc: { line: (n: number) => { from: number }; lines: number }, marks: DiffLineMark[]): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const byLine = new Map<number, DiffLineMark["kind"]>();
  for (const mark of marks) {
    if (mark.line < 1 || mark.line > doc.lines) continue;
    if (byLine.get(mark.line) === "add") continue;
    byLine.set(mark.line, mark.kind);
  }
  for (const line of [...byLine.keys()].sort((a, b) => a - b)) {
    const kind = byLine.get(line);
    builder.add(doc.line(line).from, doc.line(line).from, kind === "add" ? addLine : delLine);
  }
  return builder.finish();
}

const gitDiffField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setGitDiffMarks)) return buildSet(transaction.state.doc, effect.value);
    }
    if (transaction.docChanged) return value.map(transaction.changes);
    return value;
  },
  provide: field => EditorView.decorations.from(field),
});

export const gitDecorationExt = [
  gitDiffField,
  EditorView.baseTheme({
    ".cm-git-add": {
      backgroundColor: "color-mix(in srgb, var(--cm-diff-add) 18%, transparent)",
    },
    ".cm-git-del": {
      backgroundColor: "color-mix(in srgb, var(--cm-diff-del) 16%, transparent)",
    },
  }),
];
