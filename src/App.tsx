/**
 * Shows the root layout of Steinbeck: the editor pane on the left and the analysis sidebar on
 * the right.
 *
 * @example
 * ```tsx
 * render(() => <App />, document.getElementById("root")!);
 * ```
 */
export function App() {
  return (
    <div class="flex h-screen bg-paper text-ink">
      <main class="flex min-w-0 flex-1 justify-center overflow-y-auto">
        <textarea
          class="h-full w-full max-w-[68ch] resize-none bg-transparent px-8 py-16 font-serif text-lg leading-relaxed text-ink outline-none placeholder:text-ink-faint"
          placeholder="Begin with one true sentence."
          spellcheck={false}
          aria-label="Editor"
        />
      </main>
      <aside class="flex w-80 shrink-0 flex-col border-l border-rule bg-paper-shade">
        <header class="border-b border-rule px-6 py-4">
          <h2 class="font-mono text-xs tracking-[0.2em] text-ink-faint uppercase">Analysis</h2>
        </header>
        <div class="flex flex-1 items-center justify-center px-6">
          <p class="text-center font-serif text-sm text-ink-faint italic">Nothing to report yet.</p>
        </div>
      </aside>
    </div>
  );
}
