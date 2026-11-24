import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { type Extension, RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

const v = (name: string) => `var(--color-${name})`;

const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "transparent",
    color: v("fg"),
    fontSize: "15px",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    lineHeight: "1.75",
  },
  ".cm-content": {
    maxWidth: "74ch",
    width: "100%",
    margin: "0 auto",
    padding: "56px 4ch 40vh",
    caretColor: v("accent"),
  },
  ".cm-line": { padding: "0" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: v("accent"), borderLeftWidth: "2px" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    { backgroundColor: `color-mix(in oklab, ${v("accent")} 30%, transparent)` },
  ".cm-codeblock": {
    backgroundColor: v("bg-2"),
    fontSize: "14px",
    paddingLeft: "1.5ch",
    paddingRight: "1.5ch",
  },
  ".cm-placeholder": { color: v("fg-faint"), fontStyle: "italic" },
  ".cm-panels": { backgroundColor: v("bg-2"), color: v("fg") },
  ".cm-searchMatch": { backgroundColor: `color-mix(in oklab, ${v("accent")} 25%, transparent)` },
  ".cm-searchMatch-selected": {
    backgroundColor: `color-mix(in oklab, ${v("accent")} 50%, transparent)`,
  },
});

const markdownHighlight = HighlightStyle.define([
  { tag: t.processingInstruction, color: v("fg-faint") },
  { tag: t.contentSeparator, color: v("fg-faint") },
  { tag: [t.heading, t.heading1, t.heading2, t.heading3], fontWeight: "700", color: v("accent") },
  { tag: [t.heading4, t.heading5, t.heading6], fontWeight: "700", color: v("accent") },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, textDecoration: "underline", textDecorationColor: v("fg-faint") },
  { tag: t.url, color: v("fg-faint") },
  { tag: t.quote, color: v("fg-dim"), fontStyle: "italic" },
  { tag: t.monospace, color: v("syn-str") },
  { tag: t.labelName, color: v("fg-faint") },
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.modifier], color: v("syn-kw") },
  { tag: [t.string, t.regexp, t.special(t.string)], color: v("syn-str") },
  {
    tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName],
    color: v("syn-fn"),
  },
  { tag: [t.typeName, t.className, t.namespace], color: v("syn-type") },
  { tag: [t.number, t.bool, t.null, t.atom], color: v("syn-num") },
  { tag: [t.comment, t.lineComment, t.blockComment], color: v("syn-com"), fontStyle: "italic" },
]);

const codeLine = Decoration.line({ class: "cm-codeblock" });

const CODE_NODES = new Set(["FencedCode", "CodeBlock"]);

function addLines(
  view: EditorView,
  builder: RangeSetBuilder<Decoration>,
  from: number,
  to: number,
) {
  const first = view.state.doc.lineAt(from).number;
  const last = view.state.doc.lineAt(to).number;
  for (let n = first; n <= last; n++) {
    const line = view.state.doc.line(n);
    builder.add(line.from, line.from, codeLine);
  }
}

function codeBlockLines(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        const isCode = CODE_NODES.has(node.name);
        if (isCode) addLines(view, builder, node.from, node.to);
        return !isCode;
      },
    });
  }
  return builder.finish();
}

const codeBlocks = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = codeBlockLines(view);
    }
    update(update: ViewUpdate) {
      const treeChanged = syntaxTree(update.startState) !== syntaxTree(update.state);
      if (update.docChanged || update.viewportChanged || treeChanged) {
        this.decorations = codeBlockLines(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

/**
 * The Steinbeck look for CodeMirror: layout, quiet markdown syntax, code highlighting, and a
 * shaded background behind code blocks. Colors come from the CSS theme variables, so the light
 * and dark themes need no change here.
 *
 * @example
 * ```ts
 * EditorState.create({ doc, extensions: [markdown(), steinbeckTheme] });
 * ```
 */
export const steinbeckTheme: Extension = [
  editorTheme,
  syntaxHighlighting(markdownHighlight),
  codeBlocks,
];
