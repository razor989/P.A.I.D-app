import { expect, it } from "vitest";
import { normalizeApplyNumber } from "./apply-draft";

it.each([
  ["₱30,000", "30000"],
  [" PHP 27,000 ", "27000"],
  ["−3,000", "-3000"],
  ["−10%", "-10"],
  ["-10.25", "-10.25"],
  ["UNDEFINED", "UNDEFINED"],
  ["30,00", "30,00"],
  ["3,000,00", "3,000,00"],
  ["1e3", "1e3"],
  ["", ""],
])(
  "normalizes presentation syntax without inferring answers: %s",
  (raw, expected) => {
    expect(normalizeApplyNumber(raw)).toBe(expected);
  },
);
