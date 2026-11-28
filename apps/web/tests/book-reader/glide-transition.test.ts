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
let sounds: typeof import('../../src/lib/data/sound-design.ts').soundDesign;
let getScrollPosition: (element: HTMLElement, vertical: boolean) => number;
let getReadingNodes: (node: Node) => Node[];
let toc: typeof import('../../src/lib/components/book-reader/book-toc/book-toc.ts');
let SectionCalculator: typeof import('../../src/lib/components/book-reader/book-reader-paginated/section-character-stats-calculator.ts').SectionCharacterStatsCalculator;

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
  ({ soundDesign: sounds } = await server.ssrLoadModule('/src/lib/data/sound-design.ts'));
  ({ getReaderScrollPosition: getScrollPosition } = await server.ssrLoadModule(
    '/src/lib/functions/reader-viewport.ts'
  ));
  ({ getParagraphNodes: getReadingNodes } = await server.ssrLoadModule(
    '/src/lib/components/book-reader/get-paragraph-nodes.ts'
  ));
  ({ SectionCharacterStatsCalculator: SectionCalculator } = await server.ssrLoadModule(
    '/src/lib/components/book-reader/book-reader-paginated/section-character-stats-calculator.ts'
  ));
  toc = (await server.ssrLoadModule(
    '/src/lib/components/book-reader/book-toc/book-toc.ts'
  )) as typeof import('../../src/lib/components/book-reader/book-toc/book-toc.ts');
});

after(async () => {
  await server?.close();
});

test('section lookup keeps completed and oversized bookmarks within the book', () => {
  const calculator = new SectionCalculator(
    {} as HTMLElement,
    [100, 100, 100],
    new BehaviorSubject(0),
    () => 800,
    () => 600,
    () => 40,
    false,
    {} as HTMLElement,
    {} as Document
  );
  for (const [count, expected] of [
    [0, 0],
    [99, 0],
    [100, 1],
    [200, 2],
    [300, 2],
    [400, 2]
  ]) {
    assert.equal(calculator.getSectionIndexByCharCount(count), expected);
  }
});

