/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import assert from 'node:assert/strict';
import { after, before, test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { BehaviorSubject, Subject } from 'rxjs';
import { createServer, type ViteDevServer } from 'vite';
import type { PageManagerPaginated } from '../../src/lib/components/book-reader/book-reader-paginated/page-manager-paginated.ts';
import { PaginationTransitionMode } from '../../src/lib/data/pagination-transition-mode.ts';

let server: ViteDevServer;
let Manager: typeof PageManagerPaginated;
let getScrollPosition: (element: HTMLElement, vertical: boolean) => number;

before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL('../../', import.meta.url)),
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
    logLevel: 'error'
  });
  ({ PageManagerPaginated: Manager } = await server.ssrLoadModule(
    '/src/lib/components/book-reader/book-reader-paginated/page-manager-paginated.ts'
  ));
  ({ getReaderScrollPosition: getScrollPosition } = await server.ssrLoadModule(
    '/src/lib/functions/reader-viewport.ts'
  ));
});

after(async () => {
  await server?.close();
});

function setup(t: TestContext, vertical = false, reducedMotion = false, pageBleed = 0) {
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  const globals = {
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.set(++frameId, callback);
      return frameId;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
    window: { matchMedia: () => ({ matches: reducedMotion }) }
  };
  for (const [key, value] of Object.entries(globals)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, key, original);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  t.mock.method(performance, 'now', () => 0);

  const positions: ScrollToOptions[] = [];
  const contentStyle = {
    transform: '',
    willChange: '',
    removeProperty(key: string) {
      if (key === 'transform') this.transform = '';
      if (key === 'will-change') this.willChange = '';
    }
  };
  const scrollEl = {
    scrollLeft: 0,
    scrollTop: 0,
    scrollWidth: 5000 + (vertical ? 0 : pageBleed * 2),
    scrollHeight: 5000 + (vertical ? pageBleed * 2 : 0),
    style: {},
    scrollTo(this: HTMLElement, position: ScrollToOptions) {
      positions.push(position);
      if (position.left !== undefined) this.scrollLeft = position.left;
      if (position.top !== undefined) this.scrollTop = position.top;
    }
  } as unknown as HTMLElement;
  const position = new BehaviorSubject(0);
  const pageChange = new Subject<boolean>();
  const changes: boolean[] = [];
  pageChange.subscribe((value) => changes.push(value));
  const spacerStyle = { width: '', height: '' };
  const manager = new Manager(
    { style: contentStyle, scrollWidth: 5000, scrollHeight: 5000 } as unknown as HTMLElement,
    scrollEl,
    { style: spacerStyle } as HTMLElement,
    ['section'],
    new BehaviorSubject(0),
    position,
    800,
    600,
    40,
    1,
    vertical,
    PaginationTransitionMode.Glide,
    pageChange,
    new Subject<number>(),
    pageBleed
  );
  t.after(() => manager.destroy());

  function step(timestamp: number) {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback(timestamp));
  }

  return {
    manager,
    position,
    contentStyle,
    scrollEl,
    positions,
    changes,
    frames,
    spacerStyle,
    step
  };
}

for (const vertical of [false, true]) {
  test(`neighbor previews preserve ${vertical ? 'vertical' : 'horizontal'} page boundaries and trailing space`, (t) => {
    const state = setup(t, vertical, false, 192);
    const lastPage = vertical ? 4480 : 4200;
    const viewport = vertical ? 600 : 800;
    state.manager.jumpTo(lastPage, false);
    assert.equal(
      state.spacerStyle[vertical ? 'height' : 'width'],
      `${Math.max(5000, lastPage + viewport) + 384}px`
    );
    state.manager.nextPage();
    assert.equal(state.frames.size, 0);
    assert.equal(state.position.getValue(), lastPage);
    state.manager.prevPage();
    state.step(1000);
    assert.equal(state.position.getValue(), lastPage - viewport - 40);
    state.manager.destroy();
    assert.equal(state.spacerStyle.width, '');
    assert.equal(state.spacerStyle.height, '');
  });
}

