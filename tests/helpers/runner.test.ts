import { describe, expect, it } from "vitest";

describe("Node verification infrastructure", () => {
  it("executes without a DOM", () => {
    expect(typeof document).toBe("undefined");
    expect(2 + 2).toBe(4);
  });
});
