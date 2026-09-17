import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parse } from "yaml";
import { classifyDrift } from "../dist/drift.js";
import { assertRegistry } from "../dist/schema.js";
import { runSelectedTools } from "../dist/tools.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(root, "dist", "cli.js");
const stageVSA = join(root, "scripts", "stage-vsa.mjs");
const manifests = join(root, ".project", ".vsa-ide", "manifests");

function run(args, env = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    cwd: root,
    env: { ...process.env, ...env },
  });
}

function isolatedSnapshotRegistry() {
  const dir = mkdtempSync(join(tmpdir(), "fwyml-snapshot-"));
  const registryDir = join(dir, "registry");
  cpSync(join(root, "registry", "snapshot"), registryDir, { recursive: true });
  const registry = join(registryDir, "records.yaml");
  const snapshot = parse(readFileSync(registry, "utf8"));
  for (const record of snapshot.records ?? []) {
    if (record.ownedFiles?.length) {
      record.source = { ...record.source, path: join(dir, "unextracted", record.id) };
    }
  }
  writeFileSync(registry, JSON.stringify(snapshot));
  return { dir, registry };
}

function materializableSliceFixture() {
  const dir = mkdtempSync(join(tmpdir(), "fwyml-slice-"));
  const artifact = join(dir, "artifact", "files", "slices");
  mkdirSync(artifact, { recursive: true });
  writeFileSync(join(artifact, "surface.txt"), "fixture surface\n");

  const registry = join(dir, "registry.yaml");
  const manifest = join(dir, "fw.yaml");
  writeFileSync(registry, `schemaVersion: fw.buildy.tech/registry/v0alpha1
kind: Registry
records:
  - id: surface
    kind: capability
    version: "1"
  - id: surface-adapter
    kind: adapter
    version: "1"
    provides: [surface]
  - id: surface-slice
    kind: vertical-slice
    version: "1"
    source:
      kind: files
      path: artifact
    ownedFiles: [slices/surface.txt]
`);
  writeFileSync(manifest, `schemaVersion: fw.buildy.tech/v0alpha1
kind: Product
metadata:
  name: slice-fixture
composition:
  capabilities:
    surface: { use: surface-adapter }
  slices: [surface-slice]
`);
  return { dir, registry, manifest };
}

test("version works without adapters", () => {
  const result = run(["--version"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /0\.2\.0/);
});

test("three manifests validate against the generic schema", () => {
  for (const name of ["workshop-templ.yaml", "workshop-svelte-agent.yaml", "assistant-solid-browser.yaml"]) {
    const result = run(["validate", "--manifest", join(manifests, name)]);
    assert.equal(result.status, 0, `${name} ${result.stdout}${result.stderr}`);
  }
});

test("bundled capability records reference a published port specification", () => {
  const records = parse(readFileSync(join(root, "registry", "snapshot", "records.yaml"), "utf8"));
  for (const record of records.records ?? []) {
    if (record.kind !== "capability" || !record.contract) {
      continue;
    }
    assert.equal(
      existsSync(join(root, "registry", "snapshot", "specs", `${record.contract}.yaml`)),
      true,
      `${record.id} requires ${record.contract}`,
    );
  }
});

test("registry sources require immutable identifiers for their declared kind", () => {
  assert.throws(
    () => assertRegistry({
      schemaVersion: "fw.buildy.tech/registry/v0alpha1",
      kind: "Registry",
      records: [{
        id: "unversioned-package",
        kind: "adapter",
        version: "1",
        source: { kind: "npm", package: "example-package" },
      }],
    }),
    /ref/,
  );
});

test("VSA staging copies registry metadata without fabricating artifacts", () => {
  const dir = mkdtempSync(join(tmpdir(), "fwyml-stage-"));
  const result = spawnSync(process.execPath, [stageVSA], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, FWYML_VSA_STAGING: dir },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(dir, "registry", "index.yaml")), true);
  assert.equal(existsSync(join(dir, "artifacts")), false);
  rmSync(dir, { recursive: true, force: true });
});

