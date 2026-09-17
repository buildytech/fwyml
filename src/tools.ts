import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
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
    const bin = tool.argv[0];
    if (!bin || !executableOnPath(bin)) {
      diagnostics.push({
        code: "FWYML_UNVERIFIED_ARTIFACT",
        severity: "warning",
        message: `tool ${tool.id} skipped; ${bin} is not on PATH`,
        id: tool.id,
      });
      continue;
    }
    if (bin === "npx" && tool.argv[1] && !existsSync(join(cwd, "node_modules", tool.argv[1]))) {
      diagnostics.push({
        code: "FWYML_UNVERIFIED_ARTIFACT",
        severity: "warning",
        message: `tool ${tool.id} skipped; package is not installed`,
        id: tool.id,
      });
      continue;
    }
    const result = spawnSync(tool.argv[0], tool.argv.slice(1), { cwd, encoding: "utf8" });
    runs.push({
      id: tool.id,
      argv: tool.argv,
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    });
    if (result.status !== 0) {
      diagnostics.push({
        code: "FWYML_TOOL_FAILED",
        severity: "error",
        message: `tool ${tool.id} exited ${result.status}`,
        id: tool.id,
      });
    }
  }
  return { runs, diagnostics };
}
