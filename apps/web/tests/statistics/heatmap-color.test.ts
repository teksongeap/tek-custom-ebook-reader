/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { getHeatmapAccentPercentage } from '../../src/lib/components/statistics/statistics-heatmap/heatmap-color.ts';

test('heatmap shades distinguish activity levels even when the minimum is large', () => {
  assert.equal(getHeatmapAccentPercentage(1000, 2000, 1000), 25);
  assert.equal(getHeatmapAccentPercentage(1000, 2000, 1500), 62.5);
  assert.equal(getHeatmapAccentPercentage(1000, 2000, 2000), 100);
});

test('heatmap shades stay bounded outside the scale and for a single activity level', () => {
  assert.equal(getHeatmapAccentPercentage(1000, 2000, 0), 25);
  assert.equal(getHeatmapAccentPercentage(1000, 2000, 3000), 100);
  assert.equal(getHeatmapAccentPercentage(1000, 1000, 1000), 100);
});
