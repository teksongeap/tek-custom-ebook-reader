/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SoundEngine, type SoundCue } from '../../src/lib/functions/sound-engine.ts';
import { type PageSoundStyle } from '../../src/lib/functions/page-sounds.ts';

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

function fixture(initialState = 'running') {
  type FakeSource = {
    frequency: ReturnType<typeof parameter>;
    onended: (() => void) | undefined;
    starts: number[];
    stops: (number | undefined)[];
    disconnected: boolean;
    connect: () => void;
    disconnect: () => void;
    start: (at: number) => void;
    stop: (at?: number) => void;
  };
  const sources: FakeSource[] = [];
  const gains: ReturnType<typeof parameter>[] = [];
  const panners: {
    pan: ReturnType<typeof parameter>;
    disconnected: boolean;
    connect: () => void;
    disconnect: () => void;
  }[] = [];
  let created = 0;
  let visible = true;
  let closed = false;
  let resume: () => Promise<void> = async () => {
    context.state = 'running';
  };

  function parameter() {
    return {
      value: 0,
      targets: [] as { value: number; at: number }[],
      cancelScheduledValues() {},
      setValueAtTime(value: number) {
        this.value = value;
      },
      linearRampToValueAtTime(value: number) {
        this.value = value;
      },
      exponentialRampToValueAtTime(value: number) {
        this.value = value;
      },
      setTargetAtTime(value: number, at = 0) {
        this.value = value;
        this.targets.push({ value, at });
      }
    };
  }
  function source(): FakeSource {
    const node = {
      frequency: parameter(),
      onended: undefined as (() => void) | undefined,
      starts: [] as number[],
      stops: [] as (number | undefined)[],
      disconnected: false,
      connect() {},
      disconnect() {
        this.disconnected = true;
      },
      start(at: number) {
        this.starts.push(at);
      },
      stop(at?: number) {
        this.stops.push(at);
      }
    };
    sources.push(node);
    return node;
  }
  const context = {
    state: initialState,
    currentTime: 0,
    destination: {},
    resume: () => resume(),
    suspend: async () => {
      context.state = 'suspended';
    },
    close: async () => {
      context.state = 'closed';
      closed = true;
    },
    createGain: () => {
      const gain = parameter();
      gains.push(gain);
      return { gain, connect() {}, disconnect() {} };
    },
    createOscillator: source,
    createStereoPanner: () => {
      const panner = {
        pan: parameter(),
        disconnected: false,
        connect() {},
        disconnect() {
          this.disconnected = true;
        }
      };
      panners.push(panner);
      return panner;
    }
  };
  const engine = new SoundEngine(
    () => {
      created += 1;
      return context as unknown as AudioContext;
    },
    () => visible
  );
  return {
    engine,
    context,
    sources,
    gains,
    panners,
    get created() {
      return created;
    },
    get closed() {
      return closed;
    },
    hide() {
      visible = false;
    },
    setResume(next: () => Promise<void>) {
      resume = next;
    },
    advance() {
      context.currentTime += 1;
      sources.forEach((node) => node.onended?.());
    }
  };
}

test('audio stays lazy and disabled sound never creates a context', async () => {
  const f = fixture();
  f.engine.play('click');
  await flush();
  assert.equal(f.created, 0);
  f.engine.configure(false, 0.4, true);
  f.engine.unlock();
  assert.equal(f.created, 0);
  f.engine.configure(true, 0.4, true);
  f.engine.unlock();
  f.engine.unlock();
  assert.equal(f.created, 1);
  f.engine.play('click');
  await flush();
  assert.equal(f.sources.length, 2);
});

test('a semantic cue replaces its ordinary click and bursts are limited', async () => {
  const f = fixture();
  f.engine.unlock();
  f.engine.play('click');
  f.engine.play('open');
  f.engine.play('complete');
  f.engine.play('click');
  await flush();
  assert.equal(f.sources.length, 6, 'only the completion melody is scheduled');
  for (let index = 0; index < 20; index += 1) {
    f.engine.play('click');
    await flush();
  }
  assert.equal(f.sources.length, 6);
});

test('an async save is audible even immediately after a button click', async () => {
  const f = fixture();
  f.engine.unlock();
  f.engine.play('click');
  await flush();
  f.context.currentTime += 0.01;
  f.engine.play('save');
  await flush();
  assert.equal(f.sources.length, 4);
  assert.equal(f.sources[0].stops.at(-1), undefined, 'the earlier click is stopped');
  assert.equal(f.sources[1].stops.at(-1), undefined);
});

test('mute cancels queued and already scheduled sounds immediately', async () => {
  const f = fixture();
  f.engine.unlock();
  f.engine.play('complete');
  f.engine.configure(false, 0.4, true);
  await flush();
  assert.equal(f.sources.length, 0);
  f.engine.configure(true, 0.4, true);
  f.engine.play('complete');
  await flush();
  assert.equal(f.sources.length, 6);
  f.engine.configure(false, 0.4, true);
  assert.ok(f.sources.every((node) => node.stops.at(-1) === undefined));
  f.advance();
  assert.ok(f.sources.every((node) => node.disconnected));
});

