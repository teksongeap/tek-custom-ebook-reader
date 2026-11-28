/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import {
  getPageSoundVoices,
  defaultPageSoundStyle,
  normalizePageSoundStyle,
  type PageSoundStyle,
  type SoundPoint
} from './page-sounds.ts';
import {
  createPageMotionSound,
  silentPageMotion,
  type PageMotionSound
} from './page-motion-sound.ts';

export type SoundCue =
  | 'click'
  | 'toggle'
  | 'open'
  | 'close'
  | 'navigate'
  | 'book'
  | 'page'
  | 'save'
  | 'remove'
  | 'success'
  | 'complete'
  | 'error';

const priority: Record<SoundCue, number> = {
  click: 0,
  toggle: 1,
  navigate: 2,
  open: 3,
  close: 3,
  book: 4,
  page: 4,
  save: 5,
  remove: 5,
  success: 6,
  complete: 7,
  error: 8
};

// One D-major pentatonic family connects the whole interface. Frequent actions
// stay brief and quiet; larger transitions can unfold into a melodic phrase.
const pitch = {
  lowRoot: 293.665,
  lowSecond: 329.628,
  root: 587.33,
  third: 739.989,
  fifth: 880,
  sixth: 987.767,
  octave: 1174.659
};

/** Small, offline sound palette. The context is created only from a user gesture. */
export class SoundEngine {
  private context: AudioContext | undefined;
  private master: GainNode | undefined;
  private voices = new Set<AudioScheduledSourceNode>();
  private enabled = true;
  private volume = 0.4;
  private pageTurns = true;
  private pageSoundStyle: PageSoundStyle = defaultPageSoundStyle;
  private pending: { cue: SoundCue; pageStyle: PageSoundStyle } | undefined;
  private lastPlayed = -Infinity;
  private lastPriority = -1;
  private resuming: Promise<void> | undefined;
  private generation = 0;
  private disposed = false;
  private pageMotions = new Set<PageMotionSound>();

  constructor(
    private createContext: () => AudioContext | undefined,
    private isVisible: () => boolean = () => true
  ) {}

