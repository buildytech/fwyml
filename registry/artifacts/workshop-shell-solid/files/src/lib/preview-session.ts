import { filePathsToTree, type FileWriteOutcome, type SearchHit, type WorkspaceFileBody, type WorkspaceTreeNode } from "./workspace-tree";

type GitFile = { path: string; index: string; worktree: string };
type GitSnapshot = { branch: string; upstream?: string; ahead?: number; behind?: number; files: GitFile[] };
type Shell = { id: string; label: string; available: boolean };

export const previewWorkspaceLabel = "preview-workspace";
export const previewDefaultFile = "src/App.tsx";

const initialFiles: Record<string, string> = {
  "README.md": "# Preview workspace\n\nIn-memory files for Vite UX. Edits stay in this tab.\n",
  "package.json": '{\n  "name": "preview-workspace",\n  "private": true\n}\n',
  "src/App.tsx": `export function App() {
  const title = "IDE BuildY";
  return (
    <main>
      <h1>{title}</h1>
    </main>
  );
}
`,
  "src/theme.css": ":root {\n  --bg: #080808;\n  --accent: #fab283;\n}\n",
  "src/lib/host.ts": "export function emptyWorkspace() {\n  return { attached: false, label: \"\" };\n}\n",
  "internal/app/service.go": "package app\n\nfunc Ready() string {\n\treturn \"ok\"\n}\n",
};

type FileRec = { text: string; rev: number };

function cloneFiles(): Record<string, FileRec> {
  const next: Record<string, FileRec> = {};
  let rev = 1;
  for (const [path, text] of Object.entries(initialFiles)) {
    next[path] = { text, rev };
    rev += 1;
  }
  return next;
}

function bodyOf(path: string, rec: FileRec): WorkspaceFileBody {
  return { path, text: rec.text, revision: String(rec.rev) };
}

function touchGit(path: string): void {
  const row = gitFiles.find((item) => item.path === path);
  if (row) {
    if (row.index === "?") row.worktree = "?";
    else row.worktree = "M";
  } else {
    gitFiles = [...gitFiles, { path, index: "?", worktree: "?" }];
  }
}

function initialGit(): GitFile[] {
  return [
    { path: "src/App.tsx", index: " ", worktree: "M" },
    { path: "README.md", index: "M", worktree: " " },
    { path: "src/theme.css", index: "?", worktree: "?" },
  ];
}

function encodeOutput(text: string): string {
  return btoa(unescape(encodeURIComponent(text)));
}

type TermSession = { pending: string[]; done: boolean };

let files = cloneFiles();
let dirs = new Set<string>();
let gitFiles = initialGit();
let termSeq = 0;
const terminals = new Map<string, TermSession>();

function parentDirs(path: string): string[] {
  const parts = path.replaceAll("\\", "/").split("/").filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < parts.length - 1; i++) out.push(parts.slice(0, i + 1).join("/"));
  return out;
}

export function resetPreviewSession(): void {
  files = cloneFiles();
  dirs = new Set();
  gitFiles = initialGit();
  termSeq = 0;
  fileRev = 100;
  terminals.clear();
  for (const key of Object.keys(previewBin)) delete previewBin[key];
}

export function previewWorkspace(): { attached: true; label: string } {
  return { attached: true, label: previewWorkspaceLabel };
}

export function previewTree(): WorkspaceTreeNode[] {
  return filePathsToTree(Object.keys(files), [...dirs]);
}

let fileRev = 100;

export function previewRead(path: string): WorkspaceFileBody | null {
  const rec = files[path];
  return rec === undefined ? null : bodyOf(path, rec);
}

export function previewReplaceExternal(path: string, text: string): WorkspaceFileBody | null {
  const rec = files[path];
  if (!rec) return null;
  fileRev += 1;
  rec.text = text;
  rec.rev = fileRev;
  return bodyOf(path, rec);
}

export function previewDeleteExternal(path: string): void {
  delete files[path];
}

export function previewWriteAt(
  path: string,
  text: string,
  expected: string,
  overwrite: boolean,
): FileWriteOutcome {
  const rec = files[path];
  if (rec) {
    const current = String(rec.rev);
    if (!overwrite && expected !== current) {
      return { ok: false, conflict: "changed", disk: bodyOf(path, rec) };
    }
  } else if (!overwrite && expected !== "") {
    return { ok: false, conflict: "missing", disk: { path, text: "", revision: "" } };
  }
  fileRev += 1;
  files[path] = { text, rev: fileRev };
  for (const parent of parentDirs(path)) dirs.add(parent);
  touchGit(path);
  return { ok: true, body: bodyOf(path, files[path]) };
}

export function previewWrite(path: string, text: string): WorkspaceFileBody {
  const outcome = previewWriteAt(path, text, "", true);
  return outcome.body ?? { path, text, revision: "" };
}

