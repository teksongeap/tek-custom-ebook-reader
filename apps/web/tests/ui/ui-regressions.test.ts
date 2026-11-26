/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import * as sass from 'sass';
import tailwind from 'tailwindcss';
import { createServer, type ViteDevServer } from 'vite';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
let server: ViteDevServer;
let render: (props: Record<string, unknown>) => { html: string };
let renderLoading: typeof render;
let renderReaderLoading: typeof render;
let renderFooter: typeof render;
let renderReaderHeader: typeof render;
let getChapterMarkers: typeof import('../../src/lib/components/book-reader/reader-footer.ts').getReaderChapterMarkers;

const book = {
  id: 1,
  title: 'A book to read',
  imagePath: '',
  characters: 100,
  lastBookModified: 0,
  lastBookOpen: 0,
  progress: 0.5,
  lastBookmarkModified: 0,
  annotationCount: 2,
  isPlaceholder: false
};

before(async () => {
  server = await createServer({
    root,
    server: { middlewareMode: true, watch: null },
    appType: 'custom',
    logLevel: 'error'
  });
  const module = await server.ssrLoadModule('/src/lib/components/book-card/book-card-list.svelte');
  render = (props) => module.default.render(props);
  const loading = await server.ssrLoadModule('/src/lib/components/loading-dialog.svelte');
  renderLoading = (props) => loading.default.render(props);
  const readerLoading = await server.ssrLoadModule(
    '/src/lib/components/book-reader/reader-loading-screen.svelte'
  );
  renderReaderLoading = (props) => readerLoading.default.render(props);
  const footer = await server.ssrLoadModule('/src/lib/components/book-reader/reader-footer.svelte');
  renderFooter = (props) => footer.default.render(props);
  const readerHeader = await server.ssrLoadModule(
    '/src/lib/components/book-reader/book-reader-header.svelte'
  );
  renderReaderHeader = (props) => readerHeader.default.render(props);
  ({ getReaderChapterMarkers: getChapterMarkers } = await server.ssrLoadModule(
    '/src/lib/components/book-reader/reader-footer.ts'
  ));
});

after(async () => {
  await server?.close();
});

test('cards retain a 2:3 size without depending on button padding for height', async () => {
  const stylesheet = `${root}/src/app.scss`;
  const compiled = sass.compile(stylesheet);
  const result = await postcss([tailwind(require(`${root}/tailwind.config.cjs`))]).process(
    compiled.css,
    { from: stylesheet }
  );
  const cardStyle: Record<string, string> = {};
  const mediaStyle: Record<string, string> = {};
  result.root.walkRules((rule) => {
    const target =
      rule.selector === '.book-card-button'
        ? cardStyle
        : rule.selector === '.book-card-media'
          ? mediaStyle
          : undefined;
    if (target)
      rule.walkDecls((declaration) => {
        target[declaration.prop] = declaration.value;
      });
  });

  // The former padding-based aspect ratio collapsed after a button padding reset.
  // Native aspect-ratio supplies the height independently of padding.
  assert.equal(cardStyle['aspect-ratio'], '2/3');
  assert.equal(cardStyle.display, 'block');
  assert.equal(mediaStyle.position, 'absolute');
  assert.equal(mediaStyle.inset, '0');
  const { html } = render({ bookCards: [book], selectedBookIds: new Set() });
  assert.doesNotMatch(html, /aspect-[wh]-/);
  assert.match(html, /class="book-card-button [^"]*w-full/);
});

test('book cards offer separate reading and metadata buttons without a delete action', () => {
  const { html } = render({ bookCards: [book], selectedBookIds: new Set() });
  const buttons = html.match(/<button\b[^>]*>/g) || [];
  assert.equal(buttons.length, 2);
  assert.match(buttons[0], /type="button"/);
  assert.match(buttons[0], /aria-label="A book to read"/);
  assert.doesNotMatch(buttons[0], /aria-pressed/);
  assert.match(buttons[1], /type="button"/);
  assert.match(buttons[1], /aria-label="Details for A book to read"/);
  assert.doesNotMatch(html, /Delete book|Delete A book to read/);
  assert.ok(html.indexOf('</button>') < html.indexOf(buttons[1]));
});

test('selection mode exposes both selected and unselected toggle states', () => {
  for (const selected of [false, true]) {
    const { html } = render({
      bookCards: [book],
      selectedBookIds: new Set(selected ? [book.id] : []),
      selectMode: true
    });
    assert.match(html, new RegExp(`aria-pressed="${selected}"`));
    // The visual selection overlay must not add a second keyboard stop.
    assert.doesNotMatch(html, /role="button"|tabindex="0"/);
    assert.equal(html.includes('book-card-shell--selected'), selected);
    assert.doesNotMatch(html, /Details for|Book details|Delete book/);
    assert.equal((html.match(/<button\b/g) || []).length, 1);
  }
});

