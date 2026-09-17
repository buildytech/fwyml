export type Severity = "info" | "warning" | "error";

export type Diagnostic = {
  code: string;
  severity: Severity;
  message: string;
  id?: string;
  remediation?: string;
};

export type Manifest = {
  schemaVersion: string;
  kind: string;
  metadata: { name: string; description?: string };
  registries?: { id: string; source: string }[];
  composition: {
    capabilities: Record<string, { use: string }>;
    slices?: string[];
  };
  quality?: { guidance?: string[]; validators?: string[] };
  constraints?: { required?: string[]; forbidden?: string[] };
};

export type RegistryRecord = {
  id: string;
  kind: string;
  version: string;
  contract?: string;
  contractRange?: string;
  provides?: string[];
  requires?: string[];
  dependencies?: string[];
  conflicts?: string[];
  surfaces?: string[];
  uiFamilies?: string[];
  hostFamilies?: string[];
  adapterConstraints?: string[];
  removal?: {
    ownedFiles?: string[];
    ownedDependencies?: string[];
    ownedRoutes?: string[];
    ownedBindings?: string[];
  };
  compatibility?: { platforms?: string[]; runtimes?: string[] };
  source?: {
    kind: string;
    path?: string;
    repository?: string;
    commit?: string;
    package?: string;
    module?: string;
    subpath?: string;
    portable?: boolean;
  };
  integrity?: { publicDigest?: string; outputDigest?: string };
  readiness?: "draft" | "verified" | "blocked";
  validatorRefs?: string[];
  conformanceRefs?: string[];
  guidance?: string[];
  command?: {
    argv?: string[];
    cwd?: string;
    prepare?: string[];
    inputs?: string[];
    exit?: string;
    phase?: string;
    outputs?: string[];
  };
  ownedFiles?: string[];
  npm?: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  go?: { module?: string; require?: string; replace?: string };
  notes?: string;
};

export type Registry = {
  schemaVersion: string;
  kind: string;
  metadata?: { id?: string; status?: string };
  include?: string[];
  records?: RegistryRecord[];
};

export type ResolvedNode = {
  record: RegistryRecord;
  reason: string;
};

export type Resolution = {
  product: string;
  nodes: ResolvedNode[];
  absent: string[];
  diagnostics: Diagnostic[];
  plan: MaterializePlan;
};

export type MaterializePlan = {
  files: { dest: string; from: string; owner: string }[];
  npm: Record<string, string>;
  npmDev: Record<string, string>;
  go: { module?: string; require: Record<string, string>; replace: Record<string, string> };
  tools: { id: string; argv: string[]; phase?: string; outputs?: string[] }[];
  guidance: { dest: string; from: string; owner: string }[];
  local: boolean;
};

export type LockFile = {
  schemaVersion: string;
  kind: string;
  product: string;
  registrySnapshot: string;
  records: {
    id: string;
    kind: string;
    version: string;
    contract?: string;
    sourceKind?: string;
    sourceRef?: string;
    publicDigest?: string;
    outputDigest?: string;
    readiness?: string;
    portable?: boolean;
    conformanceRef?: string;
  }[];
  absent: string[];
  ownership: Record<string, string>;
  dependencies: { npm: Record<string, string>; go: Record<string, string> };
  diagnostics: Diagnostic[];
};
