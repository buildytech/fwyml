/**
 * Host facade: Wails Workspace/Host/UserStore/Agent when native; preview-session + session-local for Vite.
 * Includes listenHost (menu IPC), native Save-As / Open File, and Exit.
 */
import {
  CreateDir,
  CreateFile,
  OpenWorkspace,
  ReadFile,
  RenamePath,
  RestorePath,
  RevealPath,
  Search,
  TrashPath,
  Tree,
  Workspace,
  WriteFile,
  WriteFileForce,
} from "../../frontend/bindings/example.com/app/compose/workspaceservice";
import {
  Exit as HostExit,
  OpenPickedFile,
  PickFolder,
  Runtime as HostRuntime,
  SaveFileAs,
} from "../../frontend/bindings/example.com/app/compose/hostservice";
import { Events } from "@wailsio/runtime";
import { parseContextAction, type ContextAction } from "./context-actions";
import type { Palette } from "./theme";
import {
  ClearRecovery,
  LoadUserState,
  LoadWorkspaceLayout,
  OpenRecentWorkspace,
  RememberCurrent,
  ReopenLastWorkspace,
  Runtime as UserStoreRuntime,
  SaveRecovery,
  SaveUserPrefs,
  SaveWorkspaceLayout,
} from "../../frontend/bindings/example.com/app/compose/userstoreservice";
import {
  Abort as AgentAbort,
  Prompt as AgentPrompt,
  Status as AgentStatus,
} from "../../frontend/bindings/example.com/app/compose/agentservice";
import {
  loadLocalLayout,
  loadLocalRecovery,
  loadRecentWorkspaces,
  rememberRecentWorkspace,
  saveLocalLayout,
  saveLocalRecovery,
  type RecentWorkspace as LocalRecent,
  type RecoveryItem as LocalRecovery,
} from "./session-local";
import { readSessionLayout, type SessionLayoutView, writeOrThrow } from "./session-persist";
import { parsePrefs, readPrefs, writePrefs, type Prefs } from "./prefs";
import { hasNativeHost, isPreviewMode } from "./preview";
import {
  previewCreateDir,
  previewCreateFile,
  previewDefaultFile,
  previewOpenFile,
  previewRead,
  previewRename,
  previewRestore,
  previewSaveAs,
  previewSearch,
  previewTrash,
  previewTree,
  previewWorkspace,
  previewWorkspaceLabel,
  previewWrite,
  previewWriteAt,
  resetPreviewSession,
} from "./preview-session";
import type { FileWriteOutcome, SearchHit, WorkspaceFileBody, WorkspaceTreeNode } from "./workspace-tree";

/** Default folder opened when the Wails host starts with an empty workspace (proof / UX bootstrap). */
export const hostBootstrapRoot = "/tmp/ide-proof-workspace";

export type WorkspaceSnapshot = { attached: boolean; label: string };

export function usePreviewHost(): boolean {
  if (isPreviewMode()) return true;
  return !hasNativeHost();
}

export function emptyWorkspace(): WorkspaceSnapshot {
  return { attached: false, label: "" };
}

function asSnapshot(data: unknown): WorkspaceSnapshot {
  if (!data || typeof data !== "object") return emptyWorkspace();
  const rec = data as Record<string, unknown>;
  return {
    attached: rec.attached === true,
    label: typeof rec.label === "string" ? rec.label : "",
  };
}

function asTreeNode(data: unknown): WorkspaceTreeNode | null {
  if (!data || typeof data !== "object") return null;
  const rec = data as Record<string, unknown>;
  if (typeof rec.name !== "string" || typeof rec.path !== "string") return null;
  const kids = Array.isArray(rec.children)
    ? rec.children.map(asTreeNode).filter((node): node is WorkspaceTreeNode => node !== null)
    : undefined;
  return {
    name: rec.name,
    path: rec.path,
    dir: rec.dir === true,
    ...(kids && kids.length > 0 ? { children: kids } : {}),
  };
}

function asTree(data: unknown): WorkspaceTreeNode[] {
  return (Array.isArray(data) ? data : []).map(asTreeNode).filter((n): n is WorkspaceTreeNode => n !== null);
}

function asFileBody(data: unknown): WorkspaceFileBody | null {
  if (!data || typeof data !== "object") return null;
  const rec = data as Record<string, unknown>;
  if (typeof rec.path !== "string" || typeof rec.text !== "string") return null;
  return {
    path: rec.path,
    text: rec.text,
    revision: typeof rec.revision === "string" ? rec.revision : "",
  };
}

