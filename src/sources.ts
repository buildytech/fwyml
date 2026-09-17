import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { sha256 } from "./io.js";
import type { Diagnostic, RegistryRecord, Resolution } from "./types.js";

function runGit(argv: string[], cwd?: string): { ok: boolean; output: string } {
  const result = spawnSync("git", argv, { cwd, encoding: "utf8" });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
}

export function gitArtifactRoot(record: RegistryRecord, cache: string): string | undefined {
  const source = record.source;
  if (source?.kind !== "git" || !source.repository || !source.commit) {
    return undefined;
  }
  const key = sha256(`${source.repository}\n${source.commit}`).slice(0, 24);
  return join(cache, key, source.subpath ?? "");
}

export function fetchGitSources(resolution: Resolution, cache: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const { record } of resolution.nodes) {
    const source = record.source;
    const root = gitArtifactRoot(record, cache);
    if (!source || !root) {
      continue;
    }
    const checkout = join(cache, sha256(`${source.repository}\n${source.commit}`).slice(0, 24));
    if (existsSync(checkout)) {
      if (readdirSync(checkout).length === 0) {
        diagnostics.push({
          code: "FWYML_SOURCE_FETCH_FAILED",
          severity: "error",
          message: `source cache for ${record.id} is empty`,
          id: record.id,
          remediation: "remove-empty-cache-and-fetch-again",
        });
        continue;
      }
      const head = runGit(["rev-parse", "HEAD"], checkout);
      if (!head.ok || head.output !== source.commit) {
        diagnostics.push({
          code: "FWYML_SOURCE_FETCH_FAILED",
          severity: "error",
          message: `source cache for ${record.id} does not match ${source.commit}`,
          id: record.id,
          remediation: "use-an-empty-cache-or-the-pinned-commit",
        });
      }
      continue;
    }
    mkdirSync(cache, { recursive: true });
    const cloned = runGit(["clone", "--no-checkout", source.repository!, checkout]);
    const checkedOut = cloned.ok && runGit(["checkout", "--detach", source.commit!], checkout);
    if (!cloned.ok || !checkedOut?.ok) {
      diagnostics.push({
        code: "FWYML_SOURCE_FETCH_FAILED",
        severity: "error",
        message: `cannot fetch pinned git source for ${record.id}: ${cloned.ok ? checkedOut?.output : cloned.output}`,
        id: record.id,
        remediation: "verify-repository-and-immutable-commit",
      });
    }
  }
  return diagnostics;
}
