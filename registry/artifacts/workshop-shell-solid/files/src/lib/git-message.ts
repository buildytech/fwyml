export function gitPanelError(raw: string, labels: { identity: string; noRepo: string; auth: string }): string {
  const text = raw.trim();
  if (!text) return "";
  if (text.includes("identity:") || /author identity unknown|please tell me who you are/i.test(text)) {
    return labels.identity;
  }
  if (text.includes("no-repo:") || /not a git repository/i.test(text)) return labels.noRepo;
  if (text.includes("auth:")) return labels.auth;
  return text.replace(/^(identity|no-repo|auth):\s*/i, "");
}
