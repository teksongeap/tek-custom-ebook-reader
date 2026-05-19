/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import {
  ReaderReferenceAttribute,
  getElementSourceHref,
  type ReaderTarget
} from '$lib/functions/reader-reference-layer/epub-reference';

export interface ReaderSearchBlock {
  id: string;
  target: ReaderTarget;
  text: string;
  normalizedText: string;
  preciseTarget: boolean;
  sourceHref?: string;
}

export interface ReaderSearchResult {
  id: string;
  target: ReaderTarget;
  text: string;
  sourceHref?: string;
  preciseTarget: boolean;
  matchStart: number;
  matchEnd: number;
}

export interface ReaderSearchExcerpt {
  before: string;
  match: string;
  after: string;
}

const searchableBlockSelector = [
  `[${ReaderReferenceAttribute.searchBlockId}]`,
  'blockquote',
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
  'th'
].join(',');

export function buildReaderSearchIndex(htmlContent: string) {
  if (typeof DOMParser === 'undefined' || !htmlContent) {
    return [];
  }

  const parser = new DOMParser();
  const parsedContent = parser.parseFromString(htmlContent, 'text/html');

  return Array.from(parsedContent.body.querySelectorAll<HTMLElement>(searchableBlockSelector))
    .filter(isSearchableBlock)
    .map((element, index): ReaderSearchBlock => {
      const text = getSearchableText(element);
      const sourceHref = getElementSourceHref(element);
      const blockId = element.getAttribute(ReaderReferenceAttribute.searchBlockId) || undefined;
      const { fragment, isExactFragment } = getElementFragment(element);
      const sectionId =
        element.closest<HTMLElement>('div[id^="ttu-"]')?.id ||
        element.closest<HTMLElement>('[id]')?.id ||
        undefined;

      return {
        id: blockId || `${sourceHref || sectionId || 'book'}-${index}`,
        target: {
          sourceHref,
          blockId,
          fragment,
          sectionId
        },
        text,
        normalizedText: normalizeReaderSearchText(text),
        preciseTarget: !!blockId || isExactFragment,
        sourceHref
      };
    });
}

export function annotateReaderSearchBlocks(root: Element, blockIdPrefix: string) {
  Array.from(root.querySelectorAll<HTMLElement>(searchableBlockSelector))
    .filter(isSearchableBlock)
    .forEach((block, blockIndex) => {
      if (!block.hasAttribute(ReaderReferenceAttribute.searchBlockId)) {
        block.setAttribute(
          ReaderReferenceAttribute.searchBlockId,
          `${blockIdPrefix}-${blockIndex}`
        );
      }
    });
}

export function searchReaderIndex(
  index: ReaderSearchBlock[],
  query: string,
  limit = 250
): ReaderSearchResult[] {
  const normalizedQuery = normalizeReaderSearchText(query);

  if (!normalizedQuery) {
    return [];
  }

  const results: ReaderSearchResult[] = [];

  for (const block of index) {
    const matchStart = block.normalizedText.indexOf(normalizedQuery);

    if (matchStart < 0) {
      continue;
    }

    results.push({
      id: `${block.id}-${matchStart}`,
      target: block.target,
      text: block.text,
      sourceHref: block.sourceHref,
      preciseTarget: block.preciseTarget,
      matchStart,
      matchEnd: matchStart + normalizedQuery.length
    });

    if (results.length >= limit) {
      break;
    }
  }

  return results;
}

export function getReaderSearchExcerpt(
  result: ReaderSearchResult,
  surroundingCharacters = 72
): ReaderSearchExcerpt {
  const excerptStart = Math.max(0, result.matchStart - surroundingCharacters);
  const excerptEnd = Math.min(result.text.length, result.matchEnd + surroundingCharacters);

  return {
    before: `${excerptStart > 0 ? '...' : ''}${result.text.slice(excerptStart, result.matchStart)}`,
    match: result.text.slice(result.matchStart, result.matchEnd),
    after: `${result.text.slice(result.matchEnd, excerptEnd)}${
      excerptEnd < result.text.length ? '...' : ''
    }`
  };
}

export function normalizeReaderSearchText(value: string) {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

function isSearchableBlock(element: HTMLElement) {
  if (element.closest('[hidden],[aria-hidden="true"]')) {
    return false;
  }

  if (element.querySelector(searchableBlockSelector)) {
    return false;
  }

  return !!getSearchableText(element);
}

function getSearchableText(element: Element) {
  const textSegments: string[] = [];

  collectSearchableText(element, textSegments);

  return textSegments.join('').replace(/\s+/g, ' ').trim();
}

function getElementFragment(element: Element) {
  if (element.id) {
    return { fragment: element.id, isExactFragment: true };
  }

  const name = element.getAttribute('name');

  if (name) {
    return { fragment: name, isExactFragment: true };
  }

  const ancestor = element.closest<HTMLElement>('[id],[name]');

  return {
    fragment: ancestor?.id || ancestor?.getAttribute('name') || undefined,
    isExactFragment: false
  };
}

function collectSearchableText(node: Node, textSegments: string[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    textSegments.push(node.textContent || '');
    return;
  }

  if (!(node instanceof Element) || isHiddenSearchNode(node)) {
    return;
  }

  node.childNodes.forEach((child) => collectSearchableText(child, textSegments));
}

function isHiddenSearchNode(element: Element) {
  return (
    element.tagName.toLowerCase() === 'rt' ||
    element.hasAttribute('hidden') ||
    element.getAttribute('aria-hidden') === 'true'
  );
}
