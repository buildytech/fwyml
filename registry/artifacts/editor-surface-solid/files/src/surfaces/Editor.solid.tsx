import { For, Show, type JSX } from "solid-js";
import { Block, Box, Button, Text } from "$ui8kit/ui";
import { CodeEditor } from "./CodeEditor.solid";
import { copy } from "$lib/copy";
import type { EditorLayoutPrefs } from "$lib/editor-prefs";

export type EditorTab = { path: string; dirty?: boolean };

const defaultLayout: EditorLayoutPrefs = {
  fontScale: "md",
  lineNumbers: true,
  lineWrapping: false,
  tabSize: 2,
};

export function Editor(props: {
  tabs: EditorTab[];
  activePath: string;
  value: string;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onChange: (value: string) => void;
  openPaths?: string[];
  layout?: EditorLayoutPrefs;
}): JSX.Element {
  const label = (path: string) => path.split("/").pop() || path;
  return (
    <Block tag="section" class="ide-editor flex min-h-0 min-w-0 flex-1 flex-col bg-background" data-surface="editor" aria-label="Editor">
      <Box class="ide-tabs flex h-8 shrink-0 items-center gap-0 overflow-x-auto border-b border-border bg-card" role="tablist" aria-label="Open editors">
        <For each={props.tabs}>
          {(tab) => (
            <Box class={`ide-tab flex h-full items-center border-r border-border ${props.activePath === tab.path ? "bg-background" : ""}`} role="presentation">
              <Button
                type="button"
                variant="ghost"
                role="tab"
                aria-selected={props.activePath === tab.path}
                class="h-8 rounded-none px-2 text-xs"
                title={tab.path}
                onClick={() => props.onSelect(tab.path)}
              >
                {label(tab.path)}
                <Show when={tab.dirty}><Text class="text-primary">•</Text></Show>
              </Button>
              <Button
                type="button"
                variant="ghost"
                class="h-8 w-8 rounded-none px-0 text-xs"
                aria-label={`Close ${label(tab.path)}`}
                onClick={() => props.onClose(tab.path)}
              >
                ×
              </Button>
            </Box>
          )}
        </For>
      </Box>
      <Show
        when={props.activePath}
        fallback={<Box class="flex flex-1 items-center justify-center p-4"><Text class="text-sm text-muted-foreground">Open a file from the explorer</Text></Box>}
      >
        <Box class="min-h-0 flex-1">
          <CodeEditor
            openPaths={props.openPaths ?? props.tabs.map((t) => t.path)}
            filePath={props.activePath}
            doc={props.value}
            layout={props.layout ?? defaultLayout}
            editorAria={copy.editorAria}
            onChange={props.onChange}
          />
        </Box>
      </Show>
    </Block>
  );
}
