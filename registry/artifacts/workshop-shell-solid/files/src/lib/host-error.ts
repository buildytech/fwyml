export type HostFaultCode =
  | "missing"
  | "too-large"
  | "utf8"
  | "read-only"
  | "permission"
  | "no-workspace"
  | "conflict"
  | "tool-missing"
  | "cancelled"
  | "unknown";

export type HostFault = {
  code: HostFaultCode;
  operation: string;
  path?: string;
  message: string;
  details?: string;
};

export function classifyHostError(error: unknown, operation: string, path?: string): HostFault {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const prefix = raw.match(/^([a-z-]+):\s*(.*)$/s);
  const codePart = prefix?.[1] ?? "";
  const rest = prefix?.[2] ?? raw;
  const lower = raw.toLowerCase();
  let code: HostFaultCode = "unknown";
  if (isCode(codePart)) code = codePart;
  else if (lower.includes("no workspace") || lower.includes("no workspace folder")) code = "no-workspace";
  else if (lower.includes("exceeds 1 mib") || lower.includes("too large")) code = "too-large";
  else if (lower.includes("utf-8") || lower.includes("utf8")) code = "utf8";
  else if (lower.includes("read-only") || lower.includes("erofs") || lower.includes("access is denied")) code = "read-only";
  else if (lower.includes("permission") || lower.includes("eacces") || lower.includes("eperm")) code = "permission";
  else if (lower.includes("not exist") || lower.includes("no such file") || lower.includes("file is gone")) code = "missing";
  else if (lower.includes("conflict")) code = "conflict";
  else if (lower.includes("not connected") || lower.includes("command not found") || lower.includes("tool missing")) code = "tool-missing";
  else if (lower.includes("cancel")) code = "cancelled";
  return { code, operation, ...(path ? { path } : {}), message: rest || raw, details: raw };
}

function isCode(value: string): value is HostFaultCode {
  return (
    value === "missing" ||
    value === "too-large" ||
    value === "utf8" ||
    value === "read-only" ||
    value === "permission" ||
    value === "no-workspace" ||
    value === "conflict" ||
    value === "tool-missing" ||
    value === "cancelled" ||
    value === "unknown"
  );
}

export function faultStatus(fault: HostFault, labels: Record<HostFaultCode, string>): string {
  const target = fault.path ? `${labels[fault.code]} ${fault.path}` : labels[fault.code];
  return `${fault.operation}: ${target}`;
}
