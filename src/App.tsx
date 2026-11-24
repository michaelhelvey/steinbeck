import { createEffect, createMemo, createSignal, onSettled, Show } from "solid-js";
import { countIssues } from "./analysis/kinds.ts";
import { DEFAULT_TARGET } from "./analysis/readability.ts";
import { type Analysis, EMPTY_STATS, type Issue, type IssueKind } from "./analysis/schema.ts";
import type { Backend } from "./backend.ts";
import { createDocument } from "./document.ts";
import { type AnchorRect, type Cursor, Editor, type EditorApi } from "./editor/Editor.tsx";
import { directoryOf } from "./files.ts";
import { IssuePopover } from "./ui/IssuePopover.tsx";
import { Sidebar } from "./ui/Sidebar.tsx";
import { type Mode, Statusline } from "./ui/Statusline.tsx";
import { isDark, loadThemePreference, saveThemePreference } from "./ui/theme.ts";
import { Titlebar } from "./ui/Titlebar.tsx";

const ANALYSIS_DELAY_MS = 250;

/** Props for {@link App}. */
export interface AppProps {
  readonly backend: Backend;
}

interface OpenPopover {
  readonly issue: Issue;
  readonly anchor: AnchorRect;
}

function toggled<T>(set: ReadonlySet<T>, value: T): ReadonlySet<T> {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
}

function comboOf(event: KeyboardEvent): string {
  const modifiers = (
    [
      ["meta", event.metaKey],
      ["shift", event.shiftKey],
    ] as const
  ).flatMap(([name, held]) => (held ? [name] : []));
  return [...modifiers, event.key.toLowerCase()].join("+");
}

function report(action: string) {
  return (error: unknown) => console.error(`steinbeck: ${action} failed`, error);
}

/**
 * The Steinbeck window: title bar, editor, analysis sidebar, and statusline.
 *
 * @example
 * ```tsx
 * render(() => <App backend={tauriBackend()} />, root);
 * ```
 */