test('page-turn preference affects pages while other interface sounds remain available', async () => {
  const f = fixture();
  f.engine.unlock();
  f.engine.play('page');
  f.engine.configure(true, 0.4, false);
  await flush();
  assert.equal(f.sources.length, 0, 'queued page turns also respect the preference');
  f.engine.play('page');
  f.engine.play('open');
  await flush();
  assert.equal(f.sources.length, 2);
});

test('volume clamps invalid ranges and zero volume cancels playback', async () => {
  const f = fixture();
  f.engine.configure(true, 5, true);
  f.engine.unlock();
  assert.equal(f.gains[0].value, 0.6);
  f.engine.configure(true, NaN, true);
  assert.equal(f.gains[0].value, 0.24);
  f.engine.configure(true, -1, true);
  f.engine.play('click');
  await flush();
  assert.equal(f.sources.length, 0);
  assert.equal(f.gains[0].value, 0);
});

test('auditioning a page sample does not replace the configured reading sound', async () => {
  const f = fixture();
  f.engine.configure(true, 0.4, true, 'fold');
  f.engine.unlock();
  f.engine.play('page', 'scan');
  await flush();
  assert.equal(f.sources.length, 4, 'the audition plays the requested sample');
  f.advance();
  f.engine.play('page');
  await flush();
  assert.equal(f.sources.length, 6, 'reading still uses the two-voice Fold sound');
});

test('every page sample respects mute and releases its audio and stereo nodes', async () => {
  for (const style of ['gather', 'ribbon', 'fold', 'scan'] as PageSoundStyle[]) {
    const f = fixture();
    f.engine.unlock();
    f.engine.play('page', style);
    f.engine.configure(false, 0.4, true, style);
    await flush();
    assert.equal(f.sources.length, 0, `${style}: mute cancels a queued audition`);
    f.engine.configure(true, 0.4, true, style);
    f.engine.play('page');
    await flush();
    assert.ok(f.sources.length > 0, `${style}: audio is scheduled`);
    assert.ok(
      f.sources.every((source) => source.starts.length === 1),
      `${style}: every voice starts`
    );
    assert.ok(f.sources.every((source) => source.stops.at(-1)! - source.starts[0] < 0.5));
    f.engine.configure(false, 0.4, true, style);
    assert.ok(
      f.sources.every(
        (source) =>
          source.stops.at(-1) === undefined || source.stops.at(-1)! <= f.context.currentTime + 0.005
      )
    );
    f.advance();
    assert.ok(f.sources.every((source) => source.disconnected));
    assert.ok(f.panners.every((panner) => panner.disconnected));
  }
});

test('background tabs cancel queued cues and hush suspends the device', async () => {
  const f = fixture();
  f.engine.unlock();
  f.engine.play('save');
  f.hide();
  await flush();
  assert.equal(f.sources.length, 0);
  f.engine.hush();
  assert.equal(f.context.state, 'suspended');
  f.engine.unlock();
  await flush();
  assert.equal(f.context.state, 'suspended');
});

test('page motion follows animation phase and only ends when the animation settles', () => {
  const f = fixture();
  f.engine.configure(true, 0.4, true, 'ribbon');
  f.engine.unlock();
  const motion = f.engine.beginPageMotion();
  motion.update(0.1, 3, 1);
  const earlyFrequency = f.sources[0].frequency.value;
  f.context.currentTime = 0.4;
  motion.update(0.7, 0.8, 1);
  assert.ok(f.sources[0].frequency.value > earlyFrequency);
  assert.ok(
    f.gains[1].targets.at(-1)!.value > 0,
    'audio remains tied to motion beyond the old clip duration'
  );
  assert.ok(f.sources.every((source) => source.stops.at(-1)! > 0.4));
  f.context.currentTime = 0.63;
  motion.finish();
  assert.ok(f.sources.every((source) => source.stops.at(-1) === 0.635));
  const stopCounts = f.sources.map((source) => source.stops.length);
  motion.update(0.8, 1, 1);
  assert.deepEqual(
    f.sources.map((source) => source.stops.length),
    stopCounts
  );
});

test('Fold is the default page sound', async () => {
  const f = fixture();
  f.engine.unlock();
  f.engine.play('page');
  await flush();
  assert.equal(f.sources.length, 2, 'default playback uses the two Fold voices');
  f.advance();
  const motion = f.engine.beginPageMotion();
  assert.equal(f.sources.length, 4, 'animated playback also defaults to Fold');
  motion.cancel();
});