test("unextracted VSA selections retain absence data and block materialization", () => {
  const cases = [
    {
      file: "workshop-templ.yaml",
      absent: ["agent"],
      present: ["browse", "workspace"],
    },
    {
      file: "workshop-svelte-agent.yaml",
      absent: ["browse"],
      present: ["agent", "editor"],
    },
    {
      file: "assistant-solid-browser.yaml",
      absent: ["workspace", "editor", "explorer", "vcs"],
      present: ["browse", "agent"],
    },
  ];
  for (const item of cases) {
    const snapshot = isolatedSnapshotRegistry();
    const resolved = run(["--json", "resolve", "--manifest", join(manifests, item.file), "--registry", snapshot.registry]);
    assert.equal(resolved.status, 1, resolved.stderr);
    const body = JSON.parse(resolved.stdout);
    for (const id of item.absent) {
      assert.ok(body.resolution.absent.includes(id), `${item.file} missing absent ${id}`);
      assert.ok(!body.resolution.nodes.some((node) => node.record.provides?.includes(id) && id !== "ui"));
    }
    for (const id of item.present) {
      assert.ok(body.resolution.nodes.some((node) => (node.record.provides ?? []).includes(id)), `${item.file} missing ${id}`);
    }
    assert.ok(body.resolution.diagnostics.some((row) => row.code === "FWYML_SOURCE_MISSING"));
    rmSync(snapshot.dir, { recursive: true, force: true });
  }
});

test("resolver source names no product ids", () => {
  const walk = (dir) => {
    const names = [];
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, name.name);
      if (name.isDirectory()) {
        names.push(...walk(path));
      } else if (name.name.endsWith(".ts")) {
        names.push(readFileSync(path, "utf8"));
      }
    }
    return names;
  };
  const src = walk(join(root, "src")).join("\n");
  for (const token of [
    "workshop-templ",
    "workshop-svelte-agent",
    "assistant-solid-browser",
    "wails3",
    "svelte-check",
    "solid-js",
    "ui8kit",
  ]) {
    assert.equal(src.includes(token), false, token);
  }
});

test("drift fixtures emit stable codes", () => {
  const doc = parse(readFileSync(join(root, ".project", ".harness", "cases", "drift.yaml"), "utf8"));
  for (const item of doc.cases) {
    const codes = classifyDrift(item).map((row) => row.code);
    assert.deepEqual(codes, item.expected.codes);
  }
});

test("constraints and contract ranges use registry compatibility data", () => {
  const dir = mkdtempSync(join(tmpdir(), "fwyml-compatibility-"));
  const registry = join(dir, "registry.yaml");
  const manifest = join(dir, "fw.yaml");
  writeFileSync(registry, `schemaVersion: fw.buildy.tech/registry/v0alpha1
kind: Registry
metadata:
  id: compatibility-fixture
  status: draft
records:
  - id: runtime
    kind: capability
    version: "1.2.0"
    contract: runtime@1.2
    readiness: draft
  - id: runtime-adapter
    kind: adapter
    version: "1.2.0"
    contract: runtime@1.2
    provides: [runtime]
    features: [portable]
    source:
      kind: npm
      package: example-runtime
      ref: "1.2.0"
      install: devDependency
    compatibility:
      platforms: [desktop]
    readiness: draft
`);
  writeFileSync(manifest, `schemaVersion: fw.buildy.tech/v0alpha1
kind: Product
metadata:
  name: compatibility-fixture
composition:
  capabilities:
    runtime:
      use: runtime-adapter
      contractRange: ">=1.1 <2"
constraints:
  required: [portable, desktop]
  forbidden: [server]
`);
  const accepted = run(["--json", "resolve", "--manifest", manifest, "--registry", registry]);
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.equal(JSON.parse(accepted.stdout).resolution.plan.npmDev["example-runtime"], "1.2.0");

  writeFileSync(manifest, readFileSync(manifest, "utf8").replace("forbidden: [server]", "forbidden: [portable]"));
  const rejected = run(["--json", "resolve", "--manifest", manifest, "--registry", registry]);
  assert.equal(rejected.status, 1, rejected.stderr);
  assert.ok(JSON.parse(rejected.stdout).resolution.diagnostics.some((row) => row.code === "FWYML_ABSENCE_VIOLATION"));
  rmSync(dir, { recursive: true, force: true });
});

test("registry ambiguity is a stable JSON diagnostic", () => {
  const dir = mkdtempSync(join(tmpdir(), "fwyml-registry-"));
  const registry = join(dir, "registry.yaml");
  const manifest = join(dir, "fw.yaml");
  writeFileSync(registry, `schemaVersion: fw.buildy.tech/registry/v0alpha1
kind: Registry
records:
  - id: repeated
    kind: capability
    version: "1"
  - id: repeated
    kind: capability
    version: "1"
`);
  writeFileSync(manifest, `schemaVersion: fw.buildy.tech/v0alpha1
kind: Product
metadata:
  name: registry-fixture
composition:
  capabilities:
    runtime:
      use: repeated
`);
  const result = run(["--json", "resolve", "--manifest", manifest, "--registry", registry]);
  assert.equal(result.status, 1, result.stderr);
  assert.ok(JSON.parse(result.stdout).diagnostics.some((row) => row.code === "FWYML_REGISTRY_AMBIGUITY"));
  rmSync(dir, { recursive: true, force: true });
});

