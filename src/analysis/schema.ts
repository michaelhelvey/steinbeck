import { z } from "zod";

/**
 * The kinds of issue that the analysis engine reports.
 *
 * @example
 * ```ts
 * IssueKind.parse("adverb"); // "adverb"
 * ```
 */
export const IssueKind = z.enum([
  "veryHard",
  "hard",
  "adverb",
  "passive",
  "wordy",
  "spelling",
  "grammar",
]);

/** One issue kind. */
export type IssueKind = z.infer<typeof IssueKind>;

/**
 * A change that the user can apply to correct an issue. Offsets are UTF-16 code units, the same
 * unit as CodeMirror positions.
 *
 * @example
 * ```ts
 * Fix.parse({ label: "cut", from: 2, to: 9, insert: "" });
 * ```
 */
export const Fix = z.object({
  label: z.string(),
  from: z.number().int().nonnegative(),
  to: z.number().int().nonnegative(),
  insert: z.string(),
});

/** One fix. */
export type Fix = z.infer<typeof Fix>;

/**
 * One problem in the document. `from` and `to` are UTF-16 code unit offsets into the full text.
 *
 * @example
 * ```ts
 * Issue.parse({ id: "a1", kind: "adverb", from: 2, to: 8, message: "Adverb.", fixes: [] });
 * ```
 */
export const Issue = z.object({
  id: z.string(),
  kind: IssueKind,
  from: z.number().int().nonnegative(),
  to: z.number().int().nonnegative(),
  message: z.string(),
  fixes: z.array(Fix),
});

/** One issue. */
export type Issue = z.infer<typeof Issue>;

/**
 * Document statistics. The engine calculates them on prose only, except `characters`, which
 * counts the full document.
 *
 * @example
 * ```ts
 * Stats.parse({ words: 0, characters: 0, sentences: 0, readingMinutes: 0, ari: 0,
 *   fleschKincaid: 0, colemanLiau: 0, wordsPerSentence: 0 });
 * ```
 */
export const Stats = z.object({
  words: z.number(),
  characters: z.number(),
  sentences: z.number(),
  readingMinutes: z.number(),
  ari: z.number(),
  fleschKincaid: z.number(),
  colemanLiau: z.number(),
  wordsPerSentence: z.number(),
});

/** Document statistics. */
export type Stats = z.infer<typeof Stats>;

/**
 * The result of one analysis run.
 *
 * @example
 * ```ts
 * const analysis = Analysis.parse(await invoke("analyze", { text }));
 * ```
 */
export const Analysis = z.object({
  stats: Stats,
  issues: z.array(Issue),
});

/** The result of one analysis run. */
export type Analysis = z.infer<typeof Analysis>;

/** Statistics for an empty document. */
export const EMPTY_STATS: Stats = {
  words: 0,
  characters: 0,
  sentences: 0,
  readingMinutes: 0,
  ari: 0,
  fleschKincaid: 0,
  colemanLiau: 0,
  wordsPerSentence: 0,
};
