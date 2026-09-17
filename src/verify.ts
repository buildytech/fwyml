import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Diagnostic, LockFile, Manifest, Resolution } from "./types.js";
import { leftoverOwned } from "./materialize.js";
import { readText } from "./io.js";

export function verifyTree(options: {
  outDir: string;
  manifest: Manifest;
  resolution: Resolution;
  lock: LockFile;
  strict: boolean;
}): Diagnostic[] {
  const diagnostics = [...options.resolution.diagnostics];
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
