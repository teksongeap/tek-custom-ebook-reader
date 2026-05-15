/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { BooksDbAnnotation } from '$lib/data/database/books-db/versions/books-db';
import { getAnnotationColorValue } from './annotation-colors';

const annotationHighlightClass = 'book-annotation-highlight';

export interface RenderedAnnotationSpan {
  annotation: BooksDbAnnotation;
  span: HTMLSpanElement;
}

export function serializeAnnotationRange(range: Range, contentRoot: HTMLElement | undefined) {
  if (!contentRoot || range.collapsed) {
    return undefined;
  }

  const startSectionEl = findAnnotationSectionElement(range.startContainer, contentRoot);
  const endSectionEl = findAnnotationSectionElement(range.endContainer, contentRoot);

  if (!startSectionEl || !endSectionEl || startSectionEl !== endSectionEl) {
    return undefined;
  }

  const startOffset = getTextOffset(startSectionEl, range.startContainer, range.startOffset);
  const endOffset = getTextOffset(startSectionEl, range.endContainer, range.endOffset);
  const selectedText = range.toString().trim();

  if (startOffset === undefined || endOffset === undefined || startOffset >= endOffset) {
    return undefined;
  }

  if (!selectedText) {
    return undefined;
  }

  const sectionText = startSectionEl.textContent || '';

  return {
    sectionId: startSectionEl.id,
    startOffset,
    endOffset,
    text: selectedText,
    prefix: sectionText.slice(Math.max(0, startOffset - 40), startOffset),
    suffix: sectionText.slice(endOffset, Math.min(sectionText.length, endOffset + 40))
  };
}

export function restoreAnnotationRange(
  document: Document,
  contentRoot: HTMLElement,
  annotation: BooksDbAnnotation
) {
  const sectionEl = findAnnotationSectionById(contentRoot, annotation.anchor.sectionId);

  if (!sectionEl) {
    return undefined;
  }

  const startPoint = getTextPointAtOffset(sectionEl, annotation.anchor.startOffset);
  const endPoint = getTextPointAtOffset(sectionEl, annotation.anchor.endOffset);

  if (!startPoint || !endPoint) {
    return undefined;
  }

  const range = document.createRange();

  try {
    range.setStart(startPoint.node, startPoint.offset);
    range.setEnd(endPoint.node, endPoint.offset);
  } catch (_) {
    return undefined;
  }

  if (range.collapsed || !range.toString().trim()) {
    return undefined;
  }

  return range;
}

export function renderAnnotationHighlights(
  document: Document,
  contentRoot: HTMLElement,
  annotations: BooksDbAnnotation[]
) {
  const renderedSpans: RenderedAnnotationSpan[] = [];

  clearAnnotationHighlights(contentRoot);

  annotations
    .slice()
    .sort((a, b) => b.anchor.startOffset - a.anchor.startOffset)
    .forEach((annotation) => {
      const range = restoreAnnotationRange(document, contentRoot, annotation);

      if (!range) {
        return;
      }

      renderedSpans.push(
        ...wrapRangeWithAnnotation(document, range, annotation).map((span) => ({
          annotation,
          span
        }))
      );
    });

  return renderedSpans;
}

export function clearAnnotationHighlights(contentRoot: HTMLElement) {
  const highlightSpans = Array.from(
    contentRoot.querySelectorAll<HTMLSpanElement>(`.${annotationHighlightClass}`)
  );

  highlightSpans.forEach((highlightSpan) => {
    const parent = highlightSpan.parentNode;

    if (!parent) {
      return;
    }

    while (highlightSpan.firstChild) {
      parent.insertBefore(highlightSpan.firstChild, highlightSpan);
    }

    parent.removeChild(highlightSpan);
    parent.normalize();
  });
}

export function getAnnotationClientRect(annotationId: string) {
  const spans = Array.from(
    document.querySelectorAll<HTMLSpanElement>(
      `.${annotationHighlightClass}[data-ttu-annotation-id="${annotationId}"]`
    )
  );

  return getUnionRect(spans.map((span) => span.getBoundingClientRect()));
}

