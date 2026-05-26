/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

const activeReferenceTargetClass = 'book-content__reference-target-active';
const activeReferenceRootClass = 'book-content--reference-target-active';
export const referenceTargetHoverFocusEvent = 'ttu-reference-target-hover-focus';
export const referenceTargetHighlightDuration = 2400;
export type ReferenceTargetHoverFocusEventDetail = {
  targetElement: Element;
  duration: number;
};
const referenceTargetBlockSelector = [
  'blockquote',
  'dd',
  'dt',
  'figcaption',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'p',
  'pre',
  'td',
  'th',
  '.para',
  '.reader-paragraph'
].join(',');
const activeReferenceTargetTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
const activeReferenceRootTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

export function highlightReaderTargetElement(
  element: Element | undefined | null,
  duration = referenceTargetHighlightDuration
) {
  const targetElement = getReferenceHighlightElement(element);

  if (!targetElement) {
    return;
  }

  const contentElement = targetElement.closest<HTMLElement>('.book-content');
  const activeTimer = activeReferenceTargetTimers.get(targetElement);

  if (activeTimer) {
    clearTimeout(activeTimer);
  }

  if (contentElement) {
    const activeRootTimer = activeReferenceRootTimers.get(contentElement);

    if (activeRootTimer) {
      clearTimeout(activeRootTimer);
    }

    contentElement.classList.add(activeReferenceRootClass);
  }

  targetElement.classList.remove(activeReferenceTargetClass);
  // Restart the CSS animation when the same target is selected repeatedly.
  void targetElement.offsetWidth;
  targetElement.classList.add(activeReferenceTargetClass);
  requestReaderTargetHoverFocus(targetElement, duration);

  const timer = setTimeout(() => {
    targetElement.classList.remove(activeReferenceTargetClass);
    activeReferenceTargetTimers.delete(targetElement);
  }, duration);

  activeReferenceTargetTimers.set(targetElement, timer);

  if (contentElement) {
    const rootTimer = setTimeout(() => {
      contentElement.classList.remove(activeReferenceRootClass);
      activeReferenceRootTimers.delete(contentElement);
    }, duration);

    activeReferenceRootTimers.set(contentElement, rootTimer);
  }
}

export function requestReaderTargetHoverFocus(
  element: Element | undefined | null,
  duration = referenceTargetHighlightDuration
) {
  if (!(element instanceof Element)) {
    return;
  }

  element.dispatchEvent(
    new CustomEvent<ReferenceTargetHoverFocusEventDetail>(referenceTargetHoverFocusEvent, {
      bubbles: true,
      detail: {
        targetElement: element,
        duration
      }
    })
  );
}

function getReferenceHighlightElement(element: Element | undefined | null) {
  if (!(element instanceof HTMLElement)) {
    return undefined;
  }

  if (element.matches(referenceTargetBlockSelector)) {
    return element;
  }

  const contentElement = element.closest<HTMLElement>('.book-content');
  const closestBlock = element.closest<HTMLElement>(referenceTargetBlockSelector);

  if (contentElement && closestBlock && contentElement.contains(closestBlock)) {
    return closestBlock;
  }

  return Array.from(element.querySelectorAll<HTMLElement>(referenceTargetBlockSelector)).find(
    (block) => !!block.textContent?.replace(/\s/g, '')
  );
}
