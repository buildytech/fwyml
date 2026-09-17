import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { isAbsolute, join, resolve } from "node:path";
import type { Diagnostic, Resolution } from "./types.js";

export type ToolRun = {
  id: string;
  argv: string[];
  status: number | null;
  stdout: string;
  stderr: string;
};

function executableOnPath(name: string): boolean {
  const result = spawnSync(process.platform === "win32" ? "where" : "which", [name], {
    encoding: "utf8",
  });
  return result.status === 0;
}

function run(
  id: string,
  argv: string[],
  cwd: string,
  runs: ToolRun[],
  diagnostics: Diagnostic[],
): boolean {
  const bin = argv[0];
  if (!bin || !executableOnPath(bin)) {
    diagnostics.push({
      code: "FWYML_UNVERIFIED_ARTIFACT",
      severity: "warning",
      message: `tool ${id} skipped; ${bin} is not on PATH`,
      id,
    });
    return false;
  }
  if (bin === "npx" && argv[1] && !existsSync(join(cwd, "node_modules", argv[1]))) {
    diagnostics.push({
      code: "FWYML_UNVERIFIED_ARTIFACT",
      severity: "warning",
      message: `tool ${id} skipped; package is not installed`,
      id,
    });
    return false;
  }
  const result = spawnSync(bin, argv.slice(1), { cwd, encoding: "utf8" });
  runs.push({ id, argv, status: result.status, stdout: result.stdout, stderr: result.stderr });
  if (result.status !== 0) {
    diagnostics.push({
      code: "FWYML_TOOL_FAILED",
      severity: "error",
      message: `tool ${id} exited ${result.status}`,
      id,
    });
    return false;
  }
  return true;
}

export function runSelectedTools(
  resolution: Resolution,
  cwd: string,
  phase = "verify",
): { runs: ToolRun[]; diagnostics: Diagnostic[] } {
  const runs: ToolRun[] = [];
  const diagnostics: Diagnostic[] = [];
  for (const tool of resolution.plan.tools) {
    if ((tool.phase ?? "verify") !== phase) {
      continue;
    }
    const toolCwd = tool.cwd ? (isAbsolute(tool.cwd) ? tool.cwd : resolve(cwd, tool.cwd)) : cwd;
    if (!existsSync(toolCwd)) {
      diagnostics.push({
        code: "FWYML_TOOL_FAILED",
        severity: "error",
        message: `tool ${tool.id} working directory does not exist: ${toolCwd}`,
        id: tool.id,
      });
      continue;
    }
    if (tool.prepare && !run(`${tool.id}:prepare`, tool.prepare, toolCwd, runs, diagnostics)) {
      continue;
    }
    run(tool.id, tool.argv, toolCwd, runs, diagnostics);
  }
  return { runs, diagnostics };
}
