const parse = (hex: string): number[] => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((ch) => ch + ch).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toHex = (rgb: number[]) =>
  '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/** Blend colour `a` toward `b`: t = 0 gives a, t = 1 gives b. */
export const mix = (a: string, b: string, t: number) => {
  const x = parse(a);
  const y = parse(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
};

/** #RRGGBB plus an alpha channel (0–1). */
export const withAlpha = (hex: string, alpha: number) =>
  toHex(parse(hex)) + Math.round(alpha * 255).toString(16).padStart(2, '0');
