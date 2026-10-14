import { describe, expect, it } from "vitest";

import { toOdometerCells } from "./odometer";

describe("toOdometerCells", () => {
  it("rolls digits and keeps currency symbols and separators static", () => {
    expect(toOdometerCells("R$ 9,50")).toEqual([
      { key: "s7R", char: "R", digit: null },
      { key: "s6$", char: "$", digit: null },
      { key: "s5 ", char: " ", digit: null },
      { key: "d4", char: "9", digit: 9 },
      { key: "s3,", char: ",", digit: null },
      { key: "d2", char: "5", digit: 5 },
      { key: "d1", char: "0", digit: 0 },
    ]);
  });

  it("keeps the units columns when the value gains a digit on the left", () => {
    const before = toOdometerCells("R$ 99,00").filter((cell) => cell.digit !== null);
    const after = toOdometerCells("R$ 100,00").filter((cell) => cell.digit !== null);

    expect(after.map((cell) => cell.key)).toEqual(["d6", ...before.map((cell) => cell.key)]);
  });

  it("treats a minus sign as a static character", () => {
    expect(toOdometerCells("-R$ 1,00")[0]).toEqual({ key: "s8-", char: "-", digit: null });
  });
});