test("incompatible dependency versions fail resolution before materialization", () => {
  const dir = mkdtempSync(join(tmpdir(), "fwyml-dependency-"));
  const registry = join(dir, "registry.yaml");
  const manifest = join(dir, "fw.yaml");
  writeFileSync(registry, `schemaVersion: fw.buildy.tech/registry/v0alpha1
kind: Registry
records:
  - id: first
    kind: capability
    version: "1"
  - id: second
    kind: capability
    version: "1"
  - id: first-adapter
    kind: adapter
    version: "1"
    provides: [first]
    npm:
      dependencies: { example-shared: "1.0.0" }
  - id: second-adapter
    kind: adapter
    version: "1"
    provides: [second]
    npm:
      dependencies: { example-shared: "2.0.0" }
`);
  writeFileSync(manifest, `schemaVersion: fw.buildy.tech/v0alpha1
kind: Product
metadata:
  name: dependency-fixture
composition:
  capabilities:
    first: { use: first-adapter }
    second: { use: second-adapter }
`);
  const result = run(["--json", "resolve", "--manifest", manifest, "--registry", registry]);
  assert.equal(result.status, 1, result.stderr);
  assert.ok(JSON.parse(result.stdout).resolution.diagnostics.some((row) => row.code === "FWYML_DEPENDENCY_CONFLICT"));
  rmSync(dir, { recursive: true, force: true });
});

test("missing selected artifact sources block planning and sync", () => {
  const dir = mkdtempSync(join(tmpdir(), "fwyml-source-"));
  const registry = join(dir, "registry.yaml");
  const manifest = join(dir, "fw.yaml");
  writeFileSync(registry, `schemaVersion: fw.buildy.tech/registry/v0alpha1
kind: Registry
records:
  - id: source-adapter
    kind: adapter
    version: "1"
    provides: [source]
    source:
      kind: files
      path: missing-artifact
    ownedFiles:
      - src/source.ts
`);
  writeFileSync(manifest, `schemaVersion: fw.buildy.tech/v0alpha1
kind: Product
metadata:
  name: source-fixture
composition:
  capabilities:
    source: { use: source-adapter }
`);
  const resolved = run(["--json", "resolve", "--manifest", manifest, "--registry", registry]);
  assert.equal(resolved.status, 1, resolved.stderr);
  assert.ok(JSON.parse(resolved.stdout).resolution.diagnostics.some((row) => row.code === "FWYML_SOURCE_MISSING"));
  const synced = run(["--json", "sync", "--manifest", manifest, "--registry", registry, "--out", join(dir, "product")]);
  assert.equal(synced.status, 1, synced.stderr);
  rmSync(dir, { recursive: true, force: true });
});

