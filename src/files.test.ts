import { describe, expect, it } from "bun:test";
import { directoryOf, fileNameOf } from "./files.ts";

describe("fileNameOf", () => {
  it.each([
    ["/Users/me/notes/draft.md", "draft.md"],
    ["/draft.md", "draft.md"],
    [null, "untitled.md"],
  ])("%s -> %s", (path, name) => {
    expect(fileNameOf(path)).toBe(name);
  });
});

describe("directoryOf", () => {
  it.each([
    ["/Users/me/notes/draft.md", "~/notes"],
    ["/Users/me/draft.md", "~"],
    ["/tmp/draft.md", "/tmp"],
    ["/draft.md", "/"],
    [null, null],
  ])("%s -> %s", (path, directory) => {
    expect(directoryOf(path)).toBe(directory);
  });
});
