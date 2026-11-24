import { createSignal } from "solid-js";
import type { Backend } from "./backend.ts";
import type { EditorApi } from "./editor/Editor.tsx";
import { fileNameOf } from "./files.ts";

/**
 * The open document and its file operations. Every operation that replaces the document asks
 * before it discards unsaved changes.
 *
 * @example
 * ```ts
 * const doc = createDocument(backend, () => editorApi());
 * await doc.open();
 * ```
 */
export interface DocumentModel {
  path(): string | null;
  text(): string;
  dirty(): boolean;
  fileName(): string;
  version(): number;
  edited(text: string): void;
  confirmLeave(): Promise<boolean>;
  openPath(path: string): Promise<void>;
  open(): Promise<void>;
  save(): Promise<void>;
  saveAs(): Promise<void>;
  newDocument(): Promise<void>;
}

/**
 * Creates the {@link DocumentModel}. Call it in a component body.
 *
 * @example
 * ```ts
 * const doc = createDocument(props.backend, editor);
 * ```
 */
export function createDocument(
  backend: Backend,
  editor: () => EditorApi | undefined,
): DocumentModel {
  const [path, setPath] = createSignal<string | null>(null);
  const [saved, setSaved] = createSignal("");
  const [text, setText] = createSignal("");
  const [version, setVersion] = createSignal(0);

  const fileName = () => fileNameOf(path());
  const dirty = () => text() !== saved();

  function replace(nextPath: string | null, contents: string) {
    editor()?.load(contents);
    setPath(nextPath);
    setSaved(contents);
    setText(contents);
    setVersion((v) => v + 1);
  }

  async function confirmLeave() {
    return !dirty() || backend.confirmDiscard(fileName());
  }

  async function writeTo(target: string) {
    const contents = editor()?.text() ?? text();
    await backend.writeFile(target, contents);
    setPath(target);
    setSaved(contents);
  }

  async function saveAs() {
    const target = await backend.pickSavePath(fileName());
    if (target) await writeTo(target);
  }

  async function openPath(target: string) {
    if (target === path() || !(await confirmLeave())) return;
    replace(target, await backend.readFile(target));
  }

  return {
    path,
    text,
    dirty,
    fileName,
    version,
    edited(next) {
      setText(next);
      setVersion((v) => v + 1);
    },
    confirmLeave,
    openPath,
    async open() {
      const target = await backend.pickOpenPath();
      if (target) await openPath(target);
    },
    async save() {
      const current = path();
      await (current ? writeTo(current) : saveAs());
    },
    saveAs,
    async newDocument() {
      if (await confirmLeave()) replace(null, "");
    },
  };
}
