// NF-002 goal simulation. Expected values come from an independent calculation (Python Decimal 50 digits / Fraction):
//   nest-finder-evidence/phase1-design/verify_expectations.out.json, price_reference.out.json
// Rule: if implementation and expected values disagree, fix the implementation. Expected values are not changed without approval.
import { describe, it, expect } from "vitest";
import { simulateGoal, priceAt, monthlySaveWon, chartRangeMonths, DEFAULT_ANNUAL_GROWTH, HORIZON_MONTHS } from "../../public/calc/simulate.js";

const MAN = 10_000;
const RAEMIAN = 150_000_000; // apt_02 래미안 센터빌 1억 5,000
const ZAI = 192_000_000; // apt_01 자이 4단지 1억 9,200
const HANNAM = 9_200_000_000; // apt_07 한남 더 힐 92억
const sim = (assetManwon, saveManwon, priceWon, annualGrowth) =>
  simulateGoal({ assetWon: assetManwon * MAN, monthlySaveWon: saveManwon * MAN, priceWon, annualGrowth });

describe("constants", () => {
  it("default growth 2%/yr, search horizon 600 months", () => {
    expect(DEFAULT_ANNUAL_GROWTH).toBe(0.02);
    expect(HORIZON_MONTHS).toBe(600);
  });
});

describe("simulateGoal — target month (expected values from independent calculation)", () => {
  it.each([
    ["T2-01 래미안 15,000 / asset 10,000 / save 200 / g=0 (exact-division boundary, ≥)", 10_000, 200, RAEMIAN, 0, "reached", 25],
    ["T2-02 래미안 15,000 / asset 9,999 / save 200 / g=0", 9_999, 200, RAEMIAN, 0, "reached", 26],
    ["T2-03 래미안 / asset = price / g=2%", 15_000, 200, RAEMIAN, 0.02, "already", 0],
    ["T2-04 래미안 / asset > price / g=2%", 15_001, 200, RAEMIAN, 0.02, "already", 0],
    ["T2-05 래미안 / asset 10,000 / save 0 / g=2%", 10_000, 0, RAEMIAN, 0.02, "beyond_horizon", null],
    ["T2-06 래미안 15,000 / asset 10,000 / save 200 / g=2%", 10_000, 200, RAEMIAN, 0.02, "reached", 29],
    ["T2-07 자이 19,200 / asset 10,000 / save 200 / g=2%", 10_000, 200, ZAI, 0.02, "reached", 56],
    ["T2-08 자이 19,200 / asset 1,500 / save 200 / g=2% (plan input)", 1_500, 200, ZAI, 0.02, "reached", 108],
    ["T2-09 한남 더 힐 920,000 / asset 0 / save 1,000 / g=0 (920 months > 600)", 0, 1_000, HANNAM, 0, "beyond_horizon", null],
    ["T2-09 한남 더 힐 / asset 0 / save 1,000 / g=2%", 0, 1_000, HANNAM, 0.02, "beyond_horizon", null],
  ])("%s → %s %s", (_id, a, s, p, g, status, months) => {
    const r = sim(a, s, p, g);
    expect(r.status).toBe(status);
    expect(r.months).toBe(months);
  });

  it("T2-10 horizon boundary: synthetic price 60,000만원 / asset 0 / save 100 / g=0 → 600 reached, price +1원 → beyond_horizon", () => {
    expect(simulateGoal({ assetWon: 0, monthlySaveWon: 100 * MAN, priceWon: 600_000_000, annualGrowth: 0 })).toMatchObject({ status: "reached", months: 600 });
    expect(simulateGoal({ assetWon: 0, monthlySaveWon: 100 * MAN, priceWon: 600_000_001, annualGrowth: 0 })).toMatchObject({ status: "beyond_horizon", months: null });
  });

  it("annualGrowth defaults to 2% when omitted (same result as T2-06)", () => {
    expect(simulateGoal({ assetWon: 10_000 * MAN, monthlySaveWon: 200 * MAN, priceWon: RAEMIAN }).months).toBe(29);
  });
});

