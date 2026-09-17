import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Diagnostic, LockFile, Manifest, Resolution } from "./types.js";
import { leftoverOwned } from "./materialize.js";
import { readText, readYaml, semanticDigest, sha256 } from "./io.js";
import { assertLock } from "./schema.js";

function comparableLock(lock: LockFile): unknown {
  return {
    schemaVersion: lock.schemaVersion,
    kind: lock.kind,
    product: lock.product,
    registrySnapshot: lock.registrySnapshot,
    manifestDigest: lock.manifestDigest,
    registryDigest: lock.registryDigest,
    planDigest: lock.planDigest,
    records: lock.records,
    absent: lock.absent,
    ownership: lock.ownership,
    dependencies: lock.dependencies,
  };
}

export function verifyPersistedLock(outDir: string, expected: LockFile): Diagnostic[] {
  const path = join(outDir, "fw.lock.yaml");
  if (!existsSync(path)) {
    return [{
      code: "FWYML_LOCK_MISMATCH",
      severity: "error",
      message: "persisted lock is missing; run sync before verification",
      remediation: "run-sync",
    }];
  }
  try {
    const persisted = assertLock(readYaml<LockFile>(path));
    if (semanticDigest(comparableLock(persisted)) === semanticDigest(comparableLock(expected))) {
      return [];
    }
  } catch {
    return [{
      code: "FWYML_LOCK_MISMATCH",
      severity: "error",
      message: "persisted lock is invalid",
      remediation: "run-sync",
    }];
  }
  return [{
    code: "FWYML_LOCK_MISMATCH",
    severity: "error",
    message: "persisted lock does not match the manifest, registry snapshot, or materialization plan",
    remediation: "run-sync-after-reviewing-registry-or-manifest-changes",
  }];
}

export function verifyTree(options: {
  outDir: string;
  manifest: Manifest;
  resolution: Resolution;
  lock: LockFile;
  strict: boolean;
}): Diagnostic[] {
  const diagnostics = [...options.resolution.diagnostics];
  const persistedPath = join(options.outDir, "fw.lock.yaml");
  if (existsSync(persistedPath)) {
    try {
      const persisted = assertLock(readYaml<LockFile>(persistedPath));
      for (const [dest, digest] of Object.entries(persisted.ownedOutputDigests ?? {})) {
        const path = join(options.outDir, dest);
        if (existsSync(path) && sha256(readText(path)) !== digest) {
          diagnostics.push({
            code: "FWYML_LOCK_MISMATCH",
            severity: "error",
            message: `owned output differs from the lock: ${dest}`,
            id: dest,
            remediation: "restore-the-output-or-run-sync-after-reviewing-the-change",
          });
        }
      }
    } catch {
      // verifyPersistedLock reports the invalid lock with a stable diagnostic.
    }
  }
  const pkgPath = join(options.outDir, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readText(pkgPath)) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [name, version] of Object.entries(options.lock.dependencies.npm)) {
      if (deps[name] !== version) {
        diagnostics.push({
          code: "FWYML_LOCK_MISMATCH",
          severity: "error",
          message: `package ${name} does not match the lock`,
          id: name,
        });
      }
    }
    for (const forbidden of options.manifest.constraints?.forbidden ?? []) {
      for (const name of Object.keys(deps)) {
        if (name.includes(forbidden)) {
          diagnostics.push({
            code: "FWYML_ABSENCE_VIOLATION",
            severity: "error",
            message: `forbidden dependency ${name}`,
            id: forbidden,
          });
        }
      }
    }
  }

  for (const dest of Object.keys(options.lock.ownership)) {
    if (!existsSync(join(options.outDir, dest)) && options.lock.ownership[dest] !== "fwyml") {
      diagnostics.push({
        code: "FWYML_LOCK_MISMATCH",
        severity: "error",
        message: `owned file missing: ${dest}`,
        id: dest,
      });
    }
  }

  const generatedPrefixes = options.resolution.plan.tools.flatMap((tool) => tool.outputs ?? []);
  for (const leftover of leftoverOwned(options.outDir, options.lock, generatedPrefixes)) {
    diagnostics.push({
      code: "FWYML_ABSENCE_VIOLATION",
      severity: "error",
      message: `unowned source remains: ${leftover}`,
      id: leftover,
    });
  }

  for (const id of options.lock.absent) {
    if (options.resolution.nodes.some((node) => node.record.id === id || (node.record.provides ?? []).includes(id))) {
      diagnostics.push({
        code: "FWYML_ABSENCE_VIOLATION",
        severity: "error",
        message: `absent capability ${id} is present in the graph`,
        id,
      });
    }
  }

  if (options.strict) {
    return diagnostics;
  }
  return diagnostics.filter((item) => item.code !== "FWYML_UNVERIFIED_ARTIFACT");
}
