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

export function flattenBookTocEntries(entries: BooksDbTocEntry[]) {
  const targets: TocTarget[] = [];

  appendBookTocEntries(entries, targets);

  return targets;
}

export function groupTocTargetsBySourceHref(targets: TocTarget[]) {
  const targetsBySourceHref = new Map<string, TocTarget[]>();

  targets.forEach((target) => {
    if (!target.sourceHref) {
      return;
    }

    let sourceTargets = targetsBySourceHref.get(target.sourceHref);

    if (!sourceTargets) {
      sourceTargets = [];
      targetsBySourceHref.set(target.sourceHref, sourceTargets);
    }

    sourceTargets.push(target);
  });

  return targetsBySourceHref;
}

export function getTocTargetLocationKey(target: ActiveTocItem) {
  return [target.sourceHref || '', target.targetFragment || ''].join('#');
}

function appendBookTocEntries(
  entries: BooksDbTocEntry[],
  targets: TocTarget[],
  depth = 0
) {
  entries.forEach((entry) => {
    targets.push({
      id: entry.id,
      label: entry.label,
      reference: entry.reference,
      sourceHref: entry.sourceHref,
      targetFragment: entry.targetFragment,
      depth,
      order: targets.length
    });

    appendBookTocEntries(entry.children || [], targets, depth + 1);
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
