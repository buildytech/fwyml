import { onCleanup, onMount } from "solid-js";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Block } from "$ui8kit/ui";
import type { Workbench } from "$lib/workbench";

// Each process owns its screen, parser, cursor and scrollback, including while hidden.
export function TerminalSession(props: {
  id: string; active: boolean; api: Workbench;
  onDone: () => void; onError: (error: unknown) => void;
}) {
  let host!: HTMLDivElement;
  onMount(() => {
    let disposed = false;
    let polling = false;
    let done = false;
    const terminal = new Terminal({ fontFamily: '"Cascadia Code", Consolas, monospace', fontSize: 12, cursorBlink: true, scrollback: 3000 });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(host);
    const fail = (error: unknown) => { if (!disposed) props.onError(error); };
    const resize = () => {
      if (!host.clientWidth || !host.clientHeight || done) return;
      fit.fit();
      void props.api.resize(props.id, terminal.cols, terminal.rows).catch(fail);
    };
    const applyTheme = () => {
      const style = getComputedStyle(host);
      terminal.options.theme = { background: style.backgroundColor, foreground: style.color, cursor: style.color };
    };
    applyTheme(); resize();
    const theme = new MutationObserver(applyTheme);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-palette"] });
    const observer = new ResizeObserver(resize); observer.observe(host);
    const input = terminal.onData(data => { if (!done) void props.api.input(props.id, data).catch(fail); });
    const timer = setInterval(async () => {
      if (polling || done) return;
      polling = true;
      try {
        const result = await props.api.read(props.id);
        if (disposed) return;
        if (result.data) terminal.write(Uint8Array.from(atob(result.data), char => char.charCodeAt(0)));
        if (result.done) { done = true; props.onDone(); }
      } catch (error) { fail(error); }
      finally { polling = false; }
    }, 60);
    onCleanup(() => {
      disposed = true;
      clearInterval(timer); observer.disconnect(); theme.disconnect(); input.dispose(); terminal.dispose();
    });
  });
  return (
    <Block ref={(el: HTMLDivElement) => host = el} class="min-h-0 flex-1 overflow-hidden bg-card p-2 text-foreground" style={{ display: props.active ? "block" : "none" }} />
  );
}
