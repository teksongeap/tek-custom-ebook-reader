/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import {
  NEVER,
  filter,
  fromEvent,
  map,
  merge,
  race,
  switchMap,
  take,
  takeUntil,
  tap,
  throttleTime,
  timer
} from 'rxjs';

import { FuriganaStyle } from '../../data/furigana-style';
import { nextChapter$ } from '$lib/components/book-reader/book-toc/book-toc';
import { pulseElement } from '$lib/functions/range-util';
import { readerFootnoteRequest$ } from '$lib/functions/reader-reference-layer/footnote';
import {
  createReaderLinkReference,
  getElementSourceHref,
  readReaderLinkReference
} from '$lib/functions/reader-reference-layer/epub-reference';
import { readerTargetNavigation$ } from '$lib/functions/reader-reference-layer/navigation';
import { toggleImageGalleryPictureSpoiler$ } from '$lib/components/book-reader/book-reader-image-gallery/book-reader-image-gallery';

const legacyHrefAttribute = 'data-ttu-legacy-href';

export function reactiveElements(
  document: Document,
  furiganaStyle: FuriganaStyle,
  hideSpoilerImage: boolean,
  isExtendedMode: boolean
) {
  const anchorTagDocumentListener = anchorTagListener(document);
  const spoilerImageDocumentListener = spoilerImageListener(document);

  return (contentEl: HTMLElement) =>
    merge(
      anchorTagDocumentListener(contentEl),
      rubyTagListener(contentEl, furiganaStyle),
      spoilerImageDocumentListener(contentEl),
      openImageInNewTab(contentEl, hideSpoilerImage, isExtendedMode)
    );
}

function anchorTagListener(document: Document) {
  return (contentEl: HTMLElement) => {
    const anchorTags = Array.from(contentEl.getElementsByTagName('a'));
    anchorTags.forEach((el) => {
      if (!readReaderLinkReference(el) && !el.hasAttribute(legacyHrefAttribute)) {
        const originalHref = el.getAttribute('href');

        if (originalHref) {
          el.setAttribute(legacyHrefAttribute, originalHref);
        }
      }

      el.href = document.location.pathname + el.hash;
    });

    return fromDelegatedClickEvent<HTMLAnchorElement>(contentEl, 'a').pipe(
      tap(({ element }) => {
        const reference =
          readReaderLinkReference(element) || readLegacyReaderLinkReference(element);

        if (reference?.kind === 'external') {
          if (reference.targetHref) {
            window.open(reference.targetHref, '_blank', 'noopener,noreferrer');
          }
          return;
        }

        if (reference) {
          if (reference.kind === 'footnote') {
            readerFootnoteRequest$.next({
              reference,
              target: reference.target
            });
            return;
          }

          readerTargetNavigation$.next({
            target: reference.target,
            highlight: reference.kind !== 'backlink'
          });
          return;
        }

        nextChapter$.next(element.hash.substring(1));
      })
    );
  };
}

function readLegacyReaderLinkReference(element: HTMLAnchorElement) {
  const originalHref = element.getAttribute(legacyHrefAttribute);
  const sourceHref = getElementSourceHref(element);

  return sourceHref && originalHref
    ? createReaderLinkReference(sourceHref, originalHref, element)
    : undefined;
}

function rubyTagListener(contentEl: HTMLElement, furiganaStyle: FuriganaStyle) {
  if (furiganaStyle === FuriganaStyle.Hide) {
    return NEVER;
  }

  const isToggle = furiganaStyle === FuriganaStyle.Toggle;
  return fromDelegatedClickEvent<HTMLElement>(contentEl, 'ruby').pipe(
    tap(({ element }) => {
      if (isToggle) {
        element.classList.toggle('reveal-rt');
        return;
      }

      element.classList.add('reveal-rt');
    })
  );
}

