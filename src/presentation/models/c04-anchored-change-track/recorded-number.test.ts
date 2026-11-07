import { describe, expect, it } from "vitest";
import { recordedNumber } from "./recorded-number";

describe("recordedNumber", () => {
  it("groups pesos and writes a true minus sign", () => {
    expect(recordedNumber("30000", "₱")).toBe("₱30,000");
    expect(recordedNumber("-3000", "₱")).toBe("−₱3,000");
    expect(recordedNumber("1500", "₱")).toBe("₱1,500");
    expect(recordedNumber("0", "₱")).toBe("₱0");
  });
  it("adds the percent sign and keeps decimals", () => {
    expect(recordedNumber("-10", "%")).toBe("−10%");
    expect(recordedNumber("12.5", "%")).toBe("12.5%");
    expect(recordedNumber("-0", "%")).toBe("0%");
  });
  it("leaves anything that is not a plain number as entered", () => {
    expect(recordedNumber("abc", "₱")).toBe("abc");
  });
});
