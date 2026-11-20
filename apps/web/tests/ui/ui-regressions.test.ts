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

test('opening and deleting books use separate named native buttons', () => {
  const { html } = render({ bookCards: [book], selectedBookIds: new Set() });
  const buttons = html.match(/<button\b[^>]*>/g) || [];
  assert.equal(buttons.length, 2);
  assert.match(buttons[0], /type="button"/);
  assert.match(buttons[0], /aria-label="A book to read"/);
  assert.doesNotMatch(buttons[0], /aria-pressed/);
  assert.match(buttons[1], /type="button"/);
  assert.match(buttons[1], /aria-label="Delete A book to read"/);
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