export async function hostRuntimeLabel(): Promise<string> {
  if (usePreviewHost()) return "preview";
  try {
    return await HostRuntime();
  } catch {
    return "host";
  }
}

export async function loadWorkspace(): Promise<WorkspaceSnapshot> {
  if (usePreviewHost()) return previewWorkspace();
  try {
    return asSnapshot(await Workspace());
  } catch {
    return emptyWorkspace();
  }
}

export async function openWorkspace(path: string): Promise<WorkspaceSnapshot> {
  if (usePreviewHost()) return previewWorkspace();
  return asSnapshot(await OpenWorkspace(path));
}

/** Open Folder via HostService.PickFolder. Returns null if the user cancels.
 *  Throws with message `pick-unavailable` when the native dialog cannot run (headless / no dialog). */
export async function pickAndOpenWorkspace(): Promise<WorkspaceSnapshot | null> {
  if (usePreviewHost()) return previewWorkspace();
  let path: string;
  try {
    path = await PickFolder();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`pick-unavailable: ${message}`);
  }
  if (!path) return null;
  return openWorkspace(path);
}

/** Prefer PickFolder; on cancel keep current workspace; on dialog failure open fixture fallback. */
export async function openFolderOrFallback(
  fallback = hostBootstrapRoot,
): Promise<{ snap: WorkspaceSnapshot; source: "pick" | "preview" | "cancel" | "fallback" }> {
  if (usePreviewHost()) {
    resetPreviewSession();
    return { snap: previewWorkspace(), source: "preview" };
  }
  try {
    const snap = await pickAndOpenWorkspace();
    if (!snap) return { snap: await loadWorkspace(), source: "cancel" };
    return { snap, source: "pick" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.startsWith("pick-unavailable") || !fallback) {
      throw error;
    }
    try {
      return { snap: await openWorkspace(fallback), source: "fallback" };
    } catch {
      return { snap: await loadWorkspace(), source: "fallback" };
    }
  }
}

/** Ensure a workspace is attached on host boot.
 *  Does not call PickFolder (dialogs are user-initiated). Opens fixture bootstrap when empty. */
export async function ensureWorkspace(bootstrap = hostBootstrapRoot): Promise<WorkspaceSnapshot> {
  if (usePreviewHost()) {
    resetPreviewSession();
    return previewWorkspace();
  }
  let snap = await loadWorkspace();
  if (!snap.attached && bootstrap) {
    try {
      snap = await openWorkspace(bootstrap);
    } catch {
      return emptyWorkspace();
    }
  }
  return snap;
}

