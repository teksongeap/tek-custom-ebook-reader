/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { JSDOM } from 'jsdom';
import { sanitizeBookHtml } from '../../src/lib/functions/book-data-loader/sanitize-book-html.ts';
import {
  readReaderLinkReference,
  ReaderReferenceAttribute
} from '../../src/lib/functions/reader-reference-layer/epub-reference.ts';

function setup(t: TestContext, html: string) {
  const { window } = new JSDOM('');
  t.after(() => window.close());
  const document = window.document as unknown as Document;
  const root = document.createElement('div');
  root.innerHTML = sanitizeBookHtml(html, document);
  return root;
}

test('book content cannot carry executable HTML or active form controls into the reader', (t) => {
  const root = setup(
    t,
    `<script>alert(1)</script><iframe srcdoc="<script>alert(1)</script>"></iframe>
    <object data="data:text/html,evil"></object><embed src="https://evil.test/">
    <meta http-equiv="refresh" content="0;url=https://evil.test"><link rel="stylesheet" href="https://evil.test/a.css">
    <style>body{display:none}</style><form><input autofocus><button>Submit</button></form>
    <p onclick="alert(1)">Readable text</p><img src="blob:https://reader.test/image" onerror="alert(1)">
    <svg onload="alert(1)"><a href="javascript:alert(1)">bad</a></svg>`
  );
  assert.equal(
    root.querySelector('script, iframe, object, embed, meta, link, style, form, input, button'),
    null
  );
  assert.equal(root.querySelector('[onclick], [onerror], [onload]'), null);
  assert.equal(root.querySelector('svg a')?.getAttribute('href'), null);
  assert.match(root.textContent || '', /Readable text/);
});

test('ruby, reader anchors, formatting, and packaged HTML and SVG images survive', (t) => {
  const root = setup(
    t,
    `<section id="chapter" data-ttu-source-href="chapter.xhtml">
    <p class="body" style="text-align: center"><ruby>漢字<rt>かんじ</rt><rp>（）</rp></ruby></p>
    <a href="#note" epub:type="noteref" data-ttu-target-fragment="note">1</a>
    <img src="data:image/gif;ttu:cover.gif;base64,R0lGODlhAQABAAAAACw=">
    <img src="blob:https://reader.test/image">
    <svg viewBox="0 0 100 200"><image href="blob:https://reader.test/image"/></svg>
    <aside id="note">A note</aside></section>`
  );
  assert.equal(root.querySelector('ruby rt')?.textContent, 'かんじ');
  assert.equal(
    root.querySelector('section')?.getAttribute('data-ttu-source-href'),
    'chapter.xhtml'
  );
  assert.equal(root.querySelector('a')?.getAttribute('href'), '#note');
  assert.equal(root.querySelector('a')?.getAttribute('epub:type'), 'noteref');
  assert.equal(root.querySelector('p')?.getAttribute('style'), 'text-align: center');
  assert.match(root.querySelector('img')?.getAttribute('src') || '', /^data:image\/gif;ttu:/);
  assert.equal(
    root.querySelector('svg image')?.getAttribute('href'),
    'blob:https://reader.test/image'
  );
});

test('book links reject executable and blob documents, while web and internal links survive', (t) => {
  const root = setup(
    t,
    `<a href="jav&#x61;script:alert(1)">bad</a>
    <a href="data:text/html,evil">data</a><a href="blob:https://reader.test/html">blob</a>
    <a href="https://example.test/">web</a><a href="next.xhtml#note">next</a>
    <img src="https://evil.test/track" srcset="https://evil.test/track 2x">`
  );
  const links = [...root.querySelectorAll('a')];
  for (const link of links.slice(0, 3)) assert.equal(link.getAttribute('href'), null);
  assert.equal(links[3].getAttribute('href'), 'https://example.test/');
  assert.equal(links[4].getAttribute('href'), 'next.xhtml#note');
  assert.equal(root.querySelector('img')?.getAttribute('src'), null);
  assert.equal(root.querySelector('img')?.getAttribute('srcset'), null);
});

test('stored external reader metadata is revalidated before footnote navigation', (t) => {
  const root = setup(t, '<a>note</a>');
  const link = root.querySelector('a')!;
  link.setAttribute(ReaderReferenceAttribute.linkKind, 'external');
  link.setAttribute(ReaderReferenceAttribute.linkSourceHref, 'chapter.xhtml');
  link.setAttribute(ReaderReferenceAttribute.originalHref, 'https://example.test/');
  for (const href of [
    'javascript:alert(1)',
    'data:text/html,evil',
    'blob:https://reader.test/html'
  ]) {
    link.setAttribute(ReaderReferenceAttribute.targetHref, href);
    assert.equal(readReaderLinkReference(link)?.targetHref, undefined);
  }
  link.setAttribute(ReaderReferenceAttribute.targetHref, 'https://example.test/');
  assert.equal(readReaderLinkReference(link)?.targetHref, 'https://example.test/');
});

test('whitespace-obfuscated blob document links are also rejected', (t) => {
  const root = setup(t, '<a href="b&#10;lob:https://reader.test/document">bad</a>');
  assert.equal(root.querySelector('a')?.getAttribute('href'), null);
});
