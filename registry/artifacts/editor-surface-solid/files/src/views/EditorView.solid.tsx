import { contextStyle } from "$lib/context-actions";
import { ProblemsPanel } from "$components/widgets/ProblemsPanel.solid";
import { For, Show, createSignal, createEffect, on, onMount, onCleanup } from "solid-js";
import { Block, Box, Stack, Text, Button, Icon, Input } from "$ui8kit/ui";
import { ChatPanel } from "$surfaces/ChatPanel.solid";
import { BrowserTab } from "$components/widgets/BrowserTab.solid";
import { CodeEditor } from "$surfaces/CodeEditor.solid";
import { MarkdownEditor } from "$components/widgets/MarkdownEditor.solid";
import { GitPanel } from "$components/widgets/GitPanel.solid";
import { TerminalPanel } from "$components/widgets/TerminalPanel.solid";
import { isMarkdownPath, markdownDefaultMode } from "$lib/editor-languages";
import { commandCatalog, routeEditorCommand, type CommandId } from "$lib/commands";
import { searchWorkspace } from "$lib/host";
import type { SearchHit } from "$lib/workspace-tree";
import { fileForPath, firstMarkLine, isGitNoise, marksFromDiffFile, parseUnifiedDiff, type DiffFile, type DiffLineMark } from "$lib/git-diff";
import type { GitSnapshot, Workbench } from "$lib/workbench";
import { FileTree } from "$surfaces/FileTree.solid";
import {
  chatPctFromPointer,
  fitColumns,
  persistColumnPct,
  readColumnPct,
  resetLayoutEvent,
  treePctFromPointer,
  type ColumnPct,
} from "$lib/column-split";
import type { EditorLayoutPrefs } from "$lib/editor-prefs";
import type { ReduceMessage } from "$lib/event-reduce";
import type { copy as Copy } from "$lib/copy";
import { countTreeNodes, searchHitLimit, treeListLimit, type WorkspaceTreeNode } from "$lib/workspace-tree";
import { isBrowserPath, parseBrowserDoc } from "$lib/browser-tab";
import { untitledLabel } from "$lib/file-buffer";
import { breadcrumbParts, tabTitle } from "$lib/tab-label";
import type { LanguageStatusView } from "$lib/language";
import type { SessionChrome } from "$lib/session-persist";