export function previewCreateDir(path: string): void {
  const slash = path.replaceAll("\\", "/").replace(/\/+$/, "");
  if (!slash) throw new Error("directory: path is the workspace root");
  if (files[slash] || dirs.has(slash)) throw new Error("conflict: destination already exists");
  dirs.add(slash);
  for (const parent of parentDirs(slash + "/x")) dirs.add(parent);
}

export function previewCreateFile(path: string): WorkspaceFileBody {
  const slash = path.replaceAll("\\", "/");
  if (files[slash] || dirs.has(slash)) throw new Error("conflict: destination already exists");
  return previewWrite(slash, "");
}

export function previewRename(from: string, to: string): void {
  if (files[to] || dirs.has(to)) throw new Error("conflict: destination already exists");
  const rec = files[from];
  if (rec) {
    files[to] = rec;
    delete files[from];
    for (const parent of parentDirs(to)) dirs.add(parent);
    return;
  }
  if (!dirs.has(from)) throw new Error("missing: file does not exist");
  const prefix = from + "/";
  for (const key of Object.keys(files)) {
    if (key === from || key.startsWith(prefix)) {
      files[to + key.slice(from.length)] = files[key];
      delete files[key];
    }
  }
  for (const dir of [...dirs]) {
    if (dir === from || dir.startsWith(prefix)) {
      dirs.delete(dir);
      dirs.add(to + dir.slice(from.length));
    }
  }
}

const previewBin: Record<string, FileRec> = {};

export function previewTrash(path: string): string {
  if (!files[path]) throw new Error("missing: file does not exist");
  const dest = `.ide-trash/${path}`;
  previewBin[dest] = files[path];
  delete files[path];
  return dest;
}