test("fetch acquires a pinned git artifact before sync", () => {
  const dir = mkdtempSync(join(tmpdir(), "fwyml-git-"));
  const repository = join(dir, "repository");
  const git = (argv) => {
    const result = spawnSync("git", argv, { cwd: repository, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  mkdirSync(join(repository, "implementation"), { recursive: true });
  git(["init"]);
  git(["config", "user.email", "fixture@example.com"]);
  git(["config", "user.name", "Fixture"]);
  writeFileSync(join(repository, "implementation", "source.ts"), "export const source = true;\n");
  git(["add", "."]);
  git(["commit", "-m", "fixture"]);
  const commit = git(["rev-parse", "HEAD"]);

  const registry = join(dir, "registry.yaml");
  const manifest = join(dir, "fw.yaml");
  const out = join(dir, "product");
  writeFileSync(registry, JSON.stringify({
    schemaVersion: "fw.buildy.tech/registry/v0alpha1",
    kind: "Registry",
    records: [{
      id: "source",
      kind: "capability",
      version: "1",
    }, {
      id: "source-adapter",
      kind: "adapter",
      version: "1",
      provides: ["source"],
      source: {
        kind: "git",
        repository,
        commit,
        exports: { "src/source.ts": "implementation/source.ts" },
      },
      ownedFiles: ["src/source.ts"],
    }],
  }));
  writeFileSync(manifest, JSON.stringify({
    schemaVersion: "fw.buildy.tech/v0alpha1",
    kind: "Product",
    metadata: { name: "git-fixture" },
    composition: { capabilities: { source: { use: "source-adapter" } } },
  }));

  const fetched = run(["--json", "fetch", "--manifest", manifest, "--registry", registry, "--out", out]);
  assert.equal(fetched.status, 0, `${fetched.stdout}${fetched.stderr}`);
  const synced = run(["sync", "--manifest", manifest, "--registry", registry, "--out", out]);
  assert.equal(synced.status, 0, `${synced.stdout}${synced.stderr}`);
  assert.equal(existsSync(join(out, "src", "source.ts")), true);
  rmSync(dir, { recursive: true, force: true });
});

test("registered tool preparation runs before the declared command", () => {
  const dir = mkdtempSync(join(tmpdir(), "fwyml-tools-"));
  const result = runSelectedTools({
    plan: {
      tools: [{
        id: "tool-fixture",
        prepare: ["node", "-e", "require('node:fs').writeFileSync('prepared', 'ok')"],
        argv: ["node", "-e", "process.exit(require('node:fs').existsSync('prepared') ? 0 : 1)"],
      }],
    },
  }, dir);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.runs.map((run) => run.id), ["tool-fixture:prepare", "tool-fixture"]);
  rmSync(dir, { recursive: true, force: true });
});

test("verify refuses a persisted lock that no longer matches resolution", () => {
  const fixture = materializableSliceFixture();
  const out = join(fixture.dir, "product");
  const synced = run(["sync", "--manifest", fixture.manifest, "--registry", fixture.registry, "--out", out]);
  assert.equal(synced.status, 0, synced.stderr);
  const lock = join(out, "fw.lock.yaml");
  writeFileSync(lock, readFileSync(lock, "utf8").replace(/registryDigest: .*/, "registryDigest: sha256:stale"));
  const verified = run(["--json", "verify", "--strict", "--manifest", fixture.manifest, "--registry", fixture.registry, "--out", out]);
  assert.equal(verified.status, 2, verified.stderr);
  const report = JSON.parse(verified.stdout);
  assert.ok(report.diagnostics.some((row) => row.code === "FWYML_LOCK_MISMATCH"));
  assert.deepEqual(report.runs, []);
  rmSync(fixture.dir, { recursive: true, force: true });
});

test("verify detects a changed selected output from persisted ownership digests", () => {
  const fixture = materializableSliceFixture();
  const out = join(fixture.dir, "product");
  assert.equal(run(["sync", "--manifest", fixture.manifest, "--registry", fixture.registry, "--out", out]).status, 0);
  const output = join(out, "slices", "surface.txt");
  writeFileSync(output, `${readFileSync(output, "utf8")}user change\n`);
  const verified = run(["--json", "verify", "--manifest", fixture.manifest, "--registry", fixture.registry, "--out", out]);
  assert.equal(verified.status, 2, verified.stderr);
  assert.ok(JSON.parse(verified.stdout).diagnostics.some((row) => row.code === "FWYML_LOCK_MISMATCH" && row.id === "slices/surface.txt"));
  rmSync(fixture.dir, { recursive: true, force: true });
});

test("sync removes unchanged stale outputs and protects modified outputs", () => {
  const fixture = materializableSliceFixture();
  const out = join(fixture.dir, "product");
  const changedManifest = join(fixture.dir, "reduced.yaml");
  const source = parse(readFileSync(fixture.manifest, "utf8"));
  source.composition.slices = source.composition.slices.filter((id) => id !== "surface-slice");
  writeFileSync(changedManifest, JSON.stringify(source));

  assert.equal(run(["sync", "--manifest", fixture.manifest, "--registry", fixture.registry, "--out", out]).status, 0);
  assert.equal(existsSync(join(out, "slices", "surface.txt")), true);
  const removed = run(["sync", "--manifest", changedManifest, "--registry", fixture.registry, "--out", out]);
  assert.equal(removed.status, 0, removed.stderr);
  assert.equal(existsSync(join(out, "slices", "surface.txt")), false);

  assert.equal(run(["sync", "--manifest", fixture.manifest, "--registry", fixture.registry, "--out", out]).status, 0);
  const stale = join(out, "slices", "surface.txt");
  writeFileSync(stale, `${readFileSync(stale, "utf8")}user change\n`);
  const protectedSync = run(["sync", "--manifest", changedManifest, "--registry", fixture.registry, "--out", out]);
  assert.equal(protectedSync.status, 3, protectedSync.stderr);
  assert.equal(existsSync(stale), true);
  rmSync(fixture.dir, { recursive: true, force: true });
});
