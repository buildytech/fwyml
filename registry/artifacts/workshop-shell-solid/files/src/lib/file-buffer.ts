import { isBrowserPath } from "./browser-tab";
import type { FileWriteOutcome, WorkspaceFileBody } from "./workspace-tree";

export type FileBuffer = {
  text: string;
  saved: string;
  revision: string;
};

export const untitledPrefix = "untitled:";

export function isUntitledPath(path: string): boolean {
  return path.startsWith(untitledPrefix);
}

export function isVirtualPath(path: string): boolean {
  return isUntitledPath(path) || isBrowserPath(path);
}

export function nextUntitledPath(used: Iterable<string>): string {
  let n = 1;
  const taken = new Set(used);
  while (taken.has(`${untitledPrefix}${n}`)) n += 1;
  return `${untitledPrefix}${n}`;
}

export function untitledLabel(path: string): string {
  return path.startsWith(untitledPrefix) ? `Untitled-${path.slice(untitledPrefix.length)}` : path;
}

export type RecoverySeed = { path: string; text: string; revision: string; untitled: boolean };

export function bufferFromRecovery(
  item: RecoverySeed,
  disk: WorkspaceFileBody | null,
): { buffer: FileBuffer; kind: "untitled" | "clean" | "dirty" | "conflict" | "missing" } {
  if (item.untitled || isUntitledPath(item.path)) {
    return { buffer: { text: item.text, saved: "", revision: "" }, kind: "untitled" };
  }
  if (isBrowserPath(item.path)) {
    return { buffer: { text: item.text, saved: item.text, revision: "" }, kind: "untitled" };
  }
  if (!disk) {
    return { buffer: { text: item.text, saved: "", revision: item.revision }, kind: "missing" };
  }
  if (disk.text === item.text) {
    return { buffer: { text: disk.text, saved: disk.text, revision: disk.revision }, kind: "clean" };
  }
  return {
    buffer: { text: item.text, saved: disk.text, revision: item.revision },
    kind: item.revision === disk.revision ? "dirty" : "conflict",
  };
}

export function bufferFromBody(body: WorkspaceFileBody): FileBuffer {
  return { text: body.text, saved: body.text, revision: body.revision };
}

export function applySaved(buffer: FileBuffer, body: WorkspaceFileBody): FileBuffer {
  return { text: buffer.text, saved: body.text, revision: body.revision };
}

export type DiskReconcile =
  | { kind: "same"; buffer: FileBuffer }
  | { kind: "reload"; buffer: FileBuffer }
  | { kind: "conflict"; buffer: FileBuffer; disk: WorkspaceFileBody }
  | { kind: "missing"; buffer: FileBuffer };

export function reconcileDisk(buffer: FileBuffer, disk: WorkspaceFileBody | null): DiskReconcile {
  if (!disk) return { kind: "missing", buffer };
  if (disk.revision === buffer.revision) return { kind: "same", buffer };
  const clean = buffer.text === buffer.saved;
  if (clean) {
    return { kind: "reload", buffer: { text: disk.text, saved: disk.text, revision: disk.revision } };
  }
  return { kind: "conflict", buffer, disk };
}

export function outcomeBody(outcome: FileWriteOutcome): WorkspaceFileBody | null {
  if (outcome.ok && outcome.body) return outcome.body;
  return null;
}
