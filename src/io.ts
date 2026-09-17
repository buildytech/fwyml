import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export function readText(path: string): string {
  return readFileSync(path, "utf8");
}

export function readYaml<T>(path: string): T {
  return parseYaml(readText(path)) as T;
}

export function writeYaml(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, renderYaml(value));
}

export function renderYaml(value: unknown): string {
  return stringifyYaml(value, { lineWidth: 0 });
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeText(path: string, value: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}

export function sha256(value: string | Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortValue(child)]),
    );
  }
  return value;
}

export function semanticDigest(value: unknown): string {
  return sha256(JSON.stringify(sortValue(value)));
}

export function fileDigest(path: string): string {
  return sha256(readFileSync(path));
}

export function expandVars(input: string, vars: Record<string, string>): string {
  return input.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, key: string) => vars[key] ?? "");
}

export function listFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }
  const out: string[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      if (statSync(full).isDirectory()) {
        walk(full, rel);
      } else {
        out.push(rel.replaceAll("\\", "/"));
      }
    }
  };
  walk(root, "");
  return out.sort();
}

export function packageRoot(from = import.meta.dirname): string {
  let dir = resolve(from);
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, "package.json")) && existsSync(join(dir, "schemas"))) {
      return dir;
    }
    dir = dirname(dir);
  }
  return resolve(from, "..");
}
