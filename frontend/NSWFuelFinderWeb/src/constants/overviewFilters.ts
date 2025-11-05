import type { BrandShortcutOption } from "../components/ui/BrandShortcutButtons";

export const OVERVIEW_BRAND_SHORTCUT_ALL_ID = "all";

export const OVERVIEW_BRAND_SHORTCUTS: Array<BrandShortcutOption & { brands: string[] }> = [
  { id: "bp-shell", label: "BP & Shell", brands: ["BP", "Shell"], color: "primary" },
  { id: "711-ampol", label: "7-Eleven & Ampol", brands: ["7-Eleven", "Ampol"], color: "primary" },
  { id: OVERVIEW_BRAND_SHORTCUT_ALL_ID, label: "All Brands", brands: [], color: "secondary" },
];

export const DEFAULT_OVERVIEW_BRAND_SHORTCUT_IDS = ["bp-shell", "711-ampol"];

export const DEFAULT_OVERVIEW_RADIUS_KM = 5;
