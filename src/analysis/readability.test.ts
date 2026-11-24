import { describe, expect, it } from "bun:test";
import { displayGrade, gradeBand, meterCells, METER_CELLS } from "./readability.ts";

describe("gradeBand", () => {
  it.each([
    [0, 8, "good"],
    [8, 8, "good"],
    [9, 8, "ok"],
    [11, 8, "ok"],
    [12, 8, "dense"],
    [6, 5, "ok"],
  ] as const)("grade %d with target %d is %s", (grade, target, band) => {
    expect(gradeBand(grade, target)).toBe(band);
  });
});

describe("displayGrade", () => {
  it.each([
    [-4.2, 0],
    [0.4, 0],
    [8.5, 9],
    [13.49, 13],
  ])("ARI %d shows as grade %d", (ari, grade) => {
    expect(displayGrade(ari)).toBe(grade);
  });
});

describe("meterCells", () => {
  it("fills cells up to the grade and marks the target past the fill", () => {
    const cells = meterCells(5, 8);
    expect(cells.filter((c) => c === "filled")).toHaveLength(5);
    expect(cells[7]).toBe("target");
    expect(cells[5]).toBe("empty");
  });

  it("marks a filled target when the grade passes it", () => {
    const cells = meterCells(10, 8);
    expect(cells[7]).toBe("targetFilled");
    expect(cells.filter((c) => c === "filled" || c === "targetFilled")).toHaveLength(10);
  });

  it("never grows past the meter for very high grades", () => {
    expect(meterCells(40, 8)).toHaveLength(METER_CELLS);
  });
});