export function App(props: AppProps) {
  const [editor, setEditor] = createSignal<EditorApi>();
  const [mode, setMode] = createSignal<Mode>("write");
  const [cursor, setCursor] = createSignal<Cursor>({ line: 1, column: 1 });
  const [analysis, setAnalysis] = createSignal<Analysis>({ stats: EMPTY_STATS, issues: [] });
  const [hiddenKinds, setHiddenKinds] = createSignal<ReadonlySet<IssueKind>>(new Set());
  const [ignored, setIgnored] = createSignal<ReadonlySet<string>>(new Set());
  const [focusKind, setFocusKind] = createSignal<IssueKind | null>(null);
  const [popover, setPopover] = createSignal<OpenPopover | null>(null);
  const [recheck, setRecheck] = createSignal(0);
  const [themePref, setThemePref] = createSignal(loadThemePreference());
  const systemDark = matchMedia("(prefers-color-scheme: dark)");
  const [prefersDark, setPrefersDark] = createSignal(systemDark.matches);

  const doc = createDocument(props.backend, editor);
  const dark = createMemo(() => isDark(themePref(), prefersDark()));
  const totals = createMemo(() =>
    countIssues(analysis().issues.filter((issue) => !ignored().has(issue.id))),
  );

  createEffect(
    () => dark(),
    (value) => {
      document.documentElement.classList.toggle("dark", value);
    },
  );

  async function analyze(text: string, version: number) {
    const result = await props.backend.analyze(text);
    if (version !== doc.version()) return;
    setAnalysis(result);
    editor()?.setIssues(result.issues);
  }

  createEffect(
    () => ({ text: doc.text(), version: doc.version(), recheck: recheck() }),
    (request) => {
      const timer = setTimeout(
        () => void analyze(request.text, request.version).catch(report("analysis")),
        ANALYSIS_DELAY_MS,
      );
      return () => clearTimeout(timer);
    },
  );

  createEffect(
    () => ({
      api: editor(),
      filter: {
        enabled: mode() === "edit",
        hiddenKinds: hiddenKinds(),
        ignored: ignored(),
        focus: focusKind(),
      },
    }),
    ({ api, filter }) => api?.setFilter(filter),
  );

  const toggleMode = () => {
    setPopover(null);
    setMode((m) => (m === "write" ? "edit" : "write"));
  };

  const shortcuts: Record<string, () => void> = {
    "meta+e": toggleMode,
    "meta+o": () => void doc.open().catch(report("open")),
    "meta+s": () => void doc.save().catch(report("save")),
    "meta+shift+s": () => void doc.saveAs().catch(report("save as")),
    "meta+n": () => void doc.newDocument().catch(report("new document")),
  };

  function onKeyDown(event: KeyboardEvent) {
    const action = shortcuts[comboOf(event)];
    if (!action) return;
    event.preventDefault();
    action();
  }

  function onEscape(event: KeyboardEvent) {
    if (event.key === "Escape") setPopover(null);
  }

  function onMouseDown(event: MouseEvent) {
    if (!(event.target instanceof Element) || !event.target.closest("[data-popover]")) {
      setPopover(null);
    }
  }

  const onSystemChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches);

  async function openStartupFiles() {
    const last = (await props.backend.takeOpenedFiles()).at(-1);
    if (last) await doc.openPath(last);
  }

  onSettled(() => {
    systemDark.addEventListener("change", onSystemChange);
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onEscape);

    const openOne = (path: string) => void doc.openPath(path).catch(report(`open ${path}`));
    const listeners = [
      props.backend.onOpenFile(openOne),
      props.backend.onCloseRequested(() => doc.confirmLeave()),
    ];
    void openStartupFiles().catch(report("startup files"));

    return () => {
      systemDark.removeEventListener("change", onSystemChange);
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onEscape);
      for (const listener of listeners) listener.then((unlisten) => unlisten(), report("unlisten"));
    };
  });

  function toggleTheme() {
    const next = dark() ? "light" : "dark";
    saveThemePreference(next);
    setThemePref(next);
  }

  function withPopover(run: (open: OpenPopover, api: EditorApi) => void) {
    const open = popover();
    const api = editor();
    setPopover(null);
    if (open && api) run(open, api);
  }

  const applyFix = (fixIndex: number) =>
    withPopover((open, api) => api.applyFix(open.issue.id, fixIndex));

  const ignore = () => withPopover((open) => setIgnored((set) => toggled(set, open.issue.id)));

  const addToDictionary = () =>
    withPopover((open, api) => {
      const word = api.text().slice(open.issue.from, open.issue.to);
      api.dismissIssue(open.issue.id);
      props.backend
        .addToDictionary(word)
        .then(() => setRecheck((n) => n + 1), report("add to dictionary"));
    });

  return (
    <div class="flex h-screen flex-col bg-bg text-fg">
      <Titlebar
        fileName={doc.fileName()}
        directory={directoryOf(doc.path())}
        onToggleTheme={toggleTheme}
      />
      <div class="flex min-h-0 flex-1">
        <main class="min-w-0 flex-1" data-focus={focusKind() ?? undefined}>
          <Editor
            onReady={setEditor}
            onChange={(text) => {
              setPopover(null);
              doc.edited(text);
            }}
            onCursor={setCursor}
            onIssueClick={(issue, anchor) => setPopover({ issue, anchor })}
            onScroll={() => setPopover(null)}
          />
        </main>
        <aside
          class={[
            "shrink-0 overflow-hidden bg-bg-2 transition-[width] duration-200 ease-out",
            mode() === "edit" ? "w-[340px] border-l border-rule" : "w-0",
          ]}
        >
          <Sidebar
            stats={analysis().stats}
            totals={totals()}
            hiddenKinds={hiddenKinds()}
            target={DEFAULT_TARGET}
            onToggleKind={(kind) => setHiddenKinds((set) => toggled(set, kind))}
            onFocusKind={setFocusKind}
          />
        </aside>
      </div>
      <Statusline
        mode={mode()}
        fileName={doc.fileName()}
        dirty={doc.dirty()}
        totals={totals()}
        stats={analysis().stats}
        cursor={cursor()}
        onToggleMode={toggleMode}
      />
      <Show when={popover()}>
        {(open) => (
          <div data-popover>
            <IssuePopover
              issue={open().issue}
              anchor={open().anchor}
              onFix={applyFix}
              onAddToDictionary={addToDictionary}
              onIgnore={ignore}
            />
          </div>
        )}
      </Show>
    </div>
  );
}
