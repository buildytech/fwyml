<script lang="ts">
  import * as AgentService from "../../frontend/bindings/example.com/app/compose/agentservice.js";

  let prompt = $state("");
  let log = $state("Agent sidecar is not extracted. Prompts fail closed.");

  async function send() {
    const text = prompt.trim();
    if (!text) {
      return;
    }
    try {
      await AgentService.Prompt("local", text);
      log = "run started";
    } catch (err) {
      log = err instanceof Error ? err.message : String(err);
    }
  }
</script>

<aside class="pane chat">
  <h2>Agent</h2>
  <p class="fault">{log}</p>
  <textarea bind:value={prompt} placeholder="Prompt"></textarea>
  <button type="button" onclick={send}>Send</button>
</aside>
