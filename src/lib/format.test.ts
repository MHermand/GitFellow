import { describe, expect, it } from "vitest";
import { fmtHoursDecimal, fmtMinutes, fmtPercent } from "./format";

describe("format", () => {
  it("fmtMinutes", () => {
    expect(fmtMinutes(0)).toBe("0h00");
    expect(fmtMinutes(285)).toBe("4h45");
    expect(fmtMinutes(59.6)).toBe("1h00");
  });
  it("fmtPercent utilise une espace fine insécable", () => {
    expect(fmtPercent(0.317, "fr")).toBe("32\u202f%");
    expect(fmtPercent(0.317, "en")).toBe("32%");
  });
  it("fmtHoursDecimal", () => {
    expect(fmtHoursDecimal(90, 2, "fr")).toBe("1,50");
    expect(fmtHoursDecimal(90)).toBe("1.50");
  });
});
