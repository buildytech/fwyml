import { For, createSignal, onCleanup, onMount, type JSX } from "solid-js";
import { Block, Box, Button, Text } from "$ui8kit/ui";
import { copy } from "$lib/copy";
import { usePreviewHost } from "$lib/host";
import { workbench } from "$lib/workbench";

function decodeChunk(data: string): string {
  if (!data) return "";
  try {
    return decodeURIComponent(escape(atob(data)));
  } catch {
    try {
      return atob(data);
    } catch {
      return "";
    }
  }
}

function toLines(buffer: string): string[] {
  const normalized = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const parts = normalized.split("\n");
  // Keep trailing prompt line even when empty after final newline.
  return parts.length > 0 ? parts : [""];
}

export function Terminal(props: {
  title?: string;
  lines?: string[];
  onStatus?: (message: string) => void;
}): JSX.Element {
  const preview = usePreviewHost();
  const modeLabel = () => (preview ? "preview" : "memory");
  const [lines, setLines] = createSignal<string[]>(
    props.lines ?? ["Starting terminal…"],
  );
  const [draft, setDraft] = createSignal("");
  const [sessionId, setSessionId] = createSignal("");
  const [error, setError] = createSignal("");
  let scroller: HTMLDivElement | undefined;
  let buffer = "";
  let disposed = false;
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  const scrollBottom = () => {
    queueMicrotask(() => scroller?.scrollTo(0, scroller.scrollHeight));
  };

  const applyBuffer = () => {
    setLines(toLines(buffer));
    scrollBottom();
  };

  const poll = async (id: string) => {
    if (disposed || !id) return;
    try {
      const chunk = await workbench.read(id);
      const text = decodeChunk(chunk.data ?? "");
      if (text) {
        buffer += text;
        applyBuffer();
      }
      if (chunk.done) {
        props.onStatus?.(`terminal:${modeLabel()} · exited`);
      }
    } catch (err) {
      if (!disposed) setError(err instanceof Error ? err.message : String(err));
    }
  };

  const start = async () => {
    setError("");
    try {
      const shells = await workbench.shells();
      const shell = shells.find((item) => item.available)?.id ?? shells[0]?.id ?? "preview";
      const id = await workbench.start(shell, 80, 24);
      if (disposed) {
        await workbench.close(id);
        return;
      }
      setSessionId(id);
      buffer = "";
      applyBuffer();
      props.onStatus?.(
        preview
          ? `terminal:preview · session ${id}`
          : `terminal:memory · TerminalService · session ${id}`,
      );
      await poll(id);
    } catch (err) {
      if (!disposed) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setLines(["Terminal failed to start", message, "$ "]);
        props.onStatus?.(`terminal:error · ${message}`);
      }
    }
  };

  onMount(() => {
    void start();
    pollTimer = setInterval(() => {
      const id = sessionId();
      if (id) void poll(id);
    }, 120);
  });

  onCleanup(() => {
    disposed = true;
    if (pollTimer) clearInterval(pollTimer);
    const id = sessionId();
    if (id) void workbench.close(id).catch(() => {});
  });

  const run = () => {
    const text = draft().trimEnd();
    const id = sessionId();
    if (!text || !id) return;
    setDraft("");
    if (text === "clear") {
      buffer = "$ ";
      applyBuffer();
      return;
    }
    void workbench
      .input(id, `${text}\n`)
      .then(() => poll(id))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  };

  return (
    <Block
      tag="section"
      class="ide-terminal flex min-h-0 flex-col border-t border-border bg-card"
      data-surface="terminal"
      data-terminal-mode={modeLabel()}
      aria-label={props.title ?? copy.terminal}
    >
      <Box class="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-border px-2">
        <Text class="text-xs font-medium">{props.title ?? copy.terminal}</Text>
        <Text class="text-xs text-muted-foreground" data-terminal-badge>
          {modeLabel()}
          {preview ? "" : " · no PTY"}
        </Text>
      </Box>
      {error() ? (
        <Text role="alert" class="px-2 py-1 text-xs text-destructive">
          {error()}
        </Text>
      ) : null}
      <Box
        class="min-h-0 flex-1 overflow-auto p-2 font-mono text-xs"
        ref={scroller}
        role="log"
        aria-live="polite"
      >
        <For each={lines()}>{(line) => <Box class="whitespace-pre-wrap">{line}</Box>}</For>
      </Box>
      <Box class="flex items-center gap-2 border-t border-border px-2 py-1">
        <Text class="text-xs text-muted-foreground">$</Text>
        <input
          class="min-w-0 flex-1 border-0 bg-transparent text-xs outline-none"
          aria-label="Terminal input"
          value={draft()}
          onInput={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              run();
            }
          }}
        />
        <Button type="button" variant="ghost" size="sm" class="h-7 px-2 text-xs" onClick={run}>
          run
        </Button>
      </Box>
    </Block>
  );
}
