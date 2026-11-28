/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { transitionReaderNavigation } from '../../src/lib/functions/reader-navigation-transition.ts';

function browser(
  t: TestContext,
  start?: (update: () => Promise<void>) => unknown,
  reduced = false
) {
  for (const [key, value] of Object.entries({
    document: { startViewTransition: start },
    window: { matchMedia: () => ({ matches: reduced }) }
  })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, key, original);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
}

function transition(update: () => Promise<void>, readyFails = false) {
  const updateCallbackDone = Promise.resolve().then(update);
  return {
    types: new Set<string>(),
    skipped: 0,
    skipTransition() {
      this.skipped += 1;
    },
    ready: readyFails ? Promise.reject(new Error('Snapshots unavailable')) : updateCallbackDone,
    finished: updateCallbackDone,
    updateCallbackDone
  };
}

test('the outgoing page is captured before preparing and positioning the destination', async (t) => {
  const steps: string[] = [];
  let release!: () => void;
  const prepared = new Promise<void>((resolve) => {
    release = resolve;
  });
  browser(t, (update) => {
    steps.push('capture');
    return transition(update);
  });
  let complete = false;
  const navigation = transitionReaderNavigation(async () => {
    steps.push('prepare');
    await prepared;
    steps.push('position');
  }).then(() => {
    complete = true;
  });
  await Promise.resolve();
  assert.deepEqual(steps, ['capture', 'prepare']);
  assert.equal(complete, false);
  release();
  await navigation;
  assert.deepEqual(steps, ['capture', 'prepare', 'position']);
});

test('section unfurls carry direction and writing mode while jumps stay simple fades', async (t) => {
  const transitions: ReturnType<typeof transition>[] = [];
  browser(t, (update) => {
    const next = transition(update);
    transitions.push(next);
    return next;
  });
  await transitionReaderNavigation(async () => {}, { kind: 'section', direction: 1 });
  assert.deepEqual([...transitions[0].types], ['ttu-reader-unfurl']);
  await transitionReaderNavigation(async () => {}, {
    kind: 'section',
    direction: -1,
    vertical: true
  });
  assert.deepEqual(
    [...transitions[1].types],
    ['ttu-reader-unfurl', 'ttu-reader-backward', 'ttu-reader-vertical']
  );
  await transitionReaderNavigation(async () => {});
  assert.equal(transitions[2].types.size, 0);
});

test('failed visual snapshots do not repeat or prevent navigation', async (t) => {
  let updates = 0;
  browser(t, (update) => transition(update, true));
  await transitionReaderNavigation(async () => {
    updates += 1;
  });
  assert.equal(updates, 1);
});

test('unsupported browsers still reach the destination', async (t) => {
  let updates = 0;
  browser(t);
  await transitionReaderNavigation(async () => {
    updates += 1;
  });
  assert.equal(updates, 1);
});

test('reduced motion reaches the destination without a snapshot', async (t) => {
  let updates = 0;
  browser(
    t,
    () => {
      throw new Error('Must not animate reduced motion');
    },
    true
  );
  await transitionReaderNavigation(async () => {
    updates += 1;
  });
  assert.equal(updates, 1);
});

test('synchronous API failures still reach the destination', async (t) => {
  let updates = 0;
  browser(t, () => {
    throw new Error('Transition unavailable');
  });
  await transitionReaderNavigation(async () => {
    updates += 1;
  });
  assert.equal(updates, 1);
});

test('a superseded transition cannot clear the newer active transition', async (t) => {
  const transitions: ReturnType<typeof transition>[] = [];
  browser(t, (update) => {
    const next = transition(update);
    transitions.push(next);
    return next;
  });
  let releaseFirst!: () => void;
  let releaseSecond!: () => void;
  const first = transitionReaderNavigation(
    () =>
      new Promise((resolve) => {
        releaseFirst = resolve;
      })
  );
  await Promise.resolve();
  const second = transitionReaderNavigation(
    () =>
      new Promise((resolve) => {
        releaseSecond = resolve;
      })
  );
  await Promise.resolve();
  assert.equal(transitions[0].skipped, 1);
  releaseFirst();
  await first;
  const third = transitionReaderNavigation(async () => {});
  assert.equal(transitions[1].skipped, 1);
  releaseSecond();
  await Promise.all([second, third]);
});

test('section audio waits for visual readiness, follows eased animation progress, and ends with the transition', async (t) => {
  let reveal!: () => void;
  let finish!: () => void;
  const ready = new Promise<void>((resolve) => {
    reveal = resolve;
  });
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  browser(t, (update) => ({
    types: new Set<string>(),
    skipTransition() {},
    ready,
    finished,
    updateCallbackDone: Promise.resolve().then(update)
  }));
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  for (const [key, value] of Object.entries({
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.set(++id, callback);
      return id;
    },
    cancelAnimationFrame: (frame: number) => {
      frames.delete(frame);
    }
  })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, key, original);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  t.mock.method(performance, 'now', () => 0);
  const progress = [0, 0];
  Object.assign(document, {
    getAnimations: () =>
      ['old', 'new'].map((kind, index) => ({
        effect: {
          pseudoElement: `::view-transition-${kind}(ttu-reader-page)`,
          getComputedTiming: () => ({ progress: progress[index] })
        }
      }))
  });
  let starts = 0;
  let finishes = 0;
  const updates: number[] = [];
  await transitionReaderNavigation(async () => {}, {
    kind: 'section',
    onMotion: () => {
      starts += 1;
      return {
        update: (value) => updates.push(value),
        finish: () => {
          finishes += 1;
        },
        cancel() {}
      };
    }
  });
  assert.equal(starts, 0, 'content preparation cannot start the sound');
  reveal();
  await Promise.resolve();
  assert.equal(starts, 1);
  progress[0] = 1;
  progress[1] = 0.6;
  const callbacks = [...frames.values()];
  frames.clear();
  callbacks.forEach((callback) => callback(200));
  assert.equal(updates[0], 0.8, 'the sound follows the actual old/new page effects');
  assert.equal(finishes, 0);
  finish();
  await Promise.resolve();
  assert.equal(finishes, 1);
  assert.equal(frames.size, 0);
});

test('reduced-motion section navigation gives confirmation only after the destination is ready', async (t) => {
  browser(t, undefined, true);
  const events: string[] = [];
  await transitionReaderNavigation(
    async () => {
      events.push('position');
    },
    {
      onInstant: () => events.push('confirm'),
      onMotion: () => {
        throw new Error('Reduced motion cannot create a moving sound');
      }
    }
  );
  assert.deepEqual(events, ['position', 'confirm']);
});
