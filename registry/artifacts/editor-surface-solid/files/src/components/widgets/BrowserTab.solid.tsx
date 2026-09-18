import { Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { Block, Box, Button, Icon, Input, Text } from "$ui8kit/ui";
import type { copy as Copy } from "$lib/copy";

export function BrowserTab(props: {
  copy: typeof Copy;
  path: string;
  url: string;
  title: string;
  error: string;
  picking: boolean;
  preview: boolean;
  onNavigate: (url: string) => void;
  onReload: (hard: boolean) => void;
  onPick: (enable: boolean) => void;
  onLayout: (box: { x: number; y: number; w: number; h: number }) => void;
}) {
  const [draft, setDraft] = createSignal(props.url);
  createEffect(() => setDraft(props.url));
  let surface: HTMLElement | undefined;
  const reportLayout = () => {
    if (!surface) return;
    const box = surface.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    props.onLayout({
      x: box.left * scale,
      y: box.top * scale,
      w: box.width * scale,
      h: box.height * scale,
    });
  };
  onMount(() => {
    reportLayout();
    const observer = new ResizeObserver(() => reportLayout());
    if (surface) observer.observe(surface);
    window.addEventListener("resize", reportLayout);
    const ticks = [120, 400, 1000].map((ms) => window.setTimeout(reportLayout, ms));
    onCleanup(() => {
      ticks.forEach((id) => window.clearTimeout(id));
      observer.disconnect();
      window.removeEventListener("resize", reportLayout);
      props.onLayout({ x: 0, y: 0, w: 0, h: 0 });
    });
  });
  const submit = () => props.onNavigate(draft());
  return (
    <Block class="flex min-h-0 flex-1 flex-col" aria-label={props.copy.simpleBrowser}>
      <Box class="flex h-8 shrink-0 items-center gap-2 border-b border-border px-2">
        <Input
          class="h-6 min-w-0 flex-1 text-xs"
          aria-label={props.copy.browserAddress}
          value={draft()}
          onInput={(event: InputEvent & { currentTarget: HTMLInputElement }) => setDraft(event.currentTarget.value)}
          onKeyDown={(event: KeyboardEvent) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
        />
        <Button variant="ghost" class="h-6 px-2 text-xs" onClick={submit}>{props.copy.browserGo}</Button>
        <Button
          variant="ghost"
          class="h-6 w-6"
          aria-pressed={props.picking}
          aria-label={props.copy.browserPick}
          title={props.picking ? props.copy.browserPicking : props.copy.browserPick}
          onClick={() => props.onPick(!props.picking)}
        >
          <Icon type="svg" href="/icons.svg#mouse-pointer" size="xs" />
        </Button>
        <Button
          variant="ghost"
          class="h-6 w-6"
          aria-label={props.copy.browserHardReload}
          title={props.copy.browserHardReload}
          onClick={() => props.onReload(true)}
        >
          <Icon type="svg" href="/icons.svg#refresh" size="xs" />
        </Button>
      </Box>
      <Show when={props.error}><Text class="px-2 py-1 text-xs text-destructive" role="alert">{props.error}</Text></Show>
      <Show when={props.picking}><Text class="px-2 py-1 text-xs text-muted-foreground">{props.copy.browserPicking}</Text></Show>
      <Box
        ref={(el: HTMLElement) => { surface = el; }}
        class="relative min-h-0 flex-1 bg-card"
        aria-label={props.title || props.copy.simpleBrowser}
      >
        <Show when={props.preview}>
          <Box class="flex h-full items-center justify-center p-8">
            <Text class="text-xs text-muted-foreground">{props.copy.browserPreview}</Text>
          </Box>
        </Show>
      </Box>
    </Block>
  );
}
