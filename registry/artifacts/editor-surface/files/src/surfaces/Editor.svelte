<script lang="ts">
  import * as EditorService from "../../frontend/bindings/example.com/app/compose/editorservice.js";
  import * as WorkspaceService from "../../frontend/bindings/example.com/app/compose/workspaceservice.js";

  let { path = "" }: { path?: string } = $props();
  let value = $state("");
  let revision = $state("");
  let kind = $state("textarea");
  let status = $state("EditorY package is not installed. This surface uses the editor@0 buffer.");

  $effect(() => {
    if (!path) {
      value = "";
      revision = "";
      return;
    }
    WorkspaceService.ReadFile(path)
      .then((body) => {
        value = body.text;
        revision = body.revision;
        return EditorService.Open(body.Text);
      })
      .then(async () => {
        kind = await EditorService.Kind();
      })
      .catch((err: unknown) => {
        status = err instanceof Error ? err.message : String(err);
      });
  });

  async function save() {
    if (!path) {
      return;
    }
    const result = await WorkspaceService.WriteFile(path, value, revision);
    if (!result.ok) {
      status = `write conflict: ${result.conflict}`;
      return;
    }
    revision = result.body.revision;
    await EditorService.Update(value, 0, value.length);
    status = `saved ${path}`;
  }
</script>

<section class="pane">
  <h2>Editor</h2>
  <p class="muted">{path || "No file"} · {kind}</p>
  <textarea bind:value disabled={!path}></textarea>
  <p>
    <button type="button" disabled={!path} onclick={save}>Save</button>
    <span class="muted">{status}</span>
  </p>
</section>
