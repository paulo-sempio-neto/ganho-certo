export type OdometerCell = {
  key: string;
  char: string;
  /** The digit shown by a rolling column, or null for static characters. */
  digit: number | null;
};

/**
 * Splits a formatted value into odometer cells keyed from the right, so the
 * units column keeps its identity (and keeps rolling) when the value gains or
 * loses digits on the left.
 */
export function toOdometerCells(value: string): OdometerCell[] {
  const chars = [...value];
  return chars.map((char, index) => {
    const fromRight = chars.length - index;
    const digit = /\d/.test(char) ? Number(char) : null;
    return { key: digit === null ? `s${fromRight}${char}` : `d${fromRight}`, char, digit };
  });
}
