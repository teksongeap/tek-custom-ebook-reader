/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import path from 'path-browserify';

export const ReaderReferenceAttribute = {
  spineIndex: 'data-ttu-spine-index',
  spineIdRef: 'data-ttu-spine-idref',
  sourceHref: 'data-ttu-source-href',
  linkKind: 'data-ttu-link-kind',
  linkSourceHref: 'data-ttu-link-source-href',
  originalHref: 'data-ttu-original-href',
  targetHref: 'data-ttu-target-href',
  targetFragment: 'data-ttu-target-fragment',
  searchBlockId: 'data-ttu-search-block-id'
} as const;

export type ReaderLinkKind = 'internal' | 'footnote' | 'backlink' | 'external';

export interface ReaderTarget {
  sectionId?: string;
  sourceHref?: string;
  fragment?: string;
  blockId?: string;
  textStart?: number;
  textEnd?: number;
}

export interface ReaderLinkReference {
  kind: ReaderLinkKind;
  originalHref: string;
  sourceHref: string;
  targetHref?: string;
  targetFragment?: string;
  target: ReaderTarget;
}

export interface CreateReaderLinkReferenceOptions {
  sourceSpineIndex?: number;
  targetSpineIndex?: number;
}

const externalHrefRegex = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const footnoteIdPattern = /(?:^|[-_:])(fn|footnote|note|endnote|en)(?:[-_:]|\d|$)/i;
const backlinkIdPattern = /(?:^|[-_:])(fnref|noteref|backlink|return)(?:[-_:]|\d|$)/i;
const bracketedNoteMarkerPattern = /^\[\s*(?:\d{1,4}|[ivxlcdm]{1,10}|[*#]+)\s*\]$/i;
const bareNoteMarkerPattern = /^(?:\d{1,4}|[ivxlcdm]{1,10}|[*#]+)$/i;

export function normalizeEpubPath(value: string) {
  const normalized = path.normalize(value.replace(/\\/g, '/')).replace(/\\/g, '/');

  if (normalized === '.') {
    return '';
  }

  return normalized.replace(/^\/+/, '').replace(/^\.\//, '');
}

export function createReaderLinkReference(
  sourceHref: string,
  originalHref: string,
  element?: Element,
  options: CreateReaderLinkReferenceOptions = {}
): ReaderLinkReference | undefined {
  const href = originalHref.trim();

  if (!href) {
    return undefined;
  }

  const normalizedSourceHref = normalizeEpubPath(sourceHref);

  if (isExternalHref(href)) {
    return {
      kind: 'external',
      originalHref,
      sourceHref: normalizedSourceHref,
      targetHref: href,
      target: {}
    };
  }

  const { hrefPath, fragment } = splitHref(href);
  const targetHref = resolveEpubPath(normalizedSourceHref, hrefPath);
  const targetFragment = fragment === undefined ? undefined : decodeEpubFragment(fragment);
  const kind = classifyReaderLink(element, targetFragment, options);

  return {
    kind,
    originalHref,
    sourceHref: normalizedSourceHref,
    targetHref,
    targetFragment,
    target: {
      sourceHref: targetHref,
      fragment: targetFragment
    }
  };
}

export function resolveReaderTargetHref(sourceHref: string, originalHref: string) {
  const href = originalHref.trim();

  if (!href || isExternalHref(href)) {
    return undefined;
  }

  const { hrefPath } = splitHref(href);

  return resolveEpubPath(normalizeEpubPath(sourceHref), hrefPath);
}

export function writeReaderLinkReference(element: Element, reference: ReaderLinkReference) {
  element.setAttribute(ReaderReferenceAttribute.linkKind, reference.kind);
  element.setAttribute(ReaderReferenceAttribute.linkSourceHref, reference.sourceHref);
  element.setAttribute(ReaderReferenceAttribute.originalHref, reference.originalHref);

  if (reference.targetHref) {
    element.setAttribute(ReaderReferenceAttribute.targetHref, reference.targetHref);
  } else {
    element.removeAttribute(ReaderReferenceAttribute.targetHref);
  }

  if (reference.targetFragment !== undefined) {
    element.setAttribute(ReaderReferenceAttribute.targetFragment, reference.targetFragment);
  } else {
    element.removeAttribute(ReaderReferenceAttribute.targetFragment);
  }
}

export function readReaderLinkReference(element: Element): ReaderLinkReference | undefined {
  const kind = element.getAttribute(ReaderReferenceAttribute.linkKind);
  const sourceHref = element.getAttribute(ReaderReferenceAttribute.linkSourceHref);
  const originalHref = element.getAttribute(ReaderReferenceAttribute.originalHref);

  if (!isReaderLinkKind(kind) || !sourceHref || !originalHref) {
    return undefined;
  }

  const targetHref = element.getAttribute(ReaderReferenceAttribute.targetHref) || undefined;
  const targetFragment = element.getAttribute(ReaderReferenceAttribute.targetFragment) ?? undefined;

  return {
    kind,
    originalHref,
    sourceHref,
    targetHref,
    targetFragment,
    target: {
      sourceHref: targetHref,
      fragment: targetFragment
    }
  };
}

export function getLegacyHashHref(reference: ReaderLinkReference) {
  const hashIndex = reference.originalHref.lastIndexOf('#');
  const legacyTarget =
    hashIndex >= 0 ? reference.originalHref.slice(hashIndex + 1) : reference.originalHref;

  return `#${legacyTarget}`;
}

export function getElementSourceHref(element: Element) {
  return (
    element
      .closest(`[${ReaderReferenceAttribute.sourceHref}]`)
      ?.getAttribute(ReaderReferenceAttribute.sourceHref) || undefined
  );
}

export function findReaderTargetElement(source: Document | Element, target: ReaderTarget) {
  if (target.blockId) {
    const blockElement = findElementByAttribute(
      source,
      ReaderReferenceAttribute.searchBlockId,
      target.blockId
    );

    if (blockElement) {
      return blockElement;
    }
  }

  if (target.sourceHref) {
    const roots = findSourceRoots(source, target.sourceHref);

    if (roots.length && !target.fragment) {
      return roots[0];
    }

    for (const root of roots) {
      const targetElement = findElementByFragment(root, target.fragment);

      if (targetElement) {
        return getReadableTargetElement(targetElement);
      }
    }

    return undefined;
  }

  if (target.sectionId) {
    const sectionElement = findElementByFragment(source, target.sectionId);

    if (sectionElement) {
      return sectionElement;
    }
  }

  const targetElement = findElementByFragment(source, target.fragment);

  return targetElement ? getReadableTargetElement(targetElement) : undefined;
}

function isExternalHref(href: string) {
  return externalHrefRegex.test(href);
}

function splitHref(href: string) {
  const hashIndex = href.indexOf('#');
  const hrefWithoutFragment = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const fragment = hashIndex >= 0 ? href.slice(hashIndex + 1) : undefined;
  const queryIndex = hrefWithoutFragment.indexOf('?');
  const hrefPath = queryIndex >= 0 ? hrefWithoutFragment.slice(0, queryIndex) : hrefWithoutFragment;

  return { hrefPath, fragment };
}

function resolveEpubPath(sourceHref: string, hrefPath: string) {
  if (!hrefPath) {
    return normalizeEpubPath(sourceHref);
  }

  if (hrefPath.startsWith('/')) {
    return normalizeEpubPath(hrefPath);
  }

  const sourceDir = path.dirname(sourceHref);

  return normalizeEpubPath(path.join(sourceDir === '.' ? '' : sourceDir, hrefPath));
}

function decodeEpubFragment(fragment: string) {
  try {
    return decodeURIComponent(fragment);
  } catch (_) {
    return fragment;
  }
}

function classifyReaderLink(
  element: Element | undefined,
  targetFragment: string | undefined,
  options: CreateReaderLinkReferenceOptions
) {
  if (
    hasReferenceToken(element, 'epub:type', 'noteref') ||
    hasReferenceToken(element, 'role', 'doc-noteref')
  ) {
    return 'footnote';
  }

  if (
    hasReferenceToken(element, 'epub:type', 'backlink') ||
    hasReferenceToken(element, 'role', 'doc-backlink') ||
    (targetFragment && backlinkIdPattern.test(targetFragment))
  ) {
    return 'backlink';
  }

  if (targetFragment && isLikelyNumberedNoteMarker(element)) {
    if (isLaterSpineTarget(options)) {
      return 'footnote';
    }

    if (isEarlierSpineTarget(options)) {
      return 'backlink';
    }
  }

  if (targetFragment && footnoteIdPattern.test(targetFragment)) {
    return 'footnote';
  }

  return 'internal';
}

function hasReferenceToken(element: Element | undefined, attribute: string, token: string) {
  return (element?.getAttribute(attribute) || '')
    .split(/\s+/)
    .some((value) => value.toLowerCase() === token);
}

function isLikelyNumberedNoteMarker(element: Element | undefined) {
  if (!element || isInsideNavigationElement(element)) {
    return false;
  }

  const text = element.textContent?.replace(/\s+/g, ' ').trim() || '';

  if (bracketedNoteMarkerPattern.test(text)) {
    return true;
  }

  return bareNoteMarkerPattern.test(text) && !!element.closest('sup');
}

function isLaterSpineTarget(options: CreateReaderLinkReferenceOptions) {
  return (
    typeof options.sourceSpineIndex === 'number' &&
    typeof options.targetSpineIndex === 'number' &&
    options.targetSpineIndex > options.sourceSpineIndex
  );
}

function isEarlierSpineTarget(options: CreateReaderLinkReferenceOptions) {
  return (
    typeof options.sourceSpineIndex === 'number' &&
    typeof options.targetSpineIndex === 'number' &&
    options.targetSpineIndex < options.sourceSpineIndex
  );
}

function isInsideNavigationElement(element: Element) {
  let currentElement: Element | null = element;

  while (currentElement) {
    if (
      currentElement.tagName.toLowerCase() === 'nav' ||
      hasReferenceToken(currentElement, 'role', 'doc-toc') ||
      hasReferenceToken(currentElement, 'epub:type', 'toc')
    ) {
      return true;
    }

    currentElement = currentElement.parentElement;
  }

  return false;
}

function isReaderLinkKind(value: string | null): value is ReaderLinkKind {
  return (
    value === 'internal' || value === 'footnote' || value === 'backlink' || value === 'external'
  );
}

function findSourceRoots(source: Document | Element, sourceHref: string) {
  const normalizedSourceHref = normalizeEpubPath(sourceHref);
  const roots: Element[] = [];

  if (
    source instanceof Element &&
    source.getAttribute(ReaderReferenceAttribute.sourceHref) === normalizedSourceHref
  ) {
    roots.push(source);
  }

  roots.push(
    ...Array.from(source.querySelectorAll(`[${ReaderReferenceAttribute.sourceHref}]`)).filter(
      (element) =>
        element.getAttribute(ReaderReferenceAttribute.sourceHref) === normalizedSourceHref
    )
  );

  return roots;
}

function findElementByFragment(source: Document | Element, fragment: string | undefined) {
  if (!fragment) {
    return undefined;
  }

  if (source instanceof Document) {
    const element = source.getElementById(fragment);

    if (element) {
      return element;
    }
  } else if (source.id === fragment || source.getAttribute('name') === fragment) {
    return source;
  }

  return Array.from(source.querySelectorAll<HTMLElement>('[id],[name]')).find(
    (element) => element.id === fragment || element.getAttribute('name') === fragment
  );
}

function findElementByAttribute(source: Document | Element, attribute: string, value: string) {
  if (source instanceof Element && source.getAttribute(attribute) === value) {
    return source;
  }

  return Array.from(source.querySelectorAll<HTMLElement>(`[${attribute}]`)).find(
    (element) => element.getAttribute(attribute) === value
  );
}

function getReadableTargetElement(element: Element) {
  if (hasReadableText(element)) {
    return element;
  }

  let nextElement = element.nextElementSibling;

  while (nextElement) {
    if (hasReadableText(nextElement)) {
      return nextElement;
    }

    nextElement = nextElement.nextElementSibling;
  }

  return element.parentElement || element;
}

function hasReadableText(element: Element) {
  return !!element.textContent?.trim();
}
