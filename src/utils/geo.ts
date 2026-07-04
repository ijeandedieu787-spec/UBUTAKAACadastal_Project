export function svgToLatLng(pt: [number, number]): [number, number] {
  const [x, y] = pt;
  const lat = -1.95420 + (y - 250) * 0.000012;
  const lon = 30.08940 + (x - 400) * 0.000012;
  return [lat, lon];
}

export function latLngToSvg(latLng: [number, number]): [number, number] {
  const [lat, lon] = latLng;
  const y = (lat + 1.95420) / 0.000012 + 250;
  const x = (lon - 30.08940) / 0.000012 + 400;
  return [Math.round(x), Math.round(y)];
}
