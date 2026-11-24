/** How readable a grade is, compared with the user's target grade. */
export type GradeBand = "good" | "ok" | "dense";

/** The default target grade. Newspapers aim for about grade 8. */
export const DEFAULT_TARGET = 8;

/** The number of cells in the grade meter. The last cell means "this grade or higher". */
export const METER_CELLS = 16;

/**
 * Converts an ARI score to the whole grade that the UI shows. Negative scores (very short or
 * empty text) become grade 0.
 *
 * @example
 * ```ts
 * displayGrade(8.6); // 9
 * displayGrade(-3); // 0
 * ```
 */
export function displayGrade(ari: number): number {
  return Math.max(0, Math.round(ari));
}

/**
 * Puts a grade in a band. A grade at or below the target is good. Up to three grades above the
 * target is ok. More than that is dense.
 *
 * @example
 * ```ts
 * gradeBand(9, 8); // "ok"
 * ```
 */
export function gradeBand(grade: number, target: number): GradeBand {
  if (grade <= target) return "good";
  if (grade <= target + 3) return "ok";
  return "dense";
}

/** One cell of the grade meter. */
export type MeterCell = "filled" | "empty" | "target" | "targetFilled";

/**
 * Builds the grade meter: one cell per grade from 1 to {@link METER_CELLS}. Cells at or below the
 * grade are filled. The target cell is marked.
 *
 * @example
 * ```ts
 * meterCells(2, 3).slice(0, 4); // ["filled", "filled", "target", "empty"]
 * ```
 */
export function meterCells(grade: number, target: number): MeterCell[] {
  return Array.from({ length: METER_CELLS }, (_, index) => {
    const cell = index + 1;
    const filled = cell <= grade;
    if (cell === target) return filled ? "targetFilled" : "target";
    return filled ? "filled" : "empty";
  });
}
