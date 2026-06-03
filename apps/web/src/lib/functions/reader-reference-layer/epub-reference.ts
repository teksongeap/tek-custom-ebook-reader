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
  referenceRoot?: Document | Element;
  targetElement?: Element;
  customFootnoteTargetPatterns?: RegExp[];
  customFootnoteBacklinkPatterns?: RegExp[];
}

const externalHrefRegex = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const safeExternalHrefProtocols = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const footnoteIdPatterns = [
  /(?:^|[-_:])(?:fn|ftn|footnotes?|notes?|endnotes?|en)(?:[-_:]|\d|$)/i,
  /(?:^|[-_:])(?:_?id)?(?:footnote|endnote)(?:[-_:]|\d|$)/i,
  /(?:^|[-_:])(?:ref[-_:])?(?:footnote|endnote)bookmark[-_:]?end(?:[-_:]|\d|$)/i,
  /(?:^|[-_:])sd(?:footnote|endnote)\d+anc$/i,
  /(?:^|[-_:])cite[-_:]note(?:[-_:]|\d|$)/i,
  /(?:^|[-_:])jz[-_:]\d/i,
  /(?:^|[-_:])zhu\d+$/i
];
const legacyFootnoteTargetIdPatterns = [
  ...footnoteIdPatterns,
  /(?:^|[-_:])(?:ft|_ftn)(?:[-_:]|\d|$)/i
];
const backlinkIdPatterns = [
  /(?:^|[-_:])(?:fnref|ftnref|_ftnref|noteref|footnoteref|endnoteref)(?:[-_:]|\d|$)/i,
  /(?:^|[-_:])(?:backlink|backref|return)(?:[-_:]|\d|$)/i,
  /(?:^|[-_:])(?:ref[-_:])?(?:footnote|endnote)bookmark[-_:]?start(?:[-_:]|\d|$)/i,
  /(?:^|[-_:])(?:_?id)?(?:footnote|endnote)anchor(?:[-_:]|\d|$)/i,
  /(?:^|[-_:])sd(?:footnote|endnote)\d+sym$/i,
  /(?:^|[-_:])cite[-_:]ref(?:[-_:]|\d|$)/i,
  /(?:^|[-_:])jzyy[-_:]\d/i,
  /(?:^|[-_:])zw\d+$/i
];
const bracketedNoteMarkerPattern =
  /^\[\s*(?:\d{1,4}|[ivxlcdm]{1,10}|[*#\u2020\u2021\u00a7\u00b6]+)\s*\]$/i;
const parenthesizedNoteMarkerPattern =
  /^\(\s*(?:\d{1,3}|[ivxlcdm]{1,10}|[*#\u2020\u2021\u00a7\u00b6]+)\s*\)$/i;
const bareNoteMarkerPattern = /^(?:\d{1,4}|[ivxlcdm]{1,10}|[*#\u2020\u2021\u00a7\u00b6]+)$/i;
const superscriptClassPattern = /(?:^|[-_\s])(?:note)?sup(?:er|erscript)?(?:[-_\s]|$)/i;
const noteMarkerClassPattern =
  /(?:^|[-_\s])(?:(?:doc[-_\s]?)?noteref|(?:fn|ftn|note|footnote|endnote)[-_\s]?(?:number|marker|ref|reference))(?:[-_\s]|$)/i;
const footnoteClassPattern =
  /(?:^|[-_\s])(?:fnote|fncontent|footnote|endnote|notecontent|footnotes?|endnotes?)(?:[-_\s]|$)/i;

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
      targetHref: getSafeExternalHref(href),
      target: {}
    };
  }

  const { hrefPath, fragment } = splitHref(href);
  const targetHref = resolveEpubPath(normalizedSourceHref, hrefPath);
  const targetFragment = fragment === undefined ? undefined : decodeEpubFragment(fragment);
  const targetElement =
    options.referenceRoot && targetFragment && isLikelyNumberedNoteMarker(element)
      ? findReaderTargetElement(options.referenceRoot, {
          sourceHref: targetHref,
          fragment: targetFragment
        })
      : undefined;
  const kind = classifyReaderLink(element, targetFragment, { ...options, targetElement });

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

export function parseCustomReaderReferenceRegexRules(value: string | undefined) {
  return (value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map(parseCustomReaderReferenceRegexRule)
    .filter((pattern): pattern is RegExp => !!pattern);
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

function getSafeExternalHref(href: string) {
  if (href.startsWith('//')) {
    return href;
  }

  try {
    const url = new URL(href);

    return safeExternalHrefProtocols.has(url.protocol) ? href : undefined;
  } catch (_) {
    return undefined;
  }
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
  const targetElement = options.targetElement;

  if (targetFragment && isLikelyFootnoteBacklink(element, targetFragment)) {
    return 'backlink';
  }

  if (
    hasReferenceToken(element, 'epub:type', 'noteref') ||
    hasReferenceToken(element, 'role', 'doc-noteref')
  ) {
    return 'footnote';
  }

  if (
    hasReferenceToken(element, 'epub:type', 'backlink') ||
    hasReferenceToken(element, 'role', 'doc-backlink') ||
    (targetFragment &&
      (matchesAnyPattern(backlinkIdPatterns, targetFragment) ||
        matchesAnyPattern(options.customFootnoteBacklinkPatterns || [], targetFragment)))
  ) {
    return 'backlink';
  }

  if (
    targetFragment &&
    matchesAnyPattern(options.customFootnoteTargetPatterns || [], targetFragment)
  ) {
    return 'footnote';
  }

  if (targetFragment && isLikelyNumberedNoteMarker(element)) {
    const structuralKind = classifyStructuralFootnoteLink(element, targetElement);

    if (structuralKind) {
      return structuralKind;
    }

    if (isLaterSpineTarget(options)) {
      return 'footnote';
    }

    if (isEarlierSpineTarget(options)) {
      return 'backlink';
    }

    if (matchesAnyPattern(legacyFootnoteTargetIdPatterns, targetFragment)) {
      return 'footnote';
    }
  }

  if (targetFragment && matchesAnyPattern(footnoteIdPatterns, targetFragment)) {
    return 'footnote';
  }

  return 'internal';
}

function isLikelyFootnoteBacklink(element: Element | undefined, targetFragment: string) {
  if (!element || !isInsideFootnoteElement(element)) {
    return false;
  }

  return isLikelyNumberedNoteMarker(element) || isLikelyBacklinkTargetFragment(targetFragment);
}

function isLikelyBacklinkTargetFragment(fragment: string) {
  return /(?:^|[-_:])ref[-_:]?(?:fn|ftn|footnotes?|endnotes?|notes?)(?:[-_:]|\d|$)/i.test(fragment);
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

  if (parenthesizedNoteMarkerPattern.test(text)) {
    return hasNoteMarkerClass(element) || isInsideSuperscriptLikeElement(element);
  }

  return (
    bareNoteMarkerPattern.test(text) &&
    (hasNoteMarkerClass(element) || isInsideSuperscriptLikeElement(element))
  );
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

function isInsideFootnoteElement(element: Element) {
  if (element.closest(getFootnoteContainerSelector())) {
    return true;
  }

  let currentElement: Element | null = element;

  while (currentElement) {
    if (hasFootnoteContainerClass(currentElement)) {
      return true;
    }

    currentElement = currentElement.parentElement;
  }

  return false;
}

function hasFootnoteContainerClass(element: Element) {
  return getElementClassName(element)
    .split(/\s+/)
    .some((className) => {
      footnoteClassPattern.lastIndex = 0;
      noteMarkerClassPattern.lastIndex = 0;

      return footnoteClassPattern.test(className) && !noteMarkerClassPattern.test(className);
    });
}

function getFootnoteContainerSelector() {
  return '[role="doc-footnote"],[role="doc-endnote"],[epub\\:type~="footnote"],[epub\\:type~="footnotes"],[epub\\:type~="endnote"],[epub\\:type~="endnotes"],.fnote,.fncontent,.footnote,.endnote,.notecontent';
}

function isInsideSuperscriptLikeElement(element: Element) {
  if (hasSuperscriptLikeDescendant(element)) {
    return true;
  }

  let currentElement: Element | null = element;

  while (currentElement) {
    const tagName = currentElement.tagName.toLowerCase();
    const className = getElementClassName(currentElement);
    const style = currentElement.getAttribute('style') || '';

    if (
      tagName === 'sup' ||
      superscriptClassPattern.test(className) ||
      /vertical-align\s*:\s*(?:super|text-top)/i.test(style)
    ) {
      return true;
    }

    if (isBlockBoundaryElement(currentElement)) {
      return false;
    }

    currentElement = currentElement.parentElement;
  }

  return false;
}

function hasSuperscriptLikeDescendant(element: Element) {
  return !!Array.from(element.querySelectorAll('*')).find((child) => {
    const tagName = child.tagName.toLowerCase();
    const className = getElementClassName(child);
    const style = child.getAttribute('style') || '';

    return (
      tagName === 'sup' ||
      superscriptClassPattern.test(className) ||
      /vertical-align\s*:\s*(?:super|text-top)/i.test(style)
    );
  });
}

function hasNoteMarkerClass(element: Element) {
  if (noteMarkerClassPattern.test(getElementClassName(element))) {
    return true;
  }

  if (
    Array.from(element.querySelectorAll('*')).some((child) =>
      noteMarkerClassPattern.test(getElementClassName(child))
    )
  ) {
    return true;
  }

  let currentElement = element.parentElement;

  while (currentElement && !isBlockBoundaryElement(currentElement)) {
    if (noteMarkerClassPattern.test(getElementClassName(currentElement))) {
      return true;
    }

    currentElement = currentElement.parentElement;
  }

  return false;
}

function classifyStructuralFootnoteLink(
  element: Element | undefined,
  targetElement: Element | undefined
): ReaderLinkKind | undefined {
  if (!element || !targetElement) {
    return undefined;
  }

  if (isInsideFootnoteElement(element)) {
    return 'backlink';
  }

  if (isInsideFootnoteElement(targetElement)) {
    return 'footnote';
  }

  const sourceMarkerIds = getMarkerReferenceIds(element);

  if (!sourceMarkerIds.length) {
    return undefined;
  }

  const targetContainer = getLikelyFootnoteContainer(targetElement);

  if (!targetContainer || !hasReadableTextBeyondMarker(targetContainer, targetElement)) {
    return undefined;
  }

  return hasLinkToAnyFragment(targetContainer, sourceMarkerIds) ? 'footnote' : undefined;
}

function getLikelyFootnoteContainer(element: Element) {
  return element.closest(`${getFootnoteContainerSelector()},p,li,aside,div`) || element;
}

function hasReadableTextBeyondMarker(container: Element, marker: Element) {
  const containerText = normalizeReferenceText(container.textContent || '');
  const markerText = normalizeReferenceText(marker.textContent || '');

  return containerText.length > markerText.length;
}

function getMarkerReferenceIds(element: Element) {
  const ids = new Set<string>();

  addElementReferenceIds(ids, element);
  addElementReferenceIds(ids, element.previousElementSibling);

  const parent = element.parentElement;

  if (parent && !isBlockBoundaryElement(parent)) {
    addElementReferenceIds(ids, parent.previousElementSibling);
  }

  return [...ids];
}

function addElementReferenceIds(ids: Set<string>, element: Element | null) {
  if (!element) {
    return;
  }

  const id = element.id || '';
  const name = element.getAttribute('name') || '';

  if (id) {
    ids.add(id);
  }

  if (name) {
    ids.add(name);
  }
}

function hasLinkToAnyFragment(container: Element, fragments: string[]) {
  const fragmentSet = new Set(fragments);

  return Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href]')).some((anchor) => {
    const href = anchor.getAttribute('href') || '';
    const { fragment } = splitHref(href);

    return fragment !== undefined && fragmentSet.has(decodeEpubFragment(fragment));
  });
}

function isBlockBoundaryElement(element: Element) {
  return /^(?:address|article|aside|blockquote|body|dd|div|dl|dt|figcaption|figure|footer|h[1-6]|header|hr|li|main|nav|ol|p|section|table|td|th|tr|ul)$/i.test(
    element.tagName
  );
}

function getElementClassName(element: Element) {
  const className = element.getAttribute('class') || '';

  return typeof className === 'string' ? className : '';
}

function normalizeReferenceText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function parseCustomReaderReferenceRegexRule(value: string) {
  try {
    const slashMatch = value.match(/^\/(.*)\/([a-z]*)$/i);

    if (slashMatch) {
      return new RegExp(slashMatch[1], slashMatch[2]);
    }

    return new RegExp(value, 'i');
  } catch (_) {
    return undefined;
  }
}

function matchesAnyPattern(patterns: RegExp[], value: string) {
  return patterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  });
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
