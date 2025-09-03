export default function sm2(
  prevEF: number,
  prevInterval: number,
  attempt: number,
  qualityScore: number,
): { newEF: number; newInterval: number } {
  // Update ease factor
  let EF =
    prevEF + (0.1 - (5 - qualityScore) * (0.08 + (5 - qualityScore) * 0.02));
  if (EF < 1.3) EF = 1.3;

  let interval: number;
  if (qualityScore < 3) {
    // Fail -> start over
    interval = 1;
  } else {
    if (attempt === 1) interval = 1;
    else if (attempt === 2) interval = 6;
    else interval = Math.round(prevInterval * EF);
  }
  return { newEF: EF, newInterval: interval };
}
