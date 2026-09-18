import type { JSX } from "solid-js";
import { Show, createSignal } from "solid-js";
import { Alert, Block, Box, Button, Text } from "$ui8kit/ui";

export function AppMain(props: {
  status: string;
  urgent: boolean;
  actionLabel?: string;
  onAction?: () => void;
  details?: string;
  detailsLabel?: string;
  children?: JSX.Element;
}) {
  const [open, setOpen] = createSignal(false);
  return (
    <Block tag="main" id="main-content" tabIndex={-1} class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {props.children}
      <Alert
        role={props.urgent ? "alert" : "status"}
        aria-live={props.urgent ? "assertive" : "polite"}
        data-ui8kit={props.urgent ? "alert" : undefined}
        class="m-0 flex min-h-8 shrink-0 flex-col gap-1 rounded-none border-0 border-t border-border bg-card px-2 py-1 text-xs text-muted-foreground shadow-none"
      >
        <Box class="flex min-h-6 items-center gap-2">
        <Text class={`min-w-0 flex-1 truncate ${props.urgent ? "text-destructive" : ""}`}>{props.status}</Text>
        <Show when={props.actionLabel && props.onAction}>
          <Button variant="ghost" size="sm" class="h-6 px-2 text-xs" onClick={() => props.onAction?.()}>{props.actionLabel}</Button>
        </Show>
        <Show when={props.details}>
          <Button variant="ghost" size="sm" class="h-6 px-2 text-xs" aria-pressed={open()} onClick={() => setOpen(v => !v)}>{props.detailsLabel}</Button>
        </Show>
        </Box>
        <Show when={open() && props.details}>
          <Text class={`max-h-24 overflow-auto whitespace-pre-wrap ${props.urgent ? "text-destructive" : ""}`}>{props.details}</Text>
        </Show>
      </Alert>
    </Block>
  );
}
