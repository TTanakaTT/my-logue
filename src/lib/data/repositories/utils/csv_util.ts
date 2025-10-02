/**
 * Parse a simple CSV string into a two-dimensional array of fields.
 *
 * This utility:
 * - Ignores empty lines and lines beginning with `#` (treated as comments).
 * - Trims whitespace from each resulting field.
 * - Consecutive commas produce empty string fields (e.g. `"a,,c"` => `["a", "", "c"]`).
 *
 * @param csvRaw - The raw CSV text to parse.
 * @returns A 2D array where each inner array represents the columns of a non-empty,
 *          non-comment line in the same order as they appeared in the input.
 *
 * @example
 * const csv = "name,age,city\n# ignore this\nAlice,30,London\n Bob , 25 , Tokyo ";
 * // returns: [["name","age","city"], ["Alice","30","London"], ["Bob","25","Tokyo"]]
 */
export function parseCsv(csvRaw: string): string[][] {
  return csvRaw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((line) => line.split(',').map((s) => s.trim()));
}
