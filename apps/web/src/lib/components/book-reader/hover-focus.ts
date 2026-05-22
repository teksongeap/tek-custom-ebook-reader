/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

const hoverFocusBlockSelector = 'p, .para, .reader-paragraph, li, blockquote, dd, dt';
const hoverFocusFallbackBlockSelector = 'div, section, article';
const hoverFocusActivateDelay = 120;
const hoverFocusDeactivateDelay = 240;
const hoverFocusPopupSelector =
  '.yomichan-popup, .yomichan-float, .yomitan-popup, .yomitan-float, [data-yomichan-popup], [data-yomitan-popup], .annotation-toolbar, [data-ttu-annotation-card], .app-popover-panel, .app-dialog, .app-loading-dialog, [role="dialog"]';

export function hoverFocus(node: HTMLElement, enabled: boolean) {
  let currentEnabled = enabled;
  let activeContentEl: HTMLElement | undefined;
  let activeBlock: Element | undefined;
  let activateTimer = 0;
  let deactivateTimer = 0;
  let lastPointerClientX = Number.NaN;
  let lastPointerClientY = Number.NaN;

  const rememberPointerPosition = (event: PointerEvent) => {
    lastPointerClientX = event.clientX;
    lastPointerClientY = event.clientY;
  };

  const getElementsAtLastPointerPosition = () => {
    if (!Number.isFinite(lastPointerClientX) || !Number.isFinite(lastPointerClientY)) {
      return [];
    }

    return document.elementsFromPoint(lastPointerClientX, lastPointerClientY);
  };

  const isPointerOverIsolatedPopupHost = () =>
    getElementsAtLastPointerPosition().some(isLikelyIsolatedPopupHost);

  const hasBlockingPopup = () => hasVisibleHoverFocusPopup() || isPointerOverIsolatedPopupHost();

  const activate = (contentEl: HTMLElement, block: Element | undefined) => {
    if (activeContentEl === contentEl && activeBlock === block) {
      return;
    }

    activeBlock?.classList.remove('book-content__hover-focus-active');
    activeContentEl?.classList.remove('book-content--hover-focus-dim');

    activeContentEl = block ? contentEl : undefined;
    activeBlock = block;

    activeBlock?.classList.add('book-content__hover-focus-active');
    activeContentEl?.classList.add('book-content--hover-focus-dim');
  };

  const clearActivateTimer = () => {
    window.clearTimeout(activateTimer);
    activateTimer = 0;
  };

  const clearDeactivateTimer = () => {
    window.clearTimeout(deactivateTimer);
    deactivateTimer = 0;
  };

  const clear = () => {
    clearActivateTimer();
    clearDeactivateTimer();

    const contentEl = activeContentEl || getBookContentEl(node);

    if (contentEl) {
      activate(contentEl, undefined);
    }
  };

  const schedulePointerActivate = () => {
    clearActivateTimer();
    activateTimer = window.setTimeout(() => {
      activateTimer = 0;

      if (!currentEnabled || !node.isConnected) {
        return;
      }

      if (hasBlockingPopup()) {
        schedulePointerActivate();
        return;
      }

      activateAtLastPointerPosition();
    }, hoverFocusActivateDelay);
  };

  const scheduleActivate = (contentEl: HTMLElement, block: Element) => {
    clearActivateTimer();
    activateTimer = window.setTimeout(() => {
      activateTimer = 0;

      if (!currentEnabled || !contentEl.isConnected || hasBlockingPopup()) {
        return;
      }

      activate(contentEl, block);
    }, hoverFocusActivateDelay);
  };

  const scheduleDeactivate = () => {
    clearActivateTimer();
    clearDeactivateTimer();

    deactivateTimer = window.setTimeout(() => {
      deactivateTimer = 0;

      if (!currentEnabled || !node.isConnected) {
        clear();
        return;
      }

      // Popups often live outside the reader, so preserve the last active paragraph
      // until the popup is gone.
      if (hasBlockingPopup()) {
        scheduleDeactivate();
        return;
      }

      if (activateAtLastPointerPosition()) {
        return;
      }

      clear();
    }, hoverFocusDeactivateDelay);
  };

  const onPointerOver = (event: PointerEvent) => {
    if (!currentEnabled || event.pointerType === 'touch') {
      return;
    }

    rememberPointerPosition(event);

    const target = event.target;

    if (!(target instanceof Element) || isHoverFocusPopupTarget(target)) {
      return;
    }

    clearDeactivateTimer();

    if (hasBlockingPopup()) {
      schedulePointerActivate();
      return;
    }

    const contentEl = getBookContentEl(target);
    const block = contentEl ? getHoverFocusBlock(contentEl, target) : undefined;

    if (!contentEl || !block || block === activeBlock) {
      return;
    }

    scheduleActivate(contentEl, block);
  };

  const onPointerLeave = (event: PointerEvent) => {
    rememberPointerPosition(event);

    if (event.relatedTarget instanceof Element && node.contains(event.relatedTarget)) {
      return;
    }

    scheduleDeactivate();
  };

  const onDocumentPointerOver = (event: PointerEvent) => {
    if (!currentEnabled || event.pointerType === 'touch' || !activeBlock) {
      return;
    }

    rememberPointerPosition(event);

    const target = event.target;

    if (target instanceof Element && node.contains(target)) {
      clearDeactivateTimer();
      return;
    }

    scheduleDeactivate();
  };

  node.addEventListener('pointerover', onPointerOver, { capture: true, passive: true });
  node.addEventListener('pointerleave', onPointerLeave, { passive: true });
  document.addEventListener('pointerover', onDocumentPointerOver, { capture: true, passive: true });

  return {
    update(nextEnabled: boolean) {
      currentEnabled = nextEnabled;

      if (!currentEnabled) {
        clear();
      }
    },
    destroy() {
      node.removeEventListener('pointerover', onPointerOver, { capture: true });
      node.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('pointerover', onDocumentPointerOver, { capture: true });
      clear();
    }
  };

  function activateAtLastPointerPosition() {
    const target = getElementsAtLastPointerPosition().find(
      (element) => node.contains(element) && getBookContentEl(element)
    );
    const contentEl = target ? getBookContentEl(target) : undefined;
    const block = contentEl && target ? getHoverFocusBlock(contentEl, target) : undefined;

    if (!contentEl || !block) {
      return false;
    }

    clearDeactivateTimer();

    if (block !== activeBlock) {
      scheduleActivate(contentEl, block);
    }

    return true;
  }
}

