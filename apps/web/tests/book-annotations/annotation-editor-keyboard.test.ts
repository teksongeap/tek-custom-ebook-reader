/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldDeleteAnnotationFromEditor } from '../../src/lib/components/book-reader/book-annotations/annotation-editor-keyboard.ts';

const deleteKey = {
  key: 'Delete',
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  isComposing: false,
  repeat: false,
  defaultPrevented: false
};

test('Delete removes the annotation, while Backspace and other editing keys do not', () => {
  assert.equal(shouldDeleteAnnotationFromEditor(deleteKey), true);
  for (const key of ['Backspace', 'Enter', 'Escape', 'd']) {
    assert.equal(shouldDeleteAnnotationFromEditor({ ...deleteKey, key }), false);
  }
});

test('modified Delete retains text editing and does not delete the annotation', () => {
  for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
    assert.equal(shouldDeleteAnnotationFromEditor({ ...deleteKey, [modifier]: true }), false);
  }
});

test('composition, held keys, and already handled events cannot delete annotations', () => {
  for (const state of ['isComposing', 'repeat', 'defaultPrevented']) {
    assert.equal(shouldDeleteAnnotationFromEditor({ ...deleteKey, [state]: true }), false);
  }
});
