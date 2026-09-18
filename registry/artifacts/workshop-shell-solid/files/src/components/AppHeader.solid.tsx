import { Show } from "solid-js";
import { Block, Button, Group, Image, Text } from "$ui8kit/ui";
import type { copy as Copy } from "$lib/copy";

export function AppHeader(props: {
  copy: typeof Copy;
  logoSrc: string;
  workspaceLabel: string;
  onOpenFolder?: () => void;
  openFolderDisabled?: boolean;
}) {
  return (
    <Block tag="header" class="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-card px-2">
      <Image src={props.logoSrc} alt={props.copy.logoAlt} class="h-4 w-4 shrink-0" />
      <Group class="min-w-0 flex-1 items-center gap-2">
        <Text class="truncate text-xs font-medium">{props.copy.appTitle}</Text>
        <Show when={props.workspaceLabel}>
          <Text class="truncate text-xs text-muted-foreground">{props.workspaceLabel}</Text>
        </Show>
      </Group>
      <Show when={props.onOpenFolder}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class="h-7 shrink-0 px-2 text-xs"
          disabled={props.openFolderDisabled}
          aria-label={props.copy.openFolder}
          onClick={() => props.onOpenFolder?.()}
        >
          {props.copy.openFolder}
        </Button>
      </Show>
    </Block>
  );
}
