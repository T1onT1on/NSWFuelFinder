export const fuelColorMap: Record<string, string> = {
  E10: '#2ecc71',
  U91: '#5bc0de',
  P95: '#303f9f',
  P98: '#ff4d4f',
  DL: '#fadb14',
  PDL: '#fadb14',
};

export const fuelDisplayOrder = ["E10", "U91", "P95", "P98", "DL", "PDL"];

const fuelPosition: Record<string, number> = fuelDisplayOrder.reduce((acc, fuel, index) => {
  acc[fuel] = index;
  return acc;
}, {} as Record<string, number>);

export const getFuelColor = (fuelType: string): string => {
  const key = fuelType?.toUpperCase?.() ?? '';
  return fuelColorMap[key] ?? '#d9d9d9';
};

export const compareFuelTypes = (a: string, b: string) => {
  const aKey = a?.toUpperCase?.() ?? '';
  const bKey = b?.toUpperCase?.() ?? '';
  const aPos = fuelPosition[aKey];
  const bPos = fuelPosition[bKey];

  const aValid = typeof aPos === 'number';
  const bValid = typeof bPos === 'number';

  if (aValid && bValid) {
    return aPos - bPos;
  }
  if (aValid) {
    return -1;
  }
  if (bValid) {
    return 1;
  }
  return aKey.localeCompare(bKey);
};
