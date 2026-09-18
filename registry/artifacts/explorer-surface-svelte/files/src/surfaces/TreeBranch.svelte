<script lang="ts">
  import type { ExplorerNode } from "./Explorer.svelte";
  import TreeBranch from "./TreeBranch.svelte";

  let {
    node,
    depth,
    selected,
    onOpen,
  }: {
    node: ExplorerNode;
    depth: number;
    selected: string;
    onOpen: (path: string) => void;
  } = $props();

  let kids = $derived(node.children ?? []);
  let open = $state(depth < 1 || selected.startsWith(node.path + "/"));
</script>

<li class="ide-tree-item" role="treeitem" aria-expanded={node.dir ? open : undefined}>
  <button
    type="button"
    class={`ide-tree-row ${selected === node.path ? "is-selected" : ""}`}
    style={`padding-left:${8 + depth * 12}px`}
    onclick={() => {
      if (node.dir) open = !open;
      else onOpen(node.path);
    }}
  >
    {#if node.dir}
      <span class="ide-tree-icon">{open ? "📂" : "📁"}</span>
    {:else}
      <span class="ide-tree-icon">📄</span>
    {/if}
    <span class="ide-tree-name">{node.name}</span>
  </button>
  {#if node.dir && open}
    <ul class="ide-tree" role="group">
      {#each kids as child (child.path)}
        <TreeBranch node={child} depth={depth + 1} {selected} {onOpen} />
      {/each}
    </ul>
  {/if}
</li>
