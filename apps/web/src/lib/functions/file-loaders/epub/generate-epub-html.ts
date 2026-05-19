/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { isOPFType, type EpubContent, type EpubOPFContent } from './types';
import type { BookTocEntry } from '$lib/data/database/books-db/versions/v7/books-db-v7';
import type { Section } from '../../../data/database/books-db/versions/v3/books-db-v3';
import buildDummyBookImage from '../utils/build-dummy-book-image';
import clearAllBadImageRef from '../utils/clear-all-bad-image-ref';
import fixXHtmlHref from '../utils/fix-xhtml-href';
import { importHTMLFixMode$, restrictImportFixToAnchor$ } from '$lib/data/store';
import { ImportHTMLFixMode } from '$lib/data/import-html-fix-mode';
import { getCharacterCount } from '$lib/functions/get-character-count';
import { getParagraphNodes } from '../../../components/book-reader/get-paragraph-nodes';
import {
  ReaderReferenceAttribute,
  createReaderLinkReference,
  getLegacyHashHref,
  normalizeEpubPath,
  resolveReaderTargetHref,
  writeReaderLinkReference
} from '$lib/functions/reader-reference-layer/epub-reference';
import { annotateReaderSearchBlocks } from '$lib/functions/reader-reference-layer/search';
import path from 'path-browserify';

export const prependValue = 'ttu-';

// eslint-disable-next-line no-control-regex
const controlCharactersRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/gim;
const htmlHexEntitiesRegex = /&#x([0-9A-Fa-f]+);/gim;
const htmlDecEntitiesRegex = /&#(\d+);/gim;
const selfClosingTagsRegex = /><\/(meta|link)>/gim;
const selfClosingContentTags = [
  'a',
  'body',
  'code',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'ol',
  'ops:default',
  'p',
  'rb',
  'rt',
  'ruby',
  'script',
  'span',
  'td',
  'th',
  'title'
];

interface ParsedTocEntry {
  id: string;
  reference: string;
  charactersWeight: number;
  label: string;
  sourceHref: string;
  targetFragment?: string;
  parentId?: string;
  depth: number;
  order: number;
}