export async function loadWorkspaceTree(): Promise<{ ok: true; nodes: WorkspaceTreeNode[] } | { ok: false; message: string }> {
  if (usePreviewHost()) return { ok: true, nodes: previewTree() };
  try {
    return { ok: true, nodes: asTree(await Tree()) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export async function readWorkspaceFile(path: string): Promise<WorkspaceFileBody | null> {
  if (usePreviewHost()) return previewRead(path);
  try {
    return asFileBody(await ReadFile(path));
  } catch {
    return null;
  }
}

export async function writeWorkspaceFile(
  path: string,
  text: string,
  expected = "",
  overwrite = false,
): Promise<FileWriteOutcome> {
  if (usePreviewHost()) return previewWriteAt(path, text, expected, overwrite);
  try {
    if (overwrite) {
      const body = asFileBody(await WriteFileForce(path, text));
      return body ? { ok: true, body } : { ok: false };
    }
    const result = await WriteFile(path, text, expected);
    const conflict =
      result.conflict === "changed" || result.conflict === "missing" ? result.conflict : undefined;
    return {
      ok: result.ok === true,
      ...(conflict ? { conflict } : {}),
      ...(asFileBody(result.body) ? { body: asFileBody(result.body)! } : {}),
      ...(asFileBody(result.disk) ? { disk: asFileBody(result.disk)! } : {}),
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "write-failed",
        operation: "write",
        path,
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function createWorkspaceDir(path: string): Promise<void> {
  if (usePreviewHost()) return previewCreateDir(path);
  await CreateDir(path);
}

export async function createWorkspaceFile(path: string): Promise<WorkspaceFileBody | null> {
  if (usePreviewHost()) return previewCreateFile(path);
  return asFileBody(await CreateFile(path));
}

export async function renameWorkspacePath(from: string, to: string): Promise<void> {
  if (usePreviewHost()) return previewRename(from, to);
  await RenamePath(from, to);
}

export async function trashWorkspacePath(path: string): Promise<string> {
  if (usePreviewHost()) return previewTrash(path);
  return TrashPath(path);
}

export async function restoreWorkspacePath(path: string): Promise<string> {
  if (usePreviewHost()) return previewRestore(path);
  return RestorePath(path);
}

export async function revealWorkspacePath(path: string): Promise<void> {
  if (usePreviewHost()) return;
  await RevealPath(path);
}

export async function searchWorkspace(
  query: string,
  caseSensitive: boolean,
  include = "",
  exclude = "",
): Promise<SearchHit[]> {
  if (usePreviewHost()) return previewSearch(query, caseSensitive, include, exclude);
  const rows = await Search(query, caseSensitive, include, exclude);
  return (rows ?? []).map((row) => ({
    path: row.path,
    line: row.line,
    column: row.column,
    preview: row.preview,
  }));
}

export { previewDefaultFile, previewWorkspaceLabel, previewWrite };


export type RecentWorkspace = { id: string; label: string };
export type RecoveryItem = { path: string; text: string; revision: string; untitled: boolean };
export type UserState = { prefsJSON: string; recent: RecentWorkspace[]; recovery: RecoveryItem[] };
export type WorkspaceLayout = SessionLayoutView;
export type AgentStatusView = { ready: boolean; reason: string; bridge: string };

export function emptyUserState(): UserState {
  return { prefsJSON: "", recent: [], recovery: [] };
}

export async function userstoreRuntimeLabel(): Promise<string> {
  if (usePreviewHost()) return "preview-local";
  try {
    return await UserStoreRuntime();
  } catch {
    return "userstore";
  }
}

export async function loadUserState(): Promise<UserState> {
  if (usePreviewHost()) {
    return {
      prefsJSON: JSON.stringify(readPrefs()),
      recent: loadRecentWorkspaces(),
      recovery: loadLocalRecovery(),
    };
  }
  try {
    const row = await LoadUserState();
    return {
      prefsJSON: typeof row.prefsJSON === "string" ? row.prefsJSON : "",
      recent: (row.recent ?? []).map((item) => ({ id: item.id, label: item.label })),
      recovery: (row.recovery ?? []).map((item) => ({
        path: item.path,
        text: item.text,
        revision: item.revision ?? "",
        untitled: item.untitled === true,
      })),
    };
  } catch {
    return emptyUserState();
  }
}

export async function saveUserPrefs(raw: string, required = false): Promise<void> {
  if (usePreviewHost()) {
    try {
      writePrefs(parsePrefs(JSON.parse(raw) as unknown));
    } catch {
      /* ignore */
    }
    return;
  }
  await writeOrThrow(required, () => SaveUserPrefs(raw));
}

export async function loadWorkspaceLayout(): Promise<WorkspaceLayout> {
  if (usePreviewHost()) {
    return loadLocalLayout() ?? readSessionLayout({});
  }
  try {
    return readSessionLayout(await LoadWorkspaceLayout());
  } catch {
    return readSessionLayout({});
  }
}

export async function saveWorkspaceLayout(layout: WorkspaceLayout, required = false): Promise<void> {
  if (usePreviewHost()) {
    saveLocalLayout(layout);
    return;
  }
  await writeOrThrow(required, () => SaveWorkspaceLayout(JSON.stringify(layout)));
}

export async function rememberCurrentWorkspace(): Promise<RecentWorkspace[]> {
  if (usePreviewHost()) {
    const snap = previewWorkspace();
    if (!snap.attached) return loadRecentWorkspaces();
    return rememberRecentWorkspace(snap.label, snap.label);
  }
  try {
    const rows = await RememberCurrent();
    return (rows ?? []).map((item) => ({ id: item.id, label: item.label }));
  } catch {
    return [];
  }
}

export async function openRecentWorkspace(id: string): Promise<WorkspaceSnapshot> {
  if (usePreviewHost()) {
    return previewWorkspace();
  }
  return asSnapshot(await OpenRecentWorkspace(id));
}

export async function reopenLastWorkspace(): Promise<WorkspaceSnapshot> {
  if (usePreviewHost()) return previewWorkspace();
  try {
    return asSnapshot(await ReopenLastWorkspace());
  } catch {
    return emptyWorkspace();
  }
}

export async function saveRecovery(items: RecoveryItem[], required = false): Promise<void> {
  if (usePreviewHost()) {
    saveLocalRecovery(items);
    return;
  }
  await writeOrThrow(required, () => SaveRecovery(JSON.stringify(items)));
}

export async function clearRecovery(): Promise<void> {
  if (usePreviewHost()) {
    saveLocalRecovery([]);
    return;
  }
  try {
    await ClearRecovery();
  } catch {
    /* ignore */
  }
}

export async function agentStatus(): Promise<AgentStatusView> {
  if (usePreviewHost()) {
    return { ready: false, reason: "preview-no-agent", bridge: "stub" };
  }
  try {
    const row = await AgentStatus();
    return {
      ready: row?.ready === true,
      reason: typeof row?.reason === "string" ? row.reason : "agent unavailable",
      bridge: typeof row?.bridge === "string" ? row.bridge : "unknown",
    };
  } catch (error) {
    return {
      ready: false,
      reason: error instanceof Error ? error.message : String(error),
      bridge: "unknown",
    };
  }
}

export async function agentPrompt(sessionId: string, text: string): Promise<{ ok: true; text: string } | { ok: false; reason: string }> {
  if (usePreviewHost()) {
    return { ok: false, reason: "preview-no-agent" };
  }
  try {
    const out = await AgentPrompt(sessionId, text);
    return { ok: true, text: typeof out === "string" ? out : String(out ?? "") };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

export async function agentAbort(sessionId: string): Promise<void> {
  if (usePreviewHost()) return;
  try {
    await AgentAbort(sessionId);
  } catch {
    /* ignore */
  }
}


export const eventSettings = "ide:settings";
export const eventWorkspace = "ide:workspace";
export const eventFile = "ide:file";
export const eventSave = "ide:save";
export const eventSaveAs = "ide:save-as";
export const eventViewHeader = "ide:view-header";
export const eventViewPalette = "ide:view-palette";

function asHeaderHidden(data: unknown): boolean | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  return typeof rec.hidden === "boolean" ? rec.hidden : null;
}

function asPalette(data: unknown): Palette | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  return rec.palette === "default" || rec.palette === "hinddy" ? rec.palette : null;
}

/** Subscribe to native menu / host events. Preview returns a no-op stopper. */
export function listenHost(handlers: {
  onContext?: (action: ContextAction) => void;
  onCommand?: (command: string) => void;
  onSettings: () => void;
  onWorkspace?: (snapshot: WorkspaceSnapshot) => void;
  onFile?: (body: WorkspaceFileBody) => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  onHideHeader?: (hidden: boolean) => void;
  onPalette?: (palette: Palette) => void;
}): () => void {
  if (usePreviewHost()) {
    return () => undefined;
  }
  try {
    const stops = [
      Events.On("buildy:context-action", (event) => {
        const action = parseContextAction(event.data);
        if (action) handlers.onContext?.(action);
      }),
      Events.On("ide:command", (event) => {
        const command = Array.isArray(event.data) ? event.data[0] : event.data;
        if (typeof command === "string") handlers.onCommand?.(command);
      }),
      Events.On(eventSettings, () => handlers.onSettings()),
      Events.On(eventWorkspace, (event) => {
        handlers.onWorkspace?.(asSnapshot(event.data));
      }),
      Events.On(eventFile, (event) => {
        const body = asFileBody(event.data);
        if (body) handlers.onFile?.(body);
      }),
      Events.On(eventSave, () => handlers.onSave?.()),
      Events.On(eventSaveAs, () => handlers.onSaveAs?.()),
      Events.On(eventViewHeader, (event) => {
        const hidden = asHeaderHidden(event.data);
        if (hidden !== null) handlers.onHideHeader?.(hidden);
      }),
      Events.On(eventViewPalette, (event) => {
        const palette = asPalette(event.data);
        if (palette) handlers.onPalette?.(palette);
      }),
    ];
    return () => {
      for (const stop of stops) stop();
    };
  } catch {
    return () => undefined;
  }
}

/** Native Save dialog when host:live; preview-session Save As otherwise. */
export async function saveWorkspaceFileAs(text: string, suggested: string): Promise<WorkspaceFileBody | null> {
  if (usePreviewHost()) return previewSaveAs(text, suggested);
  try {
    return asFileBody(await SaveFileAs(text, suggested));
  } catch {
    return null;
  }
}

/** Native Open File dialog when host:live. */
export async function openWorkspaceFile(): Promise<WorkspaceFileBody | null> {
  if (usePreviewHost()) return previewOpenFile();
  try {
    return asFileBody(await OpenPickedFile());
  } catch {
    return null;
  }
}

export async function exitWorkspace(): Promise<void> {
  if (usePreviewHost()) return;
  try {
    await HostExit();
  } catch {
    /* ignore */
  }
}

export type { LocalRecent, LocalRecovery };
