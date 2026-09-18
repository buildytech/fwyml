import { EditorY } from "@ui8kit/editory-solid";
import "@ui8kit/editory-solid/style.css";
import { createEffect } from "solid-js";
import { Block } from "$ui8kit/ui";
import type { copy as Copy } from "$lib/copy";
import { visualMarkdownGate } from "$lib/markdown-gate";

// Host policy only. Do not wrap EditorY in another app package.

export function MarkdownEditor(props: {
  copy: typeof Copy;
  markdown: string;
  title: string;
  onMarkdown: (value: string) => void;
  onOpenSource: () => void;
}) {
  let first = true;
  let original = props.markdown;
  createEffect(() => {
    original = props.markdown;
    first = true;
    props.title;
  });
  return (
    <Block class="min-h-0 flex-1 overflow-auto" aria-label={props.copy.markdownVisual}>
      <EditorY
        markdown={props.markdown}
        labels={props.copy.longread}
        onMarkdown={(value: string) => {
          const gate = visualMarkdownGate(original, value, first);
          first = false;
          if (gate === "ignore") return;
          if (gate === "source") {
            props.onOpenSource();
            return;
          }
          props.onMarkdown(value);
        }}
        title={props.title}
        onOpenMarkdown={props.onOpenSource}
      />
    </Block>
  );
}
