// Display formatting (pure functions). Exact amounts, no rounding.

const group = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** won integer → '1억 9,200만원', '5,761만원', '200만 5,000원', '0원' */
export function formatKRW(won) {
  if (!Number.isSafeInteger(won) || won < 0) throw new RangeError(`formatKRW: non-negative safe integer required (${won})`);
  if (won === 0) return "0원";
  const eok = Math.floor(won / 100_000_000);
  const man = Math.floor((won % 100_000_000) / 10_000);
  const rest = won % 10_000;
  const parts = [];
  if (eok > 0) parts.push(`${group(eok)}억`);
  if (man > 0) parts.push(`${group(man)}만`);
  if (rest > 0) parts.push(group(rest));
  return `${parts.join(" ")}원`;
}

/** Simulation result → period text */
export function formatPeriod({ status, months }) {
  if (status === "already") return "지금 바로";
  if (status === "beyond_horizon") return "50년 이내 목표 도달 어려움";
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m}개월 뒤`;
  if (m === 0) return `${y}년 뒤`;
  return `${y}년 ${m}개월 뒤`;
}

/** permille integer (already rounded down) → '69.9%' */
export function formatRatio(permille) {
  return `${Math.floor(permille / 10)}.${permille % 10}%`;
}
