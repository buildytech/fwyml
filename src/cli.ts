#!/usr/bin/env node
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { contextPack } from "./context.js";
import { EXIT_FAIL, EXIT_LOCK, EXIT_OK, EXIT_USAGE, EXIT_VERIFY } from "./exit.js";
import { readYaml, writeYaml } from "./io.js";
import { materialize } from "./materialize.js";
import { loadRegistries, RegistryError } from "./registry.js";
import { hasError, resolveGraph, toLock } from "./resolve.js";
import { assertLock, assertManifest, validateManifest } from "./schema.js";
import type { LockFile, Manifest } from "./types.js";
import { runSelectedTools } from "./tools.js";
import { verifyPersistedLock, verifyTree } from "./verify.js";
import { VERSION } from "./version.js";

type Flags = {
  json: boolean;
  dryRun: boolean;
  strict: boolean;
  manifest?: string;
  registry?: string;
  out?: string;
};

function parseArgs(argv: string[]): { command?: string; flags: Flags } {
  const flags: Flags = { json: false, dryRun: false, strict: false };
  let command: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--version" || arg === "-v") {
      return { command: "version", flags };
    }
    if (arg === "--help" || arg === "-h") {
      return { command: "help", flags };
    }
    if (arg === "--json") {
      flags.json = true;
      continue;
    }
    if (arg === "--dry-run") {
      flags.dryRun = true;
      continue;
    }
    if (arg === "--strict") {
      flags.strict = true;
      continue;
    }
    if (arg === "--manifest") {
      flags.manifest = argv[++i];
      continue;
    }
    if (arg === "--registry") {
      flags.registry = argv[++i];
      continue;
    }
    if (arg === "--out") {
      flags.out = argv[++i];
      continue;
    }
    if (!arg.startsWith("-") && !command) {
      command = arg;
      continue;
    }
    throw new Error(`unknown argument ${arg}`);
  }
  return { command, flags };
}

function usage(): string {
  return `fwyml ${VERSION}

Commands:
  validate [--manifest fw.yaml]
  resolve  [--manifest fw.yaml] [--registry <path>]
  sync     [--dry-run] [--out <dir>]
  verify   [--strict] [--out <dir>]
  generate [--out <dir>]
  context  [--out <dir>]

Exit codes: 0 ok, 1 fail, 2 verify, 3 lock, 64 usage
`;
}

function loadManifest(path: string): Manifest {
  return assertManifest(readYaml(path));
}

function locateManifest(flags: Flags): string {
  const path = resolve(flags.manifest ?? "fw.yaml");
  if (!existsSync(path)) {
    throw new Error(`manifest not found: ${path}`);
  }
  return path;
}

function compile(flags: Flags) {
  const manifestPath = locateManifest(flags);
  const manifest = loadManifest(manifestPath);
  const loaded = loadRegistries({
    manifestSources: manifest.registries,
    cliRegistry: flags.registry,
  });
  const resolution = resolveGraph(manifest, loaded);
  const lock = toLock(resolution, manifest, loaded.snapshotId, loaded.snapshotDigest);
  return { manifest, resolution, lock };
}

function hasBlockingResolutionError(diagnostics: ReturnType<typeof resolveGraph>["diagnostics"]): boolean {
  return hasError(diagnostics, [
    "FWYML_CONTRACT_INCOMPATIBLE",
    "FWYML_ABSENCE_VIOLATION",
    "FWYML_DEPENDENCY_CONFLICT",
  ]);
}

function emit(flags: Flags, payload: unknown, text: string): void {
  if (flags.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }
  process.stdout.write(text);
}

