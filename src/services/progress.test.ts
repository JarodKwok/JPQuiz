import { describe, expect, it } from "vitest";
import { calculateMasteryPercent } from "./progress";

describe("progress calculation", () => {
  it("calculates weighted mastery percentages", () => {
    const percent = calculateMasteryPercent(
      ["a", "b", "c", "d"],
      {
        a: "mastered",
        b: "fuzzy",
        c: "weak",
      }
    );

    expect(percent).toBe(38);
  });

  it("returns zero for empty item list", () => {
    expect(calculateMasteryPercent([], {})).toBe(0);
  });
});
