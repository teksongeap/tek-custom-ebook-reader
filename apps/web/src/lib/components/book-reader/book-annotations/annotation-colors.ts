/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { BooksDbAnnotation } from '$lib/data/database/books-db/versions/books-db';

export type AnnotationColor = BooksDbAnnotation['color'];

export const annotationColorOptions: {
  id: AnnotationColor;
  label: string;
  purposeLabel: string;
  value: string;
}[] = [
  { id: 'yellow', label: 'Yellow', purposeLabel: 'Parse', value: '#f5c84b' },
  { id: 'green', label: 'Green', purposeLabel: 'Connect', value: '#48c78e' },
  { id: 'blue', label: 'Blue', purposeLabel: 'Investigate', value: '#4aa3ff' },
  { id: 'pink', label: 'Pink', purposeLabel: 'Critique', value: '#ff70a6' },
  { id: 'violet', label: 'Violet', purposeLabel: 'Compress', value: '#a78bfa' }
];

const annotationColorValue = new Map(
  annotationColorOptions.map((colorOption) => [colorOption.id, colorOption.value])
);

const annotationColorLabel = new Map(
  annotationColorOptions.map((colorOption) => [colorOption.id, colorOption.label])
);

const annotationColorPurposeLabel = new Map(
  annotationColorOptions.map((colorOption) => [colorOption.id, colorOption.purposeLabel])
);

export function getAnnotationColorValue(color: AnnotationColor) {
  return annotationColorValue.get(color) || annotationColorOptions[0].value;
}

export function getAnnotationColorLabel(color: AnnotationColor) {
  return annotationColorLabel.get(color) || annotationColorOptions[0].label;
}

export function getAnnotationColorPurposeLabel(color: AnnotationColor) {
  return annotationColorPurposeLabel.get(color) || annotationColorOptions[0].purposeLabel;
}
