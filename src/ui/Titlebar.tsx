/** Props for {@link Titlebar}. */
export interface TitlebarProps {
  readonly fileName: string;
  readonly directory: string | null;
  onToggleTheme(): void;
}

/**
 * The window title bar. The window uses the macOS overlay title bar style, so this bar leaves
 * space for the traffic lights and is a drag region.
 *
 * @example
 * ```tsx
 * <Titlebar fileName="notes.md" directory="~/writing" onToggleTheme={toggle} />
 * ```
 */
export function Titlebar(props: TitlebarProps) {
  return (
    <header
      data-tauri-drag-region
      class="flex h-8 shrink-0 items-center border-b border-rule pr-3 pl-[84px] text-xs text-fg-faint"
    >
      <span data-tauri-drag-region class="flex-1 truncate text-center">
        <span class="text-fg-dim">{props.fileName}</span>
        {props.directory ? ` — ${props.directory}` : ""}
      </span>
      <button
        type="button"
        class="text-fg-faint hover:text-fg"
        title="Toggle theme"
        onClick={() => props.onToggleTheme()}
      >
        ◐ theme
      </button>
    </header>
  );
}
