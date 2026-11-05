import { expect, it } from "vitest";
import { parseExploreNumber } from "./explore-input";

it.each([
  ["₱9,000", false, "9000"],
  ["24,000.50", false, "24000.50"],
  ["3%", true, "3"],
  ["0", false, "0"],
  ["-1", false, "-1"],
  ["9,00", false, null],
  ["abc", false, null],
  ["", false, null],
  ["₱3", true, null],
] as const)(
  "parses %s independently of correctness",
  (text, rate, expected) => {
    expect(parseExploreNumber(text, rate)).toBe(expected);
  },
);
