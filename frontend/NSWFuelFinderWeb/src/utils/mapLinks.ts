export type MapLinks = {
  appleMaps?: string;
  googleMaps?: string;
  waze?: string;
};

export type MapLinkInput = {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  label?: string | null;
};

export function buildMapLinks(input: MapLinkInput): MapLinks {
  const { latitude, longitude, address, label } = input;
  const hasCoords = isFiniteNumber(latitude) && isFiniteNumber(longitude);
  const coords = hasCoords ? `${latitude!.toFixed(6)},${longitude!.toFixed(6)}` : undefined;
  if (!coords) {
    return {};
  }

  const printable = label ?? address ?? "";
  const encodedPrintable = printable ? encodeURIComponent(printable) : "";

  const appleMaps = `https://maps.apple.com/?ll=${coords}&q=${encodedPrintable || coords}`;

  const googleMaps = `https://www.google.com/maps/search/?api=1&query=${coords}`;

  const waze = `https://waze.com/ul?ll=${coords}&navigate=yes`;

  return { appleMaps, googleMaps, waze };
}

const isFiniteNumber = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);
