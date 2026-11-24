import { Show } from "solid-js";
import type { IssueTotals } from "../analysis/kinds.ts";
import type { Stats } from "../analysis/schema.ts";
import type { Cursor } from "../editor/Editor.tsx";

/** The two app modes. Write mode hides all analysis. */
export type Mode = "write" | "edit";

/** Props for {@link Statusline}. */
export interface StatuslineProps {
  readonly mode: Mode;
  readonly fileName: string;
  readonly dirty: boolean;
  readonly totals: IssueTotals;
  readonly stats: Stats;
  readonly cursor: Cursor;
  onToggleMode(): void;
}

function Arrow(props: { from: string; to: string; left?: boolean }) {
  return (
    <span class="relative w-2.5" style={{ background: props.to }}>
      <span
        class="absolute inset-0"
        style={{
          background: props.from,
          "clip-path": props.left
            ? "polygon(100% 0, 0 50%, 100% 100%)"
            : "polygon(0 0, 100% 50%, 0 100%)",
        }}
      />
    </span>
  );
}

function Dot() {
  return <span class="px-[0.6ch] text-fg-faint">·</span>;
}

/**
 * A neovim-style statusline: mode, file, issue counts, document statistics, and cursor position.
 *
 * @example
 * ```tsx
 * <Statusline mode="write" fileName="notes.md" dirty={false} totals={totals()}
 *   stats={stats()} cursor={{ line: 1, column: 1 }} onToggleMode={toggle} />
 * ```
 */
export function Statusline(props: StatuslineProps) {
  const modeColor = () => (props.mode === "edit" ? "var(--color-edit)" : "var(--color-accent)");
  const edit = () => props.mode === "edit";

  return (
    <footer class="flex h-6 items-stretch bg-bg-2 text-xs leading-6 whitespace-nowrap">
      <button
        type="button"
        class="px-[1.2ch] font-bold tracking-[0.06em] text-accent-ink"
        style={{ background: modeColor() }}
        onClick={() => props.onToggleMode()}
      >
        {props.mode.toUpperCase()}
      </button>
      <Arrow from={modeColor()} to="var(--color-bg-4)" />
      <span class="bg-bg-4 px-[1.2ch] text-fg">{props.fileName}</span>
      <Arrow from="var(--color-bg-4)" to="var(--color-bg-2)" />
      <Show when={props.dirty}>
        <span class="px-[1.2ch] text-accent">[+]</span>
      </Show>
      <Show when={edit()}>
        <span class="px-[1.2ch]">
          <span class="text-spelling">✗ {props.totals.errors}</span>
          <Dot />
          <span class="text-accent">△ {props.totals.warnings}</span>
        </span>
      </Show>
      <span class="flex-1" />
      <span class="px-[1.2ch] text-fg-dim">
        {props.stats.words.toLocaleString()} words
        <Dot />
        {props.stats.readingMinutes} min
        <Show when={edit()}>
          <Dot />
          {props.stats.characters.toLocaleString()} chars
          <Dot />
          {props.stats.sentences} sentences
        </Show>
      </span>
      <Arrow from="var(--color-bg-4)" to="var(--color-bg-2)" left />
      <span class="bg-bg-4 px-[1.2ch] text-fg">markdown</span>
      <Arrow from={modeColor()} to="var(--color-bg-4)" left />
      <span class="px-[1.2ch] font-bold text-accent-ink" style={{ background: modeColor() }}>
        {props.cursor.line}:{props.cursor.column}
      </span>
    </footer>
  );
}