  configure(
    enabled: boolean,
    volume: number,
    pageTurns: boolean,
    pageStyle: PageSoundStyle = defaultPageSoundStyle
  ) {
    this.enabled = enabled;
    this.volume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.4;
    this.pageTurns = pageTurns;
    this.pageSoundStyle = normalizePageSoundStyle(pageStyle);
    if (!enabled || this.volume === 0) this.stop();
    if (!pageTurns) for (const motion of this.pageMotions) motion.cancel();
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(this.volume * 0.6, this.context.currentTime, 0.015);
    }
  }

  unlock() {
    if (this.disposed || !this.enabled || !this.volume || !this.isVisible()) return;
    try {
      if (!this.context) {
        this.context = this.createContext();
        if (!this.context) return;
        this.master = this.context.createGain();
        this.master.gain.value = this.volume * 0.6;
        this.master.connect(this.context.destination);
      }
      if (this.context.state !== 'running' && this.context.state !== 'closed' && !this.resuming) {
        this.resuming = this.context
          .resume()
          .catch(() => {})
          .finally(() => {
            this.resuming = undefined;
          });
      }
    } catch (_) {
      // Audio is decoration; unsupported or blocked audio must never interrupt reading.
    }
  }

  play(cue: SoundCue, pageStyle: PageSoundStyle = this.pageSoundStyle) {
    if (
      this.disposed ||
      !this.enabled ||
      !this.volume ||
      !this.isVisible() ||
      !this.context ||
      (cue === 'page' && !this.pageTurns)
    )
      return;

    if (this.context.state !== 'running') {
      // The first keyboard click can arrive before the gesture's resume has settled.
      // Discard slow unlocks instead of surprising the reader with delayed audio.
      const requestedAt = performance.now();
      const generation = this.generation;
      void this.resuming?.then(() => {
        if (generation === this.generation && performance.now() - requestedAt < 200)
          this.play(cue, pageStyle);
      });
      return;
    }

    // A menu opening or save replaces its ordinary click in the same interaction.
    if (this.pending) {
      if (priority[cue] > priority[this.pending.cue]) this.pending = { cue, pageStyle };
      return;
    }
    this.pending = { cue, pageStyle };
    queueMicrotask(() => {
      const next = this.pending;
      this.pending = undefined;
      if (
        !next ||
        !this.context ||
        this.context.state !== 'running' ||
        !this.enabled ||
        !this.volume ||
        !this.isVisible() ||
        (next.cue === 'page' && !this.pageTurns)
      )
        return;
      const now = this.context.currentTime;
      if (now - this.lastPlayed < 0.07) {
        if (priority[next.cue] <= this.lastPriority) return;
        this.stop();
      }
      if (this.voices.size >= 12) return;
      this.lastPlayed = now;
      this.lastPriority = priority[next.cue];
      try {
        this.render(next.cue, now + 0.005, next.pageStyle);
      } catch (_) {
        // A device disconnect or browser interruption should remain silent.
        this.stop();
      }
    });
  }

  hush() {
    this.stop();
    if (this.context?.state === 'running') void this.context.suspend().catch(() => {});
  }

  beginPageMotion(pageStyle: PageSoundStyle = this.pageSoundStyle): PageMotionSound {
    if (
      this.disposed ||
      !this.enabled ||
      !this.volume ||
      !this.pageTurns ||
      !this.isVisible() ||
      !this.context ||
      !this.master ||
      this.context.state !== 'running'
    )
      return silentPageMotion;
    for (const previous of this.pageMotions) previous.cancel();
    let motion: PageMotionSound = silentPageMotion;
    motion = createPageMotionSound(
      this.context,
      this.master,
      pageStyle,
      () => this.enabled && !!this.volume && this.pageTurns && this.isVisible(),
      () => this.pageMotions.delete(motion)
    );
    if (motion !== silentPageMotion) this.pageMotions.add(motion);
    return motion;
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.master?.disconnect();
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {});
    this.context = undefined;
    this.master = undefined;
  }

  private stop() {
    for (const motion of this.pageMotions) motion.cancel();
    this.generation += 1;
    this.pending = undefined;
    for (const voice of this.voices) {
      try {
        voice.stop();
      } catch (_) {
        // Already ended.
      }
    }
    this.voices.clear();
  }

  private render(cue: SoundCue, at: number, pageStyle: PageSoundStyle) {
    switch (cue) {
      case 'click':
        this.tone(pitch.root, at, 0.065, 0.24);
        this.tone(pitch.octave, at + 0.008, 0.055, 0.035);
        break;
      case 'toggle':
        this.tone(pitch.third, at, 0.085, 0.19);
        this.tone(pitch.sixth, at + 0.035, 0.11, 0.1);
        break;
      case 'open':
        this.tone(pitch.root, at, 0.14, 0.18);
        this.tone(pitch.fifth, at + 0.045, 0.19, 0.12);
        break;
      case 'navigate':
        this.tone(pitch.third, at, 0.12, 0.16);
        this.tone(pitch.fifth, at + 0.04, 0.16, 0.11);
        break;
      case 'close':
        this.tone(pitch.fifth, at, 0.1, 0.14);
        this.tone(pitch.root, at + 0.035, 0.13, 0.12);
        break;
      case 'remove':
        this.tone(pitch.third, at, 0.11, 0.13);
        this.tone(pitch.lowRoot, at + 0.05, 0.17, 0.12);
        break;
      case 'book':
        [pitch.root, pitch.third, pitch.fifth, pitch.sixth].forEach((frequency, index) => {
          this.tone(frequency, at + index * 0.055, 0.26, 0.14 - index * 0.015);
        });
        break;
      case 'page':
        this.pageSound(pageStyle, at);
        break;
      case 'save':
        this.tone(pitch.fifth, at, 0.15, 0.18);
        this.tone(pitch.octave, at + 0.065, 0.24, 0.13);
        break;
      case 'success':
        [pitch.third, pitch.fifth, pitch.octave].forEach((frequency, index) => {
          this.tone(frequency, at + index * 0.065, 0.23, 0.16 - index * 0.02);
        });
        break;
      case 'complete':
        [pitch.root, pitch.third, pitch.sixth, pitch.octave].forEach((frequency, index) => {
          this.tone(frequency, at + index * 0.085, 0.32, 0.17 - index * 0.015);
        });
        this.tone(pitch.fifth, at + 0.31, 0.25, 0.045);
        this.tone(pitch.octave, at + 0.39, 0.28, 0.03);
        break;
      case 'error':
        this.tone(pitch.lowSecond, at, 0.14, 0.19);
        this.tone(pitch.lowRoot, at + 0.13, 0.19, 0.15);
        break;
    }
  }

  private pageSound(style: PageSoundStyle, at: number) {
    const context = this.context!;
    for (const voice of getPageSoundVoices(style)) {
      const start = at + voice.offset;
      const source = context.createOscillator();
      source.type = 'sine';
      const gain = context.createGain();
      this.automate(source.frequency, voice.frequency, start);
      this.automate(gain.gain, voice.gain, start);
      const pan =
        voice.pan && typeof context.createStereoPanner === 'function'
          ? context.createStereoPanner()
          : undefined;
      if (pan && voice.pan) this.automate(pan.pan, voice.pan, start);
      this.connectVoice(source, gain, start, voice.duration, pan);
    }
  }

  private automate(parameter: AudioParam, points: SoundPoint[], at: number) {
    points.forEach((point, index) => {
      const time = at + point.time;
      if (index === 0) parameter.setValueAtTime(point.value, time);
      else if (point.curve === 'exponential')
        parameter.exponentialRampToValueAtTime(point.value, time);
      else parameter.linearRampToValueAtTime(point.value, time);
    });
  }

  private tone(frequency: number, at: number, duration: number, level: number, from = frequency) {
    const context = this.context!;
    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(from, at);
    oscillator.frequency.exponentialRampToValueAtTime(frequency, at + duration * 0.45);
    this.envelope(oscillator, at, duration, level);
  }

  private envelope(source: AudioScheduledSourceNode, at: number, duration: number, level: number) {
    const gain = this.context!.createGain();
    gain.gain.setValueAtTime(0, at);
    // Preserve the melodic palette's punchy attack and brief initial body.
    gain.gain.linearRampToValueAtTime(level, at + 0.002);
    gain.gain.linearRampToValueAtTime(level * 0.72, at + 0.009);
    gain.gain.setValueAtTime(level * 0.72, at + duration * 0.22);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration - 0.002);
    gain.gain.linearRampToValueAtTime(0, at + duration);
    this.connectVoice(source, gain, at, duration);
  }

  private connectVoice(
    source: AudioScheduledSourceNode,
    gain: GainNode,
    at: number,
    duration: number,
    pan?: StereoPannerNode
  ) {
    source.connect(gain);
    if (pan) {
      gain.connect(pan);
      pan.connect(this.master!);
    } else gain.connect(this.master!);
    this.voices.add(source);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      pan?.disconnect();
      this.voices.delete(source);
    };
    source.start(at);
    source.stop(at + duration + 0.01);
  }
}
