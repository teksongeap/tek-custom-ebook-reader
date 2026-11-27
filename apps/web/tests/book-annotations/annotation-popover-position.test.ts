/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAnnotationAnchorIndex,
  getAnnotationPopoverPosition
} from '../../src/lib/components/book-reader/book-annotations/annotation-popover-position.ts';

const rect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height
});
const viewport = { left: 0, top: 0, width: 1200, height: 800 };

function position(overrides: Partial<Parameters<typeof getAnnotationPopoverPosition>[0]> = {}) {
  return getAnnotationPopoverPosition({
    anchor: rect(600, 60, 24, 680),
    viewport,
    width: 360,
    height: 160,
    vertical: true,
    point: { x: 612, y: 300 },
    ...overrides
  });
}

test('vertical notes open to the right near the hovered word, even on full-height text', () => {
  assert.deepEqual(position(), { left: 638, top: 276, placement: 'right' });
});

test('vertical notes flip left at the right edge instead of falling below the whole passage', () => {
  assert.deepEqual(position({ anchor: rect(1050, 40, 24, 700), point: { x: 1060, y: 250 } }), {
    left: 676,
    top: 226,
    placement: 'left'
  });
});

test('vertical placement stays on screen near the top and bottom edges', () => {
  assert.equal(position({ point: { x: 612, y: 60 } }).top, 36);
  assert.equal(position({ point: { x: 612, y: 740 } }).top, 628);
});

test('narrow screens use nearby above/below placement when neither side fits', () => {
  const narrow = { left: 0, top: 0, width: 390, height: 844 };
  const options = { viewport: narrow, anchor: rect(190, 40, 24, 750), width: 360 };
  assert.deepEqual(position({ ...options, point: { x: 202, y: 400 } }), {
    left: 18,
    top: 214,
    placement: 'top'
  });
  assert.deepEqual(position({ ...options, point: { x: 202, y: 60 } }), {
    left: 18,
    top: 86,
    placement: 'bottom'
  });
});

test('placement respects a zoomed or keyboard-shifted visual viewport', () => {
  const shifted = { left: 100, top: 200, width: 600, height: 400 };
  const result = position({
    viewport: shifted,
    anchor: rect(160, 230, 24, 300),
    width: 300,
    point: { x: 172, y: 500 }
  });
  assert.deepEqual(result, { left: 198, top: 428, placement: 'right' });
});

test('horizontal notes retain above/below placement on their actual text line', () => {
  assert.deepEqual(position({ vertical: false, anchor: rect(300, 300, 240, 24) }), {
    left: 240,
    top: 126,
    placement: 'top'
  });
  assert.deepEqual(position({ vertical: false, anchor: rect(300, 30, 240, 24) }), {
    left: 240,
    top: 68,
    placement: 'bottom'
  });
});

test('hovering a wrapped span selects its actual column instead of a multi-column union', () => {
  const fragments = [rect(800, 60, 24, 650), rect(730, 60, 24, 650), rect(660, 60, 24, 650)];
  assert.equal(getAnnotationAnchorIndex(fragments, viewport, true, { x: 742, y: 450 }), 1);
  assert.equal(getAnnotationAnchorIndex(fragments, viewport, true, { x: 672, y: 100 }), 2);
});

test('keyboard and programmatic opens choose the first visible fragment in reading order', () => {
  const vertical = [rect(800, -900, 24, 500), rect(660, 60, 24, 650), rect(730, 60, 24, 650)];
  assert.equal(getAnnotationAnchorIndex(vertical, viewport, true), 2);
  const horizontal = [rect(100, 400, 400, 24), rect(200, 100, 300, 24), rect(100, 100, 80, 24)];
  assert.equal(getAnnotationAnchorIndex(horizontal, viewport, false), 2);
});

test('fragment selection ignores hidden and off-screen fragments and tolerates tiny gaps', () => {
  const fragments = [rect(1400, 40, 24, 500), rect(700, 50, 0, 300), rect(600, 50, 24, 500)];
  assert.equal(getAnnotationAnchorIndex(fragments, viewport, true, { x: 628, y: 100 }), 2);
  assert.equal(getAnnotationAnchorIndex([], viewport, true), -1);
  assert.equal(getAnnotationAnchorIndex([rect(0, -300, 24, 100)], viewport, true), -1);
});