function setup(
  t: TestContext,
  vertical = false,
  reducedMotion = false,
  pageBleed = 0,
  motionRail = false,
  sectionIds = ['section']
) {
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
  const sectionIndex = new BehaviorSubject(0);
  const renderComplete = new Subject<number>();
  const motionStyle = motionRail ? { ...contentStyle } : contentStyle;
  const pageChange = new Subject<boolean>();
  const changes: boolean[] = [];
  pageChange.subscribe((value) => changes.push(value));
  const spacerStyle = { width: '', height: '' };
  const manager = new Manager(
    { style: contentStyle, scrollWidth: 5000, scrollHeight: 5000 } as unknown as HTMLElement,
    scrollEl,
    { style: spacerStyle } as HTMLElement,
    sectionIds,
    sectionIndex,
    position,
    800,
    600,
    40,
    1,
    vertical,
    PaginationTransitionMode.Glide,
    pageChange,
    renderComplete,
    pageBleed,
    motionRail ? ({ style: motionStyle } as unknown as HTMLElement) : undefined
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
    motionStyle,
    sectionIndex,
    renderComplete,
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

function observeSound(t: TestContext) {
  const updates: { progress: number; speed: number; direction: number }[] = [];
  let starts = 0;
  let finishes = 0;
  let cancels = 0;
  const clips: string[] = [];
  t.mock.method(sounds, 'beginPageMotion', () => {
    starts += 1;
    return {
      update: (progress: number, speed: number, direction: number) =>
        updates.push({ progress, speed, direction }),
      finish: () => {
        finishes += 1;
      },
      cancel: () => {
        cancels += 1;
      }
    };
  });
  t.mock.method(sounds, 'play', (cue: string) => {
    clips.push(cue);
  });
  return {
    updates,
    clips,
    get starts() {
      return starts;
    },
    get finishes() {
      return finishes;
    },
    get cancels() {
      return cancels;
    }
  };
}

for (const vertical of [false, true]) {
  test(`${vertical ? 'vertical' : 'horizontal'} page audio advances with visual frames and finishes at the visual commit`, (t) => {
    const sound = observeSound(t);
    const state = setup(t, vertical);
    const target = vertical ? 640 : 840;
    state.manager.nextPage();
    assert.equal(sound.starts, 0, 'input alone does not play a clip');
    assert.deepEqual(sound.clips, []);
    state.step(16);
    assert.equal(sound.starts, 1);
    assert.ok(Math.abs(sound.updates[0].progress - state.position.getValue() / target) < 0.00001);
    state.step(160);
    assert.equal(sound.finishes, 0);
    state.step(1000);
    assert.equal(state.position.getValue(), target);
    assert.equal(sound.finishes, 1);
    assert.equal(sound.cancels, 0);
  });
}

test('retargeting a glide preserves the audio gesture and cancellation cannot sound like a completed turn', (t) => {
  const sound = observeSound(t);
  const state = setup(t);
  state.manager.nextPage();
  state.step(100);
  const phase = sound.updates.at(-1)!.progress;
  state.manager.nextPage();
  state.step(116);
  assert.equal(sound.starts, 1);
  assert.ok(sound.updates.at(-1)!.progress > phase);
  state.manager.jumpTo(2520, false);
  assert.equal(sound.cancels, 1);
  assert.equal(sound.finishes, 0);
  assert.equal(state.frames.size, 0);
});

test('a normal chapter handoff releases the running sound so the next transition can continue it', (t) => {
  const sound = observeSound(t);
  const state = setup(t, false, false, 0, false, ['section', 'next-section']);
  state.manager.nextPage();
  state.step(100);
  state.manager.nextSection();
  assert.equal(sound.finishes, 1);
  assert.equal(sound.cancels, 0, 'a chapter handoff must not hard-cut the running oscillators');
  state.renderComplete.next(1);
});

test('restoration stays silent and reduced motion uses one immediate confirmation', (t) => {
  const sound = observeSound(t);
  const state = setup(t, false, true);
  state.manager.scrollTo(840, false);
  assert.equal(sound.starts, 0);
  assert.deepEqual(sound.clips, []);
  state.manager.nextPage();
  assert.equal(sound.starts, 0);
  assert.deepEqual(sound.clips, ['page']);
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

test('the motion rail moves without transforming the section layout itself', (t) => {
  const state = setup(t, false, false, 192, true);
  state.manager.nextPage();
  state.step(100);
  assert.match(state.motionStyle.transform, /translate3d\(/);
  assert.equal(state.contentStyle.transform, '');
  state.step(1000);
  assert.equal(state.motionStyle.transform, '');
  assert.equal(state.motionStyle.willChange, '');
});

test('the continuation button can open the next section directly without racing through remaining pages', (t) => {
  const state = setup(t, false, false, 192, true, ['section', 'next-section']);
  state.manager.nextSection();
  assert.equal(state.sectionIndex.getValue(), 1);
  assert.equal(state.frames.size, 0);
  assert.equal(state.manager.nextSection(), false);
  state.renderComplete.next(1);
  assert.equal(state.position.getValue(), 0);
  assert.equal(state.manager.nextSection(), false);
});

for (const vertical of [false, true]) {
  test(`${vertical ? 'vertical' : 'horizontal'} chapter labels stay with the mounted section at a character boundary`, (t) => {
    toc.sectionList$.next([
      { reference: 'section', label: 'Section 1', startCharacter: 0, charactersWeight: 1 },
      { reference: 'next-section', label: 'Section 2', startCharacter: 100, charactersWeight: 1 }
    ]);
    const state = setup(t, vertical, false, 192, true, ['section', 'next-section']);
    let sections: import('../../src/lib/components/book-reader/book-toc/book-toc.ts').SectionWithProgress[] =
      [];
    const subscription = toc.sectionProgress$.subscribe((data) => {
      sections = [...data.values()].map((section) => ({ ...section }));
    });
    t.after(() => {
      subscription.unsubscribe();
      toc.sectionList$.next([]);
    });

    // Completing the text and entering the next section have the same character count.
    const boundaryCharacter = 100;
    state.manager.jumpTo(vertical ? 4480 : 4200, false);
    assert.equal(toc.getCurrentChapterLabel(sections, boundaryCharacter), 'Section 1');
    assert.equal(toc.getChapterData(sections)[1], 0);

    state.manager.nextSection();
    assert.equal(toc.getCurrentChapterLabel(sections, boundaryCharacter), 'Section 1');
    state.renderComplete.next(1);
    assert.equal(toc.getCurrentChapterLabel(sections, boundaryCharacter), 'Section 2');
    assert.equal(toc.getChapterData(sections)[1], 1);

    state.manager.prevPage();
    assert.equal(toc.getCurrentChapterLabel(sections, boundaryCharacter), 'Section 2');
    state.renderComplete.next(0);
    assert.equal(toc.getCurrentChapterLabel(sections, boundaryCharacter), 'Section 1');
  });
}

test('a completed current subsection still belongs to its parent chapter', () => {
  const sections = [
    { reference: 'chapter', label: 'Chapter 1', charactersWeight: 1, progress: 100 },
    {
      reference: 'chapter-ending',
      parentChapter: 'chapter',
      charactersWeight: 1,
      progress: 100,
      isCurrent: true
    },
    { reference: 'next', label: 'Chapter 2', startCharacter: 100, charactersWeight: 1, progress: 0 }
  ];
  assert.equal(toc.getCurrentChapterLabel(sections, 100), 'Chapter 1');
  assert.equal(toc.getChapterData(sections)[1], 0);
});

test('continuous reading retains character-based labels without a mounted section', () => {
  const sections = [
    {
      reference: 'first',
      label: 'Chapter 1',
      startCharacter: 0,
      charactersWeight: 1,
      progress: 100
    },
    { reference: 'next', label: 'Chapter 2', startCharacter: 100, charactersWeight: 1, progress: 0 }
  ];
  assert.equal(toc.getCurrentChapterLabel(sections, 99), 'Chapter 1');
  assert.equal(toc.getCurrentChapterLabel(sections, 100), 'Chapter 2');
  assert.equal(toc.getCurrentChapterLabel([], 0, 'Book title'), 'Book title');
});

test('annotation destinations can be positioned directly without a spring', (t) => {
  const state = setup(t);
  state.manager.scrollToColumn(4240, false, { animate: false });
  assert.equal(state.position.getValue(), 4200);
  assert.equal(state.frames.size, 0);
  assert.equal(state.contentStyle.transform, '');
  assert.deepEqual(state.changes, [false]);
});

test('section handoffs wait for rendered content and preserve the intended boundary', (t) => {
  const state = setup(t, false, false, 192, true, ['section', 'next-section']);
  state.manager.jumpTo(4200, false);
  state.manager.nextPage();
  assert.equal(state.sectionIndex.getValue(), 1);
  assert.equal(state.manager.isSectionTransitionPending(), true);
  state.renderComplete.next(1);
  assert.equal(state.position.getValue(), 0);
  assert.equal(state.manager.isSectionTransitionPending(), false);
  state.manager.prevPage();
  assert.equal(state.sectionIndex.getValue(), 0);
  state.renderComplete.next(0);
  assert.equal(state.position.getValue(), 4200);
  assert.equal(state.manager.isSectionTransitionPending(), false);
});

test('closing the reader cancels a section handoff awaiting prepared content', (t) => {
  const state = setup(t, false, false, 192, true, ['section', 'next-section']);
  state.manager.jumpTo(4200, false);
  state.manager.nextPage();
  assert.equal(state.renderComplete.observed, true);
  state.manager.destroy();
  state.renderComplete.next(1);
  state.manager.nextPage();
  assert.equal(state.position.getValue(), 4200);
  assert.equal(state.renderComplete.observed, false);
  assert.equal(state.manager.isSectionTransitionPending(), false);
});

test('continuation labels never become book text or reading-progress characters', (t) => {
  class ReadingNode {
    static TEXT_NODE = 3;
    constructor(
      public nodeName: string,
      public nodeType: number,
      public childNodes: ReadingNode[] = [],
      private value = ''
    ) {}
    hasChildNodes() {
      return this.childNodes.length > 0;
    }
    get textContent(): string {
      return this.value || this.childNodes.map((node) => node.textContent).join('');
    }
  }
  class ReadingElement extends ReadingNode {
    attributes: { getNamedItem: (name: string) => object | null };
    constructor(name: string, children: ReadingNode[], flags: string[] = []) {
      super(name, 1, children);
      this.attributes = { getNamedItem: (key) => (flags.includes(key) ? { name: key } : null) };
    }
  }
  class ReadingImage extends ReadingElement {}
  for (const [key, value] of Object.entries({
    Node: ReadingNode,
    HTMLElement: ReadingElement,
    HTMLImageElement: ReadingImage
  })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, key, original);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  const prose = new ReadingNode('#text', 3, [], 'Actual chapter prose');
  const label = new ReadingNode('#text', 3, [], 'To Be Continued');
  const section = new ReadingElement('DIV', [
    new ReadingElement('P', [prose]),
    new ReadingElement('DIV', [new ReadingElement('BUTTON', [label])], ['data-ttu-reader-ui'])
  ]);
  assert.deepEqual(
    getReadingNodes(section as unknown as Node).map((node) => node.textContent),
    ['Actual chapter prose']
  );
});
