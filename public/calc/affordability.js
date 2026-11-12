// NF-001 asset vs listing price (pure function). Does not judge whether a loan is possible.

/**
 * @param {{assetWon: number, priceWon: number}} p won integers
 * @returns {{covered: boolean, ratioPermille: number, shortfallWon: number}}
 *   ratioPermille = floor(asset/price × 1000) — rounded down to one decimal place of %, so it never looks better than it is
 */
export function assessAffordability({ assetWon, priceWon }) {
  if (!Number.isSafeInteger(priceWon) || priceWon <= 0) throw new RangeError("INVALID_PRICE");
  if (!Number.isSafeInteger(assetWon) || assetWon < 0) throw new RangeError("INVALID_ASSET");
  const numerator = assetWon * 1000; // max 1e14 (asset bound 1e11 won) < MAX_SAFE_INTEGER
  const ratioPermille = (numerator - (numerator % priceWon)) / priceWon; // exact integer division
  return {
    covered: assetWon >= priceWon,
    ratioPermille,
    shortfallWon: Math.max(0, priceWon - assetWon),
  };
}