describe("T2-11 invariant — target month t is the first month where asset ≥ price", () => {
  const cases = [[10_000, 200, RAEMIAN, 0.02], [10_000, 200, ZAI, 0.02], [1_500, 200, ZAI, 0.02], [9_999, 200, RAEMIAN, 0], [0, 100, 600_000_000, 0]];
  it.each(cases)("asset %d / save %d / price %d / g %d", (a, s, p, g) => {
    const r = sim(a, s, p, g);
    const t = r.months;
    expect(r.series[t].assetWon).toBeGreaterThanOrEqual(r.series[t].priceWon);
    expect(r.series[t - 1].assetWon).toBeLessThan(r.series[t - 1].priceWon);
    for (let k = 0; k < t; k++) expect(r.series[k].assetWon).toBeLessThan(r.series[k].priceWon);
  });
});

describe("T2-12 period text and chart data come from the same result", () => {
  it("series covers 0 to 600 months, chart range is derived from the same result", () => {
    const r = sim(10_000, 200, RAEMIAN, 0.02);
    expect(r.series).toHaveLength(HORIZON_MONTHS + 1);
    expect(r.series[0].month).toBe(0);
    expect(r.series[600].month).toBe(600);
    expect(chartRangeMonths(r)).toBe(48); // reached at 29 → max(48, 29)
    expect(chartRangeMonths(sim(1_500, 200, ZAI, 0.02))).toBe(108);
    expect(chartRangeMonths(sim(10_000, 0, RAEMIAN, 0.02))).toBe(600); // not reached → full horizon
    expect(chartRangeMonths(sim(15_000, 200, RAEMIAN, 0.02))).toBe(48); // already reached
  });
});

describe("T2-13 price rounding policy — Decimal reference (round half up to the won)", () => {
  const REF = {
    192000000: { 0: 192000000, 1: 192317104, 6: 193910495, 12: 195840000, 36: 203751936, 60: 211983514, 120: 234046929, 414: 380195660, 600: 516784902 },
    150000000: { 0: 150000000, 1: 150247737, 6: 151492574, 12: 153000000, 36: 159181200, 60: 165612120, 120: 182849163, 414: 297027859, 600: 403738204 },
    1560000000: { 12: 1591200000, 36: 1655484480, 600: 4198877325 },
    1850000000: { 12: 1887000000, 36: 1963234800, 600: 4979437854 },
    3520000000: { 12: 3590400000, 36: 3735452160, 600: 9474389862 },
    2480000000: { 12: 2529600000, 36: 2631795840, 600: 6675138312 },
    9200000000: { 0: 9200000000, 1: 9215194548, 12: 9384000000, 36: 9763113600, 414: 18217708686, 600: 24762609867 },
  };
  for (const [p0, table] of Object.entries(REF)) {
    it(`listing ${p0}: price(t) matches the reference (exact-integer months like 36 do not gain +1원)`, () => {
      for (const [t, expected] of Object.entries(table)) expect(priceAt(Number(p0), Number(t), 0.02)).toBe(expected);
    });
  }
  it("g=0 keeps the price fixed", () => {
    expect(priceAt(RAEMIAN, 600, 0)).toBe(RAEMIAN);
  });
});

describe("T2-14 savings are added at the end of each month", () => {
  it("series[0] = current asset (nothing added yet), series[1] = asset + one month of savings", () => {
    const r = sim(10_000, 200, RAEMIAN, 0.02);
    expect(r.series[0].assetWon).toBe(10_000 * MAN);
    expect(r.series[1].assetWon).toBe(10_200 * MAN);
    expect(r.series[12].assetWon).toBe(12_400 * MAN);
  });
});

describe("T2-15 monthly savings = income × rate (exact won integer)", () => {
  it.each([[400, 50, 2_000_000], [401, 50, 2_005_000], [333, 33, 1_098_900], [0, 50, 0], [400, 0, 0], [100_000, 100, 1_000_000_000]])(
    "%d만원 × %d%% = %d원",
    (inc, rate, won) => {
      const v = monthlySaveWon(inc, rate);
      expect(v).toBe(won);
      expect(Number.isSafeInteger(v)).toBe(true);
    },
  );
});

describe("input guards", () => {
  it.each([
    [{ assetWon: -1, monthlySaveWon: 0, priceWon: RAEMIAN }],
    [{ assetWon: 0, monthlySaveWon: -1, priceWon: RAEMIAN }],
    [{ assetWon: 0, monthlySaveWon: 0, priceWon: 0 }],
    [{ assetWon: 0.5, monthlySaveWon: 0, priceWon: RAEMIAN }],
  ])("invalid input %j → exception", (args) => {
    expect(() => simulateGoal(args)).toThrow();
  });
});
