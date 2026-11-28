/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { followCollapseAnimation } from '../../src/lib/functions/collapse-sound.ts';

function fixture(t: TestContext, animated = true) {
  let nextFrame = 0;
  const frames = new Map<number, FrameRequestCallback>();
  for (const [key, value] of Object.entries({
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id)
  })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, key, original);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  let finish!: () => void;
  let reject!: () => void;
  const animation = {
    transitionProperty: 'height',
    effect: {
      getKeyframes: () => [{ height: '500px' }, { height: '100px' }],
      getComputedTiming: () => ({ progress: 0.5 })
    },
    finished: new Promise<void>((resolve, fail) => {
      finish = resolve;
      reject = fail;
    })
  };
  const element = {
    height: 460,
    isConnected: true,
    getAnimations: () => (animated ? [animation] : []),
    getBoundingClientRect: () => ({ height: element.height })
  };
  const progress: number[] = [];
  const calls: string[] = [];
  const cancel = followCollapseAnimation(
    element as unknown as HTMLElement,
    () => {
      calls.push('begin');
      return {
        update: (value: number) => progress.push(value),
        finish: () => calls.push('finish'),
        cancel: () => calls.push('cancel')
      };
    },
    () => calls.push('instant')
  );
  return {
    element,
    progress,
    calls,
    frames,
    cancel,
    finish,
    reject,
    frame() {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(0));
    }
  };
}

test('the contraction follows rendered height and resolves at the actual animation finish', async (t) => {
  const f = fixture(t);
  f.frame();
  assert.deepEqual(f.progress, [0.1]);
  f.element.height = 180;
  f.frame();
  assert.deepEqual(f.progress, [0.1, 0.8]);
  f.finish();
  await Promise.resolve();
  assert.deepEqual(f.calls, ['begin', 'finish']);
  assert.equal(f.progress.at(-1), 1);
  assert.equal(f.frames.size, 0);
});

test('reopening or removing a shelf cancels its cue without a delayed landing', async (t) => {
  const f = fixture(t);
  f.frame();
  f.cancel();
  f.finish();
  await Promise.resolve();
  f.frame();
  assert.deepEqual(f.calls, ['begin', 'cancel']);
  assert.equal(f.frames.size, 0);
});

test('reduced motion uses the short cue once instead of waiting for a transition', (t) => {
  const f = fixture(t, false);
  f.frame();
  f.frame();
  f.cancel();
  assert.deepEqual(f.calls, ['instant']);
  assert.equal(f.frames.size, 0);
});

test('a cancelled CSS transition cancels the sound', async (t) => {
  const f = fixture(t);
  f.frame();
  f.reject();
  await Promise.resolve();
  assert.deepEqual(f.calls, ['begin', 'cancel']);
  assert.equal(f.frames.size, 0);
});
