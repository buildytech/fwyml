import type { Diagnostic } from "./types.js";

export type DriftCase = {
  id: string;
  selected?: {
    contract?: string;
    sourceRef?: string;
    publicDigest?: string;
    artifactDigest?: string;
    conformanceRef?: string;
    adapterRange?: string;
  };
  discovered?: {
    contract?: string;
    sourceRef?: string;
    publicDigest?: string;
    artifactDigest?: string;
    conformanceRef?: string;
  };
  selectedCapabilities?: string[];
  materializedPackages?: string[];
  packageCapabilities?: Record<string, string>;
  expected?: { codes?: string[]; resolve?: boolean };
};

function major(contract?: string): string | undefined {
  const match = contract?.match(/@(\d+)/);
  return match?.[1];
}

export function classifyDrift(input: DriftCase): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const selected = input.selected ?? {};
  const discovered = input.discovered ?? {};

  if (input.packageCapabilities && input.selectedCapabilities && input.materializedPackages) {
    for (const pkg of input.materializedPackages) {
      const capability = input.packageCapabilities[pkg];
      if (capability && !input.selectedCapabilities.includes(capability)) {
        diagnostics.push({
          code: "FWYML_ABSENCE_VIOLATION",
          severity: "error",
          message: `${pkg} remains after ${capability} was removed`,
          id: capability,
        });
        diagnostics.push({
          code: "FWYML_LOCK_MISMATCH",
          severity: "error",
          message: "materialized packages do not match the lock",
        });
      }
    }
    return diagnostics;
  }

  if (selected.sourceRef && discovered.sourceRef && selected.sourceRef !== discovered.sourceRef) {
    if (selected.publicDigest && discovered.publicDigest === selected.publicDigest && selected.artifactDigest && discovered.artifactDigest && selected.artifactDigest !== discovered.artifactDigest) {
      diagnostics.push({
        code: "FWYML_REVERIFY_REQUIRED",
        severity: "warning",
        message: "implementation changed; conformance is stale",
        remediation: "publish-conformance-for-new-source-ref",
      });
      return diagnostics;
    }
    if (!discovered.artifactDigest || !discovered.conformanceRef) {
      diagnostics.push({
        code: "FWYML_SOURCE_DRIFT",
        severity: "warning",
        message: "source reference changed without recorded integrity",
        remediation: "quarantine-record",
      });
      diagnostics.push({
        code: "FWYML_UNVERIFIED_ARTIFACT",
        severity: "error",
        message: "changed artifact has no conformance provenance",
      });
      return diagnostics;
    }
  }

  if (selected.contract && discovered.contract && selected.contract !== discovered.contract) {
    if (major(selected.contract) !== major(discovered.contract)) {
      diagnostics.push({
        code: "FWYML_CONTRACT_INCOMPATIBLE",
        severity: "error",
        message: "major contract change requires an explicit manifest migration",
        remediation: "explicit-manifest-migration",
      });
      return diagnostics;
    }
    diagnostics.push({
      code: "FWYML_UPDATE_AVAILABLE",
      severity: "info",
      message: "compatible contract extension is available",
    });
  }

  return diagnostics;
}

export function driftResolves(input: DriftCase): boolean {
  const codes = classifyDrift(input).filter((item) => item.severity === "error");
  return codes.length === 0;
}
