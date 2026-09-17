import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { listFiles, readText, renderYaml, sha256, writeJson, writeText } from "./io.js";
import type { LockFile, Manifest, Resolution } from "./types.js";

export function renderGoMod(plan: Resolution["plan"], product: string): string {
  const module = plan.go.module ?? `example.com/${product}`;
  const lines = [`module ${module}`, "", "go 1.25.0"];
  const requires = Object.entries(plan.go.require);
  if (requires.length > 0) {
    lines.push("", "require (");
    for (const [name, version] of requires) {
      lines.push(`\t${name} ${version}`);
    }
    lines.push(")");
  }
  const replaces = Object.entries(plan.go.replace);
  if (replaces.length > 0) {
    lines.push("", "replace (");
    for (const [name, path] of replaces) {
      lines.push(`\t${name} => ${path}`);
    }
    lines.push(")");
  }
  return `${lines.join("\n")}\n`;
}

export function renderPackageJson(plan: Resolution["plan"], product: string): string {
  return `${JSON.stringify(
    {
      name: product,
      private: true,
      type: "module",
      scripts: { build: 'node -e "process.exit(0)"', ...plan.scripts },
      dependencies: plan.npm,
      devDependencies: plan.npmDev,
    },
    null,
    2,
  )}\n`;
}

export function renderIdentity(product: string): string {
  const name = JSON.stringify(product);
  return `package compose\n\nconst ProductName = ${name}\n`;
}

export function materialize(outDir: string, resolution: Resolution, lock: LockFile, prior?: LockFile, manifest?: Manifest): string[] {
  const conflicts: string[] = [];
  const desired = new Map<string, { contents: string; owner: string }>();
  for (const file of [...resolution.plan.files, ...resolution.plan.guidance]) {
    if (!existsSync(file.from)) {
      conflicts.push(`missing source ${file.from}`);
      continue;
    }
    const existing = desired.get(file.dest);
    if (existing && existing.contents !== readText(file.from)) {
      conflicts.push(`multiple owners for ${file.dest}`);
      continue;
    }
    desired.set(file.dest, { contents: readText(file.from), owner: file.owner });
  }

  desired.set("package.json", { contents: renderPackageJson(resolution.plan, resolution.product), owner: "fwyml" });
  if (!desired.has("go.mod")) {
    desired.set("go.mod", { contents: renderGoMod(resolution.plan, resolution.product), owner: "fwyml" });
  }
  desired.set("compose/identity.go", { contents: renderIdentity(resolution.product), owner: "fwyml" });
  if (manifest) {
    desired.set("fw.yaml", { contents: renderYaml(manifest), owner: "fwyml" });
  }

  for (const [dest, output] of desired) {
    const target = join(outDir, dest);
    if (!existsSync(target)) {
      continue;
    }
    if (!prior?.ownership[dest]) {
      conflicts.push(`unowned target ${dest}`);
      continue;
    }
    const expectedDigest = prior.ownedOutputDigests?.[dest];
    if (!expectedDigest || sha256(readText(target)) !== expectedDigest) {
      conflicts.push(`modified owned target ${dest}`);
    }
  }

  const stale = Object.keys(prior?.ownership ?? {}).filter((dest) => !desired.has(dest));
  for (const dest of stale) {
    const target = join(outDir, dest);
    if (!existsSync(target)) {
      continue;
    }
    const expectedDigest = prior?.ownedOutputDigests?.[dest];
    if (!expectedDigest || sha256(readText(target)) !== expectedDigest) {
      conflicts.push(`modified removed target ${dest}`);
    }
  }

  if (conflicts.length > 0) {
    return conflicts;
  }

  lock.ownership = Object.fromEntries([...desired].map(([dest, output]) => [dest, output.owner]));
  lock.ownedOutputDigests = Object.fromEntries(
    [...desired].map(([dest, output]) => [dest, sha256(output.contents)]),
  );
  const transactionOutputs = new Map<string, string | undefined>();
  const remember = (dest: string) => {
    if (!transactionOutputs.has(dest)) {
      const target = join(outDir, dest);
      transactionOutputs.set(dest, existsSync(target) ? readText(target) : undefined);
    }
  };
  const write = (dest: string, contents: string) => {
    remember(dest);
    writeText(join(outDir, dest), contents);
  };
  const remove = (dest: string) => {
    remember(dest);
    rmSync(join(outDir, dest), { force: true });
  };
  try {
    for (const dest of stale) {
      remove(dest);
    }
    for (const [dest, output] of desired) {
      write(dest, output.contents);
    }
    write("fw.lock.yaml", renderYaml(lock));
    remember(".fwyml/ownership.json");
    writeJson(join(outDir, ".fwyml", "ownership.json"), lock.ownership);
    remember(".fwyml/absent.json");
    writeJson(join(outDir, ".fwyml", "absent.json"), lock.absent);
  } catch (error) {
    for (const [dest, contents] of transactionOutputs) {
      const target = join(outDir, dest);
      if (contents === undefined) {
        rmSync(target, { force: true });
      } else {
        writeText(target, contents);
      }
    }
    throw error;
  }
  return conflicts;
}

export function leftoverOwned(outDir: string, lock: LockFile, generatedPrefixes: string[] = []): string[] {
  const leftovers: string[] = [];
  for (const rel of listFiles(outDir)) {
    if (rel.startsWith(".fwyml/") || rel === "fw.lock.yaml" || rel === "package.json" || rel === "go.mod") {
      continue;
    }
    if (generatedPrefixes.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`))) {
      continue;
    }
    if (!lock.ownership[rel] && (rel.endsWith(".go") || rel.startsWith("src/") || rel.startsWith("frontend/") || rel.startsWith("internal/"))) {
      leftovers.push(rel);
    }
  }
  return leftovers;
}
