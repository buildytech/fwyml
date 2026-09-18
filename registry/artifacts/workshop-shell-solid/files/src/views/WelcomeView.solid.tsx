import { For, Show } from "solid-js";
import { Block, Box, Button, Icon, Stack, Text, Title } from "$ui8kit/ui";
import type { copy as Copy } from "$lib/copy";
import type { RecentWorkspace } from "$lib/session-local";

export function WelcomeView(props: {
  copy: typeof Copy;
  onOpen: () => void;
  onOpenFile: () => void;
  onNewFile: () => void;
  onSettings: () => void;
  recent: RecentWorkspace[];
  onRecent: (id: string) => void;
}) {
  return (
    <Block tag="section" class="flex min-h-0 flex-1 items-center justify-center bg-background p-8">
      <Stack class="max-w-lg gap-6">
        <Icon type="svg" href="/icons.svg#files" class="h-12 w-12 text-muted-foreground" />
        <Text class="text-xs tracking-wide text-muted-foreground">{props.copy.appTitle}</Text>
        <Title as={1} id="reader-title" class="m-0 text-3xl font-semibold">{props.copy.welcomeTitle}</Title>
        <Text class="text-sm text-muted-foreground">{props.copy.welcomeLead}</Text>
        <Box class="flex flex-wrap gap-2">
          <Button onClick={props.onOpen}>
            <Icon type="svg" href="/icons.svg#folder-open" />
            {props.copy.openFolder}
          </Button>
          <Button variant="secondary" onClick={props.onOpenFile}>{props.copy.openFile}</Button>
          <Button variant="secondary" onClick={props.onNewFile}>{props.copy.welcomeNewFile}</Button>
        </Box>
        <Button variant="ghost" class="self-start" onClick={props.onSettings}>
          <Icon type="svg" href="/icons.svg#settings" />
          {props.copy.settingsTitle}
        </Button>
        <Text class="text-xs text-muted-foreground">{props.copy.welcomeRecent}</Text>
        <Show when={props.recent.length === 0}>
          <Text class="text-xs text-muted-foreground">{props.copy.welcomeRecentEmpty}</Text>
        </Show>
        <Box class="flex flex-col gap-2">
          <For each={props.recent}>
            {(item) => (
              <Button variant="ghost" class="justify-start" onClick={() => props.onRecent(item.id)}>
                {item.label}
              </Button>
            )}
          </For>
        </Box>
        <Text class="text-xs text-muted-foreground">{props.copy.welcomeShortcut}</Text>
      </Stack>
    </Block>
  );
}
