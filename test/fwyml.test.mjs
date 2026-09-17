import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parse } from "yaml";
import { classifyDrift } from "../dist/drift.js";
import { runSelectedTools } from "../dist/tools.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(root, "dist", "cli.js");
const manifests = join(root, ".project", ".vsa-ide", "manifests");

function run(args, env = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    cwd: root,
    env: { ...process.env, ...env },
  });
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

test("resolve keeps unselected capabilities absent", () => {
  const cases = [
    {
      file: "workshop-templ.yaml",
      absent: ["agent"],
      present: ["browse", "workspace"],
      missingFiles: ["slices/agent-chat-surface.txt"],
    },
    {
      file: "workshop-svelte-agent.yaml",
      absent: ["browse"],
      present: ["agent", "editor"],
      missingFiles: ["browse/surface.txt"],
    },
    {
      file: "assistant-solid-browser.yaml",
      absent: ["workspace", "editor", "explorer", "vcs"],
      present: ["browse", "agent"],
      missingFiles: ["workspace/surface.txt", "editor/surface.txt"],
    },
  ];
  for (const item of cases) {
    const resolved = run(["--json", "resolve", "--manifest", join(manifests, item.file)]);
    assert.equal(resolved.status, 0, resolved.stderr);
    const body = JSON.parse(resolved.stdout);
    for (const id of item.absent) {
      assert.ok(body.resolution.absent.includes(id), `${item.file} missing absent ${id}`);
      assert.ok(!body.resolution.nodes.some((node) => node.record.provides?.includes(id) && id !== "ui"));
    }
    for (const id of item.present) {
      assert.ok(body.resolution.nodes.some((node) => (node.record.provides ?? []).includes(id)), `${item.file} missing ${id}`);
    }
    const dir = mkdtempSync(join(tmpdir(), "fwyml-"));
    const synced = run(["--json", "sync", "--manifest", join(manifests, item.file), "--out", dir]);
    assert.equal(synced.status, 0, synced.stderr);
    const tree = readFileSync(join(dir, "fw.lock.yaml"), "utf8");
    const identity = readFileSync(join(dir, "compose", "identity.go"), "utf8");
    assert.match(identity, /ProductName/);
    assert.equal(existsSync(join(dir, "go.sum")), true);
    assert.equal(existsSync(join(dir, "fw.yaml")), true);
    for (const missing of item.missingFiles) {
      assert.equal(tree.includes(missing), false, `${item.file} lock should not own ${missing}`);
      assert.equal(existsSync(join(dir, missing)), false, `${item.file} must not write ${missing}`);
    }
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const id of item.absent) {
      assert.equal(Object.keys(deps).some((name) => name.includes(id)), false, `${item.file} dep ${id}`);
    }
    const strict = run(["--json", "verify", "--strict", "--manifest", join(manifests, item.file), "--out", dir]);
    assert.equal(strict.status, 2, `${item.file} strict`);
    const report = JSON.parse(strict.stdout);
    assert.ok(report.diagnostics.some((row) => row.code === "FWYML_UNVERIFIED_ARTIFACT"));
    if (item.present.includes("agent")) {
      assert.ok(report.diagnostics.some((row) => row.id === "agent-runtime-cursor-node" && row.message.includes("blocked")));
    }
    rmSync(dir, { recursive: true, force: true });
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
  const dir = mkdtempSync(join(tmpdir(), "fwyml-lock-"));
  const manifest = join(manifests, "workshop-templ.yaml");
  const synced = run(["sync", "--manifest", manifest, "--out", dir]);
  assert.equal(synced.status, 0, synced.stderr);
  const lock = join(dir, "fw.lock.yaml");
  writeFileSync(lock, readFileSync(lock, "utf8").replace(/registryDigest: .*/, "registryDigest: sha256:stale"));
  const verified = run(["--json", "verify", "--strict", "--manifest", manifest, "--out", dir]);
  assert.equal(verified.status, 2, verified.stderr);
  const report = JSON.parse(verified.stdout);
  assert.ok(report.diagnostics.some((row) => row.code === "FWYML_LOCK_MISMATCH"));
  assert.deepEqual(report.runs, []);
  rmSync(dir, { recursive: true, force: true });
});

test("verify detects a changed selected output from persisted ownership digests", () => {
  const dir = mkdtempSync(join(tmpdir(), "fwyml-output-lock-"));
  const manifest = join(manifests, "workshop-templ.yaml");
  assert.equal(run(["sync", "--manifest", manifest, "--out", dir]).status, 0);
  const output = join(dir, "slices", "editor-surface.txt");
  writeFileSync(output, `${readFileSync(output, "utf8")}user change\n`);
  const verified = run(["--json", "verify", "--manifest", manifest, "--out", dir]);
  assert.equal(verified.status, 2, verified.stderr);
  assert.ok(JSON.parse(verified.stdout).diagnostics.some((row) => row.code === "FWYML_LOCK_MISMATCH" && row.id === "slices/editor-surface.txt"));
  rmSync(dir, { recursive: true, force: true });
});

test("sync removes unchanged stale outputs and protects modified outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "fwyml-removal-"));
  const manifest = join(manifests, "workshop-templ.yaml");
  const changedManifest = join(dir, "reduced.yaml");
  const source = parse(readFileSync(manifest, "utf8"));
  source.composition.slices = source.composition.slices.filter((id) => id !== "editor-surface");
  writeFileSync(changedManifest, JSON.stringify(source));

  assert.equal(run(["sync", "--manifest", manifest, "--out", dir]).status, 0);
  assert.equal(existsSync(join(dir, "slices", "editor-surface.txt")), true);
  const removed = run(["sync", "--manifest", changedManifest, "--out", dir]);
  assert.equal(removed.status, 0, removed.stderr);
  assert.equal(existsSync(join(dir, "slices", "editor-surface.txt")), false);

  assert.equal(run(["sync", "--manifest", manifest, "--out", dir]).status, 0);
  const stale = join(dir, "slices", "editor-surface.txt");
  writeFileSync(stale, `${readFileSync(stale, "utf8")}user change\n`);
  const protectedSync = run(["sync", "--manifest", changedManifest, "--out", dir]);
  assert.equal(protectedSync.status, 3, protectedSync.stderr);
  assert.equal(existsSync(stale), true);
  rmSync(dir, { recursive: true, force: true });
});
