/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createReaderPanelSound } from '../../src/lib/functions/reader-panel-sound.ts';

for (const panel of ['contents', 'search', 'annotations'] as const) {
  test(`${panel} uses one opening and closing cue regardless of repeated state updates`, () => {
    const cues: string[] = [];
    const sound = createReaderPanelSound((cue) => cues.push(cue));
    sound.update(undefined);
    sound.update(panel);
    sound.update(panel);
    sound.update(undefined);
    sound.update(undefined);
    assert.deepEqual(cues, ['open', 'close']);
  });

  test(`${panel} jumps share a navigation cue without a second close sound`, () => {
    const cues: string[] = [];
    const sound = createReaderPanelSound((cue) => cues.push(cue));
    sound.update(panel);
    sound.navigate(panel);
    sound.update(panel); // Contents can wait for the destination before closing.
    sound.update(undefined);
    sound.update(panel);
    sound.update(undefined);
    assert.deepEqual(cues, ['open', 'navigate', 'open', 'close']);
  });
}

test('chapter navigation that keeps Contents open preserves its later close cue', () => {
  const cues: string[] = [];
  const sound = createReaderPanelSound((cue) => cues.push(cue));
  sound.update('contents');
  sound.navigate('contents', false);
  sound.update('contents');
  sound.update(undefined);
  assert.deepEqual(cues, ['open', 'navigate', 'close']);
});

test('switching between panels uses one opening cue for the new panel', () => {
  const cues: string[] = [];
  const sound = createReaderPanelSound((cue) => cues.push(cue));
  sound.update('contents');
  sound.update('search');
  sound.update('annotations');
  sound.update(undefined);
  assert.deepEqual(cues, ['open', 'open', 'open', 'close']);
});
