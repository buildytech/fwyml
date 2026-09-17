import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { packageRoot } from "./io.js";
import type { LockFile, Manifest, Registry } from "./types.js";

const require = createRequire(import.meta.url);
const Ajv = require("ajv") as new (opts: object) => {
  compile(schema: object): ((value: unknown) => boolean) & { errors?: { instancePath: string; message?: string }[] | null };
};

const ajv = new Ajv({ allErrors: true, strict: false });
const validators = new Map<string, ((value: unknown) => boolean) & { errors?: { instancePath: string; message?: string }[] | null }>();

function loadSchema(name: string): object {
  return JSON.parse(readFileSync(join(packageRoot(), "schemas", name), "utf8")) as object;
}

function validate(name: string, value: unknown): string[] {
  let validate = validators.get(name);
  if (!validate) {
    validate = ajv.compile(loadSchema(name));
    validators.set(name, validate);
  }
  if (validate(value)) {
    return [];
  }
  return (validate.errors ?? []).map((err) => `${err.instancePath || "/"} ${err.message ?? "invalid"}`);
}

export function validateManifest(value: unknown): string[] {
  return validate("product-manifest.schema.json", value);
}

export function assertManifest(value: unknown): Manifest {
  const errors = validateManifest(value);
  if (errors.length > 0) {
    throw new Error(`manifest invalid:\n${errors.join("\n")}`);
  }
  return value as Manifest;
}

export function assertRegistry(value: unknown): Registry {
  const errors = validate("registry-envelope.schema.json", value);
  if (errors.length > 0) {
    throw new Error(`registry invalid:\n${errors.join("\n")}`);
  }
  return value as Registry;
}

export function assertLock(value: unknown): LockFile {
  const errors = validate("lock.schema.json", value);
  if (errors.length > 0) {
    throw new Error(`lock invalid:\n${errors.join("\n")}`);
  }
  return value as LockFile;
}
