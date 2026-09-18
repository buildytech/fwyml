<script lang="ts" module>
  export type EditorTab = { path: string; dirty?: boolean };
</script>

<script lang="ts">
  let {
    tabs,
    activePath,
    value,
    onSelect,
    onClose,
    onChange,
  }: {
    tabs: EditorTab[];
    activePath: string;
    value: string;
    onSelect: (path: string) => void;
    onClose: (path: string) => void;
    onChange: (value: string) => void;
  } = $props();

  const label = (path: string) => path.split("/").pop() || path;
</script>

<section class="ide-editor" data-surface="editor" aria-label="Editor">
  <div class="ide-tabs" role="tablist" aria-label="Open editors">
    {#each tabs as tab (tab.path)}
      <div class={`ide-tab ${activePath === tab.path ? "is-active" : ""}`} role="presentation">
        <button
          type="button"
          role="tab"
          aria-selected={activePath === tab.path}
          class="ide-tab-label"
          title={tab.path}
          onclick={() => onSelect(tab.path)}
        >
          {label(tab.path)}
          {#if tab.dirty}<span class="ide-dirty">•</span>{/if}
        </button>
        <button
          type="button"
          class="ide-tab-close"
          aria-label={`Close ${label(tab.path)}`}
          onclick={() => onClose(tab.path)}
        >
          ×
        </button>
      </div>
    {/each}
  </div>
  {#if activePath}
    <textarea
      class="ide-code"
      spellcheck={false}
      aria-label={activePath}
      {value}
      oninput={(event) => onChange(event.currentTarget.value)}
    ></textarea>
  {:else}
    <div class="ide-editor-empty muted">Open a file from the explorer</div>
  {/if}
</section>