test('loading dialogs show the action as visible, announced text without pretending to know progress', () => {
  const { html } = renderLoading({ label: 'Opening book' });
  assert.match(html, /<p[^>]*>Opening book<\/p>/);
  assert.equal((html.match(/role="status"/g) || []).length, 1);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /app-loading-dialog--framed/);
  assert.doesNotMatch(html, /aria-valuenow|role="progressbar"|fa-spin/);
});

test('reader preparation uses the same indicator with the selected reader colors and no dialog frame', () => {
  const { html } = renderReaderLoading({ fontColor: '#eeeeee', backgroundColor: '#002a27' });
  assert.match(html, /Restoring your reading position/);
  assert.match(html, /--reader-page-text: #eeeeee/);
  assert.match(html, /--reader-page-bg: #002a27/);
  assert.equal((html.match(/role="status"/g) || []).length, 1);
  assert.doesNotMatch(html, /app-loading-dialog--framed|fa-spin/);
});

test('the footer presents chapter and progress as text with only collapse interactive', () => {
  const { html } = renderFooter({
    chapterLabel: 'Chapter -∞ 수와 공간에 대한 강의',
    exploredCharCount: 6778,
    bookCharCount: 94282,
    showCharacterCounter: true
  });
  assert.match(html, /Current chapter:/);
  assert.match(html, /Chapter -∞ 수와 공간에 대한 강의/);
  assert.match(html, /role="progressbar" aria-label="Book progress"/);
  assert.match(html, /aria-valuetext="7\.19% of book, 6,778 of 94,282 characters"/);
  assert.equal((html.match(/<button\b/g) || []).length, 1);
  assert.doesNotMatch(html, /Copy reading progress|Open contents|reader-footer-contents-icon/);
  assert.match(html, /class="reader-chrome-toggle reader-footer-toggle"/);
  assert.match(html, /aria-label="Hide reading progress"/);
  assert.match(html, /class="reader-footer-count"/);
  assert.match(html, /title="Character position: 6,778 of 94,282"/);
  assert.match(html, /class="sr-only"[^>]*>Character position:/);
  assert.match(html, /class="reader-footer-count-unit"[^>]*>characters/);
  assert.doesNotMatch(html, /reader-footer-book-label|>Book<| chars<|·/);
  const withoutCounter = renderFooter({
    exploredCharCount: 6778,
    bookCharCount: 94282,
    showCharacterCounter: false
  }).html;
  assert.doesNotMatch(withoutCounter, /class="reader-footer-count"/);
  const collapsed = renderFooter({ expanded: false, bookCharCount: 94282 }).html;
  assert.equal((collapsed.match(/<button\b/g) || []).length, 1);
  assert.match(collapsed, /class="reader-chrome-toggle reader-footer-reveal"/);
  assert.match(collapsed, /aria-label="Show reading progress"/);
  assert.match(collapsed, /aria-expanded="false"/);
  assert.doesNotMatch(collapsed, /<footer\b|role="progressbar"|reader-footer-controls/);
});

test('the header uses an icon-only collapse control with the same caret styling as the footer', () => {
  const { html } = renderReaderHeader({
    bookTitle: 'A book to read',
    hasChapterData: true,
    hasText: true,
    showFullscreenButton: true,
    hasBookmarkData: false,
    isBookmarkScreen: false,
    hasCustomReadingPoint: false,
    autoScrollMultiplier: 1
  });
  assert.match(html, /id="reader-header-toggle"[^>]*class="reader-chrome-toggle"/);
  assert.match(
    html,
    /aria-label="Hide reader controls" aria-expanded="true" aria-controls="reader-controls"/
  );
  assert.doesNotMatch(html, />Hide<\/span>/);
});

test('chapter landmarks retain real positions and thin out as the track narrows', () => {
  const sections = Array.from({ length: 100 }, (_, index) => ({
    reference: `chapter-${index}`,
    label: `Chapter ${index + 1}`,
    startCharacter: index * 100,
    charactersWeight: 100,
    progress: 0
  }));
  const narrow = getChapterMarkers(sections, 10000, 160);
  const wide = getChapterMarkers(sections, 10000, 800);
  assert.ok(narrow.length > 0 && narrow.length < wide.length);
  for (let i = 0; i < narrow.length; i += 1) {
    assert.ok(narrow[i].position > 0 && narrow[i].position < 100);
    assert.equal(narrow[i].position, Number(narrow[i].key.replace('chapter-', '')));
    if (i) assert.ok(((narrow[i].position - narrow[i - 1].position) / 100) * 160 >= 8 - 0.001);
  }
  assert.deepEqual(getChapterMarkers(sections, 0, 160), []);
  assert.deepEqual(getChapterMarkers(sections, 10000, 0), []);
});