for (const vertical of [false, true]) {
  test(`glide transforms ${vertical ? 'vertical' : 'horizontal'} text without scrolling each frame and settles exactly`, (t) => {
    const state = setup(t, vertical);
    const target = vertical ? 640 : 840;
    state.manager.nextPage();
    const preparedSpacer = { ...state.spacerStyle };
    state.step(16);
    const earlyPosition = state.position.getValue();
    assert.ok(earlyPosition > 0 && earlyPosition < target * 0.05);
    assert.match(state.contentStyle.transform, /translate3d\(/);
    assert.equal(state.contentStyle.willChange, 'transform');
    assert.equal(getScrollPosition(state.scrollEl, vertical), earlyPosition);
    assert.deepEqual(state.positions, []);
    assert.deepEqual(state.changes, []);
    state.step(160);
    assert.ok(state.position.getValue() > earlyPosition && state.position.getValue() < target);
    assert.deepEqual(state.spacerStyle, preparedSpacer);
    assert.deepEqual(state.positions, []);
    state.step(1000);
    assert.equal(state.position.getValue(), target);
    assert.deepEqual(state.positions.at(-1), { [vertical ? 'top' : 'left']: target });
    assert.deepEqual(state.changes, [true]);
    assert.equal(state.frames.size, 0);
    assert.equal(state.positions.length, 1);
    assert.equal(state.contentStyle.transform, '');
    assert.equal(state.contentStyle.willChange, '');
    assert.equal(getScrollPosition(state.scrollEl, vertical), target);
  });
}

test('repeated navigation preserves momentum and cancellation releases the temporary transform', (t) => {
  const state = setup(t);
  state.manager.nextPage();
  state.step(100);
  const beforeRetarget = state.position.getValue();
  state.manager.nextPage();
  assert.equal(state.frames.size, 1);
  state.step(116);
  // Restarting an ease-in here would nearly stop the text for this frame.
  assert.ok(state.position.getValue() - beforeRetarget > 30);
  state.step(1000);
  assert.equal(state.position.getValue(), 1680);
  assert.deepEqual(state.changes, [true]);
  state.manager.prevPage();
  state.step(100);
  state.manager.beginSectionTransition(1);
  assert.equal(state.frames.size, 0);
  assert.equal(state.contentStyle.transform, '');
  assert.equal(state.contentStyle.willChange, '');
});

test('reduced motion changes pages immediately without a transform or scheduled frames', (t) => {
  const state = setup(t, false, true);
  state.manager.nextPage();
  assert.equal(state.position.getValue(), 840);
  assert.deepEqual(state.changes, [true]);
  assert.equal(state.frames.size, 0);
  assert.equal(state.contentStyle.transform, '');
  assert.equal(state.contentStyle.willChange, '');
});

test('jumping during a glide cancels pending frames and restores native text navigation', (t) => {
  const state = setup(t);
  state.manager.nextPage();
  state.step(100);
  assert.ok(getScrollPosition(state.scrollEl, false) > state.scrollEl.scrollLeft);
  state.manager.jumpTo(2520, false);
  assert.equal(state.frames.size, 0);
  assert.equal(state.contentStyle.transform, '');
  assert.equal(state.contentStyle.willChange, '');
  assert.equal(getScrollPosition(state.scrollEl, false), 2520);
  assert.deepEqual(state.changes, [false]);
});

test('spring travel stays consistent across frame rates and missed frames', (t) => {
  const state = setup(t);
  state.manager.nextPage();
  for (let timestamp = 16; timestamp <= 160; timestamp += 16) state.step(timestamp);
  const regularPosition = state.position.getValue();
  state.manager.jumpTo(0, false);
  state.manager.nextPage();
  state.step(160);
  assert.ok(Math.abs(regularPosition - state.position.getValue()) < 0.001);
  state.step(1000);
  assert.equal(state.position.getValue(), 840);
});
