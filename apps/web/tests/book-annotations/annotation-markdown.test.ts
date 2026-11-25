/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { renderAnnotationMarkdown } from '../../src/lib/components/book-reader/book-annotations/annotation-markdown.ts';

test('formats pasted notes with headings, emphasis, quotes, lists, and code', () => {
  const html = renderAnnotationMarkdown(
    '# Meaning\n\nA **strong** *emphasis* ~~correction~~ and `inline code`.\n\n> Quoted passage\n\n- First point\n- Second point\n\n1. First step\n2. Second step\n\n```js\nconst x = "<example>";\n```'
  );

  for (const element of ['h1', 'strong', 'em', 'del', 'blockquote', 'ul', 'ol', 'li', 'pre']) {
    assert.match(html, new RegExp(`<${element}[\\s>]`));
  }
  assert.match(html, /<code>inline code<\/code>/);
  assert.match(html, /&lt;example&gt;/);
  assert.doesNotMatch(html, /<example>/);
});

test('supports tables, task lists, and the line breaks used by existing plain-text notes', () => {
  const html = renderAnnotationMarkdown(
    'First line\nSecond line\n\n| Term | Meaning |\n| --- | --- |\n| feu | fire |\n\n- [x] Learned\n- [ ] Review'
  );

  assert.match(html, /First line<br>Second line/);
  assert.match(html, /<table>/);
  assert.match(html, /<th>Term<\/th>/);
  assert.match(html, /<td>fire<\/td>/);
  assert.equal((html.match(/type="checkbox"/g) || []).length, 2);
  assert.equal((html.match(/disabled/g) || []).length, 2);
});

test('keeps Markdown links, bare URLs, and email links usable with safe external navigation', () => {
  const html = renderAnnotationMarkdown(
    '[**Dictionary**](https://example.com/word?q=a&lang=en "A dictionary")\n\nhttps://example.org/path\n\nwww.example.net\n\nreader@example.com'
  );

  assert.match(html, /href="https:\/\/example.com\/word\?q=a&amp;lang=en"/);
  assert.match(html, /title="A dictionary"/);
  assert.match(html, /<strong>Dictionary<\/strong><\/a>/);
  assert.match(html, /href="https:\/\/example.org\/path"/);
  assert.match(html, /href="http:\/\/www.example.net\/"/);
  assert.match(html, /href="mailto:reader@example.com"/);
  assert.equal((html.match(/target="_blank" rel="noopener noreferrer"/g) || []).length, 4);
});

test('shows user-authored HTML as text instead of executable markup', () => {
  for (const source of [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<svg onload=alert(1)>',
    '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    '[label <img src=x onerror=alert(1)>](https://example.com)'
  ]) {
    const html = renderAnnotationMarkdown(source);
    assert.doesNotMatch(html, /<(script|img|svg|iframe)\b/i);
    assert.match(html, /&lt;/);
  }
});

test('rejects executable, local, relative, and obfuscated link destinations', () => {
  for (const href of [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'jav&#x61;script:alert(1)',
    'javascript&#58;alert(1)',
    'data:text/html,payload',
    'vbscript:payload',
    'file:///private/note.txt',
    '//example.com',
    '/reader-settings'
  ]) {
    const html = renderAnnotationMarkdown(`[**Keep this text**](${href})`);
    assert.doesNotMatch(html, /<a\b/);
    assert.match(html, /<strong>Keep this text<\/strong>/);
  }
});

test('escapes link attributes and only loads ordinary web images lazily', () => {
  const link = renderAnnotationMarkdown(
    String.raw`[label](https://example.com "x\" onmouseover=\"bad")`
  );
  assert.match(link, /title="x&quot; onmouseover=&quot;bad"/);
  assert.doesNotMatch(link, /" onmouseover="/);

  const image = renderAnnotationMarkdown('![A diagram](https://example.com/diagram.png "Details")');
  assert.match(image, /<img src="https:\/\/example.com\/diagram.png" alt="A diagram"/);
  assert.match(image, /loading="lazy" decoding="async" referrerpolicy="no-referrer"/);

  for (const href of [
    'javascript:alert(1)',
    'data:image/svg+xml,payload',
    'file:///tmp/image.png'
  ]) {
    const html = renderAnnotationMarkdown(`![Keep the description](${href})`);
    assert.doesNotMatch(html, /<img\b/);
    assert.match(html, /Keep the description/);
  }
});

test('leaves saved Markdown unchanged and renders empty and multilingual notes', () => {
  const source = '**Definition**\n\n> 火、feu、불\n\nA & B < C';
  const original = source;
  const html = renderAnnotationMarkdown(source);

  assert.equal(source, original);
  assert.equal(renderAnnotationMarkdown(''), '');
  assert.match(html, /火、feu、불/);
  assert.match(html, /A &amp; B &lt; C/);
});
