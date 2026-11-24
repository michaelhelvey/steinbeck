/** The line that starts the Steinbeck block in a shell rc file. */
export const BLOCK_START = "# >>> steinbeck >>>";

/** The line that ends the Steinbeck block in a shell rc file. */
export const BLOCK_END = "# <<< steinbeck <<<";

/**
 * The zsh function that `steinbeck file.md` runs. It creates missing files, then opens them in
 * the installed app. With no arguments it opens the app.
 */
export const STEINBECK_FUNCTION = [
  "steinbeck() {",
  "  local f",
  '  for f in "$@"; do [[ -e "$f" ]] || : > "$f"; done',
  '  open -a Steinbeck "$@"',
  "}",
].join("\n");

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Puts the Steinbeck block in the text of an rc file. If a block is already there, this replaces
 * it, so running setup again does not add a second copy.
 *
 * @example
 * ```ts
 * const next = upsertBlock(await Bun.file(rc).text(), STEINBECK_FUNCTION);
 * ```
 */
export function upsertBlock(rc: string, body: string): string {
  const block = `${BLOCK_START}\n${body}\n${BLOCK_END}`;
  const match = new RegExp(`${escape(BLOCK_START)}[\\s\\S]*?${escape(BLOCK_END)}`).exec(rc);
  if (match) return rc.replace(match[0], () => block);
  const prefix = rc.replace(/\n?$/, "\n").replace(/^\n$/, "");
  return `${prefix}\n${block}\n`;
}
