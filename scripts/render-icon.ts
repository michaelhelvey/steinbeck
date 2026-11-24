/**
 * Renders `assets/icon.svg` to `assets/icon.png` at 1024x1024, then runs `tauri icon` to write
 * all platform icon sizes into `src-tauri/icons`.
 *
 * @example
 * ```sh
 * bun run icons
 * ```
 */
import { Resvg } from "@resvg/resvg-js";

const root = new URL("..", import.meta.url).pathname;
const svgPath = `${root}assets/icon.svg`;
const pngPath = `${root}assets/icon.png`;

const svg = await Bun.file(svgPath).text();
const png = new Resvg(svg, { fitTo: { mode: "width", value: 1024 } }).render().asPng();
await Bun.write(pngPath, png);
console.log(`wrote ${pngPath}`);

const tauri = Bun.spawn(["bunx", "tauri", "icon", pngPath], {
  cwd: root,
  stdout: "inherit",
  stderr: "inherit",
});
const exitCode = await tauri.exited;
if (exitCode !== 0) {
  throw new Error(`tauri icon failed with exit code ${exitCode}`);
}
