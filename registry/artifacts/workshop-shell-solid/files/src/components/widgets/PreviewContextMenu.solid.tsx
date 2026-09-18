import { For, Show, createSignal, onMount, onCleanup } from "solid-js";
import { Block, Button } from "$ui8kit/ui";
import type { copy as Copy } from "../../lib/copy";
import type { ContextAction, ContextScope } from "../../lib/context-actions";

/** Browser/preview context menu using the same menus.json catalog as desktop. */
export function PreviewContextMenu(props: { copy: typeof Copy; onAction: (action: ContextAction) => void }) {
  const [target, setTarget] = createSignal<{ scope: ContextScope; path: string; x: number; y: number }>();
  let menu!: HTMLDivElement;
  let origin: HTMLElement | null = null;
  const close = () => {
    setTarget(undefined);
    origin?.focus();
  };
  onMount(() => {
    const open = (event: MouseEvent) => {
      const element = (event.target as HTMLElement).closest<HTMLElement>("[data-context-scope]");
      if (!element) return;
      const scope = element.dataset.contextScope as ContextScope;
      if (!Object.hasOwn(props.copy.contextActions, scope)) return;
      event.preventDefault();
      origin = element;
      setTarget({
        scope,
        path: element.dataset.contextPath ?? "",
        x: Math.min(event.clientX, innerWidth - 240),
        y: Math.min(event.clientY, innerHeight - 264),
      });
      queueMicrotask(() => menu?.querySelector<HTMLButtonElement>("button")?.focus());
    };
    const outside = (event: PointerEvent) => {
      if (target() && !menu?.contains(event.target as Node)) setTarget(undefined);
    };
    document.addEventListener("contextmenu", open);
    document.addEventListener("pointerdown", outside);
    onCleanup(() => {
      document.removeEventListener("contextmenu", open);
      document.removeEventListener("pointerdown", outside);
    });
  });
  return (
    <Block
      ref={(el: HTMLDivElement) => (menu = el)}
      role="menu"
      class="fixed z-50 min-w-48 border border-border bg-popover p-1 text-popover-foreground shadow-md"
      style={{ display: target() ? "block" : "none", left: `${target()?.x ?? 0}px`, top: `${target()?.y ?? 0}px` }}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key === "Escape" || event.key === "Tab") {
          event.preventDefault();
          close();
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const items = [...menu.querySelectorAll<HTMLButtonElement>("button")];
          const index = items.indexOf(document.activeElement as HTMLButtonElement);
          items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
        }
      }}
    >
      <Show when={target()}>
        {(item) => (
          <For each={props.copy.contextActions[item().scope]}>
            {(action) => (
              <Button
                role="menuitem"
                variant="ghost"
                class="flex h-8 w-full justify-start px-2 text-xs"
                onClick={() => {
                  const request = { ...item(), action: action.id };
                  close();
                  props.onAction(request);
                }}
              >
                {action.label}
              </Button>
            )}
          </For>
        )}
      </Show>
    </Block>
  );
}
