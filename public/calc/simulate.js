// NF-002 goal-reach simulation (pure functions). The period text and the chart both use this one result.

export const DEFAULT_ANNUAL_GROWTH = 0.02; // listing price growth per year (assumption)
export const HORIZON_MONTHS = 600; // search horizon: 50 years
export const MIN_CHART_MONTHS = 48;

/** Monthly savings (won) = income (만원) × rate (%) → income × 100 × rate, always an exact integer */
export function monthlySaveWon(incomeManwon, ratePct) {
  return incomeManwon * 100 * ratePct;
}

/**
 * Price after t months = round(price × (1+g)^(t/12)) — monthly compounding of an annual rate.
 * Recomputed from the original price every month (no accumulated rounding error), rounded to the nearest won.
 * (Math.ceil gains +1원 from float error at exact-integer points such as month 36 → not used)
 */
export function priceAt(priceWon, month, annualGrowth = DEFAULT_ANNUAL_GROWTH) {
  if (annualGrowth === 0) return priceWon;
  return Math.round(priceWon * Math.pow(1 + annualGrowth, month / 12));
}

function assertWon(name, v, { positive = false } = {}) {
  if (!Number.isSafeInteger(v) || v < 0 || (positive && v === 0)) throw new RangeError(`simulateGoal: invalid ${name} (${v})`);
}

/**
 * Savings are added at the end of each month: asset after t months = current asset + monthly savings × t (no interest on savings).
 * Target month = smallest t (0 ≤ t ≤ horizon) with asset(t) ≥ price(t).
 * @returns {{status: 'already'|'reached'|'beyond_horizon', months: number|null, series: {month:number, assetWon:number, priceWon:number}[]}}
 */
export function simulateGoal({ assetWon, monthlySaveWon: save, priceWon, annualGrowth = DEFAULT_ANNUAL_GROWTH, horizonMonths = HORIZON_MONTHS }) {
  assertWon("assetWon", assetWon);
  assertWon("monthlySaveWon", save);
  assertWon("priceWon", priceWon, { positive: true });
  const series = [];
  let months = null;
  for (let t = 0; t <= horizonMonths; t++) {
    const point = { month: t, assetWon: assetWon + save * t, priceWon: priceAt(priceWon, t, annualGrowth) };
    series.push(point);
    if (months === null && point.assetWon >= point.priceWon) months = t;
  }
  const status = months === null ? "beyond_horizon" : months === 0 ? "already" : "reached";
  return { status, months, series };
}

/** Months to show on the chart: reached → max(48, target month), not reached → full horizon */
export function chartRangeMonths(result) {
  if (result.status === "beyond_horizon") return result.series.length - 1;
  return Math.max(MIN_CHART_MONTHS, result.months);
}
