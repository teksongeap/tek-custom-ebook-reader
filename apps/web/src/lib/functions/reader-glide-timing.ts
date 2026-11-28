/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/** Forecast the reader spring's settling point for the B1 lead-in. */
export function getGlideRemainingSeconds(
  displacement: number,
  velocity: number,
  stiffness: number
) {
  const coefficient = velocity + stiffness * displacement;
  const settled = (time: number) => {
    const decay = Math.exp(-stiffness * time);
    return (
      Math.abs((displacement + coefficient * time) * decay) <= 0.25 &&
      Math.abs((velocity - stiffness * coefficient * time) * decay) <= 8
    );
  };
  if (settled(0)) return 0;
  let lower = 0;
  let upper = 1 / 60;
  while (!settled(upper) && upper < 8) upper *= 2;
  for (let index = 0; index < 24; index += 1) {
    const middle = (lower + upper) / 2;
    if (settled(middle)) upper = middle;
    else lower = middle;
  }
  return upper;
}
