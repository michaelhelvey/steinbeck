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

This runs format, lint, type check, and `bun test`. For the Rust code, run `cargo check` in
`src-tauri/`.

## Regenerate the icons

Edit `assets/icon.svg`, then run:

```sh
bun run icons
```

This renders `assets/icon.png` (1024x1024) and runs `tauri icon`, which writes all sizes into
`src-tauri/icons/`. Commit the SVG, the PNG, and the generated icons.
