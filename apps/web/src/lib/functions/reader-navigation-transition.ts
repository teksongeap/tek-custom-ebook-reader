/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { PageMotionSound } from './page-motion-sound.ts';

let activeTransition: ViewTransition | undefined;
let cancelActiveMotion: ((handoff?: boolean) => void) | undefined;

type ReaderNavigationOptions = {
  kind?: 'jump' | 'section';
  direction?: 1 | -1;
  vertical?: boolean;
  onMotion?: () => PageMotionSound;
  onInstant?: () => void;
};

/** Keep the old reading page visible until the destination is mounted and positioned. */
export async function transitionReaderNavigation(
  update: () => Promise<void>,
  options: ReaderNavigationOptions = {}
) {
  cancelActiveMotion?.(options.kind === 'section');
  activeTransition?.skipTransition();

  if (
    typeof document === 'undefined' ||
    !document.startViewTransition ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    await update();
    options.onInstant?.();
    return;
  }

  let transition: ViewTransition;
  try {
    transition = document.startViewTransition(update);
  } catch {
    await update();
    options.onInstant?.();
    return;
  }
  activeTransition = transition;
  if (options.kind === 'section') {
    transition.types?.add('ttu-reader-unfurl');
    if (options.direction === -1) transition.types?.add('ttu-reader-backward');
    if (options.vertical) transition.types?.add('ttu-reader-vertical');
  }
  let motion: PageMotionSound | undefined;
  let frame: number | undefined;
  let ended = false;
  const stopMotion = (completed: boolean, handoff = false) => {
    if (ended) return;
    ended = true;
    if (frame !== undefined) cancelAnimationFrame(frame);
    if (completed || handoff) motion?.finish();
    else motion?.cancel();
  };
  const cancelMotion = (handoff = false) => stopMotion(false, handoff);
  cancelActiveMotion = cancelMotion;

  // Read the compositor's actual eased progress, including the old/new page
  // delays. Loading the next section does not consume any of the sound.
  void transition.ready
    .then(() => {
      if (ended || activeTransition !== transition || !options.onMotion) return;
      const animations = (document.getAnimations?.() ?? []).filter((animation) => {
        const effect = animation.effect as KeyframeEffect | null;
        return (
          !!effect?.pseudoElement &&
          /::view-transition-(old|new)\(ttu-reader-page\)/.test(effect.pseudoElement)
        );
      });
      const effects = animations.map((animation) => animation.effect!);
      if (!effects.length) return;
      motion = options.onMotion();
      let previousProgress = 0;
      let previousTimestamp = performance.now();
      const sample = (timestamp: number) => {
        if (ended) return;
        const progress =
          effects.reduce((sum, effect) => sum + (effect.getComputedTiming().progress ?? 0), 0) /
          effects.length;
        const elapsed = Math.max(0.001, (timestamp - previousTimestamp) / 1000);
        const remaining = Math.max(
          ...animations.map((animation) =>
            typeof animation.currentTime === 'number'
              ? (Number(animation.effect!.getComputedTiming().endTime) - animation.currentTime) /
                1000
              : NaN
          )
        );
        motion?.update(
          progress,
          (progress - previousProgress) / elapsed,
          options.direction ?? 1,
          Number.isFinite(remaining) ? Math.max(0, remaining) : undefined
        );
        previousTimestamp = timestamp;
        previousProgress = progress;
        frame = requestAnimationFrame(sample);
      };
      frame = requestAnimationFrame(sample);
    })
    .catch(() => {});
  void transition.finished
    .then(
      () => stopMotion(activeTransition === transition),
      () => stopMotion(false)
    )
    .finally(() => {
      if (activeTransition === transition) activeTransition = undefined;
      if (cancelActiveMotion === cancelMotion) cancelActiveMotion = undefined;
    });
  await transition.updateCallbackDone;
}
