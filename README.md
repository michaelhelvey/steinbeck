# Steinbeck

A calm markdown writing app. Steinbeck has an editor pane and a sidebar that shows problems in your
prose (long sentences, weak grammar, and similar).

The app is a [Tauri 2](https://tauri.app) desktop app. The frontend is
[SolidJS 2](https://docs.solidjs.com) with [Tailwind CSS v4](https://tailwindcss.com), served and
built by [Vite+](https://viteplus.dev) (`vp`). The backend is Rust.

## Layout

| Path                     | Contents                                       |
| ------------------------ | ---------------------------------------------- |
| `index.html`, `src/`     | Frontend (Solid components, styles)            |
| `src-tauri/`             | Rust backend and Tauri configuration           |
| `assets/icon.svg`        | Source for the app icon                        |
| `scripts/render-icon.ts` | Renders the icon and generates all icon sizes  |
| `vite.config.ts`         | Vite, lint, and format configuration for Vite+ |

## Requirements

- [Bun](https://bun.sh)
- Rust and Cargo (see the [Tauri prerequisites](https://tauri.app/start/prerequisites/))

Install the dependencies:

```sh
bun install
```

## Develop

Start the app with hot reload:

```sh
bun run tauri dev
```

This starts the Vite dev server on `http://localhost:1420` and opens the app window. To work on the
frontend in a browser only, use `bun run dev`.

## Build

```sh
bun run tauri build           # release bundle (.app and .dmg on macOS)
bun run tauri build --debug   # debug bundle, faster to compile
```

The bundles are in `src-tauri/target/<profile>/bundle/`. To build only the frontend into `dist/`,
use `bun run build`.

## Validate

```sh
bun run validate
```

This runs format, lint, type check, and `bun test`, then the Rust checks: `bun run check:rust`
(`cargo fmt --check` and `cargo clippy -- -D warnings`) and `bun run test:rust` (`cargo test`).

`bun run bench:rust` runs the analysis performance test in release mode. It analyzes a 4,500-word
Markdown document and prints the time for a cold analysis and for an analysis after one edit.

## Backend

The analysis engine is in `src-tauri/src/analysis/`. It finds hard sentences, adverbs, passive
voice, wordy phrases, and (with [Harper](https://writewithharper.com)) spelling and grammar errors.
It analyzes only prose: it ignores code, URLs, raw HTML, and YAML front matter. It keeps a cache of
each top-level Markdown block, so an analysis after a small edit is fast.

User dictionary words are in `dictionary.txt` in the app data directory (on macOS,
`~/Library/Application Support/com.helvetici.steinbeck/`), one word on each line.

The app opens `.md` and `.markdown` files from Finder ("Open With"), from
`open -a Steinbeck file.md`, and from file paths given as command-line arguments.

## Regenerate the icons

Edit `assets/icon.svg`, then run:

```sh
bun run icons
```

This renders `assets/icon.png` (1024x1024) and runs `tauri icon`, which writes all sizes into
`src-tauri/icons/`. Commit the SVG, the PNG, and the generated icons.
