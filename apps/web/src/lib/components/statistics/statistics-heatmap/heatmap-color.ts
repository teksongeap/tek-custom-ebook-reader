/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

export function getHeatmapAccentPercentage(minimum: number, maximum: number, value: number) {
  const ratio = maximum > minimum ? (value - minimum) / (maximum - minimum) : 1;
  return 25 + Math.min(1, Math.max(0, ratio)) * 75;
}
