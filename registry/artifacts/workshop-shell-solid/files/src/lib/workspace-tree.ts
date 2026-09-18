export const treeListLimit = 4000;
export const searchHitLimit = 200;

export function countTreeNodes(nodes: WorkspaceTreeNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countTreeNodes(node.children ?? []), 0);
}

function sortTree(nodes: WorkspaceTreeNode[]): WorkspaceTreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.dir !== b.dir) return a.dir ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

/** Builds an explorer tree from file paths and empty directory paths. */
export function filePathsToTree(files: string[], dirs: string[] = []): WorkspaceTreeNode[] {
  type Draft = { name: string; path: string; dir: boolean; kids: Map<string, Draft> };
  const root = new Map<string, Draft>();
  const place = (rel: string, asDir: boolean) => {
    const parts = rel.split("/").filter(Boolean);
    if (parts.length === 0) return;
    let level = root;
    let acc = "";
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      acc = acc ? `${acc}/${name}` : name;
      const last = i === parts.length - 1;
      let node = level.get(name);
      if (!node) {
        node = { name, path: acc, dir: last ? asDir : true, kids: new Map() };
        level.set(name, node);
      } else if (!last || asDir) {
        node.dir = true;
      }
      level = node.kids;
    }
  };
  for (const dir of dirs) place(dir.replaceAll("\\", "/"), true);
  for (const file of files) place(file.replaceAll("\\", "/"), false);
  const walk = (level: Map<string, Draft>): WorkspaceTreeNode[] =>
    sortTree(
      [...level.values()].map(node => ({
        name: node.name,
        path: node.path,
        dir: node.dir,
        ...(node.dir && node.kids.size > 0 ? { children: walk(node.kids) } : {}),
      })),
    );
  return walk(root);
}

export type WorkspaceTreeNode = {
  name: string;
  path: string;
  dir: boolean;
  children?: WorkspaceTreeNode[];
};

export type WorkspaceFileBody = {
  path: string;
  text: string;
  revision: string;
};

export type SearchHit = {
  path: string;
  line: number;
  column: number;
  preview: string;
};

export type FileWriteOutcome = {
  ok: boolean;
  conflict?: "changed" | "missing";
  body?: WorkspaceFileBody;
  disk?: WorkspaceFileBody;
  error?: { code: string; operation: string; path?: string; message: string; details?: string };
};
