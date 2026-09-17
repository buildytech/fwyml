import { existsSync } from "node:fs";
import { join } from "node:path";
import { listFiles, readText, writeJson, writeText, writeYaml } from "./io.js";
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
  const writeOwned = (dest: string, contents: string) => {
    const target = join(outDir, dest);
    if (prior?.ownership[dest] && existsSync(target) && readText(target) !== contents) {
      conflicts.push(dest);
      return;
    }
    writeText(target, contents);
    lock.ownership[dest] = "fwyml";
  };

  for (const file of [...resolution.plan.files, ...resolution.plan.guidance]) {
    if (!existsSync(file.from)) {
      continue;
    }
    const contents = readText(file.from);
    if (prior?.ownership[file.dest] && existsSync(join(outDir, file.dest))) {
      const existing = readText(join(outDir, file.dest));
      if (existing !== contents) {
        conflicts.push(file.dest);
        continue;
      }
    }
    writeText(join(outDir, file.dest), contents);
  }

  writeOwned("package.json", renderPackageJson(resolution.plan, resolution.product));
  if (!lock.ownership["go.mod"] || lock.ownership["go.mod"] === "fwyml") {
    const fromTemplate = resolution.plan.files.find((file) => file.dest === "go.mod");
    if (!fromTemplate) {
      writeOwned("go.mod", renderGoMod(resolution.plan, resolution.product));
    }
  }
  writeOwned("compose/identity.go", renderIdentity(resolution.product));
  if (manifest) {
    writeYaml(join(outDir, "fw.yaml"), manifest);
    lock.ownership["fw.yaml"] = "fwyml";
  }
  writeYaml(join(outDir, "fw.lock.yaml"), lock);
  writeJson(join(outDir, ".fwyml", "ownership.json"), lock.ownership);
  writeJson(join(outDir, ".fwyml", "absent.json"), lock.absent);
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
