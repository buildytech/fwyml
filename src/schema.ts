import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { packageRoot } from "./io.js";
import type { Manifest } from "./types.js";

const require = createRequire(import.meta.url);
const Ajv = require("ajv") as new (opts: object) => {
  compile(schema: object): ((value: unknown) => boolean) & { errors?: { instancePath: string; message?: string }[] | null };
};

const ajv = new Ajv({ allErrors: true, strict: false });

function loadSchema(name: string): object {
  return JSON.parse(readFileSync(join(packageRoot(), "schemas", name), "utf8")) as object;
}

export function validateManifest(value: unknown): string[] {
  const validate = ajv.compile(loadSchema("product-manifest.schema.json"));
  if (validate(value)) {
    return [];
  }
  return (validate.errors ?? []).map((err) => `${err.instancePath || "/"} ${err.message ?? "invalid"}`);
}

export function assertManifest(value: unknown): Manifest {
  const errors = validateManifest(value);
  if (errors.length > 0) {
    throw new Error(`manifest invalid:\n${errors.join("\n")}`);
  }
  return value as Manifest;
}
