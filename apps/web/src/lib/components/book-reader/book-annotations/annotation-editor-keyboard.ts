/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

type EditorDeleteEvent = Pick<
  KeyboardEvent,
  | 'key'
  | 'altKey'
  | 'ctrlKey'
  | 'metaKey'
  | 'shiftKey'
  | 'isComposing'
  | 'repeat'
  | 'defaultPrevented'
>;

export function shouldDeleteAnnotationFromEditor(event: EditorDeleteEvent) {
  return (
    event.key === 'Delete' &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !event.isComposing &&
    !event.repeat &&
    !event.defaultPrevented
  );
}
