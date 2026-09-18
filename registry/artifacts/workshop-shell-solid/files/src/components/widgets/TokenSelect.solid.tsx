import { Block, Button, Text } from "$ui8kit/ui";
import { For, Show, createSignal, onCleanup, onMount } from "solid-js";

export type TokenSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

/** Token-styled listbox — native <select> popups stay system-light on WebKitGTK. */
export function TokenSelect(props: {
  id?: string;
  class?: string;
  value: string;
  options: TokenSelectOption[];
  "aria-label"?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = createSignal(false);
  let root: HTMLDivElement | undefined;

  const selectedLabel = () =>
    props.options.find((item) => item.value === props.value)?.label ?? props.value;

  const close = () => setOpen(false);

  onMount(() => {
    const onPointer = (event: PointerEvent) => {
      if (!root?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey, true);
    onCleanup(() => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey, true);
    });
  });

  return (
    <Block
      ref={(el: HTMLDivElement) => {
        root = el;
      }}
      class={`relative ${props.class ?? ""}`}
    >
      <Button
        type="button"
        id={props.id}
        variant="outline"
        size="sm"
        disabled={props.disabled}
        class="h-10 w-full justify-between border-border bg-background px-3 text-left text-sm text-foreground"
        aria-label={props["aria-label"]}
        aria-haspopup="listbox"
        aria-expanded={open()}
        onClick={() => setOpen((value) => !value)}
      >
        <Text class="truncate">{selectedLabel()}</Text>
        <Text class="ml-2 text-muted-foreground" aria-hidden="true">
          ▾
        </Text>
      </Button>
      <Show when={open()}>
        <Block
          role="listbox"
          aria-labelledby={props.id}
          class="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <For each={props.options}>
            {(item) => (
              <button
                type="button"
                role="option"
                aria-selected={item.value === props.value}
                disabled={item.disabled}
                class={`flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50 ${
                  item.value === props.value ? "bg-accent text-accent-foreground" : ""
                }`}
                onClick={() => {
                  if (item.disabled) return;
                  props.onChange(item.value);
                  close();
                }}
              >
                {item.label}
              </button>
            )}
          </For>
        </Block>
      </Show>
    </Block>
  );
}
