/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { BooksDbAnnotation } from '$lib/data/database/books-db/versions/books-db';

export type AnnotationColor = BooksDbAnnotation['color'];

export const annotationColorOptions: { id: AnnotationColor; label: string; value: string }[] = [
  { id: 'yellow', label: 'Yellow', value: '#f5c84b' },
  { id: 'green', label: 'Green', value: '#48c78e' },
  { id: 'blue', label: 'Blue', value: '#4aa3ff' },
  { id: 'pink', label: 'Pink', value: '#ff70a6' },
  { id: 'violet', label: 'Violet', value: '#a78bfa' }
];

const annotationColorValue = new Map(
  annotationColorOptions.map((colorOption) => [colorOption.id, colorOption.value])
);

export function getAnnotationColorValue(color: AnnotationColor) {
  return annotationColorValue.get(color) || annotationColorOptions[0].value;
}
