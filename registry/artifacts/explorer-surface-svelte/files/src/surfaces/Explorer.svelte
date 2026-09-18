<script lang="ts" module>
  export type ExplorerNode = {
    path: string;
    name: string;
    dir?: boolean;
    children?: ExplorerNode[];
  };
</script>

<script lang="ts">
  import TreeBranch from "./TreeBranch.svelte";

  let {
    label = "Files",
    nodes,
    selected,
    onOpen,
  }: {
    label?: string;
    nodes: ExplorerNode[];
    selected: string;
    onOpen: (path: string) => void;
  } = $props();
</script>

<aside class="ide-explorer" data-surface="explorer" aria-label={label}>
  <div class="ide-panel-header">
    <span>{label}</span>
  </div>
  <ul class="ide-tree" role="tree">
    {#each nodes as node (node.path)}
      <TreeBranch {node} depth={0} {selected} {onOpen} />
    {/each}
  </ul>
</aside>
