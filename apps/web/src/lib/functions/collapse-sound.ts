/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { PageMotionSound } from './page-motion-sound.ts';
import type { PageSoundVoice } from './page-sounds.ts';

/** A dry contraction: falling pitch, narrowing harmonics, and a firm cutoff. */
export function getCollapseSoundVoices(duration = 0.16): PageSoundVoice[] {
  return [1, 2].map((harmonic) => ({
    frequency: [
      { time: 0, value: 880 * harmonic },
      { time: duration * 0.78, value: 587.33 * harmonic, curve: 'exponential' },
      { time: duration, value: 587.33 * harmonic }
    ],
    gain:
      harmonic === 1
        ? [
            { time: 0, value: 0 },
            { time: duration * 0.025, value: 0.07 },
            { time: duration * 0.55, value: 0.09 },
            { time: duration * 0.9, value: 0.11 },
            { time: duration * 0.97, value: 0.08 },
            { time: duration, value: 0 }
          ]
        : [
            { time: 0, value: 0 },
            { time: duration * 0.025, value: 0.025 },
            { time: duration * 0.55, value: 0.008 },
            { time: duration * 0.85, value: 0 },
            { time: duration, value: 0 }
          ],
    offset: 0,
    duration
  }));
}

/** Follow the rendered height so CSS easing, interruption, and reduced motion stay congruent. */
export function followCollapseAnimation(
  element: HTMLElement,
  begin: () => PageMotionSound,
  instant: () => void
) {
  let frame: number | undefined;
  let motion: PageMotionSound | undefined;
  let stopped = false;
  const cancel = () => {
    if (stopped) return;
    stopped = true;
    if (frame !== undefined) cancelAnimationFrame(frame);
    motion?.cancel();
  };
  frame = requestAnimationFrame(() => {
    if (stopped) return;
    if (!element.isConnected) {
      cancel();
      return;
    }
    const animation = element
      .getAnimations?.()
      .find((item) => (item as CSSTransition).transitionProperty === 'height');
    if (!animation?.effect) {
      stopped = true;
      instant();
      return;
    }
    const effect = animation.effect as KeyframeEffect;
    const keyframes = effect.getKeyframes();
    const start = parseFloat(String(keyframes[0]?.height));
    const end = parseFloat(String(keyframes.at(-1)?.height));
    motion = begin();
    const sample = () => {
      if (stopped) return;
      if (!element.isConnected) {
        cancel();
        return;
      }
      const progress =
        Number.isFinite(start) && Number.isFinite(end) && start > end
          ? (start - element.getBoundingClientRect().height) / (start - end)
          : (effect.getComputedTiming().progress ?? 0);
      motion?.update(Math.min(1, Math.max(0, progress)), 4, 1);
      frame = requestAnimationFrame(sample);
    };
    sample();
    void animation.finished.then(() => {
      if (stopped) return;
      stopped = true;
      if (frame !== undefined) cancelAnimationFrame(frame);
      motion?.update(1, 0, 1);
      motion?.finish();
    }, cancel);
  });
  return cancel;
}
