export type DiffLineKind = "context" | "add" | "del";

export type DiffLine = {
  kind: DiffLineKind;
  text: string;
};

export type DiffHunk = {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
};

export type DiffFile = {
  path: string;
  oldPath?: string;
  hunks: DiffHunk[];
};

export type DiffLineMark = {
  line: number;
  kind: "add" | "del";
};

const hunkHeader = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export function parseUnifiedDiff(raw: string): DiffFile[] {
  const files: DiffFile[] = [];
  let current: DiffFile | undefined;
  for (const line of raw.split(/\r?\n/)) {
    if (skipNoise(line)) continue;
    const gitNames = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (gitNames) {
      current = { path: gitNames[2] ?? "", oldPath: gitNames[1], hunks: [] };
      files.push(current);
      continue;
    }
    const plus = line.match(/^\+\+\+ (?:b\/)?(.+)$/);
    if (plus && current) {
      const path = plus[1] === "/dev/null" ? current.path : plus[1];
      if (path && path !== "/dev/null") current.path = path;
      continue;
    }
    const minus = line.match(/^--- (?:a\/)?(.+)$/);
    if (minus && current && minus[1] !== "/dev/null") {
      current.oldPath = minus[1];
      continue;
    }
    const header = line.match(hunkHeader);
    if (header) {
      if (!current) {
        current = { path: "", hunks: [] };
        files.push(current);
      }
      current.hunks.push({
        oldStart: Number(header[1]),
        oldCount: header[2] ? Number(header[2]) : 1,
        newStart: Number(header[3]),
        newCount: header[4] ? Number(header[4]) : 1,
        lines: [],
      });
      continue;
    }
    const hunk = current?.hunks.at(-1);
    if (!hunk) continue;
    if (line.startsWith("+")) hunk.lines.push({ kind: "add", text: line.slice(1) });
    else if (line.startsWith("-")) hunk.lines.push({ kind: "del", text: line.slice(1) });
    else if (line.startsWith(" ") || line === "") hunk.lines.push({ kind: "context", text: line.slice(1) });
  }
  return files.filter(file => file.path || file.hunks.length);
}

export function fileForPath(files: DiffFile[], path: string): DiffFile | undefined {
  return files.find(file => file.path === path || file.oldPath === path);
}

export function marksFromDiffFile(file: DiffFile): DiffLineMark[] {
  const marks: DiffLineMark[] = [];
  const seen = new Set<string>();
  for (const hunk of file.hunks) {
    let newLine = hunk.newStart;
    for (const line of hunk.lines) {
      if (line.kind === "add") {
        remember(marks, seen, newLine, "add");
        newLine += 1;
      } else if (line.kind === "context") {
        newLine += 1;
      } else {
        remember(marks, seen, Math.max(1, newLine), "del");
      }
    }
  }
  return marks;
}

export function previewDiffLines(file: DiffFile, limit = 8): DiffLine[] {
  const rows: DiffLine[] = [];
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.kind === "context") continue;
      rows.push(line);
      if (rows.length >= limit) return rows;
    }
  }
  return rows;
}

export function firstMarkLine(marks: DiffLineMark[]): number {
  return marks[0]?.line ?? 1;
}

export function isGitNoise(text: string): boolean {
  const line = text.trim().toLowerCase();
  return line.includes("lf will be replaced by crlf") || line.includes("crlf will be replaced by lf");
}

function remember(marks: DiffLineMark[], seen: Set<string>, line: number, kind: "add" | "del") {
  const key = `${line}:${kind}`;
  if (seen.has(key)) return;
  seen.add(key);
  marks.push({ line, kind });
}

function skipNoise(line: string): boolean {
  return (
    line.startsWith("warning:") ||
    line.startsWith("\\ ") ||
    line.startsWith("index ") ||
    line.startsWith("new file mode") ||
    line.startsWith("deleted file mode") ||
    line.startsWith("old mode") ||
    line.startsWith("new mode") ||
    line.startsWith("similarity index") ||
    line.startsWith("rename from") ||
    line.startsWith("rename to") ||
    line.startsWith("dissimilarity index")
  );
}
