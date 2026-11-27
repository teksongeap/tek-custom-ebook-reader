/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { Window } from 'happy-dom';
import {
  clearAnnotationHighlights,
  renderAnnotationHighlights,
  restoreAnnotationRange,
  serializeAnnotationRange
} from '../../src/lib/components/book-reader/book-annotations/annotation-range.ts';
import type { BooksDbAnnotation } from '../../src/lib/data/database/books-db/versions/books-db.ts';

function setup(t: TestContext, html: string) {
  const window = new Window();
  const document = window.document as unknown as Document;
  for (const [key, value] of Object.entries({
    document,
    Node: window.Node,
    NodeFilter: window.NodeFilter,
    Element: window.Element,
    HTMLElement: window.HTMLElement,
    Text: window.Text
  })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, key, original);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  t.after(() => window.happyDOM.close());
  const root = document.createElement('section');
  root.id = 'chapter';
  root.innerHTML = html;
  document.body.append(root);
  return { document, root };
}

function selectText(document: Document, root: Element) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const first = walker.nextNode()!;
  let last = first;
  while (walker.nextNode()) last = walker.currentNode;
  const range = document.createRange();
  range.setStart(first, 0);
  range.setEnd(last, last.textContent!.length);
  return range;
}

function annotation(root: HTMLElement, range: Range, id = 'note'): BooksDbAnnotation {
  const anchor = serializeAnnotationRange(range, root);
  assert.ok(anchor);
  return {
    id,
    dataId: 1,
    color: 'yellow',
    comment: '',
    selectedText: range.toString(),
    anchor,
    progress: 0,
    exploredCharCount: 0,
    createdAt: 1,
    updatedAt: 1
  };
}

function assertReadingsUnmarked(root: HTMLElement) {
  for (const reading of root.querySelectorAll('rt, rp, rtc')) {
    assert.equal(reading.closest('.book-annotation-highlight'), null);
    assert.equal(reading.querySelector('.book-annotation-highlight'), null);
  }
}

test('annotations paint base text across ruby without enclosing readings or fallback parentheses', (t) => {
  const { document, root } = setup(
    t,
    '<p>の<ruby>讃美者<rp>（</rp><rt>さんびしゃ</rt><rp>）</rp></ruby>である。</p>'
  );
  const original = root.innerHTML;
  const range = selectText(document, root);
  const saved = annotation(root, range);
  const spans = renderAnnotationHighlights(document, root, [saved]);
  assert.equal(spans.length, 3);
  assert.equal(
    [...root.querySelectorAll('.book-annotation-highlight')]
      .map((span) => span.textContent)
      .join(''),
    'の讃美者である。'
  );
  assertReadingsUnmarked(root);
  assert.equal(spans.filter(({ span }) => span.tabIndex === 0).length, 1);
  assert.equal(restoreAnnotationRange(document, root, saved)?.toString(), saved.selectedText);
  clearAnnotationHighlights(root);
  assert.equal(root.innerHTML, original);
});

for (const explicitBase of [false, true]) {
  test(`a partial ${explicitBase ? 'explicit' : 'implicit'} ruby base highlights only selected characters`, (t) => {
    const base = explicitBase ? '<rb>讃美者</rb>' : '讃美者';
    const { document, root } = setup(t, `<p><ruby>${base}<rt>さんびしゃ</rt></ruby></p>`);
    const text = root.querySelector(explicitBase ? 'rb' : 'ruby')!.firstChild!;
    const range = document.createRange();
    range.setStart(text, 1);
    range.setEnd(text, 2);
    const saved = annotation(root, range);
    const spans = renderAnnotationHighlights(document, root, [saved]);
    assert.deepEqual(
      spans.map(({ span }) => span.textContent),
      ['美']
    );
    assert.equal(root.querySelector('ruby')!.textContent, '讃美者さんびしゃ');
    assertReadingsUnmarked(root);
    assert.equal(restoreAnnotationRange(document, root, saved)?.toString(), '美');
  });
}

test('selections entirely inside ruby readings never create highlights', (t) => {
  for (const readingTag of ['rt', 'rp', 'rtc']) {
    const { document, root } = setup(t, `<ruby>漢字<${readingTag}>かんじ</${readingTag}></ruby>`);
    const range = selectText(document, root.querySelector(readingTag)!);
    assert.deepEqual(renderAnnotationHighlights(document, root, [annotation(root, range)]), []);
    assertReadingsUnmarked(root);
  }
});

test('adjacent annotations within one ruby retain independent selection boundaries', (t) => {
  const { document, root } = setup(t, '<ruby>東京都<rt>とうきょうと</rt></ruby>');
  const text = root.querySelector('ruby')!.firstChild!;
  const annotations = [0, 1, 2].map((start) => {
    const range = document.createRange();
    range.setStart(text, start);
    range.setEnd(text, start + 1);
    return annotation(root, range, `note-${start}`);
  });
  for (let render = 0; render < 2; render += 1) {
    const spans = renderAnnotationHighlights(document, root, annotations);
    assert.equal(spans.length, 3);
    for (const [index, character] of [...'東京都'].entries()) {
      assert.equal(
        root.querySelector(`[data-ttu-annotation-id="note-${index}"]`)?.textContent,
        character
      );
      assert.equal(
        restoreAnnotationRange(document, root, annotations[index])?.toString(),
        character
      );
    }
    assertReadingsUnmarked(root);
  }
});

test('formatted and nested ruby bases leave every reading tier untouched', (t) => {
  const html =
    '<ruby><rb><em>東</em><ruby>京<rt>きょう</rt></ruby></rb><rtc><rt>とうきょう</rt></rtc></ruby>';
  const { document, root } = setup(t, html);
  const range = selectText(document, root);
  const saved = annotation(root, range);
  const spans = renderAnnotationHighlights(document, root, [saved]);
  assert.deepEqual(spans.map(({ span }) => span.textContent).sort(), ['京', '東'].sort());
  assertReadingsUnmarked(root);
  clearAnnotationHighlights(root);
  assert.equal(root.innerHTML, html);
});
