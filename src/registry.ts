import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { expandVars, packageRoot, readYaml } from "./io.js";
import type { Registry, RegistryRecord } from "./types.js";

export type LoadedRegistry = {
  records: Map<string, RegistryRecord>;
  snapshotId: string;
  roots: string[];
};

function resolvePath(base: string, source: string, env: Record<string, string>): string {
  const expanded = expandVars(source, env);
  if (!expanded) {
    return "";
  }
  if (isAbsolute(expanded)) {
    return expanded;
  }
  return resolve(base, expanded);
}

function loadEnvelope(path: string, into: Map<string, RegistryRecord>, roots: string[]): void {
  if (!existsSync(path)) {
    throw new Error(`registry not found: ${path}`);
  }
  const dir = dirname(path);
  roots.push(dir);
  const envelope = readYaml<Registry>(path);
  for (const record of envelope.records ?? []) {
    into.set(record.id, record);
  }
  for (const pattern of envelope.include ?? []) {
    const included = resolve(dir, pattern);
    if (existsSync(included)) {
      loadEnvelope(included, into, roots);
    }
  }
}

export function loadRegistries(options: {
  manifestSources?: { id: string; source: string }[];
  cliRegistry?: string;
  env?: Record<string, string>;
}): LoadedRegistry {
  const env = { ...process.env, ...(options.env ?? {}) } as Record<string, string>;
  const records = new Map<string, RegistryRecord>();
  const roots: string[] = [];
  const bundled = join(packageRoot(), "registry", "snapshot", "index.yaml");
  const sources: string[] = [];
  if (existsSync(bundled)) {
    sources.push(bundled);
  }
  for (const item of options.manifestSources ?? []) {
    const cwd = process.cwd();
    const resolved = resolvePath(cwd, item.source, env);
    if (resolved) {
      sources.push(resolved);
    }
  }
  if (options.cliRegistry) {
    sources.push(resolvePath(process.cwd(), options.cliRegistry, env));
  }
  if (env.FWYML_VSA_REGISTRY) {
    sources.push(resolve(env.FWYML_VSA_REGISTRY));
  }
  let snapshotId = "bundled";
  for (const source of sources) {
    loadEnvelope(source, records, roots);
    snapshotId = source;
  }
  return { records, snapshotId, roots };
}

export function findRecord(loaded: LoadedRegistry, id: string): RegistryRecord | undefined {
  return loaded.records.get(id);
}
