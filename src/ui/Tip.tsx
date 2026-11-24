import { type JSX, Portal } from "@solidjs/web";
import { createSignal, Show } from "solid-js";

const TIP_WIDTH = 300;

/** Props for {@link Tip}. */
export interface TipProps {
  readonly content: JSX.Element;
  readonly children: JSX.Element;
  readonly class?: string;
}

function placement(rect: DOMRect): JSX.CSSProperties {
  const left = `${Math.max(8, Math.min(rect.left, innerWidth - TIP_WIDTH - 12))}px`;
  if (rect.bottom > innerHeight * 0.6) return { left, bottom: `${innerHeight - rect.top + 8}px` };
  return { left, top: `${rect.bottom + 8}px` };
}

/**
 * Shows an explanation next to its children while the pointer is on them. The tooltip renders in
 * a portal, so a parent with hidden overflow does not cut it.
 *
 * @example
 * ```tsx
 * <Tip content={<p>Uses characters per word.</p>}>ARI</Tip>
 * ```
 */
export function Tip(props: TipProps) {
  const [rect, setRect] = createSignal<DOMRect | null>(null);

  return (
    <>
      <span
        class={["cursor-help", props.class]}
        onMouseEnter={(event) => setRect(event.currentTarget.getBoundingClientRect())}
        onMouseLeave={() => setRect(null)}
      >
        {props.children}
      </span>
      <Show when={rect()}>
        {(r) => (
          <Portal>
            <div
              class="pointer-events-none fixed z-30 border border-bg-4 bg-bg-3 px-3 py-2.5 text-xs leading-relaxed text-fg-dim shadow-2xl"
              style={{ width: `${TIP_WIDTH}px`, ...placement(r()) }}
            >
              {props.content}
            </div>
          </Portal>
        )}
      </Show>
    </>
  );
}
