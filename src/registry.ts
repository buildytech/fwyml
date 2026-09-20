import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { expandVars, fileDigest, packageRoot, readYaml, semanticDigest } from "./io.js";
import { assertRegistry } from "./schema.js";
import type { Registry, RegistryRecord } from "./types.js";

export type LoadedRegistry = {
  records: Map<string, RegistryRecord>;
  snapshotId: string;
  snapshotDigest: string;
  roots: string[];
};

export class RegistryError extends Error {
  constructor(
    readonly code: "FWYML_REGISTRY_INVALID" | "FWYML_REGISTRY_AMBIGUITY",
    message: string,
  ) {
    super(message);
  }
}

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

function loadEnvelope(
  path: string,
  into: Map<string, RegistryRecord>,
  roots: string[],
  documentDigests: string[],
  seenIds: Set<string>,
  seenPaths: Set<string>,
): string | undefined {
  if (!existsSync(path)) {
    throw new RegistryError("FWYML_REGISTRY_INVALID", `registry not found: ${path}`);
  }
  if (seenPaths.has(path)) {
    throw new RegistryError("FWYML_REGISTRY_AMBIGUITY", `registry include cycle: ${path}`);
  }
  seenPaths.add(path);
  const dir = dirname(path);
  roots.push(dir);
  let envelope: Registry;
  try {
    envelope = assertRegistry(readYaml<Registry>(path));
  } catch (error) {
    throw new RegistryError("FWYML_REGISTRY_INVALID", error instanceof Error ? error.message : String(error));
  }
  documentDigests.push(fileDigest(path));
  for (const record of envelope.records ?? []) {
    if (seenIds.has(record.id)) {
      throw new RegistryError("FWYML_REGISTRY_AMBIGUITY", `registry contains duplicate id ${record.id}: ${path}`);
    }
    seenIds.add(record.id);
    into.set(record.id, record);
  }
  for (const pattern of envelope.include ?? []) {
    const included = resolve(dir, pattern);
    if (!existsSync(included)) {
      throw new RegistryError("FWYML_REGISTRY_INVALID", `included registry not found: ${included}`);
    }
    loadEnvelope(included, into, roots, documentDigests, seenIds, seenPaths);
  }
  return envelope.metadata?.id;
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
  let snapshotId = "bundled";
  const documentDigests: string[] = [];
  for (const source of [...new Set(sources)]) {
    const label = loadEnvelope(source, records, roots, documentDigests, new Set<string>(), new Set<string>());
    snapshotId = label ?? source;
  }
  return {
    records,
    snapshotId,
    snapshotDigest: semanticDigest(documentDigests.sort()),
    roots,
  };
}

export function findRecord(loaded: LoadedRegistry, id: string): RegistryRecord | undefined {
  return loaded.records.get(id);
}
