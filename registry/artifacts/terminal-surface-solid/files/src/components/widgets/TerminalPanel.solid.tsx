import { For, Show, createSignal, onCleanup, onMount, type JSX } from "solid-js";
import { TerminalSession } from "./TerminalSession.solid";
import { Block, Box, Button, Icon, Select, SelectOption, Text } from "$ui8kit/ui";
import type { copy as Copy } from "$lib/copy";
import type { Shell, Workbench } from "$lib/workbench";

type Session = { id: string; label: string; done: boolean };

export function TerminalPanel(props: {
  copy: typeof Copy;
  problems?: boolean;
  api: Workbench;
  onHide: () => void;
  tab: "terminal" | "problems";
  onTab: (tab: "terminal" | "problems") => void;
  children?: JSX.Element;
}) {
  const [shells, setShells] = createSignal<Shell[]>([]);
  const [shell, setShell] = createSignal("");
  const [sessions, setSessions] = createSignal<Session[]>([]);
  const [active, setActive] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  let disposed = false;
  const fail = (err: unknown) => { if (!disposed) setError(String(err)); };
  const closeSession = async (id: string) => {
    try { await props.api.close(id); } catch (err) { fail(err); return; }
    const next = sessions().filter(item => item.id !== id);
    setSessions(next);
    if (active() === id) {
      setActive(next.at(-1)?.id ?? "");
    }
  };
  const start = async () => {
    if (busy() || !shell()) return;
    setBusy(true); setError("");
    try {
      const id = await props.api.start(shell(), 80, 24);
      if (disposed) { await props.api.close(id); return; }
      const label = `${shell()} ${id}`;
      setSessions(current => [...current, { id, label, done: false }]);
      setActive(id);
    } catch (err) { fail(err); }
    finally { if (!disposed) setBusy(false); }
  };
  onMount(() => {
    void props.api.shells().then(list => { if (disposed) return; setShells(list); setShell(list.find(item => item.available)?.id ?? ""); }).catch(fail);
  });
  onCleanup(() => {
    disposed = true;
    for (const item of sessions()) void props.api.close(item.id).catch(() => {});
  });
  const current = () => sessions().find(item => item.id === active());
  return (
    <Block tag="section" class="flex h-full min-h-0 flex-col bg-card" aria-label={props.copy.terminal}>
      <Box class="flex h-8 shrink-0 items-center gap-2 border-b border-border px-2">
        <Show when={props.problems !== false}>
        <Button variant={props.tab === "problems" ? "secondary" : "ghost"} size="sm" class="h-8 px-2 text-xs" aria-pressed={props.tab === "problems"} onClick={() => props.onTab("problems")}>{props.copy.problems}</Button>
        </Show>
        <Button variant={props.tab === "terminal" ? "secondary" : "ghost"} size="sm" class="h-8 px-2 text-xs" aria-pressed={props.tab === "terminal"} onClick={() => props.onTab("terminal")}>{props.copy.terminal}</Button>
        <Show when={props.tab === "terminal"}>
          <Select class="h-8 w-32 border-0 text-xs" aria-label={props.copy.terminalShell} value={shell()} onChange={(e: Event & {currentTarget: HTMLSelectElement}) => setShell(e.currentTarget.value)}><For each={shells()}>{item => <SelectOption value={item.id} selected={shell() === item.id} disabled={!item.available}>{item.label}</SelectOption>}</For></Select>
          <Button variant="ghost" class="h-8 w-8" disabled={busy() || !shell()} aria-label={props.copy.newTerminal} onClick={() => void start()}><Icon type="svg" href="/icons.svg#plus" /></Button>
          <For each={sessions()}>{item =>
            <Button variant={item.id === active() ? "secondary" : "ghost"} size="sm" class="h-8 px-2 text-xs" aria-pressed={item.id === active()} onClick={() => setActive(item.id)}>{item.label}</Button>
          }</For>
          <Show when={active()}>
            <Button variant="ghost" class="h-8 w-8" aria-label={props.copy.closeSession} onClick={() => void closeSession(active())}><Icon type="svg" href="/icons.svg#close" /></Button>
          </Show>
        </Show>
        <Button variant="ghost" class="ml-auto h-8 w-8" aria-label={props.copy.hidePanel} onClick={() => props.onHide()}><Icon type="svg" href="/icons.svg#close" /></Button>
      </Box>
      <Show when={props.tab === "problems"}>{props.children}</Show>
      <Box class={props.tab === "terminal" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
        <Show when={error()}><Text role="alert" class="px-2 text-xs text-destructive">{error()}</Text></Show>
        <Show when={!active()}><Box class="flex items-center gap-2 px-2"><Text class="text-xs text-muted-foreground">{shell() ? props.copy.terminalEmpty : props.copy.terminalUnavailable}</Text><Button variant="ghost" size="sm" disabled={busy() || !shell()} onClick={() => void start()}>{props.copy.terminalStart}</Button></Box></Show>
        <Show when={current()?.done}><Text class="px-2 text-xs text-muted-foreground">{props.copy.terminalExited}</Text></Show>
        <For each={sessions().map(item => item.id)}>{id =>
          <TerminalSession id={id} active={active() === id} api={props.api} onError={fail}
            onDone={() => setSessions(items => items.map(item => item.id === id ? { ...item, done: true } : item))} />
        }</For>
      </Box>
    </Block>
  );
}
