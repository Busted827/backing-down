export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function wrapAngle(a: number) {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function feet(meters: number) {
  return Math.max(0, Math.round(meters * 3.28084));
}

export function cssHex(color: number) {
  return `#${color.toString(16).padStart(6, "0")}`;
}
