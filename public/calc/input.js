// NF-003 input validation (pure functions). Amounts are non-negative integers in 만원 (10,000 won).
import { formatKRW } from "./format.js";

// Upper bounds: keep every intermediate value safely below Number.MAX_SAFE_INTEGER (about 9.007e15).
// Largest intermediate = ratio numerator (asset bound + income bound × 600 months) × 1000 won = 7e14 → about 12.9× headroom
export const LIMITS = Object.freeze({
  ASSET_MANWON_MAX: 10_000_000, // 100 billion won
  INCOME_MANWON_MAX: 100_000, // 1 billion won per month
});

const MESSAGES = {
  EMPTY: "금액을 입력해 주세요. 없으면 0을 입력하세요.",
  FULLWIDTH: "전각 숫자는 사용할 수 없어요. 반각 숫자로 입력해 주세요.",
  NEGATIVE: "0 이상의 금액을 입력해 주세요.",
  DECIMAL: "만원 단위 정수로 입력해 주세요. (예: 1500)",
  INVALID_CHAR: "숫자와 쉼표(,)만 입력할 수 있어요.",
  BAD_GROUPING: "쉼표는 세 자리마다 넣어 주세요. (예: 1,500)",
  RATE_OUT_OF_RANGE: "저축률은 0~100% 사이의 정수여야 해요.",
};

export function errorMessage(code, { max } = {}) {
  if (code === "OUT_OF_RANGE") return `최대 ${formatKRW(max * 10_000)}까지 입력할 수 있어요.`;
  return MESSAGES[code] ?? "입력값을 확인해 주세요.";
}

const fail = (code) => ({ ok: false, code });

/**
 * Parse a 만원 amount string. Check order: EMPTY → FULLWIDTH → NEGATIVE → DECIMAL → INVALID_CHAR → BAD_GROUPING → OUT_OF_RANGE
 * @returns {{ok: true, value: number} | {ok: false, code: string}}
 */
export function parseManwon(text, { max }) {
  const s = (text === undefined || text === null ? "" : String(text)).trim();
  if (s === "") return fail("EMPTY");
  if (/[０-９]/.test(s)) return fail("FULLWIDTH");
  if (/^-[\d.,]/.test(s)) return fail("NEGATIVE");
  if (/^[\d,]*\d\.\d+$/.test(s)) return fail("DECIMAL");
  if (!/^[\d,]+$/.test(s)) return fail("INVALID_CHAR");
  let digits = s;
  if (s.includes(",")) {
    if (!/^[1-9]\d{0,2}(,\d{3})+$/.test(s)) return fail("BAD_GROUPING");
    digits = s.replace(/,/g, "");
  }
  digits = digits.replace(/^0+(?=\d)/, ""); // drop leading zeros (keep "0")
  // Reject by digit count before Number conversion to avoid precision loss
  if (digits.length > String(max).length) return fail("OUT_OF_RANGE");
  const value = Number(digits);
  if (value > max) return fail("OUT_OF_RANGE");
  return { ok: true, value };
}

/** Savings rate: integer 0 to 100 (%) */
export function parseSaveRate(raw) {
  const s = (raw === undefined || raw === null ? "" : String(raw)).trim();
  if (!/^\d{1,3}$/.test(s)) return fail("RATE_OUT_OF_RANGE");
  const value = Number(s);
  return value <= 100 ? { ok: true, value } : fail("RATE_OUT_OF_RANGE");
}

/** Validate all inputs together. If any is invalid, values = null (calculation stops) */
export function validateInputs({ asset, income, rate }) {
  const a = parseManwon(asset, { max: LIMITS.ASSET_MANWON_MAX });
  const i = parseManwon(income, { max: LIMITS.INCOME_MANWON_MAX });
  const r = parseSaveRate(rate);
  const errors = {};
  if (!a.ok) errors.asset = a.code;
  if (!i.ok) errors.income = i.code;
  if (!r.ok) errors.rate = r.code;
  const ok = a.ok && i.ok && r.ok;
  return { ok, values: ok ? { assetManwon: a.value, incomeManwon: i.value, ratePct: r.value } : null, errors };
}
