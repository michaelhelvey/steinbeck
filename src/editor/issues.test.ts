import { describe, expect, it } from "bun:test";
import { EditorState } from "@codemirror/state";
import type { Issue } from "../analysis/schema.ts";
import {
  currentIssue,
  DEFAULT_FILTER,
  issueAt,
  issueField,
  removeIssue,
  setIssueFilter,
  setIssues,
} from "./issues.ts";

const TEXT = "I really think the plan was written badly.";

function issue(id: string, kind: Issue["kind"], word: string): Issue {
  const from = TEXT.indexOf(word);
  return { id, kind, from, to: from + word.length, message: "", fixes: [] };
}

const ISSUES = [
  issue("s", "hard", TEXT),
  issue("a", "adverb", "really"),
  issue("p", "passive", "was written"),
];

function stateWith(issues: readonly Issue[], enabled = true) {
  const state = EditorState.create({ doc: TEXT, extensions: [issueField] });
  return state.update({
    effects: [setIssues.of(issues), setIssueFilter.of({ ...DEFAULT_FILTER, enabled })],
  }).state;
}

function slice(state: EditorState, id: string) {
  const found = currentIssue(state, id);
  return found ? state.sliceDoc(found.from, found.to) : null;
}

function decorationCount(state: EditorState) {
  return state.field(issueField).decorations.size;
}

describe("issueField", () => {
  it("keeps issues on the same words after an edit before them", () => {
    const edited = stateWith(ISSUES).update({ changes: { from: 0, insert: "Honestly, " } }).state;
    expect(slice(edited, "a")).toBe("really");
    expect(slice(edited, "p")).toBe("was written");
  });

  it("drops an issue when the user deletes its text", () => {
    const from = TEXT.indexOf("really ");
    const edited = stateWith(ISSUES).update({ changes: { from, to: from + 7 } }).state;
    expect(currentIssue(edited, "a")).toBeNull();
    expect(slice(edited, "s")).toBe("I think the plan was written badly.");
  });

  it("shows no marks while disabled, for example in write mode", () => {
    expect(decorationCount(stateWith(ISSUES, false))).toBe(0);
    expect(decorationCount(stateWith(ISSUES, true))).toBe(3);
  });

  it.each([
    ["hidden kind", { hiddenKinds: new Set(["adverb"] as const) }, 2],
    ["ignored id", { ignored: new Set(["p"]) }, 2],
  ])("hides issues by %s", (_, filter, expected) => {
    const state = stateWith(ISSUES).update({
      effects: setIssueFilter.of({ ...DEFAULT_FILTER, enabled: true, ...filter }),
    }).state;
    expect(decorationCount(state)).toBe(expected);
  });

  it("removes one issue by id", () => {
    const state = stateWith(ISSUES).update({ effects: removeIssue.of("a") }).state;
    expect(currentIssue(state, "a")).toBeNull();
    expect(decorationCount(state)).toBe(2);
  });
});

describe("issueAt", () => {
  it("prefers the word over the sentence that contains it", () => {
    expect(issueAt(stateWith(ISSUES), TEXT.indexOf("really") + 2)?.id).toBe("a");
  });

  it("falls back to the sentence outside word issues", () => {
    expect(issueAt(stateWith(ISSUES), TEXT.indexOf("plan"))?.id).toBe("s");
  });

  it("ignores hidden issues", () => {
    expect(issueAt(stateWith(ISSUES, false), TEXT.indexOf("really"))).toBeNull();
  });
});
