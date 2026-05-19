/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { BehaviorSubject, Subject } from 'rxjs';

import type { Section } from '$lib/data/database/books-db/versions/v3/books-db-v3';

export const sectionList$ = new BehaviorSubject<Section[]>([]);
export const sectionProgress$ = new Subject<Map<string, SectionWithProgress>>();
export const nextChapter$ = new Subject<string>();
export const tocIsOpen$ = new Subject<boolean>();

export type SectionWithProgress = Section & {
  progress: number;
};

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
