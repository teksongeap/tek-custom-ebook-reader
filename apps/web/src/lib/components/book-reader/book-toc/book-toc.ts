/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { BehaviorSubject, Subject } from 'rxjs';

import type { BooksDbTocEntry } from '$lib/data/database/books-db/versions/books-db';
import type { Section } from '$lib/data/database/books-db/versions/v3/books-db-v3';

export const sectionList$ = new BehaviorSubject<Section[]>([]);
export const sectionProgress$ = new Subject<Map<string, SectionWithProgress>>();
export const nextChapter$ = new Subject<string>();
export const tocIsOpen$ = new Subject<boolean>();
export const activeTocItem$ = new BehaviorSubject<ActiveTocItem | undefined>(undefined);
export const tocTargets$ = new BehaviorSubject<TocTarget[]>([]);

export type SectionWithProgress = Section & {
  progress: number;
};

export type ActiveTocItem = {
  id: string;
  sourceHref?: string;
  targetFragment?: string;
};

export type TocTarget = ActiveTocItem & {
  label: string;
  reference: string;
  depth: number;
  order: number;
};

export function flattenBookTocEntries(entries: BooksDbTocEntry[], depth = 0, order = { value: 0 }) {
  return entries.flatMap((entry): TocTarget[] => {
    const target: TocTarget = {
      id: entry.id,
      label: entry.label,
      reference: entry.reference,
      sourceHref: entry.sourceHref,
      targetFragment: entry.targetFragment,
      depth,
      order: order.value
    };

    order.value += 1;

    return [target, ...flattenBookTocEntries(entry.children || [], depth + 1, order)];
  });
}

export function setActiveTocItem(nextItem: ActiveTocItem | undefined) {
  const currentItem = activeTocItem$.getValue();

  if (
    currentItem?.id === nextItem?.id &&
    currentItem?.sourceHref === nextItem?.sourceHref &&
    currentItem?.targetFragment === nextItem?.targetFragment
  ) {
    return;
  }

  activeTocItem$.next(nextItem);
}

export function getChapterSections(sectionData: SectionWithProgress[]) {
  return sectionData.filter((section) => !!section.label);
}

export function getChapterData(
  sectionData: SectionWithProgress[]
): [SectionWithProgress[], number, string] {
  const mainChapters = getChapterSections(sectionData);

  let currentSection = sectionData.find((section) => section.progress < 100);

  if (!currentSection) {
    currentSection = sectionData[sectionData.length - 1];
  }

  const referenceId = currentSection?.label
    ? currentSection.reference
    : currentSection?.parentChapter || currentSection?.reference || '';
  let currentChapterIndex = mainChapters.findIndex((section) => section.reference === referenceId);

  if (currentChapterIndex < 0 && typeof currentSection?.startCharacter === 'number') {
    currentChapterIndex = mainChapters.findLastIndex(
      (section) =>
        typeof section.startCharacter === 'number' &&
        (section.startCharacter as number) <= (currentSection.startCharacter as number)
    );
  }

  return [mainChapters, currentChapterIndex, referenceId];
}
