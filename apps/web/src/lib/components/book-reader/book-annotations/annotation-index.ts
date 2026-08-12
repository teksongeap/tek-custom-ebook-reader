/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { BooksDbAnnotation } from '$lib/data/database/books-db/versions/books-db';

export interface AnnotationIndex {
  byId: ReadonlyMap<string, BooksDbAnnotation>;
  bySection: ReadonlyMap<string, ReadonlyArray<BooksDbAnnotation>>;
}

export function createAnnotationIndex(
  annotations: ReadonlyArray<BooksDbAnnotation>
): AnnotationIndex {
  const byId = new Map<string, BooksDbAnnotation>();
  const bySection = new Map<string, BooksDbAnnotation[]>();

  annotations.forEach((annotation) => {
    byId.set(annotation.id, annotation);

    const sectionId = annotation.anchor.sectionId;
    const sectionAnnotations = bySection.get(sectionId);

    if (sectionAnnotations) {
      sectionAnnotations.push(annotation);
    } else {
      bySection.set(sectionId, [annotation]);
    }
  });

  return { byId, bySection };
}

export function getRenderedAnnotations(
  annotations: ReadonlyArray<BooksDbAnnotation>,
  annotationIndex: AnnotationIndex,
  contentChange: { scope: 'book' } | { scope: 'section'; sectionId: string } | undefined
) {
  if (contentChange?.scope === 'book') {
    return annotations;
  }

  if (contentChange?.scope === 'section') {
    return annotationIndex.bySection.get(contentChange.sectionId) || [];
  }

  return [];
}

export function getAnnotationHighlightKey(annotation: BooksDbAnnotation) {
  return JSON.stringify([
    annotation.id,
    annotation.anchor.sectionId,
    annotation.anchor.startOffset,
    annotation.anchor.endOffset,
    annotation.color
  ]);
}
