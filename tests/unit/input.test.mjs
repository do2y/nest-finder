// NF-003 input validation. Expected values follow the policy finalized in Notion log 4/5 (fixed before implementation).
import { describe, it, expect } from "vitest";
import { parseManwon, parseSaveRate, validateInputs, errorMessage, LIMITS } from "../../public/calc/input.js";

const asset = (s) => parseManwon(s, { max: LIMITS.ASSET_MANWON_MAX });
const income = (s) => parseManwon(s, { max: LIMITS.INCOME_MANWON_MAX });
const ok = (value) => ({ ok: true, value });
const err = (code) => ({ ok: false, code });

describe("parseManwon — accepted inputs", () => {
  it.each([
    ["T3-01", "1500", 1500],
    ["T3-02 trim surrounding whitespace", " 1500 ", 1500],
    ["T3-03 comma", "1,500", 1500],
    ["T3-04 multiple comma groups", "1,500,000", 1500000],
    ["T3-05 explicit 0", "0", 0],
    ["T3-21 leading zeros allowed without comma", "0015", 15],
    ["000 → 0", "000", 0],
  ])("%s: %j → %d", (_id, input, expected) => {
    expect(asset(input)).toEqual(ok(expected));
  });
});

describe("parseManwon — rejected inputs (error codes)", () => {
  it.each([
    ["T3-06 empty string", "", "EMPTY"],
    ["T3-07 whitespace only", "   ", "EMPTY"],
    ["T3-08 letters", "abc", "INVALID_CHAR"],
    ["T3-09 digits+letters", "12abc", "INVALID_CHAR"],
    ["T3-10 exponent notation", "1e4", "INVALID_CHAR"],
    ["T3-11 negative", "-1", "NEGATIVE"],
    ["negative decimal", "-1.5", "NEGATIVE"],
    ["T3-12 decimal", "1.5", "DECIMAL"],
    ["decimal with comma", "1,500.5", "DECIMAL"],
    ["T3-13 wrong grouping", "1,50", "BAD_GROUPING"],
    ["T3-14 full-width digits", "１５００", "FULLWIDTH"],
    ["partly full-width", "1５00", "FULLWIDTH"],
    ["T3-18 leading comma", ",1500", "BAD_GROUPING"],
    ["T3-18 trailing comma", "1500,", "BAD_GROUPING"],
    ["T3-18 double comma", "1,,500", "BAD_GROUPING"],
    ["T3-18 comma form with leading 0", "01,500", "BAD_GROUPING"],
    ["T3-19 plus sign", "+1500", "INVALID_CHAR"],
    ["T3-19 inner space", "1 500", "INVALID_CHAR"],
    ["hexadecimal", "0x10", "INVALID_CHAR"],
  ])("%s: %j → %s", (_id, input, code) => {
    expect(asset(input)).toEqual(err(code));
  });
});

describe("parseManwon — upper bounds (safe-integer range)", () => {
  it("T3-15/16 asset bound 10,000,000만원 (100 billion won): bound is ok, bound+1 is OUT_OF_RANGE", () => {
    expect(LIMITS.ASSET_MANWON_MAX).toBe(10_000_000);
    expect(asset("10000000")).toEqual(ok(10_000_000));
    expect(asset("10,000,000")).toEqual(ok(10_000_000));
    expect(asset("10000001")).toEqual(err("OUT_OF_RANGE"));
  });
  it("T3-23 monthly income bound 100,000만원 (1 billion won)", () => {
    expect(LIMITS.INCOME_MANWON_MAX).toBe(100_000);
    expect(income("100000")).toEqual(ok(100_000));
    expect(income("100001")).toEqual(err("OUT_OF_RANGE"));
  });
  it("T3-20 a 20-digit number is rejected before Number conversion (no precision loss)", () => {
    expect(asset("99999999999999999999")).toEqual(err("OUT_OF_RANGE"));
    expect(asset("00000000000000001500")).toEqual(ok(1500));
  });
  it("non-string input (undefined/null) is treated as EMPTY", () => {
    expect(asset(undefined)).toEqual(err("EMPTY"));
    expect(asset(null)).toEqual(err("EMPTY"));
  });
});

describe("T3-22 parseSaveRate — integer 0 to 100", () => {
  it.each([["0", 0], ["100", 100], ["50", 50], [50, 50]])("%j → %d", (input, v) => {
    expect(parseSaveRate(input)).toEqual(ok(v));
  });
  it.each(["-1", "101", "50.5", "", "abc", "1e2"])("%j → RATE_OUT_OF_RANGE", (input) => {
    expect(parseSaveRate(input)).toEqual(err("RATE_OUT_OF_RANGE"));
  });
});

describe("validateInputs — combined validation", () => {
  it("all valid: values in 만원/% units, errors empty", () => {
    expect(validateInputs({ asset: "1,500", income: "400", rate: "50" })).toEqual({
      ok: true, values: { assetManwon: 1500, incomeManwon: 400, ratePct: 50 }, errors: {},
    });
  });
  it("only invalid fields are listed in errors, values is null (calculation stops)", () => {
    expect(validateInputs({ asset: "abc", income: "", rate: "50" })).toEqual({
      ok: false, values: null, errors: { asset: "INVALID_CHAR", income: "EMPTY" },
    });
  });
});

describe("errorMessage — user-facing messages", () => {
  it("every code has a non-empty message", () => {
    for (const code of ["EMPTY", "FULLWIDTH", "NEGATIVE", "DECIMAL", "INVALID_CHAR", "BAD_GROUPING", "RATE_OUT_OF_RANGE"]) {
      expect(errorMessage(code).length).toBeGreaterThan(5);
    }
  });
  it("OUT_OF_RANGE message names the upper bound", () => {
    expect(errorMessage("OUT_OF_RANGE", { max: LIMITS.ASSET_MANWON_MAX })).toContain("1,000억원");
    expect(errorMessage("OUT_OF_RANGE", { max: LIMITS.INCOME_MANWON_MAX })).toContain("10억원");
  });
  it("EMPTY message tells the user to enter 0 explicitly", () => {
    expect(errorMessage("EMPTY")).toContain("0");
  });
});
