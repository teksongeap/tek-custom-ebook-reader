/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

const animatedScrollPositions = new WeakMap<HTMLElement, number>();

export function setReaderAnimatedScrollPosition(
  element: HTMLElement,
  position: number | undefined
) {
  if (position === undefined) animatedScrollPositions.delete(element);
  else animatedScrollPositions.set(element, position);
}

/** Include temporary glide movement when navigating to text during an animation. */
export function getReaderScrollPosition(element: HTMLElement, vertical: boolean) {
  return animatedScrollPositions.get(element) ?? element[vertical ? 'scrollTop' : 'scrollLeft'];
}

/** Reserve space beyond the 40px column gap so adjacent text is actually visible. */
export function getGlidePageSize(availableSize: number, preferredSize = availableSize) {
  const previewSize = Math.min(128, Math.max(64, availableSize * 0.1));
  const minimumPageSize = Math.min(160, availableSize);

  return Math.max(minimumPageSize, Math.min(preferredSize, availableSize - previewSize * 2));
}

/** The reading page excludes the neighboring text visible in the outer margins. */
export function getReaderViewportRect(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const insetX = Number(element.dataset.ttuViewportInsetX) || 0;
  const insetY = Number(element.dataset.ttuViewportInsetY) || 0;

  return new DOMRect(
    rect.left + insetX,
    rect.top + insetY,
    rect.width - insetX * 2,
    rect.height - insetY * 2
  );
}
