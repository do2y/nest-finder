// Display format: amount (T1-09), period (T2-16), ratio
import { describe, it, expect } from "vitest";
import { formatKRW, formatPeriod, formatRatio } from "../../public/calc/format.js";

describe("T1-09 formatKRW — exact amount, no rounding", () => {
  it.each([
    [0, "0원"],
    [57_610_000, "5,761만원"],
    [192_000_000, "1억 9,200만원"],
    [100_000_000, "1억원"],
    [2_005_000, "200만 5,000원"],
    [10_000, "1만원"],
    [5_000, "5,000원"],
    [9_200_000_000, "92억원"],
    [100_000_000_000, "1,000억원"],
    [177_000_000, "1억 7,700만원"],
  ])("%d → %s", (won, text) => {
    expect(formatKRW(won)).toBe(text);
  });
  it("negative or non-integer input throws", () => {
    expect(() => formatKRW(-1)).toThrow();
    expect(() => formatKRW(1.5)).toThrow();
  });
});

describe("T2-16 formatPeriod", () => {
  it.each([
    [{ status: "already", months: 0 }, "지금 바로"],
    [{ status: "reached", months: 5 }, "5개월 뒤"],
    [{ status: "reached", months: 12 }, "1년 뒤"],
    [{ status: "reached", months: 29 }, "2년 5개월 뒤"],
    [{ status: "reached", months: 108 }, "9년 뒤"],
    [{ status: "reached", months: 600 }, "50년 뒤"],
    [{ status: "beyond_horizon", months: null }, "50년 이내 목표 도달 어려움"],
  ])("%j → %s", (result, text) => {
    expect(formatPeriod(result)).toBe(text);
  });
});

describe("formatRatio — permille integer → 1 decimal place (already rounded down)", () => {
  it.each([[0, "0.0%"], [999, "99.9%"], [1000, "100.0%"], [1041, "104.1%"], [78, "7.8%"]])("%d → %s", (p, t) => {
    expect(formatRatio(p)).toBe(t);
  });
});
