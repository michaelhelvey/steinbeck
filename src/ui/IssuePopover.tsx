import { For, Show } from "solid-js";
import { kindInfo } from "../analysis/kinds.ts";
import type { Issue } from "../analysis/schema.ts";
import type { AnchorRect } from "../editor/Editor.tsx";

const WIDTH = 340;
const ESTIMATED_HEIGHT = 150;

/** Props for {@link IssuePopover}. */
export interface IssuePopoverProps {
  readonly issue: Issue;
  readonly anchor: AnchorRect;
  onFix(fixIndex: number): void;
  onAddToDictionary(): void;
  onIgnore(): void;
}

const SOURCE: Record<Issue["kind"], string> = {
  veryHard: "steinbeck · readability",
  hard: "steinbeck · readability",
  adverb: "steinbeck · style",
  passive: "steinbeck · style",
  wordy: "steinbeck · style",
  spelling: "harper · spelling",
  grammar: "harper · grammar",
};

const ACTION = "border px-2 py-0.5";

/**
 * The details of one issue, next to the mark that the user clicked: what is wrong, the fixes, and
 * the ways to dismiss it.
 *
 * @example
 * ```tsx
 * <IssuePopover issue={issue} anchor={rect} onFix={apply} onAddToDictionary={add}
 *   onIgnore={ignore} />
 * ```
 */
export function IssuePopover(props: IssuePopoverProps) {
  const info = () => kindInfo(props.issue.kind);
  const style = () => {
    const below = props.anchor.bottom + 8 + ESTIMATED_HEIGHT < innerHeight;
    return {
      width: `${WIDTH}px`,
      left: `${Math.max(8, Math.min(props.anchor.left, innerWidth - WIDTH - 12))}px`,
      ...(below
        ? { top: `${props.anchor.bottom + 8}px` }
        : { bottom: `${innerHeight - props.anchor.top + 8}px` }),
    };
  };

  return (
    <div
      class="fixed z-20 border border-bg-4 bg-bg-3 px-3 py-2.5 text-[12.5px] leading-relaxed shadow-2xl"
      style={style()}
      onMouseDown={(event) => event.preventDefault()}
    >
      <div class="mb-1 text-[11px] tracking-[0.08em] uppercase" style={{ color: info().color }}>
        {info().title}
      </div>
      <div class="text-fg-dim">{props.issue.message}</div>
      <div class="mt-2.5 flex flex-wrap gap-1.5">
        <For each={props.issue.fixes}>
          {(fix, index) => (
            <button
              type="button"
              class={[ACTION, "border-accent text-accent hover:bg-bg"]}
              onClick={() => props.onFix(index())}
            >
              {fix.label === "cut" ? "✂ cut" : `→ ${fix.label}`}
            </button>
          )}
        </For>
        <Show when={props.issue.kind === "spelling"}>
          <button
            type="button"
            class={[ACTION, "border-bg-4 bg-bg-2 hover:bg-bg"]}
            onClick={() => props.onAddToDictionary()}
          >
            + dictionary
          </button>
        </Show>
        <button
          type="button"
          class={[ACTION, "border-bg-4 bg-bg-2 hover:bg-bg"]}
          onClick={() => props.onIgnore()}
        >
          ignore
        </button>
      </div>
      <div class="mt-2 text-[10.5px] text-fg-faint">{SOURCE[props.issue.kind]}</div>
    </div>
  );
}
