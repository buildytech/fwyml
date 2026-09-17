<script lang="ts">
  import Chat from "./surfaces/Chat.svelte";
  import Editor from "./surfaces/Editor.svelte";
  import Explorer from "./surfaces/Explorer.svelte";
  import * as HostService from "../frontend/bindings/example.com/app/compose/hostservice.js";
  import * as VCSService from "../frontend/bindings/example.com/app/compose/vcsservice.js";
  import * as WorkspaceService from "../frontend/bindings/example.com/app/compose/workspaceservice.js";

  let label = $state("no folder");
  let git = $state("");
  let error = $state("");
  let selected = $state("");
  let refresh = $state(0);

  async function openFolder() {
    error = "";
    try {
      const path = await HostService.PickFolder();
      if (!path) {
        return;
      }
      const snap = await WorkspaceService.OpenWorkspace(path);
      label = snap.label || "folder";
      selected = "";
      refresh += 1;
      git = (await VCSService.Status().catch(() => "")) || "not a git repository";
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }
</script>

<div class="shell">
  <header class="bar">
    <strong>workshop-svelte-agent</strong>
    <button type="button" onclick={openFolder}>Open folder</button>
    <span class="muted">{label}</span>
    <span class="muted">{git}</span>
    {#if error}
      <span class="fault">{error}</span>
    {/if}
  </header>
  <div class="columns">
    <Explorer {refresh} onOpen={(path) => (selected = path)} />
    <Editor path={selected} />
    <Chat />
  </div>
</div>