export function EditorView(props: {
  copy: typeof Copy;
  features: string[];
  api: Workbench;
  menuCommand: {name: string; request: number};
  validation: {busy: boolean; output: string; passed: boolean | null; stale?: boolean; ranTool?: string; ranConfig?: string};
  onValidate: (tool: string, config: string) => void;
  onLocation: (path: string, line: number, column: number) => void;
  location: {path: string; line: number; column: number; request: number} | null;
  onSettings: () => void;
  onOpenFolder: () => void;
  onRefresh: () => void;
  tabs: {path: string; dirty: boolean; label?: string}[];
  browseError: string;
  browsePicking: boolean;
  browsePreview: boolean;
  onBrowseNavigate: (url: string) => void;
  onBrowseReload: (hard: boolean) => void;
  onBrowsePick: (enable: boolean) => void;
  onBrowseLayout: (box: { x: number; y: number; w: number; h: number }) => void;
  git: GitSnapshot | null;
  gitError: string;
  gitResult?: string;
  gitBusy: boolean;
  commitMessage: string;
  onCommitMessage: (value: string) => void;
  onGitRefresh: () => void;
  onStage: (path: string) => void;
  onStageAll: () => void;
  onCommit: () => void;
  onUnstage: (path: string) => void;
  onPush: () => void;
  onFetch: () => void;
  onPull: () => void;
  onCloseFile: (path: string) => void;
  filePath: string;
  doc: string;
  layout: EditorLayoutPrefs;
  messages: ReduceMessage[];
  draft: string;
  busy: boolean;
  runtimeNote?: string;
  onDoc: (value: string) => void;
  onSave: () => void;
  onSaveAs: () => void;
  onOpenPicker: () => void;
  onDraft: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  workspaceLabel: string;
  workspaceAttached: boolean;
  tree: WorkspaceTreeNode[];
  treeSkipped?: boolean;
  onOpenFile: (path: string) => void;
  language: LanguageStatusView | null;
  closedCount: number;
  onReopen: () => void;
  canNavBack: boolean;
  canNavForward: boolean;
  onNavBack: () => void;
  onNavForward: () => void;
  hoverText: string;
  onIdleCursor: (line: number, column: number) => void;
  onFormat: () => void;
  onDefinition: (line: number, column: number) => void;
  onComplete: (line: number, column: number) => Promise<{label: string}[]>;
  onHover: (line: number, column: number) => Promise<string>;
  onDiagnostics: () => Promise<{line: number; column: number; message: string}[]>;
  onCancelCheck: () => void;
  onSaveAllCheck: (tool: string, config: string) => void;
  gitBranch: string;
  dirtyCount: number;
  columns: ColumnPct;
  onColumns: (pct: ColumnPct) => void;
  chrome: SessionChrome;
  onChrome: (next: SessionChrome) => void;
}) {
  const feature = (name: string) => props.features.includes(name);
  const [explorerVisible, setExplorerVisible] = createSignal(true);
  const [tool, setTool] = createSignal("typescript");
  const [config, setConfig] = createSignal("tsconfig.json");
  const checkStale = () => props.validation.stale || (props.validation.passed !== null && (props.validation.ranTool !== tool() || (tool() === "typescript" && props.validation.ranConfig !== config())));
  const [query, setQuery] = createSignal("");
  const [quickVisible, setQuickVisible] = createSignal(false);
  const [quickIndex, setQuickIndex] = createSignal(0);
  const [searchOpen, setSearchOpen] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [searchCase, setSearchCase] = createSignal(false);
  const [searchInclude, setSearchInclude] = createSignal("");
  const [searchExclude, setSearchExclude] = createSignal("");
  const commandLabels = (): Record<CommandId, string> => ({
    find: props.copy.commandFind,
    line: props.copy.commandLine,
    save: props.copy.commandSave,
    "save-as": props.copy.commandSaveAs,
    "quick-open": props.copy.commandQuickOpen,
    explorer: props.copy.commandExplorer,
    terminal: props.copy.commandTerminal,
    problems: props.copy.commandProblems,
    settings: props.copy.commandSettings,
    palette: props.copy.commandPaletteItem,
    escape: props.copy.commandEscape,
  });
  const [paletteOpen, setPaletteOpen] = createSignal(false);
  const [editorFocus, setEditorFocus] = createSignal(0);
  const [searchHits, setSearchHits] = createSignal<SearchHit[]>([]);
  let searchSeq = 0;
  const runWorkspaceSearch = () => {
    const seq = ++searchSeq;
    void searchWorkspace(searchQuery(), searchCase(), searchInclude(), searchExclude()).then(hits => {
      if (seq === searchSeq) setSearchHits(hits);
    });
  };
  const cancelWorkspaceSearch = () => {
    searchSeq += 1;
    setSearchHits([]);
    setSearchOpen(false);
    setEditorFocus(n => n + 1);
  };
  const [diffMarks, setDiffMarks] = createSignal<DiffLineMark[]>([]);
  const [activePatch, setActivePatch] = createSignal<DiffFile | null>(null);
  const [cursor, setCursor] = createSignal({line: 1, column: 1});
  const [command, setCommand] = createSignal({name: "", request: 0});
  let searchInput: HTMLInputElement | undefined;
  const files = (nodes: WorkspaceTreeNode[]): string[] => nodes.flatMap(node => node.dir ? files(node.children ?? []) : [node.path]);
  const matches = () => files(props.tree).filter(path => path.toLowerCase().includes(query().toLowerCase())).slice(0, 100);
  const quickOpen = () => {setQuickVisible(true);setExplorerVisible(true);queueMicrotask(() => searchInput?.focus());};
  const [sidebar, setSidebar] = createSignal("files");
  const openGitFile = (path: string) => {
    props.onOpenFile(path);
    void (async () => {
      try {
        let file = fileForPath(parseUnifiedDiff(await props.api.diff(path, false)), path);
        if (!file) file = fileForPath(parseUnifiedDiff(await props.api.diff(path, true)), path);
        props.onLocation(path, firstMarkLine(file ? marksFromDiffFile(file) : []), 1);
      } catch {
        props.onLocation(path, 1, 1);
      }
    })();
  };
  createEffect(on(() => [props.filePath, props.git] as const, ([path]) => {
    if (!feature("git") || !path || isBrowserPath(path)) {
      setDiffMarks([]);
      setActivePatch(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const unstaged = parseUnifiedDiff(await props.api.diff(path, false));
        let file = fileForPath(unstaged, path);
        if (!file) {
          const staged = parseUnifiedDiff(await props.api.diff(path, true));
          file = fileForPath(staged, path);
        }
        if (cancelled) return;
        setActivePatch(file ?? null);
        setDiffMarks(file ? marksFromDiffFile(file) : []);
      } catch {
        if (!cancelled) {
          setActivePatch(null);
          setDiffMarks([]);
        }
      }
    })();
    onCleanup(() => { cancelled = true; });
  }));
  const [terminalHeight, setTerminalHeight] = createSignal(224);
  const chatVisible = () => feature("agents") && props.chrome.chatVisible;
  const bottomTab = () => feature("languages") ? props.chrome.bottomTab : "terminal";
  const terminalVisible = () => feature("terminal") && props.chrome.bottomVisible;
  const patchChrome = (patch: Partial<SessionChrome>) => {
    props.onChrome({ ...props.chrome, ...patch });
  };
  const openBottom = (tab: "terminal" | "problems") => {
    if (feature("terminal")) patchChrome({ bottomTab: tab, bottomVisible: true });
  };
  const toggleBottom = (tab: "terminal" | "problems") => {
    if (!feature("terminal")) return;
    if (terminalVisible() && bottomTab() === tab) patchChrome({ bottomVisible: false });
    else openBottom(tab);
  };
  const markdownVisual = () =>
    isMarkdownPath(props.filePath) &&
    (props.chrome.markdown[props.filePath] ?? markdownDefaultMode(props.filePath)) === "visual";
  const runEditorCommand = (name: "find" | "line") => {
    const surface = markdownVisual() ? "visual-markdown" : "editor";
    const routed = routeEditorCommand(name, surface);
    if (!routed) return;
    if (routed.switchToSource) setMarkdownMode("source");
    setCommand(c => ({name: routed.id, request: c.request + 1}));
  };
  const setMarkdownMode = (mode: "visual" | "source") => {
    patchChrome({ markdown: { ...props.chrome.markdown, [props.filePath]: mode } });
  };
  const closePalette = () => {
    setPaletteOpen(false);
    setEditorFocus(n => n + 1);
  };
  const lineEndingLabel = () => {
    if (props.doc.includes("\r\n")) return props.copy.lineEndingCRLF;
    if (props.doc.includes("\r")) return props.copy.lineEndingCR;
    return props.copy.lineEndingLF;
  };
  onMount(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape" && paletteOpen()) {
        event.preventDefault();
        closePalette();
        return;
      }
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "p") {event.preventDefault(); if (event.shiftKey) setPaletteOpen(true); else quickOpen();}
      if (event.key.toLowerCase() === "f" && event.shiftKey) {event.preventDefault();setSearchOpen(true);}
      else if (event.key.toLowerCase() === "f") {event.preventDefault();runEditorCommand("find");}
      if (event.key.toLowerCase() === "g") {event.preventDefault();runEditorCommand("line");}
      if (event.key.toLowerCase() === "b") {event.preventDefault();setExplorerVisible(v => !v);}
      if (event.shiftKey && event.key.toLowerCase() === "m") {event.preventDefault();openBottom("problems");}
      if (event.code === "Backquote") {event.preventDefault();toggleBottom("terminal");}
    };
    window.addEventListener("keydown", keys);
    const onReset = () => setPct(readColumnPct());
    window.addEventListener(resetLayoutEvent, onReset);
    onCleanup(() => {
      window.removeEventListener("keydown", keys);
      window.removeEventListener(resetLayoutEvent, onReset);
    });
  });
  createEffect(on(() => props.menuCommand, command => {
    if(!command.request) return;
    if(command.name === "quick-open") quickOpen();
    if(command.name === "explorer") setExplorerVisible(v => !v);
    if(command.name === "terminal") toggleBottom("terminal");
    if(command.name === "problems") openBottom("problems");
    if(command.name === "palette") setPaletteOpen(true);
    if(command.name === "find" || command.name === "line") runEditorCommand(command.name);
  }));
  const [pct, setPct] = createSignal<ColumnPct>(props.columns);
  createEffect(() => setPct(props.columns));
  let row: HTMLDivElement | undefined;

  const applyPct = (next: ColumnPct) => {
    const fitted = fitColumns(next.tree, next.chat);
    setPct(fitted);
    persistColumnPct(fitted);
    props.onColumns(fitted);
  };

  const startSplit = (kind: "tree" | "chat", event: PointerEvent) => {
    if (!row) return;
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    const onMove = (move: PointerEvent) => {
      if (!row) return;
      const box = row.getBoundingClientRect();
      if (kind === "tree") {
        applyPct({ tree: treePctFromPointer(move.clientX, box), chat: pct().chat });
      } else {
        applyPct({ tree: pct().tree, chat: chatPctFromPointer(move.clientX, box) });
      }
    };
    const onUp = (up: PointerEvent) => {
      handle.releasePointerCapture(up.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  };

  const onSplitKey = (kind: "tree" | "chat", event: KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 2 : -2;
    if (kind === "tree") applyPct({ tree: pct().tree + step, chat: pct().chat });
    else applyPct({ tree: pct().tree, chat: pct().chat - step });
  };

  return (
    <Block tag="section" class="flex min-h-0 min-w-0 flex-1 flex-col">
      <Box
        ref={(el: HTMLDivElement) => {
          row = el;
        }}
        class="flex min-h-0 min-w-0 flex-1 flex-row"
      >
      <Show when={explorerVisible()}>
      <Box class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden" style={{ width: `${pct().tree}%` }}>
        <Box class="flex h-8 shrink-0 items-center border-b border-border bg-card">
          <Button variant="ghost" class="h-8 min-w-0 flex-1 rounded-none px-2 text-xs" title={props.copy.treeTitle} aria-pressed={sidebar() === "files"} onClick={() => setSidebar("files")}><Icon type="svg" href="/icons.svg#files" /><Text class="hidden md:inline">{props.copy.treeTitle}</Text></Button>
          <Show when={feature("git")}>
          <Button variant="ghost" class="h-8 min-w-0 flex-1 rounded-none px-2 text-xs" title={props.copy.sourceControl} aria-pressed={sidebar() === "git"} onClick={() => {setSidebar("git"); props.onGitRefresh();}}><Icon type="svg" href="/icons.svg#git" /><Text class="hidden xl:inline">{props.copy.sourceControl}</Text></Button>
          </Show>
        </Box>
        <Show when={searchOpen()}>
          <Box class="flex min-h-0 flex-col gap-2 overflow-auto border-b border-border p-2">
            <Input aria-label={props.copy.searchWorkspace} placeholder={props.copy.searchWorkspace} value={searchQuery()} onInput={(e: InputEvent & {currentTarget: HTMLInputElement}) => setSearchQuery(e.currentTarget.value)} onKeyDown={(e: KeyboardEvent) => {if(e.key === "Enter") runWorkspaceSearch(); if(e.key === "Escape") cancelWorkspaceSearch();}} />
            <Input aria-label={props.copy.searchInclude} placeholder={props.copy.searchInclude} value={searchInclude()} onInput={(e: InputEvent & {currentTarget: HTMLInputElement}) => setSearchInclude(e.currentTarget.value)} />
            <Input aria-label={props.copy.searchExclude} placeholder={props.copy.searchExclude} value={searchExclude()} onInput={(e: InputEvent & {currentTarget: HTMLInputElement}) => setSearchExclude(e.currentTarget.value)} />
            <Box class="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" class="h-8 self-start px-2 text-xs" aria-pressed={searchCase()} onClick={() => setSearchCase(v => !v)}>{props.copy.searchCase}</Button>
            <Button variant="ghost" size="sm" class="h-8 self-start px-2 text-xs" onClick={cancelWorkspaceSearch}>{props.copy.searchCancel}</Button>
            </Box>
            <Show when={searchHits().length === 0 && searchQuery()}><Text class="text-xs text-muted-foreground">{props.copy.searchEmpty}</Text></Show>
            <Show when={searchHits().length >= searchHitLimit}><Text class="text-xs text-muted-foreground">{props.copy.searchLimited}</Text></Show>
            <For each={searchHits()}>{hit => <Button variant="ghost" class="h-auto justify-start whitespace-pre-wrap px-2 py-2 text-left text-xs" onClick={() => props.onLocation(hit.path, hit.line, hit.column)}>{hit.path}:{hit.line} {hit.preview}</Button>}</For>
          </Box>
        </Show>
        <Show when={paletteOpen()}>
          <Box class="flex min-h-0 flex-col gap-2 overflow-auto border-b border-border p-2">
            <Text class="px-2 text-xs">{props.copy.commandPalette}</Text>
            <For each={commandCatalog.filter(item => item.id !== "escape" && (item.id !== "terminal" || feature("terminal")) && (item.id !== "problems" || feature("languages")))}>{item =>
              <Button variant="ghost" class="h-8 justify-start px-2 text-xs" onClick={() => {
                closePalette();
                if (item.id === "quick-open") quickOpen();
                else if (item.id === "find" || item.id === "line") runEditorCommand(item.id);
                else if (item.id === "explorer") setExplorerVisible(v => !v);
                else if (item.id === "terminal") toggleBottom("terminal");
                else if (item.id === "problems") openBottom("problems");
                else if (item.id === "settings") props.onSettings();
                else if (item.id === "save") props.onSave();
                else if (item.id === "save-as") props.onSaveAs();
              }}>{commandLabels()[item.id]} {item.shortcut ?? ""}</Button>
            }</For>
            <Button variant="ghost" size="sm" onClick={closePalette}>{props.copy.cancelLabel}</Button>
          </Box>
        </Show>
        <Show when={quickVisible()}>
          <Box class="flex min-h-0 flex-col gap-2 overflow-auto p-2">
            <Input ref={(el: HTMLInputElement) => {searchInput = el;}} aria-label={props.copy.quickOpen} placeholder={props.copy.quickOpen} value={query()} onInput={(e: InputEvent & {currentTarget: HTMLInputElement}) => {setQuery(e.currentTarget.value);setQuickIndex(0);}} onKeyDown={(e: KeyboardEvent) => {
              if(e.key === "Escape") {setQuickVisible(false);setEditorFocus(n => n+1);return;}
              const list = matches();
              if(e.key === "ArrowDown") {e.preventDefault();setQuickIndex(i => Math.min(list.length-1, i+1));}
              if(e.key === "ArrowUp") {e.preventDefault();setQuickIndex(i => Math.max(0, i-1));}
              if(e.key === "Enter" && list[quickIndex()]) {props.onOpenFile(list[quickIndex()]);setQuickVisible(false);}
            }} />
            <Show when={matches().length} fallback={<Text class="text-xs text-muted-foreground">{props.copy.noMatches}</Text>}><For each={matches()}>{(path, index) => <Button variant="ghost" class={`h-auto justify-start truncate px-2 py-2 text-xs ${index() === quickIndex() ? "bg-accent" : ""}`} title={path} onClick={() => {props.onOpenFile(path);setQuickVisible(false);}}>{path}</Button>}</For></Show>
          </Box>
        </Show>
        <Show when={!quickVisible()}>
        <Show when={!feature("git") || sidebar() === "files"} fallback={<GitPanel copy={props.copy} status={props.git} error={props.gitError} lastResult={props.gitResult && !isGitNoise(props.gitResult) ? props.gitResult : undefined} busy={props.gitBusy} message={props.commitMessage} activePath={props.filePath} activePatch={activePatch()} onMessage={props.onCommitMessage} onRefresh={props.onGitRefresh} onStage={props.onStage} onStageAll={props.onStageAll} onCommit={props.onCommit} onUnstage={props.onUnstage} onPush={props.onPush} onFetch={props.onFetch} onPull={props.onPull} onOpen={openGitFile} />}>
        <FileTree
          copy={props.copy}
          label={props.workspaceLabel}
          nodes={props.tree}
          selected={props.filePath}
          attached={props.workspaceAttached}
          onOpen={props.onOpenFile}
          truncated={countTreeNodes(props.tree) >= treeListLimit}
          skipped={props.treeSkipped}
        />
        </Show>
        </Show>
        <Box class="flex h-8 shrink-0 items-center gap-2 border-t border-border px-2">
          <Button variant="ghost" class="h-8 w-8" aria-label={props.copy.openFolder} onClick={props.onOpenFolder}><Icon type="svg" href="/icons.svg#folder-open" /></Button>
          <Button variant="ghost" class="h-8 w-8" aria-label={props.copy.refresh} onClick={props.onRefresh}><Icon type="svg" href="/icons.svg#refresh" /></Button>
          <Button variant="ghost" class="h-8 w-8" title={props.copy.searchWorkspace} aria-label={props.copy.searchWorkspace} onClick={() => setSearchOpen(v => !v)}><Icon type="svg" href="/icons.svg#files" /></Button>
          <Button variant="ghost" class="ml-auto h-8 w-8" title={props.copy.settingsOpen} aria-label={props.copy.settingsOpen} onClick={props.onSettings}><Icon type="svg" href="/icons.svg#settings" /></Button>
        </Box>
      </Box>
      <Box
        role="separator"
        aria-orientation="vertical"
        aria-label={props.copy.resizeTree}
        aria-valuemin={12}
        aria-valuemax={40}
        aria-valuenow={Math.round(pct().tree)}
        tabindex={0}
        class="shrink-0 cursor-col-resize" style={{ "touch-action": "none" }}
        onPointerDown={(event: PointerEvent) => startSplit("tree", event)}
        onKeyDown={(event: KeyboardEvent) => onSplitKey("tree", event)}
      />
      </Show>
      <Stack class="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-0">
        <Box class="flex h-8 shrink-0 items-center border-b border-border bg-card">
          <Box class="flex min-w-0 flex-1 overflow-x-auto">
            <For each={props.tabs}>{tab => <Box data-context-scope="tab" data-context-path={tab.path} style={contextStyle("tab", tab.path)} class="flex shrink-0 items-center"><Button variant="ghost" class={`h-8 shrink-0 rounded-none border-r border-border px-4 text-xs ${props.filePath === tab.path ? "bg-accent" : ""}`} title={tab.label ?? tab.path} aria-pressed={props.filePath === tab.path} onClick={() => props.onOpenFile(tab.path)}><Icon type="svg" href={isBrowserPath(tab.path) ? "/icons.svg#globe" : "/icons.svg#file"} />{tabTitle(untitledLabel(tab.path), props.tabs.map(item => untitledLabel(item.path)), tab.label)}{tab.dirty ? " •" : ""}</Button><Button variant="ghost" class="h-8 w-8 rounded-none" title={tab.dirty ? props.copy.unsaved : props.copy.closeFile} aria-label={`${props.copy.closeFile} ${tab.path}`} onClick={() => props.onCloseFile(tab.path)}><Icon type="svg" href="/icons.svg#close" size="xs" /></Button></Box>}</For>
          </Box>
          <Show when={feature("terminal")}>
          <Button variant="ghost" class="h-8 w-8" aria-label={props.copy.terminal} aria-pressed={terminalVisible() && bottomTab() === "terminal"} onClick={() => toggleBottom("terminal")}><Icon type="svg" href="/icons.svg#panel" /></Button>
          </Show>
          <Show when={feature("agents")}>
          <Button variant="ghost" class="h-8 w-8" aria-label={props.copy.toggleAgent} aria-pressed={chatVisible()} onClick={() => patchChrome({ chatVisible: !chatVisible() })}><Icon type="svg" href="/icons.svg#message-square" /></Button>
          </Show>
        </Box>
        <Show when={props.filePath} fallback={<Box class="flex flex-1 items-center justify-center p-8"><Text class="text-xs text-muted-foreground">{props.copy.selectFile}</Text></Box>}>
          <Show when={isBrowserPath(props.filePath)} fallback={
            <>
          <Box class="flex h-6 shrink-0 items-center gap-2 border-b border-border px-2">
            <Text class="min-w-0 flex-1 truncate text-xs leading-6 text-muted-foreground">{breadcrumbParts(props.filePath).join(" / ")}</Text>
            <Show when={isMarkdownPath(props.filePath)}>
              <Button
                variant="ghost"
                class="h-6 w-6"
                aria-pressed={markdownVisual()}
                aria-label={markdownVisual() ? props.copy.markdownVisual : props.copy.markdownSource}
                title={markdownVisual() ? props.copy.markdownVisual : props.copy.markdownSource}
                onClick={() => setMarkdownMode(markdownVisual() ? "source" : "visual")}
              >
                <Icon type="svg" href={markdownVisual() ? "/icons.svg#book-open-text" : "/icons.svg#list-tree"} size="xs" />
              </Button>
            </Show>
          </Box>
          <Box class={markdownVisual() ? "hidden" : "flex min-h-0 flex-1 flex-col overflow-auto"} style={{ zoom: String(props.layout.uiZoom / 100) }}>
            <CodeEditor openPaths={props.tabs.map(tab => tab.path)} command={command()} location={props.location} focusRequest={editorFocus()} onCursor={setCursor} onIdleCursor={cursor => props.onIdleCursor(cursor.line, cursor.column)} filePath={props.filePath} doc={props.doc} layout={props.layout} editorAria={props.copy.editorAria} diffMarks={diffMarks()} onChange={props.onDoc} onSave={props.onSave} onSaveAs={props.onSaveAs} onOpenFile={props.onOpenPicker} onFormat={props.onFormat} onDefinition={() => props.onDefinition(cursor().line, cursor().column)} onComplete={(line, column) => props.onComplete(line, column)} onHover={(line, column) => props.onHover(line, column)} onDiagnostics={props.onDiagnostics} />
          </Box>
          <Show when={isMarkdownPath(props.filePath)}>
            <Box class={markdownVisual() ? "flex min-h-0 flex-1 flex-col overflow-auto" : "hidden"} style={{ zoom: String(props.layout.uiZoom / 100) }}>
              <MarkdownEditor
                copy={props.copy}
                markdown={props.doc}
                title={props.filePath.split(/[/\\]/).pop() ?? props.filePath}
                onMarkdown={props.onDoc}
                onOpenSource={() => setMarkdownMode("source")}
              />
            </Box>
          </Show>
            </>
          }>
            <BrowserTab
              copy={props.copy}
              path={props.filePath}
              url={parseBrowserDoc(props.doc).url}
              title={parseBrowserDoc(props.doc).title}
              error={props.browseError}
              picking={props.browsePicking}
              preview={props.browsePreview}
              onNavigate={props.onBrowseNavigate}
              onReload={props.onBrowseReload}
              onPick={props.onBrowsePick}
              onLayout={props.onBrowseLayout}
            />
          </Show>
        </Show>
        <Show when={props.filePath}><Box class="flex h-8 min-w-0 shrink-0 items-center gap-2 overflow-x-auto whitespace-nowrap border-t border-border px-2 text-xs text-muted-foreground">
          <Show when={feature("languages")}><Text class="shrink-0 font-medium text-foreground">{
            props.validation.busy ? props.copy.validating
              : checkStale() ? props.copy.validationStale
              : props.validation.passed === true ? props.copy.validationPassed
              : props.validation.passed === false ? props.copy.validationFailed
              : props.copy.validationIdle
          }</Text></Show>
          <Button variant="ghost" class="h-6 shrink-0 px-0 text-xs" title={props.copy.goToLine} onClick={() => runEditorCommand("line")}>{props.copy.position} {cursor().line}:{cursor().column}</Button>
          <Text class="hidden xl:inline">{props.copy.utf8}</Text>
          <Text class="hidden xl:inline">{lineEndingLabel()}</Text>
          <Text class="hidden xl:inline">{props.copy.spaces}: {props.layout.tabSize}</Text>
          <Text class="min-w-0 max-w-[14rem] truncate" title={props.language?.reason ?? (props.language && !props.language.ready ? props.copy.languageWorkspace : "")}>{props.language?.language ?? (props.filePath.split(".").pop()?.toUpperCase() ?? "")}{props.language && !props.language.ready ? ` — ${props.copy.languageWorkspace}` : ""}</Text>
          <Show when={props.language?.format}><Button variant="ghost" class="h-6 px-2 text-xs" title={props.copy.formatDocument} onClick={props.onFormat}>{props.copy.formatDocument}</Button></Show>
          <Show when={props.language?.definition}><Button variant="ghost" class="h-6 px-2 text-xs" title={props.copy.goToDefinition} onClick={() => props.onDefinition(cursor().line, cursor().column)}>{props.copy.goToDefinition}</Button></Show>
          <Show when={props.hoverText}><Text class="min-w-0 truncate" title={props.hoverText}>{props.hoverText}</Text></Show>
          <Show when={feature("git")}><Text>{props.gitBranch || props.copy.sourceControl}</Text></Show>
          <Text>{props.copy.unsaved}: {props.dirtyCount}</Text>
        </Box></Show>
        <Show when={terminalVisible()}>
          <Box role="separator" aria-orientation="horizontal" aria-label={props.copy.terminal} aria-valuemin={120} aria-valuemax={480} aria-valuenow={terminalHeight()} tabindex={0} class="shrink-0 cursor-row-resize" style={{"touch-action":"none"}}
            onKeyDown={(e: KeyboardEvent) => {if(e.key === "ArrowUp" || e.key === "ArrowDown") {e.preventDefault();setTerminalHeight(h => Math.max(120,Math.min(480,h+(e.key === "ArrowUp" ? 16 : -16))));}}}
            onPointerDown={(e: PointerEvent) => { e.preventDefault(); const target=e.currentTarget as HTMLElement;target.setPointerCapture(e.pointerId);const y=e.clientY;const height=terminalHeight();const move=(event: PointerEvent)=>setTerminalHeight(Math.max(120,Math.min(480,height+y-event.clientY)));const stop=()=>{target.removeEventListener("pointermove",move);target.removeEventListener("pointerup",stop);target.removeEventListener("pointercancel",stop);};target.addEventListener("pointermove",move);target.addEventListener("pointerup",stop);target.addEventListener("pointercancel",stop);}} />
        </Show>
        <Show when={feature("terminal")}>
        <Box class="shrink-0 overflow-hidden" style={{height:terminalVisible() ? `${terminalHeight()}px` : "0px", "max-height":"50%"}}>
          <TerminalPanel problems={feature("languages")} copy={props.copy} api={props.api} tab={bottomTab()} onTab={tab => openBottom(tab)} onHide={() => patchChrome({ bottomVisible: false })}>
            <ProblemsPanel copy={props.copy} busy={props.validation.busy} output={props.validation.output} passed={props.validation.passed} stale={checkStale()} ranTool={props.validation.ranTool} tool={tool()} config={config()} onTool={setTool} onConfig={setConfig} onRun={() => props.onValidate(tool(),config())} onSaveAllCheck={() => props.onSaveAllCheck(tool(), config())} onCancel={props.onCancelCheck} onOpen={props.onLocation} />
          </TerminalPanel>
        </Box>
        </Show>
      </Stack>
      <Show when={chatVisible()}>
      <Box role="separator" aria-orientation="vertical" aria-label={props.copy.resizeChat} aria-valuemin={16} aria-valuemax={42} aria-valuenow={Math.round(pct().chat)} tabindex={0}
        class="shrink-0 cursor-col-resize" style={{"touch-action":"none"}}
        onPointerDown={(event: PointerEvent) => startSplit("chat",event)} onKeyDown={(event: KeyboardEvent) => onSplitKey("chat",event)} />
      <Box class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden" style={{width:`${pct().chat}%`}}>
        <ChatPanel copy={props.copy} messages={props.messages} draft={props.draft} busy={props.busy} runtimeNote={props.runtimeNote} onDraft={props.onDraft} onSend={props.onSend} onStop={props.onStop} />
      </Box>
      </Show>
      </Box>
    </Block>
  );
}