export function previewRestore(rel: string): string {
  const rec = previewBin[rel];
  if (!rec) throw new Error("missing: trash entry does not exist");
  const orig = rel.replace(/^\.ide-trash\//, "");
  if (files[orig]) throw new Error("conflict: destination already exists");
  files[orig] = rec;
  delete previewBin[rel];
  return orig;
}

function globMatch(value: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`).test(value);
}

function allowPreviewPath(filePath: string, include: string, exclude: string): boolean {
  const base = filePath.split("/").pop() ?? filePath;
  const split = (raw: string) => raw.split(/[,;\s]+/).map(item => item.trim()).filter(Boolean);
  const excluded = split(exclude);
  if (excluded.some(pattern => globMatch(filePath, pattern) || globMatch(base, pattern))) return false;
  const included = split(include);
  if (included.length === 0) return true;
  return included.some(pattern => globMatch(filePath, pattern) || globMatch(base, pattern));
}

export function previewSearch(query: string, caseSensitive: boolean, include = "", exclude = ""): SearchHit[] {
  const needle = caseSensitive ? query : query.toLowerCase();
  const hits: SearchHit[] = [];
  if (!needle.trim()) return hits;
  for (const [path, rec] of Object.entries(files)) {
    if (!allowPreviewPath(path, include, exclude)) continue;
    const lines = rec.text.split(/\n/);
    lines.forEach((line, index) => {
      const hay = caseSensitive ? line : line.toLowerCase();
      const at = hay.indexOf(needle);
      if (at >= 0) hits.push({ path, line: index + 1, column: at + 1, preview: line.slice(0, 160) });
    });
  }
  return hits;
}

export function previewSaveAs(text: string, suggested: string): WorkspaceFileBody {
  const path = suggested && !suggested.endsWith("/") ? suggested : "untitled.ts";
  return previewWrite(path, text);
}

export function previewOpenFile(): WorkspaceFileBody {
  return previewRead("README.md") ?? previewWrite("README.md", initialFiles["README.md"]);
}

export function previewGitStatus(): GitSnapshot {
  return { branch: "main", upstream: "origin/main", ahead: 0, behind: 0, files: gitFiles.map((item) => ({ ...item })) };
}

function markStaged(path: string, staged: boolean): void {
  gitFiles = gitFiles.map((item) => {
    if (item.path !== path) return item;
    if (item.index === "?" && item.worktree === "?") {
      return staged ? { ...item, index: "A", worktree: " " } : { ...item, index: "?", worktree: "?" };
    }
    return staged ? { ...item, index: "M", worktree: " " } : { ...item, index: " ", worktree: "M" };
  });
}

export const previewWorkbench = {
  validate: async (tool: string, config: string) => ({
    tool,
    output: `preview ${tool} ${config}: 0 errors`,
    passed: true,
  }),
  gitStatus: async () => previewGitStatus(),
  stage: async (path: string) => {
    markStaged(path, true);
  },
  unstage: async (path: string) => {
    markStaged(path, false);
  },
  push: async () => "preview: pushed to origin/main",
  fetch: async () => "preview: fetched origin",
  pull: async () => "preview: already up to date",
  commit: async (_message: string) => {
    gitFiles = gitFiles.filter((item) => item.index === " " || item.index === "?");
  },
  shells: async (): Promise<Shell[]> => [
    { id: "powershell", label: "PowerShell", available: true },
    { id: "bash", label: "Bash", available: true },
    { id: "cmd", label: "Command Prompt", available: false },
  ],
  start: async (shell: string, _cols: number, _rows: number) => {
    termSeq += 1;
    const id = String(termSeq);
    terminals.set(id, {
      pending: [encodeOutput(`\r\n[${shell} preview] ${previewWorkspaceLabel}\r\n$ `)],
      done: false,
    });
    return id;
  },
  read: async (id: string) => {
    const session = terminals.get(id);
    if (!session) return { data: "", done: true };
    const data = session.pending.shift() ?? "";
    return { data, done: session.done };
  },
  input: async (id: string, data: string) => {
    const session = terminals.get(id);
    if (!session || session.done) return;
    if (data === "\u0003") {
      session.pending.push(encodeOutput("^C\r\n$ "));
      return;
    }
    if (data === "\r") {
      session.pending.push(encodeOutput("\r\npreview: commands are local to this tab\r\n$ "));
      return;
    }
    session.pending.push(encodeOutput(data));
  },
  resize: async (_id: string, _cols: number, _rows: number) => undefined,
  close: async (id: string) => {
    terminals.delete(id);
  },
  diff: async (path: string, _staged: boolean) => `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1,2 +1,3 @@\n line one\n+preview change\n line two\n`,
};

export const previewLanguage = {
  status: (path: string) => {
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "go") {
      return { language: "go", ready: false, reason: "Preview has no gopls. Definitions use in-memory symbols.", format: false, definition: true, hover: true, complete: true, diagnostics: false };
    }
    if (ext === "ts" || ext === "tsx") {
      return { language: "typescript", ready: false, reason: "Preview has no tsserver. Definitions use in-memory symbols.", format: false, definition: true, hover: true, complete: true, diagnostics: false };
    }
    return { language: "plaintext", ready: false, reason: "No project language service for this file.", format: false, definition: false, hover: false, complete: false, diagnostics: false };
  },
  format: async (_path: string, text: string) => text,
  definition: async (path: string, text: string, line: number, column: number) => {
    const ident = identAt(text, line, column);
    if (!ident) return [];
    const hits = previewSearch(ident, true).filter(hit => hit.preview.includes(`function ${ident}`) || hit.preview.includes(`func ${ident}`));
    return hits.map(hit => ({ path: hit.path, line: hit.line, column: hit.column, text: ident, preview: hit.preview }));
  },
  hover: async (path: string, text: string, line: number, column: number) => {
    const hits = await previewLanguage.definition(path, text, line, column);
    return hits[0] ? `${hits[0].path}:${hits[0].line}  ${hits[0].preview}` : "No declaration in the preview index.";
  },
  diagnostics: async (_path: string) => [],
  complete: async (_path: string, text: string, line: number, column: number) => {
    const ident = identAt(text, line, column);
    const words = text.match(/[A-Za-z_][A-Za-z0-9_]{1,}/g) ?? [];
    return [...new Set(words)].filter(word => !ident || (word.startsWith(ident) && word !== ident)).slice(0, 20).map(text => ({ path: "", line: 0, column: 0, text, preview: "" }));
  },
  tasks: () => [
    { id: "npm:dev", label: "npm run dev", kind: "run", command: "npm run dev" },
    { id: "npm:test", label: "npm run test", kind: "test", command: "npm run test" },
  ],
  run: async (id: string) => previewWorkbench.start("powershell", 80, 24).then(async session => {
    await previewWorkbench.input(session, `${id}\r`);
    return session;
  }),
  startTask: async (id: string) => ({ id, command: id, output: `preview: ${id}\n`, running: false, done: true, exitCode: 0 }),
  taskStatus: () => ({ id: "", command: "", output: "", running: false, done: false, exitCode: 0 }),
  cancelTask: async () => undefined,
};

function identAt(text: string, line: number, column: number): string {
  const row = text.split("\n")[line - 1] ?? "";
  const chars = [...row];
  let i = Math.min(Math.max(column - 1, 0), chars.length - 1);
  if (i < 0 || !/[A-Za-z0-9_]/.test(chars[i] ?? "")) return "";
  let start = i;
  let end = i + 1;
  while (start > 0 && /[A-Za-z0-9_]/.test(chars[start - 1])) start--;
  while (end < chars.length && /[A-Za-z0-9_]/.test(chars[end])) end++;
  return chars.slice(start, end).join("");
}
