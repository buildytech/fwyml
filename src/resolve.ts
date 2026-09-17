import { existsSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { Diagnostic, Manifest, MaterializePlan, RegistryRecord, Resolution, ResolvedNode } from "./types.js";
import { semanticDigest } from "./io.js";
import { findRecord, type LoadedRegistry } from "./registry.js";
import { gitArtifactRoot } from "./sources.js";

function sourceRef(record: RegistryRecord): string {
  const src = record.source;
  if (!src) {
    return record.version;
  }
  const identity = src.package ?? src.module ?? src.repository ?? src.path ?? src.kind;
  return src.commit ? `${identity}@${src.commit}` : `${identity}@${src.ref ?? record.version}`;
}

function artifactRoot(record: RegistryRecord, roots: string[], sourceCache?: string): string | undefined {
  if (sourceCache) {
    const cached = gitArtifactRoot(record, sourceCache);
    if (cached) {
      return cached;
    }
  }
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

function sourceFile(record: RegistryRecord, root: string, dest: string): string | undefined {
  const sourcePath = record.source?.exports?.[dest] ?? join("files", dest);
  const file = resolve(root, sourcePath);
  if (relative(root, file).startsWith("..")) {
    return undefined;
  }
  return file;
}

type Version = readonly [number, number, number];

function contractVersion(contract?: string): { id: string; version: Version } | undefined {
  const match = contract?.match(/^(.+)@(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  if (!match) {
    return undefined;
  }
  return {
    id: match[1],
    version: [Number(match[2]), Number(match[3] ?? 0), Number(match[4] ?? 0)],
  };
}

function compareVersion(left: Version, right: Version): number {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }
  return 0;
}

function parseVersion(value: string): Version | undefined {
  const match = value.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  return match ? [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)] : undefined;
}

function satisfiesVersionRange(version: Version, range: string): boolean {
  for (const clause of range.trim().split(/\s+/)) {
    const match = clause.match(/^(>=|<=|>|<|=|\^|~)?(\d+(?:\.\d+){0,2})$/);
    if (!match) {
      return false;
    }
    const expected = parseVersion(match[2]);
    if (!expected) {
      return false;
    }
    const comparison = compareVersion(version, expected);
    const operator = match[1] ?? "=";
    const accepted =
      operator === ">=" ? comparison >= 0
        : operator === "<=" ? comparison <= 0
          : operator === ">" ? comparison > 0
            : operator === "<" ? comparison < 0
              : operator === "^" ? version[0] === expected[0] && comparison >= 0
                : operator === "~" ? version[0] === expected[0] && version[1] === expected[1] && comparison >= 0
                  : comparison === 0;
    if (!accepted) {
      return false;
    }
  }
  return true;
}

function satisfiesContractRange(contract: string | undefined, capability: string, range: string): boolean {
  const parsed = contractVersion(contract);
  return Boolean(parsed && parsed.id === capability && satisfiesVersionRange(parsed.version, range));
}

function selectedTerms(nodes: ResolvedNode[]): Set<string> {
  const terms = new Set<string>();
  for (const { record } of nodes) {
    terms.add(record.id);
    for (const term of [
      ...(record.provides ?? []),
      ...(record.features ?? []),
      ...(record.compatibility?.platforms ?? []),
      ...(record.compatibility?.runtimes ?? []),
    ]) {
      terms.add(term);
    }
  }
  return terms;
}

export function resolveGraph(manifest: Manifest, loaded: LoadedRegistry, sourceCache?: string): Resolution {
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
    if (choice.contractRange && !satisfiesContractRange(record?.contract, capability, choice.contractRange)) {
      addDiagnostic(diagnostics, {
        code: "FWYML_CONTRACT_INCOMPATIBLE",
        severity: "error",
        message: `${choice.use} does not satisfy ${capability} contract range ${choice.contractRange}`,
        id: choice.use,
        remediation: "select-an-adapter-with-a-compatible-contract",
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

  const terms = selectedTerms(nodes);
  for (const required of manifest.constraints?.required ?? []) {
    if (!terms.has(required)) {
      addDiagnostic(diagnostics, {
        code: "FWYML_CONTRACT_INCOMPATIBLE",
        severity: "error",
        message: `required compatibility term ${required} is not provided`,
        id: required,
        remediation: "select-an-adapter-that-declares-the-required-term",
      });
    }
  }
  for (const forbidden of manifest.constraints?.forbidden ?? []) {
    if (terms.has(forbidden) || manifest.composition.capabilities[forbidden]) {
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

  const plan = buildPlan(nodes, loaded.roots, diagnostics, sourceCache);
  return {
    product: manifest.metadata.name,
    nodes,
    absent,
    diagnostics,
    plan,
  };
}

function buildPlan(nodes: ResolvedNode[], roots: string[], diagnostics: Diagnostic[], sourceCache?: string): MaterializePlan {
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
  const dependencyVersions = new Map<string, string>();
  const addDependencies = (target: Record<string, string>, additions: Record<string, string>) => {
    for (const [name, version] of Object.entries(additions)) {
      const previous = dependencyVersions.get(name);
      if (previous && previous !== version) {
        addDiagnostic(diagnostics, {
          code: "FWYML_DEPENDENCY_CONFLICT",
          severity: "error",
          message: `dependency ${name} is required at both ${previous} and ${version}`,
          id: name,
          remediation: "select-compatible-record-versions",
        });
        continue;
      }
      dependencyVersions.set(name, version);
      target[name] = version;
    }
  };

  for (const { record } of nodes) {
    const root = artifactRoot(record, roots, sourceCache);
    if (record.source?.kind === "local") {
      local = true;
    }
    const owned = collectOwned(record);
    if (owned.length > 0 && (!root || !existsSync(root))) {
      addDiagnostic(diagnostics, {
        code: "FWYML_SOURCE_MISSING",
        severity: "error",
        message: `record ${record.id} owns files but its artifact root is unavailable`,
        id: record.id,
        remediation: "restore-or-correct-artifact-source",
      });
      continue;
    }
    for (const dest of owned) {
      const from = sourceFile(record, root!, dest);
      if (!from || !existsSync(from)) {
        addDiagnostic(diagnostics, {
          code: "FWYML_SOURCE_MISSING",
          severity: "error",
          message: `record ${record.id} owns missing source file ${dest}`,
          id: record.id,
          remediation: "restore-or-correct-artifact-source",
        });
        continue;
      }
      const bucket = record.kind === "guidance" ? guidance : files;
      bucket.push({ dest, from, owner: record.id });
    }
    addDependencies(npm, record.npm?.dependencies ?? {});
    addDependencies(npmDev, record.npm?.devDependencies ?? {});
    Object.assign(scripts, record.npm?.scripts ?? {});
    if (record.source?.kind === "npm" && record.source.package && record.source.ref) {
      addDependencies(
        record.source.install === "devDependency" ? npmDev : npm,
        { [record.source.package]: record.source.ref },
      );
    }
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
        tools.push({
          id: record.id,
          argv,
          phase: record.command?.phase,
          outputs: record.command?.outputs,
          cwd: record.command?.cwd,
          prepare: record.command?.prepare,
        });
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

function planDigest(plan: MaterializePlan): string {
  return semanticDigest({
    files: plan.files.map(({ dest, owner }) => ({ dest, owner })),
    npm: plan.npm,
    npmDev: plan.npmDev,
    scripts: plan.scripts,
    go: plan.go,
    tools: plan.tools,
    guidance: plan.guidance.map(({ dest, owner }) => ({ dest, owner })),
    local: plan.local,
  });
}

export function toLock(
  resolution: Resolution,
  manifest: Manifest,
  snapshot: string,
  registryDigest: string,
): import("./types.js").LockFile {
  const ownership: Record<string, string> = {};
  for (const file of [...resolution.plan.files, ...resolution.plan.guidance]) {
    ownership[file.dest] = file.owner;
  }
  ownership["package.json"] = "fwyml";
  if (!ownership["go.mod"]) {
    ownership["go.mod"] = "fwyml";
  }
  ownership["compose/identity.go"] = "fwyml";
  ownership["fw.yaml"] = "fwyml";
  return {
    schemaVersion: "fw.buildy.tech/lock/v0alpha1",
    kind: "Lock",
    product: resolution.product,
    registrySnapshot: snapshot,
    manifestDigest: semanticDigest(manifest),
    registryDigest,
    planDigest: planDigest(resolution.plan),
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
