/** Parse tsc and go vet locations; reject absolute and escaping paths. */
export function diagnosticLocation(text: string): {path: string; line: number; column: number} | null {
  const match = /^(.*?)\((\d+),(\d+)\):/.exec(text) ?? /^(.*?):(\d+)(?::(\d+))?:/.exec(text);
  if (!match) return null;
  const path = match[1].replaceAll("\\", "/").replace(/^\.\//, "");
  if (!path || path.startsWith("/") || path.includes(":") || path.split("/").includes("..")) return null;
  const line = Number(match[2]), column = Number(match[3] ?? 1);
  return line > 0 && column > 0 ? {path, line, column} : null;
}
