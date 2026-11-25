/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

let activeTransition: ViewTransition | undefined;

type ReaderNavigationOptions = {
  kind?: 'jump' | 'section';
  direction?: 1 | -1;
  vertical?: boolean;
};

/** Keep the old reading page visible until the destination is mounted and positioned. */
export async function transitionReaderNavigation(
  update: () => Promise<void>,
  options: ReaderNavigationOptions = {}
) {
  activeTransition?.skipTransition();

  if (
    typeof document === 'undefined' ||
    !document.startViewTransition ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    await update();
    return;
  }

  let transition: ViewTransition;
  try {
    transition = document.startViewTransition(update);
  } catch {
    await update();
    return;
  }
  activeTransition = transition;
  if (options.kind === 'section') {
    transition.types?.add('ttu-reader-unfurl');
    if (options.direction === -1) transition.types?.add('ttu-reader-backward');
    if (options.vertical) transition.types?.add('ttu-reader-vertical');
  }
  // A skipped visual effect must not prevent the underlying navigation.
  void transition.ready.catch(() => {});
  void transition.finished
    .catch(() => {})
    .finally(() => {
      if (activeTransition === transition) activeTransition = undefined;
    });
  await transition.updateCallbackDone;
}