function spoilerImageListener(document: Document) {
  return (contentEl: HTMLElement) => {
    const elements = Array.from(contentEl.querySelectorAll('[data-ttu-spoiler-img]'));
    elements.forEach((el) => {
      const spoilerLabelEl = document.createElement('span');
      spoilerLabelEl.title = 'Show Image';
      spoilerLabelEl.classList.add('spoiler-label');
      spoilerLabelEl.setAttribute('aria-hidden', 'true');
      spoilerLabelEl.innerText = 'ネタバレ';
      el.appendChild(spoilerLabelEl);

      const imageElement = el.querySelector('img,image');

      toggleImageGalleryPictureSpoiler(imageElement, false);
    });

    return fromDelegatedClickEvent<HTMLElement>(contentEl, '[data-ttu-spoiler-img]').pipe(
      tap(({ element }) => {
        element.querySelector('.spoiler-label')?.remove();
        element.removeAttribute('data-ttu-spoiler-img');

        const imageElement = element.querySelector('img,image');
        imageElement?.classList.add('ttu-unspoilered');

        toggleImageGalleryPictureSpoiler(imageElement, true);
      })
    );
  };
}

function openImageInNewTab(
  contentEl: HTMLElement,
  hideSpoilerImage: boolean,
  isExtendedMode: boolean
) {
  const selector = isExtendedMode ? 'img,image' : 'image';

  contentEl.querySelectorAll<HTMLElement>(selector).forEach((elm) => {
    elm.draggable = false;
  });

  return merge(
    fromEvent<MouseEvent>(contentEl, 'contextmenu').pipe(
      tap((event) => {
        if (isExtendedMode && getDelegatedTarget<HTMLElement>(event, contentEl, selector)) {
          event.preventDefault();
        }
      })
    ),
    fromEvent<PointerEvent>(contentEl, 'pointerdown').pipe(
      map((event) => ({
        event,
        element: getDelegatedTarget<HTMLElement>(event, contentEl, selector)
      })),
      filter(
        (data): data is { event: PointerEvent; element: HTMLElement } => data.element !== undefined
      ),
      switchMap(({ event, element }) => {
        const { clientX, clientY } = event;

        return timer(1000).pipe(
          map(() => element),
          takeUntil(
            race(
              fromEvent<PointerEvent>(contentEl, 'pointermove').pipe(
                throttleTime(200, undefined, { trailing: true }),
                filter((event2) => {
                  const { clientX: newX, clientY: newY } = event2;

                  return Math.abs(clientX - newX) > 5 || Math.abs(clientY - newY) > 5;
                })
              ),
              fromEvent(contentEl, 'pointerup'),
              fromEvent(contentEl, 'pointercancel')
            )
          )
        );
      }),
      filter(
        (element) =>
          !hideSpoilerImage ||
          element.classList.contains('ttu-unspoilered') ||
          !element.closest('span[data-ttu-spoiler-img]')
      ),
      switchMap((element) => {
        pulseElement(
          element.parentElement && element.tagName.toLowerCase() === 'image'
            ? element.parentElement
            : element,
          'add',
          0.5,
          500
        );

        return merge(fromEvent(contentEl, 'pointerup'), fromEvent(contentEl, 'pointercancel')).pipe(
          take(1),
          tap(() => {
            const src = element.getAttribute('src') || element.getAttribute('href');

            if (src) {
              window.open(src, '_blank');
            }
          })
        );
      })
    )
  );
}

function toggleImageGalleryPictureSpoiler(imageElement: Element | null, unspoilered: boolean) {
  if (imageElement instanceof HTMLImageElement) {
    toggleImageGalleryPictureSpoiler$.next({ url: imageElement.src, unspoilered });
  } else if (imageElement && 'href' in imageElement) {
    toggleImageGalleryPictureSpoiler$.next({
      url: (imageElement.href as SVGAnimatedString).baseVal,
      unspoilered
    });
  }
}

function fromDelegatedClickEvent<T extends Element>(contentEl: HTMLElement, selector: string) {
  return fromEvent<MouseEvent>(contentEl, 'click').pipe(
    map((event) => ({
      event,
      element: getDelegatedTarget<T>(event, contentEl, selector)
    })),
    filter((data): data is { event: MouseEvent; element: T } => data.element !== undefined),
    tap(({ event }) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    })
  );
}

function getDelegatedTarget<T extends Element>(
  event: Event,
  contentEl: HTMLElement,
  selector: string
) {
  const target = event.target;

  if (!(target instanceof Element)) {
    return undefined;
  }

  const element = target.closest(selector);

  if (!element || !contentEl.contains(element)) {
    return undefined;
  }

  return element as T;
}
