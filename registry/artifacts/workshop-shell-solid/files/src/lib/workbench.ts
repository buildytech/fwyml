/**
 * VCS + terminal workbench facade.
 * Host path: compose.VCSService / TerminalService bindings.
 * Preview path: preview-session (Vite browser).
 * Note: TerminalService is in-memory on Linux (not a PTY).
 */
import {
  Commit,
  Diff,
  Fetch,
  Pull,
  Push,
  Stage,
  Status,
  Unstage,
} from "../../frontend/bindings/example.com/app/compose/vcsservice";
import {
  Close as TermClose,
  Environments,
  Read as TermRead,
  Resize as TermResize,
  Start as TermStart,
  Write as TermWrite,
} from "../../frontend/bindings/example.com/app/compose/terminalservice";
import { usePreviewHost } from "./host";
import { previewWorkbench } from "./preview-session";

export type GitFile = { path: string; orig?: string; index: string; worktree: string; kind?: string };
export type GitSnapshot = { branch: string; upstream?: string; ahead?: number; behind?: number; files: GitFile[] };
export type Shell = { id: string; label: string; available: boolean };

export const workbench = {
  validate: async (tool: string, config: string) => {
    if (usePreviewHost()) return previewWorkbench.validate(tool, config);
    return { tool, output: `host validate stub: ${tool} ${config}`, passed: true };
  },
  gitStatus: async (): Promise<GitSnapshot> => {
    if (usePreviewHost()) return previewWorkbench.gitStatus();
    const result = await Status();
    return {
      branch: result.branch,
      upstream: result.upstream,
      ahead: result.ahead,
      behind: result.behind,
      files: (result.files ?? []).map((file) => ({
        path: file.path,
        orig: file.orig,
        index: file.index,
        worktree: file.worktree,
        kind: file.kind,
      })),
    };
  },
  stage: async (path: string) => {
    if (usePreviewHost()) return previewWorkbench.stage(path);
    await Stage(path);
  },
  unstage: async (path: string) => {
    if (usePreviewHost()) return previewWorkbench.unstage(path);
    await Unstage(path);
  },
  push: async () => {
    if (usePreviewHost()) return previewWorkbench.push();
    return Push();
  },
  fetch: async () => {
    if (usePreviewHost()) return previewWorkbench.fetch();
    return Fetch();
  },
  pull: async () => {
    if (usePreviewHost()) return previewWorkbench.pull();
    return Pull();
  },
  commit: async (message: string) => {
    if (usePreviewHost()) return previewWorkbench.commit(message);
    await Commit(message);
  },
  shells: async (): Promise<Shell[]> => {
    if (usePreviewHost()) return previewWorkbench.shells();
    const envs = (await Environments()) ?? [];
    return envs.map((env) => ({
      id: env.id ?? "preview",
      label: env.label ?? env.id ?? "shell",
      available: true,
    }));
  },
  start: async (shell: string, cols: number, rows: number) => {
    if (usePreviewHost()) return previewWorkbench.start(shell, cols, rows);
    const started = await TermStart(shell);
    await TermResize(cols, rows);
    return started.id ?? "";
  },
  read: async (id: string) => {
    if (usePreviewHost()) return previewWorkbench.read(id);
    const chunk = await TermRead();
    return {
      data: typeof chunk.data === "string" ? btoa(unescape(encodeURIComponent(chunk.data))) : "",
      done: chunk.done === true,
    };
  },
  input: async (id: string, data: string) => {
    if (usePreviewHost()) return previewWorkbench.input(id, data);
    await TermWrite(data);
  },
  resize: async (id: string, cols: number, rows: number) => {
    if (usePreviewHost()) return previewWorkbench.resize(id, cols, rows);
    await TermResize(cols, rows);
  },
  close: async (id: string) => {
    if (usePreviewHost()) return previewWorkbench.close(id);
    await TermClose();
  },
  diff: async (path: string, staged: boolean) => {
    if (usePreviewHost()) return previewWorkbench.diff(path, staged);
    return Diff(path, staged);
  },
};
export type Workbench = typeof workbench;
