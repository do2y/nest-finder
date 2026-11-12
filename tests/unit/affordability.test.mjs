// NF-001: asset vs listing price. Expected values were recomputed independently (exact integers) in nest-finder-evidence/phase1-design/verify_expectations.out.json.
import { describe, it, expect } from "vitest";
import { assessAffordability } from "../../public/calc/affordability.js";
import { formatRatio } from "../../public/calc/format.js";

const MAN = 10_000;
const ZAI = 192_000_000; // apt_01 자이 4단지 1억 9,200만원
const assess = (assetManwon, priceWon = ZAI) => assessAffordability({ assetWon: assetManwon * MAN, priceWon });

describe("assessAffordability — 자이 4단지 (19,200만원)", () => {
  it("T1-01 asset = price → covered, 100.0%, shortfall 0", () => {
    const r = assess(19_200);
    expect(r).toEqual({ covered: true, ratioPermille: 1000, shortfallWon: 0 });
    expect(formatRatio(r.ratioPermille)).toBe("100.0%");
  });
  it("T1-02 asset 19,199 → short, 99.9% (rounded down, never 100.0%), shortfall 10,000원", () => {
    const r = assess(19_199);
    expect(r.covered).toBe(false);
    expect(formatRatio(r.ratioPermille)).toBe("99.9%");
    expect(r.shortfallWon).toBe(10_000);
  });
  it("T1-03 13,439 / 13,440 → both short, 69.9% / 70.0%, shortfall 5,761 / 5,760만원 (no state change at 70%)", () => {
    const a = assess(13_439);
    const b = assess(13_440);
    expect([a.covered, b.covered]).toEqual([false, false]);
    expect(formatRatio(a.ratioPermille)).toBe("69.9%");
    expect(formatRatio(b.ratioPermille)).toBe("70.0%");
    expect([a.shortfallWon, b.shortfallWon]).toEqual([57_610_000, 57_600_000]);
  });
  it("T1-07 asset 0 → 0.0%, shortfall = whole price", () => {
    const r = assess(0);
    expect(formatRatio(r.ratioPermille)).toBe("0.0%");
    expect(r.shortfallWon).toBe(ZAI);
  });
  it("T1-08 asset 20,000 → covered, shows the real ratio 104.1% (104.17 rounded down), shortfall never negative", () => {
    const r = assess(20_000);
    expect(r.covered).toBe(true);
    expect(formatRatio(r.ratioPermille)).toBe("104.1%");
    expect(r.shortfallWon).toBe(0);
  });
  it("ratio rounds down even at large values: asset upper bound 1,000억 vs price", () => {
    const r = assess(10_000_000);
    expect(r.ratioPermille).toBe(Math.floor((10_000_000 * MAN * 1000) / ZAI)); // 520833
    expect(formatRatio(r.ratioPermille)).toBe("52083.3%");
  });
});

describe("assessAffordability — data-error guards", () => {
  it.each([0, -1, 1.5, NaN])("T1-06 price %s → INVALID_PRICE", (p) => {
    expect(() => assessAffordability({ assetWon: 0, priceWon: p })).toThrow("INVALID_PRICE");
  });
  it.each([-1, 0.5, NaN])("asset %s → INVALID_ASSET", (a) => {
    expect(() => assessAffordability({ assetWon: a, priceWon: ZAI })).toThrow("INVALID_ASSET");
  });
});

describe("T1-04 / T1-05 structural guarantees", () => {
  it("result depends only on asset and price (income is not an input)", () => {
    const r = assessAffordability({ assetWon: 134_400_000, priceWon: ZAI, monthlyIncomeWon: 0 });
    expect(Object.keys(r).sort()).toEqual(["covered", "ratioPermille", "shortfallWon"]);
  });
});