function findAnnotationSectionElement(node: Node, contentRoot: HTMLElement) {
  let currentNode: Node | null = node;
  let sectionElement: HTMLElement | undefined;

  while (currentNode && currentNode !== contentRoot.parentNode) {
    if (currentNode instanceof HTMLElement && currentNode.id) {
      sectionElement = currentNode;
    }

    currentNode = currentNode.parentNode;
  }

  return sectionElement;
}

function findAnnotationSectionById(contentRoot: HTMLElement, sectionId: string) {
  if (contentRoot.id === sectionId) {
    return contentRoot;
  }

  return Array.from(contentRoot.querySelectorAll<HTMLElement>('[id]')).find(
    (element) => element.id === sectionId
  );
}

function getTextOffset(root: HTMLElement, container: Node, offset: number) {
  let textOffset = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let currentNode = walker.nextNode();

  while (currentNode) {
    if (currentNode === container) {
      return textOffset + offset;
    }

    if (container instanceof Element && currentNode.parentNode === container) {
      const childIndex = Array.prototype.indexOf.call(container.childNodes, currentNode);

      if (childIndex >= offset) {
        return textOffset;
      }
    }

    textOffset += currentNode.textContent?.length || 0;
    currentNode = walker.nextNode();
  }

  if (container === root && offset >= root.childNodes.length) {
    return textOffset;
  }

  return undefined;
}

function getTextPointAtOffset(root: HTMLElement, targetOffset: number) {
  let textOffset = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let currentNode = walker.nextNode();

  while (currentNode) {
    const textLength = currentNode.textContent?.length || 0;
    const nextTextOffset = textOffset + textLength;

    if (targetOffset <= nextTextOffset) {
      return {
        node: currentNode,
        offset: Math.max(0, Math.min(textLength, targetOffset - textOffset))
      };
    }

    textOffset = nextTextOffset;
    currentNode = walker.nextNode();
  }

  return undefined;
}

function wrapRangeWithAnnotation(document: Document, range: Range, annotation: BooksDbAnnotation) {
  const textNodes = getTextNodesInRange(document, range);
  const spans: HTMLSpanElement[] = [];

  for (let index = textNodes.length - 1; index >= 0; index -= 1) {
    const textNode = textNodes[index];
    const textLength = textNode.textContent?.length || 0;
    const startOffset = textNode === range.startContainer ? range.startOffset : 0;
    const endOffset = textNode === range.endContainer ? range.endOffset : textLength;
    const safeStartOffset = Math.max(0, Math.min(textLength, startOffset));
    const safeEndOffset = Math.max(safeStartOffset, Math.min(textLength, endOffset));

    if (safeStartOffset === safeEndOffset || !textNode.parentNode) {
      continue;
    }

    let annotationTextNode = textNode;

    if (safeEndOffset < annotationTextNode.length) {
      annotationTextNode.splitText(safeEndOffset);
    }

    if (safeStartOffset > 0) {
      annotationTextNode = annotationTextNode.splitText(safeStartOffset);
    }

    const span = document.createElement('span');

    span.className = annotationHighlightClass;
    span.dataset.ttuAnnotationId = annotation.id;
    span.dataset.ttuAnnotationColor = annotation.color;
    span.tabIndex = 0;
    span.style.setProperty('--book-annotation-base', getAnnotationColorValue(annotation.color));

    annotationTextNode.parentNode.insertBefore(span, annotationTextNode);
    span.appendChild(annotationTextNode);
    spans.push(span);
  }

  return spans;
}

function getTextNodesInRange(document: Document, range: Range) {
  const root =
    range.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? range.commonAncestorContainer.parentNode
      : range.commonAncestorContainer;

  if (!root) {
    return [];
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  const textNodes: Text[] = [];
  let currentNode = walker.nextNode();

  while (currentNode) {
    if (currentNode instanceof Text) {
      textNodes.push(currentNode);
    }

    currentNode = walker.nextNode();
  }

  return textNodes;
}

function getUnionRect(rects: DOMRect[]) {
  const validRects = rects.filter((rect) => rect.width || rect.height);

  if (!validRects.length) {
    return undefined;
  }

  const top = Math.min(...validRects.map((rect) => rect.top));
  const right = Math.max(...validRects.map((rect) => rect.right));
  const bottom = Math.max(...validRects.map((rect) => rect.bottom));
  const left = Math.min(...validRects.map((rect) => rect.left));

  return new DOMRect(left, top, right - left, bottom - top);
}
