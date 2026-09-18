import type { JSX } from "solid-js";
import { FileTree } from "./FileTree.solid";
import { copy } from "$lib/copy";
import type { WorkspaceTreeNode } from "$lib/workspace-tree";

export type ExplorerNode = WorkspaceTreeNode;

export function Explorer(props: {
  label?: string;
  nodes: ExplorerNode[];
  selected: string;
  onOpen: (path: string) => void;
  attached?: boolean;
  truncated?: boolean;
  skipped?: boolean;
}): JSX.Element {
  return (
    <FileTree
      copy={copy}
      nodes={props.nodes}
      selected={props.selected}
      attached={props.attached ?? true}
      label={props.label ?? copy.treeTitle}
      onOpen={props.onOpen}
      truncated={props.truncated}
      skipped={props.skipped}
    />
  );
}
