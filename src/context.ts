import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { packageRoot, readYaml } from "./io.js";
import type { LockFile, Manifest, RegistryRecord, Resolution } from "./types.js";

function loadPortSpecs(): Record<string, unknown> {
  const dir = join(packageRoot(), "registry", "snapshot", "specs");
  const out: Record<string, unknown> = {};
  if (!existsSync(dir)) {
    return out;
  }
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".yaml")) {
      continue;
    }
    const spec = readYaml<{ id?: string }>(join(dir, name));
    if (spec.id) {
      out[spec.id] = spec;
    }
  }
  return out;
}

export function contextPack(manifest: Manifest, resolution: Resolution, lock: LockFile) {
  const ports = loadPortSpecs();
  const selectedPorts = Object.keys(manifest.composition.capabilities).map((id) => ports[id] ?? { id });
  const selected: RegistryRecord[] = resolution.nodes.map((node) => node.record);
  return {
    schemaVersion: "fw.buildy.tech/context/v0alpha1",
    product: manifest.metadata.name,
    selected: selected.map((record) => ({
      id: record.id,
      kind: record.kind,
      version: record.version,
      contract: record.contract,
      source: record.source,
      readiness: record.readiness,
      notes: record.notes,
    })),
    ports: selectedPorts,
    slices: selected.filter((record) => record.kind === "vertical-slice").map((record) => record.id),
    sources: selected.map((record) => ({ id: record.id, source: record.source, integrity: record.integrity })),
    ownership: lock.ownership,
    guidance: manifest.quality?.guidance ?? [],
    validators: selected
      .filter((record) => record.kind === "validator")
      .map((record) => ({ id: record.id, argv: record.command?.argv ?? [] })),
    absent: lock.absent,
    forbidden: manifest.constraints?.forbidden ?? [],
    blockers: resolution.diagnostics.filter((item) => item.severity === "error"),
    lock,
  };
}