function getBookContentEl(target: Element) {
  return target.closest<HTMLElement>('.book-content');
}

function getHoverFocusBlock(contentEl: HTMLElement, target: Element) {
  const blockquote = target.closest('blockquote');

  if (blockquote && contentEl.contains(blockquote)) {
    return blockquote;
  }

  const explicitBlock = target.closest(hoverFocusBlockSelector);

  if (explicitBlock && contentEl.contains(explicitBlock)) {
    return explicitBlock;
  }

  const fallbackBlock = target.closest(hoverFocusFallbackBlockSelector);

  if (
    fallbackBlock &&
    contentEl.contains(fallbackBlock) &&
    !fallbackBlock.querySelector(hoverFocusBlockSelector) &&
    hasReadableText(fallbackBlock)
  ) {
    return fallbackBlock;
  }

  return undefined;
}

function hasReadableText(block: Element) {
  return !!block.textContent?.replace(/\s/g, '');
}

function hasVisibleHoverFocusPopup() {
  return Array.from(document.querySelectorAll<HTMLElement>(hoverFocusPopupSelector)).some(
    isVisibleHoverFocusPopup
  );
}

function isHoverFocusPopupTarget(target: Element) {
  return !!target.closest(hoverFocusPopupSelector) || isLikelyIsolatedPopupHost(target);
}

function isLikelyIsolatedPopupHost(target: Element) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  // Modern Yomitan hosts the popup iframe inside a closed shadow root on an
  // anonymous div, so the page can only see the retargeted host element.
  return (
    target.localName === 'div' &&
    target.style.getPropertyValue('all') === 'initial' &&
    target.style.getPropertyPriority('all') === 'important'
  );
}

function isVisibleHoverFocusPopup(popup: HTMLElement) {
  const style = window.getComputedStyle(popup);
  const rect = popup.getBoundingClientRect();

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    Number(style.opacity) !== 0
  );
}
