import { existsSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import type { Diagnostic, Manifest, MaterializePlan, RegistryRecord, Resolution, ResolvedNode } from "./types.js";
import { findRecord, type LoadedRegistry } from "./registry.js";

function sourceRef(record: RegistryRecord): string {
  const src = record.source;
  if (!src) {
    return record.version;
  }
  return src.package ?? src.module ?? src.path ?? src.repository ?? src.kind;
}

function artifactRoot(record: RegistryRecord, roots: string[]): string | undefined {
  const path = record.source?.path;
  if (!path) {
    return undefined;
  }
  if (isAbsolute(path)) {
    return path;
  }
  for (const root of [...roots].reverse()) {
    const candidate = resolve(root, path);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  const fallback = roots.at(-1);
  return fallback ? resolve(fallback, path) : path;
}

function addDiagnostic(list: Diagnostic[], item: Diagnostic): void {
  if (!list.some((existing) => existing.code === item.code && existing.id === item.id)) {
    list.push(item);
  }
}

function collectOwned(record: RegistryRecord): string[] {
  return [...(record.ownedFiles ?? []), ...(record.removal?.ownedFiles ?? [])];
}

export function resolveGraph(manifest: Manifest, loaded: LoadedRegistry): Resolution {
  const diagnostics: Diagnostic[] = [];
  const nodes: ResolvedNode[] = [];
  const selected = new Set<string>();
  const providers = new Map<string, string>();

  const visit = (id: string, reason: string) => {
    if (selected.has(id)) {
      return;
    }
    const record = findRecord(loaded, id);
    if (!record) {
      addDiagnostic(diagnostics, {
        code: "FWYML_CONTRACT_INCOMPATIBLE",
        severity: "error",
        message: `unknown registry id ${id}`,
        id,
        remediation: "add-or-select-a-published-record",
      });
      return;
    }
    selected.add(id);
    nodes.push({ record, reason });
    if (record.readiness === "blocked") {
      addDiagnostic(diagnostics, {
        code: "FWYML_UNVERIFIED_ARTIFACT",
        severity: "error",
        message: `blocked record ${id} cannot pass strict verification`,
        id,
        remediation: "keep-planning-mode-or-replace-record",
      });
    } else if (record.readiness === "draft" || !record.integrity?.publicDigest || !record.conformanceRefs?.length) {
      addDiagnostic(diagnostics, {
        code: "FWYML_UNVERIFIED_ARTIFACT",
        severity: "error",
        message: `record ${id} lacks verified conformance provenance`,
        id,
        remediation: "publish-conformance-for-source-ref",
      });
    }
    if (record.source?.kind === "local") {
      addDiagnostic(diagnostics, {
        code: "FWYML_SOURCE_DRIFT",
        severity: "warning",
        message: `local source for ${id} is not portable`,
        id,
        remediation: "replace-with-immutable-ref-before-pack",
      });
    }
    for (const capability of record.provides ?? []) {
      const existing = providers.get(capability);
      if (existing && existing !== record.id) {
        addDiagnostic(diagnostics, {
          code: "FWYML_CONTRACT_INCOMPATIBLE",
          severity: "error",
          message: `capability ${capability} has two adapters`,
          id: capability,
          remediation: "select-exactly-one-adapter",
        });
      }
      providers.set(capability, record.id);
    }
    for (const dep of [...(record.dependencies ?? []), ...(record.requires ?? [])]) {
      visit(dep, `dependency:${record.id}`);
    }
    for (const conflict of record.conflicts ?? []) {
      if (selected.has(conflict) || manifest.composition.capabilities[conflict]) {
        addDiagnostic(diagnostics, {
          code: "FWYML_CONTRACT_INCOMPATIBLE",
          severity: "error",
          message: `${record.id} conflicts with ${conflict}`,
          id: record.id,
        });
      }
    }
  };

  for (const [capability, choice] of Object.entries(manifest.composition.capabilities)) {
    visit(choice.use, `capability:${capability}`);
    const record = findRecord(loaded, choice.use);
    if (record && !(record.provides ?? []).includes(capability) && record.contract !== `${capability}@0`) {
      addDiagnostic(diagnostics, {
        code: "FWYML_CONTRACT_INCOMPATIBLE",
        severity: "error",
        message: `${choice.use} does not provide ${capability}`,
        id: choice.use,
      });
    }
    visit(capability, `capability-record:${capability}`);
  }

  for (const slice of manifest.composition.slices ?? []) {
    visit(slice, "slice");
    const record = findRecord(loaded, slice);
    for (const required of record?.requires ?? []) {
      if (!providers.has(required) && !selected.has(required)) {
        addDiagnostic(diagnostics, {
          code: "FWYML_CONTRACT_INCOMPATIBLE",
          severity: "error",
          message: `slice ${slice} requires ${required}`,
          id: slice,
        });
      }
    }
    if (record?.uiFamilies?.length) {
      const uiChoice = manifest.composition.capabilities.ui?.use;
      const uiRecord = uiChoice ? findRecord(loaded, uiChoice) : undefined;
      const runtime = uiRecord?.compatibility?.runtimes?.[0];
      if (runtime && !record.uiFamilies.includes(runtime)) {
        addDiagnostic(diagnostics, {
          code: "FWYML_CONTRACT_INCOMPATIBLE",
          severity: "error",
          message: `slice ${slice} is not compatible with selected ui runtime`,
          id: slice,
        });
      }
    }
  }

  for (const id of [...(manifest.quality?.guidance ?? []), ...(manifest.quality?.validators ?? [])]) {
    visit(id, "quality");
  }

  for (const forbidden of manifest.constraints?.forbidden ?? []) {
    if (selected.has(forbidden) || providers.has(forbidden) || manifest.composition.capabilities[forbidden]) {
      addDiagnostic(diagnostics, {
        code: "FWYML_ABSENCE_VIOLATION",
        severity: "error",
        message: `forbidden ${forbidden} is selected`,
        id: forbidden,
      });
    }
  }

  const known = [...loaded.records.values()].filter((record) => record.kind === "capability").map((record) => record.id);
  const absent = known.filter((id) => !providers.has(id) && !manifest.composition.capabilities[id]);

  const plan = buildPlan(nodes, loaded.roots);
  return {
    product: manifest.metadata.name,
    nodes,
    absent,
    diagnostics,
    plan,
  };
}

function buildPlan(nodes: ResolvedNode[], roots: string[]): MaterializePlan {
  const files: MaterializePlan["files"] = [];
  const npm: Record<string, string> = {};
  const npmDev: Record<string, string> = {};
  const scripts: Record<string, string> = {};
  const goRequire: Record<string, string> = {};
  const goReplace: Record<string, string> = {};
  let goModule: string | undefined;
  const tools: MaterializePlan["tools"] = [];
  const guidance: MaterializePlan["guidance"] = [];
  let local = false;

  for (const { record } of nodes) {
    const root = artifactRoot(record, roots);
    if (record.source?.kind === "local") {
      local = true;
    }
    for (const dest of collectOwned(record)) {
      if (root) {
        const from = join(root, "files", dest);
        const bucket = record.kind === "guidance" ? guidance : files;
        bucket.push({ dest, from, owner: record.id });
      }
    }
    Object.assign(npm, record.npm?.dependencies ?? {});
    Object.assign(npmDev, record.npm?.devDependencies ?? {});
    Object.assign(scripts, record.npm?.scripts ?? {});
    if (record.kind === "product-template" && record.go?.module) {
      goModule = record.go.module;
    } else if (record.go?.module && record.go.require) {
      goRequire[record.go.module] = record.go.require;
    }
    if (record.go?.replace && root) {
      goReplace[record.go.module ?? record.id] = root;
    }
    if (record.kind === "validator" || record.kind === "generator") {
      const argv = record.command?.argv ?? [];
      if (argv.length > 0) {
        tools.push({ id: record.id, argv, phase: record.command?.phase, outputs: record.command?.outputs });
      }
    }
  }

  return {
    files,
    npm,
    npmDev,
    scripts,
    go: { module: goModule, require: goRequire, replace: goReplace },
    tools,
    guidance,
    local,
  };
}

export function toLock(resolution: Resolution, snapshot: string): import("./types.js").LockFile {
  const ownership: Record<string, string> = {};
  for (const file of [...resolution.plan.files, ...resolution.plan.guidance]) {
    ownership[file.dest] = file.owner;
  }
  ownership["package.json"] = "fwyml";
  ownership["go.mod"] = "fwyml";
  ownership["compose/identity.go"] = "fwyml";
  ownership["fw.yaml"] = "fwyml";
  return {
    schemaVersion: "fw.buildy.tech/lock/v0alpha1",
    kind: "Lock",
    product: resolution.product,
    registrySnapshot: snapshot,
    records: resolution.nodes.map(({ record }) => ({
      id: record.id,
      kind: record.kind,
      version: record.version,
      contract: record.contract,
      sourceKind: record.source?.kind,
      sourceRef: sourceRef(record),
      publicDigest: record.integrity?.publicDigest,
      outputDigest: record.integrity?.outputDigest,
      readiness: record.readiness,
      portable: record.source?.kind !== "local",
      conformanceRef: record.conformanceRefs?.[0],
    })),
    absent: resolution.absent,
    ownership,
    dependencies: {
      npm: { ...resolution.plan.npm, ...resolution.plan.npmDev },
      go: resolution.plan.go.require,
    },
    diagnostics: resolution.diagnostics,
  };
}

export function hasError(diagnostics: Diagnostic[], codes?: string[]): boolean {
  return diagnostics.some((item) => item.severity === "error" && (!codes || codes.includes(item.code)));
}
