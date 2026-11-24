import type { Issue, IssueKind } from "./schema.ts";

/** A sidebar group of issue kinds. */
export type KindGroup = "sentences" | "style" | "correctness";

/** Display data for one issue kind. */
export interface KindInfo {
  readonly kind: IssueKind;
  readonly label: string;
  readonly title: string;
  readonly group: KindGroup;
  readonly color: string;
}

/**
 * Display data for every issue kind, in sidebar order.
 *
 * @example
 * ```ts
 * KINDS.filter((k) => k.group === "style").map((k) => k.label); // ["adverbs", ...]
 * ```
 */
export const KINDS: readonly KindInfo[] = [
  {
    kind: "veryHard",
    label: "very hard",
    title: "Very hard sentence",
    group: "sentences",
    color: "var(--color-spelling)",
  },
  {
    kind: "hard",
    label: "hard",
    title: "Hard sentence",
    group: "sentences",
    color: "var(--color-accent)",
  },
  {
    kind: "adverb",
    label: "adverbs",
    title: "Adverb",
    group: "style",
    color: "var(--color-adverb)",
  },
  {
    kind: "passive",
    label: "passive voice",
    title: "Passive voice",
    group: "style",
    color: "var(--color-passive)",
  },
  {
    kind: "wordy",
    label: "wordy / filler",
    title: "Wordy",
    group: "style",
    color: "var(--color-wordy)",
  },
  {
    kind: "spelling",
    label: "spelling",
    title: "Spelling",
    group: "correctness",
    color: "var(--color-spelling)",
  },
  {
    kind: "grammar",
    label: "grammar",
    title: "Grammar",
    group: "correctness",
    color: "var(--color-grammar)",
  },
];

/** The sidebar groups, in order. */
export const GROUPS: readonly KindGroup[] = ["sentences", "style", "correctness"];

/**
 * Finds the display data for a kind.
 *
 * @example
 * ```ts
 * kindInfo("adverb").title; // "Adverb"
 * ```
 */
export function kindInfo(kind: IssueKind): KindInfo {
  const info = KINDS.find((k) => k.kind === kind);
  if (!info) throw new Error(`no display data for issue kind '${kind}'`);
  return info;
}

const ERROR_KINDS: ReadonlySet<IssueKind> = new Set(["spelling", "grammar"]);

/** Issue totals for the statusline. */
export interface IssueTotals {
  readonly errors: number;
  readonly warnings: number;
  readonly byKind: Readonly<Record<IssueKind, number>>;
}

/**
 * Counts issues per kind. Spelling and grammar are errors. All other kinds are warnings.
 *
 * @example
 * ```ts
 * countIssues(analysis.issues).byKind.adverb; // 3
 * ```
 */
export function countIssues(issues: readonly Issue[]): IssueTotals {
  const byKind: Record<IssueKind, number> = {
    veryHard: 0,
    hard: 0,
    adverb: 0,
    passive: 0,
    wordy: 0,
    spelling: 0,
    grammar: 0,
  };
  for (const issue of issues) byKind[issue.kind] += 1;
  const errors = issues.filter((i) => ERROR_KINDS.has(i.kind)).length;
  return { errors, warnings: issues.length - errors, byKind };
}
