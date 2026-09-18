export function tabTitle(path: string, openPaths: string[], label = ""): string {
  if (label) return label;
  const base = path.split(/[/\\]/).pop() || path;
  const clash = openPaths.filter((item) => (item.split(/[/\\]/).pop() || item) === base).length > 1;
  if (!clash) return base;
  const parts = path.split(/[/\\]/).filter(Boolean);
  if (parts.length >= 2) return `${parts[parts.length - 2]}/${base}`;
  return path;
}

export function breadcrumbParts(path: string): string[] {
  return path.split(/[/\\]/).filter(Boolean);
}
