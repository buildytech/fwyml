import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parse } from "yaml";
import { classifyDrift } from "../dist/drift.js";

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
