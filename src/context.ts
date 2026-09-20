import type { LockFile, Manifest, RegistryRecord, Resolution } from "./types.js";

export function contextPack(manifest: Manifest, resolution: Resolution, lock: LockFile) {
  const selected: RegistryRecord[] = resolution.nodes.map((node) => node.record);
  const selectedPorts = Object.entries(manifest.composition.capabilities).map(([id, selection]) => ({
    id,
    use: selection.use,
    contract: selected.find((record) => record.id === selection.use || (record.provides ?? []).includes(id))?.contract,
  }));
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
