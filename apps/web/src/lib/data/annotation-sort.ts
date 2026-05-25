/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { SortDirection } from './sort-types';

export enum AnnotationSortMode {
  LOCATION = 'location',
  UPDATED = 'updated',
  CREATED = 'created',
  NOTES = 'notes'
}

export type AnnotationSortDirection = SortDirection | 'default';

export const annotationSortOptions: { id: AnnotationSortMode }[] = [
  { id: AnnotationSortMode.LOCATION },
  { id: AnnotationSortMode.UPDATED },
  { id: AnnotationSortMode.CREATED },
  { id: AnnotationSortMode.NOTES }
];

export const annotationSortDefaultDirections: Record<AnnotationSortMode, SortDirection> = {
  [AnnotationSortMode.LOCATION]: SortDirection.DESC,
  [AnnotationSortMode.UPDATED]: SortDirection.DESC,
  [AnnotationSortMode.CREATED]: SortDirection.DESC,
  [AnnotationSortMode.NOTES]: SortDirection.DESC
};

const annotationSortLabels: Record<AnnotationSortMode, Record<SortDirection, string>> = {
  [AnnotationSortMode.LOCATION]: {
    [SortDirection.ASC]: 'First in book',
    [SortDirection.DESC]: 'Last in book'
  },
  [AnnotationSortMode.UPDATED]: {
    [SortDirection.ASC]: 'Oldest edited',
    [SortDirection.DESC]: 'Newest edited'
  },
  [AnnotationSortMode.CREATED]: {
    [SortDirection.ASC]: 'Oldest added',
    [SortDirection.DESC]: 'Newest added'
  },
  [AnnotationSortMode.NOTES]: {
    [SortDirection.ASC]: 'Notes last',
    [SortDirection.DESC]: 'Notes first'
  }
};

const annotationSortModeIds = new Set(annotationSortOptions.map((option) => option.id));
const annotationSortDirectionIds = new Set<AnnotationSortDirection>([
  SortDirection.ASC,
  SortDirection.DESC,
  'default'
]);

export function getAnnotationSortMode(value: string) {
  return annotationSortModeIds.has(value as AnnotationSortMode)
    ? (value as AnnotationSortMode)
    : AnnotationSortMode.LOCATION;
}

export function getAnnotationSortDirection(value: string, sortMode: AnnotationSortMode) {
  return annotationSortDirectionIds.has(value as AnnotationSortDirection) && value !== 'default'
    ? (value as SortDirection)
    : annotationSortDefaultDirections[sortMode];
}

export function getAnnotationSortLabel(sortMode: AnnotationSortMode, sortDirection: SortDirection) {
  return annotationSortLabels[sortMode][sortDirection];
}
