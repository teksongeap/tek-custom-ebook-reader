/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { BooksDbAnnotation } from '$lib/data/database/books-db/versions/books-db';

const annotationTimestampFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
});

export function formatAnnotationTimestamp(timestamp: number) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return 'Unknown time';
  }

  return annotationTimestampFormatter.format(new Date(timestamp));
}

export function getAnnotationEditedAt(annotation: BooksDbAnnotation) {
  const createdAt = annotation.createdAt || 0;
  const updatedAt = annotation.updatedAt || 0;

  if (updatedAt <= createdAt) {
    return 0;
  }

  return formatAnnotationTimestamp(updatedAt) === formatAnnotationTimestamp(createdAt)
    ? 0
    : updatedAt;
}
