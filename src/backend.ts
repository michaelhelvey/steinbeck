import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask, open, save } from "@tauri-apps/plugin-dialog";
import { z } from "zod";
import { Analysis } from "./analysis/schema.ts";

/**
 * Everything the UI needs from the host. The app takes this as a prop so tests and previews can
 * supply a fake.
 *
 * @example
 * ```tsx
 * render(() => <App backend={tauriBackend()} />, root);
 * ```
 */
export interface Backend {
  analyze(text: string): Promise<Analysis>;
  addToDictionary(word: string): Promise<void>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, contents: string): Promise<void>;
  takeOpenedFiles(): Promise<string[]>;
  onOpenFile(handler: (path: string) => void): Promise<() => void>;
  pickOpenPath(): Promise<string | null>;
  pickSavePath(suggestedName: string): Promise<string | null>;
  confirmDiscard(fileName: string): Promise<boolean>;
  onCloseRequested(canClose: () => Promise<boolean>): Promise<() => void>;
}

const MARKDOWN_FILTER = [{ name: "Markdown", extensions: ["md", "markdown"] }];

const OpenFilePayload = z.object({ path: z.string() });

/**
 * Creates the {@link Backend} that talks to the Tauri host.
 *
 * @example
 * ```ts
 * const backend = tauriBackend();
 * const text = await backend.readFile("/Users/me/notes.md");
 * ```
 */
export function tauriBackend(): Backend {
  return {
    async analyze(text) {
      return Analysis.parse(await invoke("analyze", { text }));
    },
    async addToDictionary(word) {
      await invoke("add_to_dictionary", { word });
    },
    async readFile(path) {
      return z.string().parse(await invoke("read_file", { path }));
    },
    async writeFile(path, contents) {
      await invoke("write_file", { path, contents });
    },
    async takeOpenedFiles() {
      return z.array(z.string()).parse(await invoke("take_opened_files"));
    },
    onOpenFile(handler) {
      return listen("open-file", (event) => handler(OpenFilePayload.parse(event.payload).path));
    },
    async pickOpenPath() {
      const picked = await open({ multiple: false, directory: false, filters: MARKDOWN_FILTER });
      return z.string().nullable().parse(picked);
    },
    async pickSavePath(suggestedName) {
      return save({ defaultPath: suggestedName, filters: MARKDOWN_FILTER });
    },
    confirmDiscard(fileName) {
      return ask(`${fileName} has unsaved changes. Discard them?`, {
        title: "Unsaved changes",
        kind: "warning",
        okLabel: "Discard",
        cancelLabel: "Cancel",
      });
    },
    onCloseRequested(canClose) {
      return getCurrentWindow().onCloseRequested(async (event) => {
        if (!(await canClose())) event.preventDefault();
      });
    },
  };
}