export default function generateEpubHtml(
  data: Record<string, string | Blob>,
  contents: EpubContent | EpubOPFContent,
  document: Document,
  contentsDirectory: string
) {
  const fallbackData = new Map<string, string>();
  const importHTMLFixMode = importHTMLFixMode$.getValue();
  const restrictImportFixToAnchor = restrictImportFixToAnchor$.getValue();
  const applyImportFixes = importHTMLFixMode !== ImportHTMLFixMode.OFF;
  const selfClosingContentTagsToFix =
    applyImportFixes && !restrictImportFixToAnchor ? selfClosingContentTags : [];

  let tocData = { type: 3, content: '', sourceHref: '' };
  let navKey = '';

  const itemIdToHtmlRef = (
    isOPFType(contents)
      ? contents['opf:package']['opf:manifest']['opf:item']
      : contents.package.manifest.item
  ).reduce<Record<string, string>>((acc, item) => {
    if (item['@_fallback']) {
      fallbackData.set(item['@_id'], item['@_fallback']);
    }

    if (item['@_media-type'] === 'application/xhtml+xml' || item['@_media-type'] === 'text/html') {
      acc[item['@_id']] = item['@_href'];

      if (item['@_properties'] === 'nav') {
        navKey = item['@_href'];
      }
    }
    return acc;
  }, {});

  const blobLocations = Object.entries(data).reduce<string[]>((acc, [key, value]) => {
    const isV2Toc = key.endsWith('.ncx') && !tocData.content;

    if (isV2Toc || navKey === key) {
      tocData = {
        type: isV2Toc ? 2 : 3,
        content: value as string,
        sourceHref: key
      };
    }

    if (value instanceof Blob) {
      acc.push(key);
    }
    return acc;
  }, []);

  const parser = new DOMParser();
  const spineItemRef = isOPFType(contents)
    ? contents['opf:package']['opf:spine']['opf:itemref']
    : contents.package.spine.itemref;
  const itemRefs = Array.isArray(spineItemRef) ? spineItemRef : [spineItemRef];
  const sectionData: Section[] = [];
  const result = document.createElement('div');
  const spineHrefToIndex = createSpineHrefToIndex(itemRefs, itemIdToHtmlRef, fallbackData);

  let mainChapters: ParsedTocEntry[] = [];
  let firstChapterMatchIndex = -1;

  if (applyImportFixes && restrictImportFixToAnchor) {
    selfClosingContentTagsToFix.push('a');
  }

  const parsedTocEntries = parseTocEntries(tocData, parser);
  const toc = buildBookTocEntries(parsedTocEntries);

  mainChapters = [...parsedTocEntries];

  if (mainChapters.length) {
    firstChapterMatchIndex = itemRefs.findIndex((ref) => {
      const { htmlHref } = resolveSpineItemHtmlRef(ref, itemIdToHtmlRef, fallbackData);

      return normalizeEpubPath(htmlHref || '') === mainChapters[0].sourceHref;
    });

    if (firstChapterMatchIndex !== 0) {
      const firstRef = itemRefs[0]['@_idref'];
      const firstHTMLRef = itemIdToHtmlRef[firstRef];
      const fallbackRef = fallbackData.get(firstRef);
      const reference = firstHTMLRef || (fallbackRef ? itemIdToHtmlRef[fallbackRef] : firstHTMLRef);

      mainChapters.unshift({
        id: 'toc-preface',
        reference,
        charactersWeight: 1,
        label: 'Preface',
        sourceHref: normalizeEpubPath(reference || ''),
        depth: 0,
        order: -1
      });
    }
  }

  let currentMainChapter = mainChapters[0];
  let currentMainChapterId = currentMainChapter ? `${prependValue}${itemRefs[0]['@_idref']}` : '';
  let currentMainChapterIndex = 0;
  let previousCharacterCount = 0;
  let currentCharCount = 0;
  const tocEntryById = new Map(mainChapters.map((chapter) => [chapter.id, chapter]));
  const tocEntryToSectionReference = new Map<string, string>();

  itemRefs.forEach((item, spineIndex) => {
    const { itemIdRef, htmlHref } = resolveSpineItemHtmlRef(item, itemIdToHtmlRef, fallbackData);
    const normalizedHtmlHref = normalizeEpubPath(htmlHref || '');

    let contentToParse = (data[htmlHref] as string) || '';

    for (const tagMatch of selfClosingContentTagsToFix) {
      const matches = contentToParse.match(new RegExp(`<${tagMatch}[^>]+?>`, 'gim')) || [];

      for (const match of matches) {
        if (match.endsWith('/>')) {
          contentToParse = contentToParse.replace(match, `${match.slice(0, -2)}></${tagMatch}>`);
        }
      }
    }

    if (importHTMLFixMode === ImportHTMLFixMode.EXTENDED) {
      contentToParse = contentToParse
        .replace(controlCharactersRegex, '')
        .replace(selfClosingTagsRegex, '>')
        .replace(htmlHexEntitiesRegex, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(htmlDecEntitiesRegex, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
        .replace('<!DOCTYPE html []>', '<!DOCTYPE html>')
        .trim();
    }

    let parsedContent = parser.parseFromString(contentToParse, 'text/html');
    let body = parsedContent.body;

    if (!body?.childNodes?.length) {
      parsedContent = parser.parseFromString(contentToParse, 'text/xml');
      body = parsedContent.querySelector('body')!;

      if (!body?.childNodes?.length) {
        throw new Error('Unable to find valid body content while parsing EPUB');
      }
    }

    const htmlClass = parsedContent.querySelector('html')?.className || '';
    const bodyId = body.id || '';
    const bodyClass = body.className || '';

    for (const elm of [...body.querySelectorAll('image,img')]) {
      const attributes =
        elm.tagName.toLowerCase() === 'image'
          ? elm.getAttributeNames().filter((attr) => attr.endsWith('href'))
          : ['src'];

      for (const attr of attributes) {
        const value = elm.getAttribute(attr);

        if (value) {
          elm.setAttribute(attr, path.join(path.dirname(htmlHref), value));
        }
      }
    }

    let innerHtml = body.innerHTML || '';

    blobLocations.forEach((blobLocation) => {
      innerHtml = innerHtml.replaceAll(
        relative(contentsDirectory, blobLocation),
        buildDummyBookImage(blobLocation)
      );
    });

    const childBodyDiv = document.createElement('div');
    childBodyDiv.className = `ttu-book-body-wrapper ${bodyClass}`;
    if (bodyId) {
      childBodyDiv.id = bodyId;
    }
    childBodyDiv.innerHTML = innerHtml;

    const childHtmlDiv = document.createElement('div');
    childHtmlDiv.className = `ttu-book-html-wrapper ${htmlClass}`;
    childHtmlDiv.appendChild(childBodyDiv);

    const childWrapperDiv = document.createElement('div');
    childWrapperDiv.id = `${prependValue}${itemIdRef}`;
    childWrapperDiv.setAttribute(ReaderReferenceAttribute.spineIndex, `${spineIndex}`);
    childWrapperDiv.setAttribute(ReaderReferenceAttribute.spineIdRef, itemIdRef);
    childWrapperDiv.setAttribute(ReaderReferenceAttribute.sourceHref, normalizedHtmlHref);
    childWrapperDiv.appendChild(childHtmlDiv);
    annotateReaderSearchBlocks(childWrapperDiv, `epub-${spineIndex}`);
    annotateAnchorReferences(childWrapperDiv, htmlHref, {
      sourceSpineIndex: spineIndex,
      spineHrefToIndex
    });

    result.appendChild(childWrapperDiv);

    const elementCharCount = countForElement(childWrapperDiv);

    currentCharCount += elementCharCount;

    if (!elementCharCount) {
      childHtmlDiv.classList.add('ttu-no-text');
      childBodyDiv.classList.add('ttu-no-text');
    }

    const mainChapterIndex = findBestTocEntryIndexForSourceHref(mainChapters, normalizedHtmlHref);
    const mainChapter = mainChapterIndex > -1 ? mainChapters[mainChapterIndex] : undefined;
    const characters = currentCharCount - previousCharacterCount;

    if (mainChapter) {
      const oldMainChapterIndex = currentMainChapterIndex;
      const parentChapter = findTocParentSectionReference(
        mainChapter,
        tocEntryById,
        tocEntryToSectionReference
      );

      currentMainChapter = mainChapter;
      currentMainChapterIndex = sectionData.length;
      currentMainChapterId = `${prependValue}${itemIdRef}`;
      tocEntryToSectionReference.set(mainChapter.id, currentMainChapterId);

      sectionData.push({
        reference: currentMainChapterId,
        charactersWeight: characters || 1,
        label: currentMainChapter.label,
        startCharacter: currentMainChapterIndex
          ? (sectionData[oldMainChapterIndex].startCharacter as number) +
            (sectionData[oldMainChapterIndex].characters as number)
          : 0,
        characters,
        parentChapter,
        sourceHref: currentMainChapter.sourceHref,
        targetFragment: currentMainChapter.targetFragment,
        tocDepth: currentMainChapter.depth
      });
    } else if (currentMainChapter) {
      (sectionData[currentMainChapterIndex].characters as number) += characters;

      sectionData.push({
        reference: `${prependValue}${itemIdRef}`,
        charactersWeight: characters || 1,
        parentChapter: currentMainChapterId,
        sourceHref: normalizedHtmlHref
      });
    }

    previousCharacterCount = currentCharCount;
  });

  clearAllBadImageRef(result);
  fixXHtmlHref(result);

  return {
    element: result,
    characters: currentCharCount,
    sections: sectionData.filter((item: Section) => item.reference.startsWith(prependValue)),
    toc
  };
}

function countForElement(containerEl: Node) {
  const paragraphs = getParagraphNodes(containerEl);

  let characterCount = 0;

  paragraphs.forEach((node) => {
    characterCount += getCharacterCount(node);
  });

  return characterCount;
}

function parseTocEntries(
  tocData: { type: number; content: string; sourceHref: string },
  parser: DOMParser
) {
  if (!tocData.type || !tocData.content) {
    return [] as ParsedTocEntry[];
  }

  if (tocData.type === 3) {
    let parsedToc = parser.parseFromString(tocData.content, 'text/html');
    let navTocElement = parsedToc.querySelector('nav[epub\\:type="toc"],nav#toc');

    if (!navTocElement) {
      parsedToc = parser.parseFromString(tocData.content, 'text/xml');
      navTocElement = parsedToc.querySelector('nav[epub\\:type="toc"],nav#toc');
    }

    return navTocElement ? parseNavTocEntries(navTocElement, tocData.sourceHref) : [];
  }

  const parsedToc = parser.parseFromString(tocData.content, 'text/xml');
  const navMap = findFirstDescendantByLocalName(parsedToc, 'navMap');

  return navMap ? parseNcxTocEntries(navMap, tocData.sourceHref) : [];
}

function parseNavTocEntries(navTocElement: Element, tocSourceHref: string) {
  const entries: ParsedTocEntry[] = [];

  parseNavTocContainer(navTocElement, tocSourceHref, entries, 0);

  return entries;
}

function parseNavTocContainer(
  container: Element,
  tocSourceHref: string,
  entries: ParsedTocEntry[],
  depth: number,
  parentId?: string
) {
  const list =
    getDirectChildrenByLocalName(container, 'ol')[0] ||
    getDirectChildrenByLocalName(container, 'ul')[0];

  if (!list) {
    return;
  }

  getDirectChildrenByLocalName(list, 'li').forEach((item) => {
    const anchor = findDirectChildByLocalName(item, 'a');
    const entry = anchor
      ? createTocEntry(anchor.getAttribute('href') || '', anchor.textContent || '', tocSourceHref, {
          depth,
          parentId,
          rawId: anchor.id || item.id,
          order: entries.length
        })
      : undefined;
    const nextParentId = entry?.id || parentId;

    if (entry) {
      entries.push(entry);
    }

    parseNavTocContainer(item, tocSourceHref, entries, depth + 1, nextParentId);
  });
}

function parseNcxTocEntries(navMapElement: Element, tocSourceHref: string) {
  const entries: ParsedTocEntry[] = [];

  parseNcxNavPoints(
    getDirectChildrenByLocalName(navMapElement, 'navPoint'),
    tocSourceHref,
    entries,
    0
  );

  return entries;
}

function parseNcxNavPoints(
  navPoints: Element[],
  tocSourceHref: string,
  entries: ParsedTocEntry[],
  depth: number,
  parentId?: string
) {
  navPoints.forEach((navPoint) => {
    const navLabel = findDirectChildByLocalName(navPoint, 'navLabel');
    const label = findFirstDescendantByLocalName(navLabel, 'text')?.textContent || '';
    const content = findDirectChildByLocalName(navPoint, 'content');
    const entry = createTocEntry(content?.getAttribute('src') || '', label, tocSourceHref, {
      depth,
      parentId,
      rawId: navPoint.id,
      order: entries.length
    });
    const nextParentId = entry?.id || parentId;

    if (entry) {
      entries.push(entry);
    }

    parseNcxNavPoints(
      getDirectChildrenByLocalName(navPoint, 'navPoint'),
      tocSourceHref,
      entries,
      depth + 1,
      nextParentId
    );
  });
}

function createTocEntry(
  rawReference: string,
  rawLabel: string,
  tocSourceHref: string,
  options: {
    depth: number;
    order: number;
    parentId?: string;
    rawId?: string;
  }
): ParsedTocEntry | undefined {
  const label = rawLabel.replace(/\s+/g, ' ').trim();

  if (!rawReference || !label) {
    return undefined;
  }

  const { hrefPath, fragment } = splitTocHref(rawReference);
  const sourceHref = resolveTocHref(tocSourceHref, hrefPath);
  const reference = fragment ? `${sourceHref}#${fragment}` : sourceHref;
  const rawId = options.rawId?.trim();

  return {
    id: rawId ? `${rawId}-${options.order}` : `toc-${options.order}`,
    reference,
    charactersWeight: 1,
    label,
    sourceHref,
    targetFragment: fragment,
    parentId: options.parentId,
    depth: options.depth,
    order: options.order
  };
}

function splitTocHref(href: string) {
  const hashIndex = href.indexOf('#');
  const hrefWithoutFragment = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const fragment = hashIndex >= 0 ? decodeTocFragment(href.slice(hashIndex + 1)) : undefined;
  const queryIndex = hrefWithoutFragment.indexOf('?');
  const hrefPath = queryIndex >= 0 ? hrefWithoutFragment.slice(0, queryIndex) : hrefWithoutFragment;

  return { hrefPath, fragment };
}

function resolveTocHref(tocSourceHref: string, hrefPath: string) {
  if (!hrefPath) {
    return normalizeEpubPath(tocSourceHref);
  }

  if (hrefPath.startsWith('/')) {
    return normalizeEpubPath(hrefPath);
  }

  const sourceDir = path.dirname(tocSourceHref);

  return normalizeEpubPath(path.join(sourceDir === '.' ? '' : sourceDir, hrefPath));
}

function decodeTocFragment(fragment: string) {
  try {
    return decodeURIComponent(fragment);
  } catch (_) {
    return fragment;
  }
}

function findBestTocEntryIndexForSourceHref(entries: ParsedTocEntry[], sourceHref: string) {
  let bestIndex = -1;
  let bestDepth = -1;

  entries.forEach((entry, index) => {
    if (entry.sourceHref !== sourceHref || entry.depth < bestDepth) {
      return;
    }

    if (entry.depth === bestDepth && bestIndex > -1) {
      return;
    }

    bestIndex = index;
    bestDepth = entry.depth;
  });

  return bestIndex;
}

function findTocParentSectionReference(
  entry: ParsedTocEntry,
  entryById: Map<string, ParsedTocEntry>,
  entryToSectionReference: Map<string, string>
) {
  let parentId = entry.parentId;

  while (parentId) {
    const parentSectionReference = entryToSectionReference.get(parentId);

    if (parentSectionReference) {
      return parentSectionReference;
    }

    parentId = entryById.get(parentId)?.parentId;
  }

  return undefined;
}

function buildBookTocEntries(entries: ParsedTocEntry[]) {
  const tocEntries = entries.map(
    (entry): BookTocEntry => ({
      id: entry.id,
      label: entry.label,
      reference: entry.reference,
      sourceHref: entry.sourceHref,
      targetFragment: entry.targetFragment,
      children: []
    })
  );
  const entryById = new Map(tocEntries.map((entry) => [entry.id, entry]));
  const roots: BookTocEntry[] = [];

  entries.forEach((entry, index) => {
    const tocEntry = tocEntries[index];
    const parent = entry.parentId ? entryById.get(entry.parentId) : undefined;

    if (parent && parent.id !== tocEntry.id) {
      parent.children?.push(tocEntry);
    } else {
      roots.push(tocEntry);
    }
  });

  return roots;
}

function getDirectChildrenByLocalName(element: ParentNode | null | undefined, localName: string) {
  if (!element) {
    return [] as Element[];
  }

  return Array.from(element.children).filter(
    (child) => child.localName.toLowerCase() === localName.toLowerCase()
  );
}

function findDirectChildByLocalName(element: ParentNode | null | undefined, localName: string) {
  return getDirectChildrenByLocalName(element, localName)[0];
}

function findFirstDescendantByLocalName(
  element: ParentNode | Document | null | undefined,
  localName: string
) {
  if (!element) {
    return undefined;
  }

  return Array.from(element.querySelectorAll('*')).find(
    (child) => child.localName.toLowerCase() === localName.toLowerCase()
  );
}

function annotateAnchorReferences(
  el: HTMLElement,
  sourceHref: string,
  context: {
    sourceSpineIndex: number;
    spineHrefToIndex: Map<string, number>;
  }
) {
  Array.from(el.getElementsByTagName('a')).forEach((tag) => {
    const oldHref = tag.getAttribute('href');
    if (!oldHref) return;

    const targetHref = resolveReaderTargetHref(sourceHref, oldHref);
    const reference = createReaderLinkReference(sourceHref, oldHref, tag, {
      sourceSpineIndex: context.sourceSpineIndex,
      targetSpineIndex: targetHref ? context.spineHrefToIndex.get(targetHref) : undefined
    });

    if (!reference) return;

    writeReaderLinkReference(tag, reference);
    tag.setAttribute('href', getLegacyHashHref(reference));
  });
}

function createSpineHrefToIndex(
  itemRefs: { '@_idref': string }[],
  itemIdToHtmlRef: Record<string, string>,
  fallbackData: Map<string, string>
) {
  const spineHrefToIndex = new Map<string, number>();

  itemRefs.forEach((item, spineIndex) => {
    const { htmlHref } = resolveSpineItemHtmlRef(item, itemIdToHtmlRef, fallbackData);

    if (htmlHref) {
      spineHrefToIndex.set(normalizeEpubPath(htmlHref), spineIndex);
    }
  });

  return spineHrefToIndex;
}

function resolveSpineItemHtmlRef(
  item: { '@_idref': string },
  itemIdToHtmlRef: Record<string, string>,
  fallbackData: Map<string, string>
) {
  let itemIdRef = item['@_idref'];
  let htmlHref = itemIdToHtmlRef[itemIdRef];

  if (!htmlHref && fallbackData.has(itemIdRef)) {
    itemIdRef = fallbackData.get(itemIdRef) as string;
    htmlHref = itemIdToHtmlRef[itemIdRef];
  }

  return { itemIdRef, htmlHref };
}

/**
 * Replicates https://nodejs.org/api/path.html#path_path_relative_from_to
 */
function relative(fromPath: string, toPath: string): string {
  const fromDirName = path.dirname(fromPath);
  const toDirName = path.dirname(toPath);
  const toFilename = path.basename(toPath);

  if (fromDirName === toDirName) {
    return toFilename;
  }

  const fromParts = fromDirName === '.' ? [] : fromDirName.split('/');
  const toParts = toDirName === '.' ? [] : toDirName.split('/');

  if (fromParts.length >= toParts.length) {
    for (let i = 0; i < fromParts.length; i += 1) {
      if (fromParts[i] !== toParts[i]) {
        return path.join(
          '../'.repeat(fromParts.length - i) + toParts.slice(i).join('/'),
          toFilename
        );
      }
    }
  }
  for (let i = 0; i < fromParts.length; i += 1) {
    if (fromParts[i] !== toParts[i]) {
      return path.join('../'.repeat(fromParts.length - i) + toParts.slice(i).join('/'), toFilename);
    }
  }

  return path.join(toParts.slice(fromParts.length - toParts.length).join('/'), toFilename);
}
