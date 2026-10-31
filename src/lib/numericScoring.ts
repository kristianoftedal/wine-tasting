/**
 * Scoring for the numeric parts of a tasting.
 *
 * Two kinds of number are compared, and they need different formulas.
 *
 * Open-ended quantities — alcohol percentage and price — have no fixed range,
 * so the error is measured relative to the size of the value itself
 * (`ratioSimilarity`). Being 10 kr off on a 100 kr wine is a worse guess than
 * 10 kr off on a 1 000 kr wine.
 *
 * The four Vinmonopolet scales — fylde, friskhet, garvestoff, sødme — run from
 * 0 to 12 and the taster picks a point on the same scale. Here the ratio
 * formula gets it exactly backwards: a one-step miss on a sødme-1 wine scored
 * 50, while the same one-step miss on a fylde-11 wine scored 92, because the
 * denominator was the value rather than the scale. Dry wines sit at sødme 1–2,
 * so sødme was systematically the harshest component. `scaleSimilarity`
 * measures the error against the scale's range instead, so a one-step miss
 * costs the same 8 points wherever on the scale it happens.
 *
 * A reference value of 0 is a real reading on these scales (a bone-dry wine
 * has sødme 0) and must be scored, not skipped. The previous call site used a
 * truthiness check, so a wine at 0 wrote 0 for the taster no matter what they
 * answered. Callers should test for `null`, not falsiness.
 */

const SCALE_RANGE = 12;

const parseNumber = (val: string | number | undefined | null): number => {
  if (val === undefined || val === null || val === '' || val === '-') return Number.NaN;
  const cleaned = String(val).replace(/[^\d.,]/g, '');
  return Number.parseFloat(cleaned.replace(',', '.'));
};

/** Error relative to the larger of the two values. For open-ended quantities. */
export function ratioSimilarity(
  userValue: string | number | undefined | null,
  actualValue: string | number | undefined | null
): number {
  const userNum = parseNumber(userValue);
  const actualNum = parseNumber(actualValue);
  if (Number.isNaN(userNum) || Number.isNaN(actualNum)) return 0;
  if (userNum === actualNum) return 100;

  const maxVal = Math.max(userNum, actualNum);
  if (maxVal <= 0) return 0;
  const difference = Math.abs(userNum - actualNum);
  return Math.max(0, Math.round((1 - difference / maxVal) * 100));
}

/** Error relative to the scale's range. For the fixed 0–12 Vinmonopolet scales. */
export function scaleSimilarity(
  userValue: string | number | undefined | null,
  actualValue: string | number | undefined | null,
  range: number = SCALE_RANGE
): number {
  const userNum = parseNumber(userValue);
  const actualNum = parseNumber(actualValue);
  if (Number.isNaN(userNum) || Number.isNaN(actualNum)) return 0;

  const difference = Math.abs(userNum - actualNum);
  return Math.max(0, Math.round((1 - difference / range) * 100));
}
