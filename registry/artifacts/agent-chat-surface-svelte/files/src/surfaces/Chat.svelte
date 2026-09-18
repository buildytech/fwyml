<script lang="ts">
  import Button from "../../packages/ui8kit-svelte/generated/ui/button/Button.svelte";
  import Badge from "../../packages/ui8kit-svelte/generated/ui/badge/Badge.svelte";

  type Message = {
    id: number;
    role: "assistant" | "user";
    text: string;
  };

  let draft = $state("");
  let messages = $state<Message[]>([
    {
      id: 1,
      role: "assistant",
      text: "Svelte agent panel is live. UI8Kit codegen Button/Badge bricks are wired. Runtime is still a stub.",
    },
  ]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    const id = Date.now();
    messages = [
      ...messages,
      { id, role: "user", text },
      {
        id: id + 1,
        role: "assistant",
        text: "Local stub reply — agent runtime is not wired in this slice.",
      },
    ];
    draft = "";
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }
</script>

<div class="chat" data-surface="agent-chat" data-ui8kit-bricks="button,badge">
  <div class="chat-header">
    <span>Chat</span>
    <Badge class="ide-codegen-badge" variant="secondary" size="sm">codegen</Badge>
  </div>
  <div class="chat-messages" role="log" aria-live="polite">
    {#each messages as message (message.id)}
      <article class={`msg ${message.role}`}>
        <span class="role">{message.role}</span>
        {message.text}
      </article>
    {/each}
  </div>
  <div class="chat-composer">
    <label class="muted" for="chat-draft">Message</label>
    <textarea
      id="chat-draft"
      bind:value={draft}
      placeholder="Write a message…"
      aria-label="Chat message"
      onkeydown={onKeyDown}
    ></textarea>
    <div class="chat-actions">
      <Button class="ide-send" variant="default" size="sm" disabled={!draft.trim()} onclick={send}>
        Send
      </Button>
    </div>
  </div>
</div>
