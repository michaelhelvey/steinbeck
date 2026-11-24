import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { search, searchKeymap } from "@codemirror/search";
import { EditorState, type Extension } from "@codemirror/state";
import { drawSelection, EditorView, keymap, placeholder } from "@codemirror/view";
import { onSettled } from "solid-js";
import type { Issue } from "../analysis/schema.ts";
import {
  currentIssue,
  type IssueFilter,
  issueAt,
  issueField,
  removeIssue,
  setIssueFilter,
  setIssues,
} from "./issues.ts";
import { steinbeckTheme } from "./theme.ts";

/** A cursor position. Both numbers start at 1. */
export interface Cursor {
  readonly line: number;
  readonly column: number;
}

/** A screen rectangle, in viewport pixels. */
export interface AnchorRect {
  readonly left: number;
  readonly top: number;
  readonly bottom: number;
}

/**
 * Commands that the app sends to the editor.
 *
 * @example
 * ```ts
 * api.load(await backend.readFile(path));
 * ```
 */
export interface EditorApi {
  load(text: string): void;
  text(): string;
  setIssues(issues: readonly Issue[]): void;
  setFilter(filter: IssueFilter): void;
  applyFix(issueId: string, fixIndex: number): void;
  dismissIssue(issueId: string): void;
  focus(): void;
}

/** Props for {@link Editor}. */
export interface EditorProps {
  onReady(api: EditorApi): void;
  onChange(text: string): void;
  onCursor(cursor: Cursor): void;
  onIssueClick(issue: Issue, anchor: AnchorRect): void;
  onScroll(): void;
}

function cursorOf(state: EditorState): Cursor {
  const head = state.selection.main.head;
  const line = state.doc.lineAt(head);
  return { line: line.number, column: head - line.from + 1 };
}

function anchorFor(view: EditorView, issue: Issue, event: MouseEvent): AnchorRect | null {
  const start = view.coordsAtPos(issue.from);
  const end = view.coordsAtPos(issue.to, -1);
  if (!start || !end) return null;
  const onOneLine = Math.abs(start.top - end.top) < 2;
  return { left: onOneLine ? start.left : event.clientX, top: start.top, bottom: end.bottom };
}

function hitAt(view: EditorView, event: MouseEvent) {
  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
  const issue = pos === null ? null : issueAt(view.state, pos);
  if (!issue) return null;
  const anchor = anchorFor(view, issue, event);
  return anchor ? { issue, anchor } : null;
}

/**
 * The markdown editor. It shows raw markdown with quiet syntax highlighting, and draws analysis
 * marks when the filter enables them.
 *
 * @example
 * ```tsx
 * <Editor onReady={setApi} onChange={setText} onCursor={setCursor}
 *   onIssueClick={openPopover} onScroll={closePopover} />
 * ```
 */
export function Editor(props: EditorProps) {
  let parent: HTMLDivElement | undefined;

  onSettled(() => {
    if (!parent) throw new Error("editor host element is missing");
    const extensions: Extension[] = [
      history(),
      drawSelection(),
      search({ top: true }),
      EditorView.lineWrapping,
      EditorState.allowMultipleSelections.of(true),
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
      placeholder("Begin with one true sentence."),
      EditorView.contentAttributes.of({
        spellcheck: "false",
        autocorrect: "off",
        autocapitalize: "off",
      }),
      steinbeckTheme,
      issueField,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) props.onChange(update.state.doc.toString());
        if (update.docChanged || update.selectionSet) props.onCursor(cursorOf(update.state));
      }),
      EditorView.domEventHandlers({
        click(event, view) {
          const hit = hitAt(view, event);
          if (hit) props.onIssueClick(hit.issue, hit.anchor);
          return false;
        },
        scroll() {
          props.onScroll();
        },
      }),
    ];

    const view = new EditorView({
      parent,
      state: EditorState.create({ doc: "", extensions }),
    });

    props.onReady({
      load(text) {
        view.setState(EditorState.create({ doc: text, extensions }));
        props.onCursor(cursorOf(view.state));
      },
      text: () => view.state.doc.toString(),
      setIssues(issues) {
        view.dispatch({ effects: setIssues.of(issues) });
      },
      setFilter(filter) {
        view.dispatch({ effects: setIssueFilter.of(filter) });
      },
      applyFix(issueId, fixIndex) {
        const fix = currentIssue(view.state, issueId)?.fixes[fixIndex];
        if (!fix) return;
        view.dispatch({
          changes: { from: fix.from, to: fix.to, insert: fix.insert },
          effects: removeIssue.of(issueId),
          userEvent: "input.fix",
        });
        view.focus();
      },
      dismissIssue(issueId) {
        view.dispatch({ effects: removeIssue.of(issueId) });
      },
      focus: () => view.focus(),
    });

    view.focus();
    return () => view.destroy();
  });

  return <div class="h-full min-h-0" ref={(el) => (parent = el)} />;
}