test('Swell retains its authored swell and landing as a selectable alternative', () => {
  const f = fixture();
  f.engine.configure(true, 0.4, true, 'gather');
  f.engine.unlock();
  const motion = f.engine.beginPageMotion();
  assert.equal(f.sources.length, 3);
  motion.update(0.7, 1, 1, 0.2);
  assert.equal(f.gains[1].targets.at(-1)!.value, 0);
  f.context.currentTime = 0.5;
  motion.update(0.98, 0.1, 1, 0.02);
  assert.ok(f.gains[1].targets.at(-1)!.value > 0);
  f.context.currentTime = 0.52;
  motion.finish();
  assert.ok(Math.abs(f.sources[0].stops.at(-1)! - 0.605) < 0.00001);
  assert.ok(f.sources[1].stops.at(-1)! < f.sources[0].stops.at(-1)!);
  const sourceCount = f.sources.length;
  motion.finish();
  assert.equal(f.sources.length, sourceCount, 'settling cannot retrigger the cue');
  f.engine.configure(false, 0.4, true, 'gather');
  assert.ok(f.sources.every((source) => source.stops.at(-1) === 0.525));
});

test('muting page motion or hiding the reader cancels its held voices without a finish cue', () => {
  for (const cancel of ['page-toggle', 'mute', 'hidden', 'dispose']) {
    const f = fixture();
    f.engine.configure(true, 0.4, true, 'ribbon');
    f.engine.unlock();
    const motion = f.engine.beginPageMotion();
    motion.update(0.2, 2, 1);
    if (cancel === 'page-toggle') f.engine.configure(true, 0.4, false);
    if (cancel === 'mute') f.engine.configure(false, 0.4, true);
    if (cancel === 'hidden') f.hide();
    if (cancel === 'dispose') f.engine.dispose();
    motion.update(0.5, 1, 1);
    assert.ok(
      f.sources.every((source) => source.stops.at(-1) === 0.005),
      cancel
    );
    assert.equal(f.sources.length, 2, 'cancellation cannot trigger another tone');
    f.advance();
    assert.ok(f.sources.every((source) => source.disconnected));
    assert.ok(f.panners.every((panner) => panner.disconnected));
  }
});

test('page motion remains silent before a gesture and changes stereo direction with visual travel', () => {
  const f = fixture();
  f.engine.beginPageMotion().update(0.2, 1, 1);
  assert.equal(f.created, 0);
  f.engine.configure(true, 0.4, true, 'ribbon');
  f.engine.unlock();
  const motion = f.engine.beginPageMotion();
  motion.update(0.2, 1, 1);
  const forwardPan = f.panners[0].pan.value;
  motion.update(0.2, 1, -1);
  assert.equal(f.panners[0].pan.value, -forwardPan);
  motion.cancel();
});

test('the first keyboard cue waits for resume and muting cancels a pending resume cue', async () => {
  for (const muted of [false, true]) {
    const f = fixture('suspended');
    let resolve!: () => void;
    f.setResume(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        })
    );
    f.engine.unlock();
    f.engine.play('toggle');
    if (muted) f.engine.configure(false, 0.4, true);
    f.context.state = 'running';
    resolve();
    await flush();
    await flush();
    assert.equal(f.sources.length, muted ? 0 : 2);
  }
});

test('unsupported audio, blocked resume, and disposal cannot break an interaction', async () => {
  for (const create of [
    () => undefined,
    () => {
      throw new Error('Audio unavailable');
    }
  ]) {
    const engine = new SoundEngine(create);
    assert.doesNotThrow(() => engine.unlock());
    assert.doesNotThrow(() => engine.play('error'));
    engine.dispose();
  }
  const f = fixture('suspended');
  f.setResume(async () => {
    throw new Error('Autoplay blocked');
  });
  f.engine.unlock();
  f.engine.play('click');
  await flush();
  assert.equal(f.sources.length, 0);
  f.engine.dispose();
  assert.equal(f.closed, true);
  f.engine.unlock();
  assert.equal(f.created, 1);
});

test('every cue uses short, finite envelopes and disconnects ended sources', async () => {
  const f = fixture();
  f.engine.unlock();
  const cues: SoundCue[] = [
    'click',
    'toggle',
    'open',
    'close',
    'navigate',
    'book',
    'page',
    'save',
    'remove',
    'success',
    'complete',
    'error'
  ];
  for (const cue of cues) {
    f.advance();
    const previousCount = f.sources.length;
    f.engine.play(cue);
    await flush();
    assert.ok(f.sources.length > previousCount, `${cue} schedules audio`);
    for (const node of f.sources.slice(previousCount)) {
      assert.ok(node.starts[0] >= f.context.currentTime);
      assert.ok(node.stops.at(-1)! > node.starts[0]);
      assert.ok(node.stops.at(-1)! - node.starts[0] < 0.5);
    }
  }
  f.advance();
  assert.ok(f.sources.every((node) => node.disconnected));
});
