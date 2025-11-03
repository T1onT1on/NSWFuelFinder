// src/utils/fuelColors.ts
// ----------------------------------------------------
// Color & order definitions for all supported fuel types
// ----------------------------------------------------

/** Mapping from fuel type → color (used for chips, charts, etc.) */
export const fuelColorMap: Record<string, string> = {
  E10: "#2ecc71", // green
  U91: "#5bc0de", // blue
  P95: "#303f9f", // indigo
  P98: "#ff4d4f", // red
  DL: "#fadb14",  // yellow
  PDL: "#fadb14", // yellow (premium diesel)
};

/** Display order for fuel types (used for sorting) */
export const fuelDisplayOrder = ["E10", "U91", "P95", "P98", "DL", "PDL"];

/** Internal numeric position map for sorting */
const fuelPosition: Record<string, number> = fuelDisplayOrder.reduce((acc, fuel, index) => {
  acc[fuel] = index;
  return acc;
}, {} as Record<string, number>);

/** Get hex color for a fuel type (fallback = gray) */
export const getFuelColor = (fuelType: string): string => {
  const key = fuelType?.toUpperCase?.() ?? "";
  return fuelColorMap[key] ?? "#d9d9d9";
};

/** Compare two fuel types based on display order */
export const compareFuelTypes = (a: string, b: string) => {
  const aKey = a?.toUpperCase?.() ?? "";
  const bKey = b?.toUpperCase?.() ?? "";
  const aPos = fuelPosition[aKey];
  const bPos = fuelPosition[bKey];

  const aValid = typeof aPos === "number";
  const bValid = typeof bPos === "number";

  if (aValid && bValid) return aPos - bPos;
  if (aValid) return -1;
  if (bValid) return 1;
  return aKey.localeCompare(bKey);
};
