/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { SoundEngine } from '$lib/functions/sound-engine';
import { writableBooleanLocalStorageSubject } from './internal/writable-boolean-local-storage-subject';
import { writableNumberLocalStorageSubject } from './internal/writable-number-local-storage-subject';
import { writableStringLocalStorageSubject } from './internal/writable-string-local-storage-subject';
import {
  defaultPageSoundStyle,
  normalizePageSoundStyle,
  type PageSoundStyle
} from '$lib/functions/page-sounds';

export const soundEnabled$ = writableBooleanLocalStorageSubject()('soundEnabled', true);
export const soundVolume$ = writableNumberLocalStorageSubject()('soundVolume', 40);
export const pageSoundStyle$ = writableStringLocalStorageSubject<PageSoundStyle>()(
  'pageSoundStyle',
  defaultPageSoundStyle
);
// Apply the chosen default once; later explicit choices continue to persist.
const pageSoundDefaultVersion$ = writableNumberLocalStorageSubject()('pageSoundDefaultVersion', 0);
if (pageSoundDefaultVersion$.value < 1) {
  pageSoundStyle$.next(defaultPageSoundStyle);
  pageSoundDefaultVersion$.next(1);
}
export const pageTurnSoundEnabled$ = writableBooleanLocalStorageSubject()(
  'pageTurnSoundEnabled',
  true
);

export const soundDesign = new SoundEngine(
  () => {
    if (typeof window === 'undefined') return undefined;
    const AudioContextClass =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    return AudioContextClass ? new AudioContextClass() : undefined;
  },
  () => typeof document !== 'undefined' && document.visibilityState !== 'hidden'
);

export function configureSoundDesign() {
  soundDesign.configure(
    soundEnabled$.value,
    soundVolume$.value / 100,
    pageTurnSoundEnabled$.value,
    normalizePageSoundStyle(pageSoundStyle$.value)
  );
}

// Also keep the engine current when a control changes outside the settings page.
soundEnabled$.subscribe(configureSoundDesign);
soundVolume$.subscribe(configureSoundDesign);
pageTurnSoundEnabled$.subscribe(configureSoundDesign);
pageSoundStyle$.subscribe(configureSoundDesign);
