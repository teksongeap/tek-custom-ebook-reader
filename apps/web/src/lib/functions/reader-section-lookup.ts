/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { SectionWithProgress } from '$lib/components/book-reader/book-toc/book-toc';
import type { ReaderTarget } from '$lib/functions/reader-reference-layer/epub-reference';

type LabeledSectionPosition = {
  section: SectionWithProgress;
  order: number;
  startCharacter: number;
};

export type ReaderSectionLookup = {
  sections: SectionWithProgress[];
  sectionsByReference: Map<string, SectionWithProgress>;
  sectionOrder: Map<string, number>;
  nearestLabeledSectionsByReference: Map<string, SectionWithProgress | undefined>;
  sectionsBySourceHref: Map<string, SectionWithProgress>;
  sectionsBySourceHrefAndFragment: Map<string, SectionWithProgress>;
  labeledSectionPositions: LabeledSectionPosition[];
};

const sourceFragmentKeySeparator = '\u0000';

export function buildReaderSectionLookup(sections: SectionWithProgress[]) {
  const sectionsByReference = new Map<string, SectionWithProgress>();
  const sectionOrder = new Map<string, number>();
  const sectionsBySourceHref = new Map<string, SectionWithProgress>();
  const sectionsBySourceHrefAndFragment = new Map<string, SectionWithProgress>();
  const nearestLabeledSectionsByReference = new Map<string, SectionWithProgress | undefined>();
  const labeledSectionPositions: LabeledSectionPosition[] = [];

  sections.forEach((section, index) => {
    sectionsByReference.set(section.reference, section);
    sectionOrder.set(section.reference, index);

    if (section.sourceHref && !sectionsBySourceHref.has(section.sourceHref)) {
      sectionsBySourceHref.set(section.sourceHref, section);
    }

    if (section.sourceHref && section.targetFragment) {
      const sourceFragmentKey = getSourceFragmentKey(section.sourceHref, section.targetFragment);

      if (!sectionsBySourceHrefAndFragment.has(sourceFragmentKey)) {
        sectionsBySourceHrefAndFragment.set(sourceFragmentKey, section);
      }
    }

    if (section.label) {
      labeledSectionPositions.push({
        section,
        order: index,
        startCharacter: typeof section.startCharacter === 'number' ? section.startCharacter : 0
      });
    }
  });

  labeledSectionPositions.sort(
    (sectionA, sectionB) =>
      sectionA.startCharacter - sectionB.startCharacter || sectionA.order - sectionB.order
  );

  for (const section of sections) {
    nearestLabeledSectionsByReference.set(
      section.reference,
      findNearestLabeledSection(section, sectionsByReference)
    );
  }

  return {
    sections,
    sectionsByReference,
    sectionOrder,
    nearestLabeledSectionsByReference,
    sectionsBySourceHref,
    sectionsBySourceHrefAndFragment,
    labeledSectionPositions
  } satisfies ReaderSectionLookup;
}

export function getNearestLabeledSection(
  lookup: ReaderSectionLookup,
  section: SectionWithProgress | undefined
) {
  return section ? lookup.nearestLabeledSectionsByReference.get(section.reference) : undefined;
}

export function getLabeledSectionForCharacter(
  lookup: ReaderSectionLookup,
  exploredCharCount: number
) {
  let lowerIndex = 0;
  let upperIndex = lookup.labeledSectionPositions.length - 1;
  let matchingSection: SectionWithProgress | undefined;

  while (lowerIndex <= upperIndex) {
    const middleIndex = Math.floor((lowerIndex + upperIndex) / 2);
    const candidate = lookup.labeledSectionPositions[middleIndex];

    if (candidate.startCharacter <= exploredCharCount) {
      matchingSection = candidate.section;
      lowerIndex = middleIndex + 1;
    } else {
      upperIndex = middleIndex - 1;
    }
  }

  return matchingSection;
}

export function getSectionForReaderTarget(
  lookup: ReaderSectionLookup,
  target: ReaderTarget,
  fallbackSourceHref?: string
) {
  if (target.sectionId) {
    const section = lookup.sectionsByReference.get(target.sectionId);

    if (section) {
      return section;
    }
  }

  const sourceHref = target.sourceHref || fallbackSourceHref;

  if (sourceHref && target.fragment) {
    const section = lookup.sectionsBySourceHrefAndFragment.get(
      getSourceFragmentKey(sourceHref, target.fragment)
    );

    if (section) {
      return section;
    }
  }

  return sourceHref ? lookup.sectionsBySourceHref.get(sourceHref) : undefined;
}

function findNearestLabeledSection(
  section: SectionWithProgress,
  sectionsByReference: Map<string, SectionWithProgress>
) {
  const visitedReferences = new Set<string>();
  let currentSection: SectionWithProgress | undefined = section;

  while (currentSection && !visitedReferences.has(currentSection.reference)) {
    visitedReferences.add(currentSection.reference);

    if (currentSection.label) {
      return currentSection;
    }

    currentSection = currentSection.parentChapter
      ? sectionsByReference.get(currentSection.parentChapter)
      : undefined;
  }

  return undefined;
}

function getSourceFragmentKey(sourceHref: string, fragment: string) {
  return `${sourceHref}${sourceFragmentKeySeparator}${fragment}`;
}
