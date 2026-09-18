import { autocompletion, type CompletionContext } from "@codemirror/autocomplete";
import { linter, type Diagnostic } from "@codemirror/lint";
import { openSearchPanel, gotoLine } from "@codemirror/search";
import { createEffect, createSignal, on, onCleanup, untrack } from "solid-js";
import { basicSetup } from "codemirror";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView, hoverTooltip, keymap } from "@codemirror/view";
import { Block, Box } from "$ui8kit/ui";
import { languageSupportForPath } from "$lib/editor-languages";
import { detectLineEnding, normalizeEditorText, serializeEditorText, type LineEnding } from "$lib/editor-document";
import { editorLayoutExtensions, type EditorLayoutPrefs } from "$lib/editor-prefs";
import { studioSyntaxHighlighting, workspaceEditorTheme } from "$lib/editor-theme";
import { gitDecorationExt, setGitDiffMarks } from "$lib/git-decorations";
import type { DiffLineMark } from "$lib/git-diff";

export function CodeEditor(props: {
  openPaths: string[];
  command?: {name: string; request: number};
  location?: {path: string; line: number; column: number; request: number} | null;
  onCursor?: (cursor: {line: number; column: number}) => void;
  onIdleCursor?: (cursor: {line: number; column: number}) => void;
  filePath: string;
  doc: string;
  layout: EditorLayoutPrefs;
  disabled?: boolean;
  editorAria: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  onOpenFile?: () => void;
  onFormat?: () => void;
  onDefinition?: () => void;
  onComplete?: (line: number, column: number) => Promise<{label: string}[]>;
  onHover?: (line: number, column: number) => Promise<string>;
  onDiagnostics?: () => Promise<{line: number; column: number; message: string}[]>;
  focusRequest?: number;
  diffMarks?: DiffLineMark[];
}) {
  const [host, setHost] = createSignal<HTMLDivElement>();
  let view: EditorView | undefined;
  const langCompartment = new Compartment();
  const editableCompartment = new Compartment();
  const layoutCompartment = new Compartment();
  let idleTimer = 0;
  let applyingExternal = false;
  let lastPath = "";
  let lineEnding: LineEnding = "\n";
  const states = new Map<string, EditorState>();
  let extensions: Extension[] = [];
  let completeFn = props.onComplete;
  let hoverFn = props.onHover;
  let diagnosticsFn = props.onDiagnostics;
  createEffect(() => {
    completeFn = props.onComplete;
    hoverFn = props.onHover;
    diagnosticsFn = props.onDiagnostics;
  });

  createEffect(() => {
    const el = host();
    if (!el) return;

    const initialDoc = untrack(() => props.doc);
    const initialPath = untrack(() => props.filePath);
    const initiallyEditable = untrack(() => !props.disabled);
    lineEnding = detectLineEnding(initialDoc);

    const next = new EditorView({
      parent: el,
      state: EditorState.create({
        doc: normalizeEditorText(initialDoc),
        extensions: extensions = [
          basicSetup,
          EditorView.contentAttributes.of({"aria-label": props.editorAria}),
          workspaceEditorTheme,
          gitDecorationExt,
          studioSyntaxHighlighting,
          langCompartment.of(languageSupportForPath(initialPath)),
          layoutCompartment.of(editorLayoutExtensions(untrack(() => props.layout))),
          editableCompartment.of(EditorView.editable.of(initiallyEditable)),
          EditorView.updateListener.of((update) => {
            if(update.docChanged || update.selectionSet) {
              const head = update.state.selection.main.head;
              const line = update.state.doc.lineAt(head);
              const cursor = {line:line.number,column:head-line.from+1};
              props.onCursor?.(cursor);
              window.clearTimeout(idleTimer);
              idleTimer = window.setTimeout(() => props.onIdleCursor?.(cursor), 400);
            }
            if (!update.docChanged || applyingExternal) return;
            props.onChange(serializeEditorText(update.state.doc.toString(), lineEnding));
          }),
          linter(async (view): Promise<Diagnostic[]> => {
            const doc = view.state.doc; const path = lastPath;
            const rows = await diagnosticsFn?.() ?? [];
            if (view.state.doc !== doc || lastPath !== path) return [];
            return rows.map(row => {
              const line = view.state.doc.line(Math.min(Math.max(1, row.line), view.state.doc.lines));
              const from = Math.min(line.to, line.from + Math.max(0, row.column - 1));
              return { from, to: Math.min(line.to, from + 1), severity: "error", message: row.message };
            });
          }, { delay: 800 }),
          autocompletion({
            override: [
              async (context: CompletionContext) => {
                const word = context.matchBefore(/[\w$]+/);
                if (!word && !context.explicit) return null;
                const line = context.state.doc.lineAt(context.pos);
                const items = await completeFn?.(line.number, context.pos - line.from + 1) ?? [];
                return {
                  from: word?.from ?? context.pos,
                  options: items.map(item => ({ label: item.label, type: "variable" })),
                };
              },
            ],
          }),
          hoverTooltip(async (view, pos) => {
            const line = view.state.doc.lineAt(pos);
            const text = await hoverFn?.(line.number, pos - line.from + 1) ?? "";
            if (!text) return null;
            return {
              pos,
              above: true,
              create() {
                const dom = document.createElement("div");
                dom.className = "max-w-xs rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground";
                dom.textContent = text;
                return { dom };
              },
            };
          }),
          keymap.of([
            {
              key: "Mod-s",
              run: () => {
                props.onSave?.();
                return true;
              },
            },
            {
              key: "Mod-Shift-s",
              run: () => {
                props.onSaveAs?.();
                return true;
              },
            },
            {
              key: "Mod-o",
              run: () => {
                props.onOpenFile?.();
                return true;
              },
            },
            {
              key: "Shift-Alt-f",
              run: () => {
                props.onFormat?.();
                return true;
              },
            },
            {
              key: "F12",
              run: () => {
                props.onDefinition?.();
                return true;
              },
            },
          ]),
        ],
      }),
    });
    view = next;
    lastPath = initialPath;

    onCleanup(() => {
      window.clearTimeout(idleTimer);
      next.destroy();
      if (view === next) view = undefined;
    });
  });

  createEffect(() => {
    const nextDoc = props.doc;
    const path = props.filePath;
    const disabled = Boolean(props.disabled);
    const layout = props.layout;
    const current = view;
    if (!current) return;
    const normalizedDoc = normalizeEditorText(nextDoc);
    lineEnding = detectLineEnding(nextDoc, path === lastPath ? lineEnding : "\n");

    if (path !== lastPath) {
      if(props.openPaths.includes(lastPath)) states.set(lastPath, current.state);
      for(const cached of states.keys()) if(!props.openPaths.includes(cached)) states.delete(cached);
      lastPath = path;
      applyingExternal = true;
      current.setState(states.get(path) ?? EditorState.create({doc: normalizedDoc, extensions}));
      current.dispatch({effects: langCompartment.reconfigure(languageSupportForPath(path))});
      applyingExternal = false;
    }
    if (current.state.doc.toString() !== normalizedDoc) {
      applyingExternal = true;
      current.dispatch({
        changes: { from: 0, to: current.state.doc.length, insert: normalizedDoc },
      });
      applyingExternal = false;
    }

    const head = current.state.selection.main.head;
    const line = current.state.doc.lineAt(head);
    props.onCursor?.({line:line.number,column:head-line.from+1});
    current.dispatch({
      effects: [
        editableCompartment.reconfigure(EditorView.editable.of(!disabled)),
        layoutCompartment.reconfigure(editorLayoutExtensions(layout)),
        setGitDiffMarks.of(untrack(() => props.diffMarks ?? [])),
      ],
    });
  });

  createEffect(on(() => props.diffMarks, marks => {
    if (!view) return;
    view.dispatch({ effects: setGitDiffMarks.of(marks ?? []) });
  }));

  createEffect(on(() => props.command, command => {
    if (!view || !command?.request) return;
    if (command.name === "find") openSearchPanel(view);
    if (command.name === "line") gotoLine(view);
  }));
  createEffect(() => {
    const location = props.location;
    const path = props.filePath;
    if(!view || !location || location.path !== path) return;
    const line = view.state.doc.line(Math.min(location.line,view.state.doc.lines));
    view.dispatch({selection:{anchor:Math.min(line.to,line.from+location.column-1)},scrollIntoView:true});
    view.focus();
  });
  createEffect(on(() => props.focusRequest, request => {
    if (!view || !request) return;
    view.focus();
  }));

  return (
    <Block class="flex min-h-0 flex-1 flex-col" aria-label={props.editorAria}>
      <Box
        ref={setHost}
        class="min-h-0 min-w-0 flex-1 overflow-hidden"
        style={{ background: "var(--cm-editor-bg)" }}
      />
    </Block>
  );
}
