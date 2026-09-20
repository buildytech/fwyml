import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parse } from "yaml";
import { runSelectedTools } from "../dist/tools.js";

const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
function fixture(t, records = []) {
  const dir = mkdtempSync(join(tmpdir(), "fwyml-assembly-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const put = (path, data) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), typeof data === "object" && !Buffer.isBuffer(data) ? JSON.stringify(data) : data);
  };
  const manifest = {
    schemaVersion: "urn:fwyml:manifest:v0alpha1", kind: "Product", metadata: { name: "assembly" },
    registries: [{ id: "local", source: "registry.json" }],
    composition: { capabilities: { surface: { use: "adapter" } } },
  };
  const registry = {
    schemaVersion: "urn:fwyml:registry:v0alpha1", kind: "Registry",
    records: [{ id: "surface", kind: "capability", version: "1" },
      { id: "adapter", kind: "adapter", version: "1", provides: ["surface"], dependencies: records.map(r => r.id) }, ...records],
  };
  const save = () => { put("fw.json", manifest); put("registry.json", registry); };
  save();
  const out = join(dir, "out");
  const run = (command, ...args) => spawnSync(process.execPath, [cli, command, "--json", "--manifest", join(dir, "fw.json"), "--out", out, ...args], { encoding: "utf8" });
  return { dir, put, manifest, registry, save, out, run };
}
const record = (id, extra) => ({ id, kind: "product-template", version: "1", ...extra });
function ok(result) { assert.equal(result.status, 0, result.stdout + result.stderr); return JSON.parse(result.stdout); }

test("neutral, npm and Go selections emit only requested ecosystems", t => {
  const f = fixture(t);
  ok(f.run("sync"));
  for (const path of ["package.json", "go.mod", "compose/identity.go"]) assert.equal(existsSync(join(f.out, path)), false);
  ok(f.run("verify"));

  f.registry.records[1].npm = { dependencies: { "fixture-runtime": "1.0.0" } };
  f.save(); ok(f.run("sync"));
  assert.deepEqual(JSON.parse(readFileSync(join(f.out, "package.json"))).scripts, {});
  assert.equal(existsSync(join(f.out, "go.mod")), false);
  ok(f.run("verify"));

  delete f.registry.records[1].npm;
  f.registry.records.push(record("go-root", { go: { module: "example.org/selected", version: "1.24.0" } }));
  f.registry.records[1].dependencies = ["go-root"];
  f.save(); ok(f.run("sync"));
  assert.equal(existsSync(join(f.out, "package.json")), false);
  assert.match(readFileSync(join(f.out, "go.mod"), "utf8"), /module example.org\/selected\n\ngo 1.24.0/);
  ok(f.run("verify"));
  rmSync(join(f.out, "go.mod"));
  assert.equal(f.run("verify").status, 2);
});

test("Go synthesis rejects undeclared language version, including dry-run", t => {
  const f = fixture(t, [record("go-root", { go: { module: "example.org/selected" } })]);
  assert.equal(f.run("sync", "--dry-run").status, 1);
  assert.equal(f.run("sync").status, 1);
  assert.equal(existsSync(f.out), false);
});

test("owned package manifest is preserved instead of replaced with defaults", t => {
  const f = fixture(t, [record("root", { source: { kind: "files", path: "artifact" }, ownedFiles: ["package.json"] })]);
  const original = '{"name":"from-artifact","scripts":{"build":"custom-build"}}\n';
  f.put("artifact/files/package.json", original);
  ok(f.run("sync"));
  assert.equal(readFileSync(join(f.out, "package.json"), "utf8"), original);
  ok(f.run("verify"));
});

test("binary assets round-trip, verify, protect edits and reconcile removal", t => {
  const f = fixture(t, [record("asset", { source: { kind: "files", path: "artifact" }, ownedFiles: ["assets/font.bin"] })]);
  const bytes = Buffer.from([0, 255, 254, 128, 1, 13, 10]);
  f.put("artifact/files/assets/font.bin", bytes);
  ok(f.run("sync"));
  const target = join(f.out, "assets/font.bin");
  assert.deepEqual(readFileSync(target), bytes);
  ok(f.run("verify"));
  writeFileSync(target, Buffer.from([0, 254, 255, 128, 1, 13, 10]));
  assert.equal(f.run("verify").status, 2);
  f.registry.records[1].dependencies = []; f.save();
  assert.equal(f.run("sync").status, 3);
  writeFileSync(target, bytes);
  ok(f.run("sync"));
  assert.equal(existsSync(target), false);
});

test("missing selected generator and validator fail CLI commands", t => {
  for (const phase of ["generate", "verify"]) {
    const f = fixture(t, [record("tool", { kind: phase === "generate" ? "generator" : "validator", command: { phase, argv: ["fwyml-no-such-executable-18945"] } })]);
    ok(f.run("sync"));
    const result = f.run(phase);
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.equal(JSON.parse(result.stdout).ok, false);
  }
});

test("failed tool preparation prevents dependent command", t => {
  const f = fixture(t);
  const result = runSelectedTools({ plan: { tools: [{ id: "prepared", prepare: [process.execPath, "-e", "process.exit(7)"], argv: [process.execPath, "-e", "require('fs').writeFileSync('unexpected', 'bad')"] }] } }, f.dir);
  assert.equal(result.diagnostics[0].severity, "error");
  assert.equal(result.runs.length, 1);
  assert.equal(existsSync(join(f.dir, "unexpected")), false);
});

test("generators execute dependency first even when dependent is declared first", t => {
  const f = fixture(t, [
    record("consumer", { kind: "generator", dependencies: ["producer"], command: { phase: "generate", argv: [process.execPath, "-e", "process.exit(require('fs').existsSync('ready') ? 0 : 9)"] } }),
    record("producer", { kind: "generator", command: { phase: "generate", argv: [process.execPath, "-e", "require('fs').writeFileSync('ready', 'ok')"] } }),
  ]);
  ok(f.run("sync"));
  assert.deepEqual(ok(f.run("generate")).runs.map(r => r.id), ["producer", "consumer"]);
});

test("a failed generator prevents downstream execution", t => {
  const f = fixture(t);
  const result = runSelectedTools({ plan: { tools: [
    { id: "producer", argv: [process.execPath, "-e", "process.exit(4)"] },
    { id: "consumer", argv: [process.execPath, "-e", "require('fs').writeFileSync('unexpected', 'bad')"] },
  ] } }, f.dir);
  assert.deepEqual(result.runs.map(r => r.id), ["producer"]);
  assert.equal(existsSync(join(f.dir, "unexpected")), false);
});

test("go-module sources declare real dependencies without npm output", t => {
  const f = fixture(t, [
    record("root", { go: { module: "example.org/root", version: "1.25.0" } }),
    record("lib", { kind: "adapter", source: { kind: "go-module", module: "example.org/lib", ref: "v1.2.3" } }),
  ]);
  ok(f.run("sync"));
  assert.match(readFileSync(join(f.out, "go.mod"), "utf8"), /example.org\/lib v1.2.3/);
  assert.equal(existsSync(join(f.out, "package.json")), false);
});

test("cycles and conflicts in either selection order fail before writes", t => {
  for (const reverse of [false, true]) {
    const records = [record("a", { conflicts: ["b"] }), record("b", {})];
    const f = fixture(t, reverse ? records.reverse() : records);
    assert.equal(f.run("sync").status, 1);
    assert.equal(existsSync(f.out), false);
  }
  const f = fixture(t, [record("a", { dependencies: ["b"] }), record("b", { dependencies: ["a"] })]);
  assert.equal(f.run("sync").status, 1);
  assert.equal(existsSync(f.out), false);
});

test("included registries resolve artifact paths at their declaring document", t => {
  const f = fixture(t);
  f.registry.include = ["left/registry.json", "right/registry.json"];
  f.registry.records[1].dependencies = ["left", "right"]; f.save();
  for (const side of ["left", "right"]) {
    f.put(`${side}/registry.json`, { schemaVersion: "urn:fwyml:registry:v0alpha1", kind: "Registry", records: [record(side, { source: { kind: "files", path: "artifact", exports: { [`${side}.txt`]: "same.txt" } }, ownedFiles: [`${side}.txt`] })] });
    f.put(`${side}/artifact/same.txt`, side);
  }
  ok(f.run("sync"));
  for (const side of ["left", "right"]) assert.equal(readFileSync(join(f.out, `${side}.txt`), "utf8"), side);
});

test("Go dependency and npm script conflicts cannot be hidden by record order", t => {
  for (const extra of [
    [{ go: { module: "example.org/lib", require: "v1.0.0" } }, { go: { module: "example.org/lib", require: "v2.0.0" } }],
    [{ npm: { scripts: { build: "first" } } }, { npm: { scripts: { build: "second" } } }],
  ]) {
    const f = fixture(t, [record("a", { ...extra[0], kind: "adapter" }), record("b", { ...extra[1], kind: "adapter" })]);
    const result = f.run("resolve");
    assert.equal(result.status, 1);
    assert.ok(JSON.parse(result.stdout).resolution.diagnostics.some(d => d.code === "FWYML_DEPENDENCY_CONFLICT"));
  }
});

test("lock owns exactly the materialized ecosystem files", t => {
  const f = fixture(t);
  ok(f.run("sync"));
  const lock = parse(readFileSync(join(f.out, "fw.lock.yaml"), "utf8"));
  assert.deepEqual(Object.keys(lock.ownership), ["fw.yaml"]);
});
