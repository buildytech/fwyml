import type { MaterializePlan } from "./types.js";

// Shared by lock planning and materialization: an unselected ecosystem emits nothing.
export function synthesizedOutputs(plan: MaterializePlan): string[] {
  const owned = new Set([...plan.files, ...plan.guidance].map((file) => file.dest));
  const outputs: string[] = [];
  if (!owned.has("package.json") && [plan.npm, plan.npmDev, plan.scripts].some((value) => Object.keys(value).length)) {
    outputs.push("package.json");
  }
  if (!owned.has("go.mod") && plan.go.module && plan.go.version) {
    outputs.push("go.mod");
  }
  return outputs;
}
