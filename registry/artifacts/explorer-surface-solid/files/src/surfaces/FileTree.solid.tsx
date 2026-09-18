import { contextStyle } from "$lib/context-actions";
import { For, Show, createSignal, createEffect } from "solid-js";
import { Block, Box, Button, Icon, List, ListItem, Stack, Text, Title } from "$ui8kit/ui";
import type { copy as Copy } from "$lib/copy";
import type { WorkspaceTreeNode } from "$lib/workspace-tree";

export function FileTree(props: {
  copy: typeof Copy;
  nodes: WorkspaceTreeNode[];
  selected: string;
  attached: boolean;
  label: string;
  onOpen: (path: string) => void;
  truncated?: boolean;
  skipped?: boolean;
}) {
  const [collapse, setCollapse] = createSignal(0);
  return (
    <Block data-context-scope="tree-root" data-context-path="" style={contextStyle("tree-root", "")} tag="aside" class="flex h-full min-h-0 min-w-0 flex-col bg-card" aria-label={props.copy.treeTitle}>
      <Stack class="min-h-0 flex-1 gap-0 p-0">
        <Box class="flex h-8 shrink-0 items-center justify-between gap-1 border-b border-border px-2">
        <Title as={2} class="m-0 min-w-0 truncate px-2 text-xs font-medium">
          {props.label}
        </Title>
        <Button variant="ghost" class="h-8 w-8 shrink-0" title={props.copy.collapseFolders} aria-label={props.copy.collapseFolders} onClick={() => setCollapse(v => v+1)}><Icon type="svg" href="/icons.svg#folder" size="xs" /></Button>
        </Box>
        <Show
          when={props.attached}
          fallback={<Text class="text-sm text-muted-foreground">{props.copy.treeEmpty}</Text>}
        >
          <Show
            when={props.nodes.length > 0}
            fallback={<Text class="text-sm text-muted-foreground">{props.copy.treeNoFiles}</Text>}
          >
            <Show when={props.skipped}><Text class="px-2 text-xs text-muted-foreground">{props.copy.treeSkipped}</Text></Show>
            <Show when={props.truncated}><Text class="px-2 text-xs text-muted-foreground">{props.copy.treeLimited}</Text></Show>
            <List class="m-0 min-h-0 flex-1 list-none overflow-auto p-0">
              <For each={props.nodes}>
                {(node) => (
                  <TreeBranch
                    collapse={collapse()}
                    node={node}
                    depth={0}
                    selected={props.selected}
                    folderLabel={props.copy.treeFolder}
                    fileLabel={props.copy.treeFile}
                    dirOpen={props.copy.treeDirOpen}
                    dirClosed={props.copy.treeDirClosed}
                    onOpen={props.onOpen}
                  />
                )}
              </For>
            </List>
          </Show>
        </Show>
      </Stack>
    </Block>
  );
}

function TreeBranch(props: {
  collapse: number;
  node: WorkspaceTreeNode;
  depth: number;
  selected: string;
  folderLabel: string;
  fileLabel: string;
  dirOpen: string;
  dirClosed: string;
  onOpen: (path: string) => void;
}) {
  const kids = () => props.node.children ?? [];
  const [open, setOpen] = createSignal(props.depth < 1);
  createEffect(() => {if(props.collapse) setOpen(false);});
  createEffect(() => {if(props.node.dir && props.selected.startsWith(props.node.path+"/")) setOpen(true);});
  return (
    <ListItem class="m-0 list-none">
      <Button
        type="button"
        variant="ghost"
        class={`h-6 w-full justify-start gap-2 rounded-none px-2 text-xs ${props.selected === props.node.path ? "bg-accent" : ""}`}
        data-context-scope={props.node.dir ? "tree-folder" : "tree-file"}
        data-context-path={props.node.path}
        style={{ ...contextStyle(props.node.dir ? "tree-folder" : "tree-file", props.node.path), "padding-left": `${8 + props.depth * 16}px` }}
        title={props.node.path}
        aria-current={!props.node.dir && props.selected === props.node.path ? "page" : undefined}
        aria-expanded={props.node.dir ? open() : undefined}
        aria-label={`${props.node.dir ? props.folderLabel : props.fileLabel} ${props.node.name}`}
        onClick={() => {
          if (props.node.dir) setOpen((value) => !value);
          else props.onOpen(props.node.path);
        }}
      >
        <Icon type="svg" href={`/icons.svg#${props.node.dir ? (open() ? "chevron-down" : "chevron-right") : "file"}`} size="xs" />{props.node.name}
      </Button>
      <Show when={props.node.dir && open() && kids().length > 0}>
        <List class="m-0 list-none p-0">
          <For each={kids()}>
            {(child) => (
              <TreeBranch
                collapse={props.collapse}
                node={child}
                depth={props.depth + 1}
                selected={props.selected}
                folderLabel={props.folderLabel}
                fileLabel={props.fileLabel}
                dirOpen={props.dirOpen}
                dirClosed={props.dirClosed}
                onOpen={props.onOpen}
              />
            )}
          </For>
        </List>
      </Show>
    </ListItem>
  );
}
