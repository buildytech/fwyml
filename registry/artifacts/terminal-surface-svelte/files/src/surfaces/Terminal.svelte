<script lang="ts">
  let {
    title = "Terminal",
    lines: initialLines,
  }: {
    title?: string;
    lines?: string[];
  } = $props();

  let lines = $state<string[]>(
    initialLines ?? [
      "BuildY preview terminal (in-memory)",
      "Integrated PTY requires Windows host — Linux shows preview session.",
      "$ ",
    ],
  );
  let draft = $state("");
  let scroller: HTMLDivElement | undefined = $state();

  $effect(() => {
    lines;
    queueMicrotask(() => scroller?.scrollTo(0, scroller.scrollHeight));
  });

  function run() {
    const text = draft.trimEnd();
    if (!text) return;
    if (text === "clear") {
      lines = ["$ "];
    } else {
      lines = [...lines.slice(0, -1), `$ ${text}`, `preview: recorded “${text}” (no PTY on this host)`, "$ "];
    }
    draft = "";
  }
</script>

<section class="ide-terminal" data-surface="terminal" aria-label={title}>
  <div class="ide-panel-header ide-terminal-header">
    <span>{title}</span>
    <span class="muted">preview</span>
  </div>
  <div class="ide-terminal-body" bind:this={scroller} role="log" aria-live="polite">
    {#each lines as line, i (i)}
      <div class="ide-terminal-line">{line}</div>
    {/each}
  </div>
  <div class="ide-terminal-input">
    <span class="muted">$</span>
    <input
      aria-label="Terminal input"
      bind:value={draft}
      onkeydown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          run();
        }
      }}
    />
  </div>
</section>
