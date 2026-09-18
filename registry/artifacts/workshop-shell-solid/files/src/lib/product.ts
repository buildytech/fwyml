/** FW-owned product profile stub — full ide ProductProfile bindings not selected. */
export type ProductProfileView = { id: string; features: string[]; languages: string[] };

export const defaultProduct: ProductProfileView = {
  id: "ide",
  features: ["terminal", "git", "agents", "languages"],
  languages: ["go", "typescript", "javascript", "markdown"],
};

export function hasFeature(profile: ProductProfileView, feature: string): boolean {
  return profile.features.includes(feature);
}

export async function loadProduct(): Promise<ProductProfileView> {
  const id = new URLSearchParams(location.search).get("product") ?? "ide";
  if (id === "agent") {
    return { id: "agent", features: ["terminal", "agents"], languages: [] };
  }
  return defaultProduct;
}
