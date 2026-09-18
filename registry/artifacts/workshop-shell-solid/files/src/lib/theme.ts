export type Theme = "system" | "light" | "dark";
export type Palette = "default" | "hinddy";

export const themeKey = "app-theme";

export function readTheme(): Theme {
  const value = localStorage.getItem(themeKey);
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export function applyTheme(theme: Theme, palette: Palette = "default"): void {
  const dark =
    theme === "dark" ||
    (theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.palette = palette;
}

export function applyUiZoom(zoom: number): void {
  document.documentElement.style.removeProperty("zoom");
  document.documentElement.dataset.uiZoom = String(zoom);
  document.documentElement.style.setProperty("--editor-zoom", String(zoom / 100));
}

export function cycleTheme(theme: Theme): Theme {
  return theme === "system" ? "light" : theme === "light" ? "dark" : "system";
}

export function themeLabel(
  theme: Theme,
  labels: { system: string; light: string; dark: string },
): string {
  if (theme === "light") return labels.light;
  if (theme === "dark") return labels.dark;
  return labels.system;
}
