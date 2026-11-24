import { describe, expect, it } from "bun:test";
import { BLOCK_END, BLOCK_START, upsertBlock } from "./shell-block.ts";

const count = (text: string, part: string) => text.split(part).length - 1;

describe("upsertBlock", () => {
  it("appends the block and keeps the existing config", () => {
    const rc = 'export PATH="$HOME/bin:$PATH"';
    const next = upsertBlock(rc, "steinbeck() {}");
    expect(next.startsWith(rc + "\n")).toBe(true);
    expect(next).toContain(`${BLOCK_START}\nsteinbeck() {}\n${BLOCK_END}`);
  });

  it("does not add a second block when setup runs again", () => {
    const once = upsertBlock("alias ll='ls -l'\n", "v1");
    const twice = upsertBlock(once, "v1");
    expect(twice).toBe(once);
    expect(count(twice, BLOCK_START)).toBe(1);
  });

  it("replaces an old block in place and keeps lines after it", () => {
    const old = `a\n${BLOCK_START}\nold\n${BLOCK_END}\nb\n`;
    expect(upsertBlock(old, "new")).toBe(`a\n${BLOCK_START}\nnew\n${BLOCK_END}\nb\n`);
  });

  it("works on an empty rc file", () => {
    expect(upsertBlock("", "x")).toBe(`\n${BLOCK_START}\nx\n${BLOCK_END}\n`);
  });
});
