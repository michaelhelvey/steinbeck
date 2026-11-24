import {
  type ChangeDesc,
  type EditorState,
  StateEffect,
  StateField,
  type Transaction,
} from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";
import type { Fix, Issue, IssueKind } from "../analysis/schema.ts";

/**
 * Controls which issues the editor shows.
 *
 * @example
 * ```ts
 * view.dispatch({ effects: setIssueFilter.of({ ...DEFAULT_FILTER, enabled: true }) });
 * ```
 */
export interface IssueFilter {
  readonly enabled: boolean;
  readonly hiddenKinds: ReadonlySet<IssueKind>;
  readonly ignored: ReadonlySet<string>;
  readonly focus: IssueKind | null;
}

/** A filter that shows nothing. Write mode uses it. */
export const DEFAULT_FILTER: IssueFilter = {
  enabled: false,
  hiddenKinds: new Set(),
  ignored: new Set(),
  focus: null,
};

/** Replaces all issues. The offsets must match the current document. */
export const setIssues = StateEffect.define<readonly Issue[]>();

/** Replaces the issue filter. */
export const setIssueFilter = StateEffect.define<IssueFilter>();

/** Removes one issue by id, for example after the user applies its fix. */
export const removeIssue = StateEffect.define<string>();

interface IssueState {
  readonly issues: readonly Issue[];
  readonly filter: IssueFilter;
  readonly decorations: DecorationSet;
}

function mapFix(fix: Fix, changes: ChangeDesc): Fix {
  return { ...fix, from: changes.mapPos(fix.from, 1), to: changes.mapPos(fix.to, -1) };
}

function mapIssue(issue: Issue, changes: ChangeDesc): Issue | null {
  const from = changes.mapPos(issue.from, 1);
  const to = changes.mapPos(issue.to, -1);
  if (to <= from) return null;
  return { ...issue, from, to, fixes: issue.fixes.map((fix) => mapFix(fix, changes)) };
}

function isVisible(issue: Issue, filter: IssueFilter): boolean {
  return filter.enabled && !filter.hiddenKinds.has(issue.kind) && !filter.ignored.has(issue.id);
}

function decorate(issues: readonly Issue[], filter: IssueFilter): DecorationSet {
  const ranges = issues
    .filter((issue) => isVisible(issue, filter))
    .map((issue) =>
      Decoration.mark({
        class: `mark mark-${issue.kind}${filter.focus === issue.kind ? " mark-focused" : ""}`,
        attributes: { "data-issue": issue.id },
      }).range(issue.from, issue.to),
    );
  return Decoration.set(ranges, true);
}

function mapIssues(issues: readonly Issue[], tr: Transaction): readonly Issue[] {
  if (!tr.docChanged) return issues;
  return issues.flatMap((issue) => mapIssue(issue, tr.changes) ?? []);
}

function nextFilter(filter: IssueFilter, effects: readonly StateEffect<unknown>[]) {
  return effects.findLast((e) => e.is(setIssueFilter))?.value ?? filter;
}

function nextIssues(issues: readonly Issue[], effects: readonly StateEffect<unknown>[]) {
  let next = issues;
  for (const effect of effects) {
    if (effect.is(setIssues)) next = effect.value;
    if (effect.is(removeIssue)) next = next.filter((issue) => issue.id !== effect.value);
  }
  return next;
}

/**
 * Holds the current issues and their decorations. It moves issue offsets through every edit, so
 * marks stay on the correct words while a new analysis runs.
 *
 * @example
 * ```ts
 * const state = EditorState.create({ doc, extensions: [issueField] });
 * ```
 */
export const issueField = StateField.define<IssueState>({
  create: () => ({ issues: [], filter: DEFAULT_FILTER, decorations: Decoration.none }),
  update(value, tr) {
    const issues = nextIssues(mapIssues(value.issues, tr), tr.effects);
    const filter = nextFilter(value.filter, tr.effects);
    if (issues === value.issues && filter === value.filter) return value;
    return { issues, filter, decorations: decorate(issues, filter) };
  },
  provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
});

/**
 * Returns the narrowest visible issue at a position. A word issue wins over the sentence that
 * contains it.
 *
 * @example
 * ```ts
 * const issue = issueAt(view.state, view.posAtCoords({ x, y }) ?? 0);
 * ```
 */
export function issueAt(state: EditorState, pos: number): Issue | null {
  const { issues, filter } = state.field(issueField);
  const hits = issues.filter(
    (issue) => isVisible(issue, filter) && issue.from <= pos && pos < issue.to,
  );
  hits.sort((a, b) => a.to - a.from - (b.to - b.from));
  return hits[0] ?? null;
}

/**
 * Returns the current version of an issue, with offsets moved through all edits since the
 * analysis.
 *
 * @example
 * ```ts
 * const current = currentIssue(view.state, clicked.id);
 * ```
 */
export function currentIssue(state: EditorState, id: string): Issue | null {
  return state.field(issueField).issues.find((issue) => issue.id === id) ?? null;
}
