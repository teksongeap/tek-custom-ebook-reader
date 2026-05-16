/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

export enum AnnotationSortMode {
  LOCATION = 'location',
  UPDATED = 'updated',
  CREATED = 'created',
  NOTES = 'notes'
}

export const annotationSortOptions: { id: AnnotationSortMode; label: string }[] = [
  { id: AnnotationSortMode.LOCATION, label: 'Book order' },
  { id: AnnotationSortMode.UPDATED, label: 'Recently edited' },
  { id: AnnotationSortMode.CREATED, label: 'Recently added' },
  { id: AnnotationSortMode.NOTES, label: 'Notes first' }
];

const annotationSortModeIds = new Set(annotationSortOptions.map((option) => option.id));

export function getAnnotationSortMode(value: string) {
  return annotationSortModeIds.has(value as AnnotationSortMode)
    ? (value as AnnotationSortMode)
    : AnnotationSortMode.LOCATION;
}
