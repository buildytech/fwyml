import { For, Show, createSignal } from "solid-js";
import { Block, Box, Button, Text, Textarea, Title } from "$ui8kit/ui";
import { copy } from "$lib/copy";

type Message = { id: number; role: "assistant" | "user"; text: string };

export function Chat() {
  const [draft, setDraft] = createSignal("");
  const [messages, setMessages] = createSignal<Message[]>([
    {
      id: 1,
      role: "assistant",
      text: "Solid agent panel uses UI8Kit bricks. Runtime wiring is still a stub.",
    },
  ]);

  const send = () => {
    const text = draft().trim();
    if (!text) return;
    const id = Date.now();
    setMessages((prev) => [
      ...prev,
      { id, role: "user", text },
      {
        id: id + 1,
        role: "assistant",
        text: "Local stub reply — agent runtime is not wired in this slice.",
      },
    ]);
    setDraft("");
  };

  return (
    <Block tag="aside" class="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-card" data-surface="agent-chat" aria-label={copy.chatTitle}>
      <Title as={2} class="m-0 flex h-8 shrink-0 items-center border-b border-border px-2 text-xs font-medium">
        {copy.chatTitle}
      </Title>
      <Show
        when={messages().length > 0}
        fallback={<Text class="flex-1 p-4 text-xs text-muted-foreground">{copy.chatEmpty}</Text>}
      >
        <Box class="m-0 flex min-h-0 flex-1 list-none flex-col gap-3 overflow-auto p-3">
          <For each={messages()}>
            {(message) => (
              <Box class="rounded-md border border-border bg-background p-2">
                <Text class="text-xs font-medium text-muted-foreground">
                  {message.role === "user" ? copy.roleUser : copy.roleAssistant}
                </Text>
                <Text class="whitespace-pre-wrap text-xs">{message.text}</Text>
              </Box>
            )}
          </For>
        </Box>
      </Show>
      <Box class="m-2 shrink-0 rounded-lg border border-border bg-background p-2">
        <Textarea
          class="min-h-20 resize-none border-0 bg-transparent p-2 text-xs shadow-none"
          rows={3}
          value={draft()}
          aria-label={copy.composerLabel}
          placeholder={copy.composerPlaceholder}
          onInput={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
        />
        <Text class="px-2 text-xs text-muted-foreground">{copy.offlineAgent}</Text>
        <Box class="flex justify-end pt-1">
          <Button type="button" class="h-8 px-3 text-xs" disabled={!draft().trim()} onClick={send}>
            {copy.sendLabel}
          </Button>
        </Box>
      </Box>
      <Text class="px-4 pb-2 text-xs text-muted-foreground">{copy.composerHint}</Text>
    </Block>
  );
}
