/**
 * Bridge App: EditorView chrome + host/workbench/userstore/languages bindings.
 * Disk sync, fault chrome, recovery, context menus, listenHost menus, native Save-As.
 * Browse WebView2 stays Windows-gated; agent offline until sidecar extract; no fake gopls claim.
 */
import { Show, batch, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { Block, Box, Button, Dialog, Text } from "$ui8kit/ui";
import { AppHeader } from "./components/AppHeader.solid";
import { AppMain } from "./components/AppMain.solid";
import { PreviewContextMenu } from "./components/widgets/PreviewContextMenu.solid";
import { EditorView } from "$views/EditorView.solid";
import { WelcomeView } from "./views/WelcomeView.solid";
import { SettingsView } from "./views/SettingsView.solid";
import { copy } from "./lib/copy";
import {
  agentAbort,
  agentPrompt,
  agentStatus,
  clearRecovery,
  createWorkspaceDir,
  createWorkspaceFile,
  ensureWorkspace,
  exitWorkspace,
  hostBootstrapRoot,
  hostRuntimeLabel,
  listenHost,
  loadUserState,
  loadWorkspaceLayout,
  loadWorkspaceTree,
  openFolderOrFallback,
  openRecentWorkspace,
  openWorkspaceFile,
  previewDefaultFile,
  previewWorkspaceLabel,
  readWorkspaceFile,
  rememberCurrentWorkspace,
  renameWorkspacePath,
  reopenLastWorkspace,
  restoreWorkspacePath,
  revealWorkspacePath,
  saveRecovery,
  saveWorkspaceFileAs,
  saveUserPrefs,
  saveWorkspaceLayout,
  searchWorkspace,
  trashWorkspacePath,
  usePreviewHost,
  userstoreRuntimeLabel,
  writeWorkspaceFile,
  type AgentStatusView,
  type RecentWorkspace,
  type WorkspaceSnapshot,
} from "./lib/host";
import { startAria, bindLateAria } from "./lib/aria";
import type { WorkspaceFileBody, WorkspaceTreeNode } from "./lib/workspace-tree";
import { workbench, type GitSnapshot } from "./lib/workbench";
import { columnsFromPrefs } from "./lib/column-split";
import {
  dirtyRecoveryItems,
  mergeRecoveredBuffers,
  sessionLayoutPayload,
  type SessionChrome,
} from "./lib/session-persist";
import { defaultProduct, hasFeature, loadProduct, type ProductProfileView } from "./lib/product";
import { appendUserMessage, createReduceState, type ReduceMessage } from "./lib/event-reduce";
import { parsePrefs, patchPrefs, readPrefs, writePrefs, type Prefs } from "./lib/prefs";
import { proceedAfterDirty, type DirtyChoice } from "./lib/dirty-choice";
import { browseCapability, browseUnavailableMessage } from "./lib/browse";
import {
  cancelValidation,
  languageComplete,
  languageDefinition,
  languageDiagnostics,
  languageFormat,
  languageHover,
  languageStatus,
  languageRuntimeLabel,
  type LanguageStatusView,
} from "./lib/language";
import { loadLocalChrome, saveLocalChrome } from "./lib/session-local";
import { isBrowserPath } from "./lib/browser-tab";
import {
  applySaved,
  bufferFromBody,
  bufferFromRecovery,
  isUntitledPath,
  isVirtualPath,
  nextUntitledPath,
  reconcileDisk,
  untitledLabel,
  type FileBuffer,
} from "./lib/file-buffer";
import { closingPaths, creationParent, type ContextAction } from "./lib/context-actions";
import { classifyHostError, faultStatus, type HostFault } from "./lib/host-error";
import logoSrc from "./assets/favicon/favicon.png";

function findFirstFile(nodes: WorkspaceTreeNode[]): string | undefined {
  for (const node of nodes) {
    if (!node.dir) return node.path;
    const nested = findFirstFile(node.children ?? []);
    if (nested) return nested;
  }
  return undefined;
}

export function App() {
  const [product, setProduct] = createSignal<ProductProfileView>(defaultProduct);
  const [prefs, setPrefs] = createSignal<Prefs>(readPrefs());
  const [workspace, setWorkspace] = createSignal<WorkspaceSnapshot>({ attached: false, label: "" });
  const [tree, setTree] = createSignal<WorkspaceTreeNode[]>([]);
  const [buffers, setBuffers] = createSignal<Record<string, FileBuffer>>({});
  const [activePath, setActivePath] = createSignal("");
  const [doc, setDoc] = createSignal("");
  const [status, setStatus] = createSignal(copy.statusReady);
  const [urgent, setUrgent] = createSignal(false);
  const [statusDetails, setStatusDetails] = createSignal("");
  const [statusAction, setStatusAction] = createSignal<{ label: string; run: () => void } | null>(null);
  const [hostMode, setHostMode] = createSignal<"preview" | "host">("preview");
  const [openingFolder, setOpeningFolder] = createSignal(false);
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [recent, setRecent] = createSignal<RecentWorkspace[]>([]);
  const [agentInfo, setAgentInfo] = createSignal<AgentStatusView>({ ready: false, reason: "offline", bridge: "stub" });
  let agentSession = "chat-1";
  const [dirtyAsk, setDirtyAsk] = createSignal<{ message: string; resolve: (choice: DirtyChoice) => void } | null>(null);
  const [git, setGit] = createSignal<GitSnapshot | null>(null);
  const [gitError, setGitError] = createSignal("");
  const [gitResult, setGitResult] = createSignal("");
  const [gitBusy, setGitBusy] = createSignal(false);
  const [commitMessage, setCommitMessage] = createSignal("");
  const [chrome, setChrome] = createSignal<SessionChrome>({
    ...loadLocalChrome(),
    bottomTab: "terminal",
    bottomVisible: true,
    chatVisible: true,
  });
  const [draft, setDraft] = createSignal("");
  const [chat, setChat] = createSignal(createReduceState());
  const [location, setLocation] = createSignal<{ path: string; line: number; column: number; request: number } | null>(null);
  const [menuCommand, setMenuCommand] = createSignal({ name: "", request: 0 });
  const [validation, setValidation] = createSignal<{
    busy: boolean;
    output: string;
    passed: boolean | null;
    tool: string;
    config: string;
    checkId: number;
    diskId: number;
    ranTool?: string;
    ranConfig?: string;
  }>({ busy: false, output: "", passed: null, tool: "", config: "", checkId: 0, diskId: 0 });
  let diskId = 0;
  const [closedTabs, setClosedTabs] = createSignal<string[]>([]);
  const [navBack, setNavBack] = createSignal<string[]>([]);
  const [navForward, setNavForward] = createSignal<string[]>([]);
  const [hoverText, setHoverText] = createSignal("");
  const [cursorPos, setCursorPos] = createSignal({ line: 1, column: 1 });
  const [language, setLanguage] = createSignal<LanguageStatusView | null>(null);
  const [lastTrash, setLastTrash] = createSignal("");
  const [browseError, setBrowseError] = createSignal(
    browseUnavailableMessage({ browserPreview: copy.browserPreview, browserDisconnected: copy.browserDisconnected }),
  );
  let navQuiet = false;
  let restoreQuiet = false;
  let locationRequest = 0;
  let closing = false;
  let layoutTimer = 0;
  let recoverTimer = 0;
  let saveTail: Promise<unknown> = Promise.resolve();
  let workspaceVersion = 0;

  const feature = (name: string) => hasFeature(product(), name);
  const features = () => product().features;

  const faultLabels = {
    missing: copy.faultMissing,
    "too-large": copy.faultTooLarge,
    utf8: copy.faultUtf8,
    "read-only": copy.faultReadOnly,
    permission: copy.faultPermission,
    "no-workspace": copy.faultNoWorkspace,
    conflict: copy.faultConflict,
    "tool-missing": copy.faultToolMissing,
    cancelled: copy.faultCancelled,
    unknown: copy.faultUnknown,
  };

  const reportFault = (fault: HostFault, retry?: () => void) => {
    setUrgent(true);
    setStatus(faultStatus(fault, faultLabels));
    setStatusDetails(fault.details ?? fault.message);
    setStatusAction(
      retry
        ? { label: copy.retry, run: () => { clearFault(); retry(); } }
        : fault.code === "read-only" || fault.code === "missing"
          ? null
          : null,
    );
  };
  const clearFault = () => {
    setUrgent(false);
    setStatusAction(null);
    setStatusDetails("");
  };

  const askDirty = (message: string) => new Promise<DirtyChoice>((resolve) => setDirtyAsk({ message, resolve }));
  const finishDirty = (choice: DirtyChoice) => {
    const ask = dirtyAsk();
    setDirtyAsk(null);
    ask?.resolve(choice);
  };

  const markDiskChanged = () => {
    diskId += 1;
    setValidation((current) => ({ ...current, diskId }));
  };

  const dirtyRecovery = () => dirtyRecoveryItems(buffers());
  const sessionLayout = (includeUntitled = true) =>
    sessionLayoutPayload(buffers(), prefs(), activePath(), cursorPos(), chrome(), { includeUntitled });
  const persistLayoutNow = () => {
    saveLocalChrome(chrome());
    writePrefs(prefs());
    void saveWorkspaceLayout(sessionLayout());
    void saveUserPrefs(JSON.stringify(prefs()));
  };
  const queueLayout = () => {
    window.clearTimeout(layoutTimer);
    layoutTimer = window.setTimeout(persistLayoutNow, 200);
  };
  const flushRecovery = () => {
    void saveRecovery(dirtyRecovery());
  };
  const queueRecovery = () => {
    window.clearTimeout(recoverTimer);
    flushRecovery();
  };
  const persistSessionNow = async (
    recovery = dirtyRecovery(),
    includeUntitled = true,
  ): Promise<boolean> => {
    window.clearTimeout(recoverTimer);
    window.clearTimeout(layoutTimer);
    try {
      await Promise.all([
        saveRecovery(recovery, true),
        saveWorkspaceLayout(sessionLayout(includeUntitled), true),
        saveUserPrefs(JSON.stringify(prefs()), true),
      ]);
      saveLocalChrome(chrome());
      writePrefs(prefs());
      return true;
    } catch (error) {
      reportFault(classifyHostError(error, "quit"));
      setStatus(copy.faultSession);
      return false;
    }
  };

  const refreshLanguage = (path: string) => {
    if (!feature("languages") || !path || isVirtualPath(path)) {
      setLanguage(null);
      return;
    }
    const version = workspaceVersion;
    void languageStatus(path)
      .then((view) => {
        if (version === workspaceVersion && activePath() === path) setLanguage(view);
      })
      .catch(() => {
        if (version === workspaceVersion && activePath() === path) setLanguage(null);
      });
  };

  const refreshTree = async (snap?: WorkspaceSnapshot) => {
    if (snap) setWorkspace(snap);
    const version = workspaceVersion;
    const loaded = await loadWorkspaceTree();
    if (version !== workspaceVersion) return loaded;
    if (loaded.ok) {
      setTree(loaded.nodes);
      syncOpenBuffers();
      return loaded;
    }
    setTree([]);
    reportFault(classifyHostError(loaded.message, "tree"), () => {
      void refreshTree();
    });
    return loaded;
  };

  const refreshGit = async () => {
    if (!feature("git")) return;
    setGitBusy(true);
    setGitError("");
    try {
      setGit(await workbench.gitStatus());
    } catch (err) {
      setGit(null);
      setGitError(err instanceof Error ? err.message : String(err));
    } finally {
      setGitBusy(false);
    }
  };

  const gitAction = async (run: () => Promise<unknown>) => {
    setGitBusy(true);
    setGitError("");
    setGitResult("");
    try {
      const result = await run();
      if (typeof result === "string" && result.trim()) setGitResult(result);
      await refreshGit();
    } catch (err) {
      setGitError(err instanceof Error ? err.message : String(err));
    } finally {
      setGitBusy(false);
    }
  };

  const syncOpenBuffers = () => {
    if (!workspace().attached) return;
    const version = workspaceVersion;
    const paths = Object.keys(buffers()).filter((path) => !isVirtualPath(path));
    for (const path of paths) {
      void readWorkspaceFile(path).then((disk) => {
        if (version !== workspaceVersion) return;
        const buffer = buffers()[path];
        if (!buffer) return;
        const next = reconcileDisk(buffer, disk);
        if (next.kind === "reload") {
          setBuffers((current) => ({ ...current, [path]: next.buffer }));
          if (activePath() === path) setDoc(next.buffer.text);
          setStatus(`${copy.statusSavedFile} ${path}`.trim());
        } else if (next.kind === "conflict") {
          setStatus(copy.statusDiskChanged);
          setUrgent(true);
        } else if (next.kind === "missing") {
          setStatus(copy.statusFileMissing);
          setUrgent(true);
        }
      });
    }
  };

  const applyFile = (body: WorkspaceFileBody) => {
    batch(() => {
      const existing = buffers()[body.path];
      if (!existing) setBuffers((current) => ({ ...current, [body.path]: bufferFromBody(body) }));
      setActivePath(body.path);
      setDoc(existing?.text ?? body.text);
      refreshLanguage(body.path);
    });
    if (!restoreQuiet) queueLayout();
  };

  const dropFile = (path: string) => {
    setClosedTabs((current) => [path, ...current.filter((item) => item !== path)].slice(0, 20));
    const next = { ...buffers() };
    delete next[path];
    setBuffers(next);
    if (activePath() === path) {
      const nextPath = Object.keys(next).at(-1);
      if (nextPath) applyFile({ path: nextPath, text: next[nextPath].text, revision: next[nextPath].revision });
      else {
        setActivePath("");
        setDoc("");
        setLanguage(null);
      }
    }
    queueLayout();
  };

  const serializeSave = (action: () => Promise<boolean>): Promise<boolean> => {
    const version = workspaceVersion;
    const next = saveTail.then(() => (version === workspaceVersion ? action() : false));
    saveTail = next.catch(() => {});
    return next;
  };

  const persistAsPath = async (from: string): Promise<boolean> => {
    const bufferText = buffers()[from]?.text ?? doc();
    const suggested = isUntitledPath(from) ? "untitled.txt" : from;
    const version = workspaceVersion;
    try {
      let body = await saveWorkspaceFileAs(bufferText, suggested);
      if (!body && usePreviewHost()) {
        const name = window.prompt(copy.commandSaveAs, suggested);
        if (!name) return false;
        const path = name.replaceAll("\\", "/");
        const outcome = await writeWorkspaceFile(path, bufferText, "", true);
        if (!outcome.ok || !outcome.body) {
          if (outcome.error) reportFault(classifyHostError(outcome.error.message, "write", path));
          else {
            setUrgent(true);
            setStatus(copy.statusWriteFailed);
          }
          return false;
        }
        body = outcome.body;
      }
      if (!body || version !== workspaceVersion) {
        return false;
      }
      const latest = buffers()[from]?.text ?? bufferText;
      setBuffers((current) => {
        const next = { ...current, [body!.path]: { ...applySaved(bufferFromBody(body!), body!), text: latest } };
        if (from && isUntitledPath(from) && from !== body!.path) delete next[from];
        return next;
      });
      if (activePath() === from) {
        setActivePath(body.path);
        setDoc(latest);
        refreshLanguage(body.path);
      }
      markDiskChanged();
      queueRecovery();
      queueLayout();
      setUrgent(false);
      setStatus(`${copy.statusSavedFile} ${body.path}`);
      await refreshTree();
      void refreshGit();
      return latest === body.text;
    } catch (error) {
      reportFault(classifyHostError(error, "write", suggested));
      return false;
    }
  };

  const persistAs = (): Promise<boolean> => serializeSave(() => persistAsPath(activePath()));

  const onOpenPicker = async () => {
    try {
      const body = await openWorkspaceFile();
      if (body) applyFile(body);
      else if (usePreviewHost()) runMenu("quick-open");
    } catch (error) {
      reportFault(classifyHostError(error, "read"));
    }
  };

  const persistPath = async (path: string): Promise<boolean> => {
    if (!path || !buffers()[path]) return false;
    if (isBrowserPath(path)) return true;
    if (isUntitledPath(path)) return persistAsPath(path);
    const text = buffers()[path].text;
    const version = workspaceVersion;
    const expected = buffers()[path]?.revision ?? "";
    const outcome = await writeWorkspaceFile(path, text, expected, false);
    if (version !== workspaceVersion) return false;
    if (outcome.ok && outcome.body) {
      setBuffers((current) => (current[path] ? { ...current, [path]: applySaved(current[path], outcome.body!) } : current));
      markDiskChanged();
      clearFault();
      setStatus(`${copy.statusSavedFile} ${path}`);
      await refreshTree();
      void refreshGit();
      queueRecovery();
      return buffers()[path]?.text === buffers()[path]?.saved;
    }
    if (outcome.conflict === "changed") {
      setStatus(copy.statusSaveConflict);
      setUrgent(true);
      if (window.confirm(copy.saveConflictOverwrite)) {
        const forced = await writeWorkspaceFile(path, text, expected, true);
        if (version !== workspaceVersion || !forced.ok || !forced.body) return false;
        setBuffers((current) => (current[path] ? { ...current, [path]: applySaved(current[path], forced.body!) } : current));
        markDiskChanged();
        clearFault();
        setStatus(`${copy.statusSavedFile} ${path}`);
        await refreshTree();
        void refreshGit();
        queueRecovery();
        return buffers()[path]?.text === buffers()[path]?.saved;
      }
      if (outcome.disk && window.confirm(copy.saveConflictReload)) {
        setBuffers((current) => ({ ...current, [path]: bufferFromBody(outcome.disk!) }));
        if (activePath() === path) setDoc(outcome.disk.text);
        queueRecovery();
        clearFault();
        setStatus(copy.statusReady);
      }
      return false;
    }
    if (outcome.conflict === "missing") {
      setStatus(copy.statusFileMissing);
      setUrgent(true);
      return persistAsPath(path);
    }
    if (outcome.error) {
      reportFault(classifyHostError(outcome.error.message, "write", outcome.error.path), () => {
        void persistCurrent();
      });
    } else {
      setStatus(copy.statusWriteFailed);
      setUrgent(true);
    }
    return false;
  };

  const persistCurrent = (): Promise<boolean> => {
    const path = activePath();
    return serializeSave(() => persistPath(path));
  };

  const saveAll = () =>
    serializeSave(async () => {
      for (const path of Object.keys(buffers())) {
        const buffer = buffers()[path];
        if (!buffer || buffer.text === buffer.saved) continue;
        if (!(await persistPath(path))) return false;
      }
      return !Object.values(buffers()).some((buffer) => buffer.text !== buffer.saved);
    });

  const closePaths = async (paths: string[]) => {
    if (closing) return;
    closing = true;
    try {
      for (const path of paths) {
        const buffer = buffers()[path];
        if (!buffer) continue;
        if (!isBrowserPath(path) && buffer.text !== buffer.saved) {
          const choice = await askDirty(`${copy.closeUnsaved} ${untitledLabel(path)}`);
          if (choice === "save") {
            setActivePath(path);
            setDoc(buffer.text);
            if (!(await persistCurrent())) return;
            if (isUntitledPath(path) && !buffers()[path]) {
              dropFile(activePath());
              continue;
            }
          } else if (!proceedAfterDirty(choice, false)) {
            return;
          }
        }
        dropFile(path);
      }
      queueRecovery();
    } finally {
      closing = false;
    }
  };

  const closeFile = (path: string) => {
    void closePaths([path]);
  };

  const applyRecovery = async (items: { path: string; text: string; revision: string; untitled: boolean }[]) => {
    const recovered: Record<string, FileBuffer> = {};
    let diskChanged = false;
    for (const item of items) {
      if (item.untitled || isUntitledPath(item.path) || isBrowserPath(item.path)) {
        recovered[item.path] = bufferFromRecovery(item, null).buffer;
        continue;
      }
      const disk = await readWorkspaceFile(item.path);
      const rec = bufferFromRecovery(item, disk);
      recovered[item.path] = rec.buffer;
      if (rec.kind === "conflict") diskChanged = true;
    }
    batch(() => {
      setBuffers((current) => mergeRecoveredBuffers(current, recovered));
      const active = activePath();
      if (active && recovered[active]) setDoc(recovered[active].text);
    });
    if (diskChanged) {
      setStatus(copy.recoverDiskChanged);
      setUrgent(true);
    }
    flushRecovery();
  };

  const validate = async (tool: string, config: string) => {
    if (!feature("languages") || !product().languages.includes(tool) || validation().busy) return;
    const version = workspaceVersion;
    const started = validation();
    setValidation({ ...started, busy: true, output: "", passed: null, tool, config, ranTool: tool, ranConfig: config });
    try {
      const result = await workbench.validate(tool, config);
      if (version === workspaceVersion) {
        setValidation((current) => ({
          ...current,
          busy: false,
          output: result.output,
          passed: result.passed,
          tool,
          config,
          checkId: started.diskId,
          ranTool: tool,
          ranConfig: config,
        }));
      }
    } catch (error) {
      if (version === workspaceVersion) {
        setValidation((current) => ({
          ...current,
          busy: false,
          output: String(error),
          passed: false,
          tool,
          config,
          checkId: started.diskId,
          ranTool: tool,
          ranConfig: config,
        }));
      }
    }
  };

  const openFile = async (path: string) => {
    if (!path) return;
    const current = activePath();
    if (!navQuiet && current && current !== path) {
      setNavBack((stack) => [...stack, current].slice(-40));
      setNavForward([]);
    }
    const existing = buffers()[path];
    if (existing) {
      if (isVirtualPath(path)) {
        applyFile({ path, text: existing.text, revision: existing.revision });
        return;
      }
      const disk = await readWorkspaceFile(path);
      const next = reconcileDisk(existing, disk);
      if (next.kind === "reload") {
        setBuffers((currentDocs) => ({ ...currentDocs, [path]: next.buffer }));
        applyFile({ path, text: next.buffer.text, revision: next.buffer.revision });
        return;
      }
      if (next.kind === "conflict") {
        setStatus(copy.statusDiskChanged);
        setUrgent(true);
        applyFile({ path, text: existing.text, revision: existing.revision });
        return;
      }
      if (next.kind === "missing") {
        setStatus(copy.statusFileMissing);
        setUrgent(true);
        applyFile({ path, text: existing.text, revision: existing.revision });
        return;
      }
      applyFile({ path, text: existing.text, revision: existing.revision });
      return;
    }
    if (isBrowserPath(path)) {
      setBrowseError(
        browseUnavailableMessage({
          browserPreview: copy.browserPreview,
          browserDisconnected: copy.browserDisconnected,
        }),
      );
      applyFile({ path, text: "", revision: "" });
      setStatus("Browser tab gated (WebView2 unavailable on Linux/preview)");
      return;
    }
    const body = await readWorkspaceFile(path);
    if (!body) {
      reportFault(classifyHostError("missing: file not found", "open", path), () => {
        void openFile(path);
      });
      return;
    }
    applyFile(body);
    setStatus(hostMode() === "host" ? `Opened ${path} via WorkspaceService` : `Opened ${path}`);
  };

  const editDoc = (value: string) => {
    setDoc(value);
    const path = activePath();
    if (path) setBuffers((current) => ({ ...current, [path]: { ...current[path], text: value } }));
    queueRecovery();
  };

  const applyPrefs = (patch: Partial<Prefs>) => {
    const next = patchPrefs(prefs(), patch);
    setPrefs(next);
    void saveUserPrefs(JSON.stringify(next));
    queueLayout();
  };

  const applyChrome = (next: SessionChrome) => {
    setChrome(next);
    saveLocalChrome(next);
    queueLayout();
  };

  const attachWorkspace = async (snap: WorkspaceSnapshot, note: string) => {
    workspaceVersion += 1;
    setValidation({ busy: false, output: "", passed: null, tool: "", config: "", checkId: 0, diskId: 0 });
    diskId = 0;
    const loaded = await refreshTree(snap);
    if (snap.attached) setRecent(await rememberCurrentWorkspace());
    restoreQuiet = true;
    try {
      const hostLayout = await loadWorkspaceLayout();
      setChrome({
        ...loadLocalChrome(),
        bottomTab: hostLayout.bottomTab === "problems" ? "problems" : "terminal",
        bottomVisible: hostLayout.bottomVisible,
        chatVisible: hostLayout.chatVisible || true,
        markdown: hostLayout.markdown ?? loadLocalChrome().markdown,
      });
      if (hostLayout.treePct > 0 && hostLayout.chatPct > 0) {
        applyPrefs({ treePct: hostLayout.treePct, chatPct: hostLayout.chatPct });
      }
      for (const path of hostLayout.tabs.slice(0, 16)) {
        if (buffers()[path]) continue;
        if (isUntitledPath(path)) {
          setBuffers((current) => (current[path] ? current : { ...current, [path]: { text: "", saved: "", revision: "" } }));
          continue;
        }
        if (isBrowserPath(path)) continue;
        const body = await readWorkspaceFile(path);
        if (body) applyFile(body);
      }
      const user = await loadUserState();
      setRecent(user.recent);
      if (user.recovery.length > 0) await applyRecovery(user.recovery);
      if (loaded.ok) {
        const first =
          (hostLayout.active && (buffers()[hostLayout.active] || hostLayout.tabs.includes(hostLayout.active))
            ? hostLayout.active
            : undefined) ??
          findFirstFile(loaded.nodes) ??
          (usePreviewHost() ? previewDefaultFile : "");
        if (first) await openFile(first);
        if (hostLayout.line > 0 && hostLayout.active && !isBrowserPath(hostLayout.active) && buffers()[hostLayout.active]) {
          setCursorPos({ line: hostLayout.line, column: hostLayout.column || 1 });
          setLocation({
            path: hostLayout.active,
            line: hostLayout.line,
            column: hostLayout.column || 1,
            request: ++locationRequest,
          });
        }
      }
    } finally {
      restoreQuiet = false;
    }
    // Drop stale Retry/details from tree/session faults once workspace note wins.
    clearFault();
    setStatus(note);
    await refreshGit();
    queueLayout();
  };

  const openFolder = async () => {
    if (openingFolder()) return;
    setOpeningFolder(true);
    try {
      const { snap, source } = await openFolderOrFallback(hostBootstrapRoot);
      let note = `Preview workspace · ${snap.label || previewWorkspaceLabel}`;
      if (source === "pick") note = `Opened folder via HostService.PickFolder · ${snap.label || "workspace"}`;
      else if (source === "fallback") note = `PickFolder unavailable — fixture ${hostBootstrapRoot} · ${snap.label || "workspace"}`;
      else if (source === "cancel") note = "Open Folder cancelled";
      await attachWorkspace(snap, note);
    } catch (error) {
      reportFault(classifyHostError(error, "open-folder"));
    } finally {
      setOpeningFolder(false);
    }
  };

  const openRecent = async (id: string) => {
    try {
      const snap = await openRecentWorkspace(id);
      await attachWorkspace(snap, `Opened recent · ${snap.label || id}`);
    } catch (error) {
      reportFault(classifyHostError(error, "recent", id));
    }
  };

  const newUntitled = () => {
    const path = nextUntitledPath(Object.keys(buffers()));
    setBuffers((current) => ({ ...current, [path]: { text: "", saved: "", revision: "" } }));
    setActivePath(path);
    setDoc("");
    setSettingsOpen(false);
    setStatus("New untitled buffer");
    queueLayout();
    queueRecovery();
  };

  const contextAction = async ({ scope, path, action }: ContextAction) => {
    try {
      if (action.startsWith("close")) {
        await closePaths(closingPaths(Object.keys(buffers()), path, action));
        return;
      }
      if (action === "reopen") {
        const recentTab = closedTabs()[0];
        if (recentTab) {
          setClosedTabs((items) => items.slice(1));
          await openFile(recentTab);
        }
        return;
      }
      if (action === "open") {
        await openFile(path);
        return;
      }
      if (action === "copy-path") {
        await navigator.clipboard.writeText(path);
        setStatus(`Copied ${path}`);
        return;
      }
      if (action === "reveal") {
        await revealWorkspacePath(path);
        return;
      }
      if (action === "new-file" || action === "new-folder") {
        const parent = creationParent(scope, path);
        const name = window.prompt(
          action === "new-file" ? copy.newFileInTree : copy.newFolder,
          action === "new-file" ? "untitled.txt" : "new-folder",
        );
        if (!name) return;
        const rel = (parent ? `${parent}/` : "") + name.replaceAll("\\", "/");
        if (action === "new-folder") await createWorkspaceDir(rel);
        else {
          const body = await createWorkspaceFile(rel);
          if (body) applyFile(body);
        }
      }
      if (action === "rename") {
        const name = window.prompt(copy.renameFile, path);
        if (!name || name === path) return;
        const to = name.replaceAll("\\", "/");
        await renameWorkspacePath(path, to);
        const moved = (value: string) => (value === path || value.startsWith(`${path}/`) ? to + value.slice(path.length) : value);
        setBuffers((current) => Object.fromEntries(Object.entries(current).map(([key, value]) => [moved(key), value])));
        setActivePath(moved(activePath()));
      }
      if (action === "trash") {
        if (!window.confirm(`${copy.deleteFile} ${path}`)) return;
        const affected = Object.keys(buffers()).filter((key) => key === path || key.startsWith(`${path}/`));
        for (const key of affected) {
          if (buffers()[key].text === buffers()[key].saved) continue;
          const choice = await askDirty(`${copy.closeUnsaved} ${key}`);
          if (choice === "cancel") return;
          if (choice === "save" && !(await serializeSave(() => persistPath(key)))) return;
        }
        setLastTrash(await trashWorkspacePath(path));
        for (const key of affected) dropFile(key);
      }
      if (action === "restore") {
        if (!lastTrash()) return;
        await restoreWorkspacePath(lastTrash());
        setLastTrash("");
      }
      queueRecovery();
      queueLayout();
      await refreshTree();
    } catch (err) {
      reportFault(classifyHostError(err, "write", path));
    }
  };

  const onSend = () => {
    const text = draft().trim();
    if (!text || chat().status === "running") return;
    setDraft("");
    setChat((state) => {
      const next = appendUserMessage(state, text);
      const thinking: ReduceMessage | null = prefs().showThinking
        ? { id: `think-${Date.now()}`, role: "thinking", text: "Calling AgentService.Prompt…", streaming: true }
        : null;
      return {
        ...next,
        status: "running",
        messages: thinking ? [...next.messages, thinking] : next.messages,
      };
    });
    void (async () => {
      const result = await agentPrompt(agentSession, text);
      const info = await agentStatus();
      setAgentInfo(info);
      setChat((state) => {
        const cleaned = {
          ...state,
          messages: state.messages.filter((m) => !(m.role === "thinking" && m.streaming)),
        };
        const reply: ReduceMessage = result.ok
          ? { id: `asst-${Date.now()}`, role: "assistant", text: result.text || "(empty reply)" }
          : {
              id: `asst-${Date.now()}`,
              role: "assistant",
              text: `Agent offline — ${result.reason}\n\n(${info.bridge}: ${info.reason})`,
            };
        return { ...cleaned, status: "idle", messages: [...cleaned.messages, reply] };
      });
    })();
  };

  const onStop = () => {
    void agentAbort(agentSession);
    setChat((state) => ({
      ...state,
      status: "idle",
      messages: state.messages.map((m) => (m.streaming ? { ...m, streaming: false } : m)),
    }));
    setStatus(copy.statusReady);
  };

  const runMenu = (name: string) => {
    if (name === "save-all") void saveAll();
    else if (name === "save") void persistCurrent();
    else if (name === "new") newUntitled();
    else if (name === "close") closeFile(activePath());
    else if (name === "open-folder") void openFolder();
    else if (name === "reopen") {
      const path = closedTabs()[0];
      if (path) {
        setClosedTabs((tabs) => tabs.slice(1));
        void openFile(path);
      }
    } else setMenuCommand((c) => ({ name, request: c.request + 1 }));
  };

  createEffect(() => {
    if (dirtyAsk()) bindLateAria();
  });

  onMount(() => {
    startAria();
    bindLateAria();
    writePrefs(prefs());
    void browseCapability();
    let exitBusy = false;
    const stopHost = listenHost({
      onContext: (request) => {
        void contextAction(request);
      },
      onCommand: (name) => {
        if (name === "exit") {
          if (exitBusy) return;
          exitBusy = true;
          void (async () => {
            try {
              if (!(await persistSessionNow())) return;
              if (Object.values(buffers()).some((buffer) => buffer.text !== buffer.saved)) {
                const choice = await askDirty(copy.exitUnsaved);
                if (choice === "cancel") return;
                if (choice === "save") {
                  if (!(await saveAll())) return;
                  if (!(await persistSessionNow())) return;
                } else if (!(await persistSessionNow([], false))) {
                  return;
                }
              }
              await exitWorkspace();
            } finally {
              exitBusy = false;
            }
          })();
          return;
        }
        if (name === "open-folder") void openFolder();
        else if (name === "open-file") void onOpenPicker();
        else if (name === "new") newUntitled();
        else if (name === "save-all") void saveAll();
        else if (name === "close") void closeFile(activePath());
        else if (name === "browser") setStatus(browseUnavailableMessage(copy));
        else runMenu(name);
      },
      onSettings: () => setSettingsOpen(true),
      onWorkspace: (snap) => {
        void attachWorkspace(snap, `host:live · ${snap.label || "workspace"}`);
      },
      onFile: (body) => applyFile(body),
      onSave: () => {
        void persistCurrent();
      },
      onSaveAs: () => {
        void persistAs();
      },
      onHideHeader: (hidden) => applyPrefs({ hideHeader: hidden }),
      onPalette: (palette) => applyPrefs({ palette }),
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && settingsOpen()) {
        event.preventDefault();
        setSettingsOpen(false);
        return;
      }
      if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.code === "KeyZ") {
        if (!settingsOpen() && workspace().attached) {
          event.preventDefault();
          if (!event.repeat && !event.isComposing) applyPrefs({ lineWrap: !prefs().lineWrap });
        }
        return;
      }
      if (!(event.ctrlKey || event.metaKey)) return;
      if (settingsOpen() && event.key !== ",") return;
      const key = event.key.toLowerCase();
      if (key === ",") {
        event.preventDefault();
        setSettingsOpen(true);
      } else if (key === "n") {
        event.preventDefault();
        newUntitled();
      } else if (key === "s") {
        event.preventDefault();
        if (event.shiftKey) void saveAll();
        else void persistCurrent();
      } else if (key === "w") {
        event.preventDefault();
        closeFile(activePath());
      } else if (event.shiftKey && key === "o") {
        event.preventDefault();
        void openFolder();
      } else if (key === "t" && event.shiftKey) {
        event.preventDefault();
        runMenu("reopen");
      }
    };
    const flushNow = () => {
      void persistSessionNow();
    };
    const onUnload = (event: BeforeUnloadEvent) => {
      flushNow();
      if (Object.values(buffers()).some((buffer) => buffer.text !== buffer.saved)) {
        event.preventDefault();
        event.returnValue = copy.exitUnsaved;
      }
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flushNow();
    };
    const diskTimer = window.setInterval(() => {
      if (workspace().attached) syncOpenBuffers();
    }, 2000);
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("pagehide", flushNow);
    document.addEventListener("visibilitychange", onHide);
    onCleanup(() => {
      flushNow();
      stopHost();
      window.clearInterval(diskTimer);
      window.clearTimeout(layoutTimer);
      window.clearTimeout(recoverTimer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("pagehide", flushNow);
      document.removeEventListener("visibilitychange", onHide);
    });

    void (async () => {
      const preview = usePreviewHost();
      setHostMode(preview ? "preview" : "host");
      setProduct(await loadProduct());
      let user = await loadUserState().catch((error) => {
        reportFault(classifyHostError(error, "session"));
        return { prefsJSON: "", recent: [] as RecentWorkspace[], recovery: [] as { path: string; text: string; revision: string; untitled: boolean }[] };
      });
      if (user.prefsJSON) {
        try {
          const next = parsePrefs(JSON.parse(user.prefsJSON) as unknown);
          setPrefs(next);
          writePrefs(next);
        } catch {
          /* keep defaults */
        }
      }
      setRecent(user.recent);
      setAgentInfo(await agentStatus());

      if (preview) {
        const snap = await ensureWorkspace();
        await attachWorkspace(snap, copy.statusPreview);
        return;
      }

      // Prefer last workspace when userstore has one; otherwise fixture bootstrap.
      const last = await reopenLastWorkspace().catch(() => ({ attached: false, label: "" } as WorkspaceSnapshot));
      const snap = last.attached ? last : await ensureWorkspace();
      const runtime = await hostRuntimeLabel();
      const storeRuntime = await userstoreRuntimeLabel();
      const langRuntime = await languageRuntimeLabel();
      await attachWorkspace(
        snap,
        last.attached
          ? `host:live · ${runtime} · ${storeRuntime} · ${langRuntime} · reopened · ${snap.label || "workspace"}`
          : `host:live · ${runtime} · ${storeRuntime} · ${langRuntime} · ${snap.label || "workspace"}`,
      );
      const loaded = await loadWorkspaceTree();
      if (loaded.ok) {
        setStatus((current) =>
          current.startsWith("host:live")
            ? `${current} · tree ${loaded.nodes.length}`
            : `host:live · ${runtime} · ${storeRuntime} · ${langRuntime} · ${snap.label || "workspace"} · tree ${loaded.nodes.length}`,
        );
      }
      await clearRecovery();
    })();
  });

  const tabs = () =>
    Object.entries(buffers()).map(([path, buffer]) => ({
      path,
      dirty: buffer.text !== buffer.saved,
      label: isUntitledPath(path) ? untitledLabel(path) : undefined,
    }));
  const visibleMessages = () =>
    chat().messages.filter((message) => {
      if (message.role === "thinking") return prefs().showThinking;
      if (message.role === "tool") return prefs().showToolTrace;
      return true;
    });
  const label = () => workspace().label || (hostMode() === "preview" ? previewWorkspaceLabel : "");
  const gitBranch = () => {
    const snap = git();
    if (!snap) return "";
    return snap.upstream
      ? `${snap.branch} ${copy.gitAhead} ${snap.ahead ?? 0} ${copy.gitBehind} ${snap.behind ?? 0}`
      : snap.branch ?? "";
  };
  const showWelcome = () => !workspace().attached && !settingsOpen() && Object.keys(buffers()).length === 0;
  const showEditor = () => (workspace().attached || Object.keys(buffers()).length > 0) && !settingsOpen();
  const gateBrowse = () =>
    setBrowseError(
      browseUnavailableMessage({
        browserPreview: copy.browserPreview,
        browserDisconnected: copy.browserDisconnected,
      }),
    );
  const validationView = () => {
    const value = validation();
    return {
      busy: value.busy,
      output: value.output,
      passed: value.passed,
      ranTool: value.ranTool ?? value.tool,
      ranConfig: value.ranConfig ?? value.config,
      stale:
        value.passed !== null &&
        (value.checkId !== value.diskId || Object.values(buffers()).some((buffer) => buffer.text !== buffer.saved)),
    };
  };

  return (
    <Block
      tag="div"
      class="flex h-full min-h-0 flex-col bg-background text-foreground"
      data-ui-runtime="solid"
      data-product="ide-solid-full"
      data-extract="disk-sync+fault+menus+recovery+userstore"
      data-host={hostMode()}
    >
      <Show when={!prefs().hideHeader}>
        <AppHeader
          copy={copy}
          logoSrc={logoSrc}
          workspaceLabel={label()}
          onOpenFolder={() => void openFolder()}
          openFolderDisabled={openingFolder()}
        />
      </Show>
      <AppMain
        status={status()}
        urgent={urgent()}
        actionLabel={statusAction()?.label}
        onAction={() => statusAction()?.run()}
        details={statusDetails()}
        detailsLabel={copy.showDetails || copy.detailsLabel}
      >
        <Show when={settingsOpen()}>
          <SettingsView copy={copy} prefs={prefs()} onPrefs={applyPrefs} onClose={() => setSettingsOpen(false)} />
        </Show>
        <Show when={showWelcome()}>
          <WelcomeView
            copy={copy}
            onOpen={() => void openFolder()}
            onOpenFile={() => void onOpenPicker()}
            onNewFile={newUntitled}
            onSettings={() => setSettingsOpen(true)}
            recent={recent()}
            onRecent={(id) => void openRecent(id)}
          />
        </Show>
        <Show when={showEditor()}>
          <Box class="flex min-h-0 min-w-0 flex-1 flex-col">
            <EditorView
              copy={copy}
              features={features()}
              api={workbench}
              menuCommand={menuCommand()}
              validation={validationView()}
              onValidate={(tool, config) => void validate(tool, config)}
              onLocation={(path, line, column) => {
                void openFile(path);
                setLocation({ path, line, column, request: ++locationRequest });
              }}
              location={location()}
              onSettings={() => setSettingsOpen(true)}
              onOpenFolder={() => void openFolder()}
              onRefresh={() => void refreshTree().then(() => refreshGit())}
              tabs={tabs()}
              browseError={browseError()}
              browsePicking={false}
              browsePreview={!browseCapability().available}
              onBrowseNavigate={gateBrowse}
              onBrowseReload={gateBrowse}
              onBrowsePick={gateBrowse}
              onBrowseLayout={() => undefined}
              git={git()}
              gitError={gitError()}
              gitResult={gitResult()}
              gitBusy={gitBusy()}
              commitMessage={commitMessage()}
              onCommitMessage={setCommitMessage}
              onGitRefresh={() => void refreshGit()}
              onStage={(path) => void gitAction(() => workbench.stage(path))}
              onStageAll={() =>
                void gitAction(async () => {
                  for (const file of git()?.files ?? []) {
                    if (file.worktree !== " ") await workbench.stage(file.path);
                  }
                })
              }
              onCommit={() =>
                void gitAction(async () => {
                  await workbench.commit(commitMessage());
                  setCommitMessage("");
                })
              }
              onUnstage={(path) => void gitAction(() => workbench.unstage(path))}
              onPush={() => void gitAction(() => workbench.push())}
              onFetch={() => void gitAction(() => workbench.fetch())}
              onPull={() => void gitAction(() => workbench.pull())}
              onCloseFile={closeFile}
              filePath={activePath()}
              doc={doc()}
              layout={{
                tabSize: prefs().tabSize,
                lineWrap: prefs().lineWrap,
                fontScale: prefs().fontScale,
                uiZoom: prefs().uiZoom,
              }}
              messages={visibleMessages()}
              draft={draft()}
              busy={chat().status === "running"}
              onDoc={editDoc}
              onSave={() => void persistCurrent()}
              onSaveAs={() => void persistAs()}
              onOpenPicker={() => runMenu("quick-open")}
              onDraft={setDraft}
              onSend={onSend}
              onStop={onStop}
              runtimeNote={agentInfo().ready ? "" : `${copy.offlineAgent} · ${agentInfo().bridge}: ${agentInfo().reason}`}
              workspaceLabel={label() || copy.treeTitle}
              workspaceAttached={workspace().attached || hostMode() === "preview"}
              tree={tree()}
              treeSkipped={false}
              onOpenFile={(path) => void openFile(path)}
              language={language()}
              closedCount={closedTabs().length}
              onReopen={() => runMenu("reopen")}
              canNavBack={navBack().length > 0}
              canNavForward={navForward().length > 0}
              onNavBack={() => {
                const prev = navBack().at(-1);
                if (!prev) return;
                const current = activePath();
                setNavBack((stack) => stack.slice(0, -1));
                if (current) setNavForward((stack) => [current, ...stack].slice(0, 40));
                navQuiet = true;
                void openFile(prev).finally(() => {
                  navQuiet = false;
                });
              }}
              onNavForward={() => {
                const next = navForward()[0];
                if (!next) return;
                const current = activePath();
                setNavForward((stack) => stack.slice(1));
                if (current) setNavBack((stack) => [...stack, current].slice(-40));
                navQuiet = true;
                void openFile(next).finally(() => {
                  navQuiet = false;
                });
              }}
              hoverText={hoverText()}
              onIdleCursor={(line, column) => {
                setCursorPos({ line, column });
                setHoverText("");
                queueLayout();
              }}
              onFormat={() => {
                const path = activePath();
                if (!feature("languages") || !path || isVirtualPath(path)) {
                  setStatus(copy.formatDocument);
                  return;
                }
                const source = doc();
                const version = workspaceVersion;
                void languageFormat(path, source)
                  .then((next) => {
                    if (version !== workspaceVersion || activePath() !== path) return;
                    if (doc() !== source) {
                      setStatus(copy.formatChanged);
                      return;
                    }
                    if (next !== doc()) editDoc(next);
                    const lang = language();
                    setStatus(
                      lang?.ready
                        ? `${copy.formatDocument} ${path}`
                        : `${copy.formatDocument} · ${lang?.reason || "language host"}`,
                    );
                  })
                  .catch((error) => {
                    if (version === workspaceVersion && activePath() === path) {
                      reportFault(classifyHostError(error, "format", path));
                    }
                  });
              }}
              onDefinition={(line, column) => {
                const path = activePath();
                if (!feature("languages") || !path || isVirtualPath(path)) {
                  setStatus(`${copy.goToDefinition} (no language host)`);
                  return;
                }
                void languageDefinition(path, doc(), line, column)
                  .then((hits) => {
                    const hit = hits[0];
                    if (hit?.path) {
                      void openFile(hit.path).then(() => {
                        setStatus(`${copy.goToDefinition} ${hit.path}:${hit.line}`);
                      });
                    } else {
                      setStatus(copy.languageWorkspace);
                    }
                  })
                  .catch((error) => reportFault(classifyHostError(error, "definition", path)));
              }}
              onComplete={async (line, column) => {
                const path = activePath();
                if (!feature("languages") || !path || isVirtualPath(path)) return [];
                const hits = await languageComplete(path, doc(), line, column);
                return hits.map((hit) => ({ label: hit.text || hit.preview || "" }));
              }}
              onHover={async (line, column) => {
                const path = activePath();
                if (!feature("languages") || !path || isVirtualPath(path)) {
                  setHoverText("");
                  return "";
                }
                const next = await languageHover(path, doc(), line, column);
                setHoverText(next);
                return next;
              }}
              onDiagnostics={async () => {
                const path = activePath();
                if (!feature("languages") || !path || isVirtualPath(path)) return [];
                const hits = await languageDiagnostics(path);
                return hits.map((hit) => ({
                  line: hit.line,
                  column: hit.column,
                  message: hit.preview || hit.text,
                }));
              }}
              onCancelCheck={() => {
                void cancelValidation();
                setValidation((value) => ({ ...value, busy: false }));
              }}
              onSaveAllCheck={(tool, config) => {
                void saveAll().then((saved) => {
                  if (saved) return validate(tool, config);
                });
              }}
              gitBranch={gitBranch()}
              dirtyCount={Object.values(buffers()).filter((buffer) => buffer.text !== buffer.saved).length}
              columns={columnsFromPrefs(prefs().treePct, prefs().chatPct)}
              onColumns={(pct) => applyPrefs({ treePct: pct.tree, chatPct: pct.chat })}
              chrome={chrome()}
              onChrome={applyChrome}
            />
          </Box>
        </Show>
      </AppMain>
      <PreviewContextMenu copy={copy} onAction={(request) => { void contextAction(request); }} />
      <Show when={dirtyAsk()}>
        <Dialog
          ref={(element: HTMLDialogElement) =>
            queueMicrotask(() => {
              if (element.isConnected && !element.open) element.showModal();
            })
          }
          data-state="open"
          onCancel={(event: Event) => {
            event.preventDefault();
            finishDirty("cancel");
          }}
          onKeyDown={(event: KeyboardEvent) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              finishDirty("cancel");
            }
          }}
          data-ui8kit="dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dirty-ask-title"
          class="fixed inset-x-0 top-24 z-50 mx-auto max-w-md border border-border bg-card p-6"
        >
          <Text id="dirty-ask-title" class="text-sm">
            {dirtyAsk()?.message}
          </Text>
          <Box class="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => finishDirty("save")}>
              {copy.saveAndContinue}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => finishDirty("discard")}>
              {copy.discardChanges}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => finishDirty("cancel")}>
              {copy.cancelAction}
            </Button>
          </Box>
        </Dialog>
      </Show>
    </Block>
  );
}

void searchWorkspace;
