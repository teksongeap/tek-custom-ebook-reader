/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

const hoverFocusBlockSelector = 'p, .para, .reader-paragraph, li, blockquote, dd, dt';
const hoverFocusFallbackBlockSelector = 'div, section, article';
const hoverFocusPopupSelector =
  '.yomichan-popup, .yomichan-float, .yomitan-popup, .yomitan-float, [data-yomichan-popup], [data-yomitan-popup]';

export function hoverFocus(node: HTMLElement, enabled: boolean) {
  let currentEnabled = enabled;
  let activeContentEl: HTMLElement | undefined;
  let activeBlock: Element | undefined;
  let lastBlock: Element | undefined;
  let timer = 0;

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

  const clear = () => {
    window.clearTimeout(timer);
    lastBlock = undefined;

    const contentEl = activeContentEl || getBookContentEl(node);

    if (contentEl) {
      activate(contentEl, undefined);
    }
  };

  const scheduleActivate = (contentEl: HTMLElement, block: Element) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (!currentEnabled || !contentEl.isConnected || hasVisibleHoverFocusPopup()) {
        return;
      }

      activate(contentEl, block);
    }, 120);
  };

  const onPointerOver = (event: PointerEvent) => {
    if (!currentEnabled || event.pointerType === 'touch' || hasVisibleHoverFocusPopup()) {
      return;
    }

    const target = event.target;

    if (!(target instanceof Element) || isInHoverFocusPopup(target)) {
      return;
    }

    const contentEl = getBookContentEl(target);
    const block = contentEl ? getHoverFocusBlock(contentEl, target) : undefined;

    if (!contentEl || !block || block === lastBlock) {
      return;
    }

    lastBlock = block;
    scheduleActivate(contentEl, block);
  };

  const onPointerLeave = (event: PointerEvent) => {
    if (
      event.relatedTarget instanceof Element &&
      (node.contains(event.relatedTarget) || isInHoverFocusPopup(event.relatedTarget))
    ) {
      return;
    }

    if (!hasVisibleHoverFocusPopup()) {
      clear();
    }
  };

  node.addEventListener('pointerover', onPointerOver, { capture: true, passive: true });
  node.addEventListener('pointerleave', onPointerLeave, { passive: true });

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
      clear();
    }
  };
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

function isInHoverFocusPopup(target: Element) {
  return !!target.closest(hoverFocusPopupSelector);
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
