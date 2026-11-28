/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/** Navigation owns its cue; this fallback is only for local controls. */
export function getControlSound(target: Element): 'click' | 'toggle' | undefined {
  const control = target.closest('button, a[href], [role="button"], summary');
  if (
    !control ||
    control.closest('[data-sound="none"], [inert]') ||
    control.matches(':disabled, [aria-disabled="true"], a[href]:not([download])')
  )
    return;
  return control.hasAttribute('aria-pressed') ? 'toggle' : 'click';
}
