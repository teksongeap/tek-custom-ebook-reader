/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAnnotationIndex,
  getAnnotationHighlightKey,
  getRenderedAnnotations
} from '../../src/lib/components/book-reader/book-annotations/annotation-index.ts';

type Annotation = Parameters<typeof createAnnotationIndex>[0][number];

function createAnnotation(
  id: string,
  sectionId: string,
  startOffset: number,
  overrides: Partial<Annotation> = {}
): Annotation {
  return {
    id,
    dataId: 1,
    color: 'yellow',
    comment: '',
    selectedText: id,
    anchor: {
      sectionId,
      startOffset,
      endOffset: startOffset + id.length,
      text: id,
      prefix: '',
      suffix: ''
    },
    progress: 0,
    exploredCharCount: startOffset,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  };
}

test('indexes annotations by id and exact section without changing their order', () => {
  const sectionAFirst = createAnnotation('a-first', 'section-a', 40);
  const sectionB = createAnnotation('b', 'section-b', 10);
  const sectionASecond = createAnnotation('a-second', 'section-a', 5);
  const annotations = [sectionAFirst, sectionB, sectionASecond];
  const originalOrder = [...annotations];

  const index = createAnnotationIndex(annotations);

  assert.equal(index.byId.get(sectionAFirst.id), sectionAFirst);
  assert.equal(index.byId.get(sectionB.id), sectionB);
  assert.deepEqual(index.bySection.get('section-a'), [sectionAFirst, sectionASecond]);
  assert.deepEqual(index.bySection.get('section-b'), [sectionB]);
  assert.equal(index.bySection.get('missing-section'), undefined);
  assert.deepEqual(annotations, originalOrder);
});

test('selects only mounted-section annotations while retaining the full by-id index', () => {
  const offSectionAnnotations = Array.from({ length: 5000 }, (_, index) =>
    createAnnotation(`off-${index}`, `section-${index + 1}`, index)
  );
  const localAnnotations = [
    createAnnotation('local-first', 'current-section', 20),
    createAnnotation('local-second', 'current-section', 40)
  ];
  const annotations = [...offSectionAnnotations, ...localAnnotations];
  const index = createAnnotationIndex(annotations);

  assert.deepEqual(
    getRenderedAnnotations(annotations, index, {
      scope: 'section',
      sectionId: 'current-section'
    }),
    localAnnotations
  );
  assert.equal(getRenderedAnnotations(annotations, index, undefined).length, 0);
  assert.equal(index.byId.size, offSectionAnnotations.length + localAnnotations.length);
  assert.equal(index.byId.get('off-4999'), offSectionAnnotations[4999]);
});

test('whole-book mounts retain continuous-mode rendering behavior', () => {
  const annotations = [
    createAnnotation('section-a-annotation', 'section-a', 10),
    createAnnotation('section-b-annotation', 'section-b', 20)
  ];

  assert.equal(
    getRenderedAnnotations(annotations, createAnnotationIndex(annotations), { scope: 'book' }),
    annotations
  );
});

test('rebuilding reflects create, delete, comment update, and section moves', () => {
  const original = createAnnotation('annotation', 'section-a', 10);
  const created = createAnnotation('created', 'section-a', 30);
  const updated = { ...original, comment: 'Updated comment', updatedAt: 2 };
  const moved = {
    ...updated,
    anchor: { ...updated.anchor, sectionId: 'section-b' }
  };

  assert.deepEqual(createAnnotationIndex([original, created]).bySection.get('section-a'), [
    original,
    created
  ]);
  assert.deepEqual(createAnnotationIndex([updated]).bySection.get('section-a'), [updated]);

  const updatedIndex = createAnnotationIndex([updated]);
  assert.equal(updatedIndex.byId.has(created.id), false);

  const movedIndex = createAnnotationIndex([moved]);

  assert.equal(movedIndex.bySection.get('section-a'), undefined);
  assert.deepEqual(movedIndex.bySection.get('section-b'), [moved]);
  assert.equal(movedIndex.byId.get(original.id), moved);
});

test('highlight keys ignore changes that do not affect rendered highlights', () => {
  const annotation = createAnnotation('annotation', 'section-a', 10);
  const metadataUpdate = {
    ...annotation,
    comment: 'A new comment',
    selectedText: 'Updated selected text',
    anchor: {
      ...annotation.anchor,
      text: 'Updated anchor text',
      prefix: 'Updated prefix',
      suffix: 'Updated suffix'
    },
    createdAt: 100,
    updatedAt: 200,
    editedAt: 200
  };

  assert.equal(getAnnotationHighlightKey(metadataUpdate), getAnnotationHighlightKey(annotation));
});

test('highlight keys change for every DOM-affecting annotation property', () => {
  const annotation = createAnnotation('annotation', 'section-a', 10);
  const originalKey = getAnnotationHighlightKey(annotation);
  const variants: Annotation[] = [
    { ...annotation, id: 'other-id' },
    { ...annotation, color: 'blue' },
    { ...annotation, anchor: { ...annotation.anchor, sectionId: 'section-b' } },
    { ...annotation, anchor: { ...annotation.anchor, startOffset: 11 } },
    { ...annotation, anchor: { ...annotation.anchor, endOffset: 21 } }
  ];

  variants.forEach((variant) => {
    assert.notEqual(getAnnotationHighlightKey(variant), originalKey);
  });
});
