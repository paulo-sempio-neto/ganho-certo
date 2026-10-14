/** Wraps a value into [min, max), so a duplicated track can loop without a visible seam. */
export function wrap(min: number, max: number, value: number): number {
  const range = max - min;
  return ((((value - min) % range) + range) % range) + min;
}