function main(): number {
  let parsed: { command?: string; flags: Flags };
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    return EXIT_USAGE;
  }
  const { command, flags } = parsed;
  if (!command || command === "help") {
    process.stdout.write(usage());
    return command ? EXIT_OK : EXIT_USAGE;
  }
  if (command === "version") {
    emit(flags, { version: VERSION }, `${VERSION}\n`);
    return EXIT_OK;
  }

  try {
    if (command === "validate") {
      const path = resolve(flags.manifest ?? "fw.yaml");
      const errors = existsSync(path) ? validateManifest(readYaml(path)) : [`manifest not found: ${path}`];
      emit(flags, { ok: errors.length === 0, errors }, errors.length === 0 ? "ok\n" : `${errors.join("\n")}\n`);
      return errors.length === 0 ? EXIT_OK : EXIT_FAIL;
    }

    const compiled = compile(flags);
    const outDir = resolve(flags.out ?? ".");

    if (command === "resolve") {
      emit(
        flags,
        compiled,
        `${compiled.resolution.product} nodes=${compiled.resolution.nodes.length} absent=${compiled.resolution.absent.join(",")}\n`,
      );
      return hasBlockingResolutionError(compiled.resolution.diagnostics) ? EXIT_FAIL : EXIT_OK;
    }

    if (command === "sync") {
      const payload = { plan: compiled.resolution.plan, lock: compiled.lock, dryRun: flags.dryRun };
      if (flags.dryRun) {
        emit(flags, payload, `dry-run files=${compiled.resolution.plan.files.length}\n`);
        return EXIT_OK;
      }
      if (hasBlockingResolutionError(compiled.resolution.diagnostics)) {
        emit(flags, payload, "sync refused because the composition is invalid\n");
        return EXIT_FAIL;
      }
      const prior = existsSync(resolve(outDir, "fw.lock.yaml"))
        ? assertLock(readYaml<LockFile>(resolve(outDir, "fw.lock.yaml")))
        : undefined;
      const conflicts = materialize(outDir, compiled.resolution, compiled.lock, prior, compiled.manifest);
      if (conflicts.length > 0) {
        emit(flags, { conflicts }, `owned file conflicts:\n${conflicts.join("\n")}\n`);
        return EXIT_LOCK;
      }
      emit(flags, payload, `synced ${outDir}\n`);
      return EXIT_OK;
    }

    if (command === "generate") {
      const lockDiagnostics = verifyPersistedLock(outDir, compiled.lock);
      if (lockDiagnostics.some((item) => item.severity === "error")) {
        emit(flags, { diagnostics: lockDiagnostics, ok: false }, `${lockDiagnostics.map((item) => item.code).join("\n")}\n`);
        return EXIT_VERIFY;
      }
      const tools = runSelectedTools(compiled.resolution, outDir, "generate");
      const errors = tools.diagnostics.filter((item) => item.severity === "error");
      emit(
        flags,
        { runs: tools.runs, diagnostics: tools.diagnostics, ok: errors.length === 0 },
        errors.length === 0 ? `generated tools=${tools.runs.length}\n` : `${errors.map((item) => item.code).join("\n")}\n`,
      );
      return errors.length === 0 ? EXIT_OK : EXIT_VERIFY;
    }

    if (command === "context") {
      const pack = contextPack(compiled.manifest, compiled.resolution, compiled.lock);
      if (!flags.json) {
        writeYaml(resolve(outDir, ".fwyml", "context.yaml"), pack);
      }
      emit(flags, pack, `context ${pack.product} selected=${pack.selected.length} absent=${pack.absent.length}\n`);
      return EXIT_OK;
    }

    if (command === "verify") {
      const diagnostics = [
        ...verifyPersistedLock(outDir, compiled.lock),
        ...verifyTree({
        outDir,
        manifest: compiled.manifest,
        resolution: compiled.resolution,
        lock: compiled.lock,
        strict: flags.strict,
        }),
      ];
      const canRunTools = !diagnostics.some((item) => item.severity === "error");
      const tools = canRunTools
        ? runSelectedTools(compiled.resolution, outDir, "verify")
        : { runs: [], diagnostics: [] };
      diagnostics.push(...tools.diagnostics);
      const errors = diagnostics.filter((item) => item.severity === "error");
      emit(
        flags,
        { diagnostics, runs: tools.runs, ok: errors.length === 0 },
        errors.length === 0 ? "ok\n" : `${errors.map((item) => item.code).join("\n")}\n`,
      );
      return errors.length === 0 ? EXIT_OK : EXIT_VERIFY;
    }

    process.stderr.write(`unknown command ${command}\n${usage()}`);
    return EXIT_USAGE;
  } catch (error) {
    if (error instanceof RegistryError) {
      const diagnostics = [{ code: error.code, severity: "error", message: error.message }];
      emit(flags, { diagnostics, ok: false }, `${error.code}: ${error.message}\n`);
      return EXIT_FAIL;
    }
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    return EXIT_FAIL;
  }
}

process.exit(main());
