/**
 * Returns the file name of a path, or "untitled.md" when there is no path.
 *
 * @example
 * ```ts
 * fileNameOf("/Users/me/notes/draft.md"); // "draft.md"
 * ```
 */
export function fileNameOf(path: string | null): string {
  return path?.split("/").at(-1) ?? "untitled.md";
}

/**
 * Returns the directory of a path for display, with the home directory shortened to "~".
 *
 * @example
 * ```ts
 * directoryOf("/Users/me/notes/draft.md"); // "~/notes"
 * ```
 */
export function directoryOf(path: string | null): string | null {
  if (!path) return null;
  const directory = path.split("/").slice(0, -1).join("/") || "/";
  return directory.replace(/^\/Users\/[^/]+/, "~");
}
