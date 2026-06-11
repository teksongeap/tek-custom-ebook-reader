/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { BooksDbAnnotation } from '$lib/data/database/books-db/versions/books-db';

export function formatAnnotationTimestamp(timestamp: number) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return 'Unknown time';
  }

  const date = new Date(timestamp);
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const year = date.getFullYear();
  const hours = date.getHours();
  const amPm = hours >= 12 ? 'PM' : 'AM';
  const hour = padDatePart(hours % 12 || 12);
  const minute = padDatePart(date.getMinutes());

  return `${month}/${day}/${year}, ${hour}:${minute} ${amPm}`;
}

function padDatePart(value: number) {
  return value.toString().padStart(2, '0');
}

export function getAnnotationEditedAt(annotation: BooksDbAnnotation) {
  const createdAt = annotation.createdAt || 0;
  const hasEditedAt = Object.prototype.hasOwnProperty.call(annotation, 'editedAt');

  if (hasEditedAt) {
    return getVisibleEditedAt(createdAt, annotation.editedAt || 0);
  }

  const updatedAt = annotation.updatedAt || 0;

  return getVisibleEditedAt(createdAt, updatedAt);
}

function getVisibleEditedAt(createdAt: number, updatedAt: number) {
  if (updatedAt <= createdAt) {
    return 0;
  }

  return formatAnnotationTimestamp(updatedAt) === formatAnnotationTimestamp(createdAt)
    ? 0
    : updatedAt;
}
