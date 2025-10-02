/**
 * Shuffles an array in place using the Fisher–Yates (Knuth) algorithm.
 *
 * Time complexity: O(n). Space complexity: O(1) additional memory.
 *
 * @template T - Type of elements in the array.
 * @param arr - The array to shuffle in place.
 * @returns The same array instance with its elements shuffled.
 *
 * @example
 * const nums = [1, 2, 3, 4];
 * shuffle(nums); // nums might become [3, 1, 4, 2]
 */
export function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
