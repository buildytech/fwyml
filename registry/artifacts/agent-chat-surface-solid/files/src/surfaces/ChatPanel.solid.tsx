import { For, Show } from "solid-js";
import { Block, Box, Button, Icon, Label, List, ListItem, Stack, Text, Textarea, Title } from "$ui8kit/ui";
import type { ReduceMessage } from "$lib/event-reduce";
import type { copy as Copy } from "$lib/copy";

export function ChatPanel(props: {
  copy: typeof Copy;
  messages: ReduceMessage[];
  draft: string;
  busy: boolean;
  runtimeNote?: string;
  onDraft: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
}) {
  const roleLabel = (role: ReduceMessage["role"]) => {
    if (role === "user") return props.copy.roleUser;
    if (role === "thinking") return props.copy.roleThinking;
    if (role === "tool") return props.copy.roleTool;
    return props.copy.roleAssistant;
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (!props.busy) props.onSend();
  };

  const note = () => props.runtimeNote?.trim() || props.copy.offlineAgent;

  return (
    <Block tag="aside" class="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-2 bg-card" aria-label={props.copy.chatTitle} data-agent-ready="false">
      <Title as={2} class="m-0 flex h-8 shrink-0 items-center gap-2 border-b border-border px-2 text-xs font-medium">
        <Icon type="svg" href="/icons.svg#chat" />{props.copy.chatTitle}
      </Title>
      <Show
        when={props.messages.length > 0}
        fallback={<Text class="flex-1 p-4 text-xs text-muted-foreground">{props.copy.chatEmpty}</Text>}
      >
        <List class="m-0 flex min-h-0 flex-1 list-none flex-col gap-4 overflow-auto p-4" aria-live="polite">
          <For each={props.messages}>
            {(message) => (
              <ListItem class="m-0">
                <Stack class="gap-1">
                  <Text class="text-xs font-medium text-muted-foreground">
                    {roleLabel(message.role)}
                    {message.streaming ? ` ${props.copy.streamingLabel}` : ""}
                  </Text>
                  <Text class="whitespace-pre-wrap text-xs">{message.text}</Text>
                </Stack>
              </ListItem>
            )}
          </For>
        </List>
      </Show>
      <Box class="m-2 shrink-0 rounded-lg border border-border bg-background p-2">
        <Label class="sr-only" htmlFor="chat-draft">{props.copy.composerLabel}</Label>
        <Textarea
          id="chat-draft"
          class="min-h-24 resize-none border-0 bg-transparent p-2 text-xs shadow-none"
          rows={4}
          value={props.draft}
          disabled={props.busy}
          aria-label={props.copy.composerLabel}
          placeholder={props.copy.composerPlaceholder}
          onInput={(event: InputEvent & { currentTarget: HTMLTextAreaElement }) =>
            props.onDraft(event.currentTarget.value)
          }
          onKeyDown={onKeyDown}
        />
      <Text class="px-2 text-xs text-muted-foreground" role="status">{note()}</Text>
      <Button type="button" class="ml-auto flex h-8 w-8" aria-label={props.copy.sendLabel} variant="default" disabled={props.busy || !props.draft.trim()} onClick={() => props.onSend()}>
        <Icon type="svg" href="/icons.svg#send" />
      </Button>
      <Show when={props.busy}>
        <Button type="button" variant="outline" aria-label={props.copy.stopLabel} onClick={() => props.onStop()}>
          {props.copy.stopLabel}
        </Button>
      </Show>
      </Box>
      <Text class="px-4 pb-2 text-xs text-muted-foreground">{props.copy.composerHint}</Text>
    </Block>
  );
}
