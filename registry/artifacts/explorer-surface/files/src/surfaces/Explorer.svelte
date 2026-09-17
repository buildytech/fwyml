<script lang="ts">
  import * as ExplorerService from "../../frontend/bindings/example.com/app/compose/explorerservice.js";

  let { refresh = 0, onOpen }: { refresh?: number; onOpen: (path: string) => void } = $props();
  let nodes = $state<{ path: string; name: string; isDir: boolean }[]>([]);
  let empty = $state("Open a folder to list files.");

  $effect(() => {
    void refresh;
    ExplorerService.Tree()
      .then((rows) => {
        nodes = rows ?? [];
        empty = nodes.length === 0 ? "Folder is empty." : "";
      })
      .catch(() => {
        nodes = [];
        empty = "Open a folder to list files.";
      });
  });
</script>

<aside class="pane">
  <h2>Explorer</h2>
  {#if empty}
    <p class="muted">{empty}</p>
  {/if}
  <div class="tree">
    {#each nodes as node}
      <button type="button" onclick={() => !node.isDir && onOpen(node.path)}>
        {node.isDir ? "dir" : "file"} {node.name}
      </button>
    {/each}
  </div>
</aside>
