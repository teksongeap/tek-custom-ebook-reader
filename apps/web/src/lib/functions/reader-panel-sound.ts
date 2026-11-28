/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

type ReaderPanel = 'contents' | 'search' | 'annotations';

/** The same panel gestures share cues, with a jump replacing its resulting close. */
export function createReaderPanelSound(play: (cue: 'open' | 'close' | 'navigate') => void) {
  let active: ReaderPanel | undefined;
  let closingAfterJump: ReaderPanel | undefined;
  return {
    update(panel: ReaderPanel | undefined) {
      if (panel === active) return;
      const previous = active;
      active = panel;
      if (panel) play('open');
      else if (closingAfterJump !== previous) play('close');
      closingAfterJump = undefined;
    },
    navigate(panel: ReaderPanel, closesPanel = true) {
      closingAfterJump = closesPanel ? panel : undefined;
      play('navigate');
    }
  };
}
